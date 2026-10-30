import { useRef, type CSSProperties } from 'react';
import { ReadChordLine } from './ReadChordLine';
import { graphemes, moveChordByCharacter, parseChordText, type ChordToken, type ChartLine } from './chordText';

interface Props { sectionIds?: readonly string[]; source: string; lines?: ChartLine[]; fontSize?: number; fontWeight?: number; chordFontSize?: number; chordFontWeight?: number; chordGap?: number; fontFamily?: string; textColor?: string; chordColor?: string; backgroundColor?: string; onAnchor?: (offset: number, token?: ChordToken) => void; onMove?: (token: ChordToken, offset: number) => void; onChange?: (source: string) => void; onNudge?: (token: ChordToken, direction: -1 | 1) => void }

export function ChordSheet({ sectionIds, source, lines, fontSize = 19, fontWeight = 400, chordFontSize = fontSize * .85, chordFontWeight = 700, chordGap = 4, fontFamily = 'system-ui', textColor = '#eeeaf6', chordColor = '#c3a3ff', backgroundColor = '#17141f', onAnchor, onMove, onChange, onNudge }: Props) {
  const drag = useRef<{ token: ChordToken; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const gap = Number.isFinite(chordGap) ? Math.min(32, Math.max(0, chordGap)) : 4;
  const style = { fontSize, fontFamily, color: textColor, background: backgroundColor, '--chord-color': chordColor,
    ...(!onAnchor ? { fontWeight, '--reading-chord-size': `${chordFontSize}px`, '--reading-chord-weight': chordFontWeight, '--reading-chord-gap': `${gap}px` } : {}) } as CSSProperties;
  let sectionIndex = 0;
  return <article className={`chord-sheet ${onAnchor ? 'editable' : ''}`} style={style} aria-label={onAnchor ? 'Prévia editável da cifra' : 'Cifra'}>{(lines ?? parseChordText(source)).map((line, index) => {
    if (line.kind === 'meta') return null;
    if (line.kind === 'blank') return <div className="chord-spacer" key={index} />;
    if (line.kind === 'section') return <h3 className="chord-section" id={sectionIds?.[sectionIndex++]} key={index}>{line.label}</h3>;
    if (!onAnchor) return <ReadChordLine key={index} line={line} fontSize={fontSize} chordFontSize={chordFontSize} chordGap={gap} layoutKey={`${fontSize}:${fontWeight}:${chordFontSize}:${chordFontWeight}:${gap}:${fontFamily}`}/>;
    return <div className="chord-line" key={index} onClick={event => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      const element = (event.target as HTMLElement).closest<HTMLElement>('[data-chart-offset]');
      if (element) onAnchor(Number(element.dataset.chartOffset));
    }}>{line.tokens.map(token => <span className="chord-run" key={`${token.start}-${token.end}`}>
      {token.chord ? <button className="chord-symbol" title="Editar acorde. Setas movem a posição; arraste até a letra." aria-label={`Acorde ${token.chord}. Setas esquerda e direita movem a âncora.`} onClick={event => { event.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; } onAnchor(token.start, token); }}
        onKeyDown={event => { if (event.key === 'Escape') { drag.current = null; return; } if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && (onChange || onNudge)) { event.preventDefault(); const direction = event.key === 'ArrowLeft' ? -1 : 1; if (onNudge) onNudge(token, direction); else onChange?.(moveChordByCharacter(source, token, direction)); } }}
        onPointerDown={event => { if (!onMove || event.button !== 0) return; drag.current = { token, x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (drag.current && Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 5) drag.current.moved = true; }}
        onPointerCancel={() => { drag.current = null; }}
        onPointerUp={event => { const current = drag.current; drag.current = null; if (!current?.moved) return; suppressClick.current = true; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-chart-offset]'); if (target) onMove?.(current.token, Number(target.dataset.chartOffset)); }}>{token.chord}</button> : <span className="chord-symbol empty" aria-hidden="true">&nbsp;</span>}
      <span className="chord-lyric">{graphemes(token.text).map(part => <span key={part.index} data-chart-offset={token.textStart + part.index}>{part.text}</span>)}</span>
    </span>)}{<button className="chord-add-end" title="Adicionar acorde ao fim da linha" aria-label="Adicionar acorde ao fim desta linha" onClick={() => onAnchor(line.start + line.text.length)}>＋</button>}</div>;
  })}</article>;
}
