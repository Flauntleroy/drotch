//! Real-time System Telemetry (CPU, RAM, Uptime) for Windows
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
#[allow(non_snake_case)]
struct FILETIME {
    dwLowDateTime: u32,
    dwHighDateTime: u32,
}

impl FILETIME {
    fn to_u64(&self) -> u64 {
        ((self.dwHighDateTime as u64) << 32) | (self.dwLowDateTime as u64)
    }
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
#[allow(non_snake_case)]
struct MEMORYSTATUSEX {
    dwLength: u32,
    dwMemoryLoad: u32,
    ullTotalPhys: u64,
    ullAvailPhys: u64,
    ullTotalPageFile: u64,
    ullAvailPageFile: u64,
    ullTotalVirtual: u64,
    ullAvailVirtual: u64,
    ullAvailExtendedVirtual: u64,
}

impl Default for MEMORYSTATUSEX {
    fn default() -> Self {
        Self {
            dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32,
            dwMemoryLoad: 0,
            ullTotalPhys: 0,
            ullAvailPhys: 0,
            ullTotalPageFile: 0,
            ullAvailPageFile: 0,
            ullTotalVirtual: 0,
            ullAvailVirtual: 0,
            ullAvailExtendedVirtual: 0,
        }
    }
}

#[link(name = "kernel32")]
extern "system" {
    fn GetSystemTimes(
        lpIdleTime: *mut FILETIME,
        lpKernelTime: *mut FILETIME,
        lpUserTime: *mut FILETIME,
    ) -> i32;
    fn GlobalMemoryStatusEx(lpBuffer: *mut MEMORYSTATUSEX) -> i32;
    fn GetTickCount64() -> u64;
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct TelemetryInfo {
    pub cpu_percent: f32,
    pub ram_percent: u32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub uptime_secs: u64,
}

#[derive(Debug, Clone, Copy)]
struct CpuState {
    last_idle: u64,
    last_kernel: u64,
    last_user: u64,
}

static CPU_STATE: Mutex<Option<CpuState>> = Mutex::new(None);

pub fn get_system_telemetry() -> TelemetryInfo {
    let mut idle_ft = FILETIME::default();
    let mut kernel_ft = FILETIME::default();
    let mut user_ft = FILETIME::default();

    let mut cpu_percent = 0.0f32;

    if unsafe { GetSystemTimes(&mut idle_ft, &mut kernel_ft, &mut user_ft) } != 0 {
        let current_idle = idle_ft.to_u64();
        let current_kernel = kernel_ft.to_u64();
        let current_user = user_ft.to_u64();

        if let Ok(mut lock) = CPU_STATE.lock() {
            if let Some(prev) = *lock {
                let delta_idle = current_idle.saturating_sub(prev.last_idle);
                let delta_kernel = current_kernel.saturating_sub(prev.last_kernel);
                let delta_user = current_user.saturating_sub(prev.last_user);
                let sys_total = delta_kernel + delta_user;

                if sys_total > 0 {
                    let busy = sys_total.saturating_sub(delta_idle);
                    cpu_percent = ((busy as f64 / sys_total as f64) * 100.0) as f32;
                    cpu_percent = cpu_percent.clamp(0.0, 100.0);
                }
            }
            *lock = Some(CpuState {
                last_idle: current_idle,
                last_kernel: current_kernel,
                last_user: current_user,
            });
        }
    }

    let mut mem = MEMORYSTATUSEX::default();
    let (ram_percent, ram_used_gb, ram_total_gb) = if unsafe { GlobalMemoryStatusEx(&mut mem) } != 0 {
        let total_gb = (mem.ullTotalPhys as f64) / (1024.0 * 1024.0 * 1024.0);
        let used_gb = ((mem.ullTotalPhys.saturating_sub(mem.ullAvailPhys)) as f64)
            / (1024.0 * 1024.0 * 1024.0);
        (mem.dwMemoryLoad, used_gb as f32, total_gb as f32)
    } else {
        (0, 0.0, 0.0)
    };

    let uptime_secs = unsafe { GetTickCount64() / 1000 };

    TelemetryInfo {
        cpu_percent,
        ram_percent,
        ram_used_gb,
        ram_total_gb,
        uptime_secs,
    }
}

pub fn start_telemetry_listener(app: AppHandle) {
    // Prime initial CPU tick
    get_system_telemetry();

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(1200));
            let data = get_system_telemetry();
            let _ = app.emit("system-telemetry", data);
        }
    });
}
