import { useEffect, useId, useRef, useState } from 'react';
import type { Category } from '../../shared/contracts';
import { api } from '../../shared/contracts/api';

export function CreateCategoryDialog({ onCreated, onClose }: { onCreated: (category: Category) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const titleId = useId();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => { node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  async function create() {
    if (locked.current) return;
    const trimmed = name.trim();
    if (!trimmed) { setError('Informe o nome da classificação.'); return; }
    locked.current = true; setBusy(true); setError('');
    try { const category = await api.createCategory(trimmed); onCreated(category); }
    catch (reason) { setError(String(reason)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="song-category-dialog" aria-labelledby={titleId} data-no-shortcuts onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); void create(); }}>
      <h2 id={titleId}>Nova classificação</h2>
      <label>Nome<input autoFocus required maxLength={80} value={name} disabled={busy} onChange={event => { setName(event.target.value); setError(''); }} /></label>
      {error && <p className="error-message" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="primary" disabled={busy || !name.trim()}>{busy ? 'Criando…' : 'Criar classificação'}</button></footer>
    </form>
  </dialog>;
}
