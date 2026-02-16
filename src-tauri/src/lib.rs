use tauri::Manager;
use std::sync::Mutex;
use std::process::{Command, Child};

struct ServerProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let project_dir = "/Users/adriandrew/Desktop/operator-os";

            // Check if port 3000 is already in use (e.g. dev server running)
            let server_already_running = std::net::TcpStream::connect("127.0.0.1:3000").is_ok();

            let child = if !server_already_running {
                Command::new("/usr/local/bin/npm")
                    .args(["run", "start"])
                    .current_dir(project_dir)
                    .env("PATH", "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin")
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
                    .ok()
            } else {
                None
            };

            let state = app.state::<ServerProcess>();
            *state.0.lock().unwrap() = child;

            // Wait for server to be ready, then navigate the webview to it
            let webview = app.get_webview_window("main").unwrap();
            if !server_already_running {
                std::thread::spawn(move || {
                    let delay = std::time::Duration::from_millis(500);
                    for _ in 0..60 {
                        if std::net::TcpStream::connect("127.0.0.1:3000").is_ok() {
                            std::thread::sleep(std::time::Duration::from_millis(1500));
                            let url: tauri::Url = "http://localhost:3000".parse().unwrap();
                            let _ = webview.navigate(url);
                            return;
                        }
                        std::thread::sleep(delay);
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _: Result<(), _> = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
