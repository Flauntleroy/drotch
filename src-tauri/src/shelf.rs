//! File shelf: drag file ke drotch untuk disimpan, klik untuk buka,
//! drag keluar / tombol x untuk hapus. Tersimpan lokal di shelf.json.

use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

use crate::store;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ShelfItem {
    pub name: String,
    pub path: String,
}

fn load(app: &AppHandle) -> Result<Vec<ShelfItem>, String> {
    store::read_json(app, "shelf.json")
}

fn save(app: &AppHandle, items: &[ShelfItem]) -> Result<(), String> {
    store::write_json(app, "shelf.json", items)
}

pub fn list(app: &AppHandle) -> Result<Vec<ShelfItem>, String> {
    load(app)
}

pub fn add(app: &AppHandle, path: &str) -> Result<Vec<ShelfItem>, String> {
    let mut items = load(app)?;
    if items.iter().any(|i| i.path == path) {
        return Ok(items); // sudah ada, abaikan
    }
    let name = Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());
    items.push(ShelfItem {
        name,
        path: path.to_string(),
    });
    save(app, &items)?;
    Ok(items)
}

pub fn remove(app: &AppHandle, path: &str) -> Result<Vec<ShelfItem>, String> {
    let mut items = load(app)?;
    items.retain(|i| i.path != path);
    save(app, &items)?;
    Ok(items)
}

/// Buka file dengan aplikasi default Windows.
pub fn open(app: &AppHandle, path: &str) -> Result<(), String> {
    let items = load(app)?;
    let item = items
        .iter()
        .find(|i| i.path == path)
        .ok_or("File tidak ada di shelf")?;
    std::process::Command::new("cmd")
        .args(["/C", "start", "", &item.path])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
