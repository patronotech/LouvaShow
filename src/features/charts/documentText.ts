import type { ChartDocument, ChartLine } from './contracts';
import { graphemes, type ChartLine as RenderLine, type ChordToken } from './chordText';

export interface SourceAnchor { sectionId: string; lineId: string; offset: number; chordId?: string }
/** Rendering consumes structured tokens; brackets in lyrics are never parsed as chords. */
export function documentSource(document: ChartDocument): { source: string; anchors: Map<number, SourceAnchor>; lines: RenderLine[] } {
  let source = ''; const anchors = new Map<number, SourceAnchor>(); const lines: RenderLine[] = [];
  for (const occurrence of document.sequence) {
    const section = document.sections.find(value => value.id === occurrence.sectionId);
    if (!section) continue;
    const heading = `{comment: ${section.label.replace(/[{}\n]/g, ' ')}}`;
    lines.push({ start: source.length, text: heading, kind: 'section', label: section.label, tokens: [] });
    source += `${heading}\n`;
    for (const line of section.lines) {
      const start = source.length; const tokens: ChordToken[] = [];
      let token: ChordToken = { chord: '', start, end: start, text: '', textStart: start };
      const letters = graphemes(line.text);
      for (let offset = 0; offset <= letters.length; offset++) {
        for (const chord of line.chords.filter(value => value.offset === offset)) {
          if (token.chord || token.text) tokens.push(token);
          const chordStart = source.length;
          anchors.set(chordStart, { sectionId: section.id, lineId: line.id, offset, chordId: chord.id });
          source += `[${chord.symbol}]`;
          token = { chord: chord.symbol, start: chordStart, end: source.length, textStart: source.length, text: '' };
        }
        anchors.set(source.length, { sectionId: section.id, lineId: line.id, offset });
        if (offset < letters.length) { const letter = letters[offset]!.text; source += letter; token.text += letter; }
      }
      if (token.chord || token.text || !tokens.length) tokens.push(token);
      lines.push({ start, text: source.slice(start), kind: 'text', label: '', tokens });
      source += '\n';
    }
    lines.push({ start: source.length, text: '', kind: 'blank', label: '', tokens: [] });
    source += '\n';
  }
  return { source, anchors, lines };
}
export function updateLine(document: ChartDocument, anchor: SourceAnchor, change: (line: ChartLine) => ChartLine): ChartDocument {
  return { ...document, sections: document.sections.map(section => section.id !== anchor.sectionId ? section : { ...section, lines: section.lines.map(line => line.id !== anchor.lineId ? line : change(line)) }) };
}
export function setAnchoredChord(document: ChartDocument, anchor: SourceAnchor, symbol: string): ChartDocument {
  const clean = symbol.trim();
  if (/[\[\]\r\n]/.test(clean)) throw new Error('Informe o acorde sem colchetes ou quebras de linha.');
  return updateLine(document, anchor, line => ({ ...line, chords: [...line.chords.filter(chord => chord.id !== anchor.chordId), ...(clean ? [{ id: anchor.chordId || newChartId(), offset: anchor.offset, symbol: clean }] : [])].sort((a, b) => a.offset - b.offset) }));
}
export function moveAnchoredChord(document: ChartDocument, from: SourceAnchor, to: SourceAnchor): ChartDocument {
  const line = document.sections.find(section => section.id === from.sectionId)?.lines.find(line => line.id === from.lineId);
  const chord = line?.chords.find(chord => chord.id === from.chordId);
  if (!chord) return document;
  const removed = updateLine(document, from, current => ({ ...current, chords: current.chords.filter(value => value.id !== chord.id) }));
  return updateLine(removed, to, current => ({ ...current, chords: [...current.chords, { ...chord, offset: Math.min(graphemes(current.text).length, Math.max(0, to.offset)) }].sort((a, b) => a.offset - b.offset) }));
}

/** getRandomValues also works on trusted HTTP LAN origins, unlike randomUUID. */
export function newChartId(): string {
 const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128;
 const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
