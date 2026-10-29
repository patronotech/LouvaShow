import { useEffect, useRef, useState } from 'react';
import type { Category, ImportPreview } from '../../shared/contracts';
import { api } from '../../shared/contracts/api';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export function validateImportFiles(files: Pick<File, 'name' | 'size'>[]): string | null {
  if (!files.length) return 'Escolha pelo menos um arquivo.';
  if (files.some(file => !/\.(xml|json|txt|zip)$/i.test(file.name))) return 'Use somente arquivos XML, JSON, TXT ou ZIP.';
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORT_BYTES) return 'O conjunto de arquivos excede 10 MiB. Divida a importação em lotes menores.';
  return null;
}

export function ImportDialog({ categories, onRefresh, onClose }: { categories: Category[]; onRefresh: () => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const pages = Math.max(1, Math.ceil((preview?.songs.length ?? 0) / 20));
  async function readFiles(files: File[]) {
    setPreview(null); setError(''); setNotice(''); setPage(0); setConfirmed(false);
    const invalid = validateImportFiles(files);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      const input = [];
      for (const file of files) input.push({ name: file.name, bytes: Array.from(new Uint8Array(await file.arrayBuffer())) });
      setPreview(await api.previewImport(input));
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  async function importSongs() {
    if (!preview || !preview.songs.length || !confirmed) return;
    setBusy(true); setError('');
    try {
      const result = await api.importSongs(preview.songs, categoryId);
      setPreview(null); setConfirmed(false);
      setNotice(`${result.imported} músicas importadas; ${result.skipped} ignoradas.`);
      await onRefresh();
    } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="import-dialog" aria-labelledby="import-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="section-heading"><div><span className="eyebrow">IMPORTAÇÃO LOCAL</span><h2 id="import-title">Importar músicas</h2></div><button autoFocus onClick={onClose} disabled={busy} aria-label="Fechar importação">×</button></div>
    <p className="muted">Escolha arquivos XML (OpenLyrics), JSON (LouvaShow), TXT ou ZIP. Nada será salvo antes da sua confirmação.</p>
    <fieldset disabled={busy}><label className="import-file-input">Arquivos · máximo de 10 MiB no total<input type="file" multiple accept=".xml,.json,.txt,.zip" onChange={event => { void readFiles(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label></fieldset>
    {busy && <p role="status">Processando arquivos…</p>}{error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="manager-notice">{notice}</p>}
    {preview && <>
      <div className="section-heading"><h3>Revisão antes de importar</h3><span className="count">{preview.songs.length} músicas · {preview.fileCount} arquivos</span></div>
      {preview.warnings.length > 0 && <details className="import-warnings" open><summary>{preview.warnings.length} avisos da leitura</summary><ul>{preview.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul></details>}
      <ol className="import-preview-list" start={page * 20 + 1}>{preview.songs.slice(page * 20, (page + 1) * 20).map((song, index) => <li key={`${page}-${index}`}><details><summary><strong>{song.title}</strong> <span>{song.blocks.length} blocos{song.artist ? ` · ${song.artist}` : ''}</span></summary>{song.copyright && <p className="muted tiny">Créditos: {song.copyright}</p>}{song.categoryName && <p className="muted tiny">Classificação no arquivo: {song.categoryName}</p>}<div className="import-blocks">{song.blocks.map((block, blockIndex) => <section key={blockIndex}><strong>{block.label || `Bloco ${blockIndex + 1}`}</strong><p>{block.text}</p></section>)}</div></details></li>)}</ol>
      {pages > 1 && <div className="pagination"><button disabled={busy || page === 0} onClick={() => setPage(current => current - 1)}>← Anterior</button><span>Página {page + 1} / {pages}</span><button disabled={busy || page >= pages - 1} onClick={() => setPage(current => current + 1)}>Próxima →</button></div>}
      <fieldset disabled={busy}><label className="import-category">Classificação de destino<select value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Manter classificação do arquivo (ou Música)</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><p className="muted tiny">{categoryId ? 'A classificação escolhida será aplicada a todas as músicas deste lote.' : 'As classificações do arquivo serão preservadas ou criadas. Músicas sem classificação irão para Música.'}</p><label className="import-confirm"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Revisei o conteúdo e confirmo a importação de {preview.songs.length} músicas.</label></fieldset>
    </>}
    <div className="dialog-actions"><button disabled={busy} onClick={onClose}>{preview ? 'Cancelar' : 'Concluir'}</button>{preview && <button className="primary" disabled={busy || !confirmed || !preview.songs.length} onClick={() => void importSongs()}>Importar {preview.songs.length} músicas</button>}</div>
  </dialog>;
}
