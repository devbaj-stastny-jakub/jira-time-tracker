use keyring::Entry;
use serde::{Deserialize, Serialize};

/// Keychain service + account under which the connection credentials are stored.
/// A single entry holds the whole credential blob as JSON.
const KEYRING_SERVICE: &str = "cz.jira.timetracker";
const KEYRING_ACCOUNT: &str = "credentials";

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_credentials,
            load_credentials,
            clear_credentials
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
