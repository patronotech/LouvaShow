use crate::{
    domain::library::{Category, SaveSongInput, Setlist, Song},
    infrastructure::database::Database,
    AppState,
};
use tauri::State;
async fn run<T: Send + 'static>(
    state: &State<'_, AppState>,
    op: impl FnOnce(&mut Database) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = db
            .lock()
            .map_err(|_| "Banco indisponível. Reinicie o aplicativo.")?;
        op(&mut guard)
    })
    .await
    .map_err(|_| "Não foi possível concluir a operação no banco.".to_string())?
}
#[tauri::command]
pub async fn list_songs(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Vec<Song>, String> {
    super::operator(&window)?;
    run(&state, |db| db.list_songs()).await
}
#[tauri::command]
pub async fn save_song(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    input: SaveSongInput,
) -> Result<Song, String> {
    super::operator(&window)?;
    let cache = state.song_cache.clone();
    run(&state, move |db| {
        let song = db.save_song(input)?;
        // The database lock remains held through cache publication. A concurrent
        // cache miss cannot publish an older row after this update.
        cache
            .lock()
            .map_err(|_| "Cache indisponível")?
            .insert(song.id.clone(), song.clone());
        Ok(song)
    })
    .await
}
#[tauri::command]
pub async fn delete_song(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    super::operator(&window)?;
    let cache = state.song_cache.clone();
    run(&state, move |db| {
        db.delete_song(&id)?;
        // Invalidation shares the same DB -> cache lock order as cache fills.
        cache.lock().map_err(|_| "Cache indisponível")?.remove(&id);
        Ok(())
    })
    .await
}
#[tauri::command]
pub async fn song_usage(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
) -> Result<usize, String> {
    super::operator(&window)?;
    run(&state, move |db| db.song_usage(&id)).await
}
#[tauri::command]
pub async fn get_setlist(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Setlist, String> {
    super::operator(&window)?;
    run(&state, |db| db.get_setlist()).await
}
#[tauri::command]
pub async fn add_setlist_item(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    song_id: String,
) -> Result<Setlist, String> {
    super::operator(&window)?;
    run(&state, move |db| db.add_setlist_item(&song_id)).await
}
#[tauri::command]
pub async fn remove_setlist_item(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    item_id: String,
) -> Result<Setlist, String> {
    super::operator(&window)?;
    run(&state, move |db| db.remove_setlist_item(&item_id)).await
}
#[tauri::command]
pub async fn reorder_setlist(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> Result<Setlist, String> {
    super::operator(&window)?;
    run(&state, move |db| db.reorder_setlist(ordered_ids)).await
}

#[tauri::command]
pub async fn list_categories(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Vec<Category>, String> {
    super::operator(&window)?;
    run(&state, |db| db.list_categories()).await
}

#[tauri::command]
pub async fn create_category(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    name: String,
) -> Result<Category, String> {
    super::operator(&window)?;
    run(&state, move |db| db.create_category(&name)).await
}

#[tauri::command]
pub async fn rename_category(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<Category, String> {
    super::operator(&window)?;
    run(&state, move |db| db.rename_category(&id, &name)).await
}

#[tauri::command]
pub async fn bulk_set_category(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    ids: Vec<String>,
    category_id: String,
) -> Result<(), String> {
    super::operator(&window)?;
    let cache = state.song_cache.clone();
    run(&state, move |db| {
        db.bulk_set_category(&ids, &category_id)?;
        let mut cached = cache.lock().map_err(|_| "Cache indisponível")?;
        for id in ids {
            cached.remove(&id);
        }
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn bulk_song_usage(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<usize, String> {
    super::operator(&window)?;
    run(&state, move |db| db.bulk_song_usage(&ids)).await
}

#[tauri::command]
pub async fn bulk_delete_songs(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    super::operator(&window)?;
    let cache = state.song_cache.clone();
    run(&state, move |db| {
        db.bulk_delete_songs(&ids)?;
        let mut cached = cache.lock().map_err(|_| "Cache indisponível")?;
        for id in ids {
            cached.remove(&id);
        }
        Ok(())
    })
    .await
}
