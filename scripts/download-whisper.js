#!/usr/bin/env node
/**
 * VoxForge - Download whisper.cpp binary for the current platform
 * This script downloads pre-built whisper.cpp binaries from GitHub releases
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// whisper.cpp release version
const WHISPER_VERSION = 'v1.7.4';
const WHISPER_REPO = 'ggerganov/whisper.cpp';

// Platform-specific binary names
const PLATFORMS = {
  'darwin-arm64': {
    downloadName: 'whisper-blas-bin-arm64.zip',
    binaryName: 'main',
    targetName: 'whisper-aarch64-apple-darwin',
  },
  'darwin-x64': {
    downloadName: 'whisper-blas-bin-x64.zip',
    binaryName: 'main',
    targetName: 'whisper-x86_64-apple-darwin',
  },
  'win32-x64': {
    downloadName: 'whisper-bin-x64.zip',
    binaryName: 'main.exe',
    targetName: 'whisper-x86_64-pc-windows-msvc.exe',
  },
  'linux-x64': {
    downloadName: 'whisper-blas-bin-x64.zip',
    binaryName: 'main',
    targetName: 'whisper-x86_64-unknown-linux-gnu',
  },
};

// Whisper models
const MODELS = {
  tiny: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: '75 MB',
  },
  base: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: '142 MB',
  },
  small: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: '466 MB',
  },
  medium: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    size: '1.5 GB',
  },
  large: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    size: '3.1 GB',
  },
};

const binariesDir = path.join(__dirname, '..', 'src-tauri', 'binaries');
const modelsDir = path.join(__dirname, '..', 'src-tauri', 'resources', 'models');

function getPlatformKey() {
  const platform = process.platform;
  const arch = process.arch;
  return `${platform}-${arch}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url}`);
    const file = fs.createWriteStream(dest);

    const request = (urlString) => {
      const protocol = urlString.startsWith('https') ? https : require('http');
      protocol.get(urlString, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(`Redirecting to: ${response.headers.location}`);
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);
        let downloadedBytes = 0;

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes) {
            const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('\nDownload complete!');
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };

    request(url);
  });
}

async function downloadWhisperBinary() {
  const platformKey = getPlatformKey();
  const platformConfig = PLATFORMS[platformKey];

  if (!platformConfig) {
    console.error(`Unsupported platform: ${platformKey}`);
    console.log('Supported platforms:', Object.keys(PLATFORMS).join(', '));
    process.exit(1);
  }

  ensureDir(binariesDir);

  const targetPath = path.join(binariesDir, platformConfig.targetName);

  // Check if binary already exists
  if (fs.existsSync(targetPath)) {
    console.log(`Whisper binary already exists: ${targetPath}`);
    return;
  }

  console.log(`\nDownloading whisper.cpp ${WHISPER_VERSION} for ${platformKey}...`);

  const downloadUrl = `https://github.com/${WHISPER_REPO}/releases/download/${WHISPER_VERSION}/${platformConfig.downloadName}`;
  const zipPath = path.join(binariesDir, platformConfig.downloadName);

  try {
    await downloadFile(downloadUrl, zipPath);

    // Extract the zip file
    console.log('Extracting...');

    if (process.platform === 'win32') {
      // Windows: Use PowerShell to extract
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${binariesDir}' -Force"`, { stdio: 'inherit' });
    } else {
      // macOS/Linux: Use unzip
      execSync(`unzip -o "${zipPath}" -d "${binariesDir}"`, { stdio: 'inherit' });
    }

    // Find and rename the binary
    const extractedBinary = path.join(binariesDir, platformConfig.binaryName);
    if (fs.existsSync(extractedBinary)) {
      fs.renameSync(extractedBinary, targetPath);
      console.log(`Renamed to: ${platformConfig.targetName}`);
    }

    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      fs.chmodSync(targetPath, 0o755);
    }

    // Clean up zip file
    fs.unlinkSync(zipPath);

    console.log(`\nWhisper binary installed: ${targetPath}`);
  } catch (error) {
    console.error(`Failed to download whisper binary: ${error.message}`);
    console.log('\nManual download instructions:');
    console.log(`1. Go to: https://github.com/${WHISPER_REPO}/releases/tag/${WHISPER_VERSION}`);
    console.log(`2. Download: ${platformConfig.downloadName}`);
    console.log(`3. Extract and rename the 'main' binary to: ${platformConfig.targetName}`);
    console.log(`4. Place it in: ${binariesDir}`);
    process.exit(1);
  }
}

async function downloadModel(modelName) {
  const model = MODELS[modelName];

  if (!model) {
    console.error(`Unknown model: ${modelName}`);
    console.log('Available models:', Object.keys(MODELS).join(', '));
    return false;
  }

  ensureDir(modelsDir);

  const modelPath = path.join(modelsDir, `ggml-${modelName}.bin`);

  // Check if model already exists
  if (fs.existsSync(modelPath)) {
    console.log(`Model already exists: ${modelPath}`);
    return true;
  }

  console.log(`\nDownloading ${modelName} model (${model.size})...`);
  console.log('This may take a while...\n');

  try {
    await downloadFile(model.url, modelPath);
    console.log(`\nModel installed: ${modelPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to download model: ${error.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
VoxForge - Whisper Setup Script

Usage:
  node download-whisper.js [options] [model]

Options:
  --binary-only    Only download the whisper binary, skip model
  --model-only     Only download the model, skip binary
  --all-models     Download all available models
  -h, --help       Show this help message

Models:
  tiny    (${MODELS.tiny.size})  - Fastest, lowest quality
  base    (${MODELS.base.size}) - Default, good balance
  small   (${MODELS.small.size}) - Better quality
  medium  (${MODELS.medium.size})  - High quality
  large   (${MODELS.large.size})  - Best quality, slowest

Examples:
  node download-whisper.js           # Download binary + base model
  node download-whisper.js small     # Download binary + small model
  node download-whisper.js --binary-only
  node download-whisper.js --model-only base
`);
    process.exit(0);
  }

  const binaryOnly = args.includes('--binary-only');
  const modelOnly = args.includes('--model-only');
  const allModels = args.includes('--all-models');

  // Filter out flags to get model name
  const modelArg = args.find(arg => !arg.startsWith('--') && Object.keys(MODELS).includes(arg));
  const modelName = modelArg || 'base';

  console.log('='.repeat(50));
  console.log('VoxForge - Whisper Setup');
  console.log('='.repeat(50));
  console.log(`Platform: ${getPlatformKey()}`);
  console.log(`Binaries directory: ${binariesDir}`);
  console.log(`Models directory: ${modelsDir}`);
  console.log('='.repeat(50));

  // Download binary
  if (!modelOnly) {
    await downloadWhisperBinary();
  }

  // Download model(s)
  if (!binaryOnly) {
    if (allModels) {
      for (const name of Object.keys(MODELS)) {
        await downloadModel(name);
      }
    } else {
      await downloadModel(modelName);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Setup complete!');
  console.log('='.repeat(50));
}

main().catch(console.error);
