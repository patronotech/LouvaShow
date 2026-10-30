import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { chartNotesKey } from './viewerState';
import { moveStickyNote, parseStickyNoteLayout, type StickyNoteLayout } from './stickyNoteState';
import './stickyChartNote.css';

export function StickyChartNote({ chartId, ownerId, text, onChange, openRequest, persistenceError = '' }: { chartId: string; ownerId: string; text: string; onChange: (text: string) => void; openRequest: number; persistenceError?: string }) {
  const key = `${chartNotesKey(chartId, ownerId)}:layout:v1`;
  const [layout, setLayout] = useState(() => { try { return parseStickyNoteLayout(localStorage.getItem(key), !!text); } catch { return parseStickyNoteLayout(null, !!text); } });
  const [error, setError] = useState('');
  const [bounds, setBounds] = useState({ width: 250, height: 184, parentHeight: 500 });
  const note = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const seenRequest = useRef(openRequest);
  const drag = useRef<{ pointerId: number; grabX: number; grabY: number; original: StickyNoteLayout; latest: StickyNoteLayout } | null>(null);
  const latest = useRef(layout); latest.current = layout;
  const cancelDrag = () => { const current = drag.current; drag.current = null; if (current) { setLayout(current.original); latest.current = current.original; } };

  useEffect(() => { window.addEventListener('blur', cancelDrag); return () => window.removeEventListener('blur', cancelDrag); }, []);
  useLayoutEffect(() => {
    const element = note.current;
    const parent = element?.parentElement;
    if (!layout.visible || !element || !parent) return;
    const measure = () => {
      const next = { width: element.offsetWidth, height: element.offsetHeight, parentHeight: parent.clientHeight };
      setBounds(previous => previous.width === next.width && previous.height === next.height && previous.parentHeight === next.parentHeight ? previous : next);
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(element); observer.observe(parent);
    return () => observer.disconnect();
  }, [layout.visible]);

  const save = (next: StickyNoteLayout) => {
    setLayout(next); latest.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); setError(''); }
    catch { setError('Não foi possível guardar a posição desta nota.'); }
  };
  useEffect(() => {
    if (openRequest === seenRequest.current) return;
    seenRequest.current = openRequest;
    const next = { ...latest.current, visible: true, collapsed: false };
    setLayout(next); latest.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); setError(''); }
    catch { setError('Não foi possível guardar a posição desta nota.'); }
    requestAnimationFrame(() => input.current?.focus());
  }, [openRequest, key]);

  if (!layout.visible) return null;
  return <aside ref={note} className={`chart-sticky-note ${layout.collapsed ? 'collapsed' : ''}`} aria-label="Nota pessoal da cifra" style={{ '--note-x': `${layout.x}%`, '--note-y': `${layout.y}%`, '--note-width': `${bounds.width}px`, '--note-height': `${bounds.height}px`, '--note-pane-height': `${bounds.parentHeight}px` } as CSSProperties} data-no-shortcuts>
    <header className="chart-sticky-header">
      <button className="chart-sticky-handle" aria-label="Mover nota. Arraste ou use as setas; Escape cancela." title="Arrastar nota" onPointerDown={event => {
        if (event.button !== 0) return;
        const element = note.current; if (!element) return;
        const rect = element.getBoundingClientRect();
        drag.current = { pointerId: event.pointerId, grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, original: layout, latest: layout };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault(); event.currentTarget.focus();
      }} onPointerMove={event => {
        const current = drag.current; const element = note.current;
        if (!current || current.pointerId !== event.pointerId || !element?.parentElement) return;
        const parent = element.parentElement.getBoundingClientRect(); const rect = element.getBoundingClientRect();
        const position = moveStickyNote(event.clientX - parent.left - current.grabX, event.clientY - parent.top - current.grabY, parent.width, parent.height, rect.width, rect.height);
        current.latest = { ...current.original, ...position };
        setLayout(current.latest);
      }} onPointerUp={event => {
        const current = drag.current; drag.current = null;
        if (current) save(current.latest);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onKeyDown={event => {
        if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); cancelDrag(); return; }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        if (drag.current) return;
        const element = note.current; if (!element?.parentElement) return;
        const parent = element.parentElement.getBoundingClientRect(); const rect = element.getBoundingClientRect(); const step = event.shiftKey ? 20 : 4;
        const position = moveStickyNote(rect.left - parent.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0), rect.top - parent.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0), parent.width, parent.height, rect.width, rect.height);
        save({ ...layout, ...position });
      }}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 3h14v14l-4 4H5zM14 21v-5h5M8 7h8M8 11h8" /></svg><span>Nota</span></button>
      <button title={layout.collapsed ? 'Expandir nota' : 'Minimizar nota'} aria-label={layout.collapsed ? 'Expandir nota' : 'Minimizar nota'} aria-expanded={!layout.collapsed} onClick={() => save({ ...layout, collapsed: !layout.collapsed })}>{layout.collapsed ? '＋' : '−'}</button>
      <button title="Ocultar nota" aria-label="Ocultar nota" onClick={() => save({ ...layout, visible: false })}>×</button>
    </header>
    {!layout.collapsed && <textarea ref={input} aria-label="Texto da nota pessoal" placeholder="Anote aqui…" value={text} maxLength={10000} onChange={event => onChange(event.target.value)} />}
    {(error || persistenceError) && <span className="chart-sticky-error" role="status">{persistenceError || error}</span>}
  </aside>;
}
