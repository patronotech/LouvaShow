use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleVersion {
    pub id: String,
    pub name: String,
    pub abbreviation: String,
    pub language: String,
    pub license: String,
    pub license_url: String,
    pub attribution: String,
    pub source_url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleBook {
    pub id: String,
    pub name: String,
    pub chapter_count: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct BibleVerse {
    pub number: String,
    pub text: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BibleChapter {
    pub version_id: String,
    pub book_id: String,
    pub book_name: String,
    pub chapter: u32,
    pub verses: Vec<BibleVerse>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiblePresentation {
    pub version_id: String,
    pub book_id: String,
    pub chapter: u32,
    pub version_abbreviation: String,
    pub attribution: String,
}

pub struct PreparedBible {
    pub title: String,
    pub bible: BiblePresentation,
    pub blocks: Vec<super::presentation::PresentationBlock>,
    pub block_index: usize,
}
