//! Pembaca info media via Windows System Media Transport Controls (SMTC).
//! Terhubung otomatis ke Spotify, browser, dan semua player yang terdaftar
//! di media control Windows.

use serde::Serialize;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionManager as SessionManager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as PlaybackStatus,
};

#[derive(Serialize, Clone, Debug)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub playing: bool,
    pub has_session: bool,
    pub position_ms: i64,
    pub duration_ms: i64,
}

impl MediaInfo {
    pub fn empty() -> Self {
        Self {
            title: String::new(),
            artist: String::new(),
            playing: false,
            has_session: false,
            position_ms: 0,
            duration_ms: 0,
        }
    }
}

async fn current_session() -> windows::core::Result<GlobalSystemMediaTransportControlsSession> {
    let manager = SessionManager::RequestAsync()?.get()?;
    manager.GetCurrentSession()
}

pub async fn get_media_info() -> Result<MediaInfo, String> {
    let session = current_session().await.map_err(|e| e.to_string())?;
    let props = session
        .TryGetMediaPropertiesAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    let playback_info = session.GetPlaybackInfo().map_err(|e| e.to_string())?;
    let status = playback_info.PlaybackStatus().map_err(|e| e.to_string())?;

    // Posisi & durasi (TimeSpan dalam satuan 100ns -> ms)
    let (position_ms, duration_ms) = match session.GetTimelineProperties() {
        Ok(tl) => {
            let pos = tl.Position().map(|t| t.Duration / 10_000).unwrap_or(0);
            let end = tl.EndTime().map(|t| t.Duration / 10_000).unwrap_or(0);
            (pos, end)
        }
        Err(_) => (0, 0),
    };

    Ok(MediaInfo {
        title: props.Title().map(|s| s.to_string()).unwrap_or_default(),
        artist: props.Artist().map(|s| s.to_string()).unwrap_or_default(),
        playing: status == PlaybackStatus::Playing,
        has_session: true,
        position_ms,
        duration_ms,
    })
}

pub async fn toggle_play_pause() -> Result<(), String> {
    let session = current_session().await.map_err(|e| e.to_string())?;
    session
        .TryTogglePlayPauseAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn skip_next() -> Result<(), String> {
    let session = current_session().await.map_err(|e| e.to_string())?;
    session
        .TrySkipNextAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn skip_previous() -> Result<(), String> {
    let session = current_session().await.map_err(|e| e.to_string())?;
    session
        .TrySkipPreviousAsync()
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Lompat ke posisi tertentu (ms). Dipakai untuk klik-baris-lirik.
pub async fn seek_to(position_ms: i64) -> Result<(), String> {
    let session = current_session().await.map_err(|e| e.to_string())?;
    session
        .TryChangePlaybackPositionAsync(position_ms * 10_000)
        .map_err(|e| e.to_string())?
        .get()
        .map_err(|e| e.to_string())?;
    Ok(())
}
