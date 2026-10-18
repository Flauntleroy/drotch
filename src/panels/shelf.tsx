import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { IconFile, IconTrash, IconFolder } from "../components/Icons";

interface ShelfItem {
  name: string;
  path: string;
}

function useShelf() {
  const [items, setItems] = useState<ShelfItem[]>([]);

  useEffect(() => {
    invoke<ShelfItem[]>("shelf_list").then(setItems).catch(() => {});

    let unlisten: Promise<() => void> | null = null;
    unlisten = listen<{ paths: string[] }>("tauri://drag-drop", (e) => {
      const paths = e.payload?.paths ?? [];
      (async () => {
        for (const p of paths) {
          try {
            const updated = await invoke<ShelfItem[]>("shelf_add", { path: p });
            setItems(updated);
          } catch {
            /* ignore */
          }
        }
      })();
    });
    return () => {
      unlisten?.then((f) => f());
    };
  }, []);

  const remove = (path: string) =>
    invoke<ShelfItem[]>("shelf_remove", { path }).then(setItems).catch(() => {});
  const open = (path: string) => invoke("shelf_open", { path }).catch(() => {});

  return { items, remove, open };
}

export function ShelfMini() {
  const { items } = useShelf();
  return (
    <div className="mini-music-row">
      <span className="mini-icon">
        <IconFolder size={14} color="#38bdf8" />
      </span>
      <span className="mini-track-text">
        {items.length ? `${items.length} file di shelf` : "Drag file ke drotch"}
      </span>
    </div>
  );
}

export function ShelfPanel() {
  const { items, remove, open } = useShelf();

  return (
    <div className="shelf-widget-card">
      {items.length === 0 ? (
        <div className="shelf-drop-zone">
          <div className="drop-icon">
            <IconFolder size={26} color="#38bdf8" />
          </div>
          <div className="drop-title">Tarik & Lepas File ke Drotch</div>
          <div className="drop-subtitle">File akan tersimpan cepat di sini untuk akses instan</div>
        </div>
      ) : (
        <div className="shelf-items-grid">
          {items.map((it) => (
            <div key={it.path} className="shelf-card-item" title={it.path}>
              <button className="shelf-item-click" onClick={() => open(it.path)}>
                <span className="shelf-file-icon">
                  <IconFile size={15} color="#38bdf8" />
                </span>
                <span className="shelf-file-name">{it.name}</span>
              </button>
              <button
                className="shelf-remove-btn"
                onClick={() => remove(it.path)}
                title="Hapus dari shelf"
              >
                <IconTrash size={10} color="#f87171" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
