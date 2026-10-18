import { useState, useEffect, useRef } from "react";
import { useMedia, fmtTime } from "./media";
import { invoke } from "@tauri-apps/api/core";
import {
  IconPlay,
  IconPause,
  IconSkipNext,
  IconSkipPrev,
  IconLyrics,
  IconChevronRight,
  VinylDiscArtwork,
} from "../components/Icons";

export function useMusic() {
  return useMedia();
}

interface MusicPanelProps {
  onToggleLyrics?: () => void;
  isLyricsOpen?: boolean;
  onNextPanel?: () => void;
  onPrevPanel?: () => void;
}

export function MusicMini() {
  const media = useMedia();
  const label = !media?.has_session
    ? "No media playing"
    : `${media.title || "Unknown"}${media.artist ? ` · ${media.artist}` : ""}`;
  return (
    <div className="mini-music-row">
      <span className={`audio-dot ${media?.playing ? "playing" : ""}`} />
      <span className="mini-track-text" title={label}>
        {label}
      </span>
    </div>
  );
}

export function MusicPanel({
  onToggleLyrics,
  isLyricsOpen = true,
  onNextPanel,
}: MusicPanelProps) {
  const media = useMedia();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const [slideDir, setSlideDir] = useState<"next" | "prev">("next");
  const [isChangingSong, setIsChangingSong] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const lastTitleRef = useRef(media?.title);

  useEffect(() => {
    if (!media?.has_session || !media?.title) {
      setCoverUrl(null);
      return;
    }

    let isMounted = true;
    const track = media.title;
    const artist = media.artist || "";

    invoke<string>("cover_get", { track, artist })
      .then((url) => {
        if (isMounted) {
          setCoverUrl(url);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCoverUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [media?.title, media?.artist, media?.has_session]);

  const toggle = () => invoke("media_toggle").catch(() => {});

  const next = () => {
    setSlideDir("next");
    setIsChangingSong(true);
    setAnimKey((k) => k + 1);
    invoke("media_next").catch(() => {});
  };

  const prev = () => {
    setSlideDir("prev");
    setIsChangingSong(true);
    setAnimKey((k) => k + 1);
    invoke("media_prev").catch(() => {});
  };

  // Detect track changes automatically
  useEffect(() => {
    if (!media?.title) return;
    if (lastTitleRef.current && lastTitleRef.current !== media.title) {
      setIsChangingSong(true);
      setAnimKey((k) => k + 1);
    }
    lastTitleRef.current = media.title;

    const timer = setTimeout(() => {
      setIsChangingSong(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [media?.title]);

  const seek = (ms: number) =>
    invoke("media_seek", { positionMs: ms }).catch(() => {});

  const hasMedia = Boolean(media?.has_session && media?.title);
  const title = hasMedia ? media!.title : "Nothing Playing";
  const artist = hasMedia
    ? media!.artist || "Windows Audio"
    : "Play music on Spotify or Browser";
  const duration = media?.duration_ms || 0;
  const position = media?.position_ms || 0;
  const remaining = Math.max(0, duration - position);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setIsScrubbing(true);

    const r = target.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const newPos = Math.round(ratio * duration);
    setScrubPosition(newPos);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const newPos = Math.round(ratio * duration);
    setScrubPosition(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    seek(scrubPosition);
  };

  const displayPos = isScrubbing ? scrubPosition : position;
  const displayRemaining = Math.max(0, duration - displayPos);
  const displayPct = duration > 0 ? Math.min(100, (displayPos / duration) * 100) : 0;

  return (
    <div className="notch-music-card">
      <div className="music-main-row">
        {/* Animated Vinyl Artwork Disc or Real Cover Art */}
        <div className="album-art-wrap">
          <div
            key={`art-${animKey}`}
            className={`album-art-card ${media?.playing ? "is-playing" : ""} ${
              coverUrl ? "has-cover" : ""
            } ${isChangingSong ? `is-swapping-${slideDir}` : ""}`}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={title}
                className="album-cover-real-img"
                onError={() => setCoverUrl(null)}
              />
            ) : (
              <div className="vinyl-disc-grooves">
                <VinylDiscArtwork />
              </div>
            )}
            <div className="vinyl-specular-sheen" />
          </div>
        </div>

        {/* Track Title and Artist with Slide Animation */}
        <div className="music-info-col">
          <div
            key={`info-${animKey}`}
            className={`track-info-animate slide-${slideDir}`}
          >
            <div className="music-title-row">
              <div className="music-title" title={title}>
                {title}
              </div>
              {onNextPanel && (
                <button
                  className="panel-nav-arrow next-arrow"
                  onClick={onNextPanel}
                  title="Next panel"
                >
                  <IconChevronRight size={14} />
                </button>
              )}
            </div>
            <div className="music-artist" title={artist}>
              {artist}
            </div>
          </div>

          {/* Seekbar */}
          <div className="seekbar-container">
            <span className="seek-time current">{fmtTime(displayPos)}</span>
            <div
              className={`seekbar-track ${isScrubbing ? "is-scrubbing" : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="seekbar-progress" style={{ width: `${displayPct}%` }}>
                <span className="seekbar-scrubber-dot" />
              </div>
            </div>
            <span className="seek-time remaining">
              {duration > 0 ? `-${fmtTime(displayRemaining)}` : "--:--"}
            </span>
          </div>

          {/* Controls Bar */}
          <div className="music-controls-row">
            <button
              className={`control-btn lyrics-btn ${isLyricsOpen ? "active" : ""}`}
              onClick={onToggleLyrics}
              title="Toggle Lirik (Split View)"
            >
              <IconLyrics size={14} />
            </button>
            <div className="playback-btns">
              <button
                className={`control-btn ${
                  isChangingSong && slideDir === "prev" ? "btn-pop-prev" : ""
                }`}
                onClick={prev}
                title="Previous"
              >
                <IconSkipPrev size={16} />
              </button>
              <button
                className="control-btn play-pause-btn"
                onClick={toggle}
                title={media?.playing ? "Pause" : "Play"}
              >
                {media?.playing ? <IconPause size={17} /> : <IconPlay size={17} />}
              </button>
              <button
                className={`control-btn ${
                  isChangingSong && slideDir === "next" ? "btn-pop-next" : ""
                }`}
                onClick={next}
                title="Next"
              >
                <IconSkipNext size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
