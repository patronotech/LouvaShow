use crate::{
    application::song_exchange,
    domain::importing::{ImportFile, ImportPreview, ImportResult, ImportSong},
    AppState,
};
use tauri::State;
use tauri_plugin_dialog::DialogExt;
#[tauri::command]
pub async fn preview_import(
    window: tauri::WebviewWindow,
    files: Vec<ImportFile>,
) -> Result<ImportPreview, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || song_exchange::preview(files))
        .await
        .map_err(|_| "Falha ao analisar os arquivos.".to_string())?
}
#[tauri::command]
pub async fn import_songs(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    mut songs: Vec<ImportSong>,
    category_id: String,
) -> Result<ImportResult, String> {
    super::operator(&window)?;
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if songs.is_empty() || songs.len() > 5000 {
            return Err("Importe entre 1 e 5.000 músicas por lote.".into());
        }
        let size = songs
            .iter()
            .map(|s| {
                s.title.len()
                    + s.artist.as_ref().map_or(0, |v| v.len())
                    + s.copyright.as_ref().map_or(0, |v| v.len())
                    + s.blocks
                        .iter()
                        .map(|b| b.text.len() + b.label.as_ref().map_or(0, |v| v.len()))
                        .sum::<usize>()
            })
            .sum::<usize>();
        if size > 24 * 1024 * 1024 {
            return Err("O lote excede 24 MiB.".into());
        }
        for song in &mut songs {
            song_exchange::validate_song(song)?;
        }
        db.lock()
            .map_err(|_| "Banco indisponível")?
            .import_songs(songs, &category_id)
    })
    .await
    .map_err(|_| "Falha ao importar músicas.".to_string())?
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    file_name: String,
    count: usize,
}
#[tauri::command]
pub async fn export_songs(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    ids: Vec<String>,
    format: String,
) -> Result<Option<ExportResult>, String> {
    super::operator(&window)?;
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if ids.is_empty() || ids.len() > 5000 {
            return Err("Selecione entre 1 e 5.000 músicas.".into());
        }
        let ext = match format.as_str() {
            "json" => "json",
            "openlyrics" => "zip",
            _ => return Err("Formato de exportação inválido.".into()),
        };
        let (songs, categories) = {
            let db = db.lock().map_err(|_| "Banco indisponível")?;
            let mut seen = std::collections::HashSet::new();
            let songs = ids
                .into_iter()
                .filter(|id| seen.insert(id.clone()))
                .map(|id| db.get_song(&id))
                .collect::<Result<Vec<_>, _>>()?;
            let categories = db
                .list_categories()?
                .into_iter()
                .map(|c| (c.id, c.name))
                .collect();
            (songs, categories)
        };
        let count = songs.len();
        let bytes = song_exchange::export(songs, categories, &format)?;
        let default_name = format!("LouvaShow-musicas.{ext}");
        let Some(file) = app
            .dialog()
            .file()
            .set_title("Exportar músicas do LouvaShow")
            .add_filter("Músicas", &[ext])
            .set_file_name(&default_name)
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Escolha um caminho local para salvar.")?;
        if path.extension().and_then(|v| v.to_str()) != Some(ext) {
            return Err(format!(
                "Salve com a extensão .{ext}. Nenhum arquivo foi alterado."
            ));
        }
        let parent = path.parent().ok_or("Pasta de destino inválida")?;
        let mut tmp = tempfile::NamedTempFile::new_in(parent)
            .map_err(|_| "Não foi possível criar arquivo na pasta escolhida.")?;
        use std::io::Write;
        tmp.write_all(&bytes)
            .and_then(|_| tmp.as_file().sync_all())
            .map_err(|_| "Não foi possível gravar a exportação. Verifique o espaço em disco.")?;
        tmp.persist(&path).map_err(|_| {
            "Não foi possível concluir a exportação. O arquivo anterior foi preservado."
        })?;
        Ok(Some(ExportResult {
            file_name: path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or(default_name),
            count,
        }))
    })
    .await
    .map_err(|_| "Falha ao exportar músicas.".to_string())?
}
