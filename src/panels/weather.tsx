import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  IconRefresh,
  IconSun,
  IconCloud,
  IconCloudSun,
  IconCloudRain,
  IconCloudLightning,
  IconSnow,
  IconMist,
  IconThermometer,
  IconMapPin,
} from "../components/Icons";

interface WeatherInfo {
  city: string;
  temp_c: number;
  condition: string;
  code: number;
}

export function useWeatherData() {
  const [w, setW] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    invoke<WeatherInfo>("weather_get")
      .then(setW)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return { w, loading, refresh };
}

export function WeatherIcon({ code, size = 20 }: { code: number; size?: number }) {
  if (code === 0 || code === 1) return <IconSun size={size} />;
  if (code === 2) return <IconCloudSun size={size} />;
  if (code === 3) return <IconCloud size={size} />;
  if (code === 45 || code === 48) return <IconMist size={size} />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82].includes(code))
    return <IconCloudRain size={size} />;
  if ([71, 73, 75, 77, 85, 86, 66, 67].includes(code)) return <IconSnow size={size} />;
  if ([95, 96, 99].includes(code)) return <IconCloudLightning size={size} />;
  return <IconThermometer size={size} />;
}

export function WeatherMini() {
  const { w } = useWeatherData();
  return (
    <div className="mini-music-row">
      <span className="mini-icon">
        {w ? <WeatherIcon code={w.code} size={15} /> : <IconThermometer size={15} />}
      </span>
      <span className="mini-track-text">
        {w ? `${Math.round(w.temp_c)}°C · ${w.condition} · ${w.city}` : "Loading weather…"}
      </span>
    </div>
  );
}

export function WeatherPanel() {
  const { w, loading, refresh } = useWeatherData();
  const [isRotating, setIsRotating] = useState(false);

  const handleRefresh = () => {
    setIsRotating(true);
    refresh();
    setTimeout(() => setIsRotating(false), 800);
  };

  if (loading && !w) return <div className="widget-empty">Loading weather forecast…</div>;
  if (!w) return <div className="widget-empty">Failed to load weather</div>;

  return (
    <div className="weather-widget-card">
      <div className="weather-main-display">
        <div className="weather-icon-badge">
          <WeatherIcon code={w.code} size={32} />
        </div>
        <div className="weather-temp-info">
          <div className="weather-temp-text">{Math.round(w.temp_c)}°</div>
          <div className="weather-cond-text">{w.condition}</div>
          <div className="weather-city-text">
            <IconMapPin size={12} color="#38bdf8" /> {w.city}
          </div>
        </div>
      </div>
      <div className="weather-meta-info">
        <div className="weather-chip">
          <span className="chip-label">Wind</span>
          <span className="chip-val">12 km/h</span>
        </div>
        <div className="weather-chip">
          <span className="chip-label">Humidity</span>
          <span className="chip-val">78%</span>
        </div>
        <button
          className={`weather-refresh-btn ${isRotating ? "is-spinning" : ""}`}
          onClick={handleRefresh}
          title="Refresh weather"
        >
          <IconRefresh size={13} />
        </button>
      </div>
    </div>
  );
}
