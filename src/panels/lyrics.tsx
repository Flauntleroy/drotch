import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMedia } from "./media";
import { IconMic } from "../components/Icons";

interface LyricLine {
  ms: number;
  text: string;
}

export function LyricsMini() {
  const media = useMedia();
  const [line, setLine] = useState<string>("—");
  const [lines, setLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    if (!media?.has_session || !media.title) {
      setLines([]);
      return;
    }
    invoke<LyricLine[]>("lyrics_get", {
      track: media.title,
      artist: media.artist,
      durationSecs: Math.round(media.duration_ms / 1000),
    })
      .then(setLines)
      .catch(() => setLines([]));
  }, [media?.title, media?.artist]);

  useEffect(() => {
    if (!lines.length || !media) return;
    let cur = "";
    for (const l of lines) {
      if (l.ms <= media.position_ms) cur = l.text;
      else break;
    }
    setLine(cur || lines[0].text);
  }, [media?.position_ms, lines]);

  return (
    <div className="mini-music-row">
      <span className="mini-icon">
        <IconMic size={14} color="#38bdf8" />
      </span>
      <span className="mini-track-text" title={line}>
        {lines.length ? line : "Lirik tidak tersedia"}
      </span>
    </div>
  );
}

export function LyricsPanel() {
  const media = useMedia();
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [offsetMs, setOffsetMs] = useState<number>(0);
  const activeRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load saved offset for current song from localStorage
  useEffect(() => {
    if (!media?.title) return;
    const key = `lyric_offset_${media.title}_${media.artist || ""}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setOffsetMs(parseInt(saved, 10) || 0);
    } else {
      setOffsetMs(0);
    }
  }, [media?.title, media?.artist]);

  const changeOffset = (delta: number) => {
    if (!media?.title) return;
    const next = delta === 0 ? 0 : offsetMs + delta;
    setOffsetMs(next);
    const key = `lyric_offset_${media.title}_${media.artist || ""}`;
    if (next === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(next));
    }
  };

  useEffect(() => {
    if (!media?.has_session || !media.title) {
      setLines([]);
      return;
    }
    setLoading(true);
    invoke<LyricLine[]>("lyrics_get", {
      track: media.title,
      artist: media.artist,
      durationSecs: Math.round(media.duration_ms / 1000),
    })
      .then(setLines)
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [media?.title, media?.artist]);

  const effectiveMs = (media?.position_ms || 0) + offsetMs;

  const activeIdx = (() => {
    if (!media || !lines.length) return -1;
    let idx = -1;
    lines.forEach((l, i) => {
      if (l.ms <= effectiveMs) idx = i;
    });
    return idx;
  })();

  useEffect(() => {
    if (activeRef.current && boxRef.current) {
      const box = boxRef.current;
      const el = activeRef.current;
      const targetScroll = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
      box.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [activeIdx]);

  const jump = (ms: number) =>
    invoke("media_seek", { positionMs: ms }).catch(() => {});

  if (!media?.has_session) {
    return <div className="lyrics-empty-state">Putar musik untuk melihat lirik…</div>;
  }
  if (loading) {
    return <div className="lyrics-empty-state">Mencari lirik di LRCLIB…</div>;
  }
  if (!lines.length) {
    return (
      <div className="lyrics-empty-state">
        <p>Lirik tidak ditemukan di LRCLIB</p>
        <span className="lyrics-sub">{media.title}</span>
      </div>
    );
  }

  return (
    <div className="lyrics-container-wrap">
      {/* Precision Sync Offset Bar */}
      <div className="lyrics-sync-bar">
        <span className="sync-label">Sync</span>
        <button
          className="sync-btn"
          onClick={() => changeOffset(-500)}
          title="Lirik terlalu cepat? Mundurkan -0.5s"
        >
          -0.5s
        </button>
        <span
          className={`sync-offset-val ${offsetMs !== 0 ? "has-offset" : ""}`}
          onClick={() => changeOffset(0)}
          title="Klik untuk reset offset ke 0s"
        >
          {offsetMs === 0
            ? "0s"
            : `${offsetMs > 0 ? "+" : ""}${(offsetMs / 1000).toFixed(1)}s`}
        </span>
        <button
          className="sync-btn"
          onClick={() => changeOffset(500)}
          title="Lirik terlalu lambat? Majukan +0.5s"
        >
          +0.5s
        </button>
      </div>

      <div className="lyrics-box" ref={boxRef}>
        {lines.map((l, i) => (
          <div
            key={i}
            ref={i === activeIdx ? activeRef : undefined}
            className={`lyric-line ${i === activeIdx ? "active" : ""} ${
              i < activeIdx ? "past" : ""
            }`}
            onClick={() => jump(l.ms)}
            title="Klik untuk loncat ke bagian lagu ini"
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
