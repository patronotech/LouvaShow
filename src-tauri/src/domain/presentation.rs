use super::library::{Song, SongBlock};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub font_family: String,
    pub font_size: f64,
    pub text_color: String,
    pub background_color: String,
    pub text_align: String,
    pub vertical_align: String,
    pub background_media_id: Option<String>,
    pub overlay_opacity: f64,
    pub transition_type: String,
    pub transition_duration_ms: u32,
}
impl Default for Theme {
    fn default() -> Self {
        Self {
            id: "default".into(),
            name: "Essencial".into(),
            font_family: "Arial".into(),
            font_size: 64.,
            text_color: "#ffffff".into(),
            background_color: "#101827".into(),
            text_align: "center".into(),
            vertical_align: "center".into(),
            background_media_id: None,
            overlay_opacity: 0.,
            transition_type: "fade".into(),
            transition_duration_ms: 180,
        }
    }
}
impl Theme {
    pub fn validate(&self) -> Result<(), String> {
        let color = |v: &str| {
            v.len() == 7 && v.starts_with('#') && v[1..].bytes().all(|c| c.is_ascii_hexdigit())
        };
        if !self.font_size.is_finite()
            || !(32. ..=100.).contains(&self.font_size)
            || !color(&self.text_color)
            || !color(&self.background_color)
            || !["Arial", "Georgia", "Verdana"].contains(&self.font_family.as_str())
            || !["left", "center", "right"].contains(&self.text_align.as_str())
            || !["start", "center", "end"].contains(&self.vertical_align.as_str())
            || !["none", "fade"].contains(&self.transition_type.as_str())
            || self.transition_duration_ms > 500
            || !self.overlay_opacity.is_finite()
            || !(0. ..=1.).contains(&self.overlay_opacity)
            || self.background_media_id.is_some()
        {
            return Err("Tema inválido. Use fonte de 32 a 100 e fundo sólido.".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub revision: u64,
    pub blanked: bool,
    pub song_id: Option<String>,
    pub title: String,
    pub blocks: Vec<SongBlock>,
    pub block_index: usize,
    pub theme: Theme,
}
impl Default for Snapshot {
    fn default() -> Self {
        Self {
            revision: 0,
            blanked: true,
            song_id: None,
            title: String::new(),
            blocks: vec![],
            block_index: 0,
            theme: Theme::default(),
        }
    }
}
impl Snapshot {
    pub fn present(&mut self, song: Song, block_id: &str) -> Result<(), String> {
        let index = song
            .blocks
            .iter()
            .position(|b| b.id == block_id)
            .ok_or("Trecho não encontrado. Atualize a biblioteca.")?;
        self.song_id = Some(song.id);
        self.title = song.title;
        self.blocks = song.blocks;
        self.block_index = index;
        self.blanked = false;
        self.revision += 1;
        Ok(())
    }
    pub fn navigate(&mut self, forward: bool) {
        let next = if forward {
            (self.block_index + 1).min(self.blocks.len().saturating_sub(1))
        } else {
            self.block_index.saturating_sub(1)
        };
        if next != self.block_index {
            self.block_index = next;
            self.revision += 1;
        }
    }
    pub fn toggle_blank(&mut self) {
        self.blanked = !self.blanked;
        self.revision += 1;
    }
    pub fn apply_theme(&mut self, theme: Theme) -> Result<(), String> {
        theme.validate()?;
        self.theme = theme;
        self.revision += 1;
        Ok(())
    }
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Present {
        #[serde(rename = "songId")]
        song_id: String,
        #[serde(rename = "blockId")]
        block_id: String,
    },
    Next,
    Previous,
    ToggleBlank,
    Theme {
        theme: Theme,
    },
}
#[cfg(test)]
mod tests {
    use super::*;
    fn song() -> Song {
        serde_json::from_value(serde_json::json!({"id":"s","title":"Teste", "artist":null,"createdAt":"now","updatedAt":"now","blocks":[{"id":"a","songId":"s","label":null,"text":"Um","position":0},{"id":"b","songId":"s","label":null,"text":"Dois","position":1}]})).unwrap()
    }
    #[test]
    fn navigation_blank_and_boundaries() {
        let mut s = Snapshot::default();
        assert!(s.blanked);
        s.present(song(), "a").unwrap();
        s.navigate(true);
        assert_eq!(s.block_index, 1);
        let r = s.revision;
        s.navigate(true);
        assert_eq!(s.revision, r);
        s.toggle_blank();
        s.toggle_blank();
        assert!(!s.blanked);
        assert_eq!(s.blocks[1].text, "Dois");
        s.navigate(false);
        assert_eq!(s.block_index, 0);
    }
    #[test]
    fn detached_from_source_and_invalid_present_atomic() {
        let mut s = Snapshot::default();
        let mut source = song();
        s.present(source.clone(), "a").unwrap();
        source.blocks[0].text = "Editado".into();
        assert_eq!(s.blocks[0].text, "Um");
        let r = s.revision;
        assert!(s.present(source, "missing").is_err());
        assert_eq!(r, s.revision);
        assert_eq!(s.blocks[0].text, "Um");
    }
}
