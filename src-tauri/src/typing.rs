use serde::Serialize;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{OnceLock, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

type HHOOK = *mut std::ffi::c_void;
type LRESULT = isize;
type WPARAM = usize;
type LPARAM = isize;
type HOOKPROC = unsafe extern "system" fn(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT;

const WH_KEYBOARD_LL: i32 = 13;
const WM_KEYDOWN: usize = 0x0100;
const WM_SYSKEYDOWN: usize = 0x0104;

const VK_SPACE: u32 = 0x20;
const VK_OEM_3: u32 = 0xC0; // `~
const VK_N: u32 = 0x4E;

#[repr(C)]
#[derive(Clone, Copy)]
struct KBDLLHOOKSTRUCT {
    vk_code: u32,
    scan_code: u32,
    flags: u32,
    time: u32,
    dw_extra_info: usize,
}

#[link(name = "user32")]
extern "system" {
    fn SetWindowsHookExW(idHook: i32, lpfn: HOOKPROC, hmod: *mut std::ffi::c_void, dwThreadId: u32) -> HHOOK;
    fn CallNextHookEx(hhk: HHOOK, nCode: i32, wParam: WPARAM, lParam: LPARAM) -> LRESULT;
    fn UnhookWindowsHookEx(hhk: HHOOK) -> i32;
    fn GetMessageW(lpMsg: *mut std::ffi::c_void, hWnd: *mut std::ffi::c_void, wMsgFilterMin: u32, wMsgFilterMax: u32) -> i32;
    fn GetAsyncKeyState(vKey: i32) -> i16;
}

static mut HOOK_HANDLE: HHOOK = std::ptr::null_mut();
static KEY_COUNT: AtomicU64 = AtomicU64::new(0);
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
static ACTIVE_SHORTCUT: RwLock<String> = RwLock::new(String::new());

pub fn set_active_shortcut(shortcut: &str) {
    if let Ok(mut lock) = ACTIVE_SHORTCUT.write() {
        *lock = shortcut.to_string();
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct TypingActivity {
    pub is_typing: bool,
    pub speed: f32, // keys per second
    pub total: u64,
}

unsafe extern "system" fn hook_callback(n_code: i32, w_param: WPARAM, l_param: LPARAM) -> LRESULT {
    if n_code >= 0 && (w_param == WM_KEYDOWN || w_param == WM_SYSKEYDOWN) {
        KEY_COUNT.fetch_add(1, Ordering::Relaxed);

        let kbd = *(l_param as *const KBDLLHOOKSTRUCT);
        let vk = kbd.vk_code;

        let shortcut = ACTIVE_SHORTCUT.read().map(|s| s.clone()).unwrap_or_else(|_| "Ctrl+Shift+Space".to_string());
        let current_shortcut = if shortcut.is_empty() { "Ctrl+Shift+Space" } else { shortcut.as_str() };

        if current_shortcut != "None" {
            // Check modifier keys robustly across virtual codes (general, left, right)
            let ctrl = ((GetAsyncKeyState(0x11) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(0xA2) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(0xA3) as u16 & 0x8000) != 0);

            let shift = ((GetAsyncKeyState(0x10) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(0xA0) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(0xA1) as u16 & 0x8000) != 0);

            let alt = ((GetAsyncKeyState(0x12) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(0xA4) as u16 & 0x8000) != 0)
                || ((GetAsyncKeyState(0xA5) as u16 & 0x8000) != 0);

            let matches = match current_shortcut {
                "Ctrl+Shift+Space" => ctrl && shift && !alt && vk == VK_SPACE,
                "Alt+Space" => alt && !ctrl && !shift && vk == VK_SPACE,
                "Ctrl+`" => ctrl && !shift && !alt && vk == VK_OEM_3,
                "Ctrl+Shift+N" => ctrl && shift && !alt && vk == VK_N,
                _ => false,
            };

            if matches {
                println!("[Drotch] Global shortcut triggered: {}", current_shortcut);
                if let Some(app) = APP_HANDLE.get() {
                    let _ = app.emit("toggle-drotch", ());
                }
                // Swallowing key event so no unwanted character is typed
                return 1;
            }
        }
    }
    CallNextHookEx(HOOK_HANDLE, n_code, w_param, l_param)
}

pub fn start_typing_listener(app: AppHandle) {
    let _ = APP_HANDLE.set(app.clone());
    // 1. Thread for Windows Message Loop that maintains the LL keyboard hook
    std::thread::spawn(|| {
        let hook = unsafe {
            SetWindowsHookExW(WH_KEYBOARD_LL, hook_callback, std::ptr::null_mut(), 0)
        };
        if hook.is_null() {
            eprintln!("Failed to register low-level keyboard hook");
            return;
        }
        unsafe {
            HOOK_HANDLE = hook;
        }

        // Standard Windows message pump required for WH_KEYBOARD_LL
        let mut msg = [0u8; 48];
        unsafe {
            while GetMessageW(msg.as_mut_ptr() as *mut _, std::ptr::null_mut(), 0, 0) > 0 {}
            UnhookWindowsHookEx(HOOK_HANDLE);
        }
    });

    // 2. Monitoring thread that calculates rate & emits events to frontend
    std::thread::spawn(move || {
        let mut last_count = 0u64;
        let mut last_activity = Instant::now();
        let mut was_typing = false;
        let mut recent_keys: VecDeque<(Instant, u64)> = VecDeque::new();

        loop {
            std::thread::sleep(Duration::from_millis(60));

            let current_count = KEY_COUNT.load(Ordering::Relaxed);
            let now = Instant::now();

            if current_count > last_count {
                let diff = current_count - last_count;
                last_count = current_count;
                last_activity = now;

                recent_keys.push_back((now, diff));
            }

            // Purge keys older than 1.5 seconds
            while let Some((t, _)) = recent_keys.front() {
                if now.duration_since(*t).as_secs_f32() > 1.5 {
                    recent_keys.pop_front();
                } else {
                    break;
                }
            }

            let sum_recent: u64 = recent_keys.iter().map(|(_, c)| *c).sum();
            let speed = (sum_recent as f32) / 1.5;
            let is_active = now.duration_since(last_activity).as_secs_f32() < 1.1 && current_count > 0;

            if is_active {
                was_typing = true;
                let _ = app.emit(
                    "typing-activity",
                    TypingActivity {
                        is_typing: true,
                        speed,
                        total: current_count,
                    },
                );
            } else if was_typing {
                was_typing = false;
                let _ = app.emit(
                    "typing-activity",
                    TypingActivity {
                        is_typing: false,
                        speed: 0.0,
                        total: current_count,
                    },
                );
            }
        }
    });
}
