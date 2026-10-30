import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ChartDocument, ChartLine } from './contracts';
import { graphemes } from './chordText';
import { newChartId } from './documentText';
import { chordEdgeSlots, lineLeadingSlots, chordRows, createPartFromLines, editLineText, joinChartLine, moveLineChord, partNames, placeChord, pointerColumn, replaceLine, splitChartLine } from './lineChordModel';
import { inlineCursorOffset, pasteInlineText } from './inlineLineEditing';
import { ChordPicker } from './ChordPicker';
import './lineChordEditor.css';
import './inlineLineEditor.css';

interface Location { sectionId: string; lineId: string; offset: number; chordId?: string }
interface Drag { from: Location; symbol: string; startX: number; startY: number; grabOffset: number; moved: boolean; to: Location | null }
interface Props { document: ChartDocument; disabled?: boolean; onChange: (document: ChartDocument) => void; onPaste: (text: string) => void; onUndo?: () => ChartDocument | undefined; canUndo?: boolean }

export function LineChordEditor({ document: chart, disabled = false, onChange, onPaste, onUndo, canUndo = false }: Props) {
  const [selection, setSelection] = useState<Location | null>(null);
  const [picker, setPicker] = useState<Location | null>(null);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [partName, setPartName] = useState('Refrão');
  const [editing, setEditing] = useState<{ sectionId: string; lineId: string } | null>(null);
  const [dragPreview, setDragPreview] = useState<Drag | null>(null);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const textInput = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const menuFirst = useRef<HTMLButtonElement>(null);
  const findLine = (sectionId: string, lineId: string) => chart.sections.find(section => section.id === sectionId)?.lines.find(line => line.id === lineId);
  const selectedLine = selection ? findLine(selection.sectionId, selection.lineId) : undefined;
  const selectedChord = selectedLine?.chords.find(chord => chord.id === selection?.chordId);
  const pickerChord = picker ? findLine(picker.sectionId, picker.lineId)?.chords.find(chord => chord.id === picker.chordId) : undefined;

  useEffect(() => { if (selection) menuFirst.current?.focus(); }, [selection?.chordId, selection?.lineId, selection?.sectionId]);
  useLayoutEffect(() => {
    if (!editing || pendingCursor.current === null) return;
    const input = textInput.current;
    if (input) { input.focus(); input.setSelectionRange(pendingCursor.current, pendingCursor.current); pendingCursor.current = null; }
  }, [editing, chart]);
  useEffect(() => {
    const valid = new Set(chart.sections.flatMap(section => section.lines.map(line => line.id)));
    setSelectedLines(old => old.some(id => !valid.has(id)) ? old.filter(id => valid.has(id)) : old);
    if (editing && !valid.has(editing.lineId)) setEditing(null);
    if (selection && !valid.has(selection.lineId)) setSelection(null);
  }, [chart.sections, editing, selection]);
  useEffect(() => { if (disabled) { drag.current = null; setDragPreview(null); } }, [disabled]);

  const change = (next: ChartDocument) => { if (!disabled) onChange(next); };
  const focusChord = (id: string) => requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-chord-id="${CSS.escape(id)}"]`)?.focus());
  const finishEditing = (restoreFocus = true) => {
    const id = editing?.lineId;
    setEditing(null); pendingCursor.current = null;
    if (restoreFocus && id) requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-edit-line="${CSS.escape(id)}"]`)?.focus());
  };
  const editLyrics = (sectionId: string, line: ChartLine) => {
    if (disabled) return;
    setSelection(null); setError(''); pendingCursor.current = line.text.length;
    setEditing({ sectionId, lineId: line.id });
  };
  const choose = (location: Location) => {
    if (disabled) return;
    finishEditing(false); setError('');
    if (location.chordId) setSelection(location);
    else { setSelection(null); setPicker(location); }
  };
  const locate = (x: number, y: number, grabOffset = 0): Location | null => {
    const track = globalThis.document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-line-track]');
    if (!track) return null;
    const rect = track.getBoundingClientRect();
    return { sectionId: track.dataset.section!, lineId: track.dataset.line!, offset: pointerColumn(x, rect.left, rect.width, Number(track.dataset.columns), grabOffset) - Number(track.dataset.leading) };
  };
  const addLine = (sectionId: string, afterId?: string) => change({ ...chart, sections: chart.sections.map(section => {
    if (section.id !== sectionId) return section;
    const lines = [...section.lines];
    const at = afterId ? lines.findIndex(line => line.id === afterId) + 1 : lines.length;
    lines.splice(at, 0, { id: newChartId(), text: '', chords: [] });
    return { ...section, lines };
  }) });
  const removeChord = (sectionId: string, lineId: string, chordId: string) => {
    change(replaceLine(chart, sectionId, lineId, line => ({ ...line, chords: line.chords.filter(chord => chord.id !== chordId) })));
    setSelection(null);
  };
  const splitEditingLine = () => {
    if (!editing || disabled) return;
    const line = findLine(editing.sectionId, editing.lineId);
    if (!line) return;
    const offset = inlineCursorOffset(line.text, textInput.current?.selectionStart ?? line.text.length);
    const next = splitChartLine(chart, editing.sectionId, editing.lineId, offset);
    const lines = next.sections.find(section => section.id === editing.sectionId)?.lines || [];
    const index = lines.findIndex(value => value.id === editing.lineId);
    change(next);
    if (lines[index + 1]) { pendingCursor.current = 0; setEditing({ ...editing, lineId: lines[index + 1]!.id }); }
  };
  const joinEditingLine = () => {
    if (!editing || disabled) return;
    const line = findLine(editing.sectionId, editing.lineId);
    if (!line) return;
    pendingCursor.current = line.text.length;
    change(joinChartLine(chart, editing.sectionId, editing.lineId));
  };
  const undoInline = () => {
    if (disabled || !canUndo || !onUndo || !editing) return;
    const currentSection = chart.sections.find(section => section.id === editing.sectionId);
    const currentIndex = currentSection?.lines.findIndex(line => line.id === editing.lineId) ?? 0;
    const previous = onUndo();
    if (!previous) return;
    const section = previous.sections.find(value => value.id === editing.sectionId);
    const restored = section?.lines.find(line => line.id === editing.lineId)
      ?? section?.lines[Math.max(0, Math.min(currentIndex - 1, section.lines.length - 1))];
    if (section && restored) {
      pendingCursor.current = restored.text.length;
      setEditing({ sectionId: section.id, lineId: restored.id });
    } else finishEditing(false);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || disabled) return;
    if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 4) current.moved = true;
    if (current.moved) { current.to = locate(event.clientX, event.clientY, current.grabOffset); setDragPreview({ ...current }); }
  };
  const pointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current; drag.current = null; setDragPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current?.moved || disabled) return;
    suppressClick.current = true;
    const to = locate(event.clientX, event.clientY, current.grabOffset);
    if (to && current.from.chordId) {
      change(moveLineChord(chart, current.from.sectionId, current.from.lineId, current.from.chordId, to.sectionId, to.lineId, to.offset));
      setSelection(null);
    }
  };

  const drawLine = (sectionId: string, line: ChartLine, index: number, lineCount: number) => {
    const letters = graphemes(line.text); const leading = lineLeadingSlots(line.text); const chords = chordRows(line.chords);
    const columns = Math.max(48, leading + letters.length + chordEdgeSlots, ...line.chords.map(chord => leading + chord.offset + graphemes(chord.symbol).length + 4));
    const rows = Math.max(1, ...chords.map(value => value.row + 1));
    const destination = dragPreview?.to?.lineId === line.id && dragPreview.to.sectionId === sectionId ? dragPreview.to : null;
    const isEditing = editing?.lineId === line.id && editing.sectionId === sectionId;
    const hasMenu = selection?.lineId === line.id && selection.sectionId === sectionId && selectedChord;
    return <div className={`line-chord-row ${selectedLines.includes(line.id) ? 'is-selected' : ''} ${destination ? 'drop-target' : ''} ${isEditing ? 'editing-lyrics' : ''}`} key={line.id}>
      <div className="line-chord-row-tools">
        <label title={`Selecionar linha ${index + 1}`}><input type="checkbox" aria-label={`Selecionar linha ${index + 1}`} checked={selectedLines.includes(line.id)} disabled={disabled} onChange={event => setSelectedLines(old => event.target.checked ? [...old, line.id] : old.filter(id => id !== line.id))} /><span>{index + 1}</span></label>
        <button type="button" data-edit-line={line.id} title={isEditing ? 'Concluir edição da letra' : 'Editar letra'} aria-label={`${isEditing ? 'Concluir' : 'Editar'} letra da linha ${index + 1}`} disabled={disabled} aria-pressed={isEditing} onClick={() => isEditing ? finishEditing() : editLyrics(sectionId, line)}>✎</button>
      </div>
      <div className="line-chord-scroll">
        <div className="line-chord-track" data-line-track data-section={sectionId} data-line={line.id} data-columns={columns} data-leading={leading} style={{ width: `calc(${columns} * var(--line-cell))` }}>
          <div className="line-chord-lane" style={{ height: `${rows * 30 + 4}px` }} aria-label={`Faixa de acordes da linha ${index + 1}`} onClick={event => {
            if (disabled || suppressClick.current) { suppressClick.current = false; return; }
            const rect = event.currentTarget.parentElement!.getBoundingClientRect();
            choose({ sectionId, lineId: line.id, offset: pointerColumn(event.clientX, rect.left, rect.width, columns) - leading });
          }}>
            {!line.chords.length && <span className="line-chord-lane-hint" aria-hidden="true">＋ acorde</span>}
            {chords.map(({ chord, row }) => <button key={chord.id} type="button" data-chord-id={chord.id} className={`line-chord-chip ${selection?.chordId === chord.id ? 'active' : ''} ${dragPreview?.from.chordId === chord.id ? 'dragging' : ''}`} style={{ left: `calc(${chord.offset + leading} * var(--line-cell))`, top: row * 30 + 2 }} disabled={disabled} aria-label={`${chord.symbol}, coluna ${chord.offset + leading + 1}. Enter abre opções; setas movem; Delete remove.`} aria-expanded={selection?.chordId === chord.id} title="Clique para editar ou remover. Arraste para mover; setas também movem." onClick={event => {
              event.stopPropagation();
              if (suppressClick.current) { suppressClick.current = false; return; }
              choose({ sectionId, lineId: line.id, offset: chord.offset, chordId: chord.id });
            }} onKeyDown={event => {
              if (disabled) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault(); event.stopPropagation();
                const offset = Math.max(-leading, chord.offset + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 5 : 1));
                change(moveLineChord(chart, sectionId, line.id, chord.id, sectionId, line.id, offset));
                setSelection(null);
              } else if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault(); event.stopPropagation(); removeChord(sectionId, line.id, chord.id);
              }
            }} onPointerDown={event => {
              if (disabled || event.button !== 0) return;
              event.currentTarget.focus();
              drag.current = { from: { sectionId, lineId: line.id, offset: chord.offset, chordId: chord.id }, symbol: chord.symbol, startX: event.clientX, startY: event.clientY, grabOffset: event.clientX - event.currentTarget.getBoundingClientRect().left, moved: false, to: null };
              event.currentTarget.setPointerCapture(event.pointerId);
            }} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={() => { drag.current = null; setDragPreview(null); }}>{chord.symbol}</button>)}
            {destination && <span className="line-chord-ghost" style={{ left: `calc(${destination.offset + leading} * var(--line-cell))` }}>{dragPreview?.symbol}<small>{destination.offset + leading + 1}</small></span>}
          </div>
          {isEditing ? <div className="line-inline-phrase"><input ref={textInput} type="text" className="line-inline-input" aria-label={`Letra da linha ${index + 1}`} aria-describedby={`inline-help-${line.id}`} autoComplete="off" spellCheck={false} disabled={disabled} value={line.text} style={{ marginLeft: `calc(${leading} * var(--line-cell))`, width: `calc(${columns - leading} * var(--line-cell))` }} onChange={event => {
            // Publish every edit immediately to ChartEditor's existing undo/history.
            // Saving the parent never depends on blur or a second draft buffer.
            change(replaceLine(chart, sectionId, line.id, current => editLineText(current, event.target.value)));
          }} onKeyDown={event => {
            if (event.nativeEvent.isComposing) { if (event.key === 'Enter' || event.key === 'Escape') event.stopPropagation(); return; }
            if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (event.shiftKey) splitEditingLine(); else finishEditing(); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishEditing(); }
          }} onPaste={event => {
            event.stopPropagation();
            const pasted = event.clipboardData.getData('text/plain');
            if (!/[\r\n]/.test(pasted)) return;
            event.preventDefault();
            const result = pasteInlineText(line, event.currentTarget.selectionStart ?? line.text.length, event.currentTarget.selectionEnd ?? line.text.length, pasted);
            pendingCursor.current = result.cursor;
            change(replaceLine(chart, sectionId, line.id, () => result.line));
          }} /></div> : <div className="line-chord-phrase" aria-label={line.text || 'Linha instrumental ou vazia'}>
            {Array.from({ length: leading }, (_, slot) => <span key={`before-${slot}`} className={`line-chord-glyph line-chord-edge ${destination?.offset === slot - leading ? 'target-glyph' : ''}`} title="Antes da frase" onClick={() => choose({ sectionId, lineId: line.id, offset: slot - leading })}>{'\u00a0'}</span>)}
            {letters.map((letter, offset) => <span key={offset} className={`line-chord-glyph ${destination?.offset === offset ? 'target-glyph' : ''}`} onClick={() => choose({ sectionId, lineId: line.id, offset })}>{letter.text === ' ' ? '\u00a0' : letter.text}</span>)}
            {Array.from({ length: chordEdgeSlots }, (_, slot) => <span key={`after-${slot}`} className={`line-chord-glyph line-chord-edge ${destination?.offset === letters.length + slot ? 'target-glyph' : ''}`} title="Após a frase" onClick={() => choose({ sectionId, lineId: line.id, offset: letters.length + slot })}>{'\u00a0'}</span>)}
            {!line.text && <span className="line-chord-empty">Linha vazia</span>}
          </div>}
        </div>
        {isEditing && <div className="line-inline-actions" role="group" aria-label={`Ações da letra da linha ${index + 1}`}>
          <button type="button" disabled={disabled} onClick={splitEditingLine}>Dividir no cursor</button>
          <button type="button" disabled={disabled || !canUndo || !onUndo} onClick={undoInline}>↶ Desfazer</button>
          <button type="button" disabled={disabled || index === lineCount - 1} onClick={joinEditingLine}>Unir à próxima</button>
          <button type="button" disabled={disabled} onClick={() => finishEditing()}>Concluir</button>
          <small id={`inline-help-${line.id}`}>Enter conclui · Shift+Enter divide · Esc sai · Desfazer reverte</small>
        </div>}
        {hasMenu && <div className="line-chord-menu" role="group" aria-label={`Opções do acorde ${selectedChord.symbol}`}>
          <strong>{selectedChord.symbol}</strong>
          <button ref={menuFirst} type="button" disabled={disabled} onClick={() => { setPicker({ sectionId, lineId: line.id, chordId: selectedChord.id, offset: selectedChord.offset }); setSelection(null); }}>Editar</button>
          <button type="button" disabled={disabled} onClick={() => removeChord(sectionId, line.id, selectedChord.id)}>Remover</button>
          <button type="button" onClick={() => { setSelection(null); focusChord(selectedChord.id); }}>Fechar</button>
        </div>}
      </div>
      <div className="line-chord-row-actions">
        <button type="button" disabled={disabled} title="Inserir acorde por teclado" aria-label={`Adicionar acorde à linha ${index + 1}`} onClick={() => choose({ sectionId, lineId: line.id, offset: 0 })}>＋ Acorde</button>
        <button type="button" disabled={disabled} title="Adicionar linha abaixo" aria-label={`Adicionar linha após ${index + 1}`} onClick={() => addLine(sectionId, line.id)}>＋ Linha</button>
        <button type="button" disabled={disabled || lineCount < 2} title="Remover linha" aria-label={`Remover linha ${index + 1}`} onClick={() => { change({ ...chart, sections: chart.sections.map(section => section.id === sectionId ? { ...section, lines: section.lines.filter(value => value.id !== line.id) } : section) }); if (isEditing) setEditing(null); if (selection?.lineId === line.id) setSelection(null); }}>×</button>
      </div>
    </div>;
  };

  return <div ref={root} className="line-chord-editor" onKeyDown={event => {
    if (event.key !== 'Escape' || (!drag.current && !selection && !editing)) return;
    event.preventDefault(); event.stopPropagation();
    if (drag.current) suppressClick.current = true;
    const chordId = selection?.chordId;
    drag.current = null; setDragPreview(null); setSelection(null);
    if (editing) finishEditing(); else if (chordId) focusChord(chordId);
  }} onPaste={event => {
    // Native text fields own their paste operation; only pasting into the canvas
    // itself opens the multi-line importer.
    if ((event.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;
    const text = event.clipboardData.getData('text/plain');
    if (!disabled && /[\r\n]/.test(text)) { event.preventDefault(); onPaste(text); }
  }}>
    <datalist id="chart-part-names">{partNames.map(name => <option key={name} value={name} />)}</datalist>
    <div className="line-chord-tools">
      <button type="button" disabled={disabled} onClick={() => { const id = newChartId(); change({ ...chart, sections: [...chart.sections, { id, label: 'Verso', lines: [{ id: newChartId(), text: '', chords: [] }] }], sequence: [...chart.sequence, { id: newChartId(), sectionId: id }] }); }}>＋ Parte</button>
      <span>Arraste acordes na faixa acima da letra.</span>
      {selectedLines.length > 0 && <><input aria-label="Nome da nova parte" list="chart-part-names" value={partName} onChange={event => setPartName(event.target.value)} disabled={disabled} /><button type="button" disabled={disabled} onClick={() => { try { change(createPartFromLines(chart, selectedLines, partName)); setSelectedLines([]); setError(''); } catch (reason) { setError(String(reason)); } }}>Criar parte · {selectedLines.length} linhas</button><button type="button" onClick={() => setSelectedLines([])}>Limpar seleção</button></>}
    </div>
    {error && <p className="chart-notice" role="alert">{error}</p>}
    <div className="line-chord-canvas">{chart.sections.map(section => <section className="line-chord-part" key={section.id}>
      <header><label className="line-chord-part-name"><span className="sr-only">Nome da parte</span><input aria-label="Nome da parte" list="chart-part-names" value={section.label} maxLength={80} disabled={disabled} onChange={event => change({ ...chart, sections: chart.sections.map(value => value.id === section.id ? { ...value, label: event.target.value } : value) })} /></label><span>{section.lines.length} {section.lines.length === 1 ? 'linha' : 'linhas'}</span><button type="button" disabled={disabled} onClick={() => addLine(section.id)}>＋ Linha</button><button type="button" disabled={disabled || chart.sections.length < 2} title="Remover parte e suas ocorrências" onClick={() => { const sections = chart.sections.filter(value => value.id !== section.id); let sequence = chart.sequence.filter(value => value.sectionId !== section.id); if (!sequence.length && sections[0]) sequence = [{ id: newChartId(), sectionId: sections[0].id }]; change({ ...chart, sections, sequence }); }}>Remover parte</button></header>
      {section.lines.map((line, index) => drawLine(section.id, line, index, section.lines.length))}
    </section>)}</div>
    {picker && <ChordPicker initialSymbol={pickerChord?.symbol || ''} onClose={() => setPicker(null)} onConfirm={symbol => {
      if (disabled) return;
      try {
        const id = picker.chordId || newChartId();
        change(placeChord(chart, picker.sectionId, picker.lineId, picker.offset, symbol, id));
        setPicker(null); setError(''); focusChord(id);
      } catch (reason) { setError(String(reason)); }
    }} />}
  </div>;
}
