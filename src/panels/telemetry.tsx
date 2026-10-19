import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { IconCpu, IconRam, IconActivity } from "../components/Icons";

export interface TelemetryData {
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  uptime_secs: number;
}

export function TelemetryPanel() {
  const [data, setData] = useState<TelemetryData>({
    cpu_percent: 0,
    ram_percent: 0,
    ram_used_gb: 0,
    ram_total_gb: 0,
    uptime_secs: 0,
  });

  const [cpuHistory, setCpuHistory] = useState<number[]>(() => Array(16).fill(0));
  const [ramHistory, setRamHistory] = useState<number[]>(() => Array(16).fill(0));

  useEffect(() => {
    // Initial fetch
    invoke<TelemetryData>("telemetry_get")
      .then((res) => {
        if (res) {
          setData(res);
          setCpuHistory((prev) => [...prev.slice(1), res.cpu_percent]);
          setRamHistory((prev) => [...prev.slice(1), res.ram_percent]);
        }
      })
      .catch(() => {});

    // Listen to real-time events
    let unlisten: (() => void) | null = null;
    listen<TelemetryData>("system-telemetry", (event) => {
      const payload = event.payload;
      if (!payload) return;
      setData(payload);
      setCpuHistory((prev) => [...prev.slice(1), Math.round(payload.cpu_percent)]);
      setRamHistory((prev) => [...prev.slice(1), Math.round(payload.ram_percent)]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const formatUptime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m ${secs % 60}s`;
  };

  // Generate SVG sparkline points for 16 points across width 80, height 22
  const buildSparkline = (history: number[], maxVal = 100) => {
    const w = 84;
    const h = 20;
    const step = w / (history.length - 1);
    return history
      .map((val, idx) => {
        const x = (idx * step).toFixed(1);
        const clamped = Math.max(0, Math.min(maxVal, val));
        const y = (h - (clamped / maxVal) * (h - 2)).toFixed(1);
        return `${x},${y}`;
      })
      .join(" ");
  };

  const cpuPoints = buildSparkline(cpuHistory);
  const ramPoints = buildSparkline(ramHistory);

  return (
    <div className="telemetry-panel-card">
      {/* Top Header bar with Uptime badge */}
      <div className="telemetry-top-header">
        <div className="telemetry-title-group">
          <IconActivity size={12} color="#38bdf8" />
          <span className="telemetry-card-title">System Telemetry</span>
        </div>

        <div className="telemetry-uptime-pill">
          <span className="telemetry-live-dot" />
          <span>Uptime {formatUptime(data.uptime_secs)}</span>
        </div>
      </div>

      {/* Dual Meter Row */}
      <div className="telemetry-meters-grid">
        {/* CPU Box */}
        <div className="telemetry-meter-box cpu">
          <div className="meter-box-header">
            <div className="meter-icon-label">
              <IconCpu size={12} color="#38bdf8" />
              <span className="meter-label">CPU</span>
            </div>
            <span className="meter-digits">{Math.round(data.cpu_percent)}%</span>
          </div>

          <div className="meter-progress-track">
            <div
              className="meter-progress-fill cpu-fill"
              style={{ width: `${Math.min(100, Math.max(2, data.cpu_percent))}%` }}
            />
          </div>

          <div className="meter-sparkline-wrap">
            <svg className="meter-sparkline-svg" width="84" height="20" viewBox="0 0 84 20">
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={cpuPoints}
              />
            </svg>
            <span className="sparkline-sub">Core Activity</span>
          </div>
        </div>

        {/* RAM Box */}
        <div className="telemetry-meter-box ram">
          <div className="meter-box-header">
            <div className="meter-icon-label">
              <IconRam size={12} color="#c084fc" />
              <span className="meter-label">RAM</span>
            </div>
            <span className="meter-digits">{data.ram_percent}%</span>
          </div>

          <div className="meter-progress-track">
            <div
              className="meter-progress-fill ram-fill"
              style={{ width: `${Math.min(100, Math.max(2, data.ram_percent))}%` }}
            />
          </div>

          <div className="meter-sparkline-wrap">
            <svg className="meter-sparkline-svg" width="84" height="20" viewBox="0 0 84 20">
              <polyline
                fill="none"
                stroke="#c084fc"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ramPoints}
              />
            </svg>
            <span className="sparkline-sub">
              {data.ram_used_gb.toFixed(1)} / {data.ram_total_gb.toFixed(1)} GB
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
