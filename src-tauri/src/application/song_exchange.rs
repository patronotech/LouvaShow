use crate::domain::importing::{ImportBlock, ImportFile, ImportPreview, ImportSong};
use crate::domain::library::Song;
use std::io::{Cursor, Read, Write};
const INPUT_LIMIT: usize = 10 * 1024 * 1024;
const EXPANDED_LIMIT: usize = 24 * 1024 * 1024;
const FILE_LIMIT: usize = 1024 * 1024;
const SONG_LIMIT: usize = 5000;
const NS: &str = "http://openlyrics.info/namespace/2009/song";

pub fn preview(files: Vec<ImportFile>) -> Result<ImportPreview, String> {
    if files.is_empty()
        || files.len() > SONG_LIMIT
        || files.iter().map(|f| f.bytes.len()).sum::<usize>() > INPUT_LIMIT
    {
        return Err("Selecione até 5.000 arquivos, com no máximo 10 MiB no total.".into());
    }
    let mut result = ImportPreview {
        songs: vec![],
        warnings: vec![],
        file_count: 0,
    };
    let mut expanded = 0;
    for file in files {
        if file.name.to_lowercase().ends_with(".zip") {
            let mut archive = zip::ZipArchive::new(Cursor::new(file.bytes))
                .map_err(|_| "O ZIP está inválido ou não é compatível.")?;
            if archive.len() > SONG_LIMIT {
                return Err("O ZIP contém arquivos demais.".into());
            }
            for i in 0..archive.len() {
                let mut entry=archive.by_index(i).map_err(|_|"Não foi possível ler um item do ZIP. Arquivos protegidos por senha não são aceitos.")?;
                if entry.is_dir() {
                    continue;
                }
                if entry.enclosed_name().is_none() || entry.is_symlink() {
                    return Err("O ZIP contém um caminho ou link não permitido.".into());
                }
                let name = entry
                    .name()
                    .map_err(|_| "Nome de arquivo inválido no ZIP.")?
                    .into_owned();
                if entry.size() > FILE_LIMIT as u64 {
                    return Err(format!("O arquivo {name} excede 1 MiB."));
                }
                let mut bytes = vec![];
                entry
                    .by_ref()
                    .take((FILE_LIMIT + 1) as u64)
                    .read_to_end(&mut bytes)
                    .map_err(|_| "Falha ao descompactar o ZIP.")?;
                if bytes.len() > FILE_LIMIT {
                    return Err("Um arquivo expandido excede o limite.".into());
                }
                expanded += bytes.len();
                if expanded > EXPANDED_LIMIT {
                    return Err("O conteúdo expandido excede 24 MiB.".into());
                }
                parse_file(&name, &bytes, &mut result)?;
            }
        } else {
            expanded += file.bytes.len();
            if expanded > EXPANDED_LIMIT {
                return Err("Conteúdo excede o limite.".into());
            }
            parse_file(&file.name, &file.bytes, &mut result)?;
        }
    }
    if result.songs.is_empty() {
        return Err(
            "Nenhuma música encontrada. Use OpenLyrics XML, JSON LouvaShow ou TXT UTF-8.".into(),
        );
    }
    for song in &mut result.songs {
        validate_song(song)?;
    }
    Ok(result)
}
fn parse_file(name: &str, bytes: &[u8], result: &mut ImportPreview) -> Result<(), String> {
    result.file_count += 1;
    if result.file_count > SONG_LIMIT {
        return Err("O lote excede 5.000 arquivos.".into());
    }
    let extension = name.rsplit('.').next().unwrap_or("").to_lowercase();
    if !["xml", "json", "txt"].contains(&extension.as_str()) {
        result
            .warnings
            .push(format!("Ignorado: {name} (formato não suportado)."));
        return Ok(());
    }
    if extension != "json" && bytes.len() > FILE_LIMIT {
        return Err(format!("{name}: arquivo excede 1 MiB."));
    }
    let source = std::str::from_utf8(bytes)
        .map_err(|_| format!("{name}: salve o arquivo em UTF-8 para importar."))?
        .trim_start_matches('\u{feff}');
    let mut parsed = match extension.as_str() {
        "xml" => vec![parse_openlyrics(source).map_err(|e| format!("{name}: {e}"))?],
        "json" => {
            #[derive(serde::Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct Pack {
                format: String,
                schema_version: u32,
                songs: Vec<ImportSong>,
            }
            let pack: Pack = serde_json::from_str(source)
                .map_err(|_| format!("{name}: JSON inválido. Use o formato LouvaShow versão 1."))?;
            if pack.format != "LouvaShow" || pack.schema_version != 1 {
                return Err("Versão ou formato JSON não suportado.".into());
            }
            pack.songs
        }
        _ => {
            let normalized = source.replace("\r\n", "\n").replace('\r', "\n");
            let mut lines = normalized.lines();
            let title = lines.next().unwrap_or("").trim().to_owned();
            let body = lines.collect::<Vec<_>>().join("\n");
            let mut blocks = vec![];
            let mut current = vec![];
            for line in body.lines().chain(std::iter::once("")) {
                if line.trim().is_empty() {
                    if !current.is_empty() {
                        blocks.push(ImportBlock {
                            label: None,
                            text: current.join("\n"),
                        });
                        current.clear();
                    }
                } else {
                    current.push(line);
                }
            }
            vec![ImportSong {
                title,
                artist: None,
                copyright: None,
                category_name: None,
                blocks,
            }]
        }
    };
    if result.songs.len() + parsed.len() > SONG_LIMIT {
        return Err("O lote excede 5.000 músicas.".into());
    }
    result.songs.append(&mut parsed);
    Ok(())
}
pub fn validate_song(song: &mut ImportSong) -> Result<(), String> {
    song.title = song.title.trim().to_owned();
    song.blocks.retain(|b| !b.text.trim().is_empty());
    if song.title.is_empty()
        || song.title.chars().count() > 300
        || song.blocks.is_empty()
        || song.blocks.len() > 500
    {
        return Err("Cada música precisa de título (até 300 caracteres) e 1 a 500 blocos.".into());
    }
    if song
        .artist
        .as_ref()
        .is_some_and(|v| v.chars().count() > 300)
        || song.copyright.as_ref().is_some_and(|v| v.len() > 4000)
        || song
            .category_name
            .as_ref()
            .is_some_and(|v| v.chars().count() > 80)
    {
        return Err("Autor, direitos ou classificação excedem o limite permitido.".into());
    }
    for block in &mut song.blocks {
        block.text = block
            .text
            .replace("\r\n", "\n")
            .replace('\r', "\n")
            .trim()
            .to_owned();
        if block.text.len() > 32000
            || block
                .label
                .as_ref()
                .is_some_and(|v| v.chars().count() > 100)
        {
            return Err("Um bloco excede o limite. Divida a letra em blocos menores.".into());
        }
    }
    Ok(())
}
fn content(node: roxmltree::Node<'_, '_>) -> String {
    let mut value = String::new();
    let mut pending: Vec<_> = node.children().rev().collect();
    while let Some(child) = pending.pop() {
        if child.is_text() {
            value.push_str(child.text().unwrap_or(""));
        } else if child.is_element() {
            match child.tag_name().name() {
                "comment" => {}
                "br" => value.push('\n'),
                _ => pending.extend(child.children().rev()),
            }
        }
    }
    value
}
pub fn parse_openlyrics(source: &str) -> Result<ImportSong, String> {
    if source.contains("<!DOCTYPE") {
        return Err("Declarações DTD não são permitidas.".into());
    }
    let doc = roxmltree::Document::parse_with_options(
        source,
        roxmltree::ParsingOptions {
            allow_dtd: false,
            nodes_limit: 100_000,
            ..Default::default()
        },
    )
    .map_err(|_| "XML inválido. DTD e entidades externas não são permitidos.")?;
    let root = doc.root_element();
    if root
        .descendants()
        .any(|n| n.ancestors().take(130).count() > 129)
    {
        return Err("XML possui aninhamento excessivo.".into());
    }
    if root.tag_name().name() != "song"
        || root.tag_name().namespace() != Some(NS)
        || root.attribute("version") != Some("0.8")
    {
        return Err("Use XML OpenLyrics 0.8. Outros dialetos XML ainda não são suportados.".into());
    }
    let props = root
        .children()
        .find(|n| n.has_tag_name((NS, "properties")))
        .ok_or("XML sem propriedades da música.")?;
    let property = |name: &str| {
        props
            .descendants()
            .find(|n| n.has_tag_name((NS, name)))
            .map(content)
            .map(|v| v.trim().to_owned())
            .filter(|v| !v.is_empty())
    };
    let authors = props
        .descendants()
        .filter(|n| n.has_tag_name((NS, "author")))
        .map(content)
        .collect::<Vec<_>>()
        .join("; ");
    let lyrics = root
        .children()
        .find(|n| n.has_tag_name((NS, "lyrics")))
        .ok_or("XML sem letra.")?;
    let mut named = std::collections::HashMap::new();
    let mut blocks = vec![];
    for verse in lyrics.children().filter(|n| n.has_tag_name((NS, "verse"))) {
        let name = verse.attribute("name").ok_or("Verso sem nome.")?;
        let text = verse
            .children()
            .filter(|n| n.has_tag_name((NS, "lines")))
            .map(content)
            .collect::<Vec<_>>()
            .join("\n");
        let block = ImportBlock {
            label: Some(name.into()),
            text,
        };
        if named.insert(name.to_owned(), block.clone()).is_some() {
            return Err("Há versos com nomes repetidos no XML.".into());
        }
        blocks.push(block);
    }
    if let Some(order) = property("verseOrder") {
        let keys = order.split_whitespace().collect::<Vec<_>>();
        if keys.len() > 500 {
            return Err("Ordem de versos excede 500 blocos.".into());
        }
        blocks = keys
            .iter()
            .map(|key| {
                named
                    .get(*key)
                    .cloned()
                    .ok_or_else(|| format!("A ordem referencia um verso inexistente: {key}"))
            })
            .collect::<Result<Vec<_>, _>>()?;
    }
    let mut song = ImportSong {
        title: property("title").ok_or("XML sem título.")?,
        artist: (!authors.is_empty()).then_some(authors),
        copyright: property("copyright"),
        category_name: property("theme"),
        blocks,
    };
    validate_song(&mut song)?;
    Ok(song)
}
fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
pub fn openlyrics(song: &Song, category_name: &str) -> String {
    let mut xml=format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<song xmlns=\"{NS}\" version=\"0.8\" createdIn=\"LouvaShow\" modifiedIn=\"LouvaShow\" modifiedDate=\"{}\"><properties><titles><title>{}</title></titles>",chrono::Utc::now().to_rfc3339(),escape(&song.title));
    if let Some(artist) = song.artist.as_deref().filter(|v| !v.is_empty()) {
        xml.push_str(&format!(
            "<authors><author>{}</author></authors>",
            escape(artist)
        ));
    }
    if let Some(c) = song.copyright.as_deref().filter(|v| !v.is_empty()) {
        xml.push_str(&format!("<copyright>{}</copyright>", escape(c)));
    }
    if !category_name.is_empty() {
        xml.push_str(&format!(
            "<themes><theme>{}</theme></themes>",
            escape(category_name)
        ));
    }
    let names = song
        .blocks
        .iter()
        .enumerate()
        .map(|(i, b)| {
            let label = b.label.as_deref().unwrap_or("").to_lowercase();
            let prefix = if label.starts_with("refr") || label.starts_with('c') {
                "c"
            } else if label.starts_with("ponte") || label.starts_with('b') {
                "b"
            } else {
                "v"
            };
            format!("{prefix}{}", i + 1)
        })
        .collect::<Vec<_>>();
    xml.push_str(&format!(
        "<verseOrder>{}</verseOrder></properties><lyrics>",
        names.join(" ")
    ));
    for (block, name) in song.blocks.iter().zip(names) {
        xml.push_str(&format!(
            "<verse name=\"{name}\"><lines>{}</lines></verse>",
            block
                .text
                .lines()
                .map(escape)
                .collect::<Vec<_>>()
                .join("<br/>")
        ));
    }
    xml.push_str("</lyrics></song>\n");
    xml
}
pub fn export(
    songs: Vec<Song>,
    categories: std::collections::HashMap<String, String>,
    format: &str,
) -> Result<Vec<u8>, String> {
    if songs.is_empty() || songs.len() > SONG_LIMIT {
        return Err("Selecione ao menos uma música para exportar.".into());
    }
    let bytes = if format == "json" {
        let values=songs.into_iter().map(|song|serde_json::json!({"title":song.title,"artist":song.artist,"copyright":song.copyright,"categoryName":categories.get(&song.category_id),"blocks":song.blocks.into_iter().map(|b|serde_json::json!({"label":b.label,"text":b.text})).collect::<Vec<_>>()})).collect::<Vec<_>>();
        serde_json::to_vec_pretty(
            &serde_json::json!({"format":"LouvaShow","schemaVersion":1,"songs":values}),
        )
        .map_err(|_| "Não foi possível gerar JSON.".to_string())
    } else if format == "openlyrics" {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        let mut expanded = 0;
        for (i, song) in songs.iter().enumerate() {
            writer
                .start_file(
                    format!("musica-{:04}.xml", i + 1),
                    zip::write::SimpleFileOptions::default()
                        .compression_method(zip::CompressionMethod::Deflated),
                )
                .map_err(|_| "Falha ao criar ZIP.")?;
            let xml = openlyrics(
                song,
                categories
                    .get(&song.category_id)
                    .map(String::as_str)
                    .unwrap_or(""),
            );
            if xml.chars().any(|c| {
                !(matches!(c, '\t' | '\n' | '\r')
                    || (c >= ' ' && c != '\u{fffe}' && c != '\u{ffff}'))
            }) {
                return Err(
                    "Há caracteres incompatíveis com XML. Revise os textos ou exporte JSON.".into(),
                );
            }
            expanded += xml.len();
            if xml.len() > FILE_LIMIT || expanded > EXPANDED_LIMIT {
                return Err("Exportação excede os limites de intercâmbio. Selecione menos músicas ou divida os blocos.".into());
            }
            writer
                .write_all(xml.as_bytes())
                .map_err(|_| "Falha ao escrever XML.")?;
        }
        writer
            .finish()
            .map(|c| c.into_inner())
            .map_err(|_| "Falha ao concluir ZIP.".to_string())
    } else {
        Err("Formato de exportação desconhecido.".to_string())
    }?;
    if bytes.len() > INPUT_LIMIT {
        return Err("Exportação excede 10 MiB. Selecione menos músicas.".into());
    }
    Ok(bytes)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[cfg(feature = "bundled-hymns")]
    #[test]
    fn real_pack_has_640_songs() {
        let p = preview(vec![ImportFile {
            name: "hc.zip".into(),
            bytes: include_bytes!("../../resources/hc_xml.zip").to_vec(),
        }])
        .unwrap();
        assert_eq!(p.songs.len(), 640);
        assert_eq!(p.file_count, 640);
        assert!(p
            .songs
            .iter()
            .all(|s| s.copyright.as_deref() == Some("Harpa Cristã")));
        assert!(p.songs[0].blocks[0].text.contains('\n'));
    }
    #[test]
    fn rejects_dtd_and_unknown_xml() {
        assert!(parse_openlyrics("<!DOCTYPE song [<!ENTITY x 'x'>]><song>&x;</song>").is_err());
        assert!(parse_openlyrics("<song/>").is_err());
    }
    #[test]
    fn txt_blank_lines_and_accents() {
        let p = preview(vec![ImportFile {
            name: "x.txt".into(),
            bytes: "Canção\r\n\r\nOlá\r\nSegunda linha\r\n \r\nFim"
                .as_bytes()
                .to_vec(),
        }])
        .unwrap();
        assert_eq!(p.songs[0].blocks.len(), 2);
        assert_eq!(p.songs[0].title, "Canção");
    }
    #[test]
    fn verse_order_repeats_and_missing_fails() {
        let xml=format!("<song xmlns='{NS}' version='0.8'><properties><titles><title>Teste</title></titles><verseOrder>v1 c1 c1</verseOrder></properties><lyrics><verse name='v1'><lines>Um<br/>Dois</lines></verse><verse name='c1'><lines>Refrão</lines></verse></lyrics></song>");
        let song = parse_openlyrics(&xml).unwrap();
        assert_eq!(song.blocks.len(), 3);
        assert_eq!(song.blocks[0].text, "Um\nDois");
        assert!(parse_openlyrics(&xml.replace("v1 c1 c1", "missing")).is_err());
    }

    #[cfg(feature = "bundled-hymns")]
    #[test]
    fn real_catalog_seed_export_roundtrip_and_no_resurrection() {
        use crate::infrastructure::database::Database;
        let read_pack = || {
            preview(vec![ImportFile {
                name: "hc.zip".into(),
                bytes: include_bytes!("../../resources/hc_xml.zip").to_vec(),
            }])
            .unwrap()
            .songs
        };
        let mut db = Database::open(":memory:").unwrap();
        assert_eq!(
            db.install_seed_pack("hc-test", read_pack(), "hinos")
                .unwrap()
                .imported,
            640
        );
        assert_eq!(db.import_songs(read_pack(), "hinos").unwrap().skipped, 640);
        let originals = db.list_songs().unwrap();
        for format in ["json", "openlyrics"] {
            let categories = db
                .list_categories()
                .unwrap()
                .into_iter()
                .map(|c| (c.id, c.name))
                .collect();
            let bytes = export(originals.clone(), categories, format).unwrap();
            let parsed = preview(vec![ImportFile {
                name: if format == "json" {
                    "backup.json".into()
                } else {
                    "backup.zip".into()
                },
                bytes,
            }])
            .unwrap();
            assert_eq!(parsed.songs.len(), 640);
            for (source, returned) in originals.iter().zip(&parsed.songs) {
                assert_eq!(source.title, returned.title);
                assert_eq!(source.copyright, returned.copyright);
                assert_eq!(source.artist, returned.artist);
                assert_eq!(returned.category_name.as_deref(), Some("Hinos"));
                assert_eq!(
                    source.blocks.iter().map(|b| &b.text).collect::<Vec<_>>(),
                    returned.blocks.iter().map(|b| &b.text).collect::<Vec<_>>()
                );
            }
            let mut restored = Database::open(":memory:").unwrap();
            assert_eq!(
                restored.import_songs(parsed.songs, "").unwrap().imported,
                640
            );
            assert!(restored
                .list_songs()
                .unwrap()
                .iter()
                .all(|s| s.category_id == "hinos"));
        }
        let ids = originals.iter().map(|s| s.id.clone()).collect::<Vec<_>>();
        db.bulk_delete_songs(&ids).unwrap();
        assert_eq!(
            db.install_seed_pack("hc-test", read_pack(), "hinos")
                .unwrap()
                .imported,
            0
        );
        assert!(db.list_songs().unwrap().is_empty());
    }
    #[test]
    fn notes_are_not_projected_and_xml_controls_are_rejected() {
        let xml=format!("<song xmlns='{NS}' version='0.8'><properties><titles><title>Teste &amp; paz</title></titles></properties><lyrics><verse name='v1'><lines>Texto<comment>Não projetar</comment><br/>Mais</lines></verse></lyrics></song>");
        let song = parse_openlyrics(&xml).unwrap();
        assert_eq!(song.blocks[0].text, "Texto\nMais");
        let mut db = crate::infrastructure::database::Database::open(":memory:").unwrap();
        db.import_songs(vec![song], "musica").unwrap();
        let mut songs = db.list_songs().unwrap();
        songs[0].title.push('\u{000b}');
        assert!(export(songs, Default::default(), "openlyrics").is_err());
    }
    #[test]
    fn zip_traversal_and_oversized_entry_are_rejected() {
        for (name, contents) in [
            ("../bad.txt", b"Title\nBody".to_vec()),
            ("large.txt", vec![b'a'; FILE_LIMIT + 1]),
        ] {
            let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
            w.start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            w.write_all(&contents).unwrap();
            let bytes = w.finish().unwrap().into_inner();
            assert!(preview(vec![ImportFile {
                name: "bad.zip".into(),
                bytes
            }])
            .is_err());
        }
    }
}
