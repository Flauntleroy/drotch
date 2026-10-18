//! Lirik synced dari LRCLIB (https://lrclib.net) dengan smart fallback search & offset parsing.

use regex::Regex;
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
pub struct LyricLine {
    pub ms: i64,
    pub text: String,
}

fn clean_title(s: &str) -> String {
    // Bersihkan tag seperti " - Remastered", "(Official Audio)", "[feat. ...]", dsb
    let re = Regex::new(r"(?i)\s*[-–]\s*(remaster|remastered|live|mono|stereo|radio|acoustic|deluxe).*|\s*[\(\[](remaster|remastered|official|video|audio|feat|featuring|live|deluxe|version).*?[\)\]]").unwrap();
    let cleaned = re.replace_all(s, "");
    let res = cleaned.trim().to_string();
    if res.is_empty() { s.to_string() } else { res }
}

pub async fn fetch_lyrics(
    track: &str,
    artist: &str,
    duration_secs: i64,
) -> Result<Vec<LyricLine>, String> {
    if track.is_empty() {
        return Ok(vec![]);
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let cleaned_track = clean_title(track);
    let cleaned_artist = clean_title(artist);

    // 1. Percobaan pertama: exact match via /api/get
    let mut synced_lrc = String::new();
    let resp = client
        .get("https://lrclib.net/api/get")
        .query(&[
            ("track_name", &cleaned_track),
            ("artist_name", &cleaned_artist),
            ("duration", &duration_secs.to_string()),
        ])
        .send()
        .await;

    if let Ok(r) = resp {
        if r.status().is_success() {
            if let Ok(v) = r.json::<serde_json::Value>().await {
                if let Some(s) = v.get("syncedLyrics").and_then(|s| s.as_str()) {
                    if !s.trim().is_empty() {
                        synced_lrc = s.to_string();
                    }
                }
            }
        }
    }

    // 2. Fallback jika exact match kosong: cari via /api/search
    if synced_lrc.is_empty() {
        let search_query = format!("{} {}", cleaned_track, cleaned_artist);
        let s_resp = client
            .get("https://lrclib.net/api/search")
            .query(&[("q", &search_query)])
            .send()
            .await;

        if let Ok(r) = s_resp {
            if r.status().is_success() {
                if let Ok(arr) = r.json::<Vec<serde_json::Value>>().await {
                    // Cari hasil terbaik yang punya syncedLyrics dan durasi mendekati
                    let mut best_match: Option<(i64, String)> = None;
                    for item in arr {
                        if let Some(s) = item.get("syncedLyrics").and_then(|s| s.as_str()) {
                            if s.trim().is_empty() {
                                continue;
                            }
                            let item_dur = item.get("duration").and_then(|d| d.as_f64()).unwrap_or(0.0) as i64;
                            let diff = (item_dur - duration_secs).abs();
                            if best_match.as_ref().map_or(true, |(best_diff, _)| diff < *best_diff) {
                                best_match = Some((diff, s.to_string()));
                            }
                        }
                    }
                    if let Some((_, lrc)) = best_match {
                        synced_lrc = lrc;
                    }
                }
            }
        }
    }

    Ok(parse_lrc(&synced_lrc))
}

fn parse_lrc(lrc: &str) -> Vec<LyricLine> {
    let re_line = Regex::new(r"\[(\d+):(\d+)\.(\d+)\]\s*(.*)").unwrap();
    let re_offset = Regex::new(r"(?i)\[offset:\s*([+-]?\d+)\]").unwrap();
    let mut offset_ms: i64 = 0;

    // Deteksi tag [offset: +/-ms]
    for raw in lrc.lines() {
        if let Some(caps) = re_offset.captures(raw) {
            if let Ok(val) = caps[1].parse::<i64>() {
                offset_ms = val;
                break;
            }
        }
    }

    let mut lines: Vec<LyricLine> = Vec::new();

    for raw in lrc.lines() {
        if let Some(caps) = re_line.captures(raw) {
            let min: i64 = caps[1].parse().unwrap_or(0);
            let sec: i64 = caps[2].parse().unwrap_or(0);
            let frac_raw = &caps[3];
            let frac_ms: i64 = match frac_raw.len() {
                2 => frac_raw.parse::<i64>().unwrap_or(0) * 10,
                _ => frac_raw
                    .chars()
                    .take(3)
                    .collect::<String>()
                    .parse()
                    .unwrap_or(0),
            };
            let text = caps[4].trim().to_string();
            if text.is_empty() {
                continue;
            }

            // Terapkan offset (LRC spec: [offset: 500] berarti kurangi 500ms agar muncul lebih awal)
            let base_ms = min * 60_000 + sec * 1000 + frac_ms;
            let adjusted_ms = (base_ms - offset_ms).max(0);

            lines.push(LyricLine {
                ms: adjusted_ms,
                text,
            });
        }
    }
    lines.sort_by_key(|l| l.ms);
    lines
}
