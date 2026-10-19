//! Power and battery status monitor for Windows
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
struct SystemPowerStatus {
    pub ac_line_status: u8,
    pub battery_flag: u8,
    pub battery_life_percent: u8,
    pub system_status_flag: u8,
    pub battery_life_time: u32,
    pub battery_full_life_time: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PowerInfo {
    pub is_plugged: bool,
    pub percent: u8,
    pub has_battery: bool,
}

#[link(name = "kernel32")]
extern "system" {
    fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SystemPowerStatus) -> i32;
}

pub fn get_power_info() -> Option<PowerInfo> {
    let mut status = SystemPowerStatus::default();
    let res = unsafe { GetSystemPowerStatus(&mut status as *mut _) };
    if res != 0 {
        let is_plugged = status.ac_line_status == 1;
        let has_battery = (status.battery_flag & 128) == 0 && status.battery_life_percent <= 100;
        let percent = if status.battery_life_percent <= 100 {
            status.battery_life_percent
        } else {
            100
        };
        Some(PowerInfo {
            is_plugged,
            percent,
            has_battery,
        })
    } else {
        None
    }
}

pub fn start_power_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_plugged = None;

        loop {
            std::thread::sleep(Duration::from_millis(1500));
            if let Some(info) = get_power_info() {
                if info.has_battery {
                    if let Some(prev) = last_plugged {
                        if prev != info.is_plugged {
                            let _ = app.emit("power-status-changed", info.clone());
                        }
                    }
                    last_plugged = Some(info.is_plugged);
                }
            }
        }
    });
}
