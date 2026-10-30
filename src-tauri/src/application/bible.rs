use crate::{
    domain::{
        bible::{BibleChapter, BiblePresentation, BibleVersion, PreparedBible},
        presentation::PresentationBlock,
    },
    infrastructure::bible::library,
};

const PAGE_CHARACTERS: usize = 240;

/// Split on whitespace when possible and preserve every byte of source text.
/// An unusually long token falls back to a Unicode scalar boundary.
pub fn paginate(text: &str, limit: usize) -> Vec<String> {
    let limit = limit.max(1);
    let mut remaining = text;
    let mut pages = Vec::new();
    while remaining.chars().nth(limit).is_some() {
        let mut whitespace = None;
        let mut boundary = 0;
        for (byte, ch) in remaining.char_indices().take(limit) {
            boundary = byte + ch.len_utf8();
            if ch.is_whitespace() {
                whitespace = Some(boundary);
            }
        }
        let split = whitespace.unwrap_or(boundary);
        pages.push(remaining[..split].to_owned());
        remaining = &remaining[split..];
    }
    if !remaining.is_empty() {
        pages.push(remaining.to_owned());
    }
    pages
}

pub fn prepare(
    version_id: &str,
    book_id: &str,
    chapter: u32,
    verse: &str,
) -> Result<PreparedBible, String> {
    let catalog = library()?;
    prepare_chapter(
        catalog.metadata(version_id)?,
        catalog.chapter(version_id, book_id, chapter)?,
        verse,
    )
}

pub fn prepare_chapter(
    version: &BibleVersion,
    chapter: BibleChapter,
    selected_verse: &str,
) -> Result<PreparedBible, String> {
    if chapter.version_id != version.id
        || !chapter.verses.iter().any(|v| v.number == selected_verse)
    {
        return Err("O versículo escolhido não existe neste capítulo. Atualize a seleção.".into());
    }
    let mut blocks = Vec::new();
    let mut block_index = None;
    for verse in chapter.verses {
        let pages = paginate(&verse.text, PAGE_CHARACTERS);
        if pages.is_empty() {
            return Err("O versículo escolhido está sem texto.".into());
        }
        let total = pages.len();
        if verse.number == selected_verse {
            block_index = Some(blocks.len());
        }
        for (part, text) in pages.into_iter().enumerate() {
            let reference = format!("{} {}:{}", chapter.book_name, chapter.chapter, verse.number);
            let label = if total > 1 {
                format!("{reference} · parte {}/{}", part + 1, total)
            } else {
                reference
            };
            blocks.push(PresentationBlock {
                id: format!(
                    "bible:{}:{}:{}:{}:{}",
                    version.id,
                    chapter.book_id,
                    chapter.chapter,
                    verse.number,
                    part + 1
                ),
                label: Some(label),
                text,
                position: blocks.len(),
            });
        }
    }
    Ok(PreparedBible {
        title: format!(
            "{} {} · {}",
            chapter.book_name, chapter.chapter, version.abbreviation
        ),
        bible: BiblePresentation {
            version_id: version.id.clone(),
            book_id: chapter.book_id,
            chapter: chapter.chapter,
            version_abbreviation: version.abbreviation.clone(),
            attribution: version.attribution.clone(),
        },
        blocks,
        block_index: block_index.ok_or("Versículo não encontrado.")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pagination_preserves_words_accents_lines_and_all_source_bytes() {
        let text = "Ação e graça: texto sintético.\n".repeat(30);
        let pages = paginate(&text, 240);
        assert!(pages.len() > 1);
        assert_eq!(pages.concat(), text);
        assert!(pages.iter().all(|p| p.chars().count() <= 240));
        assert!(pages[..pages.len() - 1]
            .iter()
            .all(|p| p.ends_with(char::is_whitespace)));
        let long_word = "á".repeat(501);
        let split = paginate(&long_word, 240);
        assert_eq!(split.concat(), long_word);
        assert_eq!(split.len(), 3);
    }
}
