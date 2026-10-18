use serde::{Deserialize, Serialize};
use std::os::windows::process::CommandExt;
use tauri::AppHandle;

use crate::store;

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    #[serde(default)]
    pub autostart: bool,
    #[serde(default = "default_shortcut")]
    pub shortcut: String,
    #[serde(default = "default_true")]
    pub always_on_top: bool,
    #[serde(default = "default_true")]
    pub auto_collapse: bool,
    #[serde(default = "default_true")]
    pub typing_effects: bool,
    #[serde(default = "default_true")]
    pub living_eyes: bool,
    #[serde(default = "default_city")]
    pub city: String,
    #[serde(default = "default_lat")]
    pub latitude: f64,
    #[serde(default = "default_lon")]
    pub longitude: f64,
}

fn default_shortcut() -> String {
    "Ctrl+Shift+Space".to_string()
}
fn default_true() -> bool {
    true
}
fn default_city() -> String {
    "Marabahan".to_string()
}
fn default_lat() -> f64 {
    -2.90
}
fn default_lon() -> f64 {
    114.77
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            autostart: false,
            shortcut: default_shortcut(),
            always_on_top: true,
            auto_collapse: true,
            typing_effects: true,
            living_eyes: true,
            city: default_city(),
            latitude: default_lat(),
            longitude: default_lon(),
        }
    }
}

/// Cek apakah Drotch sudah terdaftar di registry Run Windows
pub fn is_autostart_enabled() -> bool {
    let output = std::process::Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "Drotch",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            return true;
        }
    }

    // Fallback: cek apakah masih ada entri lama "Notch"
    let old_output = std::process::Command::new("reg")
        .args([
            "query",
            r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
            "/v",
            "Notch",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if let Ok(out) = old_output {
        out.status.success()
    } else {
        false
    }
}

/// Tambahkan atau hapus Drotch dari startup registry Windows
pub fn set_autostart_registry(enable: bool) -> Result<(), String> {
    if enable {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = format!("\"{}\"", exe.to_string_lossy());
        let status = std::process::Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Drotch",
                "/t",
                "REG_SZ",
                "/d",
                &exe_str,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| e.to_string())?;

        // Bersihkan entri lama Notch jika ada
        let _ = std::process::Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Notch",
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        if !status.success() {
            return Err("Gagal mendaftarkan Drotch ke startup registry".into());
        }
    } else {
        let _ = std::process::Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Drotch",
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        let _ = std::process::Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Notch",
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    Ok(())
}

pub fn get_settings(app: &AppHandle) -> Result<AppSettings, String> {
    let mut s: AppSettings = store::read_json(app, "settings.json").unwrap_or_default();
    // Sinkronkan status autostart langsung dari Windows registry
    s.autostart = is_autostart_enabled();
    Ok(s)
}

pub fn save_settings(app: &AppHandle, s: &AppSettings) -> Result<(), String> {
    // 1. Terapkan ke Windows Registry
    let _ = set_autostart_registry(s.autostart);

    // 2. Perbarui active shortcut di typing hook
    crate::typing::set_active_shortcut(&s.shortcut);

    // 3. Simpan ke settings.json
    store::write_json(app, "settings.json", s)
}
