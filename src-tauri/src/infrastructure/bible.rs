use crate::domain::bible::{BibleBook, BibleChapter, BibleVerse, BibleVersion};
use serde::Deserialize;
use std::{
    collections::{HashMap, HashSet},
    sync::OnceLock,
};

// Generated from a reviewed manifest at build time. Runtime performs no file IO.
include!(concat!(env!("OUT_DIR"), "/embedded_bibles.rs"));

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestVersion {
    #[serde(flatten)]
    metadata: BibleVersion,
    source_sha256: String,
    books: Vec<ManifestBook>,
}
#[derive(Deserialize)]
struct ManifestBook {
    #[serde(flatten)]
    metadata: BibleBook,
    file: String,
}
#[derive(Deserialize)]
struct BookData {
    id: String,
    name: String,
    chapters: Vec<ChapterData>,
}
#[derive(Deserialize)]
struct ChapterData {
    number: u32,
    verses: Vec<BibleVerse>,
}
struct BookRecord {
    metadata: BibleBook,
    source: &'static str,
    data: OnceLock<Result<BookData, String>>,
}
struct VersionRecord {
    metadata: BibleVersion,
    books: Vec<BookRecord>,
}
pub struct BibleLibrary {
    versions: Vec<VersionRecord>,
}

static LIBRARY: OnceLock<Result<BibleLibrary, String>> = OnceLock::new();

pub fn library() -> Result<&'static BibleLibrary, String> {
    LIBRARY
        .get_or_init(|| BibleLibrary::from_sources(BIBLE_MANIFEST, BIBLE_BOOK_FILES))
        .as_ref()
        .map_err(Clone::clone)
}

fn safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_'))
}

fn verse_range(number: &str) -> Result<(u32, u32), String> {
    let parts = number.split('-').collect::<Vec<_>>();
    if parts.is_empty()
        || parts.len() > 2
        || parts
            .iter()
            .any(|p| p.is_empty() || !p.bytes().all(|c| c.is_ascii_digit()))
    {
        return Err("A numeração de um versículo no conteúdo bíblico é inválida.".into());
    }
    let first: u32 = parts[0]
        .parse()
        .map_err(|_| "Número de versículo inválido.")?;
    let last: u32 = parts[parts.len() - 1]
        .parse()
        .map_err(|_| "Número de versículo inválido.")?;
    if first == 0 || first > last {
        return Err("Intervalo de versículos inválido.".into());
    }
    Ok((first, last))
}

impl BibleLibrary {
    fn from_sources(
        manifest: &str,
        files: &[(&'static str, &'static str)],
    ) -> Result<Self, String> {
        let manifest: Vec<ManifestVersion> = serde_json::from_str(manifest)
            .map_err(|_| "Não foi possível ler o catálogo bíblico incluído no aplicativo.")?;
        if manifest.is_empty() || manifest.len() > 30 {
            return Err("O catálogo bíblico está vazio ou excede o limite de versões.".into());
        }
        let files: HashMap<_, _> = files.iter().copied().collect();
        let mut version_ids = HashSet::new();
        let mut versions = Vec::new();
        for version in manifest {
            let metadata = &version.metadata;
            if !safe_id(&metadata.id)
                || !version_ids.insert(metadata.id.clone())
                || metadata.name.trim().is_empty()
                || metadata.abbreviation.trim().is_empty()
                || metadata.attribution.trim().is_empty()
                || metadata.license.trim().is_empty()
                || !metadata.source_url.starts_with("https://")
                || !metadata.license_url.starts_with("https://")
                || version.source_sha256.len() != 64
                || !version.source_sha256.bytes().all(|c| c.is_ascii_hexdigit())
                || version.books.is_empty()
                || version.books.len() > 100
            {
                return Err("Uma versão do catálogo bíblico tem metadados inválidos.".into());
            }
            let mut books = Vec::new();
            let mut book_ids = HashSet::new();
            for book in version.books {
                if !safe_id(&book.metadata.id)
                    || !book_ids.insert(book.metadata.id.clone())
                    || book.metadata.name.trim().is_empty()
                    || !(1..=200).contains(&book.metadata.chapter_count)
                {
                    return Err("Um livro do catálogo bíblico tem metadados inválidos.".into());
                }
                let source = files
                    .get(book.file.as_str())
                    .copied()
                    .ok_or("Um livro do catálogo bíblico não foi incluído no aplicativo.")?;
                books.push(BookRecord {
                    metadata: book.metadata,
                    source,
                    data: OnceLock::new(),
                });
            }
            versions.push(VersionRecord {
                metadata: version.metadata,
                books,
            });
        }
        Ok(Self { versions })
    }

