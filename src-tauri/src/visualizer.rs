use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use windows::core::*;
use windows::Win32::Media::Audio::*;
use windows::Win32::System::Com::*;

#[allow(dead_code)]
pub struct VisualizerHandle {
    running: Arc<AtomicBool>,
}

#[allow(dead_code)]
impl VisualizerHandle {
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

// 16 Logarithmically distributed target frequencies (Hz)
const TARGET_FREQS: [f32; 16] = [
    60.0, 100.0, 160.0, 250.0, 400.0, 650.0, 1000.0, 1500.0,
    2200.0, 3200.0, 4800.0, 7000.0, 9500.0, 12000.0, 14500.0, 17000.0,
];

pub fn start_visualizer(app: AppHandle) -> VisualizerHandle {
    let running = Arc::new(AtomicBool::new(true));
    let r_clone = running.clone();

    std::thread::spawn(move || {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        }

        let mut smoothed: [f32; 16] = [0.0; 16];

        while r_clone.load(Ordering::SeqCst) {
            match run_capture_loop(&app, &r_clone, &mut smoothed) {
                Ok(_) => {}
                Err(e) => {
                    eprintln!("WASAPI capture warning: {e}, retrying in 1s...");
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                }
            }
        }

        unsafe {
            CoUninitialize();
        }
    });

    VisualizerHandle { running }
}

fn run_capture_loop(
    app: &AppHandle,
    running: &Arc<AtomicBool>,
    smoothed: &mut [f32; 16],
) -> Result<()> {
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let device: IMMDevice = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let audio_client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;

        let p_format = audio_client.GetMixFormat()?;
        let format = &*p_format;
        let sample_rate = format.nSamplesPerSec as f32;
        let channels = format.nChannels as usize;
        let bits_per_sample = format.wBitsPerSample;

        // Initialize in loopback mode (20ms buffer = 200,000 in 100ns units)
        audio_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            200_000,
            0,
            p_format,
            None,
        )?;

        let capture_client: IAudioCaptureClient = audio_client.GetService()?;
        audio_client.Start()?;

        let mut sample_accumulator: Vec<f32> = Vec::with_capacity(2048);
        let mut last_emit = std::time::Instant::now();

        while running.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(16));

            let mut packet_length = capture_client.GetNextPacketSize()?;
            while packet_length > 0 {
                let mut p_data = std::ptr::null_mut();
                let mut num_frames = 0u32;
                let mut flags = 0u32;

                capture_client.GetBuffer(
                    &mut p_data,
                    &mut num_frames,
                    &mut flags,
                    None,
                    None,
                )?;

                if (flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) == 0 && !p_data.is_null() && num_frames > 0 {
                    if bits_per_sample == 32 {
                        let float_slice = std::slice::from_raw_parts(
                            p_data as *const f32,
                            (num_frames as usize) * channels,
                        );
                        // Convert to mono
                        for chunk in float_slice.chunks_exact(channels) {
                            let mono: f32 = chunk.iter().sum::<f32>() / (channels as f32);
                            sample_accumulator.push(mono);
                        }
                    } else if bits_per_sample == 16 {
                        let i16_slice = std::slice::from_raw_parts(
                            p_data as *const i16,
                            (num_frames as usize) * channels,
                        );
                        for chunk in i16_slice.chunks_exact(channels) {
                            let mono = chunk.iter().map(|&s| s as f32 / 32768.0).sum::<f32>() / (channels as f32);
                            sample_accumulator.push(mono);
                        }
                    }
                }

                capture_client.ReleaseBuffer(num_frames)?;
                packet_length = capture_client.GetNextPacketSize()?;
            }

            // Process audio analysis at ~30-60 FPS
            if last_emit.elapsed().as_millis() >= 25 {
                last_emit = std::time::Instant::now();

                let mut raw_bands = [0.0f32; 16];
                if sample_accumulator.len() >= 64 {
                    let samples = &sample_accumulator[sample_accumulator.len().saturating_sub(512)..];
                    let n = samples.len() as f32;

                    for (i, &freq) in TARGET_FREQS.iter().enumerate() {
                        let k = (freq * n / sample_rate).round();
                        let omega = (2.0 * std::f32::consts::PI * k) / n;
                        let coeff = 2.0 * omega.cos();

                        let mut s0;
                        let mut s1 = 0.0f32;
                        let mut s2 = 0.0f32;

                        for &sample in samples {
                            s0 = sample + coeff * s1 - s2;
                            s2 = s1;
                            s1 = s0;
                        }

                        let power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
                        let mag = if power > 0.0 { (power.sqrt() / n) * 4.0 } else { 0.0 };
                        // Apply perceptual loudness curve (boost highs/mids)
                        let boost = 1.0 + (i as f32 * 0.18);
                        raw_bands[i] = (mag * boost).min(1.0);
                    }
                    sample_accumulator.clear();
                }

                // Smooth transitions: fast rise, graceful decay
                let mut active = false;
                for i in 0..16 {
                    let raw = raw_bands[i];
                    if raw > smoothed[i] {
                        smoothed[i] = smoothed[i] * 0.3 + raw * 0.7; // Fast responsive jump
                    } else {
                        smoothed[i] = smoothed[i] * 0.82; // Smooth silky falloff
                    }
                    if smoothed[i] > 0.02 {
                        active = true;
                    }
                }

                if active {
                    let _ = app.emit("visualizer-bars", *smoothed);
                }
            }
        }

        let _ = audio_client.Stop();
        CoTaskMemFree(Some(p_format as *const _ as *const _));
    }

    Ok(())
}
