pub mod bible;
pub mod charts;
pub mod displays;
pub mod exchange;
pub mod library;
use crate::{
    domain::presentation::{Action, Snapshot},
    AppState,
};
use tauri::{Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
pub fn operator(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "operator" {
        Err("Operação permitida somente na janela do operador.".into())
    } else {
        Ok(())
    }
}

/// Only fixed public URLs can cross the native opener boundary. Neither
/// URLs nor executable/application names are accepted from the webview.
#[tauri::command]
pub async fn open_community_group(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<(), String> {
    operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.opener()
            .open_url(
                "https://chat.whatsapp.com/FTsYpsy6YbG8Z3gDI2u1Bp?mode=gi_t",
                None::<&str>,
            )
            .map_err(|_| "Não foi possível abrir o navegador. Tente novamente ou use o link disponível no README do projeto.".to_string())
    })
    .await
    .map_err(|_| "Não foi possível abrir o grupo da comunidade.".to_string())?
}

#[tauri::command]
pub async fn open_author_contact(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<(), String> {
    operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.opener()
            .open_url("https://wa.me/5519998021956", None::<&str>)
            .map_err(|_| {
                "Não foi possível abrir o WhatsApp. Tente novamente ou acesse o site do autor."
                    .to_string()
            })
    })
    .await
    .map_err(|_| "Não foi possível abrir o contato do autor.".to_string())?
}

#[tauri::command]
pub async fn open_author_website(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
) -> Result<(), String> {
    operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        app.opener()
            .open_url("https://www.dantetesta.com.br", None::<&str>)
            .map_err(|_| {
                "Não foi possível abrir o navegador. Acesse www.dantetesta.com.br manualmente."
                    .to_string()
            })
    })
    .await
    .map_err(|_| "Não foi possível abrir o site do autor.".to_string())?
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
    if matches!(
        &action,
        Action::Present { .. } | Action::PresentBible { .. }
    ) && !app
        .get_webview_window("projection")
        .is_some_and(|w| w.is_visible().unwrap_or(false))
    {
        return Err("Abra a projeção antes de apresentar um trecho.".into());
    }
    if let Action::Present { song_id, .. } = &action {
        let cached = state
            .song_cache
            .lock()
            .map_err(|_| "Cache indisponível")?
            .contains_key(song_id);
        if !cached {
            let db = state.db.clone();
            let cache = state.song_cache.clone();
            let id = song_id.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let database = db.lock().map_err(|_| "Banco indisponível")?;
                // Recheck after acquiring DB: another reader/save may already
                // have populated the cache while this worker was waiting.
                let mut cache = cache.lock().map_err(|_| "Cache indisponível")?;
                if !cache.contains_key(&id) {
                    let song = database.get_song(&id)?;
                    cache.insert(song.id.clone(), song);
                }
                Ok::<_, String>(())
            })
            .await
            .map_err(|_| "Falha ao preparar música")??;
        }
    }
    let prepared_bible = if let Action::PresentBible {
        version_id,
        book_id,
        chapter,
        verse,
    } = &action
    {
        let (version_id, book_id, chapter, verse) =
            (version_id.clone(), book_id.clone(), *chapter, verse.clone());
        Some(
            tauri::async_runtime::spawn_blocking(move || {
                crate::application::bible::prepare(&version_id, &book_id, chapter, &verse)
            })
            .await
            .map_err(|_| "Não foi possível preparar o trecho bíblico.")??,
        )
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
    // Re-read the cache while holding it through snapshot creation. A concurrent
    // block-style/lyric save cannot publish a newer cache and then be overwritten
    // by an older song clone that this request prepared earlier.
    let cached_songs = if matches!(&action, Action::Present { .. }) {
        Some(state.song_cache.lock().map_err(|_| "Cache indisponível")?)
    } else {
        None
    };
    let song = if let Action::Present { song_id, .. } = &action {
        Some(
            cached_songs
                .as_ref()
                .and_then(|cache| cache.get(song_id))
                .cloned()
                .ok_or("A música foi alterada ou excluída. Selecione o trecho novamente.")?,
        )
    } else {
        None
    };
    let mut s = state
        .presentation
        .lock()
        .map_err(|_| "Estado da apresentação indisponível")?;
    match action {
        Action::Present { block_id, .. } => {
            s.present(song.ok_or("Música indisponível")?, &block_id)?
        }
        Action::PresentBible { .. } => {
            s.present_bible(prepared_bible.ok_or("Trecho bíblico indisponível.")?)?
        }
        Action::Next => s.navigate(true),
        Action::Previous => s.navigate(false),
        Action::ToggleBlank => s.toggle_blank(),
        Action::Theme { theme } => s.apply_theme(theme)?,
    }
    let snapshot = s.clone();
    drop(s);
    drop(cached_songs);
    // Receivers discard older revisions, so native dispatch never holds the coordinator lock.
    app.emit("presentation:snapshot", &snapshot)
        .map_err(|_| "Estado salvo, mas a comunicação falhou. Reabra a projeção.".to_string())?;
    Ok(snapshot)
}