    pub fn versions(&self) -> Vec<BibleVersion> {
        self.versions.iter().map(|v| v.metadata.clone()).collect()
    }

    fn version(&self, id: &str) -> Result<&VersionRecord, String> {
        self.versions
            .iter()
            .find(|v| v.metadata.id == id)
            .ok_or_else(|| "Versão bíblica não encontrada. Escolha uma versão disponível.".into())
    }

    pub fn metadata(&self, id: &str) -> Result<&BibleVersion, String> {
        Ok(&self.version(id)?.metadata)
    }

    pub fn books(&self, version_id: &str) -> Result<Vec<BibleBook>, String> {
        Ok(self
            .version(version_id)?
            .books
            .iter()
            .map(|b| b.metadata.clone())
            .collect())
    }

    pub fn chapter(
        &self,
        version_id: &str,
        book_id: &str,
        chapter: u32,
    ) -> Result<BibleChapter, String> {
        let version = self.version(version_id)?;
        let book = version
            .books
            .iter()
            .find(|book| book.metadata.id == book_id)
            .ok_or("Livro não encontrado nesta versão bíblica.")?;
        if chapter == 0 || chapter > book.metadata.chapter_count {
            return Err("O capítulo escolhido não existe neste livro.".into());
        }
        let data = book
            .data
            .get_or_init(|| Self::parse_book(book))
            .as_ref()
            .map_err(Clone::clone)?;
        let verses = data
            .chapters
            .get((chapter - 1) as usize)
            .ok_or("O capítulo não está disponível nesta versão.")?
            .verses
            .clone();
        Ok(BibleChapter {
            version_id: version_id.into(),
            book_id: book_id.into(),
            book_name: book.metadata.name.clone(),
            chapter,
            verses,
        })
    }

    fn parse_book(book: &BookRecord) -> Result<BookData, String> {
        if book.source.len() > 5 * 1024 * 1024 {
            return Err("O livro bíblico excede o limite de tamanho permitido.".into());
        }
        let data: BookData = serde_json::from_str(book.source)
            .map_err(|_| "Não foi possível ler um livro bíblico incluído no aplicativo.")?;
        if data.id != book.metadata.id
            || data.name != book.metadata.name
            || data.chapters.len() != book.metadata.chapter_count as usize
        {
            return Err("O conteúdo de um livro bíblico não corresponde ao catálogo.".into());
        }
        for (index, chapter) in data.chapters.iter().enumerate() {
            if chapter.number != index as u32 + 1
                || chapter.verses.is_empty()
                || chapter.verses.len() > 500
            {
                return Err("Um capítulo do conteúdo bíblico é inválido.".into());
            }
            let mut last = 0;
            for verse in &chapter.verses {
                let (first, end) = verse_range(&verse.number)?;
                if first <= last || verse.text.trim().is_empty() || verse.text.len() > 100_000 {
                    return Err(
                        "Um versículo do conteúdo bíblico está vazio, repetido ou fora de ordem."
                            .into(),
                    );
                }
                last = end;
            }
        }
        Ok(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_identifiers_and_chapter_bounds_are_recoverable() {
        let lib = library().unwrap();
        let version = &lib.versions()[0];
        let book = &lib.books(&version.id).unwrap()[0];
        assert!(lib.books("missing").is_err());
        assert!(lib.chapter(&version.id, "missing", 1).is_err());
        assert!(lib.chapter(&version.id, &book.id, 0).is_err());
        assert!(lib
            .chapter(&version.id, &book.id, book.chapter_count + 1)
            .is_err());
        assert!(!lib
            .chapter(&version.id, &book.id, 1)
            .unwrap()
            .verses
            .is_empty());
    }

    #[test]
    fn every_embedded_book_and_chapter_passes_validation() {
        let lib = library().unwrap();
        assert!(lib.versions().len() >= 3);
        for version in lib.versions() {
            for book in lib.books(&version.id).unwrap() {
                for number in 1..=book.chapter_count {
                    let chapter = lib.chapter(&version.id, &book.id, number).unwrap();
                    assert_eq!(chapter.chapter, number);
                    assert_eq!(chapter.book_id, book.id);
                    assert!(!chapter.verses.is_empty());
                }
            }
        }
    }

    #[test]
    fn verse_labels_accept_intervals_without_coercing_them_to_positions() {
        assert_eq!(verse_range("3-5").unwrap(), (3, 5));
        assert!(verse_range("5-3").is_err());
        assert!(verse_range("0").is_err());
        assert!(verse_range("3-5-7").is_err());
    }
}
