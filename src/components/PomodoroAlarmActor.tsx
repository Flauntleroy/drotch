import { useEffect, useRef, useState } from "react";

interface PomodoroAlarmActorProps {
  mode?: "focus" | "shortBreak" | "longBreak" | "custom";
  onDismiss: () => void;
}

/**
 * Crystalline dual-tone harmonic chime (C6 -> G6)
 * Produces an authentic, high-end acoustic chime.
 */
function playElegantChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Primary crystal chime (C6: 1046.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1046.5, ctx.currentTime);
    gain1.gain.setValueAtTime(0.24, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.65);

    // Harmonic overtone (G6: 1567.98 Hz) entering at +0.08s
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1567.98, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.001, ctx.currentTime);
    gain2.gain.setValueAtTime(0.20, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.75);
  } catch {
    /* ignore */
  }
}

export function PomodoroAlarmActor({
  mode = "focus",
  onDismiss,
}: PomodoroAlarmActorProps) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [gazeOffset, setGazeOffset] = useState<number>(0);
  const [blinking, setBlinking] = useState(false);
  const dismissingRef = useRef(false);

  // Calm, intelligent micro-glances
  useEffect(() => {
    let step = 0;
    const interval = setInterval(() => {
      if (isDismissing || dismissingRef.current) return;
      step = (step + 1) % 6;
      if (step === 1) {
        setGazeOffset(-1.2); // Glance left
      } else if (step === 4) {
        setGazeOffset(1.2); // Glance right
      } else {
        setGazeOffset(0); // Center gaze
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [isDismissing]);

  // Periodic natural soft blink
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 140);
    }, 3200);
    return () => clearInterval(blinkInterval);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setIsDismissing(true);
    playElegantChime();

    setTimeout(() => {
      onDismiss();
    }, 450);
  };

  const isBreak = mode === "shortBreak" || mode === "longBreak";
  const isHappy = isHovered || isDismissing;

  // Modern Lucide / SF Symbols stroke gradients
  const strokeStart = isBreak ? "#10b981" : "#f59e0b";
  const strokeEnd = isBreak ? "#06b6d4" : "#f43f5e";
  const glowColor = isBreak ? "#10b981" : "#fbbf24";

  return (
    <div
      className={`lucide-alarm-live-stage ${isDismissing ? "is-dismissing" : ""} ${
        isHovered ? "is-hovered" : ""
      } ${isBreak ? "is-break" : "is-focus"}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Session finished! Click to review focus session."
    >
      {/* Concentric Soft Acoustic Wave Halos */}
      <div className="lucide-alarm-acoustic-halo h1" />
      <div className="lucide-alarm-acoustic-halo h2" />

      {/* Official Lucide Alarm Clock Vector + Drotch Eyes Container */}
      <div
        className={`lucide-alarm-actor-box ${
          isDismissing ? "is-dismissing" : ""
        }`}
      >
        {/* Official Lucide Alarm Clock Vector (24x24 geometry, crisp 1.8px stroke) */}
        <svg
          className="lucide-alarm-svg"
          viewBox="-2 -2 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Elegant Neon Stroke Linear Gradient */}
            <linearGradient
              id="lucideClockGrad"
              x1="2"
              y1="3"
              x2="22"
              y2="21"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={strokeStart} />
              <stop offset="100%" stopColor={strokeEnd} />
            </linearGradient>

            {/* Subtle Bloom Glow Filter */}
            <filter
              id="lucideClockBloom"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="2.2"
                floodColor={glowColor}
                floodOpacity="0.75"
              />
            </filter>
          </defs>

          {/* Lucide Ringing Sound Waves (Left & Right) */}
          <g className="lucide-ringing-waves" filter="url(#lucideClockBloom)">
            {/* Inner Left Wave */}
            <path
              d="M2.5 10.5a5 5 0 0 0 0 5"
              stroke="url(#lucideClockGrad)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Outer Left Wave */}
            <path
              d="M0.5 8.5a8 8 0 0 0 0 9"
              stroke="url(#lucideClockGrad)"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.6"
            />
            {/* Inner Right Wave */}
            <path
              d="M21.5 10.5a5 5 0 0 1 0 5"
              stroke="url(#lucideClockGrad)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Outer Right Wave */}
            <path
              d="M23.5 8.5a8 8 0 0 1 0 9"
              stroke="url(#lucideClockGrad)"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.6"
            />
          </g>

          {/* Lucide Alarm Clock Stand Legs */}
          <path
            d="M6.38 18.7 4 21"
            stroke="url(#lucideClockGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lucideClockBloom)"
          />
          <path
            d="M17.64 18.67 20 21"
            stroke="url(#lucideClockGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lucideClockBloom)"
          />

          {/* Lucide Alarm Clock Top Bells */}
          <path
            d="M5 3 2 6"
            stroke="url(#lucideClockGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lucideClockBloom)"
          />
          <path
            d="m22 6-3-3"
            stroke="url(#lucideClockGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lucideClockBloom)"
          />

          {/* Lucide Alarm Clock Center Body Circle */}
          {/* Frosted Glass Dial Fill */}
          <circle
            cx="12"
            cy="13"
            r="8"
            fill="rgba(8, 12, 22, 0.88)"
            stroke="url(#lucideClockGrad)"
            strokeWidth="1.8"
            filter="url(#lucideClockBloom)"
          />
        </svg>

        {/* Drotch Iconic Idle Eyes Inside Lucide Clock Center */}
        <div className="lucide-alarm-eyes-center">
          <div
            className={`eyes-gaze-track ${isHappy ? "expr-happy" : ""} ${
              blinking ? "is-blinking" : ""
            }`}
            style={{
              transform: `translate3d(${gazeOffset}px, 0, 0)`,
            }}
          >
            {/* Left Eye: Pure solid glowing white vertical pill */}
            <div className={`eye-unit left-eye ${blinking ? "blink" : ""}`}>
              {isHappy && <span className="eye-arc-happy" />}
            </div>

            {/* Right Eye: Pure solid glowing white vertical pill */}
            <div className={`eye-unit right-eye ${blinking ? "blink" : ""}`}>
              {isHappy && <span className="eye-arc-happy" />}
            </div>
          </div>
        </div>
      </div>

      {/* Crystalline Radial Light Particles on Dismissal Click */}
      {isDismissing && (
        <div className="alarm-chime-burst">
          <span className="chime-ripple" />
          <span className="chime-star cs1" />
          <span className="chime-star cs2" />
          <span className="chime-star cs3" />
          <span className="chime-star cs4" />
          <span className="chime-star cs5" />
          <span className="chime-star cs6" />
        </div>
      )}
    </div>
  );
}
