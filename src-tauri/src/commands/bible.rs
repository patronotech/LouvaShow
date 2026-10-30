use crate::{
    domain::bible::{BibleBook, BibleChapter, BibleVersion},
    infrastructure::bible::library,
};

#[tauri::command]
pub async fn list_bible_versions(
    window: tauri::WebviewWindow,
) -> Result<Vec<BibleVersion>, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(|| library().map(|catalog| catalog.versions()))
        .await
        .map_err(|_| "Não foi possível carregar as versões bíblicas.")?
}

#[tauri::command]
pub async fn list_bible_books(
    window: tauri::WebviewWindow,
    version_id: String,
) -> Result<Vec<BibleBook>, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || library()?.books(&version_id))
        .await
        .map_err(|_| "Não foi possível carregar os livros bíblicos.")?
}

#[tauri::command]
pub async fn get_bible_chapter(
    window: tauri::WebviewWindow,
    version_id: String,
    book_id: String,
    chapter: u32,
) -> Result<BibleChapter, String> {
    super::operator(&window)?;
    tauri::async_runtime::spawn_blocking(move || library()?.chapter(&version_id, &book_id, chapter))
        .await
        .map_err(|_| "Não foi possível carregar o capítulo bíblico.")?
}
