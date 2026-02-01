use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{SampleFormat, WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Simple linear interpolation resampling
fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || samples.is_empty() {
        return samples.to_vec();
    }

    let ratio = from_rate as f64 / to_rate as f64;
    let new_len = (samples.len() as f64 / ratio) as usize;
    let mut result = Vec::with_capacity(new_len);

    for i in 0..new_len {
        let src_pos = i as f64 * ratio;
        let src_idx = src_pos as usize;
        let frac = src_pos - src_idx as f64;

        let sample = if src_idx + 1 < samples.len() {
            // Linear interpolation between two samples
            samples[src_idx] * (1.0 - frac as f32) + samples[src_idx + 1] * frac as f32
        } else if src_idx < samples.len() {
            samples[src_idx]
        } else {
            0.0
        };

        result.push(sample);
    }

    result
}

/// Thread-safe audio state that doesn't contain the Stream
pub struct AudioState {
    is_recording: Arc<AtomicBool>,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
}

impl Default for AudioState {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            samples: Arc::new(Mutex::new(Vec::new())),
            sample_rate: 16000, // Whisper expects 16kHz
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn set_recording(&self, value: bool) {
        self.is_recording.store(value, Ordering::SeqCst);
    }

    pub fn clear_samples(&self) {
        if let Ok(mut samples) = self.samples.lock() {
            samples.clear();
        }
    }

    pub fn get_samples(&self) -> Vec<f32> {
        self.samples.lock().map(|s| s.clone()).unwrap_or_default()
    }

    pub fn get_audio_level(&self) -> f32 {
        let samples = match self.samples.lock() {
            Ok(s) => s,
            Err(_) => return 0.0,
        };

        if samples.is_empty() {
            return 0.0;
        }

        // Calculate RMS of last 1024 samples
        let recent: Vec<f32> = samples.iter().rev().take(1024).cloned().collect();
        if recent.is_empty() {
            return 0.0;
        }

        let sum: f32 = recent.iter().map(|s| s * s).sum();
        (sum / recent.len() as f32).sqrt()
    }
}

/// Thread-safe wrapper for audio state
pub type SharedAudioState = Arc<AudioState>;

pub fn create_audio_state() -> SharedAudioState {
    Arc::new(AudioState::new())
}

/// Start recording audio - this spawns a thread that handles the stream
pub fn start_recording_async(state: SharedAudioState, app: AppHandle) -> Result<(), String> {
    if state.is_recording() {
        return Err("Already recording".to_string());
    }

    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("No input device available")?;

    log::info!("Using input device: {}", device.name().unwrap_or_default());

    // Get supported config
    let supported_configs = device
        .supported_input_configs()
        .map_err(|e| e.to_string())?;

    let sample_rate = state.sample_rate;

    // Find a config that supports our sample rate, or use the default
    let config = supported_configs
        .filter(|c| c.channels() == 1 || c.channels() == 2)
        .find(|c| {
            c.min_sample_rate().0 <= sample_rate && c.max_sample_rate().0 >= sample_rate
        })
        .map(|c| c.with_sample_rate(cpal::SampleRate(sample_rate)))
        .or_else(|| device.default_input_config().ok())
        .ok_or("No suitable audio config found")?;

    log::info!(
        "Audio config: {} channels, {} Hz",
        config.channels(),
        config.sample_rate().0
    );

    let channels = config.channels() as usize;
    let actual_sample_rate = config.sample_rate().0;

    log::info!(
        "Recording with actual sample rate: {} Hz (target: {} Hz)",
        actual_sample_rate,
        sample_rate
    );

    // Clear previous samples
    state.clear_samples();

    // Set recording flag
    state.set_recording(true);

    let samples = Arc::clone(&state.samples);
    let is_recording_for_callback = Arc::clone(&state.is_recording);
    let is_recording_for_loop = Arc::clone(&state.is_recording);
    let app_clone = app.clone();
    let target_sample_rate = sample_rate;

    // Spawn a thread to handle audio recording
    // The stream must stay in this thread
    std::thread::spawn(move || {
        let stream_result = device.build_input_stream(
            &config.into(),
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                if !is_recording_for_callback.load(Ordering::SeqCst) {
                    return;
                }

                // Convert to mono if stereo
                let mono_samples: Vec<f32> = if channels == 2 {
                    data.chunks(2)
                        .map(|chunk| (chunk[0] + chunk.get(1).unwrap_or(&0.0)) / 2.0)
                        .collect()
                } else {
                    data.to_vec()
                };

                // Resample if necessary (simple linear interpolation)
                let resampled: Vec<f32> = if actual_sample_rate != target_sample_rate {
                    resample(&mono_samples, actual_sample_rate, target_sample_rate)
                } else {
                    mono_samples.clone()
                };

                // Calculate audio level for visualization (RMS)
                let rms: f32 = if !mono_samples.is_empty() {
                    let sum: f32 = mono_samples.iter().map(|s| s * s).sum();
                    (sum / mono_samples.len() as f32).sqrt()
                } else {
                    0.0
                };

                // Emit audio level to frontend
                let _ = app_clone.emit("audio-level", rms);

                // Store resampled samples
                if let Ok(mut samples_guard) = samples.lock() {
                    samples_guard.extend(resampled);
                }
            },
            move |err| {
                log::error!("Audio stream error: {}", err);
            },
            None,
        );

        match stream_result {
            Ok(stream) => {
                if let Err(e) = stream.play() {
                    log::error!("Failed to play stream: {}", e);
                    return;
                }

                log::info!("Recording started");

                // Keep the thread alive while recording
                while is_recording_for_loop.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                }

                log::info!("Recording stopped");
                // Stream is dropped here when the thread ends
            }
            Err(e) => {
                log::error!("Failed to build input stream: {}", e);
            }
        }
    });

    let _ = app.emit("recording-started", ());
    Ok(())
}

/// Stop recording and save to WAV file
pub fn stop_recording_sync(state: &SharedAudioState, app: &AppHandle) -> Result<PathBuf, String> {
    if !state.is_recording() {
        return Err("Not currently recording".to_string());
    }

    // Stop recording
    state.set_recording(false);

    // Give the thread a moment to finish
    std::thread::sleep(std::time::Duration::from_millis(200));

    // Get the samples
    let samples = state.get_samples();

    if samples.is_empty() {
        return Err("No audio recorded".to_string());
    }

    // Get temp directory
    let temp_dir = std::env::temp_dir();
    let filename = format!("voxforge_{}.wav", Uuid::new_v4());
    let output_path = temp_dir.join(filename);

    // Write WAV file
    let spec = WavSpec {
        channels: 1,
        sample_rate: state.sample_rate,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    let writer = BufWriter::new(file);
    let mut wav_writer = WavWriter::new(writer, spec).map_err(|e| e.to_string())?;

    // Convert f32 samples to i16 and write
    for sample in samples.iter() {
        let sample_i16 = (*sample * 32767.0).clamp(-32768.0, 32767.0) as i16;
        wav_writer
            .write_sample(sample_i16)
            .map_err(|e| e.to_string())?;
    }

    wav_writer.finalize().map_err(|e| e.to_string())?;

    log::info!("Recording saved to: {:?}", output_path);
    let _ = app.emit(
        "recording-stopped",
        output_path.to_string_lossy().to_string(),
    );

    Ok(output_path)
}
