use serde_json::{json, Value};
use tauri::{Manager, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::{mpsc, Mutex};

struct SidecarState {
    child: Mutex<CommandChild>,
    stdout_rx: Mutex<mpsc::Receiver<String>>,
}

#[tauri::command]
async fn evaluate_macro(
    payload: Value,
    state: State<'_, SidecarState>,
) -> Result<Value, String> {
    let request = json!({
        "action": "evaluate",
        "payload": payload
    });
    let line = format!("{}\n", request);

    {
        let mut child = state.child.lock().await;
        child
            .write(line.as_bytes())
            .map_err(|e| format!("Failed writing to Python sidecar: {e}"))?;
    }

    let mut rx = state.stdout_rx.lock().await;
    let response_line = rx
        .recv()
        .await
        .ok_or_else(|| "Python sidecar exited unexpectedly".to_string())?;

    serde_json::from_str(&response_line)
        .map_err(|e| format!("Invalid JSON from sidecar: {e}"))
}

#[tauri::command]
async fn fetch_moonraker_snapshot(base_url: String) -> Result<Value, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let url = format!(
        "{trimmed}/printer/objects/query?configfile&toolhead&extruder&heater_bed&gcode_move"
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Could not reach Moonraker at {trimmed}: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Moonraker returned HTTP {}", resp.status()));
    }

    resp.json::<Value>()
        .await
        .map_err(|e| format!("Invalid JSON from Moonraker: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let sidecar_cmd = app
                .shell()
                .sidecar("macro-engine")
                .expect("failed to create macro-engine sidecar command");

            let (mut rx, child) = sidecar_cmd
                .spawn()
                .expect("failed to spawn macro-engine sidecar");

            let (tx, stdout_rx) = mpsc::channel::<String>(32);

            tauri::async_runtime::spawn(async move {
                let mut buffer = String::new();
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(bytes) = event {
                        if let Ok(chunk) = String::from_utf8(bytes) {
                            buffer.push_str(&chunk);
                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].trim().to_string();
                                buffer.drain(..=pos);
                                if !line.is_empty() {
                                    let _ = tx.send(line).await;
                                }
                            }
                        }
                    }
                }
            });

            app.manage(SidecarState {
                child: Mutex::new(child),
                stdout_rx: Mutex::new(stdout_rx),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            evaluate_macro,
            fetch_moonraker_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
