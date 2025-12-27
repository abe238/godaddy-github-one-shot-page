use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Emitter, Manager,
};

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GodaddyConfig {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CloudflareConfig {
    pub api_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NamecheapConfig {
    pub api_user: Option<String>,
    pub api_key: Option<String>,
    pub client_ip: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct GithubConfig {
    pub token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub dns_provider: Option<String>,
    pub godaddy: Option<GodaddyConfig>,
    pub cloudflare: Option<CloudflareConfig>,
    pub namecheap: Option<NamecheapConfig>,
    pub github: Option<GithubConfig>,
}

fn get_config_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".gg-deploy")
        .join("config.json")
}

#[tauri::command]
fn read_config() -> Result<Config, String> {
    let path = get_config_path();
    if !path.exists() {
        return Ok(Config::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))
}

#[tauri::command]
fn write_config(config: Config) -> Result<(), String> {
    let path = get_config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = fs::Permissions::from_mode(0o600);
        fs::set_permissions(&path, perms).ok();
    }

    Ok(())
}

#[tauri::command]
fn get_config_path_str() -> String {
    get_config_path().to_string_lossy().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![read_config, write_config, get_config_path_str])
        .setup(|app| {
            // Debug logging
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create custom menu
            let handle = app.handle();

            // App menu (GG Deploy)
            let check_updates = MenuItem::with_id(handle, "check_updates", "Check for Updates...", true, None::<&str>)?;
            let app_menu = Submenu::with_items(
                handle,
                "GG Deploy",
                true,
                &[
                    &PredefinedMenuItem::about(handle, Some("About GG Deploy"), None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &check_updates,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, Some("Hide GG Deploy"))?,
                    &PredefinedMenuItem::hide_others(handle, Some("Hide Others"))?,
                    &PredefinedMenuItem::show_all(handle, Some("Show All"))?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::quit(handle, Some("Quit GG Deploy"))?,
                ],
            )?;

            // Edit menu
            let edit_menu = Submenu::with_items(
                handle,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ],
            )?;

            // Window menu
            let window_menu = Submenu::with_items(
                handle,
                "Window",
                true,
                &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::maximize(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ],
            )?;

            // Build menu bar
            let menu = Menu::with_items(handle, &[&app_menu, &edit_menu, &window_menu])?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "check_updates" {
                // Emit event to frontend to trigger update check
                let _ = app.emit("check-for-updates", ());
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
