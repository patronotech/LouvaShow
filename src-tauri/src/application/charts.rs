//! Pure chart transformations. No network, database, or presentation side effects.
use crate::domain::{charts::*, library::Song};
use std::collections::HashSet;
use unicode_segmentation::UnicodeSegmentation;
use uuid::Uuid;

fn id() -> String {
    Uuid::new_v4().to_string()
}
fn empty_section(label: &str) -> ChartSection {
    ChartSection {
        id: id(),
        label: label.into(),
        lines: vec![],
    }
}
fn line(text: &str) -> ChartLine {
    ChartLine {
        id: id(),
        text: text.into(),
        chords: vec![],
    }
}
fn blank_document() -> ChartDocument {
    ChartDocument {
        schema_version: 1,
        title: "Cifra importada".into(),
        artist: None,
        concert_key: None,
        capo: 0,
        spelling: ChartSpelling::Sharps,
        sections: vec![],
        sequence: vec![],
        notes: String::new(),
        preserved_directives: vec![],
    }
}
pub fn document_from_song(song: &Song) -> ChartDocument {
    let mut document = blank_document();
    document.title = song.title.clone();
    document.artist = song.artist.clone();
    for (index, block) in song.blocks.iter().enumerate() {
        let mut section = empty_section(
            block
                .label
                .as_deref()
                .unwrap_or(&format!("Parte {}", index + 1)),
        );
        section.lines = block.text.lines().map(line).collect();
        document.sequence.push(ChartOccurrence {
            id: id(),
            section_id: section.id.clone(),
        });
        document.sections.push(section);
    }
    if document.sections.is_empty() {
        let mut section = empty_section("Parte 1");
        section.lines.push(line(""));
        document.sequence.push(ChartOccurrence {
            id: id(),
            section_id: section.id.clone(),
        });
        document.sections.push(section);
    }
    document
}

