import { useEffect, useState } from "react";
import {
  IconPlay,
  IconPause,
  IconRefresh,
  IconTarget,
  IconCoffee,
  IconCheck,
  IconTimer,
} from "../components/Icons";

export type PomodoroMode = "focus" | "shortBreak" | "longBreak" | "custom";

const savedCustomMins = Number(localStorage.getItem("drotch_pomodoro_custom_mins") || 45);

export const MODE_DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  custom: (savedCustomMins > 0 ? savedCustomMins : 45) * 60,
};

function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.16); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.85);
  } catch {
    /* ignore */
  }
}

// ---------------- Global Pomodoro Singleton Store ----------------
interface PomodoroStoreState {
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  customDuration: number;
}

const storeState: PomodoroStoreState = {
  mode: "focus",
  timeLeft: MODE_DURATIONS.focus,
  isRunning: false,
  sessionsCompleted: Number(localStorage.getItem("drotch_pomodoro_completed") || 0),
  customDuration: (savedCustomMins > 0 ? savedCustomMins : 45) * 60,
};

const listeners = new Set<() => void>();
let intervalTimer: ReturnType<typeof setInterval> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function startInterval() {
  if (intervalTimer) return;
  intervalTimer = setInterval(() => {
    if (!storeState.isRunning) {
      if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
      }
      return;
    }

    if (storeState.timeLeft <= 1) {
      playChime();
      const finishedMode = storeState.mode;

      if (finishedMode === "focus" || finishedMode === "custom") {
        storeState.sessionsCompleted += 1;
        localStorage.setItem("drotch_pomodoro_completed", String(storeState.sessionsCompleted));
      }

      const nextMode: PomodoroMode =
        finishedMode === "focus" || finishedMode === "custom" ? "shortBreak" : "focus";
      storeState.mode = nextMode;
      storeState.timeLeft = MODE_DURATIONS[nextMode];
      storeState.isRunning = false;

      if (intervalTimer) {
        clearInterval(intervalTimer);
        intervalTimer = null;
      }

      notify();

      window.dispatchEvent(
        new CustomEvent("drotch-pomodoro-finished", {
          detail: {
            mode: finishedMode,
            message:
              finishedMode === "focus" || finishedMode === "custom"
                ? "Focus session complete! Time for a short break."
                : "Break finished! Ready to focus again?",
          },
        })
      );
      return;
    }

    storeState.timeLeft -= 1;
    notify();
  }, 1000);
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function usePomodoro() {
  const [state, setState] = useState<PomodoroStoreState>({ ...storeState });

  useEffect(() => {
    const handleUpdate = () => {
      setState({ ...storeState });
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const switchMode = (newMode: PomodoroMode) => {
    storeState.mode = newMode;
    storeState.timeLeft =
      newMode === "custom" ? storeState.customDuration : MODE_DURATIONS[newMode];
    storeState.isRunning = false;
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    notify();
  };

  const setCustomDuration = (val: number, isSeconds: boolean = false) => {
    const totalSec = isSeconds ? val : Math.max(1, Math.round(val * 60));
    storeState.customDuration = totalSec;
    MODE_DURATIONS.custom = totalSec;
    if (!isSeconds) {
      localStorage.setItem("drotch_pomodoro_custom_mins", String(Math.round(totalSec / 60)));
    }
    storeState.mode = "custom";
    storeState.timeLeft = totalSec;
    storeState.isRunning = false;
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    notify();
  };

  const toggleTimer = () => {
    storeState.isRunning = !storeState.isRunning;
    if (storeState.isRunning) {
      // Clear any pending alarm
      window.dispatchEvent(new CustomEvent("drotch-pomodoro-dismiss"));
      startInterval();
    } else if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    notify();
  };

  const resetTimer = () => {
    storeState.isRunning = false;
    storeState.timeLeft =
      storeState.mode === "custom"
        ? storeState.customDuration
        : MODE_DURATIONS[storeState.mode];
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    window.dispatchEvent(new CustomEvent("drotch-pomodoro-dismiss"));
    notify();
  };

  const addMinutes = (mins: number) => {
    storeState.timeLeft = Math.max(10, storeState.timeLeft + mins * 60);
    if (storeState.mode === "custom") {
      storeState.customDuration = storeState.timeLeft;
      MODE_DURATIONS.custom = storeState.timeLeft;
      localStorage.setItem(
        "drotch_pomodoro_custom_mins",
        String(Math.round(storeState.timeLeft / 60))
      );
    }
    notify();
  };

  const totalDuration =
    state.mode === "custom" ? state.customDuration : MODE_DURATIONS[state.mode];
  const progressRatio = Math.max(
    0,
    Math.min(1, (totalDuration - state.timeLeft) / (totalDuration || 1))
  );

  return {
    ...state,
    totalDuration,
    progressRatio,
    switchMode,
    setCustomDuration,
    toggleTimer,
    resetTimer,
    addMinutes,
    formatTime,
  };
}

export function PomodoroMini() {
  return (
    <div className="mini-music-row">
      <span className="mini-icon">
        <IconTimer size={13} color="#38bdf8" />
      </span>
      <span className="mini-track-text">Focus & Pomodoro Timer</span>
    </div>
  );
}

export function PomodoroPanel() {
  const {
    mode,
    timeLeft,
    isRunning,
    sessionsCompleted,
    customDuration,
    totalDuration,
    switchMode,
    setCustomDuration,
    toggleTimer,
    resetTimer,
    addMinutes,
    formatTime: fmtTime,
  } = usePomodoro();

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [inputMins, setInputMins] = useState(() => Math.max(1, Math.round(customDuration / 60)));

  // Synchronize inputMins whenever customDuration changes
  useEffect(() => {
    setInputMins(Math.max(1, Math.round(customDuration / 60)));
  }, [customDuration]);

  // Circular progress calculation
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(
    0,
    Math.min(1, (totalDuration - timeLeft) / (totalDuration || 1))
  );
  const strokeDashoffset = circumference * (1 - progressRatio);

  const isBreak = mode === "shortBreak" || mode === "longBreak";

  const triggerTestAlarm = () => {
    playChime();
    window.dispatchEvent(
      new CustomEvent("drotch-pomodoro-finished", {
        detail: {
          mode: mode,
          message:
            mode === "focus" || mode === "custom"
              ? "Focus session complete! Time for a short break."
              : "Break finished! Ready to focus again?",
        },
      })
    );
  };

  return (
    <div className="pomodoro-widget-card">
      {/* Left: Aesthetic Neon Circular Progress Ring */}
      <div
        className="pomodoro-ring-col"
        onClick={() => setShowCustomPicker((prev) => !prev)}
        title="Click to toggle custom duration picker"
        style={{ cursor: "pointer" }}
      >
        <div className="pomodoro-svg-wrap">
          <svg className="pomodoro-svg-meter" width="76" height="76" viewBox="0 0 76 76">
            <circle
              className="pomodoro-track-circle"
              cx="38"
              cy="38"
              r={radius}
              strokeWidth="4"
            />
            <circle
              className={`pomodoro-progress-circle ${isBreak ? "is-break" : "is-focus"}`}
              cx="38"
              cy="38"
              r={radius}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          <div className="pomodoro-timer-inner">
            <span className="pomodoro-digits-text">{fmtTime(timeLeft)}</span>
            <span
              className={`pomodoro-sub-mode ${
                isBreak ? "break" : mode === "custom" ? "custom" : "focus"
              }`}
            >
              {mode === "custom" ? "CUSTOM" : isBreak ? "BREAK" : "FOCUS"}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Controls & Presets / Custom Time Picker */}
      <div className="pomodoro-info-col">
        {showCustomPicker ? (
          /* Inline Custom Time Picker Drawer */
          <div className="pomodoro-custom-picker-box">
            <div className="pomo-custom-top-row">
              <span className="pomo-custom-title">Custom Duration</span>
              <button
                className="pomo-custom-close-btn"
                onClick={() => setShowCustomPicker(false)}
                title="Close picker"
              >
                &times;
              </button>
            </div>

            {/* Quick Presets */}
            <div className="pomo-custom-presets-row">
              <button
                className="pomo-custom-chip test"
                onClick={() => {
                  setCustomDuration(10, true);
                  setShowCustomPicker(false);
                }}
                title="Set 10-second timer to easily test countdown & ringing alarm"
              >
                10s Test
              </button>
              <button
                className="pomo-custom-chip"
                onClick={() => {
                  setCustomDuration(15);
                  setShowCustomPicker(false);
                }}
              >
                15m
              </button>
              <button
                className="pomo-custom-chip"
                onClick={() => {
                  setCustomDuration(30);
                  setShowCustomPicker(false);
                }}
              >
                30m
              </button>
              <button
                className="pomo-custom-chip"
                onClick={() => {
                  setCustomDuration(45);
                  setShowCustomPicker(false);
                }}
              >
                45m
              </button>
              <button
                className="pomo-custom-chip"
                onClick={() => {
                  setCustomDuration(60);
                  setShowCustomPicker(false);
                }}
              >
                60m
              </button>
              <button
                className="pomo-custom-chip"
                onClick={() => {
                  setCustomDuration(90);
                  setShowCustomPicker(false);
                }}
              >
                90m
              </button>
            </div>

            {/* Number Stepper & Input */}
            <div className="pomo-custom-input-row">
              <button
                className="pomo-custom-step-btn"
                onClick={() => setInputMins((m) => Math.max(1, m - 5))}
                title="-5 mins"
              >
                -5m
              </button>
              <button
                className="pomo-custom-step-btn"
                onClick={() => setInputMins((m) => Math.max(1, m - 1))}
                title="-1 min"
              >
                -1m
              </button>
              <input
                type="number"
                min="1"
                max="360"
                value={inputMins}
                onChange={(e) =>
                  setInputMins(Math.max(1, Math.min(360, Number(e.target.value) || 1)))
                }
                className="pomo-custom-number-input"
              />
              <span className="pomo-custom-unit">min</span>
              <button
                className="pomo-custom-step-btn"
                onClick={() => setInputMins((m) => Math.min(360, m + 1))}
                title="+1 min"
              >
                +1m
              </button>
              <button
                className="pomo-custom-step-btn"
                onClick={() => setInputMins((m) => Math.min(360, m + 5))}
                title="+5 mins"
              >
                +5m
              </button>

              <button
                className="pomo-custom-apply-btn"
                onClick={() => {
                  setCustomDuration(inputMins);
                  setShowCustomPicker(false);
                }}
              >
                Set
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode Selector Tabs */}
            <div className="pomodoro-mode-pills">
              <button
                className={`pomo-pill ${mode === "focus" ? "active" : ""}`}
                onClick={() => switchMode("focus")}
              >
                <IconTarget size={11} />
                <span>Focus 25m</span>
              </button>
              <button
                className={`pomo-pill ${mode === "shortBreak" ? "active" : ""}`}
                onClick={() => switchMode("shortBreak")}
              >
                <IconCoffee size={11} />
                <span>Break 5m</span>
              </button>
              <button
                className={`pomo-pill ${mode === "longBreak" ? "active" : ""}`}
                onClick={() => switchMode("longBreak")}
              >
                <IconCoffee size={11} />
                <span>Long 15m</span>
              </button>
              <button
                className={`pomo-pill ${mode === "custom" ? "active" : ""}`}
                onClick={() => {
                  if (mode !== "custom") {
                    switchMode("custom");
                  }
                  setShowCustomPicker(true);
                }}
                title="Custom Duration: Click to select custom minutes"
              >
                <IconTimer size={11} />
                <span>{Math.round(customDuration / 60)}m</span>
              </button>
            </div>

            {/* Sessions stats & Quick bump */}
            <div className="pomodoro-meta-row">
              <div className="pomodoro-completed-badge">
                <IconCheck size={11} color="#22c55e" />
                <span>{sessionsCompleted} completed</span>
              </div>

              <div className="pomodoro-bump-wrap">
                <button
                  className="pomodoro-bump-btn"
                  onClick={() => addMinutes(-5)}
                  title="Minus 5 mins"
                >
                  -5m
                </button>
                <button
                  className="pomodoro-bump-btn"
                  onClick={() => addMinutes(-1)}
                  title="Minus 1 min"
                >
                  -1m
                </button>
                <button
                  className="pomodoro-bump-btn"
                  onClick={() => addMinutes(1)}
                  title="Add 1 min"
                >
                  +1m
                </button>
                <button
                  className="pomodoro-bump-btn"
                  onClick={() => addMinutes(5)}
                  title="Add 5 mins"
                >
                  +5m
                </button>
                <button
                  className="pomodoro-bump-btn custom-toggle"
                  onClick={() => setShowCustomPicker(true)}
                  title="Set custom duration"
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pomodoro-action-row">
              <button
                className={`pomodoro-main-btn ${isRunning ? "running" : ""} ${
                  isBreak ? "break" : ""
                }`}
                onClick={toggleTimer}
                title={isRunning ? "Pause timer" : "Start timer"}
              >
                {isRunning ? (
                  <>
                    <IconPause size={12} color="#ffffff" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <IconPlay size={12} color="#ffffff" />
                    <span>Start</span>
                  </>
                )}
              </button>

              <button
                className="pomodoro-reset-btn"
                onClick={resetTimer}
                title="Reset timer to duration"
              >
                <IconRefresh size={12} color="#94a3b8" />
              </button>

              <button
                className="pomodoro-reset-btn test-btn"
                onClick={triggerTestAlarm}
                title="Test ringing alarm mascot actor (closes Drotch & starts ringing)"
              >
                <IconTimer size={12} color="#fbbf24" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
