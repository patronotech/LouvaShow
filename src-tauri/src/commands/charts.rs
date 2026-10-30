use crate::{
    application::charts as engine, domain::charts::*, infrastructure::database::Database, AppState,
};
use tauri::State;
use tauri_plugin_dialog::DialogExt;
async fn run<T: Send + 'static>(
    state: &State<'_, AppState>,
    op: impl FnOnce(&mut Database) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut db = db
            .lock()
            .map_err(|_| "Banco indisponível. Reinicie o aplicativo.")?;
        op(&mut db)
    })
    .await
    .map_err(|_| "Não foi possível concluir a operação com cifras.".to_string())?
}
#[tauri::command]
pub async fn list_charts(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    song_id: Option<String>,
) -> Result<Vec<ChartSummary>, String> {
    super::operator(&window)?;
    run(&state, move |db| {
        db.list_charts(&ChartActor::desktop(), song_id.as_deref())
    })
    .await
}
#[tauri::command]
pub async fn get_chart(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
    revision: Option<u64>,
) -> Result<Chart, String> {
    super::operator(&window)?;
    run(&state, move |db| {
        db.get_chart(&ChartActor::desktop(), &id, revision)
    })
    .await
}
#[tauri::command]
pub async fn create_chart_document(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    song_id: String,
) -> Result<ChartDocument, String> {
    super::operator(&window)?;
    run(&state, move |db| {
        Ok(engine::document_from_song(&db.get_song(&song_id)?))
    })
    .await
}
#[tauri::command]
pub async fn save_chart(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    input: SaveChartInput,
) -> Result<Chart, String> {
    super::operator(&window)?;
    run(&state, move |db| {
        db.save_chart(&ChartActor::desktop(), input)
    })
    .await
}
#[tauri::command]
pub async fn delete_chart(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
    expected_revision: u64,
) -> Result<(), String> {
    super::operator(&window)?;
    run(&state, move |db| {
        db.delete_chart(&ChartActor::desktop(), &id, expected_revision)
    })
    .await
}
#[tauri::command]
pub async fn list_chart_revisions(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<ChartRevision>, String> {
    super::operator(&window)?;
    run(&state, move |db| {
        db.list_chart_revisions(&ChartActor::desktop(), &id)
    })
    .await
}
#[tauri::command]
pub async fn import_chart(
    window: tauri::WebviewWindow,
    text: String,
    format: String,
) -> Result<ChartImportResult, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || match format.as_str() {
        "chordpro" => engine::import_chordpro(&text),
        "text" => engine::import_text(&text),
        _ => Err("Formato de cifra não suportado. Use ChordPro ou texto.".into()),
    })
    .await
    .map_err(|_| "Não foi possível importar a cifra.".to_string())?
}
#[tauri::command]
pub async fn export_chart(
    window: tauri::WebviewWindow,
    document: ChartDocument,
) -> Result<String, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || engine::export_chordpro(&document))
        .await
        .map_err(|_| "Não foi possível exportar a cifra.".to_string())?
}
#[tauri::command]
pub async fn export_chart_file(
    window: tauri::WebviewWindow,
    app: tauri::AppHandle,
    document: ChartDocument,
) -> Result<Option<ChartFileResult>, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let text = engine::export_chordpro(&document)?;
        let Some(file) = app
            .dialog()
            .file()
            .set_title("Exportar cifra")
            .add_filter("ChordPro", &["cho", "chordpro", "pro"])
            .set_file_name("LouvaShow-cifra.cho")
            .blocking_save_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Escolha um caminho local para salvar.")?;
        if !path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| {
                matches!(
                    ext.to_ascii_lowercase().as_str(),
                    "cho" | "chordpro" | "pro"
                )
            })
        {
            return Err(
                "Salve com extensão .cho, .chordpro ou .pro. Nenhum arquivo foi alterado.".into(),
            );
        }
        let mut temporary =
            tempfile::NamedTempFile::new_in(path.parent().ok_or("Pasta de destino inválida.")?)
                .map_err(|_| "Não foi possível criar arquivo na pasta escolhida.")?;
        use std::io::Write;
        temporary
            .write_all(text.as_bytes())
            .and_then(|_| temporary.as_file().sync_all())
            .map_err(|_| "Não foi possível gravar a cifra. Verifique o espaço em disco.")?;
        temporary.persist(&path).map_err(|_| {
            "Não foi possível concluir a exportação. O arquivo anterior foi preservado."
        })?;
        Ok(Some(ChartFileResult {
            file_name: path
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_else(|| "LouvaShow-cifra.cho".into()),
        }))
    })
    .await
    .map_err(|_| "Falha ao exportar cifra.".to_string())?
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartFileResult {
    file_name: String,
}
#[tauri::command]
pub async fn transpose_chart(
    window: tauri::WebviewWindow,
    document: ChartDocument,
    semitones: i8,
    capo: u8,
    spelling: ChartSpelling,
) -> Result<ChartTransformResult, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        engine::transpose(document, semitones, capo, spelling)
    })
    .await
    .map_err(|_| "Não foi possível transpor a cifra.".to_string())?
}
#[tauri::command]
pub async fn suggest_chart_capos(
    window: tauri::WebviewWindow,
    document: ChartDocument,
) -> Result<Vec<CapoSuggestion>, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || engine::suggest_capos(document))
        .await
        .map_err(|_| "Não foi possível sugerir o capotraste.".to_string())?
}
#[tauri::command]
pub async fn suggest_chart_keys(
    window: tauri::WebviewWindow,
    document: ChartDocument,
) -> Result<Vec<KeySuggestion>, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || engine::suggest_keys(&document))
        .await
        .map_err(|_| "Não foi possível sugerir tonalidades.".to_string())?
}
#[tauri::command]
pub async fn publish_chart(
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    id: String,
    expected_revision: u64,
    name: String,
) -> Result<Chart, String> {
    super::operator(&window)?;
    run(&state, move |db| {
        db.publish_chart(&ChartActor::desktop(), &id, expected_revision, &name)
    })
    .await
}
