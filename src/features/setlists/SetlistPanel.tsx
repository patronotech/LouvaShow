import { useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Setlist, SetlistItem, Song } from '../../shared/contracts';
import { moveItem } from '../songs/lyrics';

interface Props { setlist: Setlist | null; songs: Song[]; selectedId: string | null; busy: boolean; onSelect: (id: string) => void; onRemove: (id: string) => void; onReorder: (ids: string[]) => void }
interface ItemProps { item: SetlistItem; title: string; index: number; count: number; selected: boolean; busy: boolean; onSelect: () => void; onRemove: () => void; onMove: (destination: number) => void }
function Item({ item, title, index, count, selected, busy, onSelect, onRemove, onMove }: ItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: item.id, disabled: busy });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`setlist-item ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-target' : ''} ${selected ? 'prepared' : ''}`}>
    <button ref={setActivatorNodeRef} className="drag-handle" {...attributes} {...listeners} aria-label={`Arrastar ${title}, posição ${index + 1}`} disabled={busy}>⠿</button>
    <span className="item-number">{String(index + 1).padStart(2, '0')}</span>
    <button className="setlist-title" onClick={onSelect}>{title}<span>{selected ? 'Em preparação' : 'Preparar música'}</span></button>
    <div className="item-actions"><button aria-label={`Mover ${title} para cima`} disabled={busy || index === 0} onClick={() => onMove(index - 1)}>↑</button><button aria-label={`Mover ${title} para baixo`} disabled={busy || index === count - 1} onClick={() => onMove(index + 1)}>↓</button><button aria-label={`Remover ${title} do repertório`} disabled={busy} onClick={onRemove}>×</button></div>
  </li>;
}

export function SetlistPanel({ setlist, songs, selectedId, busy, onSelect, onRemove, onReorder }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const items = setlist?.items ?? [];
  const titleFor = (id: string) => songs.find(song => song.id === id)?.title ?? 'Música indisponível';
  const reorder = (id: string, index: number) => onReorder(moveItem(items, id, index).map(item => item.id));
  const endDrag = ({ active, over }: DragEndEvent) => {
    setDragId(null);
    if (!over || active.id === over.id) return;
    const target = items.findIndex(item => item.id === over.id);
    if (target >= 0) reorder(String(active.id), target);
  };
  return <section className="setlist-panel" aria-labelledby="setlist-title" data-no-shortcuts>
    <div className="section-heading"><h2 id="setlist-title">{setlist?.name ?? 'Repertório'}</h2><span className="count">{items.length}</span></div>
    {!items.length ? <p className="empty">Prepare uma música e use <strong>Adicionar ao repertório</strong>. A mesma música pode entrar mais de uma vez.</p> : <>
      <p className="muted tiny">Arraste pela alça ou use as setas. Na alça: Espaço, setas e Espaço; Esc cancela.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={event => setDragId(String(event.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={endDrag} accessibility={{ screenReaderInstructions: { draggable: 'Para mover este item, pressione Espaço. Use as setas para escolher a posição, Espaço para confirmar ou Escape para cancelar.' }, announcements: { onDragStart: () => 'Item selecionado para mover.', onDragOver: ({ over }) => over ? `Destino: posição ${items.findIndex(item => item.id === over.id) + 1}.` : 'Sem destino válido.', onDragEnd: ({ over }) => over ? 'Nova ordem enviada para salvar.' : 'Movimento cancelado.', onDragCancel: () => 'Movimento cancelado. A ordem foi mantida.' } }}>
        <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}><ol className="setlist-list">{items.map((item, index) => <Item key={item.id} item={item} title={titleFor(item.songId)} index={index} count={items.length} selected={selectedId === item.songId} busy={busy} onSelect={() => onSelect(item.songId)} onRemove={() => onRemove(item.id)} onMove={destination => reorder(item.id, destination)} />)}</ol></SortableContext>
        <DragOverlay>{dragId ? <div className="drag-preview">⠿ {titleFor(items.find(item => item.id === dragId)?.songId ?? '')}</div> : null}</DragOverlay>
      </DndContext>
    </>}
  </section>;
}
