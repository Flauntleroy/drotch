import { useState, useId } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  IconCalculator,
  IconEqual,
  IconCheck,
  IconClipboardCheck,
  IconSparkles,
} from "../components/Icons";

interface QuickPreset {
  label: string;
  query: string;
}

const PRESETS: QuickPreset[] = [
  { label: "15% Off", query: "500 - (15% * 500)" },
  { label: "$100 to EUR", query: "100 usd to eur" },
  { label: "16 GB to MB", query: "16 gb to mb" },
  { label: "30°C to °F", query: "30 c to f" },
];

export function CalcPanel() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const inputId = useId();

  // Evaluate query safely
  const evaluate = (q: string): { result: string; type: "math" | "unit" | "currency" | "error" } => {
    const raw = q.trim().toLowerCase();
    if (!raw) return { result: "0", type: "math" };

    // 1. Currency Conversion
    const currMatch = raw.match(/^([\d.,]+)\s*([a-z]{3})\s*(?:to|in|ke|=)\s*([a-z]{3})$/);
    if (currMatch) {
      const val = parseFloat(currMatch[1].replace(/,/g, ""));
      const from = currMatch[2].toUpperCase();
      const to = currMatch[3].toUpperCase();

      // Standard exchange benchmark rates against USD
      const ratesToUsd: Record<string, number> = {
        USD: 1.0,
        IDR: 1 / 15850,
        EUR: 1.08,
        GBP: 1.28,
        SGD: 0.76,
        JPY: 1 / 152,
        MYR: 0.23,
        AUD: 0.66,
      };

      if (ratesToUsd[from] && ratesToUsd[to]) {
        const inUsd = val * ratesToUsd[from];
        const converted = inUsd / ratesToUsd[to];
        const formatted =
          converted >= 1000
            ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(converted)
            : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(converted);
        return { result: `${formatted} ${to}`, type: "currency" };
      }
    }

    // 2. Unit Conversions
    // Length: km <-> miles, m <-> ft, cm <-> inch
    const kmToMiles = raw.match(/^([\d.,]+)\s*km\s*(?:to|in|ke|=)\s*(?:miles|mi)$/);
    if (kmToMiles) {
      const val = parseFloat(kmToMiles[1].replace(/,/g, ""));
      return { result: `${(val * 0.621371).toFixed(2)} miles`, type: "unit" };
    }
    const milesToKm = raw.match(/^([\d.,]+)\s*(?:miles|mi)\s*(?:to|in|ke|=)\s*km$/);
    if (milesToKm) {
      const val = parseFloat(milesToKm[1].replace(/,/g, ""));
      return { result: `${(val * 1.60934).toFixed(2)} km`, type: "unit" };
    }

    // Temperature: C <-> F
    const cToF = raw.match(/^([\d.,-]+)\s*c\s*(?:to|in|ke|=)\s*f$/);
    if (cToF) {
      const val = parseFloat(cToF[1].replace(/,/g, ""));
      return { result: `${((val * 9) / 5 + 32).toFixed(1)} °F`, type: "unit" };
    }
    const fToC = raw.match(/^([\d.,-]+)\s*f\s*(?:to|in|ke|=)\s*c$/);
    if (fToC) {
      const val = parseFloat(fToC[1].replace(/,/g, ""));
      return { result: `${(((val - 32) * 5) / 9).toFixed(1)} °C`, type: "unit" };
    }

    // Data storage: GB <-> MB
    const gbToMb = raw.match(/^([\d.,]+)\s*gb\s*(?:to|in|ke|=)\s*mb$/);
    if (gbToMb) {
      const val = parseFloat(gbToMb[1].replace(/,/g, ""));
      return { result: `${(val * 1024).toLocaleString()} MB`, type: "unit" };
    }
    const mbToGb = raw.match(/^([\d.,]+)\s*mb\s*(?:to|in|ke|=)\s*gb$/);
    if (mbToGb) {
      const val = parseFloat(mbToGb[1].replace(/,/g, ""));
      return { result: `${(val / 1024).toFixed(2)} GB`, type: "unit" };
    }

    // Weight: kg <-> lbs
    const kgToLbs = raw.match(/^([\d.,]+)\s*kg\s*(?:to|in|ke|=)\s*lbs?$/);
    if (kgToLbs) {
      const val = parseFloat(kgToLbs[1].replace(/,/g, ""));
      return { result: `${(val * 2.20462).toFixed(2)} lbs`, type: "unit" };
    }

    // 3. Math Expression Parser
    try {
      // Replace power ^ with **
      let sanitized = raw
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/\^/g, "**")
        .replace(/(\d+)%/g, "($1/100)")
        .replace(/sqrt\(([^)]+)\)/g, "Math.sqrt($1)")
        .replace(/pi/g, "Math.PI")
        .replace(/sin\(([^)]+)\)/g, "Math.sin($1)")
        .replace(/cos\(([^)]+)\)/g, "Math.cos($1)")
        .replace(/tan\(([^)]+)\)/g, "Math.tan($1)");

      // Security check: only allow digits, Math, basic arithmetic
      if (!/^[0-9+\-*/().\s,MathPIsqrtcossintan]+$/.test(sanitized)) {
        return { result: "Invalid expression", type: "error" };
      }

      // Safe evaluation using Function
      const res = Function(`"use strict"; return (${sanitized})`)();
      if (typeof res === "number" && !isNaN(res) && isFinite(res)) {
        const formatted =
          Math.abs(res) >= 1000000 || (Math.abs(res) < 0.001 && res !== 0)
            ? res.toPrecision(6)
            : Number.isInteger(res)
            ? res.toLocaleString("en-US")
            : parseFloat(res.toFixed(4)).toLocaleString("en-US");
        return { result: formatted, type: "math" };
      }
      return { result: "...", type: "math" };
    } catch {
      return { result: "...", type: "math" };
    }
  };

  const evalResult = evaluate(query);

  const copyResult = () => {
    if (!evalResult.result || evalResult.type === "error" || evalResult.result === "...") return;
    const cleanText = evalResult.result.replace(/\s+/g, " ");

    navigator.clipboard?.writeText(cleanText).catch(() => {});
    invoke("clipboard_copy", { id: cleanText }).catch(() => {});

    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="calc-panel-card">
      {/* Top Search Input Box */}
      <div className="calc-input-box">
        <span className="calc-input-icon">
          <IconCalculator size={13} color="#38bdf8" />
        </span>
        <input
          id={inputId}
          type="text"
          className="calc-text-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Calculate or convert (e.g. 15% * 500, 100 usd to eur, 16 gb to mb)..."
          autoFocus
        />
        {query && (
          <button className="calc-clear-btn" onClick={() => setQuery("")} title="Clear">
            ×
          </button>
        )}
      </div>

      {/* Result Display Bar */}
      <div className="calc-result-row">
        <div className="calc-result-left">
          <span className="calc-equal-badge">
            <IconEqual size={11} color="#38bdf8" />
          </span>
          <span className={`calc-result-digits ${evalResult.type === "error" ? "error" : ""}`}>
            {evalResult.result}
          </span>
        </div>

        <button
          className={`calc-copy-btn ${copied ? "copied" : ""}`}
          onClick={copyResult}
          title="Copy result to clipboard"
        >
          {copied ? (
            <>
              <IconCheck size={11} color="#22c55e" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <IconClipboardCheck size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Preset Pills */}
      <div className="calc-presets-row">
        <span className="calc-preset-hint">
          <IconSparkles size={10} color="#94a3b8" />
          <span>Quick:</span>
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="calc-preset-pill"
            onClick={() => setQuery(p.query)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
