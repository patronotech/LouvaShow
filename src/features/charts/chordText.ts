export interface ChordToken { chord: string; start: number; end: number; text: string; textStart: number }
export interface ChartLine { start: number; text: string; kind: 'text' | 'section' | 'meta' | 'blank'; label: string; tokens: ChordToken[] }

/** Source offsets are only editor cursors. The canonical file anchors chords inline. */
export function parseChordText(source: string): ChartLine[] {
  let offset = 0;
  return source.split('\n').map(text => {
    const start = offset; offset += text.length + 1;
    const directive = text.trim().match(/^\{([^:}]+)(?::\s*(.*))?\}$/);
    if (directive) {
      const tag = directive[1]!.toLowerCase();
      const label = directive[2] || ({ start_of_chorus: 'Refrão', soc: 'Refrão', start_of_verse: 'Estrofe', sov: 'Estrofe', start_of_bridge: 'Ponte', sob: 'Ponte' } as Record<string, string>)[tag] || '';
      const section = /^(start_of_|so[cvb]$|comment$|c$|chorus$)/.test(tag);
      return { start, text, kind: section ? 'section' : 'meta', label, tokens: [] } as ChartLine;
    }
    if (!text.trim()) return { start, text, kind: 'blank', label: '', tokens: [] } as ChartLine;
    const matches = [...text.matchAll(/\[([^\]\n]+)\]/g)];
    const tokens: ChordToken[] = [];
    if (!matches.length || (matches[0]?.index ?? 0) > 0) {
      const end = matches[0]?.index ?? text.length;
      tokens.push({ chord: '', start, end: start, text: text.slice(0, end), textStart: start });
    }
    matches.forEach((match, index) => {
      const local = match.index!; const end = local + match[0].length;
      tokens.push({ chord: match[1]!, start: start + local, end: start + end, text: text.slice(end, matches[index + 1]?.index ?? text.length), textStart: start + end });
    });
    return { start, text, kind: 'text', label: '', tokens } as ChartLine;
  });
}

export function insertChord(source: string, offset: number, chord: string): string {
  const value = chord.trim();
  if (!value || /[\[\]\r\n]/.test(value)) throw new Error('Informe um acorde sem colchetes ou quebras de linha.');
  const at = Math.min(Math.max(0, offset), source.length);
  return source.slice(0, at) + `[${value}]` + source.slice(at);
}

export function replaceChord(source: string, token: ChordToken, chord: string): string {
  const without = source.slice(0, token.start) + source.slice(token.end);
  return chord.trim() ? insertChord(without, token.start, chord) : without;
}

export function moveChord(source: string, token: ChordToken, target: number): string {
  if (target >= token.start && target <= token.end) return source;
  const without = source.slice(0, token.start) + source.slice(token.end);
  return insertChord(without, target > token.end ? target - (token.end - token.start) : target, token.chord);
}

export function graphemes(text: string): { text: string; index: number }[] {
  return [...new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }).segment(text)].map(part => ({ text: part.segment, index: part.index }));
}

export function moveChordByCharacter(source: string, token: ChordToken, direction: -1 | 1): string {
  const lineStart = source.lastIndexOf('\n', token.start - 1) + 1;
  const lineEndIndex = source.indexOf('\n', token.end);
  const lineEnd = lineEndIndex < 0 ? source.length : lineEndIndex;
  const text = direction < 0 ? source.slice(lineStart, token.start) : source.slice(token.end, lineEnd);
  const parts = graphemes(text);
  if (!parts.length) return source;
  const previous = parts[parts.length - 1]!;
  // Adjacent chord tokens are handled in the raw editor instead of splitting their syntax.
  if (direction < 0 && previous.text === ']' || direction > 0 && parts[0]!.text === '[') return source;
  const target = direction < 0 ? lineStart + previous.index : token.end + parts[0]!.text.length;
  return moveChord(source, token, target);
}

export function lyricsToChordPro(title: string, artist: string | null, blocks: { label: string | null; text: string }[]): string {
  const safe = (value: string) => value.replace(/[{}\r\n]/g, ' ');
  return [`{title: ${safe(title)}}`, ...(artist ? [`{artist: ${safe(artist)}}`] : []), '', ...blocks.flatMap((block, index) => [`{comment: ${safe(block.label || `Parte ${index + 1}`)}}`, block.text, ''])].join('\n');
}
