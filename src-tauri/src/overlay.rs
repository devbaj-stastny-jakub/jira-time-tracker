//! The macOS quick-entry overlay: a Spotlight-style panel summoned by a global
//! shortcut. It is a true **non-activating NSPanel**, so it floats above other
//! apps (including their fullscreen Spaces) without stealing focus, never shows
//! in the Dock / cmd-tab, yet can still become key to accept typing.
//!
//! The window is built hidden at startup and converted to a panel once; the
//! shortcut just toggles its visibility. Closing happens via `order_out` (from
//! the shortcut, the `hide_overlay` command, or losing key focus), never by
//! destroying the window.
#![cfg(target_os = "macos")]

use tauri::{App, AppHandle, Emitter, LogicalPosition, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_nspanel::{
    cocoa::appkit::{NSMainMenuWindowLevel, NSWindowCollectionBehavior},
    panel_delegate, ManagerExt, WebviewWindowExt,
};

/// Window/panel label; also the route the webview loads (`/overlay`).
pub const LABEL: &str = "overlay";

/// `NSWindowStyleMaskNonactivatingPanel` — the panel accepts key input without
/// activating (foregrounding) the whole app.
const NONACTIVATING_PANEL: i32 = 1 << 7;

/// Build the hidden overlay window and turn it into a floating NSPanel.
pub fn setup(app: &App) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("overlay".into()))
        .title("Quick Entry")
        .inner_size(400.0, 500.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .visible(false)
        .build()?;

    let panel = window.to_panel().expect("failed to convert overlay to NSPanel");

    // One above the menu bar keeps it over fullscreen apps; the collection
    // behavior lets it ride along to whatever Space is active and stay put.
    panel.set_level((NSMainMenuWindowLevel + 1) as i32);
    panel.set_style_mask(NONACTIVATING_PANEL);
    // AppKit draws its drop shadow against the window's rectangular content
    // view, not the rounded card we paint inside — leaving visible "ears" at
    // the corners. The card supplies its own `shadow-2xl` in CSS, so we drop
    // the native one.
    panel.set_has_shadow(false);
    panel.set_collection_behaviour(
        NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary,
    );

    // Spotlight-style dismiss: the instant focus leaves the panel (clicking
    // another app), tell the webview to hide itself.
    let handle = app.handle().clone();
    let delegate = panel_delegate!(OverlayPanelDelegate {
        window_did_resign_key
    });
    delegate.set_listener(Box::new(move |name: String| {
        if name.as_str() == "window_did_resign_key" {
            let _ = handle.emit("overlay-blur", ());
        }
    }));
    panel.set_delegate(delegate);

    Ok(())
}

/// Show the overlay if hidden, hide it if shown — the global-shortcut action.
pub fn toggle(app: &AppHandle) {
    let Ok(panel) = app.get_webview_panel(LABEL) else {
        return;
    };
    if panel.is_visible() {
        panel.order_out(None);
    } else {
        position(app);
        panel.show();
    }
}

/// Hide the overlay (invoked from the webview on Escape / blur / after a save).
pub fn hide(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel(LABEL) {
        panel.order_out(None);
    }
}

/// Center the panel horizontally in the upper third of the primary display,
/// just before it is shown.
fn position(app: &AppHandle) {
    let (Some(window), Ok(Some(monitor))) =
        (app.get_webview_window(LABEL), app.primary_monitor())
    else {
        return;
    };
    let scale = monitor.scale_factor();
    let screen = monitor.size().to_logical::<f64>(scale);
    let Ok(size) = window.outer_size() else {
        return;
    };
    let win = size.to_logical::<f64>(scale);
    let x = (screen.width - win.width) / 2.0;
    let y = screen.height / 4.0;
    let _ = window.set_position(LogicalPosition::new(x, y));
}
