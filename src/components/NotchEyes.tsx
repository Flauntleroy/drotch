import { useEffect, useRef, useState } from "react";

interface NotchEyesProps {
  isPlaying?: boolean;
  isTyping?: boolean;
  typingSpeed?: number;
  isExpanded?: boolean;
  onExpand?: () => void;
  onOpenWater?: () => void;
  onWaterReminderChange?: (active: boolean) => void;
}

type EyeExpression =
  | "normal"
  | "happy"
  | "surprised"
  | "wink-left"
  | "wink-right"
  | "hearts"
  | "drowsy"
  | "curious"
  | "drink";

export function NotchEyes({
  isPlaying = false,
  isTyping = false,
  typingSpeed = 0,
  isExpanded = false,
  onExpand,
  onOpenWater,
  onWaterReminderChange,
}: NotchEyesProps) {
  const [expression, setExpression] = useState<EyeExpression>("normal");
  const [blinking, setBlinking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [isBobbing, setIsBobbing] = useState(false);

  // Water Drink Reminder State during Idle Mode
  const [isWaterReminder, setIsWaterReminder] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const isWaterReminderRef = useRef(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrinkReminderTimeRef = useRef<number>(Date.now());
  const idleCycleCountRef = useRef<number>(0);

  const isTypingRef = useRef(isTyping);
  const typingSpeedRef = useRef(typingSpeed);
  const wasTypingRef = useRef(false);

  useEffect(() => {
    isTypingRef.current = isTyping;
    typingSpeedRef.current = typingSpeed;

    if (isTyping) {
      wasTypingRef.current = true;
    } else if (wasTypingRef.current) {
      // User just finished typing! Happy smile & celebration bobble
      wasTypingRef.current = false;
      setExpression("happy");
      setIsBobbing(true);
      const timer = setTimeout(() => {
        setExpression("normal");
        setIsBobbing(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isTyping, typingSpeed]);

  const containerRef = useRef<HTMLDivElement>(null);
  const gazeTrackRef = useRef<HTMLDivElement>(null);
  const targetPosRef = useRef({ x: 0, y: 0 });
  const currentPosRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  const isAutonomousActive = useRef(false);
  const lastMouseMoveTime = useRef(Date.now());

  // Function to start the drink reminder animation in idle mode
  const startWaterReminder = (force: boolean = false) => {
    if (!force) {
      const saved = localStorage.getItem("drotch_water_notifications");
      const notifsEnabled = saved === null ? true : saved !== "false";
      if (!notifsEnabled) return;
    }

    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    console.log("[NotchEyes] startWaterReminder active, force:", force);
    isWaterReminderRef.current = true;
    setIsWaterReminder(true);
    setIsCelebrating(false);
    onWaterReminderChange?.(true);
    isAutonomousActive.current = true;
    lastDrinkReminderTimeRef.current = Date.now();

    autoDismissTimerRef.current = setTimeout(() => {
      stopWaterReminder();
    }, 10000);
  };

  // Function to stop water reminder and return smoothly to normal eyes
  const stopWaterReminder = () => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    isWaterReminderRef.current = false;
    setIsWaterReminder(false);
    setIsCelebrating(false);
    onWaterReminderChange?.(false);
    isAutonomousActive.current = false;
    targetPosRef.current = { x: 0, y: 0 };
    setExpression("normal");
    lastDrinkReminderTimeRef.current = Date.now();
  };

  // Drink water action (+250ml) when clicking droplet or quick pill
  const handleDrinkFromReminder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCelebrating) return;

    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }

    setIsCelebrating(true);
    setIsBobbing(true);
    setExpression("happy");
    targetPosRef.current = { x: 0, y: -1.2 };

    // Update water intake in localStorage & dispatch sync event
    const saved = localStorage.getItem("drotch_water_ml") || localStorage.getItem("notch_water_ml");
    const current = saved ? Number(saved) : 1500;
    const next = Math.min(3000, current + 250);
    localStorage.setItem("drotch_water_ml", String(next));
    window.dispatchEvent(
      new CustomEvent("drotch-water-updated", { detail: { amount: 250, total: next } })
    );

    autoDismissTimerRef.current = setTimeout(() => {
      stopWaterReminder();
    }, 1900);
  };

  // Listen for hydration update events to reset reminder interval
  useEffect(() => {
    const handleWaterUpdated = () => {
      // User logged a drink or updated water, reset the reminder countdown
      lastDrinkReminderTimeRef.current = Date.now();
    };
    window.addEventListener("drotch-water-updated", handleWaterUpdated);
    return () => {
      window.removeEventListener("drotch-water-updated", handleWaterUpdated);
    };
  }, []);

  // When island expands or music starts playing, dismiss active water reminder immediately
  useEffect(() => {
    if ((isExpanded || isPlaying) && isWaterReminderRef.current) {
      stopWaterReminder();
    }
  }, [isExpanded, isPlaying]);

  // Smooth mouse tracking with direct DOM update (Zero React re-renders)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseMoveTime.current = Date.now();

      // If autonomous action or active typing or water reminder is happening, don't override with mouse
      if (isAutonomousActive.current || isTypingRef.current || isWaterReminderRef.current) return;

      const centerX = window.innerWidth / 2;
      const centerY = 16;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 0) {
        const maxDistX = 3.5;
        const maxDistY = 2.0;
        const clampedX = Math.max(-maxDistX, Math.min(maxDistX, (deltaX / 120) * maxDistX));
        const clampedY = Math.max(-maxDistY, Math.min(maxDistY, (deltaY / 100) * maxDistY));
        targetPosRef.current = { x: clampedX, y: clampedY };
      }
    };

    // Smooth Lerp animation loop without React setState
    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor;

    const updateGaze = () => {
      const cur = currentPosRef.current;
      const tgt = targetPosRef.current;

      if (isTypingRef.current) {
        const speedBonus = Math.min(1.8, (typingSpeedRef.current || 1) * 0.25);
        // Look down towards keyboard with rapid micro-saccades reading fingers
        tgt.x = Math.sin(Date.now() / 105) * (1.2 + speedBonus);
        tgt.y = 2.3 + Math.cos(Date.now() / 160) * 0.35;
      }

      const lerpFactor = isTypingRef.current ? 0.28 : 0.16;
      cur.x = lerp(cur.x, tgt.x, lerpFactor);
      cur.y = lerp(cur.y, tgt.y, lerpFactor);

      if (gazeTrackRef.current) {
        gazeTrackRef.current.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
      }
      animFrameRef.current = requestAnimationFrame(updateGaze);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animFrameRef.current = requestAnimationFrame(updateGaze);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Life-like natural blinking cycle
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleBlink = () => {
      const nextDelay = 2600 + Math.random() * 3200;
      timeoutId = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => {
          setBlinking(false);
          // 25% chance of a playful double-blink!
          if (Math.random() < 0.25) {
            setTimeout(() => {
              setBlinking(true);
              setTimeout(() => setBlinking(false), 120);
            }, 140);
          }
        }, 130);
        scheduleBlink();
      }, nextDelay);
    };

    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Autonomous Living Idle Animation Engine (Random playful expressions + Drink Reminder)
  useEffect(() => {
    let mainTimer: ReturnType<typeof setTimeout>;
    let subTimers: ReturnType<typeof setTimeout>[] = [];

    const clearSubTimers = () => {
      subTimers.forEach(clearTimeout);
      subTimers = [];
    };

    const scheduleNextIdleAction = () => {
      // Trigger random autonomous behavior every 3.5s - 7.5s
      const nextDelay = 3500 + Math.random() * 4000;

      mainTimer = setTimeout(() => {
        // Skip if playing music, island is expanded, hovered, typing, mouse moved, or reminder already running
        if (
          isPlaying ||
          isExpanded ||
          isHovered ||
          isTypingRef.current ||
          isWaterReminderRef.current ||
          Date.now() - lastMouseMoveTime.current < 1800
        ) {
          scheduleNextIdleAction();
          return;
        }

        isAutonomousActive.current = true;
        clearSubTimers();

        idleCycleCountRef.current += 1;
        const timeSinceLastReminder = Date.now() - lastDrinkReminderTimeRef.current;
        const rand = Math.random();

        // 1. Water Drink Reminder Animation in Idle Mode
        // Triggers realistically based on user preference (default: 30 minutes)
        const savedNotifs = localStorage.getItem("drotch_water_notifications");
        const notifsEnabled = savedNotifs === null ? true : savedNotifs !== "false";
        const savedInterval = localStorage.getItem("drotch_water_interval_mins");
        const intervalMinutes = savedInterval ? Math.max(5, Number(savedInterval)) : 30;
        const intervalMs = intervalMinutes * 60 * 1000;

        const shouldTriggerWater = notifsEnabled && timeSinceLastReminder >= intervalMs;

        if (shouldTriggerWater) {
          startWaterReminder();
          const t1 = setTimeout(() => {
            scheduleNextIdleAction();
          }, 8200);
          subTimers.push(t1);
          return;
        }

        if (rand < 0.30) {
          // 2. Saccade: Glance Left then Right
          targetPosRef.current = { x: -3.5, y: -0.5 };
          const t1 = setTimeout(() => {
            targetPosRef.current = { x: 3.5, y: 0.5 };
            const t2 = setTimeout(() => {
              targetPosRef.current = { x: 0, y: 0 };
              isAutonomousActive.current = false;
              scheduleNextIdleAction();
            }, 650);
            subTimers.push(t2);
          }, 750);
          subTimers.push(t1);
        } else if (rand < 0.48) {
          // 3. Happy Smile & Little Hop Bobble (^_^)
          setExpression("happy");
          setIsBobbing(true);
          const t1 = setTimeout(() => {
            setExpression("normal");
            setIsBobbing(false);
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 1300);
          subTimers.push(t1);
        } else if (rand < 0.64) {
          // 4. Spontaneous Playful Wink (Left or Right)
          const whichWink: EyeExpression = Math.random() < 0.5 ? "wink-left" : "wink-right";
          setExpression(whichWink);
          setIsBobbing(true);
          const t1 = setTimeout(() => {
            setExpression("normal");
            setIsBobbing(false);
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 950);
          subTimers.push(t1);
        } else if (rand < 0.77) {
          // 5. Curious Head Tilt (?_?)
          setExpression("curious");
          targetPosRef.current = { x: 2.4, y: -1.6 };
          const t1 = setTimeout(() => {
            setExpression("normal");
            targetPosRef.current = { x: 0, y: 0 };
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 1400);
          subTimers.push(t1);
        } else if (rand < 0.88) {
          // 6. Drowsy Micro-Nap then Alert Wake-up
          setExpression("drowsy");
          targetPosRef.current = { x: 0, y: 1.8 };
          const t1 = setTimeout(() => {
            setExpression("normal");
            targetPosRef.current = { x: 0, y: 0 };
            // Double-blink alert on wake-up
            setBlinking(true);
            setTimeout(() => {
              setBlinking(false);
              setTimeout(() => {
                setBlinking(true);
                setTimeout(() => setBlinking(false), 120);
              }, 140);
            }, 120);
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 1600);
          subTimers.push(t1);
        } else if (rand < 0.95) {
          // 7. Wide-Eyed Surprised / Alert Look (O_O)
          setExpression("surprised");
          targetPosRef.current = { x: 0, y: -2.0 };
          const t1 = setTimeout(() => {
            setExpression("normal");
            targetPosRef.current = { x: 0, y: 0 };
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 1100);
          subTimers.push(t1);
        } else {
          // 8. Rare Love Heart Eyes (♥_♥) - 5% chance!
          setExpression("hearts");
          setIsBobbing(true);
          const t1 = setTimeout(() => {
            setExpression("normal");
            setIsBobbing(false);
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 1500);
          subTimers.push(t1);
        }
      }, nextDelay);
    };

    scheduleNextIdleAction();

    return () => {
      clearTimeout(mainTimer);
      clearSubTimers();
    };
  }, [isHovered]);

  // Click on the eyes to interact! (Single click immediately launches water droplet reminder)
  const handleEyeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBobbing(true);
    startWaterReminder(true);
  };

  return (
    <div
      ref={containerRef}
      className={`interactive-eyes-wrapper ${isPlaying ? "music-vibing" : ""} ${
        isHovered ? "is-hovered" : ""
      } ${isBobbing ? "is-bobbing" : ""} ${isTyping ? "is-typing" : ""} ${
        isWaterReminder ? "is-water-active" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleEyeClick}
      title={
        isWaterReminder
          ? "Waktunya minum air! Klik droplet/+250ml untuk catat"
          : "Klik mata untuk interaksi! Double klik untuk buka drotch"
      }
      onDoubleClick={onExpand}
    >
      {isWaterReminder ? (
        /* Dynamic Hydration Reminder Scene in Idle Mode (Pure Animated Droplet, No Text) */
        <div
          className={`water-idle-reminder-container ${
            isCelebrating ? "is-celebrating" : ""
          }`}
          onClick={handleDrinkFromReminder}
          onDoubleClick={onOpenWater}
          title="💧 Waktunya minum air! Klik droplet untuk minum (+250ml)"
        >
          {/* Prominent, Plump Water Droplet Mascot Actor (Enlarged & Overflowing past Notch) */}
          <div
            className={`water-droplet-actor extra-large overflowing ${isCelebrating ? "is-celebrating" : ""}`}
            onClick={handleDrinkFromReminder}
            title="Klik droplet untuk minum (+250ml)!"
          >
            {/* Clean, Simple 3D Liquid Puddle Locked Directly to Droplet Base */}
            <div className={`water-droplet-puddle-base ${isCelebrating ? "is-celebrating" : ""}`}>
              <div className="puddle-liquid-disc" />
              <div className="puddle-ripple-ring r1" />
              <div className="puddle-ripple-ring r2" />
            </div>

            <div className="water-droplet-glow" />

            <svg
              className={`water-drop-svg ${isCelebrating ? "is-celebrating" : ""}`}
              viewBox="0 0 32 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="dropletCoreGrad" x1="16" y1="2" x2="16" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#a5f3fc" />
                  <stop offset="25%" stopColor="#38bdf8" />
                  <stop offset="70%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#0369a1" />
                </linearGradient>

                <linearGradient id="dropletShineGrad" x1="8" y1="10" x2="15" y2="22" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                </linearGradient>

                <filter id="dropletDeepGlow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0284c7" floodOpacity="0.9" />
                </filter>
              </defs>

              {/* Main Teardrop Silhouette with Deep Shadow */}
              <path
                className="drop-body-path"
                d="M16 2.5 C16 2.5 28.5 17 28.5 24.5 C28.5 31.2 22.9 36 16 36 C9.1 36 3.5 31.2 3.5 24.5 C3.5 17 16 2.5 16 2.5 Z"
                fill="url(#dropletCoreGrad)"
                filter="url(#dropletDeepGlow)"
              />

              {/* Liquid Inner Refraction Border Line */}
              <path
                d="M5.8 24.5 C5.8 19 13.5 8 16 4.5 C18.5 8 26.2 19 26.2 24.5 C26.2 30 21.6 34.2 16 34.2 C10.4 34.2 5.8 30 5.8 24.5 Z"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="0.8"
                fill="none"
              />

              {/* Primary Curved Specular Highlight (Top Left Gloss) */}
              <ellipse
                cx="10"
                cy="15"
                rx="2.6"
                ry="5.8"
                transform="rotate(-28 10 15)"
                fill="url(#dropletShineGrad)"
              />

              {/* Sparkle Glint Dot on Upper Crest */}
              <circle cx="14" cy="8.5" r="1.4" fill="#ffffff" opacity="0.95" />

              {/* Bottom Liquid Reflection Ring */}
              <path
                d="M10 32.2 Q16 34.8 22 32.2"
                stroke="rgba(255, 255, 255, 0.65)"
                strokeWidth="1.3"
                strokeLinecap="round"
                fill="none"
              />

              {/* Living Kawaii Mascot Face on Droplet */}
              <g className={`drop-kawaii-face ${isCelebrating ? "celebrating" : ""}`}>
                {/* Cheerful Blush Cheeks */}
                <ellipse cx="8" cy="23.5" rx="2.2" ry="1.3" fill="#f43f5e" opacity="0.75" />
                <ellipse cx="24" cy="23.5" rx="2.2" ry="1.3" fill="#f43f5e" opacity="0.75" />

                {/* Left Eye */}
                {isCelebrating ? (
                  <path d="M10 21 Q12 23.5 14 21" stroke="#082f49" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                ) : blinking ? (
                  <path d="M10 21.5 Q12 20.5 14 21.5" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                ) : (
                  <>
                    <circle cx="12" cy="21.5" r="1.8" fill="#082f49" />
                    <circle cx="12.6" cy="20.8" r="0.65" fill="#ffffff" />
                  </>
                )}

                {/* Right Eye */}
                {isCelebrating ? (
                  <path d="M18 21 Q20 23.5 22 21" stroke="#082f49" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                ) : blinking ? (
                  <path d="M18 21.5 Q20 20.5 22 21.5" stroke="#082f49" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                ) : (
                  <>
                    <circle cx="20" cy="21.5" r="1.8" fill="#082f49" />
                    <circle cx="20.6" cy="20.8" r="0.65" fill="#ffffff" />
                  </>
                )}

                {/* Happy Mouth */}
                {isCelebrating ? (
                  <path d="M14 24.2 Q16 28 18 24.2 Z" fill="#f43f5e" stroke="#082f49" strokeWidth="1.1" strokeLinejoin="round" />
                ) : (
                  <path d="M14.5 24.8 Q16 26.6 17.5 24.8" stroke="#082f49" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                )}
              </g>
            </svg>

            {/* Micro Bubbly Pearls */}
            <span className="water-micro-bubble b1" />
            <span className="water-micro-bubble b2" />
            <span className="water-micro-bubble b3" />

            {/* Splash Burst particles on click */}
            {isCelebrating && (
              <div className="water-splash-burst">
                <span className="splash-particle p1" />
                <span className="splash-particle p2" />
                <span className="splash-particle p3" />
                <span className="splash-particle p4" />
                <span className="splash-particle p5" />
                <span className="splash-particle p6" />
                <span className="splash-particle p7" />
                <span className="splash-particle p8" />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Normal Interactive Gaze Track */
        <div
          ref={gazeTrackRef}
          className={`eyes-gaze-track expr-${expression} ${blinking ? "is-blinking" : ""} ${
            isTyping ? "typing-focus" : ""
          }`}
        >
          {/* Left Eye */}
          <div className={`eye-unit left-eye ${blinking ? "blink" : ""}`}>
            {expression === "happy" && <span className="eye-arc-happy" />}
            {expression === "hearts" && (
              <svg className="eye-heart-svg" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            )}
            {expression === "wink-left" && <span className="eye-wink-line" />}
            {expression !== "happy" &&
              expression !== "hearts" &&
              expression !== "wink-left" && (
                <span className={`eye-pupil ${isPlaying ? "pulse-pupil" : ""}`} />
              )}
          </div>

          {/* Right Eye */}
          <div className={`eye-unit right-eye ${blinking ? "blink" : ""}`}>
            {expression === "happy" && <span className="eye-arc-happy" />}
            {expression === "hearts" && (
              <svg className="eye-heart-svg" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            )}
            {expression === "wink-right" && <span className="eye-wink-line" />}
            {expression !== "happy" &&
              expression !== "hearts" &&
              expression !== "wink-right" && (
                <span className={`eye-pupil ${isPlaying ? "pulse-pupil" : ""}`} />
              )}
          </div>
        </div>
      )}

      {/* Interactive Tooltip Hint on hover (Normal Mode) */}
      {isHovered && !isWaterReminder && (
        <div className="eyes-mini-reaction-hint">
          {isTyping
            ? `⚡ Ngetik: ${typingSpeed.toFixed(1)}/detik`
            : isPlaying
            ? "Jammin'!"
            : "Klik aku!"}
        </div>
      )}
    </div>
  );
}
