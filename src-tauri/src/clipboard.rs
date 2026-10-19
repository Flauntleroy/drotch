//! Clipboard history monitoring & persistence for Windows
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

use crate::store;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ClipboardItem {
    pub id: String,
    pub content: String,
    pub preview: String,
    pub kind: String, // "text" | "url" | "code" | "color"
    pub char_count: usize,
    pub line_count: usize,
    pub timestamp: u64,
    pub pinned: bool,
}

const CF_UNICODETEXT: u32 = 13;
const GMEM_MOVEABLE: u32 = 0x0002;

#[link(name = "user32")]
extern "system" {
    fn GetClipboardSequenceNumber() -> u32;
    fn OpenClipboard(hWndNewOwner: *mut std::ffi::c_void) -> i32;
    fn CloseClipboard() -> i32;
    fn GetClipboardData(uFormat: u32) -> *mut std::ffi::c_void;
    fn SetClipboardData(uFormat: u32, hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn EmptyClipboard() -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn GlobalAlloc(uFlags: u32, dwBytes: usize) -> *mut std::ffi::c_void;
    fn GlobalLock(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GlobalUnlock(hMem: *mut std::ffi::c_void) -> i32;
}

static LAST_COPIED_BY_DROTCH: RwLock<String> = RwLock::new(String::new());

fn load(app: &AppHandle) -> Result<Vec<ClipboardItem>, String> {
    store::read_json(app, "clipboard.json")
}

fn save(app: &AppHandle, items: &[ClipboardItem]) -> Result<(), String> {
    store::write_json(app, "clipboard.json", items)
}

pub fn get_clipboard_text() -> Option<String> {
    unsafe {
        let mut opened = false;
        for _ in 0..5 {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        if !opened {
            return None;
        }

        let handle = GetClipboardData(CF_UNICODETEXT);
        if handle.is_null() {
            CloseClipboard();
            return None;
        }

        let ptr = GlobalLock(handle) as *const u16;
        if ptr.is_null() {
            CloseClipboard();
            return None;
        }

        let mut len = 0;
        while *ptr.add(len) != 0 {
            len += 1;
        }
        let slice = std::slice::from_raw_parts(ptr, len);
        let text = String::from_utf16_lossy(slice);

        GlobalUnlock(handle);
        CloseClipboard();

        Some(text)
    }
}

pub fn set_clipboard_text(text: &str) -> Result<(), String> {
    if let Ok(mut lock) = LAST_COPIED_BY_DROTCH.write() {
        *lock = text.to_string();
    }

    let utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
    let bytes = utf16.len() * std::mem::size_of::<u16>();

    unsafe {
        let mut opened = false;
        for _ in 0..5 {
            if OpenClipboard(std::ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        if !opened {
            return Err("Gagal membuka clipboard Windows".into());
        }

        EmptyClipboard();

        let h_mem = GlobalAlloc(GMEM_MOVEABLE, bytes);
        if h_mem.is_null() {
            CloseClipboard();
            return Err("Gagal mengalokasikan memori clipboard".into());
        }

        let lock_ptr = GlobalLock(h_mem) as *mut u16;
        if lock_ptr.is_null() {
            CloseClipboard();
            return Err("Gagal mengunci memori clipboard".into());
        }

        std::ptr::copy_nonoverlapping(utf16.as_ptr(), lock_ptr, utf16.len());
        GlobalUnlock(h_mem);

        if SetClipboardData(CF_UNICODETEXT, h_mem).is_null() {
            CloseClipboard();
            return Err("Gagal mengisi data clipboard".into());
        }

        CloseClipboard();
        Ok(())
    }
}

fn detect_kind(text: &str) -> String {
    let trimmed = text.trim();
    if (trimmed.starts_with('#') && (trimmed.len() == 4 || trimmed.len() == 7 || trimmed.len() == 9))
        || trimmed.starts_with("rgb(")
        || trimmed.starts_with("rgba(")
        || trimmed.starts_with("hsl(")
    {
        return "color".to_string();
    }

    if trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || (trimmed.starts_with("www.") && trimmed.contains('.'))
    {
        return "url".to_string();
    }

    if trimmed.contains("{\n")
        || trimmed.contains("}\n")
        || trimmed.contains("function ")
        || trimmed.contains("const ")
        || trimmed.contains("let ")
        || trimmed.contains("import ")
        || trimmed.contains("class ")
        || trimmed.contains("def ")
        || trimmed.contains("=>")
        || trimmed.contains("</")
    {
        return "code".to_string();
    }

    "text".to_string()
}

pub fn add_item(app: &AppHandle, content: String) -> Result<Vec<ClipboardItem>, String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return load(app);
    }

    let mut items = load(app).unwrap_or_default();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let existing_idx = items.iter().position(|i| i.content == content);
    let is_pinned = existing_idx.map(|idx| items[idx].pinned).unwrap_or(false);

    if let Some(idx) = existing_idx {
        items.remove(idx);
    }

    let preview = if content.chars().count() > 220 {
        format!("{}…", content.chars().take(220).collect::<String>())
    } else {
        content.clone()
    };

    let kind = detect_kind(&content);
    let char_count = content.chars().count();
    let line_count = content.lines().count().max(1);

    let id = format!("{:x}", now);
    let new_item = ClipboardItem {
        id,
        content,
        preview,
        kind,
        char_count,
        line_count,
        timestamp: now,
        pinned: is_pinned,
    };

    items.insert(0, new_item);

    // Limit unpinned items to 100 max
    let mut unpinned_count = 0;
    items.retain(|i| {
        if i.pinned {
            true
        } else {
            unpinned_count += 1;
            unpinned_count <= 100
        }
    });

    save(app, &items)?;
    Ok(items)
}

pub fn list(app: &AppHandle) -> Result<Vec<ClipboardItem>, String> {
    load(app)
}

pub fn copy_item(app: &AppHandle, id: &str) -> Result<(), String> {
    let items = load(app)?;
    if let Some(item) = items.iter().find(|i| i.id == id) {
        set_clipboard_text(&item.content)
    } else {
        Err("Item tidak ditemukan".to_string())
    }
}

pub fn delete_item(app: &AppHandle, id: &str) -> Result<Vec<ClipboardItem>, String> {
    let mut items = load(app)?;
    items.retain(|i| i.id != id);
    save(app, &items)?;
    Ok(items)
}

pub fn clear_all(app: &AppHandle, clear_pinned: bool) -> Result<Vec<ClipboardItem>, String> {
    let mut items = load(app)?;
    if clear_pinned {
        items.clear();
    } else {
        items.retain(|i| i.pinned);
    }
    save(app, &items)?;
    Ok(items)
}

pub fn toggle_pin(app: &AppHandle, id: &str) -> Result<Vec<ClipboardItem>, String> {
    let mut items = load(app)?;
    if let Some(item) = items.iter_mut().find(|i| i.id == id) {
        item.pinned = !item.pinned;
    }
    save(app, &items)?;
    Ok(items)
}

pub fn start_clipboard_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_seq = unsafe { GetClipboardSequenceNumber() };

        // Initial fetch if clipboard already has text
        if let Some(initial_text) = get_clipboard_text() {
            if !initial_text.trim().is_empty() {
                let _ = add_item(&app, initial_text);
            }
        }

        loop {
            std::thread::sleep(Duration::from_millis(300));
            let current_seq = unsafe { GetClipboardSequenceNumber() };

            if current_seq != last_seq {
                last_seq = current_seq;

                if let Some(text) = get_clipboard_text() {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        let is_self = if let Ok(lock) = LAST_COPIED_BY_DROTCH.read() {
                            *lock == text
                        } else {
                            false
                        };

                        if !is_self {
                            if let Ok(updated) = add_item(&app, text) {
                                let _ = app.emit("clipboard-updated", updated);
                            }
                        }
                    }
                }
            }
        }
    });
}
