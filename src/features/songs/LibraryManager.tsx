import { useEffect, useRef, useState } from 'react';
import type { Category, Song } from '../../shared/contracts';
import { api } from '../../shared/contracts/api';
import { searchKey } from './lyrics';

interface Props { songs: Song[]; categories: Category[]; onRefresh: () => Promise<void>; onClose: () => void }
export function filterSongs(songs: Song[], query: string, categoryId: string): Song[] {
  return songs.filter(song => (!categoryId || song.categoryId === categoryId) && searchKey(song.title).includes(searchKey(query)));
}

export function LibraryManager({ songs, categories, onRefresh, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destination, setDestination] = useState('musica');
  const [categoryName, setCategoryName] = useState('');
  const [renameId, setRenameId] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<{ ids: string[]; usage: number } | null>(null);
  const [page, setPage] = useState(0);
  const [exportFormat, setExportFormat] = useState<'json' | 'openlyrics'>('json');
  const visible = filterSongs(songs, query, filter);
  const ids = visible.filter(song => selected.has(song.id)).map(song => song.id);
  const pages = Math.max(1, Math.ceil(visible.length / 50));
  const currentPage = Math.min(page, pages - 1);
  useEffect(() => { dialog.current?.showModal(); }, []);
  function changeFilter(nextQuery: string, nextFilter: string) {
    setQuery(nextQuery); setFilter(nextFilter); setSelected(new Set()); setPage(0); setConfirm(null);
  }
  async function run(operation: () => Promise<void>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); await onRefresh(); setSelected(new Set()); setConfirm(null); setNotice(message); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  async function prepareDelete() {
    if (!ids.length) return;
    setBusy(true); setError('');
    try { setConfirm({ ids: [...ids], usage: await api.songsUsage(ids) }); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  async function exportSongs(exportIds: string[]) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await api.exportSongs(exportIds, exportFormat); setNotice(result ? `${result.count} músicas exportadas para ${result.fileName}.` : 'Exportação cancelada. Nenhum arquivo foi salvo.'); }
    catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="library-manager" aria-labelledby="manager-title" onCancel={event => { event.preventDefault(); if (!busy) { if (confirm) setConfirm(null); else onClose(); } }}>
    <div className="section-heading"><div><span className="eyebrow">BIBLIOTECA LOCAL</span><h2 id="manager-title">Gerenciar músicas</h2></div><button autoFocus onClick={onClose} disabled={busy} aria-label="Fechar gerenciamento">×</button></div>
    <p className="muted">Organize classificações e selecione músicas para ações em lote. O conteúdo ao vivo é preservado.</p>
    {error && <div className="error-message"><p role="alert">{error}</p><button disabled={busy} onClick={() => void run(async () => {}, 'Biblioteca atualizada.')}>Atualizar biblioteca</button></div>}{notice && <p role="status" className="manager-notice">{notice}</p>}
    {confirm ? <section className="bulk-confirm" aria-labelledby="bulk-delete-title"><h3 id="bulk-delete-title">Excluir {confirm.ids.length} músicas?</h3><p>Serão removidas também {confirm.usage} ocorrências do repertório. A exclusão é definitiva; o trecho já projetado permanece na sessão.</p><div className="dialog-actions"><button autoFocus disabled={busy} onClick={() => setConfirm(null)}>Voltar sem excluir</button><button className="danger" disabled={busy} onClick={() => void run(() => api.deleteSongs(confirm.ids), 'Músicas excluídas da biblioteca.')}>{busy ? 'Excluindo…' : `Excluir ${confirm.ids.length} músicas`}</button></div></section> : <>
      <fieldset disabled={busy}>
        <div className="manager-filters"><label>Buscar título<input type="search" value={query} onChange={event => changeFilter(event.target.value, filter)} placeholder="Buscar músicas…" /></label><label>Classificação<select value={filter} onChange={event => changeFilter(query, event.target.value)}><option value="">Todas</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        <div className="manager-selection"><label><input type="checkbox" checked={visible.length > 0 && ids.length === visible.length} onChange={event => setSelected(new Set(event.target.checked ? visible.map(song => song.id) : []))} disabled={!visible.length} /> Selecionar todas as {visible.length} músicas filtradas</label><span>{ids.length} selecionadas</span></div>
        <p className="muted tiny">Ao mudar o filtro, a seleção é limpa. “Selecionar todas” inclui todas as páginas do filtro atual.</p>
        <ul className="manager-song-list">{visible.slice(currentPage * 50, (currentPage + 1) * 50).map(song => <li key={song.id}><label><input type="checkbox" checked={selected.has(song.id)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(song.id); else next.delete(song.id); return next; })} /><span><strong>{song.title}</strong><small>{categories.find(category => category.id === song.categoryId)?.name ?? 'Sem classificação'} · {song.blocks.length} blocos</small></span></label></li>)}{!visible.length && <li className="empty">Nenhuma música corresponde aos filtros.</li>}</ul>
        <div className="pagination"><button disabled={currentPage === 0} onClick={() => setPage(current => current - 1)}>← Página anterior</button><span>{currentPage + 1} / {pages}</span><button disabled={currentPage >= pages - 1} onClick={() => setPage(current => current + 1)}>Próxima página →</button></div>
        <div className="bulk-actions"><label>Classificar selecionadas como<select value={destination} onChange={event => setDestination(event.target.value)}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button disabled={!ids.length} onClick={() => void run(() => api.assignCategory(ids, destination), 'Classificação atualizada.')}>Aplicar classificação</button><button className="text-danger" disabled={!ids.length} onClick={() => void prepareDelete()}>Excluir selecionadas…</button></div>
        <section className="export-settings"><h3>Exportar músicas</h3><p className="muted tiny">Escolha o escopo e o formato. A próxima etapa permite escolher onde salvar.</p><label>Formato<select value={exportFormat} onChange={event => setExportFormat(event.target.value as 'json' | 'openlyrics')}><option value="json">LouvaShow JSON · com classificações</option><option value="openlyrics">OpenLyrics XML · arquivo ZIP</option></select></label><div className="export-actions"><button disabled={!ids.length} onClick={() => void exportSongs(ids)}>Exportar {ids.length} selecionadas…</button><button disabled={!visible.length} onClick={() => void exportSongs(visible.map(song => song.id))}>Exportar {visible.length} filtradas…</button></div></section>
        <details className="category-settings"><summary>Criar ou renomear classificações</summary><form onSubmit={event => { event.preventDefault(); if (categoryName.trim()) void run(async () => { await api.createCategory(categoryName.trim()); setCategoryName(''); }, 'Classificação criada.'); }}><label>Nova classificação<input maxLength={100} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Ex.: Natal" /></label><button disabled={!categoryName.trim()}>Criar classificação</button></form><form onSubmit={event => { event.preventDefault(); if (renameId && renameValue.trim()) void run(async () => { await api.renameCategory(renameId, renameValue.trim()); }, 'Classificação renomeada.'); }}><label>Classificação atual<select value={renameId} onChange={event => { setRenameId(event.target.value); setRenameValue(categories.find(category => category.id === event.target.value)?.name ?? ''); }}><option value="">Selecione…</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Novo nome<input maxLength={100} value={renameValue} onChange={event => setRenameValue(event.target.value)} /></label><button disabled={!renameId || !renameValue.trim()}>Renomear</button></form></details>
      </fieldset>
    </>}
    {!confirm && <div className="dialog-actions"><button disabled={busy} onClick={onClose}>Concluir</button></div>}
  </dialog>;
}
