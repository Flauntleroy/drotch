import { useEffect, useRef, useState } from "react";
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useMedia } from "./panels/media";
import { MusicPanel } from "./panels/music";
import { LyricsPanel } from "./panels/lyrics";
import { WeatherPanel } from "./panels/weather";
import { WaterWidget } from "./panels/water";
import { TodoPanel } from "./panels/todo";
import { ShelfPanel } from "./panels/shelf";
import { SettingsPanel } from "./panels/settings";
import { ClipboardPanel } from "./panels/clipboard";
import { NotchEyes } from "./components/NotchEyes";
import {
  IconPin,
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
} from "./components/Icons";
import "./styles.css";

type PanelId = "music" | "weather" | "water" | "clipboard" | "todo" | "shelf" | "settings";

const PANELS: { id: PanelId; title: string }[] = [
  { id: "music", title: "Music" },
  { id: "weather", title: "Weather" },
  { id: "water", title: "Water Reminder" },
  { id: "clipboard", title: "Clipboard" },
  { id: "todo", title: "To-do List" },
  { id: "shelf", title: "Shelf" },
  { id: "settings", title: "Settings" },
];

// Fixed horizontal width so OS window X position NEVER shifts or jitters
const FIXED_WIN_W = 720;
const WIN_COLLAPSED_H = 50; // 32px notch + 18px smooth shadow diffusion buffer
const WIN_WATER_REMINDER_H = 78; // 32px notch + 24px 3D overflowing puddle + 22px caustic shadow buffer
const WIN_EXPANDED_NORMAL_H = 204; // 172px notch + 32px shadow diffusion buffer
const WIN_EXPANDED_LYRICS_H = 214; // 182px notch + 32px shadow diffusion buffer

let currentWindowH = WIN_COLLAPSED_H;

async function updateWindowHeight(height: number) {
  if (currentWindowH === height) return;
  currentWindowH = height;
  try {
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(FIXED_WIN_W, height));
  } catch (err) {
    console.error("Failed to update window height:", err);
  }
}

