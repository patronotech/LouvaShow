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
            "N.C." | "N.C" | "NC" | "PAUSA" | "-" | "%" | "|" | "||" | "|:" | ":|"
        )
        || {
            let repeat = symbol.trim().trim_matches(['(', ')']).to_lowercase();
            repeat
                .strip_suffix('x')
                .or_else(|| repeat.strip_prefix('x'))
                .and_then(|count| count.parse::<u8>().ok())
                .is_some_and(|count| count > 0)
        }
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

/// Clipboard HTML often inserts invisible separators around chord spans. Remove
/// only these nonprinting characters, retaining accents, emoji joiners and every
/// visible space. Tabs use four-column stops, matching the editing grid.
fn normalize_pasted_rows(text: &str) -> Vec<String> {
    let normalized: String = text
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .chars()
        .filter(|character| !matches!(character, '\u{200b}' | '\u{feff}' | '\u{ad}'))
        .map(|character| match character {
            '\u{a0}' | '\u{202f}' => ' ',
            other => other,
        })
        .collect();
    normalized
        .lines()
        .map(|raw| {
            let mut result = String::new();
            let mut column = 0;
            for grapheme in raw.graphemes(true) {
                if grapheme == "\t" {
                    let spaces = 4 - column % 4;
                    result.push_str(&" ".repeat(spaces));
                    column += spaces;
                } else {
                    result.push_str(grapheme);
                    column += 1;
                }
            }
            result
        })
        .collect()
}

fn section_name(value: &str) -> bool {
    let folded: String = value
        .trim()
        .trim_end_matches(':')
        .to_lowercase()
        .chars()
        .map(|character| match character {
            'á' | 'à' | 'â' | 'ã' => 'a',
            'é' | 'ê' => 'e',
            'í' => 'i',
            'ó' | 'ô' | 'õ' => 'o',
            'ú' | 'ü' => 'u',
            'ç' => 'c',
            '-' | '–' | '—' => ' ',
            other => other,
        })
        .collect();
    let words: Vec<_> = folded.split_whitespace().collect();
    let ordinal = |word: &str| {
        matches!(
            word,
            "primeira"
                | "segunda"
                | "terceira"
                | "quarta"
                | "quinta"
                | "sexta"
                | "setima"
                | "oitava"
                | "nona"
                | "decima"
        ) || word
            .trim_end_matches(['ª', 'º'])
            .parse::<u8>()
            .is_ok_and(|number| number > 0)
    };
    let number = |word: &str| {
        word.parse::<u8>().is_ok_and(|number| number > 0)
            || matches!(
                word,
                "i" | "ii" | "iii" | "iv" | "v" | "vi" | "vii" | "viii"
            )
    };
    match words.as_slice() {
        ["intro" | "introducao" | "final" | "fim" | "coda" | "interludio" | "instrumental"
        | "refrao" | "refrain" | "chorus" | "estrofe" | "verso" | "verse" | "ponte" | "bridge"
        | "solo" | "outro"] => true,
        ["pre" | "pos", "refrao"] => true,
        ["parte" | "estrofe" | "verso" | "refrao" | "ponte" | "solo", order] => number(order),
        [order, "parte" | "estrofe"] => ordinal(order),
        _ => false,
    }
}

/// Headers are deliberately conservative: a lyric such as "No final da rua"
/// must remain a lyric. Brackets, a colon, and known whole section names are
/// supported; an inline progression after a heading remains instrumental.
fn text_heading(raw: &str) -> Option<(&str, &str)> {
    let raw = raw.trim();
    if let Some(rest) = raw.strip_prefix('[') {
        let (label, tail) = rest.split_once(']')?;
        return section_name(label).then_some((label.trim(), tail.trim()));
    }
    if let Some((label, tail)) = raw.split_once(':') {
        if section_name(label) {
            return Some((label.trim(), tail.trim()));
        }
    }
    if section_name(raw) {
        return Some((raw.trim_end_matches(':').trim(), ""));
    }
    // Common plain-text form: "Intro C G/B Am7". Limit prefix scans so a long
    // lyric cannot turn this recognition into quadratic work.
    let mut previous_whitespace = false;
    for (index, character) in raw.char_indices().take(80) {
        let whitespace = character.is_whitespace();
        if whitespace && !previous_whitespace {
            let (label, tail) = raw.split_at(index);
            if section_name(label) && chord_row(tail).is_some() {
                return Some((label.trim(), tail.trim()));
            }
        }
        previous_whitespace = whitespace;
    }
    None
}

