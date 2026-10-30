use super::database::Database;
use crate::{application::charts::validate_document, domain::charts::*};
use chrono::Utc;
use rusqlite::{params, OptionalExtension, Row};
use uuid::Uuid;

pub(super) const MIGRATION_4: &str = r#"
CREATE TABLE charts (
 id TEXT PRIMARY KEY NOT NULL,
 song_id TEXT NOT NULL,
 song_ref TEXT REFERENCES songs(id) ON DELETE SET NULL,
 name TEXT NOT NULL CHECK(length(trim(name))>0),
 owner_id TEXT NOT NULL,
 scope TEXT NOT NULL CHECK(scope IN ('personal','church')),
 revision INTEGER NOT NULL CHECK(revision>0),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 source_chart_id TEXT REFERENCES charts(id),
 source_revision_id TEXT REFERENCES chart_revisions(id),
 source_author_id TEXT,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
);
CREATE INDEX charts_song ON charts(song_id, archived);
CREATE INDEX charts_access ON charts(owner_id,scope,archived);
CREATE TABLE chart_revisions (
 id TEXT PRIMARY KEY NOT NULL,
 chart_id TEXT NOT NULL REFERENCES charts(id),
 revision INTEGER NOT NULL CHECK(revision>0),
 author_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 document_json TEXT NOT NULL,
 source_song_updated_at TEXT NOT NULL,
 UNIQUE(chart_id,revision)
);
CREATE TRIGGER chart_revision_immutable_update BEFORE UPDATE ON chart_revisions
BEGIN SELECT RAISE(ABORT,'chart revisions are immutable'); END;
CREATE TRIGGER chart_revision_immutable_delete BEFORE DELETE ON chart_revisions
BEGIN SELECT RAISE(ABORT,'chart revisions are immutable'); END;
"#;
const COLUMNS: &str =
    "id,song_id,name,owner_id,scope,revision,created_at,updated_at,source_chart_id,source_revision_id,source_author_id";
