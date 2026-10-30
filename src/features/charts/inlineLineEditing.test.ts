import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { inlineCursorOffset, pasteInlineText } from './inlineLineEditing';
import { editLineText, lineLeadingSlots, placeChord, replaceLine, splitChartLine } from './lineChordModel';
import { LineChordEditor } from './LineChordEditor';
import type { ChartDocument, ChartLine } from './contracts';

const lyric = (): ChartLine => ({ id: 'line', text: 'Amém 🙏🏽', chords: [{ id: 'chord', symbol: 'C7M', offset: 5 }] });
const document = (): ChartDocument => ({ schemaVersion: 1, title: 'Exemplo original', artist: null, concertKey: 'C', capo: 0, spelling: 'sharps', notes: '', preservedDirectives: [], sections: [{ id: 'section', label: 'Estrofe', lines: [lyric()] }], sequence: [{ id: 'occurrence', sectionId: 'section' }] });

describe('edição da letra na própria linha', () => {
  it('converte o cursor UTF-16 sem partir acento composto ou emoji', () => {
    const text = lyric().text;
    expect(inlineCursorOffset(text, 3)).toBe(2);
    expect(inlineCursorOffset(text, 4)).toBe(3);
    expect(inlineCursorOffset(text, 8)).toBe(5);
    expect(inlineCursorOffset(text, text.length)).toBe(6);
    expect(inlineCursorOffset(text, -10)).toBe(0);
  });
  it('colar sobre seleção substitui somente o trecho e mantém separação entre parágrafos', () => {
    const original = lyric();
    const result = pasteInlineText(original, 2, 4, 'É\r\nnovo');
    expect(result.line.text).toBe('AmÉ novom 🙏🏽');
    expect(result.line.id).toBe(original.id);
    expect(result.line.chords).toEqual([{ id: 'chord', symbol: 'C7M', offset: 10 }]);
    expect(result.cursor).toBe('AmÉ novo'.length);
    expect(original).toEqual(lyric());
  });
  it('colar com cursor dentro de grafema não corta o caractere e não transforma texto em acordes', () => {
    const result = pasteInlineText(lyric(), 3, 3, '[G]\n');
    expect(result.line.text).toBe('Am[G] ém 🙏🏽');
    expect(result.line.chords).toHaveLength(1);
    expect(result.line.chords[0]?.symbol).toBe('C7M');
  });
  it('texto digitado integra imediatamente o documento que o modal pai salva, sem blur ou concluir', () => {
    const original = document();
    let parentDraft = original;
    const undo: ChartDocument[] = [];
    const onChange = (next: ChartDocument) => { undo.push(parentDraft); parentDraft = next; };
    onChange(replaceLine(parentDraft, 'section', 'line', line => editLineText(line, 'Sim, Amém 🙏🏽')));
    const savePayload = JSON.parse(JSON.stringify(parentDraft)) as ChartDocument;
    expect(savePayload.sections[0]?.lines[0]?.text).toBe('Sim, Amém 🙏🏽');
    expect(savePayload.sections[0]?.lines[0]?.chords[0]).toEqual({ id: 'chord', symbol: 'C7M', offset: 10 });
    expect(undo[0]).toEqual(original);
    parentDraft = undo[0]!;
    expect(parentDraft.sections[0]?.lines[0]?.chords[0]?.offset).toBe(5);
  });
  it('espaços anteriores e divisão usam âncoras reais sem modificar o documento original', () => {
    const original = placeChord(document(), 'section', 'line', -3, 'F', 'before');
    const line = original.sections[0]!.lines[0]!;
    expect(lineLeadingSlots(line.text)).toBe(5);
    const split = splitChartLine(original, 'section', 'line', inlineCursorOffset(line.text, 7));
    expect(split.sections[0]!.lines.map(value => value.text)).toEqual(['   Amé', 'm 🙏🏽']);
    expect(split.sections[0]!.lines[0]!.chords).toEqual([{ id: 'before', symbol: 'F', offset: 0 }]);
    expect(split.sections[0]!.lines[1]!.chords).toEqual([{ id: 'chord', symbol: 'C7M', offset: 2 }]);
    expect(original.sections[0]!.lines[0]!.text).toBe('   Amém 🙏🏽');
  });
  it('o mesmo histórico do pai desfaz a divisão restaurando texto, IDs e todos os acordes', () => {
    const original = placeChord(document(), 'section', 'line', 1, 'Dm7', 'first');
    let current = original;
    const history: ChartDocument[] = [];
    const change = (next: ChartDocument) => { history.push(current); current = next; };
    const undo = () => { const previous = history.pop(); if (previous) current = previous; return previous; };
    change(splitChartLine(current, 'section', 'line', 4));
    expect(current.sections[0]!.lines).toHaveLength(2);
    expect(current.sections[0]!.lines[1]!.chords[0]?.offset).toBe(1);
    // Local and top controls delegate to this same parent callback; no local draft/history.
    const restored = undo();
    expect(restored).toBe(original);
    expect(current.sections[0]!.lines).toEqual(original.sections[0]!.lines);
    expect(current.sequence).toEqual(original.sequence);
    expect(history).toHaveLength(0);
  });
  it('confirmar outro símbolo substitui o mesmo acorde sem mudar ID, posição, letra ou vizinhos', () => {
    const original = placeChord(document(), 'section', 'line', 1, 'Dm', 'other');
    const result = placeChord(original, 'section', 'line', 5, 'Cm7/G', 'chord');
    const before = original.sections[0]!.lines[0]!;
    const after = result.sections[0]!.lines[0]!;
    expect(after.text).toBe(before.text);
    expect(after.chords.find(value => value.id === 'chord')).toEqual({ id: 'chord', symbol: 'Cm7/G', offset: 5 });
    expect(after.chords.find(value => value.id === 'other')).toEqual(before.chords.find(value => value.id === 'other'));
    expect(before.chords.find(value => value.id === 'chord')?.symbol).toBe('C7M');
  });
  it('não monta a antiga barra inferior de edição e mantém botões acessíveis por linha', () => {
    const html = renderToStaticMarkup(createElement(LineChordEditor, { document: document(), onChange: () => {}, onPaste: () => {} }));
    expect(html).not.toContain('line-chord-text-edit');
    expect(html).not.toContain('line-chord-inspector');
    expect(html).toContain('Editar letra da linha 1');
    expect(html).toContain('Enter abre opções; setas movem; Delete remove.');
    expect(html).toContain('Adicionar acorde à linha 1');
  });
});