#[derive(Debug, Clone)]
struct Chord {
    root: i8,
    suffix: String,
    bass: Option<i8>,
}
fn note_prefix(value: &str) -> Option<(i8, usize)> {
    // Brazilian solfege aliases are accepted, output uses international symbols.
    let roots = [
        ("Sol", 7),
        ("SOL", 7),
        ("Dó", 0),
        ("Do", 0),
        ("Ré", 2),
        ("Re", 2),
        ("Mi", 4),
        ("Fá", 5),
        ("Fa", 5),
        ("Lá", 9),
        ("La", 9),
        ("Si", 11),
        ("C", 0),
        ("D", 2),
        ("E", 4),
        ("F", 5),
        ("G", 7),
        ("A", 9),
        ("B", 11),
    ];
    for (name, pitch) in roots {
        if let Some(rest) = value.strip_prefix(name) {
            let (delta, bytes) = if rest.starts_with('#') {
                (1, 1)
            } else if rest.starts_with('b') {
                (-1, 1)
            } else if rest.starts_with('♯') {
                (1, '♯'.len_utf8())
            } else if rest.starts_with('♭') {
                (-1, '♭'.len_utf8())
            } else {
                (0, 0)
            };
            return Some(((pitch + delta + 12) % 12, name.len() + bytes));
        }
    }
    None
}
fn suffix_valid(mut suffix: &str) -> bool {
    while !suffix.is_empty() {
        let mut matched = false;
        for token in [
            "maj", "min", "dim", "aug", "sus", "add", "omit", "alt", "no", "M", "m", "Δ", "°", "ø",
            "º",
        ] {
            if let Some(rest) = suffix.strip_prefix(token) {
                suffix = rest;
                matched = true;
                break;
            }
        }
        if matched {
            continue;
        }
        let c = suffix.chars().next().expect("nonempty suffix");
        if c.is_ascii_digit() || "#b♯♭()+-,/".contains(c) {
            suffix = &suffix[c.len_utf8()..];
        } else {
            return false;
        }
    }
    true
}
fn parse_chord(symbol: &str) -> Option<Chord> {
    let symbol = symbol.trim();
    let (root, bytes) = note_prefix(symbol)?;
    let rest = &symbol[bytes..];
    let (suffix, bass) = if let Some((left, right)) = rest.rsplit_once('/') {
        if let Some((pitch, n)) = note_prefix(right).filter(|(_, n)| *n == right.len()) {
            let _ = n;
            (left, Some(pitch))
        } else {
            (rest, None)
        }
    } else {
        (rest, None)
    };
    suffix_valid(suffix).then(|| Chord {
        root,
        suffix: suffix.into(),
        bass,
    })
}
fn note(pitch: i8, spelling: ChartSpelling) -> &'static str {
    let names = match spelling {
        ChartSpelling::Sharps => [
            "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
        ],
        ChartSpelling::Flats => [
            "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
        ],
    };
    names[pitch.rem_euclid(12) as usize]
}
fn key_valid(key: &str) -> bool {
    note_prefix(key).is_some_and(|(_, n)| matches!(&key[n..], "" | "m" | "min" | "maj"))
}
fn shift_key(key: &str, delta: i8, spelling: ChartSpelling) -> Option<String> {
    if !key_valid(key) {
        return None;
    }
    let (pitch, n) = note_prefix(key)?;
    Some(format!("{}{}", note(pitch + delta, spelling), &key[n..]))
}
fn annotation(symbol: &str) -> bool {
    symbol.starts_with('*')
        || matches!(
            symbol.trim().to_uppercase().as_str(),
            "N.C." | "N.C" | "NC" | "PAUSA" | "-" | "%"
        )
}
pub fn validate_document(document: &ChartDocument) -> Result<(), String> {
    document.validate()?;
    if document
        .concert_key
        .as_ref()
        .is_some_and(|key| !key_valid(key))
    {
        return Err("Tom inválido. Use C, F#, Bb, Am ou deixe sem tom definido.".into());
    }
    Ok(())
}
pub fn transpose(
    document: ChartDocument,
    semitones: i8,
    capo: u8,
    spelling: ChartSpelling,
) -> Result<ChartTransformResult, String> {
    validate_document(&document)?;
    if !(-48..=48).contains(&semitones) || capo > 5 {
        return Err("Transposição deve estar entre -48 e 48 semitons; capo entre 0 e 5.".into());
    }
    let delta = semitones + document.capo as i8 - capo as i8;
    let mut document = document;
    let mut warnings = vec![];
    let mut unknown = HashSet::new();
    for section in &mut document.sections {
        for line in &mut section.lines {
            for chord in &mut line.chords {
                if let Some(parsed) = parse_chord(&chord.symbol) {
                    chord.symbol = format!(
                        "{}{}{}",
                        note(parsed.root + delta, spelling),
                        parsed.suffix,
                        parsed
                            .bass
                            .map(|v| format!("/{}", note(v + delta, spelling)))
                            .unwrap_or_default()
                    );
                } else if !annotation(&chord.symbol) && unknown.insert(chord.symbol.clone()) {
                    warnings.push(format!(
                        "Símbolo não reconhecido, mantido sem transposição: {}",
                        chord.symbol
                    ));
                }
            }
        }
    }
    document.concert_key = document
        .concert_key
        .as_ref()
        .and_then(|key| shift_key(key, semitones, spelling));
    document.capo = capo;
    document.spelling = spelling;
    Ok(ChartTransformResult { document, warnings })
}
/// Scale compatibility is a heuristic, not a proof of tonal center. Relative
/// major/minor candidates deliberately remain visible instead of guessing one.
pub fn suggest_keys(document: &ChartDocument) -> Result<Vec<KeySuggestion>, String> {
    validate_document(document)?;
    let mut pitches = [0_u64; 12];
    let mut roots = [0_u64; 12];
    let mut recognized = 0_u32;
    for occurrence in &document.sequence {
        let section = document
            .sections
            .iter()
            .find(|section| section.id == occurrence.section_id)
            .expect("validated sequence");
        for symbol in section
            .lines
            .iter()
            .flat_map(|line| &line.chords)
            .map(|chord| chord.symbol.as_str())
        {
            let Some(chord) = parse_chord(symbol) else {
                continue;
            };
            recognized += 1;
            let root = (chord.root + document.capo as i8).rem_euclid(12) as usize;
            roots[root] += 1;
            pitches[root] += 2;
            let suffix = chord.suffix.as_str();
            let diminished = suffix.contains("dim") || suffix.contains(['°', 'º', 'ø']);
            let minor = (suffix.starts_with('m') && !suffix.starts_with("maj")) || diminished;
            let third = if suffix.contains("sus2") {
                2
            } else if suffix.contains("sus") {
                5
            } else if minor {
                3
            } else {
                4
            };
            let fifth = if diminished || suffix.contains("b5") || suffix.contains("5-") {
                6
            } else if suffix.contains("aug") || suffix.contains('+') || suffix.contains("#5") {
                8
            } else {
                7
            };
            // A power chord (C5) has no third; it provides less tonal evidence.
            if suffix != "5" {
                pitches[(root + third) % 12] += 1;
            }
            pitches[(root + fifth) % 12] += 1;
            if suffix.contains('7') {
                let seventh = if suffix.contains("maj7")
                    || suffix.contains("7M")
                    || suffix.contains("M7")
                    || suffix.contains('Δ')
                {
                    11
                } else if diminished && !suffix.contains('ø') {
                    9
                } else {
                    10
                };
                pitches[(root + seventh) % 12] += 1;
            }
            if let Some(bass) = chord.bass {
                pitches[(bass + document.capo as i8).rem_euclid(12) as usize] += 1;
            }
        }
    }
    if recognized == 0 {
        return Ok(vec![]);
    }
    let total: u64 = pitches.iter().sum();
    let mut candidates = vec![];
    for tonic in 0..12 {
        for (minor, scale) in [
            (false, [0, 2, 4, 5, 7, 9, 11]),
            (true, [0, 2, 3, 5, 7, 8, 10]),
        ] {
            let matched: u64 = scale.iter().map(|step| pitches[(tonic + step) % 12]).sum();
            let score = (matched * 100 / total) as u32;
            let key = format!(
                "{}{}",
                note(tonic as i8, document.spelling),
                if minor { "m" } else { "" }
            );
            candidates.push((KeySuggestion{key,score,explanation:format!("Hipótese pela compatibilidade das notas de {recognized} acordes da sequência. Maior e menor relativos podem empatar; confirme a tônica e possíveis modulações.")},roots[tonic]));
        }
    }
    candidates.sort_by(|(a, root_a), (b, root_b)| b.score.cmp(&a.score).then(root_b.cmp(root_a)));
    Ok(candidates
        .into_iter()
        .take(3)
        .map(|(candidate, _)| candidate)
        .collect())
}

