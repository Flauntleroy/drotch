//! To-do list sederhana, tersimpan lokal di todo.json.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::store;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub done: bool,
}

fn load(app: &AppHandle) -> Result<Vec<Task>, String> {
    store::read_json(app, "todo.json")
}

fn save(app: &AppHandle, tasks: &[Task]) -> Result<(), String> {
    store::write_json(app, "todo.json", tasks)
}

pub fn list(app: &AppHandle) -> Result<Vec<Task>, String> {
    load(app)
}

pub fn add(app: &AppHandle, title: &str) -> Result<Vec<Task>, String> {
    let title = title.trim();
    if title.is_empty() {
        return Err("Judul tugas tidak boleh kosong".to_string());
    }
    let mut tasks = load(app)?;
    let id = format!(
        "{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    );
    tasks.push(Task {
        id,
        title: title.to_string(),
        done: false,
    });
    save(app, &tasks)?;
    Ok(tasks)
}

pub fn toggle(app: &AppHandle, id: &str) -> Result<Vec<Task>, String> {
    let mut tasks = load(app)?;
    if let Some(t) = tasks.iter_mut().find(|t| t.id == id) {
        t.done = !t.done;
    }
    save(app, &tasks)?;
    Ok(tasks)
}

pub fn remove(app: &AppHandle, id: &str) -> Result<Vec<Task>, String> {
    let mut tasks = load(app)?;
    tasks.retain(|t| t.id != id);
    save(app, &tasks)?;
    Ok(tasks)
}
