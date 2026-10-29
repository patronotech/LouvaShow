mod application;
mod commands;
mod domain;
mod infrastructure;
use domain::presentation::Snapshot;
use infrastructure::database::Database;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub struct AppState {
    db: Arc<Mutex<Database>>,
    presentation: Mutex<Snapshot>,
    song_cache: Arc<Mutex<std::collections::HashMap<String, domain::library::Song>>>,
    display_gate: Mutex<()>,
    output: Mutex<commands::displays::Output>,
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            #[allow(unused_mut)]
            let mut db =
                Database::open(dir.join("louvashow.sqlite3")).map_err(std::io::Error::other)?;
            #[cfg(feature = "bundled-hymns")]
            if db
                .get_setting("seed-pack.hc-640-v1")
                .map_err(std::io::Error::other)?
                .is_none()
            {
                let pack =
                    application::song_exchange::preview(vec![domain::importing::ImportFile {
                        name: "hc_xml.zip".into(),
                        bytes: include_bytes!("../resources/hc_xml.zip").to_vec(),
                    }])
                    .map_err(std::io::Error::other)?;
                db.install_seed_pack("hc-640-v1", pack.songs, "hinos")
                    .map_err(std::io::Error::other)?;
            }
            let mut snapshot = Snapshot::default();
            if let Some(raw) = db.get_setting("theme.v1").map_err(std::io::Error::other)? {
                let theme: domain::presentation::Theme = serde_json::from_str(&raw)?;
                theme.validate().map_err(std::io::Error::other)?;
                snapshot.theme = theme;
            }
            app.manage(AppState {
                db: Arc::new(Mutex::new(db)),
                presentation: Mutex::new(snapshot),
                song_cache: Arc::new(Mutex::new(Default::default())),
                display_gate: Mutex::new(()),
                output: Mutex::new(Default::default()),
            });
            commands::displays::watch_monitors(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::library::list_categories,
            commands::library::create_category,
            commands::library::rename_category,
            commands::library::bulk_set_category,
            commands::library::bulk_song_usage,
            commands::library::bulk_delete_songs,
            commands::exchange::preview_import,
            commands::exchange::import_songs,
            commands::exchange::export_songs,
            commands::get_snapshot,
            commands::presentation_action,
            commands::displays::list_monitors,
            commands::displays::open_projection,
            commands::displays::projection_fullscreen,
            commands::displays::projection_status,
            commands::library::list_songs,
            commands::library::save_song,
            commands::library::delete_song,
            commands::library::song_usage,
            commands::library::get_setlist,
            commands::library::add_setlist_item,
            commands::library::remove_setlist_item,
            commands::library::reorder_setlist
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o LouvaShow. Os dados não foram apagados.");
}
