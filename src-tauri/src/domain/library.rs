use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    #[serde(default = "default_category_id")]
    pub category_id: String,
    pub copyright: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub blocks: Vec<SongBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongBlock {
    pub id: String,
    pub song_id: String,
    pub label: Option<String>,
    pub text: String,
    pub position: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSongInput {
    #[serde(default, deserialize_with = "optional_nullable_string")]
    pub copyright: Option<Option<String>>,
    pub category_id: Option<String>,
    pub id: Option<String>,
    pub title: String,
    pub artist: Option<String>,
    pub blocks: Vec<SaveBlockInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBlockInput {
    pub id: Option<String>,
    pub label: Option<String>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Setlist {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub items: Vec<SetlistItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetlistItem {
    pub id: String,
    pub setlist_id: String,
    pub song_id: String,
    pub position: usize,
}

/// Legacy JSON snapshots without classifications retain the default classification.
pub fn default_category_id() -> String {
    "musica".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
}

pub use crate::domain::importing::ImportResult;

// Missing field preserves existing metadata; explicit null clears it.
fn optional_nullable_string<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<Option<String>>, D::Error> {
    Option::<String>::deserialize(deserializer).map(Some)
}
