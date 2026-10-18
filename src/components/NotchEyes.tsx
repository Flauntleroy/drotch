import { useEffect, useRef, useState } from "react";

interface NotchEyesProps {
  isPlaying?: boolean;
  isTyping?: boolean;
  typingSpeed?: number;
  onExpand?: () => void;
}

type EyeExpression =
  | "normal"
  | "happy"
  | "surprised"
  | "wink-left"
  | "wink-right"
  | "hearts"
  | "drowsy"
  | "curious";

export function NotchEyes({
  isPlaying = false,
  isTyping = false,
  typingSpeed = 0,
  onExpand,
}: NotchEyesProps) {
  const [expression, setExpression] = useState<EyeExpression>("normal");
  const [blinking, setBlinking] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const [isBobbing, setIsBobbing] = useState(false);

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

  // Smooth mouse tracking with direct DOM update (Zero React re-renders, Zero layout reflow)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseMoveTime.current = Date.now();

      // If autonomous action or active typing is happening, don't override with mouse
      if (isAutonomousActive.current || isTypingRef.current) return;

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

  // Autonomous Living Idle Animation Engine (Random playful expressions & behaviors)
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
        // Skip if hovered, actively typing, or user moved mouse recently
        if (isHovered || isTypingRef.current || Date.now() - lastMouseMoveTime.current < 1800) {
          scheduleNextIdleAction();
          return;
        }

        isAutonomousActive.current = true;
        clearSubTimers();

        const rand = Math.random();

        if (rand < 0.28) {
          // 1. Saccade: Glance Left then Right
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
        } else if (rand < 0.46) {
          // 2. Happy Smile & Little Hop Bobble (^_^)
          setExpression("happy");
          setIsBobbing(true);
          const t1 = setTimeout(() => {
            setExpression("normal");
            setIsBobbing(false);
            isAutonomousActive.current = false;
            scheduleNextIdleAction();
          }, 1300);
          subTimers.push(t1);
        } else if (rand < 0.62) {
          // 3. Spontaneous Playful Wink (Left or Right)
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
        } else if (rand < 0.76) {
          // 4. Curious Head Tilt (?_?)
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
          // 5. Drowsy Micro-Nap then Alert Wake-up
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
          // 6. Wide-Eyed Surprised / Alert Look (O_O)
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
          // 7. Rare Love Heart Eyes (♥_♥) - 5% chance!
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

  // Click on the eyes to interact! (Cycles through playful reactions)
  const handleEyeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    setIsBobbing(true);

    const expressions: EyeExpression[] = [
      "happy",
      "wink-left",
      "surprised",
      "hearts",
      "curious",
      "wink-right",
    ];
    const chosen = expressions[nextCount % expressions.length];
    setExpression(chosen);

    setTimeout(() => {
      setExpression("normal");
      setIsBobbing(false);
    }, 1300);
  };

  return (
    <div
      ref={containerRef}
      className={`interactive-eyes-wrapper ${isPlaying ? "music-vibing" : ""} ${
        isHovered ? "is-hovered" : ""
      } ${isBobbing ? "is-bobbing" : ""} ${isTyping ? "is-typing" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleEyeClick}
      title="Klik mata untuk interaksi! Double klik untuk buka drotch"
      onDoubleClick={onExpand}
    >
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

      {/* Interactive Tooltip Hint on hover */}
      {isHovered && (
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
