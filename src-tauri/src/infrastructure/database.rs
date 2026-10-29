use crate::domain::{
    importing::ImportSong,
    library::{
        Category, ImportResult, SaveSongInput, Setlist, SetlistItem, SetlistSummary, Song,
        SongBlock,
    },
};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, path::Path, time::Duration};
use uuid::Uuid;

const SETLIST_ID: &str = "default-setlist";
const SCHEMA_VERSION: i64 = 3;
const MIGRATION_1: &str = r#"
CREATE TABLE songs (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK(length(trim(title)) > 0),
    artist TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE song_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    label TEXT,
    text TEXT NOT NULL CHECK(length(trim(text)) > 0),
    position INTEGER NOT NULL CHECK(position >= 0),
    UNIQUE(song_id, position)
);
CREATE TABLE setlists (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE setlist_items (
    id TEXT PRIMARY KEY NOT NULL,
    setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK(position >= 0)
);
CREATE INDEX setlist_items_order ON setlist_items(setlist_id, position);
CREATE INDEX setlist_items_song ON setlist_items(song_id);
"#;

/// Native persistence boundary. Call on a blocking worker, never the UI thread.
/// No SQL is accepted from the webview and failed migrations never reset data.
pub struct Database {
    connection: Connection,
}

fn db_error(context: &str, error: rusqlite::Error) -> String {
    // SQLite errors contain schema/constraint names, never log bound lyric values.
    eprintln!("LouvaShow: {context}: {error}");
    format!("Não foi possível {context}. Seus dados não foram apagados. Verifique o espaço em disco e tente novamente.")
}

fn clean_optional(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

impl Database {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let mut connection =
            Connection::open(path).map_err(|e| db_error("abrir o banco local", e))?;
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|e| db_error("configurar o banco", e))?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| db_error("ativar integridade do banco", e))?;
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(|e| db_error("ler a versão do banco", e))?;
        if version > SCHEMA_VERSION {
            return Err("Este banco foi criado por uma versão mais recente do LouvaShow. Atualize o aplicativo para abri-lo.".into());
        }
        if version == 0 {
            let tx = connection
                .transaction()
                .map_err(|e| db_error("iniciar a migração", e))?;
            tx.execute_batch(MIGRATION_1)
                .map_err(|e| db_error("migrar o banco", e))?;
            let now = Utc::now().to_rfc3339();
            tx.execute(
                "INSERT INTO setlists(id,name,created_at,updated_at) VALUES(?1,?2,?3,?3)",
                params![SETLIST_ID, "Repertório", now],
            )
            .map_err(|e| db_error("criar o repertório", e))?;
            tx.pragma_update(None, "user_version", 1)
                .map_err(|e| db_error("registrar a migração", e))?;
            tx.commit()
                .map_err(|e| db_error("concluir a migração", e))?;
        }
        if version < 2 {
            let tx = connection
                .transaction()
                .map_err(|e| db_error("iniciar migração das preferências", e))?;
            tx.execute_batch(
                "CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);",
            )
            .map_err(|e| db_error("migrar as preferências", e))?;
            tx.pragma_update(None, "user_version", 2)
                .map_err(|e| db_error("registrar migração das preferências", e))?;
            tx.commit()
                .map_err(|e| db_error("concluir migração das preferências", e))?;
        }
        if version < 3 {
            // SQLite cannot add a non-null REFERENCES column with a non-null
            // default while foreign_keys is enabled. Disable only on this new,
            // private connection and validate all references before committing.
            connection
                .pragma_update(None, "foreign_keys", "OFF")
                .map_err(|e| db_error("preparar migração das classificações", e))?;
            let tx = connection
                .transaction()
                .map_err(|e| db_error("iniciar migração das classificações", e))?;
            tx.execute_batch("CREATE TABLE categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE);
                INSERT INTO categories(id,name,normalized_name) VALUES('hinos','Hinos','hinos'),('musica','Música','música');
                ALTER TABLE songs ADD COLUMN category_id TEXT NOT NULL DEFAULT 'musica' REFERENCES categories(id);
                ALTER TABLE songs ADD COLUMN copyright TEXT;
                CREATE INDEX songs_category ON songs(category_id);
                CREATE TABLE song_imports (fingerprint TEXT PRIMARY KEY NOT NULL, song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE);
                CREATE INDEX song_imports_song ON song_imports(song_id);")
                .map_err(|e| db_error("migrar as classificações", e))?;
            let violations: i64 = tx
                .query_row("SELECT count(*) FROM pragma_foreign_key_check", [], |r| {
                    r.get(0)
                })
                .map_err(|e| db_error("verificar integridade da migração", e))?;
            if violations != 0 {
                return Err("O banco contém referências inválidas. A migração foi cancelada sem apagar os dados.".into());
            }
            tx.pragma_update(None, "user_version", SCHEMA_VERSION)
                .map_err(|e| db_error("registrar migração das classificações", e))?;
            tx.commit()
                .map_err(|e| db_error("concluir migração das classificações", e))?;
            connection
                .pragma_update(None, "foreign_keys", "ON")
                .map_err(|e| db_error("reativar integridade do banco", e))?;
        }
        Ok(Self { connection })
    }

    pub fn list_categories(&self) -> Result<Vec<Category>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT id,name FROM categories ORDER BY normalized_name,id")
            .map_err(|e| db_error("listar as classificações", e))?;
        let categories = statement
            .query_map([], |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|e| db_error("ler as classificações", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| db_error("ler as classificações", e))?;
        Ok(categories)
    }

    fn category_name(name: &str) -> Result<(String, String), String> {
        let display = name.split_whitespace().collect::<Vec<_>>().join(" ");
        if display.is_empty() || display.chars().count() > 80 {
            return Err("Informe uma classificação entre 1 e 80 caracteres.".into());
        }
        let normalized = display.to_lowercase();
        Ok((display, normalized))
    }

    pub fn create_category(&mut self, name: &str) -> Result<Category, String> {
        let (name, normalized) = Self::category_name(name)?;
        let id = Uuid::new_v4().to_string();
        let exists: bool = self
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE normalized_name=?1)",
                [&normalized],
                |r| r.get(0),
            )
            .map_err(|e| db_error("verificar a classificação", e))?;
        if exists {
            return Err("Já existe uma classificação com esse nome.".into());
        }
        self.connection
            .execute(
                "INSERT INTO categories(id,name,normalized_name) VALUES(?1,?2,?3)",
                params![id, name, normalized],
            )
            .map_err(|e| db_error("criar a classificação", e))?;
        Ok(Category { id, name })
    }

    pub fn rename_category(&mut self, id: &str, name: &str) -> Result<Category, String> {
        Self::require_category(&self.connection, id)?;
        let (name, normalized) = Self::category_name(name)?;
        let exists: bool = self
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE normalized_name=?1 AND id<>?2)",
                params![normalized, id],
                |r| r.get(0),
            )
            .map_err(|e| db_error("verificar a classificação", e))?;
        if exists {
            return Err("Já existe uma classificação com esse nome.".into());
        }
        self.connection
            .execute(
                "UPDATE categories SET name=?1,normalized_name=?2 WHERE id=?3",
                params![name, normalized, id],
            )
            .map_err(|e| db_error("renomear a classificação", e))?;
        Ok(Category {
            id: id.into(),
            name,
        })
    }

    fn require_category(connection: &Connection, id: &str) -> Result<(), String> {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)",
                [id],
                |row| row.get(0),
            )
            .map_err(|e| db_error("verificar a classificação", e))?;
        if !exists {
            return Err("A classificação não existe mais. Atualize a biblioteca.".into());
        }
        Ok(())
    }

    fn require_songs(connection: &Connection, ids: &[String]) -> Result<(), String> {
        if ids.is_empty() || ids.len() > 20_000 {
            return Err("Selecione entre 1 e 20.000 músicas.".into());
        }
        let unique: HashSet<_> = ids.iter().collect();
        if unique.len() != ids.len() {
            return Err("A seleção contém músicas repetidas. Atualize a lista.".into());
        }
        let mut query = connection
            .prepare_cached("SELECT EXISTS(SELECT 1 FROM songs WHERE id=?1)")
            .map_err(|e| db_error("verificar as músicas selecionadas", e))?;
        for id in ids {
            let exists: bool = query
                .query_row([id], |r| r.get(0))
                .map_err(|e| db_error("verificar as músicas selecionadas", e))?;
            if !exists {
                return Err(
                    "Uma música selecionada não existe mais. Atualize a lista e tente novamente."
                        .into(),
                );
            }
        }
        Ok(())
    }

    pub fn bulk_set_category(&mut self, ids: &[String], category_id: &str) -> Result<(), String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a classificação em lote", e))?;
        Self::require_category(&tx, category_id)?;
        Self::require_songs(&tx, ids)?;
        let now = Utc::now().to_rfc3339();
        for id in ids {
            tx.execute(
                "UPDATE songs SET category_id=?1,updated_at=?2 WHERE id=?3",
                params![category_id, now, id],
            )
            .map_err(|e| db_error("classificar as músicas", e))?;
        }
        tx.commit()
            .map_err(|e| db_error("salvar a classificação em lote", e))
    }

    pub fn bulk_song_usage(&self, ids: &[String]) -> Result<usize, String> {
        Self::require_songs(&self.connection, ids)?;
        ids.iter().try_fold(0, |total, id| {
            self.song_usage(id).map(|count| total + count)
        })
    }

    pub fn bulk_delete_songs(&mut self, ids: &[String]) -> Result<(), String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a exclusão em lote", e))?;
        Self::require_songs(&tx, ids)?;
        let mut affected = HashSet::new();
        {
            let mut query = tx
                .prepare_cached("SELECT DISTINCT setlist_id FROM setlist_items WHERE song_id=?1")
                .map_err(|e| db_error("consultar repertórios afetados", e))?;
            for id in ids {
                let rows = query
                    .query_map([id], |row| row.get::<_, String>(0))
                    .map_err(|e| db_error("consultar repertórios afetados", e))?;
                for row in rows {
                    affected.insert(row.map_err(|e| db_error("consultar repertórios afetados", e))?);
                }
            }
        }
        for id in ids {
            tx.execute("DELETE FROM songs WHERE id=?1", [id])
                .map_err(|e| db_error("excluir as músicas selecionadas", e))?;
        }
        for id in affected {
            Self::normalize_positions(&tx, &id)?;
            Self::touch_setlist(&tx, &id)?;
        }
        tx.commit()
            .map_err(|e| db_error("concluir a exclusão em lote", e))
    }

    pub fn import_songs(
        &mut self,
        songs: Vec<ImportSong>,
        category_id: &str,
    ) -> Result<ImportResult, String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a importação", e))?;
        let result = Self::import_batch(&tx, songs, category_id)?;
        tx.commit()
            .map_err(|e| db_error("concluir a importação", e))?;
        Ok(result)
    }

    /// Seed installation is explicitly invoked by the application; never open().
    /// The marker commits with the songs, so deleted seed songs stay deleted.
    #[cfg(any(test, feature = "bundled-hymns"))]
    pub fn install_seed_pack(
        &mut self,
        pack_id: &str,
        songs: Vec<ImportSong>,
        category_id: &str,
    ) -> Result<ImportResult, String> {
        if pack_id.is_empty()
            || pack_id.len() > 80
            || !pack_id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
        {
            return Err("O identificador do pacote inicial é inválido.".into());
        }
        let key = format!("seed-pack.{pack_id}");
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a instalação do pacote", e))?;
        let installed: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM settings WHERE key=?1)",
                [&key],
                |row| row.get(0),
            )
            .map_err(|e| db_error("verificar o pacote inicial", e))?;
        if installed {
            return Ok(ImportResult {
                imported: 0,
                skipped: songs.len(),
            });
        }
        let result = Self::import_batch(&tx, songs, category_id)?;
        tx.execute(
            "INSERT INTO settings(key,value) VALUES(?1,?2)",
            params![key, Utc::now().to_rfc3339()],
        )
        .map_err(|e| db_error("registrar o pacote inicial", e))?;
        tx.commit()
            .map_err(|e| db_error("concluir a instalação do pacote", e))?;
        Ok(result)
    }

    fn import_batch(
        connection: &Connection,
        songs: Vec<ImportSong>,
        category_id: &str,
    ) -> Result<ImportResult, String> {
        if !category_id.is_empty() {
            Self::require_category(connection, category_id)?;
        }
        if songs.is_empty() || songs.len() > 20_000 {
            return Err("O lote deve conter entre 1 e 20.000 músicas.".into());
        }
        // The native import command can receive typed songs directly; do not rely
        // exclusively on ZIP/XML parser limits to bound work on this boundary.
        let mut total_bytes = 0usize;
        for song in &songs {
            for text in std::iter::once(song.title.as_str())
                .chain(song.artist.as_deref())
                .chain(song.copyright.as_deref())
                .chain(song.category_name.as_deref())
                .chain(song.blocks.iter().flat_map(|block| {
                    std::iter::once(block.text.as_str()).chain(block.label.as_deref())
                }))
            {
                total_bytes = total_bytes.saturating_add(text.len());
                if total_bytes > 24 * 1024 * 1024 {
                    return Err(
                        "O conteúdo do lote excede 24 MiB. Importe menos músicas por vez.".into(),
                    );
                }
            }
        }
        let mut result = ImportResult {
            imported: 0,
            skipped: 0,
        };
        let now = Utc::now().to_rfc3339();
        for song in songs {
            let title = song.title.trim();
            if title.is_empty()
                || title.chars().count() > 300
                || song
                    .artist
                    .as_ref()
                    .is_some_and(|s| s.chars().count() > 300)
            {
                return Err("Uma música importada tem título ou artista inválido. Nenhuma música deste lote foi importada.".into());
            }
            let blocks: Vec<_> = song
                .blocks
                .into_iter()
                .filter(|b| !b.text.trim().is_empty())
                .collect();
            if blocks.is_empty()
                || blocks.len() > 500
                || blocks.iter().any(|b| {
                    b.text.len() > 32_000
                        || b.label.as_ref().is_some_and(|s| s.chars().count() > 100)
                })
            {
                return Err("Uma música importada tem blocos vazios ou excessivamente grandes. Nenhuma música deste lote foi importada.".into());
            }
            if song.copyright.as_ref().is_some_and(|s| s.len() > 4000) {
                return Err("O aviso de direitos autorais excede o limite permitido. A importação foi cancelada.".into());
            }
            let normalized = |s: &str| {
                s.split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ")
                    .to_lowercase()
            };
            // JSON preserves boundaries: concatenation alone could confuse two
            // distinct block sequences. Copyright/category are metadata, not identity.
            let content = serde_json::to_vec(&(
                normalized(title),
                normalized(song.artist.as_deref().unwrap_or("")),
                blocks
                    .iter()
                    .map(|b| normalized(&b.text))
                    .collect::<Vec<_>>(),
            ))
            .map_err(|_| "Não foi possível identificar o conteúdo importado.")?;
            let fingerprint = format!("{:x}", Sha256::digest(content));
            let exists: bool = connection
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM song_imports WHERE fingerprint=?1)",
                    [&fingerprint],
                    |r| r.get(0),
                )
                .map_err(|e| db_error("verificar músicas já importadas", e))?;
            if exists {
                result.skipped += 1;
                continue;
            }
            let resolved_category = if category_id.is_empty() {
                if let Some(name) = song
                    .category_name
                    .as_deref()
                    .filter(|name| !name.trim().is_empty())
                {
                    let (display, normalized) = Self::category_name(name)?;
                    let existing = connection
                        .query_row(
                            "SELECT id FROM categories WHERE normalized_name=?1",
                            [&normalized],
                            |row| row.get::<_, String>(0),
                        )
                        .optional()
                        .map_err(|e| db_error("localizar classificação importada", e))?;
                    if let Some(id) = existing {
                        id
                    } else {
                        let id = Uuid::new_v4().to_string();
                        connection
                            .execute(
                                "INSERT INTO categories(id,name,normalized_name) VALUES(?1,?2,?3)",
                                params![id, display, normalized],
                            )
                            .map_err(|e| db_error("importar a classificação", e))?;
                        id
                    }
                } else {
                    "musica".to_string()
                }
            } else {
                category_id.to_string()
            };
            let id = Uuid::new_v4().to_string();
            connection.execute("INSERT INTO songs(id,title,artist,created_at,updated_at,category_id,copyright) VALUES(?1,?2,?3,?4,?4,?5,?6)",
                params![id,title,clean_optional(song.artist),now,resolved_category,clean_optional(song.copyright)])
                .map_err(|e| db_error("importar a música", e))?;
            for (position, block) in blocks.into_iter().enumerate() {
                let text = block.text.replace("\r\n", "\n").replace('\r', "\n");
                connection.execute("INSERT INTO song_blocks(id,song_id,label,text,position) VALUES(?1,?2,?3,?4,?5)",
                    params![Uuid::new_v4().to_string(),id,clean_optional(block.label),text.trim(),position as i64])
                    .map_err(|e| db_error("importar os blocos", e))?;
            }
            connection
                .execute(
                    "INSERT INTO song_imports(fingerprint,song_id) VALUES(?1,?2)",
                    params![fingerprint, id],
                )
                .map_err(|e| db_error("registrar a música importada", e))?;
            result.imported += 1;
        }
        Ok(result)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        self.connection
            .query_row("SELECT value FROM settings WHERE key=?1", [key], |row| {
                row.get(0)
            })
            .optional()
            .map_err(|e| db_error("ler a preferência local", e))
    }

    pub fn set_setting(&mut self, key: &str, value: &str) -> Result<(), String> {
        if key.is_empty() || key.len() > 100 || value.len() > 64_000 {
            return Err("A preferência informada excede o limite permitido.".into());
        }
        self.connection.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,value])
            .map_err(|e| db_error("salvar a preferência local", e))?;
        Ok(())
    }

    pub fn list_songs(&self) -> Result<Vec<Song>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT id FROM songs ORDER BY title COLLATE NOCASE, id")
            .map_err(|e| db_error("listar as músicas", e))?;
        let ids = statement
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| db_error("listar as músicas", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| db_error("ler as músicas", e))?;
        ids.iter().map(|id| self.get_song(id)).collect()
    }

    pub fn get_song(&self, id: &str) -> Result<Song, String> {
        let song = self
            .connection
            .query_row(
                "SELECT id,title,artist,created_at,updated_at,category_id,copyright FROM songs WHERE id=?1",
                [id],
                |row| {
                    Ok(Song {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        artist: row.get(2)?,
                        created_at: row.get(3)?,
                        updated_at: row.get(4)?,
                        category_id: row.get(5)?,
                        copyright: row.get(6)?,
                        blocks: Vec::new(),
                    })
                },
            )
            .optional()
            .map_err(|e| db_error("abrir a música", e))?;
        let mut song = song.ok_or("A música não foi encontrada. Atualize a biblioteca.")?;
        let mut statement = self.connection.prepare("SELECT id,song_id,label,text,position FROM song_blocks WHERE song_id=?1 ORDER BY position")
            .map_err(|e| db_error("abrir os blocos", e))?;
        song.blocks = statement
            .query_map([id], |row| {
                Ok(SongBlock {
                    id: row.get(0)?,
                    song_id: row.get(1)?,
                    label: row.get(2)?,
                    text: row.get(3)?,
                    position: row.get::<_, u32>(4)? as usize,
                })
            })
            .map_err(|e| db_error("abrir os blocos", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| db_error("ler os blocos", e))?;
        Ok(song)
    }

    pub fn save_song(&mut self, input: SaveSongInput) -> Result<Song, String> {
        let title = input.title.trim();
        if title.is_empty() || title.chars().count() > 300 {
            return Err("Informe um título entre 1 e 300 caracteres.".into());
        }
        if input
            .artist
            .as_ref()
            .is_some_and(|v| v.chars().count() > 300)
        {
            return Err("O nome do artista deve ter até 300 caracteres.".into());
        }
        let blocks: Vec<_> = input
            .blocks
            .into_iter()
            .filter(|block| !block.text.trim().is_empty())
            .collect();
        if blocks.is_empty() || blocks.len() > 500 {
            return Err("A música precisa ter entre 1 e 500 blocos não vazios.".into());
        }
        if blocks.iter().any(|b| {
            b.text.len() > 32_000 || b.label.as_ref().is_some_and(|s| s.chars().count() > 100)
        }) {
            return Err("Um bloco excedeu o limite de texto ou de rótulo. Divida a letra em blocos menores.".into());
        }
        let existing = input.id.as_ref().map(|id| self.get_song(id)).transpose()?;
        let existing_block_ids: HashSet<_> = existing
            .as_ref()
            .map(|song| song.blocks.iter().map(|b| b.id.clone()).collect())
            .unwrap_or_default();
        let mut provided_ids = HashSet::new();
        for block in &blocks {
            if let Some(id) = &block.id {
                if !existing_block_ids.contains(id) || !provided_ids.insert(id.clone()) {
                    return Err("Os identificadores dos blocos são inválidos. Reabra a música antes de salvar.".into());
                }
            }
        }
        let copyright = input
            .copyright
            .unwrap_or_else(|| existing.as_ref().and_then(|song| song.copyright.clone()));
        if copyright.as_ref().is_some_and(|value| value.len() > 4000) {
            return Err("O aviso de direitos autorais excede o limite permitido.".into());
        }
        let category_id = input
            .category_id
            .or_else(|| existing.as_ref().map(|song| song.category_id.clone()))
            .unwrap_or_else(|| "musica".into());
        Self::require_category(&self.connection, &category_id)?;
        let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let now = Utc::now().to_rfc3339();
        let created_at = existing
            .as_ref()
            .map(|s| s.created_at.clone())
            .unwrap_or_else(|| now.clone());
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar o salvamento", e))?;
        tx.execute("INSERT INTO songs(id,title,artist,created_at,updated_at,category_id,copyright) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET title=excluded.title,artist=excluded.artist,updated_at=excluded.updated_at,category_id=excluded.category_id,copyright=excluded.copyright",
            params![id, title, clean_optional(input.artist), created_at, now, category_id, clean_optional(copyright)]).map_err(|e| db_error("salvar a música", e))?;
        tx.execute("DELETE FROM song_blocks WHERE song_id=?1", [&id])
            .map_err(|e| db_error("atualizar os blocos", e))?;
        for (position, block) in blocks.into_iter().enumerate() {
            let block_id = block.id.unwrap_or_else(|| Uuid::new_v4().to_string());
            let text = block.text.replace("\r\n", "\n").replace('\r', "\n");
            tx.execute(
                "INSERT INTO song_blocks(id,song_id,label,text,position) VALUES(?1,?2,?3,?4,?5)",
                params![
                    block_id,
                    id,
                    clean_optional(block.label),
                    text.trim(),
                    position as i64
                ],
            )
            .map_err(|e| db_error("salvar os blocos", e))?;
        }
        tx.commit()
            .map_err(|e| db_error("concluir o salvamento", e))?;
        self.get_song(&id)
    }

    pub fn song_usage(&self, id: &str) -> Result<usize, String> {
        self.connection
            .query_row(
                "SELECT count(*) FROM setlist_items WHERE song_id=?1",
                [id],
                |row| Ok(row.get::<_, u32>(0)? as usize),
            )
            .map_err(|e| db_error("verificar o uso da música", e))
    }

    /// Caller must show song_usage before confirmation. Existing live snapshots are
    /// independent owned data and are deliberately not accessed here.
    pub fn delete_song(&mut self, id: &str) -> Result<(), String> {
        self.bulk_delete_songs(&[id.to_owned()])
    }

    fn setlist_name(name: &str) -> Result<&str, String> {
        let name = name.trim();
        if name.is_empty() || name.chars().count() > 120 {
            return Err("Informe um nome de repertório entre 1 e 120 caracteres.".into());
        }
        Ok(name)
    }

    fn require_setlist(connection: &Connection, id: &str) -> Result<(), String> {
        let exists: bool = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM setlists WHERE id=?1)",
                [id],
                |row| row.get(0),
            )
            .map_err(|e| db_error("verificar o repertório", e))?;
        if !exists {
            return Err("O repertório não existe mais. Atualize a lista e escolha outro.".into());
        }
        Ok(())
    }

    fn active_setlist_id(connection: &Connection) -> Result<String, String> {
        connection.query_row("SELECT id FROM setlists ORDER BY CASE WHEN id=(SELECT value FROM settings WHERE key='active-setlist') THEN 0 WHEN id=?1 THEN 1 ELSE 2 END,created_at,id LIMIT 1", [SETLIST_ID], |row| row.get(0))
            .optional().map_err(|e| db_error("consultar o repertório ativo", e))?
            .ok_or_else(|| "Nenhum repertório foi encontrado no banco. Os dados foram preservados; restaure um backup válido.".into())
    }

    fn persist_active_setlist(connection: &Connection, id: &str) -> Result<(), String> {
        connection.execute("INSERT INTO settings(key,value) VALUES('active-setlist',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE value<>excluded.value", [id])
            .map_err(|e| db_error("salvar o repertório ativo", e))?;
        Ok(())
    }

    pub fn list_setlists(&self) -> Result<Vec<SetlistSummary>, String> {
        let mut statement = self.connection.prepare("SELECT s.id,s.name,count(i.id) FROM setlists s LEFT JOIN setlist_items i ON i.setlist_id=s.id GROUP BY s.id ORDER BY s.created_at,s.id")
            .map_err(|e| db_error("listar os repertórios", e))?;
        let rows = statement
            .query_map([], |row| {
                Ok(SetlistSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    item_count: row.get::<_, u32>(2)? as usize,
                })
            })
            .map_err(|e| db_error("ler os repertórios", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| db_error("ler os repertórios", e))?;
        Ok(rows)
    }

    pub fn get_setlist(&self) -> Result<Setlist, String> {
        let id = Self::active_setlist_id(&self.connection)?;
        let setlist = Self::read_setlist(&self.connection, &id)?;
        Self::persist_active_setlist(&self.connection, &id)?;
        Ok(setlist)
    }

    pub fn select_setlist(&mut self, id: &str) -> Result<Setlist, String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a seleção do repertório", e))?;
        let setlist = Self::read_setlist(&tx, id)?;
        Self::persist_active_setlist(&tx, id)?;
        tx.commit()
            .map_err(|e| db_error("concluir a seleção do repertório", e))?;
        Ok(setlist)
    }

    pub fn create_setlist(&mut self, name: &str) -> Result<Setlist, String> {
        let name = Self::setlist_name(name)?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a criação do repertório", e))?;
        tx.execute(
            "INSERT INTO setlists(id,name,created_at,updated_at) VALUES(?1,?2,?3,?3)",
            params![id, name, now],
        )
        .map_err(|e| db_error("criar o repertório", e))?;
        Self::persist_active_setlist(&tx, &id)?;
        let setlist = Self::read_setlist(&tx, &id)?;
        tx.commit().map_err(|e| db_error("salvar o repertório", e))?;
        Ok(setlist)
    }

    pub fn rename_setlist(&mut self, id: &str, name: &str) -> Result<Setlist, String> {
        let name = Self::setlist_name(name)?;
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a alteração do repertório", e))?;
        Self::require_setlist(&tx, id)?;
        tx.execute(
            "UPDATE setlists SET name=?1,updated_at=?2 WHERE id=?3",
            params![name, Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| db_error("renomear o repertório", e))?;
        let setlist = Self::read_setlist(&tx, id)?;
        tx.commit()
            .map_err(|e| db_error("salvar o nome do repertório", e))?;
        Ok(setlist)
    }

    pub fn delete_setlist(&mut self, id: &str) -> Result<Setlist, String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a exclusão do repertório", e))?;
        Self::require_setlist(&tx, id)?;
        let count: i64 = tx
            .query_row("SELECT count(*) FROM setlists", [], |row| row.get(0))
            .map_err(|e| db_error("contar os repertórios", e))?;
        if count <= 1 {
            return Err(
                "Não é possível excluir o último repertório. Crie outro antes de excluir este."
                    .into(),
            );
        }
        tx.execute("DELETE FROM setlists WHERE id=?1", [id])
            .map_err(|e| db_error("excluir o repertório", e))?;
        let active = Self::active_setlist_id(&tx)?;
        Self::persist_active_setlist(&tx, &active)?;
        let setlist = Self::read_setlist(&tx, &active)?;
        tx.commit()
            .map_err(|e| db_error("concluir a exclusão do repertório", e))?;
        Ok(setlist)
    }

    fn read_setlist(connection: &Connection, id: &str) -> Result<Setlist, String> {
        let mut setlist = connection
            .query_row(
                "SELECT id,name,created_at,updated_at FROM setlists WHERE id=?1",
                [id],
                |row| {
                    Ok(Setlist {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                        items: Vec::new(),
                    })
                },
            )
            .optional()
            .map_err(|e| db_error("abrir o repertório", e))?
            .ok_or("O repertório não existe mais. Atualize a lista e escolha outro.")?;
        let mut statement = connection.prepare("SELECT id,setlist_id,song_id,position FROM setlist_items WHERE setlist_id=?1 ORDER BY position,id")
            .map_err(|e| db_error("abrir os itens do repertório", e))?;
        setlist.items = statement
            .query_map([id], |row| {
                Ok(SetlistItem {
                    id: row.get(0)?,
                    setlist_id: row.get(1)?,
                    song_id: row.get(2)?,
                    position: row.get::<_, u32>(3)? as usize,
                })
            })
            .map_err(|e| db_error("abrir os itens do repertório", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| db_error("ler os itens do repertório", e))?;
        Ok(setlist)
    }

    pub fn add_setlist_item(&mut self, setlist_id: &str, song_id: &str) -> Result<Setlist, String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a inclusão", e))?;
        Self::require_setlist(&tx, setlist_id)?;
        Self::require_songs(&tx, &[song_id.to_owned()])?;
        tx.execute("INSERT INTO setlist_items(id,setlist_id,song_id,position) SELECT ?1,?2,?3,count(*) FROM setlist_items WHERE setlist_id=?2", params![Uuid::new_v4().to_string(),setlist_id,song_id])
            .map_err(|e| db_error("adicionar ao repertório", e))?;
        Self::touch_setlist(&tx, setlist_id)?;
        let setlist = Self::read_setlist(&tx, setlist_id)?;
        tx.commit().map_err(|e| db_error("salvar o repertório", e))?;
        Ok(setlist)
    }

    pub fn remove_setlist_item(
        &mut self,
        setlist_id: &str,
        item_id: &str,
    ) -> Result<Setlist, String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a remoção", e))?;
        Self::require_setlist(&tx, setlist_id)?;
        let count = tx
            .execute(
                "DELETE FROM setlist_items WHERE id=?1 AND setlist_id=?2",
                params![item_id, setlist_id],
            )
            .map_err(|e| db_error("remover do repertório", e))?;
        if count == 0 {
            return Err("O item já não está neste repertório. Atualize a lista.".into());
        }
        Self::normalize_positions(&tx, setlist_id)?;
        Self::touch_setlist(&tx, setlist_id)?;
        let setlist = Self::read_setlist(&tx, setlist_id)?;
        tx.commit().map_err(|e| db_error("salvar o repertório", e))?;
        Ok(setlist)
    }

    pub fn reorder_setlist(
        &mut self,
        setlist_id: &str,
        ordered_ids: Vec<String>,
    ) -> Result<Setlist, String> {
        let tx = self
            .connection
            .transaction()
            .map_err(|e| db_error("iniciar a reordenação", e))?;
        Self::require_setlist(&tx, setlist_id)?;
        let current = {
            let mut statement = tx
                .prepare("SELECT id FROM setlist_items WHERE setlist_id=?1")
                .map_err(|e| db_error("ler o repertório", e))?;
            let result = statement
                .query_map([setlist_id], |r| r.get::<_, String>(0))
                .map_err(|e| db_error("ler o repertório", e))?
                .collect::<Result<HashSet<_>, _>>()
                .map_err(|e| db_error("ler o repertório", e))?;
            result
        };
        let requested: HashSet<_> = ordered_ids.iter().cloned().collect();
        if ordered_ids.len() != requested.len() || requested != current {
            return Err(
                "O repertório mudou ou a ordem é inválida. Atualize a lista e tente novamente."
                    .into(),
            );
        }
        for (position, id) in ordered_ids.iter().enumerate() {
            tx.execute(
                "UPDATE setlist_items SET position=?1 WHERE id=?2 AND setlist_id=?3",
                params![position as i64, id, setlist_id],
            )
            .map_err(|e| db_error("reordenar o repertório", e))?;
        }
        Self::touch_setlist(&tx, setlist_id)?;
        let setlist = Self::read_setlist(&tx, setlist_id)?;
        tx.commit()
            .map_err(|e| db_error("salvar a nova ordem", e))?;
        Ok(setlist)
    }

    fn touch_setlist(connection: &Connection, id: &str) -> Result<(), String> {
        connection
            .execute(
                "UPDATE setlists SET updated_at=?1 WHERE id=?2",
                params![Utc::now().to_rfc3339(), id],
            )
            .map_err(|e| db_error("atualizar o repertório", e))?;
        Ok(())
    }

    fn normalize_positions(connection: &Connection, setlist_id: &str) -> Result<(), String> {
        let mut statement = connection
            .prepare("SELECT id FROM setlist_items WHERE setlist_id=?1 ORDER BY position,id")
            .map_err(|e| db_error("organizar o repertório", e))?;
        let ids = statement
            .query_map([setlist_id], |row| row.get::<_, String>(0))
            .map_err(|e| db_error("organizar o repertório", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| db_error("organizar o repertório", e))?;
        for (position, id) in ids.iter().enumerate() {
            connection
                .execute(
                    "UPDATE setlist_items SET position=?1 WHERE id=?2 AND setlist_id=?3",
                    params![position as i64, id, setlist_id],
                )
                .map_err(|e| db_error("organizar o repertório", e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::importing::ImportBlock;
    use crate::domain::library::SaveBlockInput;

    fn input(title: &str) -> SaveSongInput {
        SaveSongInput {
            copyright: None,
            category_id: None,
            id: None,
            title: title.into(),
            artist: None,
            blocks: vec![SaveBlockInput {
                id: None,
                label: Some("Estrofe".into()),
                text: "Texto original de teste\nSegunda linha".into(),
            }],
        }
    }

    fn imported(title: &str) -> ImportSong {
        ImportSong {
            title: title.into(),
            category_name: None,
            artist: Some("Autor de teste".into()),
            copyright: Some("Conteúdo sintético para testes".into()),
            blocks: vec![ImportBlock {
                label: Some("Estrofe".into()),
                text: format!("Texto sintético de {title}\nSegunda linha"),
            }],
        }
    }

    #[test]
    fn playlists_isolate_duplicate_items_and_reject_cross_playlist_edits() {
        let mut db = Database::open(":memory:").unwrap();
        let song = db.save_song(input("Música compartilhada")).unwrap();
        db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
        let first = db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
        let second = db.create_setlist("Culto de domingo").unwrap();
        let second = db.add_setlist_item(&second.id, &song.id).unwrap();
        let a = first.items[0].id.clone();
        let b = first.items[1].id.clone();
        let other = second.items[0].id.clone();
        assert_ne!(a, b);
        assert_ne!(a, other);
        assert!(db.remove_setlist_item(&first.id, &other).is_err());
        assert!(db
            .reorder_setlist(&first.id, vec![a.clone(), other])
            .is_err());
        assert!(db.reorder_setlist("missing", vec![]).is_err());
        assert_eq!(
            Database::read_setlist(&db.connection, &first.id)
                .unwrap()
                .items[0]
                .id,
            a
        );
        let reordered = db.reorder_setlist(&first.id, vec![b.clone(), a]).unwrap();
        assert_eq!(reordered.items[0].id, b);
        assert_eq!(db.get_setlist().unwrap().id, second.id);
        assert_eq!(db.get_setlist().unwrap().items.len(), 1);
        assert_eq!(
            db.list_setlists()
                .unwrap()
                .iter()
                .find(|s| s.id == first.id)
                .unwrap()
                .item_count,
            2
        );
        db.remove_setlist_item(&first.id, &b).unwrap();
        assert_eq!(db.get_setlist().unwrap().items.len(), 1);
        assert_eq!(db.song_usage(&song.id).unwrap(), 2);
    }

    #[test]
    fn playlist_selection_persists_and_legacy_fallback_keeps_existing_items() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("playlists.sqlite3");
        let other_id;
        {
            let mut db = Database::open(&path).unwrap();
            let song = db.save_song(input("Legado")).unwrap();
            db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
            assert_eq!(db.get_setlist().unwrap().id, SETLIST_ID);
            other_id = db.create_setlist("Evento futuro").unwrap().id;
        }
        {
            let mut db = Database::open(&path).unwrap();
            assert_eq!(db.get_setlist().unwrap().id, other_id);
            db.set_setting("active-setlist", "missing").unwrap();
            let legacy = db.get_setlist().unwrap();
            assert_eq!(legacy.id, SETLIST_ID);
            assert_eq!(legacy.items.len(), 1);
            assert_eq!(
                db.get_setting("active-setlist").unwrap().as_deref(),
                Some(SETLIST_ID)
            );
            assert!(db.select_setlist("missing").is_err());
            assert_eq!(db.get_setlist().unwrap().id, SETLIST_ID);
            let fallback = db.delete_setlist(SETLIST_ID).unwrap();
            assert_eq!(fallback.id, other_id);
        }
        {
            let db = Database::open(&path).unwrap();
            assert_eq!(db.get_setlist().unwrap().id, other_id);
            assert_eq!(db.list_setlists().unwrap().len(), 1);
            assert_eq!(db.list_songs().unwrap().len(), 1);
        }
    }

    #[test]
    fn playlist_crud_keeps_library_and_live_snapshot_unchanged() {
        use crate::domain::presentation::Snapshot;
        let mut db = Database::open(":memory:").unwrap();
        let song = db.save_song(input("Ao vivo")).unwrap();
        let mut presentation = Snapshot::default();
        presentation
            .present(song.clone(), &song.blocks[0].id)
            .unwrap();
        let live_before = serde_json::to_value(&presentation).unwrap();
        db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
        let event = db.create_setlist("  Ensaio de sábado  ").unwrap();
        assert_eq!(event.name, "Ensaio de sábado");
        db.add_setlist_item(&event.id, &song.id).unwrap();
        assert_eq!(
            db.rename_setlist(&event.id, "Culto de domingo")
                .unwrap()
                .name,
            "Culto de domingo"
        );
        db.select_setlist(SETLIST_ID).unwrap();
        assert_eq!(db.delete_setlist(&event.id).unwrap().id, SETLIST_ID);
        assert!(db
            .delete_setlist(SETLIST_ID)
            .unwrap_err()
            .contains("último repertório"));
        assert_eq!(db.list_songs().unwrap().len(), 1);
        assert_eq!(
            db.get_song(&song.id).unwrap().blocks[0].text,
            song.blocks[0].text
        );
        assert_eq!(serde_json::to_value(&presentation).unwrap(), live_before);
        // Delete the playlist that supplied the current song, not the song.
        let remaining = db.create_setlist("Retorno").unwrap();
        db.delete_setlist(SETLIST_ID).unwrap();
        assert_eq!(db.get_setlist().unwrap().id, remaining.id);
        assert_eq!(serde_json::to_value(&presentation).unwrap(), live_before);
    }

    #[test]
    fn song_deletion_compacts_and_touches_every_affected_playlist_only() {
        let mut db = Database::open(":memory:").unwrap();
        let removed = db.save_song(input("Remover")).unwrap();
        let kept = db.save_song(input("Manter")).unwrap();
        let second = db.create_setlist("Domingo").unwrap();
        let untouched = db.create_setlist("Sem alteração").unwrap();
        for id in [SETLIST_ID, second.id.as_str()] {
            db.add_setlist_item(id, &removed.id).unwrap();
            db.add_setlist_item(id, &kept.id).unwrap();
            db.add_setlist_item(id, &removed.id).unwrap();
        }
        db.connection
            .execute("UPDATE setlists SET updated_at='sentinel'", [])
            .unwrap();
        assert_eq!(
            db.bulk_song_usage(std::slice::from_ref(&removed.id))
                .unwrap(),
            4
        );
        db.bulk_delete_songs(&[removed.id]).unwrap();
        for id in [SETLIST_ID, second.id.as_str()] {
            let setlist = Database::read_setlist(&db.connection, id).unwrap();
            assert_ne!(setlist.updated_at, "sentinel");
            assert_eq!(setlist.items.len(), 1);
            assert_eq!(setlist.items[0].song_id, kept.id);
            assert_eq!(setlist.items[0].position, 0);
        }
        assert_eq!(
            Database::read_setlist(&db.connection, &untouched.id)
                .unwrap()
                .updated_at,
            "sentinel"
        );
        assert_eq!(db.get_setlist().unwrap().id, untouched.id);
    }

    #[test]
    fn playlist_name_validation_rolls_back_and_rename_does_not_select() {
        let mut db = Database::open(":memory:").unwrap();
        assert!(db.create_setlist("   ").is_err());
        assert!(db.create_setlist(&"á".repeat(121)).is_err());
        let valid = db.create_setlist(&"á".repeat(120)).unwrap();
        assert!(db.rename_setlist(&valid.id, " ").is_err());
        db.rename_setlist(SETLIST_ID, "Minha playlist inicial")
            .unwrap();
        assert_eq!(db.get_setlist().unwrap().id, valid.id);
        assert_eq!(db.list_setlists().unwrap().len(), 2);
        assert!(db.add_setlist_item("missing", "missing").is_err());
        assert!(db.delete_setlist("missing").is_err());
        assert_eq!(db.get_setlist().unwrap().name, "á".repeat(120));
    }

    #[test]
    fn v2_migration_preserves_songs_blocks_references_and_assigns_default_category() {
        let path = std::env::temp_dir().join(format!("louvashow-v2-{}.sqlite3", Uuid::new_v4()));
        {
            let connection = Connection::open(&path).unwrap();
            connection.execute_batch(MIGRATION_1).unwrap();
            connection.execute_batch("CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
                INSERT INTO songs(id,title,created_at,updated_at) VALUES('legacy','Música antiga','now','now');
                INSERT INTO song_blocks(id,song_id,text,position) VALUES('block','legacy','Texto antigo',0);
                INSERT INTO setlists(id,name,created_at,updated_at) VALUES('default-setlist','Repertório','now','now');
                INSERT INTO setlist_items(id,setlist_id,song_id,position) VALUES('item','default-setlist','legacy',0);
                PRAGMA user_version=2;").unwrap();
        }
        {
            let mut db = Database::open(&path).unwrap();
            let song = db.get_song("legacy").unwrap();
            assert_eq!(song.category_id, "musica");
            assert_eq!(song.blocks[0].id, "block");
            assert_eq!(db.get_setlist().unwrap().items[0].song_id, "legacy");
            let categories = db.list_categories().unwrap();
            assert!(categories
                .iter()
                .any(|c| c.id == "hinos" && c.name == "Hinos"));
            assert!(categories
                .iter()
                .any(|c| c.id == "musica" && c.name == "Música"));
            let mut invalid = input("Categoria inexistente");
            invalid.category_id = Some("missing".into());
            assert!(db.save_song(invalid).is_err());
            assert!(db
                .connection
                .execute(
                    "UPDATE songs SET category_id='missing' WHERE id='legacy'",
                    []
                )
                .is_err());
            db.delete_song("legacy").unwrap();
            assert!(db.get_setlist().unwrap().items.is_empty());
        }
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn category_names_are_unique_and_bulk_classification_is_atomic() {
        let mut db = Database::open(":memory:").unwrap();
        let category = db.create_category("  Culto   especial ").unwrap();
        assert_eq!(category.name, "Culto especial");
        assert!(db.create_category("CULTO ESPECIAL").is_err());
        assert!(db.rename_category(&category.id, "HINOS").is_err());
        assert_eq!(
            db.rename_category(&category.id, "Celebração").unwrap().name,
            "Celebração"
        );
        let one = db.save_song(input("Um")).unwrap();
        let two = db.save_song(input("Dois")).unwrap();
        assert!(db
            .bulk_set_category(&[one.id.clone(), "missing".into()], &category.id)
            .is_err());
        assert_eq!(db.get_song(&one.id).unwrap().category_id, "musica");
        db.bulk_set_category(&[one.id.clone(), two.id.clone()], &category.id)
            .unwrap();
        assert_eq!(db.get_song(&one.id).unwrap().category_id, category.id);
        assert_eq!(db.get_song(&two.id).unwrap().category_id, category.id);
    }

    #[test]
    fn bulk_usage_counts_occurrences_and_delete_is_atomic_with_cascades() {
        let mut db = Database::open(":memory:").unwrap();
        db.import_songs(vec![imported("Um"), imported("Dois")], "hinos")
            .unwrap();
        let songs = db.list_songs().unwrap();
        for song in &songs {
            db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
        }
        db.add_setlist_item(SETLIST_ID, &songs[0].id).unwrap();
        let ids = songs.iter().map(|s| s.id.clone()).collect::<Vec<_>>();
        assert_eq!(db.bulk_song_usage(&ids).unwrap(), 3);
        assert!(db
            .bulk_delete_songs(&[ids[0].clone(), "missing".into()])
            .is_err());
        assert_eq!(db.list_songs().unwrap().len(), 2);
        db.bulk_delete_songs(&ids).unwrap();
        assert!(db.list_songs().unwrap().is_empty());
        assert!(db.get_setlist().unwrap().items.is_empty());
        let fingerprint_count: i64 = db
            .connection
            .query_row("SELECT count(*) FROM song_imports", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fingerprint_count, 0);
    }

    #[test]
    fn import_640_is_atomic_and_repeated_import_is_deduplicated() {
        let mut db = Database::open(":memory:").unwrap();
        let batch = || {
            (1..=640)
                .map(|n| imported(&format!("Hino sintético {n}")))
                .collect::<Vec<_>>()
        };
        let first = db.import_songs(batch(), "hinos").unwrap();
        assert_eq!((first.imported, first.skipped), (640, 0));
        let repeated = db.import_songs(batch(), "hinos").unwrap();
        assert_eq!((repeated.imported, repeated.skipped), (0, 640));
        let mut invalid = imported("Falha");
        invalid.blocks.clear();
        assert!(db
            .import_songs(vec![imported("Não deve persistir"), invalid], "hinos")
            .is_err());
        assert_eq!(db.list_songs().unwrap().len(), 640);
        assert_eq!(
            db.import_songs(vec![imported("Não deve persistir")], "hinos")
                .unwrap()
                .imported,
            1
        );
    }

    #[test]
    fn import_normalizes_content_and_preserves_copyright_when_edited() {
        let mut db = Database::open(":memory:").unwrap();
        let original = imported("Teste");
        let mut duplicate = original.clone();
        duplicate.title = "  TESTE  ".into();
        duplicate.artist = Some("AUTOR   DE TESTE".into());
        duplicate.blocks[0].text = duplicate.blocks[0]
            .text
            .to_uppercase()
            .replace('\n', "\r\n");
        let result = db.import_songs(vec![original, duplicate], "hinos").unwrap();
        assert_eq!((result.imported, result.skipped), (1, 1));
        let song = db.list_songs().unwrap().remove(0);
        let mut edit = input("Título editado");
        edit.id = Some(song.id.clone());
        let edited = db.save_song(edit).unwrap();
        assert_eq!(edited.copyright, song.copyright);
        assert_eq!(edited.category_id, "hinos");
        assert_eq!(
            db.import_songs(vec![imported("Teste")], "hinos")
                .unwrap()
                .skipped,
            1
        );
    }

    #[test]
    fn importing_category_names_roundtrips_and_explicit_target_overrides() {
        let mut db = Database::open(":memory:").unwrap();
        let mut first = imported("Primeira");
        first.category_name = Some("Celebração".into());
        let mut second = imported("Segunda");
        second.category_name = Some("CELEBRAÇÃO".into());
        db.import_songs(vec![first, second, imported("Sem categoria")], "")
            .unwrap();
        let categories = db.list_categories().unwrap();
        assert_eq!(categories.len(), 3);
        let category = categories.iter().find(|c| c.name == "Celebração").unwrap();
        let songs = db.list_songs().unwrap();
        assert_eq!(
            songs
                .iter()
                .filter(|s| s.category_id == category.id)
                .count(),
            2
        );
        assert_eq!(
            songs
                .iter()
                .find(|s| s.title == "Sem categoria")
                .unwrap()
                .category_id,
            "musica"
        );
        let mut forced = imported("Destino explícito");
        forced.category_name = Some("Não criar".into());
        db.import_songs(vec![forced], "hinos").unwrap();
        assert_eq!(db.list_categories().unwrap().len(), 3);
        assert_eq!(
            db.list_songs()
                .unwrap()
                .iter()
                .find(|s| s.title == "Destino explícito")
                .unwrap()
                .category_id,
            "hinos"
        );
        let mut created_before_error = imported("Cancelada");
        created_before_error.category_name = Some("Não persistir".into());
        let mut invalid = imported("Falha");
        invalid.blocks.clear();
        assert!(db
            .import_songs(vec![created_before_error, invalid], "")
            .is_err());
        assert_eq!(db.list_categories().unwrap().len(), 3);
    }

    #[test]
    fn copyright_input_distinguishes_omission_null_and_explicit_edit() {
        let mut db = Database::open(":memory:").unwrap();
        db.import_songs(vec![imported("Créditos")], "hinos")
            .unwrap();
        let song = db.list_songs().unwrap().remove(0);
        let body = serde_json::json!({"id":song.id,"title":"Créditos","blocks":[{"text":"Texto"}]});
        let preserved = db
            .save_song(serde_json::from_value(body.clone()).unwrap())
            .unwrap();
        assert_eq!(preserved.copyright, song.copyright);
        let mut edited = body.clone();
        edited["copyright"] = serde_json::json!("Novo crédito");
        assert_eq!(
            db.save_song(serde_json::from_value(edited).unwrap())
                .unwrap()
                .copyright
                .as_deref(),
            Some("Novo crédito")
        );
        let mut cleared = body;
        cleared["copyright"] = serde_json::Value::Null;
        assert_eq!(
            db.save_song(serde_json::from_value(cleared).unwrap())
                .unwrap()
                .copyright,
            None
        );
    }

    #[test]
    fn seed_marker_commits_atomically_and_deleted_songs_do_not_return() {
        let mut db = Database::open(":memory:").unwrap();
        let mut invalid = imported("Inválida");
        invalid.title.clear();
        assert!(db
            .install_seed_pack("test.v1", vec![imported("Teste"), invalid], "hinos")
            .is_err());
        assert!(db.get_setting("seed-pack.test.v1").unwrap().is_none());
        assert!(db.list_songs().unwrap().is_empty());
        assert_eq!(
            db.install_seed_pack("test.v1", vec![imported("Teste")], "hinos")
                .unwrap()
                .imported,
            1
        );
        let id = db.list_songs().unwrap()[0].id.clone();
        db.delete_song(&id).unwrap();
        assert_eq!(
            db.install_seed_pack("test.v1", vec![imported("Teste")], "hinos")
                .unwrap()
                .imported,
            0
        );
        assert!(db.list_songs().unwrap().is_empty());
    }

    #[test]
    fn migrations_are_persistent_and_non_destructive() {
        let path = std::env::temp_dir().join(format!("louvashow-test-{}.sqlite3", Uuid::new_v4()));
        let id = {
            let mut database = Database::open(&path).unwrap();
            database
                .save_song(input("Persistência e acentuação"))
                .unwrap()
                .id
        };
        {
            let database = Database::open(&path).unwrap();
            assert_eq!(
                database.get_song(&id).unwrap().title,
                "Persistência e acentuação"
            );
            assert_eq!(database.list_songs().unwrap().len(), 1);
            assert!(database.get_setlist().unwrap().items.is_empty());
        }
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn repeated_songs_reorder_by_item_identity_and_invalid_order_rolls_back() {
        let mut db = Database::open(":memory:").unwrap();
        let song = db.save_song(input("Uma música")).unwrap();
        db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
        let before = db.add_setlist_item(SETLIST_ID, &song.id).unwrap();
        let ids: Vec<_> = before.items.iter().map(|item| item.id.clone()).collect();
        assert_ne!(ids[0], ids[1]);
        assert!(db
            .reorder_setlist(SETLIST_ID, vec![ids[0].clone(), ids[0].clone()])
            .is_err());
        assert_eq!(db.get_setlist().unwrap().items[0].id, ids[0]);
        let reordered = db
            .reorder_setlist(SETLIST_ID, vec![ids[1].clone(), ids[0].clone()])
            .unwrap();
        assert_eq!(reordered.items[0].id, ids[1]);
        assert_eq!(reordered.items[1].song_id, song.id);
    }

    #[test]
    fn deletion_cascades_and_compacts_positions() {
        let mut db = Database::open(":memory:").unwrap();
        let one = db.save_song(input("Primeira")).unwrap();
        let two = db.save_song(input("Segunda")).unwrap();
        db.add_setlist_item(SETLIST_ID, &one.id).unwrap();
        db.add_setlist_item(SETLIST_ID, &two.id).unwrap();
        db.add_setlist_item(SETLIST_ID, &one.id).unwrap();
        assert_eq!(db.song_usage(&one.id).unwrap(), 2);
        db.delete_song(&one.id).unwrap();
        let remaining = db.get_setlist().unwrap();
        assert_eq!(remaining.items.len(), 1);
        assert_eq!(remaining.items[0].position, 0);
        assert_eq!(remaining.items[0].song_id, two.id);
        assert!(db.get_song(&one.id).is_err());
    }

    #[test]
    fn edits_preserve_identity_and_cannot_steal_other_song_blocks() {
        let mut db = Database::open(":memory:").unwrap();
        let one = db.save_song(input("Primeira")).unwrap();
        let two = db.save_song(input("Segunda")).unwrap();
        let mut update = input("Alterada");
        update.id = Some(one.id.clone());
        update.blocks[0].id = Some(two.blocks[0].id.clone());
        assert!(db.save_song(update.clone()).is_err());
        assert_eq!(db.get_song(&one.id).unwrap().title, "Primeira");
        update.blocks[0].id = Some(one.blocks[0].id.clone());
        let saved = db.save_song(update).unwrap();
        assert_eq!(saved.id, one.id);
        assert_eq!(saved.created_at, one.created_at);
        assert_eq!(saved.blocks[0].id, one.blocks[0].id);
    }

    #[test]
    fn migration_from_v1_preserves_songs_and_adds_persistent_settings() {
        let path = std::env::temp_dir().join(format!("louvashow-v1-{}.sqlite3", Uuid::new_v4()));
        {
            let connection = Connection::open(&path).unwrap();
            connection.execute_batch(MIGRATION_1).unwrap();
            connection.execute("INSERT INTO songs(id,title,created_at,updated_at) VALUES('legacy','Música existente','2026','2026')", []).unwrap();
            connection.pragma_update(None, "user_version", 1).unwrap();
        }
        {
            let mut db = Database::open(&path).unwrap();
            assert_eq!(db.get_song("legacy").unwrap().title, "Música existente");
            assert_eq!(db.get_setting("theme").unwrap(), None);
            db.set_setting("theme", "{\"version\":1}").unwrap();
        }
        {
            let db = Database::open(&path).unwrap();
            assert_eq!(
                db.get_setting("theme").unwrap().as_deref(),
                Some("{\"version\":1}")
            );
        }
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn migration_rejects_newer_schema_without_reset() {
        let path =
            std::env::temp_dir().join(format!("louvashow-future-{}.sqlite3", Uuid::new_v4()));
        {
            let connection = Connection::open(&path).unwrap();
            connection.pragma_update(None, "user_version", 99).unwrap();
        }
        assert!(Database::open(&path).is_err());
        let connection = Connection::open(&path).unwrap();
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, 99);
        drop(connection);
        std::fs::remove_file(path).unwrap();
    }
}
