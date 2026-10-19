#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod cover;
mod lyric;
mod media;
mod power;
mod settings;
mod shelf;
mod store;
mod todo;
mod typing;
mod visualizer;
mod weather;

use tauri::{AppHandle, Emitter};

// ---- Cover Art ----
#[tauri::command]
async fn cover_get(track: String, artist: String) -> Result<String, String> {
    cover::get_cover_art(&track, &artist).await
}

// ---- Media ----
#[tauri::command]
async fn media_info() -> Result<media::MediaInfo, String> {
    media::get_media_info().await
}

#[tauri::command]
async fn media_toggle() -> Result<(), String> {
    media::toggle_play_pause().await
}

#[tauri::command]
async fn media_next() -> Result<(), String> {
    media::skip_next().await
}

#[tauri::command]
async fn media_prev() -> Result<(), String> {
    media::skip_previous().await
}

#[tauri::command]
async fn media_seek(position_ms: i64) -> Result<(), String> {
    media::seek_to(position_ms).await
}

// ---- Lyrics ----
#[tauri::command]
async fn lyrics_get(
    track: String,
    artist: String,
    duration_secs: i64,
) -> Result<Vec<lyric::LyricLine>, String> {
    lyric::fetch_lyrics(&track, &artist, duration_secs).await
}

// ---- Weather & Settings ----
#[tauri::command]
async fn weather_get(app: AppHandle) -> Result<weather::WeatherInfo, String> {
    weather::fetch_weather(&app).await
}

#[tauri::command]
fn settings_get(app: AppHandle) -> Result<settings::AppSettings, String> {
    settings::get_settings(&app)
}

#[tauri::command]
fn settings_set(app: AppHandle, settings: settings::AppSettings) -> Result<(), String> {
    settings::save_settings(&app, &settings)
}

// ---- Todo ----
#[tauri::command]
fn todo_list(app: AppHandle) -> Result<Vec<todo::Task>, String> {
    todo::list(&app)
}

#[tauri::command]
fn todo_add(app: AppHandle, title: String) -> Result<Vec<todo::Task>, String> {
    todo::add(&app, &title)
}

#[tauri::command]
fn todo_toggle(app: AppHandle, id: String) -> Result<Vec<todo::Task>, String> {
    todo::toggle(&app, &id)
}

#[tauri::command]
fn todo_delete(app: AppHandle, id: String) -> Result<Vec<todo::Task>, String> {
    todo::remove(&app, &id)
}

// ---- Shelf ----
#[tauri::command]
fn shelf_list(app: AppHandle) -> Result<Vec<shelf::ShelfItem>, String> {
    shelf::list(&app)
}

#[tauri::command]
fn shelf_add(app: AppHandle, path: String) -> Result<Vec<shelf::ShelfItem>, String> {
    shelf::add(&app, &path)
}

#[tauri::command]
fn shelf_remove(app: AppHandle, path: String) -> Result<Vec<shelf::ShelfItem>, String> {
    shelf::remove(&app, &path)
}

#[tauri::command]
fn shelf_open(app: AppHandle, path: String) -> Result<(), String> {
    shelf::open(&app, &path)
}

// ---- Drotch Island Expansion State ----
#[tauri::command]
fn set_island_expanded(expanded: bool) {
    typing::set_island_expanded(expanded);
}

// ---- Clipboard ----
#[tauri::command]
fn clipboard_list(app: AppHandle) -> Result<Vec<clipboard::ClipboardItem>, String> {
    clipboard::list(&app)
}

#[tauri::command]
fn clipboard_copy(app: AppHandle, id: String) -> Result<(), String> {
    clipboard::copy_item(&app, &id)
}

#[tauri::command]
fn clipboard_delete(app: AppHandle, id: String) -> Result<Vec<clipboard::ClipboardItem>, String> {
    clipboard::delete_item(&app, &id)
}

#[tauri::command]
fn clipboard_clear(app: AppHandle, clear_pinned: bool) -> Result<Vec<clipboard::ClipboardItem>, String> {
    clipboard::clear_all(&app, clear_pinned)
}

#[tauri::command]
fn clipboard_toggle_pin(app: AppHandle, id: String) -> Result<Vec<clipboard::ClipboardItem>, String> {
    clipboard::toggle_pin(&app, &id)
}

// ---- Power & Battery ----
#[tauri::command]
fn power_get() -> Result<Option<power::PowerInfo>, String> {
    Ok(power::get_power_info())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Polling SMTC tiap 1 detik -> event "media-update" ke frontend.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    match media::get_media_info().await {
                        Ok(info) => {
                            let _ = handle.emit("media-update", info);
                        }
                        Err(_) => {
                            let _ = handle.emit("media-update", media::MediaInfo::empty());
                        }
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                }
            });

            // Start real-time WASAPI audio loopback visualizer
            visualizer::start_visualizer(app.handle().clone());

            // Start privacy-preserving global typing activity listener
            typing::start_typing_listener(app.handle().clone());

            // Start background clipboard history monitor
            clipboard::start_clipboard_listener(app.handle().clone());

            // Start battery / power status monitor
            power::start_power_listener(app.handle().clone());

            // Load saved settings & activate global shortcut
            if let Ok(s) = settings::get_settings(&app.handle()) {
                typing::set_active_shortcut(&s.shortcut);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            media_info,
            media_toggle,
            media_next,
            media_prev,
            media_seek,
            lyrics_get,
            cover_get,
            weather_get,
            settings_get,
            settings_set,
            todo_list,
            todo_add,
            todo_toggle,
            todo_delete,
            shelf_list,
            shelf_add,
            shelf_remove,
            shelf_open,
            set_island_expanded,
            clipboard_list,
            clipboard_copy,
            clipboard_delete,
            clipboard_clear,
            clipboard_toggle_pin,
            power_get,
        ])
        .run(tauri::generate_context!())
        .expect("gagal menjalankan Drotch");
}
