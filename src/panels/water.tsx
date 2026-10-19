import { useEffect, useState } from "react";
import { IconWaterDrop, IconRefresh, IconBell } from "../components/Icons";

export function WaterWidget() {
  const [currentMl, setCurrentMl] = useState<number>(() => {
    const saved = localStorage.getItem("drotch_water_ml") || localStorage.getItem("notch_water_ml");
    return saved ? Number(saved) : 1500;
  });
  const [targetMl] = useState<number>(1500);
  const [notifications, setNotifications] = useState<boolean>(() => {
    const saved = localStorage.getItem("drotch_water_notifications");
    return saved !== null ? saved === "true" : true;
  });
  const [ripple, setRipple] = useState(false);

  useEffect(() => {
    localStorage.setItem("drotch_water_ml", currentMl.toString());
  }, [currentMl]);

  useEffect(() => {
    localStorage.setItem("drotch_water_notifications", notifications.toString());
  }, [notifications]);

  // Synchronize with external hydration events (e.g. from idle drink reminder animation)
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ amount?: number; total?: number }>;
      const detail = custom.detail;
      if (detail && typeof detail.total === "number") {
        setCurrentMl(detail.total);
      } else if (detail && typeof detail.amount === "number") {
        const amt = detail.amount;
        setCurrentMl((prev) => Math.min(3000, prev + amt));
      } else {
        const saved = localStorage.getItem("drotch_water_ml");
        if (saved) setCurrentMl(Number(saved));
      }
    };
    window.addEventListener("drotch-water-updated", handleUpdate);
    return () => window.removeEventListener("drotch-water-updated", handleUpdate);
  }, []);

  const addDrink = (ml: number = 250) => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    const next = Math.min(3000, currentMl + ml);
    setCurrentMl(next);
    window.dispatchEvent(new CustomEvent("drotch-water-updated", { detail: { total: next } }));
  };

  const [intervalMins, setIntervalMins] = useState<number>(() => {
    const saved = localStorage.getItem("drotch_water_interval_mins");
    return saved ? Number(saved) : 30;
  });

  useEffect(() => {
    localStorage.setItem("drotch_water_interval_mins", intervalMins.toString());
  }, [intervalMins]);

  const cycleInterval = () => {
    const intervals = [20, 30, 45, 60];
    const currentIndex = intervals.indexOf(intervalMins);
    const nextIndex = (currentIndex + 1) % intervals.length;
    const nextVal = intervals[nextIndex];
    setIntervalMins(nextVal);
  };

  const resetDrink = () => {
    setCurrentMl(0);
    window.dispatchEvent(new CustomEvent("drotch-water-updated", { detail: { total: 0 } }));
  };

  const pct = Math.min(100, Math.round((currentMl / targetMl) * 100));
  const currentL = (currentMl / 1000).toFixed(1);
  const targetL = (targetMl / 1000).toFixed(1);

  // Hourly intake data for mini bar chart
  const hoursData = [
    { hour: "09", amount: 250 },
    { hour: "11", amount: 350 },
    { hour: "12", amount: 200 },
    { hour: "14", amount: 300 },
    { hour: "15", amount: 250 },
    { hour: "17", amount: currentMl >= 1500 ? 150 : 0 },
  ];

  return (
    <div className="water-widget-card">
      <div className="water-left-col">
        <div className="water-main-stat">
          <span className="water-val-num">{currentL}</span>
          <span className="water-val-denom">/{targetL} L</span>
          <div className="water-stat-badges">
            <button
              className="water-interval-badge"
              onClick={cycleInterval}
              title={`Water Reminder Interval: Every ${intervalMins} mins (Click to cycle 20m/30m/45m/60m)`}
            >
              <span>{intervalMins}m</span>
            </button>
            <button
              className={`water-toggle-switch ${notifications ? "on" : "off"}`}
              onClick={() => setNotifications(!notifications)}
              title={notifications ? "Water Reminder: On" : "Water Reminder: Off"}
              aria-label="Toggle Water Reminder"
            >
              <span className="water-toggle-thumb">
                <IconBell size={9} color={notifications ? "#0284c7" : "#64748b"} />
              </span>
            </button>
          </div>
        </div>

        <div className="water-substat">
          <span>Today · </span>
          <strong style={{ color: "#38bdf8" }}>{pct}%</strong>
          <span> · {pct >= 100 ? "Goal reached!" : "Stay hydrated!"}</span>
        </div>

        <div className="water-progress-track">
          <div
            className={`water-progress-fill ${ripple ? "is-rippling" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="water-action-btns">
          <button className={`water-btn primary ${ripple ? "btn-pop" : ""}`} onClick={() => addDrink(250)}>
            <IconWaterDrop size={13} color="#ffffff" />
            <span>Drink (+250ml)</span>
          </button>
          <button className="water-btn secondary" onClick={resetDrink} title="Reset today's progress">
            <IconRefresh size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="water-right-col">
        <div className="water-chart-header">
          <span className="chart-legend-top">400</span>
          <span className="chart-legend-mid">200</span>
          <span className="chart-legend-bot">0 ml</span>
        </div>
        <div className="water-bars-container">
          {hoursData.map((d, i) => {
            const barHeight = Math.min(100, (d.amount / 400) * 100);
            return (
              <div key={i} className="water-bar-column" title={`${d.hour}:00 - ${d.amount} ml`}>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span className="bar-label">{d.hour}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