fn anchored_text_line(text: &str, chords: Vec<(usize, String)>) -> (ChartLine, bool) {
    let mut output = line(text);
    let length = text.graphemes(true).count();
    let last_anchor = chords.iter().map(|(offset, _)| *offset).max().unwrap_or(0);
    // The schema anchors within text. Trailing spaces preserve distant chords
    // and instrumental columns without collapsing all of them onto one syllable.
    if last_anchor > length {
        output.text.push_str(&" ".repeat(last_anchor - length));
    }
    output.chords = chords
        .into_iter()
        .map(|(offset, symbol)| ChartChord {
            id: id(),
            offset,
            symbol,
        })
        .collect();
    (output, !text.is_empty() && last_anchor > length)
}

fn cifra_club_footer_link(raw: &str) -> bool {
    let value = raw.trim().to_ascii_lowercase();
    let address = value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"))
        .unwrap_or(&value);
    let address = address.strip_prefix("www.").unwrap_or(address);
    value == "cifra club"
        || address == "cifraclub.com.br"
        || address.starts_with("cifraclub.com.br/")
}

fn chord_diagram(raw: &str) -> bool {
    let Some((symbol, fingering)) = raw.split_once('=') else {
        return false;
    };
    let frets: Vec<_> = fingering.split_whitespace().collect();
    parse_chord(symbol.trim()).is_some()
        && (4..=12).contains(&frets.len())
        && frets.iter().all(|fret| {
            fret.eq_ignore_ascii_case("x")
                || *fret == "-"
                || fret.parse::<u8>().is_ok_and(|value| value <= 36)
        })
}

fn set_text_metadata(target: &mut Option<String>, value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() || target.as_ref().is_some_and(|previous| previous != value) {
        return Err(format!(
            "Metadado {label} vazio ou conflitante no TXT. Revise o cabeçalho antes de importar."
        ));
    }
    *target = Some(value.to_string());
    Ok(())
}

