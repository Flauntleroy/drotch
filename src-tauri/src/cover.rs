use regex::Regex;
use std::collections::HashMap;
use std::sync::Mutex;

static COVER_CACHE: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

fn clean_title(s: &str) -> String {
    let re = Regex::new(r"(?i)\s*[-–]\s*(remaster|remastered|live|mono|stereo|radio|acoustic|deluxe).*|\s*[\(\[](remaster|remastered|official|video|audio|feat|featuring|live|deluxe|version).*?[\)\]]").unwrap();
    let cleaned = re.replace_all(s, "");
    let res = cleaned.trim().to_string();
    if res.is_empty() {
        s.to_string()
    } else {
        res
    }
}

pub async fn get_cover_art(track: &str, artist: &str) -> Result<String, String> {
    if track.trim().is_empty() {
        return Err("No track specified".into());
    }

    let cache_key = format!("{}::{}", track.trim(), artist.trim());
    {
        let mut guard = COVER_CACHE.lock().unwrap();
        let cache = guard.get_or_insert_with(HashMap::new);
        if let Some(url) = cache.get(&cache_key) {
            return Ok(url.clone());
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let mut clean_t = clean_title(track);
    let mut clean_a = clean_title(artist);

    if clean_a.is_empty()
        || clean_a.eq_ignore_ascii_case("windows audio")
        || clean_a.eq_ignore_ascii_case("unknown artist")
    {
        clean_a.clear();
        if clean_t.contains(" - ") {
            let parts: Vec<&str> = clean_t.splitn(2, " - ").collect();
            clean_a = clean_title(parts[0]);
            clean_t = clean_title(parts[1]);
        }
    }

    let search_term = if clean_a.is_empty() {
        clean_t.clone()
    } else {
        format!("{} {}", clean_t, clean_a)
    };

    // 1. Try iTunes Search API (Official HD 512x512 artwork)
    let itunes_res = client
        .get("https://itunes.apple.com/search")
        .query(&[
            ("term", &search_term),
            ("entity", &"song".to_string()),
            ("limit", &"1".to_string()),
        ])
        .send()
        .await;

    if let Ok(resp) = itunes_res {
        if resp.status().is_success() {
            if let Ok(v) = resp.json::<serde_json::Value>().await {
                if let Some(results) = v.get("results").and_then(|r| r.as_array()) {
                    if let Some(first) = results.first() {
                        if let Some(art) = first.get("artworkUrl100").and_then(|u| u.as_str()) {
                            // Upgrade resolution to 512x512
                            let hd_art = art.replace("100x100bb.jpg", "512x512bb.jpg");
                            let mut guard = COVER_CACHE.lock().unwrap();
                            let cache = guard.get_or_insert_with(HashMap::new);
                            cache.insert(cache_key, hd_art.clone());
                            return Ok(hd_art);
                        }
                    }
                }
            }
        }
    }

    // 2. Fallback: Deezer Public Search API
    let deezer_res = client
        .get("https://api.deezer.com/search")
        .query(&[
            ("q", &search_term),
            ("limit", &"1".to_string()),
        ])
        .send()
        .await;

    if let Ok(resp) = deezer_res {
        if resp.status().is_success() {
            if let Ok(v) = resp.json::<serde_json::Value>().await {
                if let Some(data) = v.get("data").and_then(|d| d.as_array()) {
                    if let Some(first) = data.first() {
                        if let Some(album) = first.get("album") {
                            let cover = album
                                .get("cover_big")
                                .or_else(|| album.get("cover_medium"))
                                .and_then(|c| c.as_str());
                            if let Some(c_url) = cover {
                                let mut guard = COVER_CACHE.lock().unwrap();
                                let cache = guard.get_or_insert_with(HashMap::new);
                                cache.insert(cache_key, c_url.to_string());
                                return Ok(c_url.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    Err("Cover art not found".into())
}
