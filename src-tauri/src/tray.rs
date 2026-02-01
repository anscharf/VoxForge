use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, Wry,
};

/// Create the system tray
pub fn create_tray(app: &AppHandle) -> tauri::Result<TrayIcon<Wry>> {
    // Create menu items
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let separator1 = MenuItem::new(app, "─────────────", false, None::<&str>)?;
    let start_recording =
        MenuItem::with_id(app, "start_recording", "Start Recording", true, Some("CmdOrCtrl+Shift+R"))?;
    let stop_recording =
        MenuItem::with_id(app, "stop_recording", "Stop Recording", false, None::<&str>)?;
    let separator2 = MenuItem::new(app, "─────────────", false, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator3 = MenuItem::new(app, "─────────────", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Voice Enricher", true, None::<&str>)?;

    // Build menu
    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &separator1,
            &start_recording,
            &stop_recording,
            &separator2,
            &settings_item,
            &separator3,
            &quit_item,
        ],
    )?;

    // Get default icon - use the app's default icon
    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        tauri::Error::AssetNotFound("No default window icon found".to_string())
    })?;

    // Build tray icon
    let tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Voice Enricher")
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            handle_tray_event(tray, event);
        })
        .build(app)?;

    Ok(tray)
}

/// Handle menu item clicks
fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        "show" => {
            show_main_window(app);
        }
        "start_recording" => {
            let _ = app.emit("toggle-recording", true);
        }
        "stop_recording" => {
            let _ = app.emit("toggle-recording", false);
        }
        "settings" => {
            let _ = app.emit("open-settings", ());
            show_main_window(app);
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

/// Handle tray icon events (clicks)
fn handle_tray_event<R: Runtime>(tray: &TrayIcon<R>, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            // Left click shows the window
            show_main_window(tray.app_handle());
        }
        TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } => {
            // Double click also shows the window
            show_main_window(tray.app_handle());
        }
        _ => {}
    }
}

/// Show and focus the main window
fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Update tray menu based on recording state
pub fn update_tray_recording_state(app: &AppHandle, is_recording: bool) -> tauri::Result<()> {
    // Note: In Tauri 2.x, we need to rebuild the menu or access menu items directly
    // For now, we'll emit an event that the frontend can use
    let _ = app.emit("recording-state-changed", is_recording);

    // Update tooltip based on state
    if let Some(tray) = app.tray_by_id("main") {
        let tooltip = if is_recording {
            "Voice Enricher - Recording..."
        } else {
            "Voice Enricher"
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }

    Ok(())
}