/// Downloaded TXT has an artist/title header and a chord-diagram appendix. The
/// appendix is a fingerprint: plain pasted lyrics containing " - " are never
/// guessed to be metadata. Keep diagrams as notes, outside the sung sequence.
fn text_envelope(
    mut rows: Vec<String>,
    document: &mut ChartDocument,
    warnings: &mut Vec<String>,
) -> Result<Vec<String>, String> {
    let mut exported = false;
    let mut diagrams = vec![];
    if let Some(footer) = rows.iter().position(|raw| {
        let value = raw.trim();
        value.starts_with("---")
            && value.ends_with("---")
            && value
                .trim_matches('-')
                .trim()
                .eq_ignore_ascii_case("acordes")
    }) {
        for raw in &rows[footer + 1..] {
            if raw.trim().is_empty() || cifra_club_footer_link(raw) {
                continue;
            }
            if !chord_diagram(raw) {
                return Err("O rodapé de acordes do TXT contém uma linha não reconhecida. Revise ou remova o rodapé antes de importar; a cifra atual não foi alterada.".into());
            }
            diagrams.push(raw.trim().to_string());
        }
        if diagrams.is_empty() {
            return Err(
                "O rodapé de acordes do TXT está vazio. Revise o arquivo antes de importar.".into(),
            );
        }
        rows.truncate(footer);
        exported = true;
        warnings.push("Diagramas do rodapé foram mantidos nas notas, fora da letra.".into());
    }
    while rows
        .last()
        .is_some_and(|raw| raw.trim().is_empty() || cifra_club_footer_link(raw))
    {
        exported |= rows.last().is_some_and(|raw| cifra_club_footer_link(raw));
        rows.pop();
    }
    let mut title = None;
    let mut artist = None;
    let mut declared_key = None;
    let mut real_key = None;
    let mut shape_key = None;
    let mut capo = None;
    let mut notes = vec![];
    let mut index = rows
        .iter()
        .position(|raw| !raw.trim().is_empty())
        .unwrap_or(0);
    if exported {
        if let Some(raw) = rows.get(index) {
            if let Some((author, name)) = raw.trim().split_once(" - ") {
                if !author.contains(':') && text_heading(raw).is_none() && chord_row(raw).is_none()
                {
                    set_text_metadata(&mut artist, author.trim(), "artista")?;
                    set_text_metadata(&mut title, name.trim(), "título")?;
                    index += 1;
                    warnings.push("Cabeçalho do TXT lido como Artista - Título. Confira os metadados na revisão.".into());
                }
            }
        }
    }
    while let Some(raw) = rows.get(index) {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            index += 1;
            continue;
        }
        let Some((label, value)) = trimmed.split_once(':') else {
            break;
        };
        let value = value.trim();
        match label.trim().to_lowercase().as_str() {
            "título" | "titulo" => set_text_metadata(&mut title, value, "título")?,
            "artista" | "intérprete" | "interprete" => {
                set_text_metadata(&mut artist, value, "artista")?
            }
            "tom" => set_text_metadata(&mut declared_key, value, "tom")?,
            "tom real" => set_text_metadata(&mut real_key, value, "tom real")?,
            "tom das formas" => set_text_metadata(&mut shape_key, value, "tom das formas")?,
            "capotraste" | "capo" => {
                let normalized = value.to_lowercase();
                let words: Vec<_> = normalized.split_whitespace().collect();
                let number = match words.as_slice() {
                    ["sem"] | ["sem", "capo" | "capotraste"] => Some(0),
                    [number] | [number, "casa" | "casas"] => {
                        number.trim_end_matches(['ª', 'º']).parse::<u8>().ok()
                    }
                    _ => None,
                }
                .filter(|number| *number <= 5)
                .ok_or("Capotraste inválido no TXT. Informe uma casa entre 0 e 5.")?;
                if capo.is_some_and(|previous| previous != number) {
                    return Err("Capotraste conflitante no TXT. Revise o cabeçalho.".into());
                }
                capo = Some(number);
            }
            "afinação" | "afinacao" | "composição" | "composicao" => {
                notes.push(trimmed.to_string())
            }
            _ => break,
        }
        index += 1;
    }
    document.title = title.unwrap_or_else(|| document.title.clone());
    document.artist = artist;
    document.capo = capo.unwrap_or(0);
    for key in [&declared_key, &real_key, &shape_key].into_iter().flatten() {
        if !key_valid(key) {
            return Err("Tom inválido no cabeçalho do TXT. Informe uma nota como D, Bb ou F#m; nenhum tom foi inferido.".into());
        }
        if key.contains(['b', '♭']) {
            document.spelling = ChartSpelling::Flats;
        }
    }
    let from_shapes = shape_key
        .as_ref()
        .and_then(|key| shift_key(key, document.capo as i8, document.spelling));
    if real_key.is_some() && from_shapes.is_some() && real_key != from_shapes {
        return Err("Tom real e tom das formas são conflitantes com o capotraste do TXT. Revise o cabeçalho.".into());
    }
    document.concert_key = real_key.or(from_shapes);
    if let Some(key) = declared_key {
        if document.capo == 0 {
            if document
                .concert_key
                .as_ref()
                .is_some_and(|real| real != &key)
            {
                return Err("Os campos de tom do TXT são conflitantes. Revise o cabeçalho.".into());
            }
            document.concert_key = Some(key);
        } else {
            notes.push(format!(
                "Tom informado no TXT: {key}; capotraste: {}.",
                document.capo
            ));
            warnings.push("O TXT informa Tom e capotraste sem distinguir tom real de formas. O valor original está nas notas; confirme o tom real antes de salvar.".into());
        }
    }
    if !diagrams.is_empty() {
        notes.push(format!(
            "Diagramas de acordes do TXT:\n{}",
            diagrams.join("\n")
        ));
    }
    document.notes = notes.join("\n\n");
    Ok(rows.into_iter().skip(index).collect())
}

