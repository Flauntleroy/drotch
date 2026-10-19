import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  IconSettings,
  IconKeyboard,
  IconPower,
  IconPin,
  IconCheck,
  IconBolt,
} from "../components/Icons";

export interface AppSettings {
  autostart: boolean;
  shortcut: string;
  always_on_top: boolean;
  auto_collapse: boolean;
  typing_effects: boolean;
  living_eyes: boolean;
  city: string;
  latitude: number;
  longitude: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  autostart: false,
  shortcut: "Ctrl+Shift+Space",
  always_on_top: true,
  auto_collapse: true,
  typing_effects: true,
  living_eyes: true,
  city: "Marabahan",
  latitude: -2.90,
  longitude: 114.77,
};

const SHORTCUT_OPTIONS = [
  { label: "Ctrl + Shift + Space", value: "Ctrl+Shift+Space" },
  { label: "Alt + Space (Spotlight style)", value: "Alt+Space" },
  { label: "Ctrl + ` (Backtick)", value: "Ctrl+`" },
  { label: "Ctrl + Shift + N", value: "Ctrl+Shift+N" },
  { label: "Nonaktif (Hanya Mouse)", value: "None" },
];

const CITY_PRESETS = [
  { name: "Marabahan", lat: -2.90, lon: 114.77 },
  { name: "Banjarmasin", lat: -3.32, lon: 114.59 },
  { name: "Jakarta", lat: -6.20, lon: 106.84 },
  { name: "Surabaya", lat: -7.25, lon: 112.75 },
  { name: "Bandung", lat: -6.91, lon: 107.60 },
  { name: "Yogyakarta", lat: -7.79, lon: 110.36 },
  { name: "Denpasar", lat: -8.67, lon: 115.21 },
  { name: "Balikpapan", lat: -1.26, lon: 116.83 },
];

export function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savedBadge, setSavedBadge] = useState(false);

  useEffect(() => {
    invoke<AppSettings>("settings_get")
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Gagal membaca settings:", err);
        setLoading(false);
      });
  }, []);

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    val: AppSettings[K]
  ) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);

    // Apply always_on_top directly via Tauri window API
    if (key === "always_on_top") {
      try {
        await getCurrentWindow().setAlwaysOnTop(val as boolean);
      } catch (e) {
        console.error("Failed to set always on top:", e);
      }
    }

    try {
      await invoke("settings_set", { settings: updated });
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 1200);
    } catch (err) {
      console.error("Gagal menyimpan settings:", err);
    }
  };

  const handleCitySelect = (name: string, lat: number, lon: number) => {
    const updated = { ...settings, city: name, latitude: lat, longitude: lon };
    setSettings(updated);
    invoke("settings_set", { settings: updated }).then(() => {
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 1200);
    });
  };

  if (loading) {
    return <div className="widget-empty">Loading settings…</div>;
  }

  return (
    <div className="settings-widget-card">
      {/* Settings Header Bar */}
      <div className="settings-header-row">
        <div className="settings-title-wrap">
          <IconSettings size={15} color="#38bdf8" />
          <span className="settings-heading">Preferences & System</span>
        </div>
        {savedBadge && (
          <span className="settings-saved-chip">
            <IconCheck size={11} color="#34d399" /> Saved
          </span>
        )}
      </div>

      <div className="settings-scroll-content">
        {/* Item 1: Shortcut Hotkey */}
        <div className="setting-card-item">
          <div className="setting-icon-col">
            <IconKeyboard size={15} color="#38bdf8" />
          </div>
          <div className="setting-meta-col">
            <div className="setting-row-label">Toggle Shortcut</div>
            <div className="setting-row-sub">
              Expand or collapse Drotch from any application
            </div>
          </div>
          <div className="setting-ctrl-col">
            <select
              className="setting-dropdown-select"
              value={settings.shortcut}
              onChange={(e) => updateSetting("shortcut", e.target.value)}
            >
              {SHORTCUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Item 2: Windows on Startup */}
        <div className="setting-card-item">
          <div className="setting-icon-col">
            <IconPower size={15} color="#818cf8" />
          </div>
          <div className="setting-meta-col">
            <div className="setting-row-label">Launch on Windows Startup</div>
            <div className="setting-row-sub">
              Automatically run Drotch in background on login
            </div>
          </div>
          <div className="setting-ctrl-col">
            <label className="setting-switch-wrap">
              <input
                type="checkbox"
                checked={settings.autostart}
                onChange={(e) => updateSetting("autostart", e.target.checked)}
              />
              <span className="setting-switch-slider" />
            </label>
          </div>
        </div>

        {/* Item 3: Always On Top */}
        <div className="setting-card-item">
          <div className="setting-icon-col">
            <IconPin size={14} color="#a855f7" />
          </div>
          <div className="setting-meta-col">
            <div className="setting-row-label">Always on Top</div>
            <div className="setting-row-sub">
              Keep Drotch floating above other active windows
            </div>
          </div>
          <div className="setting-ctrl-col">
            <label className="setting-switch-wrap">
              <input
                type="checkbox"
                checked={settings.always_on_top}
                onChange={(e) => updateSetting("always_on_top", e.target.checked)}
              />
              <span className="setting-switch-slider" />
            </label>
          </div>
        </div>

        {/* Item 4: Efek Ketikan (Typing Reactions) */}
        <div className="setting-card-item">
          <div className="setting-icon-col">
            <IconBolt size={14} color="#eab308" />
          </div>
          <div className="setting-meta-col">
            <div className="setting-row-label">Typing Reactions</div>
            <div className="setting-row-sub">
              Eyes focus down and neon pulse glows as you type
            </div>
          </div>
          <div className="setting-ctrl-col">
            <label className="setting-switch-wrap">
              <input
                type="checkbox"
                checked={settings.typing_effects}
                onChange={(e) => updateSetting("typing_effects", e.target.checked)}
              />
              <span className="setting-switch-slider" />
            </label>
          </div>
        </div>

        {/* Item 5: Lokasi Cuaca */}
        <div className="setting-card-item is-column">
          <div className="setting-row-label-row">
            <span className="setting-row-label">Active Weather City</span>
            <span className="setting-active-city-badge">{settings.city}</span>
          </div>
          <div className="setting-city-chips">
            {CITY_PRESETS.map((c) => (
              <button
                key={c.name}
                className={`city-preset-chip ${
                  settings.city === c.name ? "active" : ""
                }`}
                onClick={() => handleCitySelect(c.name, c.lat, c.lon)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
