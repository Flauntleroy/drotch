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
import { PomodoroPanel, usePomodoro } from "./panels/pomodoro";
import { TelemetryPanel } from "./panels/telemetry";
import { CalcPanel } from "./panels/calc";
import { NotchEyes } from "./components/NotchEyes";
import { PomodoroAlarmActor } from "./components/PomodoroAlarmActor";
import {
  IconPin,
  IconChevronLeft,
  IconChevronRight,
  IconSettings,
  IconClipboardCheck,
  IconBolt,
  IconBattery,
  IconCheck,
  IconTimer,
  IconCpu,
  IconRam,
  IconTarget,
  IconCoffee,
} from "./components/Icons";
import "./styles.css";

interface LiveActivity {
  id: string;
  type: "clipboard" | "power" | "pomodoro";
  title: string;
  subtitle?: string;
  iconType: "clipboard" | "battery" | "bolt" | "timer";
  color?: string;
  percent?: number;
  snippet?: string;
}

type PanelId =
  | "music"
  | "weather"
  | "water"
  | "clipboard"
  | "pomodoro"
  | "telemetry"
  | "calc"
  | "todo"
  | "shelf"
  | "settings";

const PANELS: { id: PanelId; title: string }[] = [
  { id: "music", title: "Music" },
  { id: "weather", title: "Weather" },
  { id: "water", title: "Water Reminder" },
  { id: "clipboard", title: "Clipboard" },
  { id: "pomodoro", title: "Focus Timer" },
  { id: "telemetry", title: "System Monitor" },
  { id: "calc", title: "Mini Calculator" },
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
  const isIslandActive = expanded || pinned;
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
  const pomodoro = usePomodoro();
  const [pomodoroAlarm, setPomodoroAlarm] = useState<{
    mode: string;
    message: string;
  } | null>(null);
  const pomodoroAlarmRef = useRef<{ mode: string; message: string } | null>(null);

  const [telemetryGlance, setTelemetryGlance] = useState<{
    cpu_percent: number;
    ram_percent: number;
  } | null>(null);
  const latestTelemetryRef = useRef<{
    cpu_percent: number;
    ram_percent: number;
  } | null>(null);
  const liveActivityRef = useRef<LiveActivity | null>(null);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

  useEffect(() => {
    isWaterReminderRef.current = isWaterReminder;
  }, [isWaterReminder]);

  useEffect(() => {
    pomodoroAlarmRef.current = pomodoroAlarm;
  }, [pomodoroAlarm]);

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

  // System telemetry event listener for real-time idle peek
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ cpu_percent: number; ram_percent: number }>("system-telemetry", (event) => {
      if (event.payload) {
        latestTelemetryRef.current = event.payload;
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((err) => {
        console.error("Failed to listen to system-telemetry:", err);
      });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Periodic Resource Monitor Glance in Idle (shows for 5s every ~22s if idle)
  useEffect(() => {
    const glanceInterval = setInterval(() => {
      if (
        !expandedRef.current &&
        !pomodoro.isRunning &&
        !isWaterReminderRef.current &&
        !liveActivityRef.current &&
        latestTelemetryRef.current
      ) {
        setTelemetryGlance(latestTelemetryRef.current);
        setTimeout(() => {
          setTelemetryGlance(null);
        }, 5000);
      }
    }, 22000);

    return () => clearInterval(glanceInterval);
  }, [pomodoro.isRunning]);

  const [liveActivity, setLiveActivity] = useState<LiveActivity | null>(null);
  const liveActivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevClipboardIdRef = useRef<string | null>(null);

  useEffect(() => {
    liveActivityRef.current = liveActivity;
  }, [liveActivity]);

  const handlePomodoroIdleClick = () => {
    const pomoIdx = PANELS.findIndex((p) => p.id === "pomodoro");
    setPanelIndex(pomoIdx !== -1 ? pomoIdx : 4);
    setExpanded(true);
  };

  const handleTelemetryGlanceClick = () => {
    setTelemetryGlance(null);
    const telemIdx = PANELS.findIndex((p) => p.id === "telemetry");
    setPanelIndex(telemIdx !== -1 ? telemIdx : 5);
    setExpanded(true);
  };

  const triggerLiveActivity = (activity: LiveActivity, durationMs: number = 2400) => {
    if (liveActivityTimerRef.current) {
      clearTimeout(liveActivityTimerRef.current);
    }
    setLiveActivity(activity);
    liveActivityTimerRef.current = setTimeout(() => {
      setLiveActivity(null);
      liveActivityTimerRef.current = null;
    }, durationMs);
  };

  const handleLiveActivityClick = () => {
    if (!liveActivity) return;
    const act = liveActivity;
    setLiveActivity(null);
    if (liveActivityTimerRef.current) {
      clearTimeout(liveActivityTimerRef.current);
    }
    if (act.type === "clipboard") {
      const clipIdx = PANELS.findIndex((p) => p.id === "clipboard");
      setPanelIndex(clipIdx !== -1 ? clipIdx : 0);
      setExpanded(true);
    } else if (act.type === "pomodoro") {
      const pomoIdx = PANELS.findIndex((p) => p.id === "pomodoro");
      setPanelIndex(pomoIdx !== -1 ? pomoIdx : 0);
      setExpanded(true);
    } else {
      setExpanded(true);
    }
  };

  // Live Activity: Clipboard Copied Toast
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<Array<{ id: string; preview: string; content: string }>>("clipboard-updated", (event) => {
      const items = event.payload;
      if (!items || items.length === 0) return;
      const latest = items[0];

      if (prevClipboardIdRef.current && prevClipboardIdRef.current !== latest.id) {
        if (!expandedRef.current) {
          triggerLiveActivity(
            {
              id: latest.id,
              type: "clipboard",
              title: "Copied to Clipboard",
              snippet: latest.preview.replace(/\s+/g, " ").slice(0, 24),
              iconType: "clipboard",
              color: "#38bdf8",
            },
            2400
          );
        }
      }
      prevClipboardIdRef.current = latest.id;
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Live Activity: Power / Charging Status
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<{ is_plugged: boolean; percent: number; has_battery: boolean }>(
      "power-status-changed",
      (event) => {
        const info = event.payload;
        if (!info || !info.has_battery) return;

        if (!expandedRef.current) {
          triggerLiveActivity(
            {
              id: String(Date.now()),
              type: "power",
              title: info.is_plugged ? "Charging" : "On Battery",
              subtitle: `${info.percent}%`,
              iconType: info.is_plugged ? "bolt" : "battery",
              color: info.is_plugged ? "#22c55e" : "#eab308",
              percent: info.percent,
            },
            2800
          );
        }
      }
    ).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Pomodoro Finished: Trigger persistent ringing alarm clock mascot actor in center of collapsed notch
  useEffect(() => {
    const handlePomoFinished = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: string; message: string }>).detail;
      if (!detail) return;
      setPomodoroAlarm({
        mode: detail.mode,
        message: detail.message,
      });
      // Automatically collapse Drotch so user immediately sees the shaking alarm mascot actor in the center!
      setPinned(false);
      setExpanded(false);
    };
    window.addEventListener("drotch-pomodoro-finished", handlePomoFinished);
    return () => window.removeEventListener("drotch-pomodoro-finished", handlePomoFinished);
  }, []);

  // Listen for explicit dismissal
  useEffect(() => {
    const handleDismiss = () => {
      setPomodoroAlarm(null);
      pomodoroAlarmRef.current = null;
    };
    window.addEventListener("drotch-pomodoro-dismiss", handleDismiss);
    return () => window.removeEventListener("drotch-pomodoro-dismiss", handleDismiss);
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

  // Synchronize expansion state with Rust OS hook so focus is properly restored
  useEffect(() => {
    invoke("set_island_expanded", { expanded: isIslandActive }).catch(() => {});
  }, [isIslandActive]);

  const targetWinH = isIslandActive
    ? isCurrentLyricsSplit
      ? WIN_EXPANDED_LYRICS_H
      : WIN_EXPANDED_NORMAL_H
    : isWaterReminder || pomodoroAlarm
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
    } else if (isWaterReminder || pomodoroAlarm) {
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
  }, [isIslandActive, isWaterReminder, pomodoroAlarm, targetWinH]);

  const handleMouseEnter = () => {
    // When water reminder or pomodoro alarm actor is active in idle mode, do not auto-expand so user can view & click the actor!
    if (
      isWaterReminder ||
      isWaterReminderRef.current ||
      pomodoroAlarm ||
      pomodoroAlarmRef.current
    ) {
      return;
    }

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
        "button, input, textarea, .seekbar-track, .lyrics-split-separator, .water-btn, .water-toggle-switch, .lyrics-lines-box, .todo-item-row, .shelf-action-btn, .clipboard-item-row, .clip-pill, .clipboard-clear-btn, .pomo-pill, .pomodoro-main-btn, .pomodoro-reset-btn, .pomodoro-bump-btn, .calc-text-input, .calc-preset-pill, .calc-copy-btn, .calc-clear-btn"
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
  const isPomoIdle = pomodoro.isRunning && !isIslandActive && !liveActivity;
  const isTelemGlance =
    Boolean(telemetryGlance) &&
    !isIslandActive &&
    !isPomoIdle &&
    !liveActivity &&
    !isWaterReminder;

  return (
    <div className="notch-root-stage">
      <div
        className={`notch-island-wrapper ${isIslandActive ? "is-expanded" : ""} ${
          isCurrentLyricsSplit ? "is-lyrics-open" : ""
        } ${isWaterReminder && !isIslandActive ? "is-water-reminder" : ""} ${
          pomodoroAlarm && !isIslandActive ? "is-alarm-active" : ""
        } ${
          liveActivity && !isIslandActive ? "is-live-activity" : ""
        } ${isPomoIdle ? "is-pomodoro-running" : ""} ${
          isTelemGlance ? "is-telemetry-glance" : ""
        }`}
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
          } ${isWaterReminder && !isIslandActive ? "is-water-reminder" : ""} ${
            pomodoroAlarm && !isIslandActive ? "is-alarm-active" : ""
          }`}
        >
          {!isWaterReminder && !pomodoroAlarm && (
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
          } ${pomodoroAlarm && !isIslandActive ? "is-alarm-active" : ""}`}
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
          {/* Layer 1: Collapsed State (Interactive Eyes & Idle Hydration Reminder & Pomodoro Alarm & Live Activities) */}
          <div className="notch-collapsed-layer">
            {pomodoroAlarm && !isIslandActive ? (
              <PomodoroAlarmActor
                mode={(pomodoroAlarm.mode as any) || "focus"}
                onDismiss={() => {
                  setPomodoroAlarm(null);
                  pomodoroAlarmRef.current = null;
                  const pomoIdx = PANELS.findIndex((p) => p.id === "pomodoro");
                  setPanelIndex(pomoIdx !== -1 ? pomoIdx : 4);
                  setExpanded(true);
                  setPinned(true);
                }}
              />
            ) : (
              <>
            <div
              className={`live-activity-container ${liveActivity ? "is-active" : ""}`}
              onClick={handleLiveActivityClick}
            >
              {liveActivity && (
                <div className="live-activity-chip">
                  <div className="live-chip-left">
                    <span className={`live-chip-icon-glow ${liveActivity.type}`}>
                      {liveActivity.iconType === "clipboard" && (
                        <IconClipboardCheck size={14} color="#38bdf8" />
                      )}
                      {liveActivity.iconType === "bolt" && (
                        <IconBolt size={14} color="#22c55e" />
                      )}
                      {liveActivity.iconType === "battery" && (
                        <IconBattery size={14} color="#eab308" percent={liveActivity.percent} />
                      )}
                      {liveActivity.iconType === "timer" && (
                        <IconTimer size={14} color={liveActivity.color || "#38bdf8"} />
                      )}
                    </span>
                  </div>

                  <div className="live-chip-center">
                    <span className="live-chip-title">{liveActivity.title}</span>
                    {liveActivity.snippet && (
                      <span className="live-chip-snippet">{liveActivity.snippet}</span>
                    )}
                  </div>

                  <div className="live-chip-right">
                    {liveActivity.type === "clipboard" && (
                      <span className="live-chip-badge cyan">
                        <IconCheck size={9} color="#38bdf8" />
                        <span>Copied</span>
                      </span>
                    )}
                    {liveActivity.type === "pomodoro" && (
                      <span className={`live-chip-badge ${liveActivity.color === "#22c55e" ? "green" : "cyan"}`}>
                        <IconCheck size={9} color={liveActivity.color || "#38bdf8"} />
                        <span>Done</span>
                      </span>
                    )}
                    {liveActivity.type === "power" && (
                      <span className={`live-chip-badge ${liveActivity.iconType === "bolt" ? "green" : "yellow"}`}>
                        {liveActivity.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pomodoro Running Active Live Widget */}
            {isPomoIdle && (
              <div
                className="pomodoro-idle-container is-active"
                onClick={handlePomodoroIdleClick}
                title="Pomodoro session running. Click to open panel."
              >
                <div className="pomodoro-idle-chip">
                  <div className="pomo-idle-left">
                    <span
                      className={`pomo-idle-icon-ring ${
                        pomodoro.mode === "focus" ? "focus" : "break"
                      }`}
                    >
                      <svg
                        className="pomo-idle-ring-svg"
                        width="22"
                        height="22"
                        viewBox="0 0 22 22"
                      >
                        <circle
                          className="pomo-ring-bg"
                          cx="11"
                          cy="11"
                          r="9"
                          strokeWidth="2"
                        />
                        <circle
                          className="pomo-ring-progress"
                          cx="11"
                          cy="11"
                          r="9"
                          strokeWidth="2"
                          strokeDasharray={2 * Math.PI * 9}
                          strokeDashoffset={
                            2 * Math.PI * 9 * (1 - pomodoro.progressRatio)
                          }
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="pomo-idle-center-icon">
                        {pomodoro.mode === "shortBreak" || pomodoro.mode === "longBreak" ? (
                          <IconCoffee size={11} color="#22c55e" />
                        ) : pomodoro.mode === "custom" ? (
                          <IconTimer size={11} color="#f59e0b" />
                        ) : (
                          <IconTarget size={11} color="#38bdf8" />
                        )}
                      </span>
                    </span>
                  </div>

                  <div className="pomo-idle-center">
                    <span className="pomo-idle-timer">
                      {pomodoro.formatTime(pomodoro.timeLeft)}
                    </span>
                    <span
                      className={`pomo-idle-mode-tag ${
                        pomodoro.mode === "shortBreak" || pomodoro.mode === "longBreak"
                          ? "break"
                          : pomodoro.mode === "custom"
                          ? "focus custom"
                          : "focus"
                      }`}
                    >
                      {pomodoro.mode === "custom"
                        ? "CUSTOM"
                        : pomodoro.mode === "shortBreak" || pomodoro.mode === "longBreak"
                        ? "BREAK"
                        : "FOCUS"}
                    </span>
                  </div>

                  <div className="pomo-idle-right">
                    <span
                      className={`pomo-idle-wave-bars ${
                        pomodoro.mode === "focus" ? "focus" : "break"
                      }`}
                    >
                      <span className="pbar p1" />
                      <span className="pbar p2" />
                      <span className="pbar p3" />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Occasional System Telemetry Glance */}
            {isTelemGlance && telemetryGlance && (
              <div
                className="telemetry-idle-container is-active"
                onClick={handleTelemetryGlanceClick}
                title="System Telemetry. Click to open monitor panel."
              >
                <div className="telemetry-idle-chip">
                  <div className="telem-idle-item cpu">
                    <IconCpu size={11} color="#38bdf8" />
                    <span className="telem-idle-label">CPU</span>
                    <span className="telem-idle-digits">
                      {Math.round(telemetryGlance.cpu_percent)}%
                    </span>
                    <div className="telem-idle-mini-track">
                      <div
                        className="telem-idle-mini-fill cpu"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(4, telemetryGlance.cpu_percent)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <span className="telem-idle-sep" />

                  <div className="telem-idle-item ram">
                    <IconRam size={11} color="#c084fc" />
                    <span className="telem-idle-label">RAM</span>
                    <span className="telem-idle-digits">
                      {telemetryGlance.ram_percent}%
                    </span>
                    <div className="telem-idle-mini-track">
                      <div
                        className="telem-idle-mini-fill ram"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(4, telemetryGlance.ram_percent)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`collapsed-eyes-container ${
                liveActivity || isPomoIdle || isTelemGlance ? "is-hidden" : ""
              }`}
            >
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
              </>
            )}
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
                  title={currentPanel.id === "settings" ? "Back to Music" : "Drotch Settings"}
                >
                  <IconSettings size={12} color={currentPanel.id === "settings" ? "#38bdf8" : "currentColor"} />
                </button>

                <button
                  className={`hdr-pin-btn ${pinned ? "pinned" : ""}`}
                  onClick={() => setPinned(!pinned)}
                  title={pinned ? "Unpin Drotch" : "Pin Drotch open"}
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
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <WeatherPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "water" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <WaterWidget />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "clipboard" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <ClipboardPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "pomodoro" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <PomodoroPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "telemetry" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <TelemetryPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "calc" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <CalcPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "todo" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <TodoPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "shelf" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <ShelfPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
                    <IconChevronRight size={13} />
                  </button>
                </div>
              )}

              {currentPanel.id === "settings" && (
                <div className="carousel-panel-wrapper">
                  <button className="carousel-nav-btn prev" onClick={prevPanel} title="Previous (A / ←)">
                    <IconChevronLeft size={13} />
                  </button>
                  <div className="carousel-center-stage">
                    <SettingsPanel />
                  </div>
                  <button className="carousel-nav-btn next" onClick={nextPanel} title="Next (D / →)">
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