pub fn suggest_capos(document: ChartDocument) -> Result<Vec<CapoSuggestion>, String> {
    validate_document(&document)?;
    let mut candidates = vec![];
    for capo in 0..=5 {
        let result = transpose(document.clone(), 0, capo, document.spelling)?;
        let mut score = 0;
        let mut total = 0;
        for occurrence in &result.document.sequence {
            let section = result
                .document
                .sections
                .iter()
                .find(|s| s.id == occurrence.section_id)
                .expect("validated sequence");
            for chord in section.lines.iter().flat_map(|l| &l.chords) {
                if let Some(parsed) = parse_chord(&chord.symbol) {
                    total += 1;
                    // Rough standard-tuning open-shape heuristic, not fingering advice.
                    let minor = parsed.suffix.starts_with('m') && !parsed.suffix.starts_with("maj");
                    let open = if minor {
                        [2, 4, 9].contains(&parsed.root)
                    } else {
                        [0, 2, 4, 7, 9].contains(&parsed.root)
                    };
                    score += if open { 0 } else { 3 };
                    if parsed.bass.is_some() {
                        score += 1;
                    }
                    if !matches!(
                        parsed.suffix.as_str(),
                        "" | "m" | "7" | "m7" | "sus2" | "sus4"
                    ) {
                        score += 1;
                    }
                }
            }
        }
        if total == 0 {
            return Err(
                "Adicione acordes reconhecidos antes de pedir sugestões de capotraste.".into(),
            );
        }
        let shape_key = result
            .document
            .concert_key
            .as_ref()
            .and_then(|k| shift_key(k, -(capo as i8), document.spelling));
        candidates.push(CapoSuggestion { id: format!("capo-{capo}"), capo, shape_key, score,
            explanation: format!("Capo {capo}: avaliação de {total} acordes da sequência; prioriza formas abertas em afinação padrão. Revise baixos e extensões."),
            document: result.document, warnings: result.warnings });
    }
    candidates.sort_by_key(|c| (c.score, c.capo));
    candidates.truncate(3);
    Ok(candidates)
}

