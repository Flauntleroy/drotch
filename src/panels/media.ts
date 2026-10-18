import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export interface MediaInfo {
  title: string;
  artist: string;
  playing: boolean;
  has_session: boolean;
  position_ms: number;
  duration_ms: number;
}

/** Shared hook: dengerin event "media-update" dari Rust dengan high-res position extrapolation. */
export function useMedia() {
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const syncRef = useRef<{ pos: number; time: number; playing: boolean }>({
    pos: 0,
    time: Date.now(),
    playing: false,
  });

  useEffect(() => {
    let unlisten: Promise<() => void> | null = null;
    unlisten = listen<MediaInfo>("media-update", (e) => {
      const data = e.payload;
      syncRef.current = {
        pos: data.position_ms,
        time: Date.now(),
        playing: data.playing,
      };
      setMedia(data);
    });

    invoke<MediaInfo>("media_info")
      .then((data) => {
        syncRef.current = {
          pos: data.position_ms,
          time: Date.now(),
          playing: data.playing,
        };
        setMedia(data);
      })
      .catch(() => {});

    // Smooth position interpolation every 50ms (sub-millisecond synced lyrics)
    const timer = setInterval(() => {
      if (!syncRef.current.playing) return;
      const elapsed = Date.now() - syncRef.current.time;
      setMedia((prev) => {
        if (!prev || !prev.playing) return prev;
        const newPos = Math.min(prev.duration_ms, syncRef.current.pos + elapsed);
        return { ...prev, position_ms: newPos };
      });
    }, 50);

    return () => {
      clearInterval(timer);
      unlisten?.then((f) => f());
    };
  }, []);

  return media;
}

export function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
