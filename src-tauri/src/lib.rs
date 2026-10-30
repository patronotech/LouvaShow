mod application;
mod assistant;
mod commands;
mod document_import;
mod domain;
mod infrastructure;
mod startup;
mod team;
mod updates;
use domain::presentation::Snapshot;
use infrastructure::database::Database;
use std::sync::{Arc, Mutex};

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .manage(startup::StartupState::default())
        .manage(team::TeamState::default())
        .manage(assistant::AssistantState::default())
        .manage(document_import::DocumentImportState::default())
        .manage(updates::UpdateState::default())
        .setup(|app| {
            startup::begin(app.handle().clone());
            Ok(())
        })
        .on_window_event(startup::window_event)
        .invoke_handler(tauri::generate_handler![
            updates::get_update_state,
            updates::check_for_updates,
            updates::download_update,
            updates::install_update,
            commands::charts::list_charts,
            commands::charts::get_chart,
            commands::charts::create_chart_document,
            commands::charts::save_chart,
            commands::charts::delete_chart,
            commands::charts::list_chart_revisions,
            commands::charts::import_chart,
            commands::charts::export_chart,
            commands::charts::export_chart_file,
            commands::charts::transpose_chart,
            commands::charts::suggest_chart_capos,
            commands::charts::suggest_chart_keys,
            commands::charts::publish_chart,
            document_import::document_import_config,
            document_import::document_import_save_config,
            document_import::document_import_set_key,
            document_import::document_import_remove_key,
            document_import::import_chart_document,
            assistant::assistant_config,
            assistant::assistant_save_config,
            assistant::assistant_set_key,
            assistant::assistant_remove_key,
            assistant::assistant_split,
            assistant::assistant_transcribe,
            assistant::assistant_rank_capo,
            team::team_interfaces,
            team::team_status,
            team::team_start,
            team::team_stop,
            team::team_refresh_avatar,
            team::team_users,
            team::team_save_user,
            team::team_devices,
            team::team_approve_device,
            team::team_revoke_device,
            startup::get_startup_state,
            startup::mark_operator_ready,
            startup::mark_operator_failed,
            startup::retry_startup,
            startup::complete_startup,
            startup::close_startup,
            commands::bible::list_bible_versions,
            commands::bible::list_bible_books,
            commands::bible::get_bible_chapter,
            commands::open_community_group,
            commands::open_author_website,
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
            commands::library::list_setlists,
            commands::library::select_setlist,
            commands::library::create_setlist,
            commands::library::rename_setlist,
            commands::library::delete_setlist,
            commands::library::add_setlist_item,
            commands::library::remove_setlist_item,
            commands::library::reorder_setlist
        ])
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o LouvaShow. Os dados não foram apagados.");
}
