use crate::{
    domain::{
        library::Song,
        presentation::{BlockStyleOverride, Snapshot},
    },
    infrastructure::database::Database,
};
use serde::Serialize;
use std::{collections::HashMap, sync::Mutex};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedBlockStyle {
    pub song: Song,
    pub snapshot: Snapshot,
    pub applied_to_live: bool,
}

/// DB -> cache -> presentation is the lock order. Persist and publish the fresh
/// song under the same DB lock as lyric saves/cache fills. Never use an editor's
/// stale copy of the song to update typography or refresh the live text.
pub fn save_block_style(
    database: &Mutex<Database>,
    cache: &Mutex<HashMap<String, Song>>,
    presentation: &Mutex<Snapshot>,
    song_id: &str,
    block_id: &str,
    style_override: Option<BlockStyleOverride>,
    apply_to_live: bool,
) -> Result<SavedBlockStyle, String> {
    if let Some(style) = &style_override {
        style.validate()?;
    }
    let mut database = database
        .lock()
        .map_err(|_| "Banco indisponível. Reinicie o aplicativo.")?;
    let song = database.save_block_style(song_id, block_id, style_override.as_ref())?;
    let mut cache = cache
        .lock()
        .map_err(|_| "Estilo salvo, mas o cache está indisponível. Reinicie o aplicativo.")?;
    cache.insert(song.id.clone(), song.clone());
    let mut live = presentation.lock().map_err(|_| {
        "Estilo salvo, mas o estado da apresentação está indisponível. Reinicie o aplicativo."
    })?;
    let applied_to_live = if apply_to_live {
        live.apply_block_style(song_id, block_id, style_override)?
    } else {
        false
    };
    Ok(SavedBlockStyle {
        song,
        snapshot: live.clone(),
        applied_to_live,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::library::SaveSongInput;
    use std::sync::{Arc, Barrier};

    fn input(song: Option<&Song>, text: &str) -> SaveSongInput {
        serde_json::from_value(serde_json::json!({
            "id":song.map(|s| &s.id),"title":"Música de teste","artist":null,
            "blocks":[
                {"id":song.map(|s| &s.blocks[0].id),"text":text,"label":"Estrofe"},
                {"id":song.map(|s| &s.blocks[1].id),"text":"Segundo bloco","label":"Refrão"}
            ]
        }))
        .unwrap()
    }
    fn style(font_size: u8) -> BlockStyleOverride {
        serde_json::from_value(
            serde_json::json!({"version":1,"fontSize":font_size,"textAlign":"left"}),
        )
        .unwrap()
    }
    struct Fixture {
        db: Arc<Mutex<Database>>,
        cache: Arc<Mutex<HashMap<String, Song>>>,
        live: Arc<Mutex<Snapshot>>,
        song: Song,
    }
    fn fixture() -> Fixture {
        let mut db = Database::open(":memory:").unwrap();
        let song = db.save_song(input(None, "Texto ao vivo original")).unwrap();
        let mut snapshot = Snapshot::default();
        snapshot.present(song.clone(), &song.blocks[0].id).unwrap();
        snapshot.toggle_blank();
        Fixture {
            db: Arc::new(Mutex::new(db)),
            cache: Arc::new(Mutex::new(HashMap::from([(song.id.clone(), song.clone())]))),
            live: Arc::new(Mutex::new(snapshot)),
            song,
        }
    }
    fn snapshot(f: &Fixture) -> serde_json::Value {
        serde_json::to_value(&*f.live.lock().unwrap()).unwrap()
    }

    #[test]
    fn save_only_never_updates_live_and_next_presentation_uses_cached_override() {
        let f = fixture();
        let before = snapshot(&f);
        let saved = save_block_style(
            &f.db,
            &f.cache,
            &f.live,
            &f.song.id,
            &f.song.blocks[0].id,
            Some(style(80)),
            false,
        )
        .unwrap();
        assert!(!saved.applied_to_live);
        assert_eq!(serde_json::to_value(saved.snapshot).unwrap(), before);
        assert_eq!(snapshot(&f), before);
        let cache = f.cache.lock().unwrap();
        let mut live = f.live.lock().unwrap();
        live.present(cache[&f.song.id].clone(), &f.song.blocks[0].id)
            .unwrap();
        assert_eq!(live.blocks[0].style_override, Some(style(80)));
        assert!(live.blocks[1].style_override.is_none());
    }

    #[test]
    fn live_apply_uses_owned_text_even_after_source_edit_and_clear_preserves_blanking() {
        let f = fixture();
        // Simulate a separate explicit lyric save while the style editor still
        // displays the old source. The style command receives IDs, never lyrics.
        f.db.lock()
            .unwrap()
            .save_song(input(Some(&f.song), "Letra editada depois"))
            .unwrap();
        let mut expected = snapshot(&f);
        let saved = save_block_style(
            &f.db,
            &f.cache,
            &f.live,
            &f.song.id,
            &f.song.blocks[0].id,
            Some(style(92)),
            true,
        )
        .unwrap();
        assert!(saved.applied_to_live);
        assert_eq!(saved.song.blocks[0].text, "Letra editada depois");
        assert_eq!(
            f.cache.lock().unwrap()[&f.song.id].blocks[0].text,
            "Letra editada depois"
        );
        expected["revision"] = serde_json::json!(expected["revision"].as_u64().unwrap() + 1);
        expected["blocks"][0]["styleOverride"] = serde_json::to_value(style(92)).unwrap();
        assert_eq!(snapshot(&f), expected);
        let reset = save_block_style(
            &f.db,
            &f.cache,
            &f.live,
            &f.song.id,
            &f.song.blocks[0].id,
            None,
            true,
        )
        .unwrap();
        assert!(reset.applied_to_live);
        assert!(reset.snapshot.blanked);
        assert_eq!(reset.snapshot.blocks[0].text, "Texto ao vivo original");
        assert!(reset.snapshot.blocks[0].style_override.is_none());
        assert!(reset.song.blocks[0].style_override.is_none());
    }

    #[test]
    fn navigation_during_edit_saves_source_without_touching_the_new_current_block() {
        let f = fixture();
        f.live.lock().unwrap().navigate(true);
        let before = snapshot(&f);
        let saved = save_block_style(
            &f.db,
            &f.cache,
            &f.live,
            &f.song.id,
            &f.song.blocks[0].id,
            Some(style(88)),
            true,
        )
        .unwrap();
        assert!(!saved.applied_to_live);
        assert_eq!(snapshot(&f), before);
        assert_eq!(saved.song.blocks[0].style_override, Some(style(88)));
        // A concurrent switch to another song also cannot change that session.
        let other =
            f.db.lock()
                .unwrap()
                .save_song(input(None, "Outra música"))
                .unwrap();
        f.live
            .lock()
            .unwrap()
            .present(other.clone(), &other.blocks[0].id)
            .unwrap();
        let before = snapshot(&f);
        let saved = save_block_style(
            &f.db,
            &f.cache,
            &f.live,
            &f.song.id,
            &f.song.blocks[0].id,
            None,
            true,
        )
        .unwrap();
        assert!(!saved.applied_to_live);
        assert_eq!(snapshot(&f), before);
    }

    #[test]
    fn concurrent_lyric_and_style_saves_leave_fresh_cache_and_never_restore_old_text() {
        let f = fixture();
        let before = snapshot(&f);
        for iteration in 0..12_u8 {
            let start = Arc::new(Barrier::new(3));
            let db = f.db.clone();
            let cache = f.cache.clone();
            let original = f.song.clone();
            let lyric_start = start.clone();
            let lyric_writer = std::thread::spawn(move || {
                lyric_start.wait();
                let mut db = db.lock().unwrap();
                let saved = db
                    .save_song(input(Some(&original), &format!("Texto novo {iteration}")))
                    .unwrap();
                cache.lock().unwrap().insert(saved.id.clone(), saved);
            });
            let db = f.db.clone();
            let cache = f.cache.clone();
            let live = f.live.clone();
            let song_id = f.song.id.clone();
            let block_id = f.song.blocks[0].id.clone();
            let style_start = start.clone();
            let style_writer = std::thread::spawn(move || {
                style_start.wait();
                save_block_style(
                    &db,
                    &cache,
                    &live,
                    &song_id,
                    &block_id,
                    Some(style(64 + iteration)),
                    false,
                )
                .unwrap();
            });
            start.wait();
            lyric_writer.join().unwrap();
            style_writer.join().unwrap();
            let stored = f.db.lock().unwrap().get_song(&f.song.id).unwrap();
            assert_eq!(stored.blocks[0].text, format!("Texto novo {iteration}"));
            assert_eq!(stored.blocks[0].style_override, Some(style(64 + iteration)));
            assert_eq!(
                serde_json::to_value(&stored).unwrap(),
                serde_json::to_value(&f.cache.lock().unwrap()[&f.song.id]).unwrap()
            );
            assert_eq!(snapshot(&f), before);
        }
    }
}