fn error(error: rusqlite::Error) -> String {
    eprintln!("LouvaShow: persistência de cifras: {error}");
    "Não foi possível acessar as cifras. Seus dados foram preservados; tente novamente.".into()
}
fn summary(row: &Row<'_>) -> rusqlite::Result<ChartSummary> {
    let scope: String = row.get(4)?;
    Ok(ChartSummary {
        id: row.get(0)?,
        song_id: row.get(1)?,
        name: row.get(2)?,
        owner_id: row.get(3)?,
        scope: if scope == "church" {
            ChartScope::Church
        } else {
            ChartScope::Personal
        },
        revision: row.get::<_, i64>(5)? as u64,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        source_chart_id: row.get(8)?,
        source_revision_id: row.get(9)?,
        source_author_id: row.get(10)?,
    })
}
fn revision(row: &Row<'_>) -> rusqlite::Result<ChartRevision> {
    let json: String = row.get(5)?;
    let document = serde_json::from_str(&json).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(5, rusqlite::types::Type::Text, Box::new(e))
    })?;
    Ok(ChartRevision {
        id: row.get(0)?,
        chart_id: row.get(1)?,
        revision: row.get::<_, i64>(2)? as u64,
        author_id: row.get(3)?,
        created_at: row.get(4)?,
        document,
        source_song_updated_at: row.get(6)?,
    })
}
fn valid_actor(actor: &ChartActor) -> Result<(), String> {
    if actor.id.trim().is_empty() || actor.id.len() > 128 {
        Err("Perfil inválido para acessar cifras.".into())
    } else {
        Ok(())
    }
}
fn sql_revision(value: u64) -> Result<i64, String> {
    i64::try_from(value).map_err(|_| "Revisão de cifra fora dos limites.".into())
}
impl Database {
    pub fn list_charts(
        &self,
        actor: &ChartActor,
        song_id: Option<&str>,
    ) -> Result<Vec<ChartSummary>, String> {
        valid_actor(actor)?;
        let sql=format!("SELECT {COLUMNS} FROM charts WHERE archived=0 AND (?1 OR owner_id=?2 OR scope='church') AND (?3 IS NULL OR song_id=?3) ORDER BY updated_at DESC,id");
        let mut statement = self.connection.prepare(&sql).map_err(error)?;
        let rows = statement
            .query_map(params![actor.operator, actor.id, song_id], summary)
            .map_err(error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(error)?;
        Ok(rows)
    }
    fn chart_summary(&self, id: &str) -> Result<ChartSummary, String> {
        self.connection
            .query_row(
                &format!("SELECT {COLUMNS} FROM charts WHERE id=?1"),
                [id],
                summary,
            )
            .optional()
            .map_err(error)?
            .ok_or_else(|| "Cifra não encontrada.".into())
    }
    pub fn get_chart(
        &self,
        actor: &ChartActor,
        id: &str,
        selected_revision: Option<u64>,
    ) -> Result<Chart, String> {
        valid_actor(actor)?;
        let summary = self.chart_summary(id)?;
        if !actor.can_read(&summary) {
            return Err("Você não tem acesso a esta cifra.".into());
        }
        let selected_revision = sql_revision(selected_revision.unwrap_or(summary.revision))?;
        let current=self.connection.query_row("SELECT id,chart_id,revision,author_id,created_at,document_json,source_song_updated_at FROM chart_revisions WHERE chart_id=?1 AND revision=?2",params![id,selected_revision],revision).optional().map_err(error)?.ok_or("Revisão da cifra não encontrada.")?;
        Ok(Chart { summary, current })
    }
    pub fn list_chart_revisions(
        &self,
        actor: &ChartActor,
        id: &str,
    ) -> Result<Vec<ChartRevision>, String> {
        valid_actor(actor)?;
        let chart = self.chart_summary(id)?;
        if !actor.can_read(&chart) {
            return Err("Você não tem acesso a esta cifra.".into());
        }
        let mut statement=self.connection.prepare("SELECT id,chart_id,revision,author_id,created_at,document_json,source_song_updated_at FROM chart_revisions WHERE chart_id=?1 ORDER BY revision DESC").map_err(error)?;
        let rows = statement
            .query_map([id], revision)
            .map_err(error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(error)?;
        Ok(rows)
    }
    pub fn save_chart(
        &mut self,
        actor: &ChartActor,
        input: SaveChartInput,
    ) -> Result<Chart, String> {
        valid_actor(actor)?;
        validate_document(&input.document)?;
        let name = input.name.trim();
        if name.is_empty() || name.len() > 240 {
            return Err("Informe um nome de versão com até 240 bytes.".into());
        }
        if input.scope == ChartScope::Church && !actor.can_publish && !actor.operator {
            return Err("Peça ao operador para publicar a cifra para a igreja.".into());
        }
        let now = Utc::now().to_rfc3339();
        let document = serde_json::to_string(&input.document)
            .map_err(|_| "Não foi possível preparar a cifra para salvar.")?;
        let mut source_revision = None;
        let mut source_author = None;
        let (chart_id, next_revision, source_time) = if let Some(id) = &input.id {
            let existing = self.get_chart(actor, id, None)?;
            if !actor.can_edit(&existing.summary) {
                return Err("Você não pode editar esta cifra. Crie uma versão pessoal.".into());
            }
            if input.expected_revision != Some(existing.summary.revision) {
                return Err("CONFLICT: A cifra mudou em outro dispositivo. Preserve seu rascunho e compare a revisão atual.".into());
            }
            if input.song_id != existing.summary.song_id
                || input.scope != existing.summary.scope
                || input.source_chart_id != existing.summary.source_chart_id
            {
                return Err("Origem e escopo não podem mudar ao salvar. Duplique ou publique uma nova versão.".into());
            }
            (
                id.clone(),
                existing.summary.revision + 1,
                existing.current.source_song_updated_at,
            )
        } else {
            if input.expected_revision.is_some() {
                return Err("Uma cifra nova não possui revisão anterior.".into());
            }
            let song = self.get_song(&input.song_id)?;
            let source_time = if let Some(source_id) = &input.source_chart_id {
                let source = self.get_chart(actor, source_id, None)?;
                if source.summary.song_id != input.song_id {
                    return Err("A versão de origem pertence a outra música.".into());
                }
                source_revision = Some(source.current.id);
                source_author = Some(source.current.author_id);
                source.current.source_song_updated_at
            } else {
                song.updated_at
            };
            (Uuid::new_v4().to_string(), 1, source_time)
        };
        let next_revision = sql_revision(next_revision)?;
        let expected_revision = input.expected_revision.map(sql_revision).transpose()?;
        let tx = self.connection.transaction().map_err(error)?;
        if input.id.is_some() {
            let changed=tx.execute("UPDATE charts SET name=?1,revision=?2,updated_at=?3 WHERE id=?4 AND revision=?5 AND archived=0",params![name,next_revision,now,chart_id,expected_revision]).map_err(error)?;
            if changed != 1 {
                return Err(
                    "CONFLICT: Cifra alterada ou arquivada. Seu rascunho não foi sobrescrito."
                        .into(),
                );
            }
        } else {
            tx.execute("INSERT INTO charts(id,song_id,song_ref,name,owner_id,scope,revision,created_at,updated_at,source_chart_id,source_revision_id,source_author_id) VALUES(?1,?2,?2,?3,?4,?5,1,?6,?6,?7,?8,?9)",params![chart_id,input.song_id,name,actor.id,input.scope.as_str(),now,input.source_chart_id,source_revision,source_author]).map_err(error)?;
        }
        tx.execute("INSERT INTO chart_revisions(id,chart_id,revision,author_id,created_at,document_json,source_song_updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![Uuid::new_v4().to_string(),chart_id,next_revision,actor.id,now,document,source_time]).map_err(error)?;
        tx.commit().map_err(error)?;
        self.get_chart(actor, &chart_id, None)
    }
    pub fn delete_chart(
        &mut self,
        actor: &ChartActor,
        id: &str,
        expected_revision: u64,
    ) -> Result<(), String> {
        valid_actor(actor)?;
        let chart = self.chart_summary(id)?;
        if !actor.can_edit(&chart) {
            return Err("Você não pode excluir esta cifra.".into());
        }
        let expected_revision = sql_revision(expected_revision)?;
        let count=self.connection.execute("UPDATE charts SET archived=1,updated_at=?1 WHERE id=?2 AND revision=?3 AND archived=0",params![Utc::now().to_rfc3339(),id,expected_revision]).map_err(error)?;
        if count != 1 {
            return Err("CONFLICT: A cifra mudou ou já foi arquivada. Atualize a lista.".into());
        }
        Ok(())
    }
    pub fn publish_chart(
        &mut self,
        actor: &ChartActor,
        id: &str,
        expected_revision: u64,
        name: &str,
    ) -> Result<Chart, String> {
        valid_actor(actor)?;
        if !actor.can_publish && !actor.operator {
            return Err("Somente um perfil autorizado pode publicar para a igreja.".into());
        }
        let chart = self.get_chart(actor, id, None)?;
        if chart.summary.revision != expected_revision {
            return Err("CONFLICT: A cifra mudou. Revise antes de publicar.".into());
        }
        self.save_chart(
            actor,
            SaveChartInput {
                id: None,
                song_id: chart.summary.song_id,
                name: name.into(),
                scope: ChartScope::Church,
                expected_revision: None,
                document: chart.current.document,
                source_chart_id: Some(id.into()),
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        application::charts::document_from_song,
        domain::library::{SaveBlockInput, SaveSongInput},
    };
    fn actor(id: &str) -> ChartActor {
        ChartActor {
            id: id.into(),
            can_publish: false,
            operator: false,
        }
    }
    fn setup() -> (Database, SaveChartInput) {
        let mut db = Database::open(":memory:").unwrap();
        let song = db
            .save_song(SaveSongInput {
                id: None,
                title: "Original".into(),
                artist: None,
                category_id: None,
                copyright: None,
                blocks: vec![SaveBlockInput {
                    id: None,
                    label: None,
                    text: "Texto original".into(),
                }],
            })
            .unwrap();
        let document = document_from_song(&song);
        (
            db,
            SaveChartInput {
                id: None,
                song_id: song.id,
                name: "Violão".into(),
                scope: ChartScope::Personal,
                expected_revision: None,
                document,
                source_chart_id: None,
            },
        )
    }
    #[test]
    fn revisions_are_immutable_and_cas_preserves_both_versions() {
        let (mut db, input) = setup();
        let first = db.save_chart(&actor("one"), input.clone()).unwrap();
        let mut edit = input;
        edit.id = Some(first.summary.id.clone());
        edit.expected_revision = Some(1);
        edit.document.notes = "Nova nota".into();
        db.save_chart(&actor("one"), edit.clone()).unwrap();
        assert!(db
            .save_chart(&actor("one"), edit)
            .unwrap_err()
            .starts_with("CONFLICT:"));
        let old = db
            .get_chart(&actor("one"), &first.summary.id, Some(1))
            .unwrap();
        assert!(old.current.document.notes.is_empty());
        assert_eq!(
            db.list_chart_revisions(&actor("one"), &first.summary.id)
                .unwrap()
                .len(),
            2
        );
        assert!(db
            .connection
            .execute("UPDATE chart_revisions SET author_id='intruder'", [])
            .is_err());
    }
    #[test]
    fn personal_charts_are_isolated_and_church_copy_keeps_origin() {
        let (mut db, input) = setup();
        let first = db.save_chart(&actor("one"), input).unwrap();
        assert!(db.list_charts(&actor("two"), None).unwrap().is_empty());
        assert!(db
            .get_chart(&actor("two"), &first.summary.id, None)
            .is_err());
        assert!(db
            .publish_chart(&actor("one"), &first.summary.id, 1, "Igreja")
            .is_err());
        let church = db
            .publish_chart(&ChartActor::desktop(), &first.summary.id, 1, "Igreja")
            .unwrap();
        assert_eq!(
            church.summary.source_chart_id.as_deref(),
            Some(first.summary.id.as_str())
        );
        assert_eq!(db.list_charts(&actor("two"), None).unwrap().len(), 1);
        assert!(db
            .delete_chart(&actor("two"), &church.summary.id, 1)
            .is_err());
    }
    #[test]
    fn archiving_and_song_deletion_preserve_pinned_revisions() {
        let (mut db, input) = setup();
        let song_id = input.song_id.clone();
        let chart = db.save_chart(&actor("one"), input).unwrap();
        db.delete_chart(&actor("one"), &chart.summary.id, 1)
            .unwrap();
        assert!(db.list_charts(&actor("one"), None).unwrap().is_empty());
        db.delete_song(&song_id).unwrap();
        assert!(db
            .get_chart(&actor("one"), &chart.summary.id, Some(1))
            .is_ok());
    }
    #[test]
    fn chart_changes_do_not_change_lyrics() {
        let (mut db, mut input) = setup();
        let song_id = input.song_id.clone();
        input.document.sections[0].lines[0].text = "Outra letra só na cifra".into();
        db.save_chart(&actor("one"), input).unwrap();
        assert_eq!(
            db.get_song(&song_id).unwrap().blocks[0].text,
            "Texto original"
        );
    }
    #[test]
    fn chart_migration_and_reopening_preserve_data() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.sqlite3");
        let db = Database::open(&path).unwrap();
        assert_eq!(
            db.connection
                .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            4
        );
        drop(db);
        let db = Database::open(path).unwrap();
        assert!(db.list_charts(&actor("one"), None).unwrap().is_empty());
    }
    #[test]
    fn migration_from_v3_keeps_existing_song_and_persists_chart() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("old.sqlite3");
        let mut db = Database::open(&path).unwrap();
        let song = db
            .save_song(SaveSongInput {
                id: None,
                title: "Música existente".into(),
                artist: None,
                category_id: None,
                copyright: None,
                blocks: vec![SaveBlockInput {
                    id: None,
                    label: None,
                    text: "Conteúdo preservado".into(),
                }],
            })
            .unwrap();
        db.connection.execute_batch("DROP TRIGGER chart_revision_immutable_update; DROP TRIGGER chart_revision_immutable_delete; DROP TABLE chart_revisions; DROP TABLE charts; PRAGMA user_version=3;").unwrap();
        drop(db);
        let mut db = Database::open(&path).unwrap();
        let stored = db.get_song(&song.id).unwrap();
        assert_eq!(stored.blocks[0].text, "Conteúdo preservado");
        let chart = db
            .save_chart(
                &actor("one"),
                SaveChartInput {
                    id: None,
                    song_id: stored.id.clone(),
                    name: "Versão".into(),
                    scope: ChartScope::Personal,
                    expected_revision: None,
                    document: document_from_song(&stored),
                    source_chart_id: None,
                },
            )
            .unwrap();
        drop(db);
        let db = Database::open(path).unwrap();
        assert_eq!(
            db.get_chart(&actor("one"), &chart.summary.id, None)
                .unwrap()
                .current
                .document
                .title,
            "Música existente"
        );
        assert_eq!(
            db.get_song(&song.id).unwrap().blocks[0].text,
            "Conteúdo preservado"
        );
    }
}
