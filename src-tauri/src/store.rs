//! Helper penyimpanan JSON di app-data dir (Windows: %APPDATA%/com.jif.drotch).

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn data_file(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

pub fn read_json<T>(app: &AppHandle, name: &str) -> Result<T, String>
where
    T: serde::de::DeserializeOwned + Default,
{
    let p = data_file(app, name)?;
    if !p.exists() {
        return Ok(T::default());
    }
    let s = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    serde_json::from_str(&s).map_err(|e| e.to_string())
}

pub fn write_json<T>(app: &AppHandle, name: &str, v: &T) -> Result<(), String>
where
    T: serde::Serialize + ?Sized,
{
    let p = data_file(app, name)?;
    let s = serde_json::to_string_pretty(v).map_err(|e| e.to_string())?;
    std::fs::write(&p, s).map_err(|e| e.to_string())
}
