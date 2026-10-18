//! Cuaca dari Open-Meteo (https://open-meteo.com) — gratis, tanpa API key.
//! Kota default: Marabahan, bisa diubah lewat settings.

use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize, Clone, Debug)]
pub struct WeatherInfo {
    pub city: String,
    pub temp_c: f64,
    pub condition: String,
    pub code: i32,
}

pub async fn fetch_weather(app: &AppHandle) -> Result<WeatherInfo, String> {
    let s = crate::settings::get_settings(app)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get("https://api.open-meteo.com/v1/forecast")
        .query(&[
            ("latitude", s.latitude.to_string()),
            ("longitude", s.longitude.to_string()),
            ("current", "temperature_2m,weather_code".to_string()),
            ("timezone", "auto".to_string()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let cur = v.get("current").ok_or("respons cuaca tidak valid")?;
    let temp_c = cur
        .get("temperature_2m")
        .and_then(|t| t.as_f64())
        .unwrap_or(0.0);
    let code = cur
        .get("weather_code")
        .and_then(|c| c.as_i64())
        .unwrap_or(0) as i32;

    Ok(WeatherInfo {
        city: s.city.clone(),
        temp_c,
        condition: wmo_label(code).to_string(),
        code,
    })
}

fn wmo_label(code: i32) -> &'static str {
    match code {
        0 => "Cerah",
        1 => "Cerah berawan",
        2 => "Berawan",
        3 => "Mendung",
        45 | 48 => "Berkabut",
        51 | 53 | 55 => "Gerimis",
        56 | 57 => "Gerimis beku",
        61 => "Hujan ringan",
        63 => "Hujan",
        65 => "Hujan lebat",
        66 | 67 => "Hujan es",
        71 | 73 | 75 | 77 => "Salju",
        80 | 81 | 82 => "Hujan deras",
        85 | 86 => "Salju lebat",
        95 => "Badai petir",
        96 | 99 => "Badai es",
        _ => "Tidak diketahui",
    }
}
