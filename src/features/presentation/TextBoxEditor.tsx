import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { TextBox } from '../../shared/contracts';
import { effectiveTextBox, transformTextBox, type BoxHandle } from './textBox';
import './textBoxEditor.css';

const handles: { id: Exclude<BoxHandle, 'move'>; label: string }[] = [
  { id: 'nw', label: 'canto superior esquerdo' }, { id: 'n', label: 'borda superior' },
  { id: 'ne', label: 'canto superior direito' }, { id: 'e', label: 'borda direita' },
  { id: 'se', label: 'canto inferior direito' }, { id: 's', label: 'borda inferior' },
  { id: 'sw', label: 'canto inferior esquerdo' }, { id: 'w', label: 'borda esquerda' },
];
interface Gesture {
  original: TextBox;
  initial: TextBox;
  handle: BoxHandle;
  startX: number;
  startY: number;
  width: number;
  height: number;
  pointerId: number;
  element: HTMLButtonElement;
}

export function TextBoxEditor({ box, bible, disabled, onChange, children }: {
  box: TextBox; bible: boolean; disabled: boolean; onChange: (box: TextBox) => void; children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState('');
  const effective = effectiveTextBox(box, bible);

  function release(current: Gesture) {
    if (current.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
  }
  function cancel() {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    change.current({ ...current.original });
    release(current);
    setStatus('Ajuste cancelado. A caixa voltou à posição anterior.');
  }
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel(); }
    };
    const blur = () => cancel();
    window.addEventListener('keydown', escape, true);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', blur);
    return () => {
      window.removeEventListener('keydown', escape, true);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', blur);
      const current = gesture.current;
      if (current) { gesture.current = null; change.current({ ...current.original }); release(current); }
    };
  }, []);

  function begin(event: PointerEvent<HTMLButtonElement>, handle: BoxHandle) {
    if (gesture.current || disabled || event.button !== 0 || !event.isPrimary) return;
    const rect = frame.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { original: { ...box }, initial: { ...effective }, handle, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, pointerId: event.pointerId, element: event.currentTarget };
    setActive(true); setStatus('Ajustando a caixa. Escape cancela.');
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.preventDefault();
    const dx = (event.clientX - current.startX) / current.width * 100;
    const dy = (event.clientY - current.startY) / current.height * 100;
    change.current(transformTextBox(current.initial, current.handle, dx, dy, bible));
  }
  function finish(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    gesture.current = null; release(current);
    setStatus('Caixa ajustada na prévia de edição. A saída ainda não foi alterada.');
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, handle: BoxHandle) {
    if (disabled || gesture.current || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 5 : 1;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    onChange(transformTextBox(effective, handle, dx, dy, bible));
    setStatus('Caixa ajustada pelo teclado, somente na prévia de edição.');
  }
  const pointerEvents = {
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: cancel,
    onLostPointerCapture: () => { if (gesture.current) cancel(); },
  };

  return <div className="text-box-editor" data-no-shortcuts>
    <div ref={frame} className="text-box-frame" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) cancel(); }} onPointerDownCapture={event => { if (!(event.target as HTMLElement).closest('.text-box-overlay')) setActive(false); }}>
      {children}
      {bible && <div className="text-box-footer-reserved" aria-hidden="true">Área reservada à referência bíblica</div>}
      <div className={`text-box-overlay ${active ? 'is-active' : ''}`} style={{ left: `${effective.x}%`, top: `${effective.y}%`, width: `${effective.width}%`, height: `${effective.height}%` }}>
        <button type="button" className="text-box-move" disabled={disabled} aria-label="Mover caixa de texto. Arraste ou use as setas; Shift move em passos maiores." onFocus={() => setActive(true)} onClick={() => setActive(true)} onPointerDown={event => begin(event, 'move')} onKeyDown={event => keyboard(event, 'move')} {...pointerEvents} />
        {active && handles.map(handle => <button key={handle.id} type="button" className={`text-box-handle handle-${handle.id}`} disabled={disabled} aria-label={`Redimensionar ${handle.label}. Use as setas ou arraste.`} onPointerDown={event => begin(event, handle.id)} onKeyDown={event => keyboard(event, handle.id)} {...pointerEvents} />)}
      </div>
    </div>
    <details className="text-box-help"><summary>Ajuda</summary><p>Clique na caixa para mostrar as alças. Arraste para mover ou redimensionar; Escape cancela o arraste. Pelo teclado, use as setas na caixa ou nas alças (Shift: 5%).</p><p>Largura e altura mínimas: 10%. {bible ? 'A área bíblica termina em 81% da altura para reservar o rodapé de referência e versão.' : 'A caixa deve ficar dentro da tela.'} A saída só muda ao aplicar o tema.</p></details>
    <span className="sr-only" role="status">{status}</span>
  </div>;
}
