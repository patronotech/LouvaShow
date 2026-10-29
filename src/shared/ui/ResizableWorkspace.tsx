import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import {
  DEFAULT_WORKSPACE_LAYOUT, WORKSPACE_RESET_EVENT, dragWorkspaceResize, fitWorkspaceLayout,
  keyboardWorkspaceResize, readWorkspaceLayout,
  saveWorkspaceLayout, toggleWorkspacePane,
} from './workspaceLayout';
import type { WorkspaceLayout, WorkspaceSide } from './workspaceLayout';
import './workspace.css';

export { resetWorkspaceLayouts } from './workspaceLayout';

export interface ResizableWorkspaceProps {
  left: ReactNode;
  children: ReactNode;
  right: ReactNode;
  context: string;
  leftLabel?: string;
  rightLabel?: string;
}

interface Drag {
  side: WorkspaceSide;
  pointerId: number;
  target: HTMLDivElement;
  startX: number;
  startWidth: number;
  original: WorkspaceLayout;
  base: WorkspaceLayout;
}

/** Context preferences change without remounting previews or editor drafts. */
export function ResizableWorkspace(props: ResizableWorkspaceProps) {
  return <Workspace {...props} />;
}

function Workspace({ left, children, right, context, leftLabel = 'Biblioteca', rightLabel = 'Ao vivo' }: ResizableWorkspaceProps) {
  const [layout, setLayout] = useState(() => readWorkspaceLayout(context));
  const [width, setWidth] = useState(960);
  const [dragging, setDragging] = useState<WorkspaceSide | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = useRef(layout);
  const contextRef = useRef(context);
  const widthRef = useRef(width);
  const drag = useRef<Drag | null>(null);
  const leftControl = useRef<HTMLButtonElement>(null);
  const rightControl = useRef<HTMLButtonElement>(null);
  const leftContent = useRef<HTMLDivElement>(null);
  const rightContent = useRef<HTMLDivElement>(null);
  const id = useId();
  const fitted = fitWorkspaceLayout(layout, width);

  const update = useCallback((next: WorkspaceLayout, persist: boolean) => {
    current.current = next;
    setLayout(next);
    if (persist) setStorageUnavailable(!saveWorkspaceLayout(contextRef.current, next));
  }, []);

  const finishDrag = useCallback((cancel: boolean) => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    setDragging(null);
    update(cancel ? active.original : current.current, !cancel);
    if (active.target.hasPointerCapture(active.pointerId)) {
      active.target.releasePointerCapture(active.pointerId);
    }
  }, [update]);

  useLayoutEffect(() => {
    if (contextRef.current === context) return;
    finishDrag(true);
    contextRef.current = context;
    update(readWorkspaceLayout(context), false);
  }, [context, finishDrag, update]);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const next = element.getBoundingClientRect().width;
      if (next <= 0 || Math.abs(next - widthRef.current) < 0.5) return;
      finishDrag(true);
      widthRef.current = next;
      setWidth(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [finishDrag]);

  useEffect(() => {
    const reset = (event: Event) => {
      finishDrag(true);
      update({ ...DEFAULT_WORKSPACE_LAYOUT }, false);
      setStorageUnavailable((event as CustomEvent<{ persisted?: boolean }>).detail?.persisted === false);
    };
    const blur = () => finishDrag(true);
    window.addEventListener(WORKSPACE_RESET_EVENT, reset);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener(WORKSPACE_RESET_EVENT, reset);
      window.removeEventListener('blur', blur);
      const active = drag.current;
      drag.current = null;
      if (active?.target.hasPointerCapture(active.pointerId)) active.target.releasePointerCapture(active.pointerId);
    };
  }, [finishDrag, update]);

  // A responsive collapse must not leave keyboard focus inside hidden content.
  useLayoutEffect(() => {
    if (fitted.leftCollapsed && leftContent.current?.contains(document.activeElement)) leftControl.current?.focus();
    if (fitted.rightCollapsed && rightContent.current?.contains(document.activeElement)) rightControl.current?.focus();
  }, [fitted.leftCollapsed, fitted.rightCollapsed]);

  const toggle = (side: WorkspaceSide) => {
    finishDrag(true);
    update(toggleWorkspacePane(current.current, side, widthRef.current), true);
  };

  const pointerDown = (event: PointerEvent<HTMLDivElement>, side: WorkspaceSide) => {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    const view = fitWorkspaceLayout(current.current, widthRef.current);
    if (side === 'left' ? view.leftCollapsed : view.rightCollapsed) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { return; }
    drag.current = {
      side, pointerId: event.pointerId, target: event.currentTarget,
      startX: event.clientX,
      startWidth: side === 'left' ? view.leftWidth : view.rightWidth,
      original: { ...current.current },
      base: {
        ...current.current,
        leftWidth: view.leftCollapsed ? current.current.leftWidth : view.leftWidth,
        rightWidth: view.rightCollapsed ? current.current.rightWidth : view.rightWidth,
      },
    };
    setDragging(side);
  };

  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    event.preventDefault();
    const requested = active.startWidth + (event.clientX - active.startX) * (active.side === 'left' ? 1 : -1);
    update(dragWorkspaceResize(active.original, active.base, active.side, requested, widthRef.current), false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, side: WorkspaceSide) => {
    if (event.key === 'Escape' && drag.current) {
      event.preventDefault(); event.stopPropagation(); finishDrag(true); return;
    }
    if (drag.current) { event.preventDefault(); event.stopPropagation(); return; }
    const next = keyboardWorkspaceResize(current.current, side, event.key, widthRef.current, event.shiftKey ? 32 : 16);
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    update(next, true);
  };

  const renderSeparator = (side: WorkspaceSide, label: string) => {
    const collapsed = side === 'left' ? fitted.leftCollapsed : fitted.rightCollapsed;
    const value = side === 'left' ? fitted.leftWidth : fitted.rightWidth;
    const max = side === 'left' ? fitted.leftMax : fitted.rightMax;
    return <div
      className={`rw-separator${dragging === side ? ' rw-separator-active' : ''}`}
      role="separator" tabIndex={0} data-no-shortcuts aria-orientation="vertical" aria-label={label}
      aria-controls={`${id}-${side}`} aria-describedby={`${id}-instructions`}
      aria-valuemin={0} aria-valuemax={Math.round(max)} aria-valuenow={collapsed ? 0 : Math.round(value)}
      aria-valuetext={collapsed ? 'Painel recolhido; pressione Enter para reabrir' : `${Math.round(value)} pixels; pressione Enter para recolher`}
      onPointerDown={event => pointerDown(event, side)} onPointerMove={pointerMove}
      onPointerUp={event => { if (event.pointerId === drag.current?.pointerId) finishDrag(false); }}
      onPointerCancel={event => { if (event.pointerId === drag.current?.pointerId) finishDrag(true); }}
      onLostPointerCapture={event => { if (event.pointerId === drag.current?.pointerId) finishDrag(true); }}
      onKeyDown={event => onKeyDown(event, side)}
      onDoubleClick={() => {
        finishDrag(true);
        const next = { ...current.current, [side === 'left' ? 'leftWidth' : 'rightWidth']: DEFAULT_WORKSPACE_LAYOUT[side === 'left' ? 'leftWidth' : 'rightWidth'] };
        update(next, true);
      }}
      title={`Redimensionar ${label}. Arraste até a borda para recolher.`}
    ><span aria-hidden="true" /></div>;
  };

  const renderPane = (side: WorkspaceSide, label: string, content: ReactNode) => {
    const collapsed = side === 'left' ? fitted.leftCollapsed : fitted.rightCollapsed;
    const automatic = side === 'left' ? fitted.leftAutoCollapsed : fitted.rightAutoCollapsed;
    const onlyThisPane = fitWorkspaceLayout({ ...layout, leftCollapsed: side !== 'left', rightCollapsed: side !== 'right' }, width);
    const canOpen = !(side === 'left' ? onlyThisPane.leftCollapsed : onlyThisPane.rightCollapsed);
    const buttonLabel = collapsed ? `Mostrar ${label}` : `Ocultar ${label}`;
    return <aside className={`rw-sidebar rw-sidebar-${side}${collapsed ? ' rw-collapsed' : ''}`} aria-label={label}>
      <div className="rw-pane-tools">
        <button ref={side === 'left' ? leftControl : rightControl} type="button" className="rw-toggle"
          onClick={() => toggle(side)} aria-label={buttonLabel} aria-expanded={!collapsed} aria-controls={`${id}-${side}`}
          disabled={collapsed && !canOpen}
          title={!canOpen && collapsed ? 'Amplie a janela para mostrar este painel.' : automatic ? `${buttonLabel} — recolhido para manter o conteúdo legível` : buttonLabel}>
          <span aria-hidden="true">{side === 'left' ? (collapsed ? '›' : '‹') : (collapsed ? '‹' : '›')}</span>
          <span className={collapsed ? 'rw-rail-label' : ''}>{collapsed ? label : 'Ocultar painel'}</span>
          {automatic && <span className="rw-auto-label" aria-hidden="true">Auto</span>}
        </button>
      </div>
      <div id={`${id}-${side}`} ref={side === 'left' ? leftContent : rightContent}
        className="rw-pane-content" hidden={collapsed} inert={collapsed}>{content}</div>
    </aside>;
  };

  const style: CSSProperties = { gridTemplateColumns: `${fitted.leftWidth}px ${fitted.handleWidth}px minmax(0,1fr) ${fitted.handleWidth}px ${fitted.rightWidth}px` };
  return <div ref={root} className={`resizable-workspace${dragging ? ' rw-dragging' : ''}`} style={style}>
    <p id={`${id}-instructions`} className="rw-sr-only">Use as setas esquerda e direita para ajustar o divisor. Home e End ajustam os limites. Enter recolhe ou reabre o painel. Escape cancela o arraste. Arraste até a borda para recolher.</p>
    {renderPane('left', leftLabel, left)}
    {renderSeparator('left', leftLabel)}
    <div className="rw-center">{children}</div>
    {renderSeparator('right', rightLabel)}
    {renderPane('right', rightLabel, right)}
    {storageUnavailable && <p className="rw-storage-status" role="status">Layout aplicado nesta sessão. Não foi possível salvar as preferências neste dispositivo.</p>}
  </div>;
}
