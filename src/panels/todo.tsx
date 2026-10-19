import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconCheck, IconTrash, IconPlus, IconCoffee } from "../components/Icons";

interface Task {
  id: string;
  title: string;
  done: boolean;
}

function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    invoke<Task[]>("todo_list").then(setTasks).catch(() => {});
  }, []);

  const add = (title: string) =>
    invoke<Task[]>("todo_add", { title }).then(setTasks).catch(() => {});
  const toggle = (id: string) =>
    invoke<Task[]>("todo_toggle", { id }).then(setTasks).catch(() => {});
  const remove = (id: string) =>
    invoke<Task[]>("todo_delete", { id }).then(setTasks).catch(() => {});

  return { tasks, add, toggle, remove };
}

export function TodoMini() {
  const { tasks } = useTasks();
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="mini-music-row">
      <span className="mini-icon">
        <IconCheck size={12} color="#22c55e" />
      </span>
      <span className="mini-track-text">
        {tasks.length ? `${done}/${tasks.length} tasks completed` : "No tasks"}
      </span>
    </div>
  );
}

export function TodoPanel() {
  const { tasks, add, toggle, remove } = useTasks();
  const [input, setInput] = useState("");

  const submit = () => {
    if (!input.trim()) return;
    add(input.trim());
    setInput("");
  };

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="todo-widget-card">
      <div className="todo-header-bar">
        <span className="todo-stat-badge">
          {doneCount}/{tasks.length} Done
        </span>
        <div className="todo-input-wrap">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Add new task… (Enter)"
          />
          <button className="todo-add-btn" onClick={submit} title="Add task">
            <IconPlus size={13} color="#ffffff" />
          </button>
        </div>
      </div>

      <div className="todo-items-scroll">
        {tasks.length === 0 ? (
          <div className="todo-empty-state">
            <IconCoffee size={13} color="#64748b" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "5px" }} />
            All tasks completed. Time to relax!
          </div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className={`todo-item-row ${t.done ? "is-done" : ""}`}>
              <button
                className={`todo-checkbox-custom ${t.done ? "checked" : ""}`}
                onClick={() => toggle(t.id)}
                title={t.done ? "Mark uncompleted" : "Mark completed"}
              >
                {t.done && <IconCheck size={10} color="#ffffff" />}
              </button>
              <span className="todo-title-text" onClick={() => toggle(t.id)}>
                {t.title}
              </span>
              <button
                className="todo-delete-btn"
                onClick={() => remove(t.id)}
                title="Delete task"
              >
                <IconTrash size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
