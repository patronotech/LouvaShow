import { useEffect, useRef, useState } from 'react';
import type { Song, SaveSongInput, Category } from '../../shared/contracts';
import { splitLyrics } from './lyrics';

interface DraftBlock { key: string; id: string | null; label: string; text: string }
interface Props { song: Song | null; categories: Category[]; onSave: (input: SaveSongInput) => Promise<void>; onClose: () => void }

export function SongEditor({ song, categories, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(song?.title ?? '');
  const [categoryId, setCategoryId] = useState(song?.categoryId ?? 'musica');
  const [copyright, setCopyright] = useState(song?.copyright ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [lyrics, setLyrics] = useState(song?.blocks.map(block => block.text).join('\n\n') ?? '');
  const [reviewedLyrics, setReviewedLyrics] = useState(lyrics);
  const [blocks, setBlocks] = useState<DraftBlock[]>(song?.blocks.map(block => ({ key: block.id, id: block.id, label: block.label ?? '', text: block.text })) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const review = () => {
    const previous = [...blocks];
    setBlocks(splitLyrics(lyrics).map(text => {
      const index = previous.findIndex(block => block.text === text);
      if (index >= 0) return previous.splice(index, 1)[0]!;
      return { key: crypto.randomUUID(), id: null, label: '', text };
    }));
    setReviewedLyrics(lyrics);
  };
  const save = async () => {
    if (!title.trim()) { setError('Informe o título da música.'); return; }
    if (lyrics !== reviewedLyrics) { setError('Revise os blocos após alterar a letra colada.'); return; }
    const nonempty = blocks.filter(block => block.text.trim());
    if (!nonempty.length) { setError('Inclua pelo menos um bloco de letra.'); return; }
    setBusy(true); setError('');
    try {
      await onSave({ id: song?.id ?? null, categoryId, copyright: copyright.trim() || null, title: title.trim(), artist: artist.trim() || null, blocks: nonempty.map(({ id, label, text }) => ({ id, label: label.trim() || null, text: text.trim() })) });
      onClose();
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="song-dialog" aria-labelledby="editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="section-heading"><div><h2 id="editor-title">{song ? 'Editar música' : 'Nova música'}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Fechar editor">×</button></div>
      <fieldset disabled={busy}>
        <div className="form-row"><label>Título obrigatório<input autoFocus required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} /></label><label>Artista <span className="muted">opcional</span><input maxLength={200} value={artist} onChange={event => setArtist(event.target.value)} /></label></div>
        <div className="form-row"><label>Classificação<select value={categoryId} onChange={event => setCategoryId(event.target.value)}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Créditos e direitos autorais <span className="muted">opcional</span><input maxLength={1000} value={copyright} onChange={event => setCopyright(event.target.value)} /></label></div>
        <label>Cole a letra<textarea rows={7} value={lyrics} onChange={event => setLyrics(event.target.value)} placeholder={'Primeira estrofe\nSegunda linha\n\nRefrão'} /></label>
        <div className="section-heading"><p className="muted">Separe os blocos por uma linha em branco.</p><button type="button" onClick={review}>↳ Revisar blocos</button></div>
        <div className="editor-blocks">{blocks.map((block, index) => <section key={block.key} className="editor-block"><label>Bloco {index + 1}<input value={block.label} placeholder={`Bloco ${index + 1} (ex.: Refrão)`} maxLength={80} onChange={event => setBlocks(current => current.map(item => item.key === block.key ? { ...item, label: event.target.value } : item))} /></label><label className="sr-only" htmlFor={`block-${block.key}`}>Texto do bloco {index + 1}</label><textarea id={`block-${block.key}`} rows={3} value={block.text} onChange={event => setBlocks(current => current.map(item => item.key === block.key ? { ...item, text: event.target.value } : item))} /></section>)}</div>
      </fieldset>
      {error && <p role="alert" className="error-message">{error}</p>}
      <footer className="dialog-actions"><span className="muted">{blocks.length} blocos</span><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Salvando…' : '✓ Salvar música'}</button></footer>
    </form>
  </dialog>;
}