fn push_section(document: &mut ChartDocument, section: ChartSection) {
    if !section.lines.is_empty() {
        document.sequence.push(ChartOccurrence {
            id: id(),
            section_id: section.id.clone(),
        });
        document.sections.push(section);
    }
}
fn inline_line(input: &str, warnings: &mut Vec<String>) -> ChartLine {
    let mut result = line("");
    let mut rest = input;
    while let Some(start) = rest.find('[') {
        result.text.push_str(&rest[..start]);
        if let Some(end) = rest[start + 1..].find(']') {
            let symbol = &rest[start + 1..start + 1 + end];
            if !symbol.trim().is_empty() && symbol.len() <= 80 {
                result.chords.push(ChartChord {
                    id: id(),
                    offset: result.text.graphemes(true).count(),
                    symbol: symbol.into(),
                });
            } else {
                result.text.push_str(&rest[start..start + end + 2]);
                warnings.push("Acorde vazio ou muito longo mantido no texto.".into());
            }
            rest = &rest[start + end + 2..];
        } else {
            result.text.push_str(&rest[start..]);
            warnings.push("Colchete sem fechamento mantido no texto.".into());
            rest = "";
            break;
        }
    }
    result.text.push_str(rest);
    result
}
pub fn import_chordpro(text: &str) -> Result<ChartImportResult, String> {
    if text.len() > 500_000 {
        return Err("Arquivo de cifra excede 500 KB.".into());
    }
    let mut document = blank_document();
    let mut section = empty_section("Parte 1");
    let mut warnings = vec![];
    let mut shape_key = None;
    for raw in text.trim_start_matches('\u{feff}').lines() {
        let trimmed = raw.trim();
        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            let body = &trimmed[1..trimmed.len() - 1];
            let (key, value) = body
                .split_once(':')
                .map(|(k, v)| (k.trim(), v.trim()))
                .unwrap_or((body.trim(), ""));
            match key.to_lowercase().as_str() {
                "title" | "t" => document.title = value.into(),
                "artist" => document.artist = Some(value.into()),
                "key" | "k" => {
                    if key_valid(value) {
                        shape_key = Some(value.to_string());
                        if value.contains(['b', '♭']) {
                            document.spelling = ChartSpelling::Flats;
                        }
                    } else {
                        warnings.push("Tom importado não reconhecido; confirme o tom real.".into());
                        document.preserved_directives.push(trimmed.into());
                    }
                }
                "capo" => {
                    document.capo = value
                        .parse::<u8>()
                        .map_err(|_| "Capotraste importado inválido.")?;
                    if document.capo > 5 {
                        return Err(
                            "Este importador aceita capo entre 0 e 5. Revise o arquivo.".into()
                        );
                    }
                }
                "start_of_chorus" | "soc" | "start_of_verse" | "sov" | "start_of_bridge"
                | "sob" | "start_of_part" => {
                    push_section(&mut document, section);
                    let fallback = match key {
                        "start_of_chorus" | "soc" => "Refrão",
                        "start_of_bridge" | "sob" => "Ponte",
                        _ => "Estrofe",
                    };
                    section = empty_section(if value.is_empty() { fallback } else { value });
                }
                "end_of_chorus" | "eoc" | "end_of_verse" | "eov" | "end_of_bridge" | "eob"
                | "end_of_part" => {
                    push_section(&mut document, section);
                    section = empty_section("Parte");
                }
                _ => {
                    document.preserved_directives.push(trimmed.into());
                    warnings.push(format!(
                        "Diretiva preservada como metadado, sem execução: {key}"
                    ));
                }
            }
        } else if trimmed.is_empty() {
            push_section(&mut document, section);
            section = empty_section(&format!("Parte {}", document.sections.len() + 1));
        } else {
            section.lines.push(inline_line(raw, &mut warnings));
        }
    }
    push_section(&mut document, section);
    document.concert_key =
        shape_key.and_then(|k| shift_key(&k, document.capo as i8, document.spelling));
    validate_document(&document)?;
    let check = transpose(document.clone(), 0, document.capo, document.spelling)?;
    warnings.extend(check.warnings);
    Ok(ChartImportResult {
        document,
        warnings,
        format: "chordpro".into(),
    })
}
fn chord_row(raw: &str) -> Option<Vec<(usize, String)>> {
    let graphemes: Vec<_> = raw.graphemes(true).collect();
    let mut chords = vec![];
    let mut offset = 0;
    while offset < graphemes.len() {
        if graphemes[offset].trim().is_empty() {
            offset += 1;
            continue;
        }
        let start = offset;
        while offset < graphemes.len() && !graphemes[offset].trim().is_empty() {
            offset += 1;
        }
        let symbol = graphemes[start..offset].concat();
        if parse_chord(&symbol).is_none() && !annotation(&symbol) {
            return None;
        }
        chords.push((start, symbol));
    }
    (!chords.is_empty()).then_some(chords)
}
pub fn import_text(text: &str) -> Result<ChartImportResult, String> {
    if text.len() > 500_000 {
        return Err("Arquivo de cifra excede 500 KB.".into());
    }
    let mut document = blank_document();
    let mut section = empty_section("Parte 1");
    let mut warnings = vec![];
    let rows: Vec<_> = text.lines().map(|v| v.replace('\t', "    ")).collect();
    let mut index = 0;
    while index < rows.len() {
        let raw = &rows[index];
        if raw.trim().is_empty() {
            push_section(&mut document, section);
            section = empty_section(&format!("Parte {}", document.sections.len() + 1));
            index += 1;
            continue;
        }
        if let Some(chords) = chord_row(raw) {
            let has_lyric = rows
                .get(index + 1)
                .is_some_and(|next| !next.trim().is_empty() && chord_row(next).is_none());
            let mut output = if has_lyric {
                index += 1;
                line(&rows[index])
            } else {
                line("")
            };
            let length = output.text.graphemes(true).count();
            for (offset, symbol) in chords {
                if has_lyric && offset > length {
                    warnings.push(
                        "Acorde após o fim da letra ancorado no final; revise o alinhamento."
                            .into(),
                    );
                }
                output.chords.push(ChartChord {
                    id: id(),
                    offset: offset.min(length),
                    symbol,
                });
            }
            section.lines.push(output);
        } else {
            section.lines.push(line(raw));
        }
        index += 1;
    }
    push_section(&mut document, section);
    validate_document(&document)?;
    warnings.push("Confira o alinhamento importado. O tom real precisa ser confirmado.".into());
    Ok(ChartImportResult {
        document,
        warnings,
        format: "text".into(),
    })
}
pub fn export_chordpro(document: &ChartDocument) -> Result<String, String> {
    validate_document(document)?;
    // Unescaped brackets are ambiguous in ChordPro. Refuse lossy export.
    if document.title.contains(['\n', '\r', '{', '}'])
        || document.notes.contains(['{', '}'])
        || document
            .artist
            .as_ref()
            .is_some_and(|v| v.contains(['\n', '\r', '{', '}']))
        || document
            .sections
            .iter()
            .flat_map(|s| &s.lines)
            .any(|l| l.text.contains(['[', ']', '{', '}']))
    {
        return Err("ChordPro não permite estes delimitadores literais nesta versão. Remova colchetes/chaves do texto antes de exportar.".into());
    }
    let mut output = format!("{{title: {}}}\n", document.title);
    if let Some(artist) = &document.artist {
        output.push_str(&format!("{{artist: {artist}}}\n"));
    }
    if let Some(key) = document
        .concert_key
        .as_ref()
        .and_then(|k| shift_key(k, -(document.capo as i8), document.spelling))
    {
        output.push_str(&format!("{{key: {key}}}\n"));
    }
    output.push_str(&format!("{{capo: {}}}\n", document.capo));
    for directive in &document.preserved_directives {
        output.push_str(directive);
        output.push('\n');
    }
    for note_line in document.notes.lines() {
        output.push_str(&format!("{{comment: {}}}\n", note_line));
    }
    for occurrence in &document.sequence {
        let section = document
            .sections
            .iter()
            .find(|s| s.id == occurrence.section_id)
            .expect("validated sequence");
        output.push_str(&format!("\n{{start_of_verse: {}}}\n", section.label));
        for line in &section.lines {
            let mut chords: Vec<_> = line.chords.iter().collect();
            chords.sort_by_key(|c| c.offset);
            let graphemes: Vec<_> = line.text.graphemes(true).collect();
            let mut next = 0;
            for offset in 0..=graphemes.len() {
                while next < chords.len() && chords[next].offset == offset {
                    output.push_str(&format!("[{}]", chords[next].symbol));
                    next += 1;
                }
                if offset < graphemes.len() {
                    output.push_str(graphemes[offset]);
                }
            }
            output.push('\n');
        }
        output.push_str("{end_of_verse}\n");
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn doc() -> ChartDocument {
        import_chordpro("{title: Exemplo}\n{key: D}\n[D/F#]Ame [G6/9]a vida [N.C.]sempre")
            .unwrap()
            .document
    }
    #[test]
    fn transpose_root_bass_extension_and_capo() {
        let result = transpose(doc(), 2, 0, ChartSpelling::Sharps).unwrap();
        assert_eq!(result.document.concert_key.as_deref(), Some("E"));
        assert_eq!(
            result.document.sections[0].lines[0].chords[0].symbol,
            "E/G#"
        );
        assert_eq!(
            result.document.sections[0].lines[0].chords[1].symbol,
            "A6/9"
        );
        let shapes = transpose(result.document, 0, 2, ChartSpelling::Sharps)
            .unwrap()
            .document;
        assert_eq!(shapes.concert_key.as_deref(), Some("E"));
        assert_eq!(shapes.sections[0].lines[0].chords[0].symbol, "D/F#");
    }
    #[test]
    fn all_pitches_preserve_sound_when_changing_capo() {
        for pitch in 0..12 {
            for capo in 0..=5 {
                let original = transpose(doc(), pitch, 0, ChartSpelling::Flats)
                    .unwrap()
                    .document;
                let changed = transpose(original.clone(), 0, capo, ChartSpelling::Flats)
                    .unwrap()
                    .document;
                let root = parse_chord(&changed.sections[0].lines[0].chords[0].symbol)
                    .unwrap()
                    .root;
                assert_eq!(
                    (root + capo as i8) % 12,
                    parse_chord(&original.sections[0].lines[0].chords[0].symbol)
                        .unwrap()
                        .root
                );
            }
        }
    }
    #[test]
    fn unicode_grapheme_anchors_and_unknown_directives_roundtrip() {
        let first =
            import_chordpro("{title: Teste}\n{custom: mantido}\nA\u{301}[C]ção [G]🙏🏽").unwrap();
        assert_eq!(first.document.sections[0].lines[0].chords[0].offset, 1);
        let second = import_chordpro(&export_chordpro(&first.document).unwrap()).unwrap();
        assert_eq!(second.document.sections[0].lines[0].text, "A\u{301}ção 🙏🏽");
        assert_eq!(second.document.sections[0].lines[0].chords[0].offset, 1);
        assert_eq!(
            second.document.preserved_directives,
            vec!["{custom: mantido}"]
        );
    }
    #[test]
    fn chordpro_capo_uses_shapes_and_does_not_double_add() {
        let document = import_chordpro("{key: C}\n{capo: 2}\n[C]Teste")
            .unwrap()
            .document;
        assert_eq!(document.concert_key.as_deref(), Some("D"));
        let again = import_chordpro(&export_chordpro(&document).unwrap())
            .unwrap()
            .document;
        assert_eq!(again.concert_key, document.concert_key);
        assert_eq!(again.capo, 2);
    }
    #[test]
    fn unknown_symbols_are_preserved_with_warning() {
        let result = transpose(
            import_chordpro("[Coda]Texto [*Rit.]fim").unwrap().document,
            2,
            0,
            ChartSpelling::Sharps,
        )
        .unwrap();
        assert_eq!(
            result.document.sections[0].lines[0].chords[0].symbol,
            "Coda"
        );
        assert_eq!(result.warnings.len(), 1);
    }
    #[test]
    fn text_above_lyrics_and_instrumental_lines() {
        let document = import_text("D   G\nOlá mundo\n\nAm  F\nC   G")
            .unwrap()
            .document;
        assert_eq!(document.sections[0].lines[0].chords[1].offset, 4);
        assert_eq!(document.sections[1].lines.len(), 2);
        assert!(document.sections[1].lines[0].text.is_empty());
    }
    #[test]
    fn duplicate_identity_and_invalid_anchor_rejected() {
        let mut document = doc();
        document.sections[0].lines[0].chords[0].offset = 999;
        assert!(validate_document(&document).is_err());
        let mut document = doc();
        document.sequence[0].id = document.sections[0].id.clone();
        assert!(validate_document(&document).is_err());
    }
    #[test]
    fn repeated_sequence_is_scored_and_exported() {
        let mut document = doc();
        document.sequence.push(ChartOccurrence {
            id: id(),
            section_id: document.sections[0].id.clone(),
        });
        assert_eq!(
            export_chordpro(&document).unwrap().matches("Ame").count(),
            2
        );
        let candidates = suggest_capos(document).unwrap();
        assert_eq!(candidates.len(), 3);
        assert!(candidates.iter().all(|c| c.capo <= 5));
    }
    #[test]
    fn key_heuristic_keeps_relative_major_minor_candidates() {
        let document = import_chordpro("[C]Teste [G]de [Am]tom [F]local")
            .unwrap()
            .document;
        let before = document.clone();
        let suggestions = suggest_keys(&document).unwrap();
        assert!(suggestions[..2].iter().any(|s| s.key == "C"));
        assert!(suggestions[..2].iter().any(|s| s.key == "Am"));
        assert_eq!(document, before);
        assert_eq!(suggestions[0].score, 100);
    }
    #[test]
    fn key_heuristic_without_chords_is_empty_and_capo_changes_concert_key() {
        assert!(
            suggest_keys(&import_chordpro("Texto sem acordes").unwrap().document)
                .unwrap()
                .is_empty()
        );
        let document = import_chordpro("{capo: 2}\n[C]Teste [G]de [Am]tom [F]local")
            .unwrap()
            .document;
        let suggestions = suggest_keys(&document).unwrap();
        assert!(suggestions[..2].iter().any(|s| s.key == "D"));
        assert!(suggestions[..2].iter().any(|s| s.key == "Bm"));
    }
}
