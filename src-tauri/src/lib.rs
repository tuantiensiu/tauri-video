// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::{webview::WebviewWindowBuilder, WebviewUrl};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port: u16 = 3131;
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        // .plugin(tauri_plugin_localhost::Builder::new(port).build())
        // .setup(move |app| {
        //     let url = format!("http://localhost:{}", port).parse().unwrap();
        //     WebviewWindowBuilder::new(app, "main".to_string(), WebviewUrl::External(url))
        //         .title("Localhost Example")
        //         .build()?;
        //     Ok(())
        // })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
