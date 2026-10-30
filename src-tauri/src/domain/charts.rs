use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChartChord {
    pub id: String,
    pub offset: usize,
    pub symbol: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChartLine {
    pub id: String,
    pub text: String,
    pub chords: Vec<ChartChord>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChartSection {
    pub id: String,
    pub label: String,
    pub lines: Vec<ChartLine>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChartOccurrence {
    pub id: String,
    pub section_id: String,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChartSpelling {
    Sharps,
    Flats,
}
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChartScope {
    Personal,
    Church,
}
impl ChartScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Personal => "personal",
            Self::Church => "church",
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChartDocument {
    pub schema_version: u8,
    pub title: String,
    pub artist: Option<String>,
    pub concert_key: Option<String>,
    pub capo: u8,
    pub spelling: ChartSpelling,
    pub sections: Vec<ChartSection>,
    pub sequence: Vec<ChartOccurrence>,
    pub notes: String,
    #[serde(default)]
    pub preserved_directives: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartSummary {
    pub id: String,
    pub song_id: String,
    pub name: String,
    pub owner_id: String,
    pub scope: ChartScope,
    pub revision: u64,
    pub created_at: String,
    pub updated_at: String,
    pub source_chart_id: Option<String>,
    pub source_revision_id: Option<String>,
    pub source_author_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartRevision {
    pub id: String,
    pub chart_id: String,
    pub revision: u64,
    pub author_id: String,
    pub created_at: String,
    pub document: ChartDocument,
    pub source_song_updated_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chart {
    #[serde(flatten)]
    pub summary: ChartSummary,
    pub current: ChartRevision,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveChartInput {
    pub id: Option<String>,
    pub song_id: String,
    pub name: String,
    pub scope: ChartScope,
    pub expected_revision: Option<u64>,
    pub document: ChartDocument,
    pub source_chart_id: Option<String>,
}
/// Construct only from the native operator or a verified server session, never a request body.
#[derive(Debug, Clone)]
pub struct ChartActor {
    pub id: String,
    pub can_publish: bool,
    pub operator: bool,
}
impl ChartActor {
    pub fn desktop() -> Self {
        Self {
            id: "operator".into(),
            can_publish: true,
            operator: true,
        }
    }
    pub fn can_read(&self, chart: &ChartSummary) -> bool {
        self.operator || chart.owner_id == self.id || chart.scope == ChartScope::Church
    }
    pub fn can_edit(&self, chart: &ChartSummary) -> bool {
        self.operator
            || (chart.owner_id == self.id
                && (chart.scope == ChartScope::Personal || self.can_publish))
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartTransformResult {
    pub document: ChartDocument,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartImportResult {
    pub document: ChartDocument,
    pub warnings: Vec<String>,
    pub format: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapoSuggestion {
    pub id: String,
    pub capo: u8,
    pub shape_key: Option<String>,
    pub score: u32,
    pub explanation: String,
    pub document: ChartDocument,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySuggestion {
    pub key: String,
    pub score: u32,
    pub explanation: String,
}

impl ChartDocument {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != 1 {
            return Err("Formato de cifra não suportado. Atualize o aplicativo.".into());
        }
        if self.title.trim().is_empty()
            || self.title.len() > 600
            || self.artist.as_ref().is_some_and(|v| v.len() > 600)
        {
            return Err("Informe um título de cifra válido (até 600 bytes).".into());
        }
        if self.capo > 5 {
            return Err("O capotraste deve estar entre 0 e 5.".into());
        }
        if self.sections.is_empty()
            || self.sections.len() > 200
            || self.sequence.is_empty()
            || self.sequence.len() > 1000
        {
            return Err("A cifra deve conter seções e uma sequência válida (até 200 seções e 1.000 ocorrências).".into());
        }
        if self.notes.len() > 20_000 || self.preserved_directives.len() > 200 {
            return Err("As notas ou diretivas excedem o limite da cifra.".into());
        }
        let mut ids = HashSet::new();
        let mut section_ids = HashSet::new();
        let mut size = self.notes.len();
        let mut count = 0;
        let mut check_id = |id: &str| -> Result<(), String> {
            if id.is_empty() || id.len() > 128 || !ids.insert(id.to_string()) {
                Err("A cifra contém identificadores vazios ou repetidos.".into())
            } else {
                Ok(())
            }
        };
        for section in &self.sections {
            check_id(&section.id)?;
            section_ids.insert(section.id.as_str());
            if section.label.len() > 200 || section.label.contains(['\n', '\r', '{', '}']) {
                return Err("O nome da seção é inválido.".into());
            }
            for line in &section.lines {
                count += 1;
                check_id(&line.id)?;
                size += line.text.len();
                if line.text.contains(['\n', '\r'])
                    || line.text.len() > 10_000
                    || line.chords.len() > 200
                {
                    return Err(
                        "Cada linha deve ter somente um parágrafo e até 200 acordes.".into(),
                    );
                }
                let length = line.text.graphemes(true).count();
                for chord in &line.chords {
                    check_id(&chord.id)?;
                    size += chord.symbol.len();
                    if chord.offset > length
                        || chord.symbol.trim().is_empty()
                        || chord.symbol.len() > 80
                        || chord.symbol.contains(['\n', '\r', '[', ']'])
                    {
                        return Err(
                            "Há um acorde vazio ou fora dos limites da linha. Revise suas âncoras."
                                .into(),
                        );
                    }
                }
            }
        }
        for occurrence in &self.sequence {
            check_id(&occurrence.id)?;
            if !section_ids.contains(occurrence.section_id.as_str()) {
                return Err("A sequência referencia uma seção que não existe.".into());
            }
        }
        for directive in &self.preserved_directives {
            if directive.len() > 1000
                || !directive.starts_with('{')
                || !directive.ends_with('}')
                || directive.contains(['\n', '\r'])
            {
                return Err("Diretiva ChordPro inválida.".into());
            }
            size += directive.len();
        }
        if count > 4000 || size > 500_000 {
            return Err("Cifra muito grande. Limite: 4.000 linhas e 500 KB de texto.".into());
        }
        Ok(())
    }
}
