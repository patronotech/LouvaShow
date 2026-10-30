use super::bible::{BiblePresentation, PreparedBible};
use super::library::{Song, SongBlock};
use serde::{Deserialize, Serialize};

/// Percentages of the slide canvas, independent of output resolution and DPI.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Default for TextBox {
    fn default() -> Self {
        Self {
            x: 7.,
            y: 7.,
            width: 86.,
            height: 86.,
        }
    }
}

impl TextBox {
    pub fn validate(&self) -> Result<(), String> {
        if ![self.x, self.y, self.width, self.height]
            .iter()
            .all(|v| v.is_finite())
            || self.x < 0.
            || self.y < 0.
            || self.width < 10.
            || self.height < 10.
            || self.x + self.width > 100.
            || self.y + self.height > 100.
        {
            return Err("Área de texto inválida. Use largura e altura de pelo menos 10% e mantenha a caixa dentro da tela.".into());
        }
        Ok(())
    }
}

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
    #[serde(default)]
    pub text_box: TextBox,
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
            text_box: TextBox::default(),
        }
    }
}
impl Theme {
    pub fn validate(&self) -> Result<(), String> {
        self.text_box.validate()?;
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

/// Only typography and text geometry can override the shared presentation theme.
/// Missing/null fields inherit it; `None` on the block removes the whole override.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BlockStyleOverride {
    pub version: u8,
    pub text_box: Option<TextBox>,
    pub font_size: Option<f64>,
    pub font_family: Option<String>,
    pub text_color: Option<String>,
    pub text_align: Option<String>,
    pub vertical_align: Option<String>,
}

impl BlockStyleOverride {
    pub fn validate(&self) -> Result<(), String> {
        if self.version != 1 {
            return Err("Versão de estilo de bloco não suportada. Atualize o LouvaShow.".into());
        }
        // Reuse exactly the global-theme limits, without accepting backgrounds,
        // animation, media or arbitrary CSS in the per-block contract.
        let theme = Theme {
            text_box: self.text_box.unwrap_or_default(),
            font_size: self.font_size.unwrap_or(64.),
            font_family: self.font_family.clone().unwrap_or_else(|| "Arial".into()),
            text_color: self.text_color.clone().unwrap_or_else(|| "#ffffff".into()),
            text_align: self.text_align.clone().unwrap_or_else(|| "center".into()),
            vertical_align: self
                .vertical_align
                .clone()
                .unwrap_or_else(|| "center".into()),
            ..Theme::default()
        };
        theme.validate()
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresentationBlock {
    pub id: String,
    pub label: Option<String>,
    pub text: String,
    pub position: usize,
    #[serde(default)]
    pub style_override: Option<BlockStyleOverride>,
}
impl From<SongBlock> for PresentationBlock {
    fn from(block: SongBlock) -> Self {
        Self {
            id: block.id,
            label: block.label,
            text: block.text,
            position: block.position,
            style_override: block.style_override,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub revision: u64,
    pub blanked: bool,
    pub song_id: Option<String>,
    pub title: String,
    pub blocks: Vec<PresentationBlock>,
    #[serde(default)]
    pub bible: Option<BiblePresentation>,
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
            bible: None,
            block_index: 0,
            theme: Theme::default(),
        }
    }
}
impl Snapshot {
    /// The source can change while an editor is open. Apply only to the exact
    /// currently projected block, preserving the session's owned text and theme.
    pub fn apply_block_style(
        &mut self,
        song_id: &str,
        block_id: &str,
        style_override: Option<BlockStyleOverride>,
    ) -> Result<bool, String> {
        if let Some(style) = &style_override {
            style.validate()?;
        }
        if self.bible.is_some() || self.song_id.as_deref() != Some(song_id) {
            return Ok(false);
        }
        let Some(block) = self
            .blocks
            .get_mut(self.block_index)
            .filter(|b| b.id == block_id)
        else {
            return Ok(false);
        };
        block.style_override = style_override;
        self.revision += 1;
        Ok(true)
    }
    pub fn present(&mut self, song: Song, block_id: &str) -> Result<(), String> {
        let index = song
            .blocks
            .iter()
            .position(|b| b.id == block_id)
            .ok_or("Trecho não encontrado. Atualize a biblioteca.")?;
        self.song_id = Some(song.id);
        self.bible = None;
        self.title = song.title;
        self.blocks = song.blocks.into_iter().map(Into::into).collect();
        self.block_index = index;
        self.blanked = false;
        self.revision += 1;
        Ok(())
    }
    pub fn present_bible(&mut self, prepared: PreparedBible) -> Result<(), String> {
        if prepared.blocks.is_empty() || prepared.block_index >= prepared.blocks.len() {
            return Err(
                "O trecho bíblico preparado é inválido. Escolha o versículo novamente.".into(),
            );
        }
        self.song_id = None;
        self.bible = Some(prepared.bible);
        self.title = prepared.title;
        self.blocks = prepared.blocks;
        self.block_index = prepared.block_index;
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
    PresentBible {
        #[serde(rename = "versionId")]
        version_id: String,
        #[serde(rename = "bookId")]
        book_id: String,
        chapter: u32,
        verse: String,
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
    use crate::{
        application::bible::prepare_chapter,
        domain::bible::{BibleChapter, BibleVerse, BibleVersion},
    };
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

    #[test]
    fn block_style_contract_rejects_backgrounds_versions_and_invalid_theme_fields() {
        let valid: BlockStyleOverride = serde_json::from_value(serde_json::json!({"version":1,"fontSize":80,"textColor":"#a94a17","textBox":{"x":10,"y":20,"width":80,"height":60}})).unwrap();
        valid.validate().unwrap();
        for invalid in [
            serde_json::json!({"version":2}),
            serde_json::json!({"version":1,"fontSize":31}),
            serde_json::json!({"version":1,"fontSize":101}),
            serde_json::json!({"version":1,"fontFamily":"url(unknown)"}),
            serde_json::json!({"version":1,"textColor":"red"}),
            serde_json::json!({"version":1,"textAlign":"justify"}),
            serde_json::json!({"version":1,"verticalAlign":"top"}),
            serde_json::json!({"version":1,"textBox":{"x":95,"y":0,"width":10,"height":20}}),
        ] {
            assert!(serde_json::from_value::<BlockStyleOverride>(invalid)
                .unwrap()
                .validate()
                .is_err());
        }
        for forbidden in [
            "backgroundColor",
            "backgroundMediaId",
            "transitionType",
            "overlayOpacity",
        ] {
            let mut value = serde_json::json!({"version":1});
            value[forbidden] = serde_json::json!("forbidden");
            assert!(serde_json::from_value::<BlockStyleOverride>(value).is_err());
        }
        let mut non_finite = valid;
        non_finite.font_size = Some(f64::NAN);
        assert!(non_finite.validate().is_err());
        let inherit: BlockStyleOverride =
            serde_json::from_value(serde_json::json!({"version":1,"fontSize":null})).unwrap();
        inherit.validate().unwrap();
        assert!(song().blocks[0].style_override.is_none());
    }

    #[test]
    fn applying_block_style_changes_only_current_override_and_revision_even_when_blanked() {
        let mut state = Snapshot::default();
        state.present(song(), "a").unwrap();
        state.toggle_blank();
        let mut expected = serde_json::to_value(&state).unwrap();
        let style: BlockStyleOverride =
            serde_json::from_value(serde_json::json!({"version":1,"fontSize":90})).unwrap();
        expected["revision"] = serde_json::json!(state.revision + 1);
        expected["blocks"][0]["styleOverride"] = serde_json::to_value(&style).unwrap();
        assert!(state.apply_block_style("s", "a", Some(style)).unwrap());
        assert_eq!(serde_json::to_value(&state).unwrap(), expected);
        let unchanged = serde_json::to_value(&state).unwrap();
        assert!(!state.apply_block_style("other", "a", None).unwrap());
        assert!(!state.apply_block_style("s", "b", None).unwrap());
        assert_eq!(serde_json::to_value(&state).unwrap(), unchanged);
        assert!(state.apply_block_style("s", "a", None).unwrap());
        assert!(state.blocks[0].style_override.is_none());
        assert!(state.blanked);
        let (version, chapter) = bible_fixture();
        state
            .present_bible(prepare_chapter(&version, chapter, "1").unwrap())
            .unwrap();
        let unchanged = serde_json::to_value(&state).unwrap();
        assert!(!state.apply_block_style("s", "a", None).unwrap());
        assert_eq!(serde_json::to_value(&state).unwrap(), unchanged);
    }

    #[test]
    fn legacy_theme_without_text_box_uses_existing_safe_margins() {
        let mut legacy = serde_json::to_value(Theme::default()).unwrap();
        legacy.as_object_mut().unwrap().remove("textBox");
        let restored: Theme = serde_json::from_value(legacy).unwrap();
        assert_eq!(
            restored.text_box,
            TextBox {
                x: 7.,
                y: 7.,
                width: 86.,
                height: 86.
            }
        );
        restored.validate().unwrap();
        let json = serde_json::to_value(restored).unwrap();
        assert_eq!(json["textBox"]["width"], 86.);
        assert!(json.get("text_box").is_none());
    }

    #[test]
    fn text_box_validates_finite_values_minimum_dimensions_and_canvas_bounds() {
        for valid in [
            TextBox::default(),
            TextBox {
                x: 0.,
                y: 0.,
                width: 100.,
                height: 100.,
            },
            TextBox {
                x: 90.,
                y: 90.,
                width: 10.,
                height: 10.,
            },
        ] {
            assert!(valid.validate().is_ok());
        }
        let valid = TextBox::default();
        for invalid in [
            TextBox {
                x: f64::NAN,
                ..valid
            },
            TextBox {
                y: f64::INFINITY,
                ..valid
            },
            TextBox {
                width: f64::NEG_INFINITY,
                ..valid
            },
            TextBox {
                height: f64::NAN,
                ..valid
            },
            TextBox { x: -0.01, ..valid },
            TextBox { y: -0.01, ..valid },
            TextBox {
                width: 9.99,
                ..valid
            },
            TextBox {
                height: 9.99,
                ..valid
            },
            TextBox { x: 15., ..valid },
            TextBox { y: 15., ..valid },
        ] {
            assert!(invalid.validate().is_err(), "{invalid:?}");
        }
        for malformed in [
            serde_json::Value::Null,
            serde_json::json!({"x":0,"y":0,"width":90}),
            serde_json::json!({"x":"7","y":7,"width":86,"height":86}),
        ] {
            let mut json = serde_json::to_value(Theme::default()).unwrap();
            json["textBox"] = malformed;
            assert!(serde_json::from_value::<Theme>(json).is_err());
        }
    }

    #[test]
    fn text_box_draft_changes_only_go_live_when_valid_theme_is_applied() {
        let mut state = Snapshot::default();
        state.present(song(), "a").unwrap();
        state.toggle_blank();
        let before = serde_json::to_value(&state).unwrap();
        let mut draft = state.theme.clone();
        draft.text_box = TextBox {
            x: 10.,
            y: 20.,
            width: 70.,
            height: 50.,
        };
        assert_eq!(serde_json::to_value(&state).unwrap(), before);
        let mut invalid = draft.clone();
        invalid.text_box.width = 95.;
        assert!(state.apply_theme(invalid).is_err());
        assert_eq!(serde_json::to_value(&state).unwrap(), before);
        let revision = state.revision;
        state.apply_theme(draft.clone()).unwrap();
        assert_eq!(state.revision, revision + 1);
        assert_eq!(state.theme.text_box, draft.text_box);
        assert!(state.blanked);
        assert_eq!(state.blocks[0].text, "Um");
        let restored: Snapshot =
            serde_json::from_value(serde_json::to_value(&state).unwrap()).unwrap();
        assert_eq!(restored.theme.text_box, draft.text_box);
    }

    fn bible_fixture() -> (BibleVersion, BibleChapter) {
        let version = BibleVersion {
            id: "test".into(),
            name: "Versão de teste".into(),
            abbreviation: "TEST".into(),
            language: "pt".into(),
            license: "Teste".into(),
            license_url: "https://example.com/license".into(),
            attribution: "Texto sintético para validação".into(),
            source_url: "https://example.com/source".into(),
        };
        let chapter = BibleChapter {
            version_id: "test".into(),
            book_id: "TST".into(),
            book_name: "Livro de teste".into(),
            chapter: 1,
            verses: vec![
                BibleVerse {
                    number: "1".into(),
                    text: "Primeiro versículo sintético".into(),
                },
                BibleVerse {
                    number: "2-3".into(),
                    text: "Segundo versículo sintético com acentuação. ".repeat(20),
                },
            ],
        };
        (version, chapter)
    }

    #[test]
    fn music_bible_music_switches_owned_content_and_navigation_stays_in_chapter() {
        let mut state = Snapshot::default();
        state.present(song(), "a").unwrap();
        assert!(state.bible.is_none());
        let (version, chapter) = bible_fixture();
        let expected = chapter.verses[1].text.clone();
        state
            .present_bible(prepare_chapter(&version, chapter, "2-3").unwrap())
            .unwrap();
        assert_eq!(state.revision, 2);
        assert!(state.song_id.is_none());
        assert_eq!(state.bible.as_ref().unwrap().version_id, "test");
        assert_eq!(state.blocks[state.block_index].id, "bible:test:TST:1:2-3:1");
        assert!(state.blocks[state.block_index]
            .label
            .as_deref()
            .unwrap()
            .contains("parte 1/"));
        assert_eq!(
            state
                .blocks
                .iter()
                .filter(|b| b.id.starts_with("bible:test:TST:1:2-3:"))
                .map(|b| b.text.as_str())
                .collect::<String>(),
            expected
        );
        for _ in 0..state.blocks.len() + 1 {
            state.navigate(true);
        }
        let last = state.revision;
        state.navigate(true);
        assert_eq!(state.revision, last);
        assert_eq!(state.bible.as_ref().unwrap().chapter, 1);
        for _ in 0..state.blocks.len() + 1 {
            state.navigate(false);
        }
        let first = state.revision;
        state.navigate(false);
        assert_eq!(state.revision, first);
        assert_eq!(state.block_index, 0);
        state.toggle_blank();
        state.navigate(true);
        assert!(state.blanked);
        state.toggle_blank();
        state.present(song(), "b").unwrap();
        assert!(state.bible.is_none());
        assert_eq!(state.song_id.as_deref(), Some("s"));
        assert_eq!(state.blocks[state.block_index].text, "Dois");
    }

    #[test]
    fn invalid_bible_selection_does_not_mutate_live_snapshot() {
        let mut state = Snapshot::default();
        state.present(song(), "a").unwrap();
        let before = serde_json::to_value(&state).unwrap();
        let (version, chapter) = bible_fixture();
        assert!(prepare_chapter(&version, chapter.clone(), "missing").is_err());
        assert!(prepare_chapter(&version, chapter.clone(), "2").is_err());
        let mut invalid = prepare_chapter(&version, chapter, "1").unwrap();
        invalid.block_index = invalid.blocks.len();
        assert!(state.present_bible(invalid).is_err());
        assert_eq!(serde_json::to_value(&state).unwrap(), before);
    }

    #[test]
    fn bible_snapshot_roundtrips_and_generic_blocks_exclude_song_identity() {
        let mut state = Snapshot::default();
        let (version, chapter) = bible_fixture();
        state
            .present_bible(prepare_chapter(&version, chapter, "1").unwrap())
            .unwrap();
        let serialized = serde_json::to_value(&state).unwrap();
        assert!(serialized["blocks"][0].get("songId").is_none());
        let restored: Snapshot = serde_json::from_value(serialized.clone()).unwrap();
        assert_eq!(serde_json::to_value(restored).unwrap(), serialized);
        let action:Action=serde_json::from_value(serde_json::json!({"type":"presentBible","versionId":"test","bookId":"TST","chapter":1,"verse":"2-3"})).unwrap();
        assert!(matches!(action,Action::PresentBible{verse,..} if verse=="2-3"));
    }
}
