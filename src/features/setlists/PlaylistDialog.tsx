import { useEffect, useRef, useState } from 'react';
import type { Setlist } from '../../shared/contracts';

export type PlaylistDialogMode = 'create' | 'rename' | 'delete';
export function playlistNameError(name: string): string | null {
  if (!name.trim()) return 'Informe um nome para o repertório.';
  if ([...name.trim()].length > 120) return 'Use no máximo 120 caracteres no nome.';
  return null;
}

export function PlaylistDialog({ mode, setlist, busy, onSubmit, onClose }: {
  mode: PlaylistDialogMode; setlist: Setlist | null; busy: boolean;
  onSubmit: (name: string) => Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(mode === 'rename' ? setlist?.name ?? '' : '');
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  async function submit() {
    if (busy) return;
    const invalid = mode === 'delete' ? null : playlistNameError(name);
    if (invalid) { setError(invalid); return; }
    setError('');
    try { await onSubmit(name.trim()); onClose(); }
    catch (reason) { setError(String(reason)); }
  }
  return <dialog ref={ref} className="playlist-dialog" aria-labelledby="playlist-dialog-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h2 id="playlist-dialog-title">{mode === 'create' ? 'Novo repertório' : mode === 'rename' ? 'Renomear repertório' : `Excluir “${setlist?.name}”?`}</h2>
      {mode === 'delete' ? <><p>O repertório será excluído, incluindo {setlist?.items.length ?? 0} {setlist?.items.length === 1 ? 'ocorrência' : 'ocorrências'}. As músicas continuam na biblioteca e nos demais repertórios.</p><p>A música em preparação e a saída ao vivo serão preservadas. Esta exclusão não pode ser desfeita.</p></> : <><label>Nome do repertório<input autoFocus required maxLength={120} disabled={busy} value={name} placeholder="Ex.: Culto de domingo · manhã" onChange={event => setName(event.target.value)} /></label></>}
      {error && <p role="alert" className="error-message">{error} Você pode corrigir e tentar novamente.</p>}
      <div className="dialog-actions"><button type="button" autoFocus={mode === 'delete'} disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className={mode === 'delete' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Salvando…' : mode === 'create' ? 'Criar' : mode === 'rename' ? 'Salvar' : 'Excluir repertório'}</button></div>
    </form>
  </dialog>;
}
