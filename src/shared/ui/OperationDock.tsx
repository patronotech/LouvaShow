import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { clampDockHeight, defaultDockState, dockMaximum, dragDockHeight, operationDockKey, readDockState, type OperationDockState } from './operationDockState';
import './operationDock.css';

export function OperationDock({ children }: { children: ReactNode }) {
  const [state,setState]=useState<OperationDockState>(()=>{try{return readDockState(localStorage.getItem(operationDockKey));}catch{return {...defaultDockState};}});
  const [viewport,setViewport]=useState(()=>window.innerHeight);
  const [dragging,setDragging]=useState(false);
  const [error,setError]=useState(false);
  const [measured,setMeasured]=useState(100);
  const dock=useRef<HTMLElement>(null);
  const handle=useRef<HTMLDivElement>(null);
  const toggle=useRef<HTMLButtonElement>(null);
  const latest=useRef(state);latest.current=state;
  const drag=useRef<{id:number;startY:number;startHeight:number;original:OperationDockState;next:OperationDockState}|null>(null);
  const contentId=useId();
  const save=(next:OperationDockState)=>{setState(next);latest.current=next;try{localStorage.setItem(operationDockKey,JSON.stringify(next));setError(false);}catch{setError(true);}};
  const cancelDrag=()=>{const current=drag.current;if(!current)return;drag.current=null;setState(current.original);latest.current=current.original;setDragging(false);if(handle.current?.hasPointerCapture(current.id))handle.current.releasePointerCapture(current.id);};
  useEffect(()=>{window.addEventListener('blur',cancelDrag);return()=>window.removeEventListener('blur',cancelDrag);},[]);
  useEffect(()=>{const resize=()=>setViewport(window.innerHeight);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  useEffect(()=>{const element=dock.current;if(!element)return;const observer=new ResizeObserver(()=>setMeasured(Math.round(element.getBoundingClientRect().height)));observer.observe(element);return()=>observer.disconnect();},[]);
  useEffect(()=>{if(!dragging)return;const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelDrag();}};window.addEventListener('keydown',cancel,true);return()=>window.removeEventListener('keydown',cancel,true);},[dragging]);
  const maximum=dockMaximum(viewport);
  const height=state.height===null?undefined:clampDockHeight(state.height,viewport);
  const currentHeight=clampDockHeight(height??measured,viewport);
  return <footer ref={dock} className={`operation-dock${state.collapsed?' collapsed':''}${dragging?' resizing':''}`} style={{height:state.collapsed?undefined:height,maxHeight:state.collapsed?undefined:maximum}} aria-label="Controles de projeção">
    <div className="operation-dock-strip">
      {!state.collapsed && <div ref={handle} className="operation-dock-resizer" data-no-shortcuts role="separator" aria-orientation="horizontal" aria-label="Altura dos controles de projeção" aria-controls={contentId} aria-valuemin={48} aria-valuemax={maximum} aria-valuenow={currentHeight} aria-valuetext={`${currentHeight} pixels`} tabIndex={0} title="Arraste para ajustar. Setas ajustam; Enter oculta; Escape cancela." onPointerDown={event=>{
        if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,startY:event.clientY,startHeight:dock.current?.getBoundingClientRect().height||currentHeight,original:state,next:state};setDragging(true);
      }} onPointerMove={event=>{const current=drag.current;if(!current||current.id!==event.pointerId)return;current.next={...current.original,height:dragDockHeight(current.startHeight,current.startY,event.clientY,window.innerHeight)};setState(current.next);}}
       onPointerUp={event=>{const current=drag.current;if(!current||current.id!==event.pointerId)return;drag.current=null;setDragging(false);save(current.next);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
       onPointerCancel={cancelDrag} onLostPointerCapture={()=>{if(drag.current)cancelDrag();}}
       onKeyDown={event=>{if(!['ArrowUp','ArrowDown','Home','End','Enter','Escape'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='Escape'){cancelDrag();return;}if(drag.current)return;if(event.key==='Enter'){toggle.current?.focus();save({...state,collapsed:true});return;}const next=event.key==='Home'?48:event.key==='End'?maximum:currentHeight+(event.key==='ArrowUp'?8:-8);save({...state,height:clampDockHeight(next,viewport)});}}><span aria-hidden="true"/></div>}
      {error && <span className="operation-dock-error" role="status">Preferência não salva. <button onClick={()=>save(latest.current)}>Tentar salvar</button></span>}
      <button ref={toggle} className="operation-dock-toggle" aria-expanded={!state.collapsed} aria-controls={contentId} onClick={()=>save({...state,collapsed:!state.collapsed})} title={state.collapsed?'Mostrar controles de projeção':'Ocultar controles de projeção'}>{state.collapsed?<><span aria-hidden="true">⌃</span> Mostrar controles de projeção</>:<><span aria-hidden="true">⌄</span><span>Ocultar</span></>}</button>
    </div>
    <div id={contentId} className="operation-dock-content" hidden={state.collapsed}>{children}</div>
  </footer>;
}
