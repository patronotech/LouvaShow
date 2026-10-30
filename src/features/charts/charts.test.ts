import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChordSheet } from './ChordSheet';
import { describe, expect, it } from 'vitest';
import type { ChartDocument } from './contracts';
import { documentSource, moveAnchoredChord, newChartId, setAnchoredChord } from './documentText';
import { graphemes, insertChord, moveChordByCharacter, parseChordText } from './chordText';
const base = (): ChartDocument => ({ schemaVersion: 1, title: 'Teste original', artist: null, concertKey: null, capo: 0, spelling: 'sharps', notes: '', preservedDirectives: [], sections: [{ id: 'section', label: 'Refrão', lines: [{ id: 'line', text: 'Amém 🙏🏽', chords: [{ id: 'chord', offset: 2, symbol: 'C/G' }] }] }], sequence: [{ id: 'one', sectionId: 'section' }, { id: 'two', sectionId: 'section' }] });
describe('cifras e âncoras', () => {
 it('conta acento combinado e emoji como grafemas', () => { expect(graphemes('é🙏🏽')).toHaveLength(2); });
 it('renderiza acorde na âncora e preserva repetições da mesma seção', () => { const result = documentSource(base()); expect(result.source.match(/Am\[C\/G\]ém 🙏🏽/g)).toHaveLength(2); expect([...result.anchors.values()].filter(value => value.chordId === 'chord')).toHaveLength(2); });
 it('mover um acorde não altera a letra e atualiza todas as ocorrências', () => { const before = base(); const next = moveAnchoredChord(before, { sectionId: 'section', lineId: 'line', offset: 2, chordId: 'chord' }, { sectionId: 'section', lineId: 'line', offset: 4 }); expect(next.sections[0]!.lines[0]!.text).toBe(before.sections[0]!.lines[0]!.text); expect(next.sections[0]!.lines[0]!.chords[0]).toEqual({ id: 'chord', offset: 4, symbol: 'C/G' }); expect(before.sections[0]!.lines[0]!.chords[0]!.offset).toBe(2); expect(documentSource(next).source.match(/Amém\[C\/G\] 🙏🏽/g)).toHaveLength(2); });
 it('limita a âncora às bordas da linha', () => { const next = moveAnchoredChord(base(), { sectionId: 'section', lineId: 'line', offset: 2, chordId: 'chord' }, { sectionId: 'section', lineId: 'line', offset: -4 }); expect(next.sections[0]!.lines[0]!.chords[0]!.offset).toBe(0); });
 it('editar acorde mantém identidade e remover não altera texto', () => { const anchor = { sectionId: 'section', lineId: 'line', offset: 2, chordId: 'chord' }; const updated = setAnchoredChord(base(), anchor, 'D/F#'); expect(updated.sections[0]!.lines[0]!.chords[0]!.id).toBe('chord'); expect(setAnchoredChord(updated, anchor, '').sections[0]!.lines[0]!.chords).toEqual([]); });
 it('recusa símbolos que quebrariam ChordPro', () => expect(() => insertChord('amém', 0, '[C]')).toThrow());
 it('mover com seta não separa acento composto', () => { const source = 'é[C]m'; const token = parseChordText(source)[0]!.tokens.find(value => value.chord)!; expect(moveChordByCharacter(source, token, -1)).toBe('[C]ém'); });
 it('colchetes, chaves e barras literais não viram acordes ou diretivas', () => {
   const doc = base(); const text = '[Refrão] {title: literal} \\ [C] é 🙏🏽';
   doc.sections[0]!.lines[0]!.text = text;
   doc.sections[0]!.lines[0]!.chords = [{ id: 'real', offset: 9, symbol: 'D/F#' }];
   const rendered = documentSource(doc); const rows = rendered.lines.filter(line => line.kind === 'text');
   expect(rows).toHaveLength(2);
   for (const row of rows) {
     expect(row.tokens.map(token => token.text).join('')).toBe(text);
     expect(row.tokens.filter(token => token.chord).map(token => token.chord)).toEqual(['D/F#']);
     const token = row.tokens.find(token => token.chord)!;
     expect(rendered.anchors.get(token.start)).toMatchObject({ chordId: 'real', offset: 9 });
   }
 });
 it('preserva âncoras de todos os grafemas, mesmo com sintaxe literal entre acordes', () => {
   const doc = base(); doc.sequence = doc.sequence.slice(0, 1);
   const text = '[C]é🙏🏽\\fim'; const parts = graphemes(text);
   doc.sections[0]!.lines[0]!.text = text;
   doc.sections[0]!.lines[0]!.chords = [{ id: 'first', offset: 0, symbol: 'C' }, { id: 'unicode', offset: 4, symbol: 'G/B' }, { id: 'end', offset: parts.length, symbol: 'F' }];
   const rendered = documentSource(doc); const row = rendered.lines.find(line => line.kind === 'text')!;
   let expectedOffset = 0;
   for (const token of row.tokens) {
     if (token.chord) expect(rendered.anchors.get(token.start)?.offset).toBe(expectedOffset);
     for (const part of graphemes(token.text)) {
       expect(rendered.anchors.get(token.textStart + part.index)?.offset).toBe(expectedOffset++);
     }
   }
   expect(expectedOffset).toBe(parts.length);
   expect(row.tokens.map(token => token.text).join('')).toBe(text);
 });
 it('renderer usa tokens estruturados e escapa texto HTML sem interpretar marcações da letra', () => {
   const doc = base(); doc.sequence = doc.sequence.slice(0, 1);
   doc.sections[0]!.lines[0] = { id: 'line', text: '[Refrão] <script> & {comment: texto}', chords: [{ id: 'chord', offset: 9, symbol: 'C/G' }] };
   const rendered = documentSource(doc);
   const html = renderToStaticMarkup(createElement(ChordSheet, { source: rendered.source, lines: rendered.lines }));
   expect(html).toContain('[Refrão] ');
   expect(html).toContain('&lt;script&gt; &amp; {comment: texto}');
   expect(html).not.toContain('<script>');
   expect(html.match(/<strong class="chord-symbol">/g)).toHaveLength(1);
   expect(html).toContain('>C/G</strong>');
 });
 it('gera UUID v4 mesmo sem crypto.randomUUID', () => expect(newChartId()).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
});
