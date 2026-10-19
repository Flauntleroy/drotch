import React, { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  IconCheck,
  IconCopy,
  IconTrash,
  IconPin,
  IconSearch,
  IconClipboard,
} from "../components/Icons";

export interface ClipboardItem {
  id: string;
  content: string;
  preview: string;
  kind: "text" | "url" | "code" | "color" | string;
  char_count: number;
  line_count: number;
  timestamp: number;
  pinned: boolean;
}

function formatRelativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return "Baru saja";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}j lalu`;
  return `${Math.floor(diffSec / 86400)}h lalu`;
}

export function useClipboard() {
  const [items, setItems] = useState<ClipboardItem[]>([]);

  useEffect(() => {
    invoke<ClipboardItem[]>("clipboard_list")
      .then(setItems)
      .catch(() => {});

    let unlisten: (() => void) | null = null;
    listen<ClipboardItem[]>("clipboard-updated", (event) => {
      if (event.payload) {
        setItems(event.payload);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const copy = async (id: string) => {
    await invoke("clipboard_copy", { id });
  };

  const togglePin = async (id: string) => {
    const updated = await invoke<ClipboardItem[]>("clipboard_toggle_pin", { id });
    setItems(updated);
  };

  const remove = async (id: string) => {
    const updated = await invoke<ClipboardItem[]>("clipboard_delete", { id });
    setItems(updated);
  };

  const clearAll = async () => {
    const updated = await invoke<ClipboardItem[]>("clipboard_clear", { clearPinned: false });
    setItems(updated);
  };

  return { items, copy, togglePin, remove, clearAll };
}

export function ClipboardMini() {
  const { items } = useClipboard();
  const latest = items[0];

  return (
    <div className="mini-music-row">
      <span className="mini-icon">
        <IconClipboard size={14} color="#38bdf8" />
      </span>
      <span className="mini-track-text">
        {latest ? latest.preview.slice(0, 32) : "Clipboard kosong"}
      </span>
    </div>
  );
}

export function ClipboardPanel() {
  const { items, copy, togglePin, remove, clearAll } = useClipboard();
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "text" | "url" | "code" | "color">("all");

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeFilter !== "all") {
      list = list.filter((i) => i.kind === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.content.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeFilter, search]);

  const handleCopy = (item: ClipboardItem) => {
    copy(item.id);
    setCopiedId(item.id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1600);
  };

  return (
    <div className="clipboard-widget-card">
      {/* Top Header Bar */}
      <div className="clipboard-header-bar">
        <div className="clipboard-stats-wrap">
          <span className="clipboard-badge-count">
            {items.length} Klip
          </span>

          {/* Filter Pills */}
          <div className="clipboard-filter-pills">
            <button
              className={`clip-pill ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              Semua
            </button>
            <button
              className={`clip-pill ${activeFilter === "text" ? "active" : ""}`}
              onClick={() => setActiveFilter("text")}
            >
              Teks
            </button>
            <button
              className={`clip-pill ${activeFilter === "url" ? "active" : ""}`}
              onClick={() => setActiveFilter("url")}
            >
              Link
            </button>
            <button
              className={`clip-pill ${activeFilter === "code" ? "active" : ""}`}
              onClick={() => setActiveFilter("code")}
            >
              Kode
            </button>
            <button
              className={`clip-pill ${activeFilter === "color" ? "active" : ""}`}
              onClick={() => setActiveFilter("color")}
            >
              Warna
            </button>
          </div>
        </div>

        {/* Search input + Clear all button */}
        <div className="clipboard-actions-wrap">
          <div className="clipboard-search-input">
            <IconSearch size={11} color="#64748b" />
            <input
              type="text"
              placeholder="Cari klip…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {items.length > 0 && (
            <button
              className="clipboard-clear-btn"
              onClick={clearAll}
              title="Bersihkan riwayat (kecuali yang di-pin)"
            >
              <IconTrash size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Clips List */}
      <div className="clipboard-items-scroll">
        {filteredItems.length === 0 ? (
          <div className="clipboard-empty-state">
            {search
              ? "Tidak ada klip yang cocok dengan pencarian."
              : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <IconClipboard size={13} color="#64748b" />
                  <span>Belum ada riwayat clipboard. Salin teks apa saja di PC Anda.</span>
                </div>
              )}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isJustCopied = copiedId === item.id;

            return (
              <div
                key={item.id}
                className={`clipboard-item-row ${item.pinned ? "is-pinned" : ""} ${
                  isJustCopied ? "is-copied" : ""
                }`}
                onClick={() => handleCopy(item)}
                title="Klik untuk menyalin kembali ke clipboard"
              >
                {/* Kind indicator */}
                <div className="clip-kind-indicator">
                  {item.kind === "color" ? (
                    <span
                      className="clip-color-dot"
                      style={{ backgroundColor: item.content.trim() }}
                    />
                  ) : item.kind === "url" ? (
                    <span className="clip-type-tag url">URL</span>
                  ) : item.kind === "code" ? (
                    <span className="clip-type-tag code">{"{ }"}</span>
                  ) : (
                    <span className="clip-type-tag txt">Aa</span>
                  )}
                </div>

                {/* Main Content Preview */}
                <div className="clip-content-col">
                  <div className="clip-preview-text">{item.preview}</div>
                  <div className="clip-meta-row">
                    <span className="clip-meta-time">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                    <span className="clip-meta-dot">•</span>
                    <span className="clip-meta-chars">
                      {item.char_count} kar
                    </span>
                    {item.line_count > 1 && (
                      <>
                        <span className="clip-meta-dot">•</span>
                        <span className="clip-meta-chars">
                          {item.line_count} baris
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Copied Feedback Badge or Row Actions */}
                <div className="clip-actions-col">
                  {isJustCopied ? (
                    <div className="clip-copied-badge">
                      <IconCheck size={11} color="#22c55e" />
                      <span>Tersalin!</span>
                    </div>
                  ) : (
                    <div className="clip-hover-buttons">
                      <button
                        className={`clip-btn-icon pin ${item.pinned ? "active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(item.id);
                        }}
                        title={item.pinned ? "Lepas pin" : "Pin ke atas"}
                      >
                        <IconPin size={11} color={item.pinned ? "#38bdf8" : "currentColor"} />
                      </button>

                      <button
                        className="clip-btn-icon copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(item);
                        }}
                        title="Salin ke clipboard"
                      >
                        <IconCopy size={11} />
                      </button>

                      <button
                        className="clip-btn-icon delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(item.id);
                        }}
                        title="Hapus klip ini"
                      >
                        <IconTrash size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
