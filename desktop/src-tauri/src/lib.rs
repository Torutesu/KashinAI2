// KashinAI2 desktop (Tauri v2).
//
// Bundle-型: the compiled Node engine (dist + node_modules + prisma + public) is
// shipped inside the .app as a resource under `engine/`. On launch we spawn it
// as a child process, pointing its SQLite DB / LanceDB index at a writable
// app-data directory, then the window loads the local dashboard once it's up.
// A menubar tray gives Open / Quit, and the child is killed on exit.

use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;

use rand::Rng;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, RunEvent, WindowEvent};

/// Holds the spawned engine process so we can terminate it on exit.
struct EngineProcess(Mutex<Option<Child>>);

/// macOS GUI apps inherit a minimal PATH that usually omits Homebrew/nvm, so
/// look for `node` in the common install locations (and honor an override).
fn find_node() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("KASHINAI_NODE") {
        let p = PathBuf::from(explicit);
        if p.exists() {
            return Some(p);
        }
    }
    let candidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for c in candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    // Fall back to PATH resolution.
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            let p = dir.join("node");
            if p.exists() {
                return Some(p);
            }
        }
    }
    None
}

/// Persist a stable API token in the app-data dir so management routes work and
/// the token survives restarts (generated once on first launch).
fn ensure_token(data_dir: &PathBuf) -> String {
    let token_path = data_dir.join("token.txt");
    if let Ok(existing) = std::fs::read_to_string(&token_path) {
        let t = existing.trim().to_string();
        if !t.is_empty() {
            return t;
        }
    }
    let token: String = {
        let mut rng = rand::thread_rng();
        (0..40)
            .map(|_| {
                let chars = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                chars[rng.gen_range(0..chars.len())] as char
            })
            .collect()
    };
    let _ = std::fs::write(&token_path, &token);
    token
}

fn spawn_engine(app: &tauri::AppHandle) -> Result<Child, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {e}"))?;
    // The bundler may place resources at `<res>/engine` or `<res>/resources/engine`
    // depending on config; accept either so we don't depend on that detail.
    let candidates = [resource_dir.join("engine"), resource_dir.join("resources").join("engine")];
    let engine_dir = candidates
        .iter()
        .find(|d| d.join("launch.mjs").exists())
        .cloned()
        .ok_or_else(|| format!("engine not found under {}", resource_dir.display()))?;
    let launcher = engine_dir.join("launch.mjs");

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&data_dir).map_err(|e| format!("create data dir: {e}"))?;

    // Prefer the Node runtime bundled inside the app; fall back to a system node.
    let bundled_node = engine_dir.join("node").join("bin").join("node");
    let node = if bundled_node.exists() {
        bundled_node
    } else {
        find_node().ok_or_else(|| {
            "Node.js was not found. Install Node 22+ (e.g. `brew install node`) and relaunch.".to_string()
        })?
    };

    let token = ensure_token(&data_dir);
    let db_url = format!("file:{}", data_dir.join("kashinai.db").display());
    let lancedb = data_dir.join("lancedb");
    let google_token = data_dir.join("google_token.json");

    Command::new(node)
        .arg(&launcher)
        .current_dir(&engine_dir)
        .env("PORT", "3001")
        .env("DATABASE_URL", db_url)
        .env("LANCEDB_PATH", lancedb)
        .env("GOOGLE_TOKEN_PATH", google_token)
        .env("API_TOKEN", token)
        .env("NODE_ENV", "production")
        .spawn()
        .map_err(|e| format!("failed to start engine: {e}"))
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// The engine's API token (generated on first launch). The loader passes this to
/// the dashboard so management features work without the user hunting for the file.
#[tauri::command]
fn engine_token(app: tauri::AppHandle) -> String {
    if let Ok(dir) = app.path().app_data_dir() {
        if let Ok(t) = std::fs::read_to_string(dir.join("token.txt")) {
            return t.trim().to_string();
        }
    }
    String::new()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(EngineProcess(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![engine_token])
        .setup(|app| {
            let handle = app.handle().clone();
            match spawn_engine(&handle) {
                Ok(child) => {
                    let state = app.state::<EngineProcess>();
                    *state.0.lock().unwrap() = Some(child);
                }
                Err(e) => {
                    eprintln!("[KashinAI2] {e}");
                }
            }

            let open = MenuItemBuilder::with_id("open", "Open Dashboard").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit KashinAI2").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&open, &quit]).build()?;

            let mut tray_builder = TrayIconBuilder::with_id("main");
            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }
            let _tray = tray_builder
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_main_window(app),
                    "quit" => {
                        if let Some(state) = app.try_state::<EngineProcess>() {
                            if let Some(mut child) = state.0.lock().unwrap().take() {
                                let _ = child.kill();
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window hides it (app keeps running in the tray).
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building KashinAI2")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<EngineProcess>() {
                    if let Some(mut child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
