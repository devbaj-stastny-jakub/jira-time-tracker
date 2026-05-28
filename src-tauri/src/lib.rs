use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod overlay;

/// Keychain service + account under which the connection credentials are stored.
/// A single entry holds the whole credential blob as JSON.
const KEYRING_SERVICE: &str = "com.timely.app";
const KEYRING_ACCOUNT: &str = "credentials";

/// SQLite database (relative to the app's data dir) holding local time records.
const DB_URL: &str = "sqlite:timetracker.db";

/// Global shortcut that toggles the quick-entry overlay: ⌃⌥T (Ctrl+Opt+T).
#[cfg(desktop)]
const OVERLAY_SHORTCUT_MODS: tauri_plugin_global_shortcut::Modifiers =
    tauri_plugin_global_shortcut::Modifiers::CONTROL
        .union(tauri_plugin_global_shortcut::Modifiers::ALT);
#[cfg(desktop)]
const OVERLAY_SHORTCUT_KEY: tauri_plugin_global_shortcut::Code =
    tauri_plugin_global_shortcut::Code::KeyT;

/// Schema migrations applied on startup by `tauri-plugin-sql`.
///
/// A time record always has a project, a Jira ticket, and a start/end instant
/// (UTC ISO-8601). Tags are a 0-N many-to-many via `record_tags`. Project and
/// tag IDs are remote references (resolved from the synced cache in the UI),
/// stored as text. Records are created locally; pushing to Jira/Everit is a
/// later, separate feature.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_time_records_and_record_tags",
            // NOTE: this string's exact bytes are checksummed by sqlx. It was
            // applied as v1 with the original 12/16-space indentation below, so it
            // must stay byte-identical — reindenting it makes sqlx reject the whole
            // migrate run ("previously applied but modified"). Keep it as-is even
            // though it no longer lines up with the surrounding (deeper) Rust.
            sql: "
            CREATE TABLE time_records (
                id            TEXT PRIMARY KEY NOT NULL,
                project_id    TEXT NOT NULL,
                ticket_number TEXT NOT NULL,
                start_at      TEXT NOT NULL,
                end_at        TEXT NOT NULL,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            );
            CREATE TABLE record_tags (
                record_id TEXT NOT NULL,
                tag_id    TEXT NOT NULL,
                PRIMARY KEY (record_id, tag_id),
                FOREIGN KEY (record_id) REFERENCES time_records(id) ON DELETE CASCADE
            );
            CREATE INDEX idx_time_records_start_at ON time_records(start_at);
        ",
            kind: MigrationKind::Up,
        },
        // Persist the synced reference data (previously kept only in the in-memory
        // React Query cache) so records resolve project/tag names on a cold launch
        // before any sync. Rows are display-only; a manual "Sync now" reconciles
        // them with Jira / Everit. The last-sync timestamps live outside SQLite
        // (in a tauri-plugin-store JSON file), so there is no timestamp column.
        Migration {
            version: 2,
            description: "create_projects_and_tags",
            sql: "
                CREATE TABLE projects (
                    id         TEXT PRIMARY KEY NOT NULL,
                    key        TEXT NOT NULL,
                    name       TEXT NOT NULL,
                    avatar_url TEXT
                );
                CREATE TABLE tags (
                    id   TEXT PRIMARY KEY NOT NULL,
                    name TEXT NOT NULL
                );
            ",
            kind: MigrationKind::Up,
        },
        // Per-record sync state for the manual push-to-Everit feature. All four
        // columns are nullable so existing rows survive without backfill.
        //   `everit_worklog_id` — remote ID after a successful push; null = never pushed.
        //   `synced_at`         — last successful push timestamp; `updated_at > synced_at` ⇒ stale.
        //   `last_sync_error`   — last failure message, surfaced on the row.
        //   `deleted_at`        — soft-delete marker; rows with this set are hidden
        //                         from list queries and pushed as DELETEs (then hard-removed).
        // States are derived from these four columns + `updated_at`; no status enum.
        Migration {
            version: 3,
            description: "add_sync_state_to_time_records",
            sql: "
                ALTER TABLE time_records ADD COLUMN everit_worklog_id TEXT;
                ALTER TABLE time_records ADD COLUMN synced_at         TEXT;
                ALTER TABLE time_records ADD COLUMN last_sync_error   TEXT;
                ALTER TABLE time_records ADD COLUMN deleted_at        TEXT;
            ",
            kind: MigrationKind::Up,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credentials {
    pub base_url: String,
    pub email: String,
    pub jira_token: String,
    pub timetracker_token: String,
}

fn entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| e.to_string())
}

/// Persist credentials to the OS keychain as a JSON blob.
#[tauri::command]
fn save_credentials(credentials: Credentials) -> Result<(), String> {
    let payload = serde_json::to_string(&credentials).map_err(|e| e.to_string())?;
    entry()?.set_password(&payload).map_err(|e| e.to_string())
}

/// Load credentials from the keychain. Returns `None` when no entry exists
/// (i.e. onboarding has not been completed yet).
#[tauri::command]
fn load_credentials() -> Result<Option<Credentials>, String> {
    match entry()?.get_password() {
        Ok(payload) => {
            let creds = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
            Ok(Some(creds))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Remove the stored credentials (used for re-onboarding / logout).
#[tauri::command]
fn clear_credentials() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Hide the quick-entry overlay. Called from its webview on Escape, blur, or
/// after a successful save. A no-op off macOS, where the overlay doesn't exist.
#[tauri::command]
fn hide_overlay(app: tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    overlay::hide(&app);
    #[cfg(not(target_os = "macos"))]
    let _ = app;
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(desktop)]
    use tauri_plugin_global_shortcut::ShortcutState;

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        );

    // ⌃⌥T toggles the quick-entry overlay. The shortcut is registered in
    // `setup`; the handler here only reacts to it (on key-down, not key-up).
    #[cfg(desktop)]
    {
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed
                        && shortcut.matches(OVERLAY_SHORTCUT_MODS, OVERLAY_SHORTCUT_KEY)
                    {
                        #[cfg(target_os = "macos")]
                        overlay::toggle(app);
                        #[cfg(not(target_os = "macos"))]
                        let _ = app;
                    }
                })
                .build(),
        );
    }

    // The non-activating overlay panel is macOS-only (NSPanel).
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(target_os = "macos")]
            overlay::setup(app)?;

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
                let shortcut = Shortcut::new(Some(OVERLAY_SHORTCUT_MODS), OVERLAY_SHORTCUT_KEY);
                app.global_shortcut().register(shortcut)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_credentials,
            load_credentials,
            clear_credentials,
            hide_overlay
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        // The window hides to the menu bar on close (handled in the frontend), so
        // clicking the Dock icon must bring it back. `Reopen` is macOS-only.
        .run(|_app_handle, _event| {
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Reopen { .. } = _event {
                    if let Some(window) = _app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        });
}