export default function App() {
  const media = useMedia();
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [panelIndex, setPanelIndex] = useState(0);
  const [lyricsOpen, setLyricsOpen] = useState(() => {
    const saved = localStorage.getItem("drotch_lyrics_open") ?? localStorage.getItem("notch_lyrics_open");
    return saved !== null ? saved === "true" : true;
  });
  const [dateTimeStr, setDateTimeStr] = useState("");
  const [hasAudioFeed, setHasAudioFeed] = useState(false);
  const [typingState, setTypingState] = useState<{ is_typing: boolean; speed: number; total: number }>({
    is_typing: false,
    speed: 0,
    total: 0,
  });
  const [isWaterReminder, setIsWaterReminder] = useState(false);
  const isWaterReminderRef = useRef(false);
  const expandedRef = useRef(expanded);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    isWaterReminderRef.current = isWaterReminder;
  }, [isWaterReminder]);

  useEffect(() => {
    localStorage.setItem("drotch_lyrics_open", String(lyricsOpen));
  }, [lyricsOpen]);

  // Global typing activity listener (privacy-safe, zero keylogging)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ is_typing: boolean; speed: number; total: number }>("typing-activity", (event) => {
      if (event.payload) {
        setTypingState(event.payload);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.error("Failed to listen to typing-activity:", err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const lastToggleTimeRef = useRef<number>(0);

  const toggleIsland = async () => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 250) return;
    lastToggleTimeRef.current = now;

    if (expandedRef.current) {
      setPinned(false);
      setExpanded(false);
      setPanelIndex(0);
      try {
        window.blur();
      } catch {
        /* ignore */
      }
    } else {
      setPanelIndex(0);
      setExpanded(true);
      setPinned(true);
      try {
        const win = getCurrentWindow();
        await win.show();
        await win.setFocus();
      } catch {
        /* ignore */
      }
      window.focus();
    }
  };

  // Global Shortcut Listener (Ctrl+Shift+Space to toggle Drotch via OS hook)
  useEffect(() => {
    let unlistenToggle: (() => void) | null = null;

    listen<boolean>("toggle-drotch", (event) => {
      const willExpand =
        typeof event.payload === "boolean" ? event.payload : !expandedRef.current;
      if (willExpand) {
        setPanelIndex(0);
        setExpanded(true);
        setPinned(true);
        window.focus();
      } else {
        setPinned(false);
        setExpanded(false);
        setPanelIndex(0);
        try {
          window.blur();
        } catch {
          /* ignore */
        }
      }
    }).then((fn) => {
      unlistenToggle = fn;
    });

    return () => {
      if (unlistenToggle) unlistenToggle();
    };
  }, []);

  const visualizerBarsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const audioFeedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shrinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time WASAPI live audio frequency listener
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<number[]>("visualizer-bars", (event) => {
      const bands = event.payload;
      if (!bands) return;

      setHasAudioFeed(true);
      if (audioFeedTimeoutRef.current) clearTimeout(audioFeedTimeoutRef.current);
      audioFeedTimeoutRef.current = setTimeout(() => setHasAudioFeed(false), 600);

      for (let i = 0; i < 16; i++) {
        const bar = visualizerBarsRef.current[i];
        if (bar) {
          const val = Math.max(0, Math.min(1, bands[i] || 0));
          const h = 2 + val * 5.2;
          bar.style.height = `${h.toFixed(1)}px`;
        }
      }
    }).then((fn) => {
      unlisten = fn;
    }).catch((err) => {
      console.error("Failed to listen to visualizer-bars:", err);
    });

    return () => {
      if (unlisten) unlisten();
      if (audioFeedTimeoutRef.current) clearTimeout(audioFeedTimeoutRef.current);
    };
  }, []);

  // Initial Window Centering: Runs ONCE at startup, position NEVER changes on hover
  useEffect(() => {
    (async () => {
      try {
        const win = getCurrentWindow();
        const monitor = await primaryMonitor();
        if (!monitor) return;
        const factor = await win.scaleFactor();
        const logicalMonitorW = monitor.size.width / factor;
        const x = Math.round((logicalMonitorW - FIXED_WIN_W) / 2);

        await win.setSize(new LogicalSize(FIXED_WIN_W, WIN_COLLAPSED_H));
        await win.setPosition(new LogicalPosition(x, 0));
      } catch (err) {
        console.error("Window initial centering failed:", err);
      }
    })();
  }, []);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const day = days[now.getDay()];
      const date = now.getDate();
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const mins = String(now.getMinutes()).padStart(2, "0");
      setDateTimeStr(`${day} ${date} ${month} ${year} ${hours}:${mins}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const isCurrentLyricsSplit = panelIndex === 0 && lyricsOpen;
  const isIslandActive = expanded || pinned;

  // Synchronize expansion state with Rust OS hook so focus is properly restored
  useEffect(() => {
    invoke("set_island_expanded", { expanded: isIslandActive }).catch(() => {});
  }, [isIslandActive]);

  const targetWinH = isIslandActive
    ? isCurrentLyricsSplit
      ? WIN_EXPANDED_LYRICS_H
      : WIN_EXPANDED_NORMAL_H
    : isWaterReminder
      ? WIN_WATER_REMINDER_H
      : WIN_COLLAPSED_H;

  // Fluid height coordination: zero horizontal repositioning
  useEffect(() => {
    if (isIslandActive) {
      if (shrinkTimerRef.current) {
        clearTimeout(shrinkTimerRef.current);
        shrinkTimerRef.current = null;
      }
      updateWindowHeight(targetWinH);
    } else if (isWaterReminder) {
      if (shrinkTimerRef.current) {
        clearTimeout(shrinkTimerRef.current);
        shrinkTimerRef.current = null;
      }
      updateWindowHeight(WIN_WATER_REMINDER_H);
    } else {
      shrinkTimerRef.current = setTimeout(() => {
        updateWindowHeight(WIN_COLLAPSED_H);
      }, 350);
    }

    return () => {
      if (shrinkTimerRef.current) clearTimeout(shrinkTimerRef.current);
    };
  }, [isIslandActive, isWaterReminder, targetWinH]);

  const handleMouseEnter = () => {
    // When water reminder droplet is active in idle mode, do not auto-expand so user can view & click the droplet!
    if (isWaterReminder || isWaterReminderRef.current) return;

    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    if (pinned) return;
    leaveTimerRef.current = setTimeout(() => {
      setExpanded(false);
    }, 180);
  };

  const [swipeOffset, setSwipeOffset] = useState(0);
  const isDraggingPanel = useRef(false);
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const pointerStartTime = useRef(0);
  const lastWheelTimeRef = useRef(0);

  const prevPanel = () => {
    setPanelIndex((prev) => (prev === 0 ? PANELS.length - 1 : prev - 1));
  };

  const nextPanel = () => {
    setPanelIndex((prev) => (prev === PANELS.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation for Carousel panels (A for Left, D for Right, Arrows, and Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing inside text inputs / textareas / contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      // Escape key closes Drotch
      if (e.key === "Escape") {
        if (isIslandActive) {
          e.preventDefault();
          setPinned(false);
          setExpanded(false);
          setPanelIndex(0);
          try {
            window.blur();
          } catch {}
        }
        return;
      }

      // Don't intercept if modifier keys like Ctrl, Alt, or Meta are held down
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // Only handle panel navigation when island is active (expanded or pinned)
      if (!isIslandActive) return;

      const key = e.key.toLowerCase();
      if (key === "a" || e.key === "ArrowLeft") {
        e.preventDefault();
        prevPanel();
      } else if (key === "d" || e.key === "ArrowRight") {
        e.preventDefault();
        nextPanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isIslandActive]);

  const handleSwipePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        "button, input, textarea, .seekbar-track, .lyrics-split-separator, .water-btn, .water-toggle-switch, .lyrics-lines-box, .todo-item-row, .shelf-action-btn, .clipboard-item-row, .clip-pill, .clipboard-clear-btn"
      )
    ) {
      return;
    }
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
    pointerStartTime.current = Date.now();
    isDraggingPanel.current = true;
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleSwipePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPanel.current) return;
    const deltaX = e.clientX - pointerStartX.current;
    const deltaY = e.clientY - pointerStartY.current;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 6) {
      setSwipeOffset(deltaX * 0.4);
    }
  };

  const handleSwipePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingPanel.current) return;
    isDraggingPanel.current = false;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    const deltaX = e.clientX - pointerStartX.current;
    const elapsed = Date.now() - pointerStartTime.current;
    setSwipeOffset(0);

    if (deltaX < -35 || (deltaX < -15 && elapsed < 260)) {
      nextPanel();
    } else if (deltaX > 35 || (deltaX > 15 && elapsed < 260)) {
      prevPanel();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        ".lyrics-lines-box, .todo-items-list, .shelf-items-list, .clipboard-items-scroll"
      )
    ) {
      return;
    }
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 320) return;

    const horizontalDelta =
      e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
    if (Math.abs(horizontalDelta) > 25) {
      lastWheelTimeRef.current = now;
      if (horizontalDelta > 0) {
        nextPanel();
      } else {
        prevPanel();
      }
    }
  };

  const currentPanel = PANELS[panelIndex];

  return (
    <div className="notch-root-stage">
      <div
        className={`notch-island-wrapper ${isIslandActive ? "is-expanded" : ""} ${
          isCurrentLyricsSplit ? "is-lyrics-open" : ""
        } ${isWaterReminder && !isIslandActive ? "is-water-reminder" : ""}`}
      >
        {/* Seamless 12px Top Screen Bezel Invert Fillets (Ears) on Wrapper */}
        <div className="notch-ear ear-left" />
        <div className="notch-ear ear-right" />

        {/* Ambient Bottom Neon Rim Glow / Subtle Visualizer (Collapsed) */}
        <div
          className={`notch-ambient-bloom ${
            media?.playing ? "is-playing" : ""
          } ${hasAudioFeed ? "has-audio-feed" : ""} ${
            typingState.is_typing ? "is-typing" : ""
          } ${isWaterReminder && !isIslandActive ? "is-water-reminder" : ""}`}
        >
          {!isWaterReminder && (
            <div className="bloom-visualizer-track">
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  ref={(el) => {
                    visualizerBarsRef.current[i] = el;
                  }}
                  className={`bv-bar b${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className={`notch-island ${isIslandActive ? "is-expanded" : ""} ${
            isCurrentLyricsSplit ? "is-lyrics-open" : ""
          } ${typingState.is_typing ? "is-typing" : ""} ${
            isWaterReminder && !isIslandActive ? "is-water-reminder" : ""
          }`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={() => {
            window.focus();
          }}
        >
          {/* Top Center Camera Lens Dot */}
          <div className="notch-camera-dot" />

          {/* Main Content Area */}
          <div className="notch-content-container">
          {/* Layer 1: Collapsed State (Interactive Eyes & Idle Hydration Reminder) */}
          <div className="notch-collapsed-layer">
            <NotchEyes
              isPlaying={Boolean(media?.playing)}
              isTyping={typingState.is_typing}
              typingSpeed={typingState.speed}
              isExpanded={isIslandActive}
              onExpand={() => setExpanded(true)}
              onOpenWater={() => {
                const waterIdx = PANELS.findIndex((p) => p.id === "water");
                setPanelIndex(waterIdx !== -1 ? waterIdx : 2);
                setExpanded(true);
              }}
              onWaterReminderChange={(active) => {
                setIsWaterReminder(active);
                isWaterReminderRef.current = active;
              }}
            />
          </div>

          {/* Layer 2: Expanded State (Rich Content) */}
          <div className="notch-expanded-layer">
            {/* Header Bar (Draggable to reposition notch) */}
            <div
              className="island-header-bar"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button, input, .hdr-pin-btn")) return;
                try {
                  getCurrentWindow().startDragging();
                } catch {
                  /* ignore */
                }
              }}
            >
              <div className="hdr-col-left">
                {panelIndex !== 0 && (
                  <span className="hdr-badge-title">{currentPanel.title}</span>
                )}
              </div>

              <div className="hdr-col-center">
                <span className="hdr-live-pulse" />
                <span className="hdr-clock-text">{dateTimeStr}</span>
              </div>

              <div className="hdr-col-right">
                <div className={`hdr-eq-bars ${media?.playing ? "is-active" : ""}`}>
                  <span className="eq-bar-stick s1" />
                  <span className="eq-bar-stick s2" />
                  <span className="eq-bar-stick s3" />
                  <span className="eq-bar-stick s4" />
                  <span className="eq-bar-stick s5" />
                </div>

                <button
                  className={`hdr-settings-btn ${currentPanel.id === "settings" ? "active" : ""}`}
                  onClick={() => {
                    const settingsIdx = PANELS.findIndex((p) => p.id === "settings");
                    setPanelIndex((prev) => (prev === settingsIdx ? 0 : settingsIdx));
                  }}
                  title={currentPanel.id === "settings" ? "Kembali ke Musik" : "Pengaturan Drotch"}
                >
                  <IconSettings size={12} color={currentPanel.id === "settings" ? "#38bdf8" : "currentColor"} />
                </button>

                <button
                  className={`hdr-pin-btn ${pinned ? "pinned" : ""}`}
                  onClick={() => setPinned(!pinned)}
                  title={pinned ? "Lepas pin drotch" : "Kunci drotch tetap terbuka"}
                >
                  <IconPin size={12} color={pinned ? "#38bdf8" : "currentColor"} />
                </button>
              </div>
            </div>

            {/* Viewport Body (Swipeable / Slidable between panels) */}
            <div
              className={`island-viewport-body ${isDraggingPanel.current ? "is-dragging" : ""}`}
              onPointerDown={handleSwipePointerDown}
              onPointerMove={handleSwipePointerMove}
              onPointerUp={handleSwipePointerUp}
              onPointerCancel={handleSwipePointerUp}
              onWheel={handleWheel}
              style={{
                transform: swipeOffset !== 0 ? `translateX(${swipeOffset.toFixed(1)}px)` : undefined,
                transition: isDraggingPanel.current ? "none" : "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {currentPanel.id === "music" && (
                <div className={`music-split-container ${lyricsOpen ? "show-lyrics" : ""}`}>
                  <div className="music-player-segment">
                    <MusicPanel
                      isLyricsOpen={lyricsOpen}
                      onToggleLyrics={() => setLyricsOpen(!lyricsOpen)}
                      onNextPanel={nextPanel}
                      onPrevPanel={prevPanel}
                    />
                  </div>
                  {lyricsOpen && (
                    <>
                      <div className="lyrics-split-separator" />
                      <div className="lyrics-display-segment">
                        <LyricsPanel />
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentPanel.id === "weather" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Sebelumnya (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <WeatherPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Berikutnya (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "water" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Sebelumnya (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <WaterWidget />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Berikutnya (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "clipboard" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Sebelumnya (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <ClipboardPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Berikutnya (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "todo" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Sebelumnya (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <TodoPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Berikutnya (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "shelf" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Sebelumnya (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <ShelfPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Berikutnya (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "settings" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Sebelumnya (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <SettingsPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Berikutnya (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Pagination Dots */}
            <div className="island-pagination-track">
              {PANELS.map((p, idx) => (
                <button
                  key={p.id}
                  className={`island-dot ${panelIndex === idx ? "active" : ""}`}
                  onClick={() => {
                    setPanelIndex(idx);
                  }}
                  title={p.title}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}