pub fn import_text(text: &str) -> Result<ChartImportResult, String> {
    if text.len() > 500_000 {
        return Err("Arquivo de cifra excede 500 KB.".into());
    }
    let mut document = blank_document();
    let mut section = empty_section("Parte 1");
    let mut warnings = vec![];
    let rows = text_envelope(normalize_pasted_rows(text), &mut document, &mut warnings)?;
    let mut padded_lyrics = false;
    let mut explicit_section = false;
    let mut index = 0;
    while index < rows.len() {
        let raw = &rows[index];
        if raw.trim().is_empty() {
            // Within a named part, blank rows are visual spacing, not new parts.
            // Plain pasted paragraphs still form separate implicit sections.
            if !explicit_section && !section.lines.is_empty() {
                push_section(&mut document, section);
                section = empty_section(&format!("Parte {}", document.sections.len() + 1));
            }
            index += 1;
            continue;
        }
        if let Some((label, tail)) = text_heading(raw) {
            push_section(&mut document, section);
            section = empty_section(label);
            explicit_section = true;
            if !tail.is_empty() {
                if let Some(chords) = chord_row(tail) {
                    section.lines.push(anchored_text_line("", chords).0);
                } else {
                    section.lines.push(line(tail));
                }
            }
            index += 1;
            continue;
        }
        if let Some(chords) = chord_row(raw) {
            let has_lyric = rows.get(index + 1).is_some_and(|next| {
                !next.trim().is_empty() && text_heading(next).is_none() && chord_row(next).is_none()
            });
            let text = if has_lyric {
                index += 1;
                rows[index].as_str()
            } else {
                ""
            };
            let (output, padded) = anchored_text_line(text, chords);
            padded_lyrics |= padded;
            section.lines.push(output);
        } else {
            section.lines.push(line(raw));
        }
        index += 1;
    }
    push_section(&mut document, section);
    validate_document(&document)?;
    if padded_lyrics {
        warnings.push("Acordes após o fim da letra mantiveram suas colunas com espaços finais. Revise o alinhamento.".into());
    }
    warnings.push(
        if document.concert_key.is_some() {
            "Confira o alinhamento e o tom informado no TXT antes de salvar."
        } else {
            "Confira o alinhamento importado. O tom real precisa ser confirmado."
        }
        .into(),
    );
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
        assert!(document.sections[1].lines[0].text.trim().is_empty());
        assert_eq!(document.sections[1].lines[0].chords[1].offset, 4);
    }
    #[test]
    fn pasted_invisible_characters_do_not_change_visible_chord_columns() {
        let pasted = "\u{feff}[Segunda Parte]\r\n\u{200b}C7M\u{200b}  G/B\u{a0}D/F#\r\nA\u{301}ção e fe\u{ad}licidade 🙏🏽";
        let document = import_text(pasted).unwrap().document;
        assert_eq!(document.sections.len(), 1);
        assert_eq!(document.sections[0].label, "Segunda Parte");
        let line = &document.sections[0].lines[0];
        assert_eq!(line.text, "A\u{301}ção e felicidade 🙏🏽");
        assert_eq!(
            line.chords
                .iter()
                .map(|c| (c.symbol.as_str(), c.offset))
                .collect::<Vec<_>>(),
            vec![("C7M", 0), ("G/B", 5), ("D/F#", 9)]
        );
        validate_document(&document).unwrap();
    }
    #[test]
    fn pasted_tabs_follow_stops_and_nonbreaking_spaces_keep_columns() {
        let document = import_text("C\tG7/B\tAm9\r\tAção\u{a0}e\u{202f}fé nesta linha")
            .unwrap()
            .document;
        let line = &document.sections[0].lines[0];
        assert_eq!(
            line.chords.iter().map(|c| c.offset).collect::<Vec<_>>(),
            vec![0, 4, 12]
        );
        assert_eq!(line.text, "    Ação e fé nesta linha");
    }
    #[test]
    fn grapheme_columns_retain_combining_accents_and_emoji_joiners() {
        let document = import_text("C   G\nA\u{301}👩‍👩‍👧‍👦ção e fé").unwrap().document;
        let line = &document.sections[0].lines[0];
        assert_eq!(
            line.text.graphemes(true).take(4).collect::<Vec<_>>(),
            vec!["A\u{301}", "👩‍👩‍👧‍👦", "ç", "ã"]
        );
        assert_eq!(line.chords[1].offset, 4);
        assert_eq!(
            line.text.graphemes(true).nth(line.chords[1].offset),
            Some("o")
        );
    }
    #[test]
    fn headings_and_consecutive_instrumental_rows_do_not_become_lyrics() {
        let document = import_text("[Intro] D/F#  Em7\nC7M  G/B\n[Segunda Parte]\n\nAm7  D7\nTexto sintético para testar\n[Refrão]\nG6/9  D7/F#\nOutra frase criada para teste\nFinal: C  G/B\nInterlúdio\nAm7  F7M\nG7   C").unwrap().document;
        assert_eq!(
            document
                .sections
                .iter()
                .map(|s| s.label.as_str())
                .collect::<Vec<_>>(),
            vec!["Intro", "Segunda Parte", "Refrão", "Final", "Interlúdio"]
        );
        assert_eq!(document.sections[0].lines.len(), 2);
        assert!(document.sections[0]
            .lines
            .iter()
            .all(|line| line.text.trim().is_empty()));
        assert_eq!(
            document.sections[1].lines[0].text,
            "Texto sintético para testar"
        );
        assert_eq!(document.sections[4].lines.len(), 2);
        assert!(document.sections[4]
            .lines
            .iter()
            .all(|line| line.text.trim().is_empty()));
        assert!(document.sections[2].lines[0]
            .chords
            .iter()
            .any(|c| c.symbol == "D7/F#"));
    }
    #[test]
    fn section_recognition_does_not_eat_ordinary_lyric_lines() {
        let document = import_text("Intro C G\nNo final da rua há luz\nC  G\nA segunda parte desta frase é texto\nPré-Refrão\nDm7 G\nPalavras novas no papel\nParte 2\nC7M(9) G6/9/E\nMais uma linha de demonstração").unwrap().document;
        assert_eq!(document.sections.len(), 3);
        assert_eq!(document.sections[0].lines[1].text, "No final da rua há luz");
        assert_eq!(
            document.sections[0].lines[2].text,
            "A segunda parte desta frase é texto"
        );
        assert_eq!(document.sections[1].label, "Pré-Refrão");
        assert_eq!(document.sections[2].label, "Parte 2");
        assert_eq!(document.sections[2].lines[0].chords[1].symbol, "G6/9/E");
    }
    #[test]
    fn distant_chords_keep_offsets_and_roundtrip_without_losing_symbols() {
        let imported =
            import_text("[Intro]\nC     G/B   Am7 (2x)\n[Refrão]\nC          G/B     Am7\nOi")
                .unwrap();
        let line = &imported.document.sections[1].lines[0];
        assert_eq!(line.text.trim_end(), "Oi");
        assert_eq!(
            line.chords.iter().map(|c| c.offset).collect::<Vec<_>>(),
            vec![0, 11, 19]
        );
        assert!(imported
            .warnings
            .iter()
            .any(|warning| warning.contains("espaços finais")));
        let exported = export_chordpro(&imported.document).unwrap();
        let reimported = import_chordpro(&exported).unwrap().document;
        assert_eq!(reimported.sections.len(), imported.document.sections.len());
        for (before, after) in imported.document.sections.iter().zip(&reimported.sections) {
            assert_eq!(before.label, after.label);
            assert_eq!(before.lines.len(), after.lines.len());
            for (left, right) in before.lines.iter().zip(&after.lines) {
                assert_eq!(left.text, right.text);
                assert_eq!(
                    left.chords
                        .iter()
                        .map(|c| (&c.symbol, c.offset))
                        .collect::<Vec<_>>(),
                    right
                        .chords
                        .iter()
                        .map(|c| (&c.symbol, c.offset))
                        .collect::<Vec<_>>()
                );
            }
        }
        let transposed = transpose(imported.document, 2, 0, ChartSpelling::Sharps).unwrap();
        assert_eq!(
            transposed.document.sections[0].lines[0]
                .chords
                .last()
                .unwrap()
                .symbol,
            "(2x)"
        );
        assert!(transposed.warnings.is_empty());
    }
    #[test]
    fn named_txt_parts_keep_internal_paragraphs_and_implicit_prefix_still_splits() {
        let text = "C\nPrimeiro parágrafo de exemplo\n\nG\nSegundo parágrafo de exemplo\n\n[Primeira Parte]\n\nD\nLinha criada para teste\n\nBm7\nOutra linha criada para teste\n\n[Refrão]\nA\nUma frase original\n\nG\nMais uma frase original\n\n[Segunda Parte]\nD/F#\nTexto final de teste\n\n[Refrão]\nA\nRepetição de exemplo";
        let document = import_text(text).unwrap().document;
        assert_eq!(document.sections.len(), 6);
        assert_eq!(
            document
                .sections
                .iter()
                .map(|section| section.label.as_str())
                .collect::<Vec<_>>(),
            vec![
                "Parte 1",
                "Parte 2",
                "Primeira Parte",
                "Refrão",
                "Segunda Parte",
                "Refrão"
            ]
        );
        assert_eq!(
            document
                .sections
                .iter()
                .map(|section| section.lines.len())
                .collect::<Vec<_>>(),
            vec![1, 1, 2, 2, 1, 1]
        );
        let again = import_chordpro(&export_chordpro(&document).unwrap())
            .unwrap()
            .document;
        assert_eq!(document.sections.len(), again.sections.len());
        for (before, after) in document.sections.iter().zip(&again.sections) {
            assert_eq!(before.label, after.label);
            assert_eq!(before.lines.len(), after.lines.len());
            for (a, b) in before.lines.iter().zip(&after.lines) {
                assert_eq!(a.text, b.text);
                assert_eq!(
                    a.chords
                        .iter()
                        .map(|c| (&c.symbol, c.offset))
                        .collect::<Vec<_>>(),
                    b.chords
                        .iter()
                        .map(|c| (&c.symbol, c.offset))
                        .collect::<Vec<_>>()
                );
            }
        }
    }

    #[test]
    fn downloaded_txt_keeps_metadata_columns_and_diagrams_outside_lyrics() {
        let text = "Grupo Exemplo - Canção de Teste - 39\r\n\r\n[Primeira Parte]\r\n\r\n D                 Bm7\r\nAção de teste nesta linha\r\n         A\r\nOutra frase original\r\n\r\n[Refrão]\r\nD/F#       G\r\nUma nova linha de exemplo\r\n\r\n----------------- Acordes -----------------\r\nA = X 0 2 2 2 0\r\nBm7 = X 2 4 2 3 2\r\nD = X X 0 2 3 2\r\nD/F# = 2 X 0 2 3 2\r\nG = 3 2 0 0 0 3\r\nhttps://www.cifraclub.com.br/grupo-exemplo/cancao-de-teste/";
        let imported = import_text(text).unwrap();
        let document = &imported.document;
        assert_eq!(document.title, "Canção de Teste - 39");
        assert_eq!(document.artist.as_deref(), Some("Grupo Exemplo"));
        assert_eq!(document.concert_key, None);
        assert_eq!(document.capo, 0);
        assert_eq!(document.sections.len(), 2);
        assert_eq!(document.sections[0].label, "Primeira Parte");
        assert_eq!(document.sections[1].label, "Refrão");
        assert_eq!(
            document.sections[0].lines[0].text,
            "Ação de teste nesta linha"
        );
        assert_eq!(document.sections[0].lines[0].chords[0].offset, 1);
        assert_eq!(document.sections[0].lines[0].chords[1].offset, 19);
        assert_eq!(document.sections[0].lines[1].chords[0].offset, 9);
        assert!(document.sections.iter().flat_map(|s| &s.lines).all(|line| {
            !line.text.contains(" = ")
                && !line.text.contains("cifraclub")
                && !line.text.contains("Grupo Exemplo")
        }));
        assert!(document.notes.contains("D/F# = 2 X 0 2 3 2"));
        assert!(imported
            .warnings
            .iter()
            .any(|message| message.contains("rodapé")));
        let exported = export_chordpro(document).unwrap();
        let again = import_chordpro(&exported).unwrap().document;
        assert_eq!(again.title, document.title);
        assert_eq!(again.artist, document.artist);
        for (before, after) in document.sections.iter().zip(&again.sections) {
            assert_eq!(before.label, after.label);
            for (original, roundtrip) in before.lines.iter().zip(&after.lines) {
                assert_eq!(original.text, roundtrip.text);
                assert_eq!(
                    original
                        .chords
                        .iter()
                        .map(|chord| (&chord.symbol, chord.offset))
                        .collect::<Vec<_>>(),
                    roundtrip
                        .chords
                        .iter()
                        .map(|chord| (&chord.symbol, chord.offset))
                        .collect::<Vec<_>>()
                );
            }
        }
    }

    #[test]
    fn plain_pasted_hyphenated_lyrics_are_not_guessed_as_title() {
        let document = import_text("Vida - exemplo de frase\n[Refrão]\nC   G\nLinha criada aqui")
            .unwrap()
            .document;
        assert_eq!(document.title, "Cifra importada");
        assert_eq!(document.artist, None);
        assert_eq!(
            document.sections[0].lines[0].text,
            "Vida - exemplo de frase"
        );
        assert_eq!(document.sections[1].label, "Refrão");
    }

    #[test]
    fn txt_explicit_metadata_keeps_real_key_and_capo_semantics() {
        let document = import_text("Título: Exemplo local\nArtista: Autor de teste\nTom: Bb\nCapotraste: 0\n\n[Verso]\nBb       F/A\nAcentuação preservada").unwrap().document;
        assert_eq!(document.concert_key.as_deref(), Some("Bb"));
        assert_eq!(document.spelling, ChartSpelling::Flats);
        assert_eq!(document.sections[0].lines[0].chords[0].symbol, "Bb");
        let explicit =
            import_text("Tom das formas: C\nCapotraste: 2ª casa\n[Verso]\nC G\nLinha sintética")
                .unwrap()
                .document;
        assert_eq!(explicit.concert_key.as_deref(), Some("D"));
        assert_eq!(explicit.capo, 2);
        assert_eq!(explicit.sections[0].lines[0].chords[0].symbol, "C");
        let ambiguous =
            import_text("Tom: D\nCapotraste: 2\n[Verso]\nC G\nLinha sintética").unwrap();
        assert_eq!(ambiguous.document.concert_key, None);
        assert_eq!(ambiguous.document.capo, 2);
        assert!(ambiguous.document.notes.contains("Tom informado no TXT: D"));
        assert!(ambiguous
            .warnings
            .iter()
            .any(|message| message.contains("sem distinguir")));
        let explicit_real = import_text("Tom real: D\nCapo: 2\nC G\nLinha sintética")
            .unwrap()
            .document;
        assert_eq!(explicit_real.concert_key.as_deref(), Some("D"));
    }

    #[test]
    fn txt_metadata_conflicts_and_malformed_footer_fail_without_dropping_text() {
        for text in [
            "Tom: H\nC\nExemplo",
            "Tom: C\nTom: D\nC\nExemplo",
            "Capotraste: 6\nC\nExemplo",
            "Capo: 1\nCapo: 2\nC\nExemplo",
            "Tom real: F\nTom das formas: C\nCapo: 2\nC\nExemplo",
            "C\nExemplo\n--- Acordes ---\nD = X X 0 2 3 2\nTexto desconhecido após o rodapé",
        ] {
            assert!(import_text(text).is_err());
        }
        let input = "Título: Canção - Exemplo\nArtista: Teste\nC\nLinha sintética\n--- Acordes ---\nC = X 3 2 0 1 0";
        let document = import_text(input).unwrap().document;
        assert_eq!(document.title, "Canção - Exemplo");
        assert_eq!(document.artist.as_deref(), Some("Teste"));
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
