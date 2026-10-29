pub mod displays;
pub mod exchange;
pub mod library;
use crate::{
    domain::presentation::{Action, Snapshot},
    AppState,
};
use tauri::{Emitter, Manager, State};
pub fn operator(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "operator" {
        Err("Operação permitida somente na janela do operador.".into())
    } else {
        Ok(())
    }
}
#[tauri::command]
pub fn get_snapshot(state: State<AppState>) -> Result<Snapshot, String> {
    Ok(state
        .presentation
        .lock()
        .map_err(|_| "Estado da apresentação indisponível. Reinicie o aplicativo.")?
        .clone())
}
#[tauri::command]
pub async fn presentation_action(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    action: Action,
) -> Result<Snapshot, String> {
    operator(&window)?;
    let song = if let Action::Present { song_id, .. } = &action {
        if !app
            .get_webview_window("projection")
            .is_some_and(|w| w.is_visible().unwrap_or(false))
        {
            return Err("Abra a projeção antes de apresentar um trecho.".into());
        }
        let cached = state
            .song_cache
            .lock()
            .map_err(|_| "Cache indisponível")?
            .get(song_id)
            .cloned();
        if let Some(song) = cached {
            Some(song)
        } else {
            let db = state.db.clone();
            let cache = state.song_cache.clone();
            let id = song_id.clone();
            let song = tauri::async_runtime::spawn_blocking(move || {
                let database = db.lock().map_err(|_| "Banco indisponível")?;
                // Recheck after acquiring DB: another reader/save may already
                // have populated the cache while this worker was waiting.
                if let Some(song) = cache
                    .lock()
                    .map_err(|_| "Cache indisponível")?
                    .get(&id)
                    .cloned()
                {
                    return Ok::<_, String>(song);
                }
                let song = database.get_song(&id)?;
                cache
                    .lock()
                    .map_err(|_| "Cache indisponível")?
                    .insert(song.id.clone(), song.clone());
                Ok(song)
            })
            .await
            .map_err(|_| "Falha ao preparar música")??;
            Some(song)
        }
    } else {
        None
    };
    if let Action::Theme { theme } = &action {
        theme.validate()?;
        let value = serde_json::to_string(theme).map_err(|_| "Não foi possível salvar o tema")?;
        let db = state.db.clone();
        tauri::async_runtime::spawn_blocking(move || {
            db.lock()
                .map_err(|_| "Banco indisponível")?
                .set_setting("theme.v1", &value)
        })
        .await
        .map_err(|_| "Não foi possível salvar o tema")??;
    }
    let mut s = state
        .presentation
        .lock()
        .map_err(|_| "Estado da apresentação indisponível")?;
    match action {
        Action::Present { block_id, .. } => {
            s.present(song.ok_or("Música indisponível")?, &block_id)?
        }
        Action::Next => s.navigate(true),
        Action::Previous => s.navigate(false),
        Action::ToggleBlank => s.toggle_blank(),
        Action::Theme { theme } => s.apply_theme(theme)?,
    }
    let snapshot = s.clone();
    drop(s);
    // Receivers discard older revisions, so native dispatch never holds the coordinator lock.
    app.emit("presentation:snapshot", &snapshot)
        .map_err(|_| "Estado salvo, mas a comunicação falhou. Reabra a projeção.".to_string())?;
    Ok(snapshot)
}
