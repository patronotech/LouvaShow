import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../../shared/contracts/api';
import type { Category, Display, PresentationAction, ProjectionStatus, SaveSongInput, Setlist, SetlistSummary, Song } from '../../shared/contracts';
import { usePresentation } from '../../features/presentation/usePresentation';
import { Slide } from '../../features/presentation/Slide';
import { ThemeEditor } from '../../features/presentation/ThemeEditor';
import { LibraryManager } from '../../features/songs/LibraryManager';
import { ImportDialog } from '../../features/songs/ImportDialog';
import { SongEditor } from '../../features/songs/SongEditor';
import { searchKey } from '../../features/songs/lyrics';
import { PlaylistDialog, type PlaylistDialogMode } from '../../features/setlists/PlaylistDialog';
import { updateSummaries } from '../../features/setlists/summaries';
import { SetlistPanel } from '../../features/setlists/SetlistPanel';
import { AboutDialog } from '../../shared/ui/AboutDialog';
import '../../shared/styles/operator.css';

function DeleteConfirm({ song, usage, busy, error, onConfirm, onCancel }: { song: Song; usage: number; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="delete-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}><h2 id="delete-title">Excluir “{song.title}”?</h2><p>A música e seus blocos serão excluídos da biblioteca. {usage > 0 ? `Também serão removidas ${usage} ocorrências nas playlists.` : 'Ela não está em nenhuma playlist.'}</p><p>O trecho já projetado continuará na saída até você trocá-lo. Esta exclusão não pode ser desfeita.</p>{error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-actions"><button autoFocus onClick={onCancel} disabled={busy}>Cancelar</button><button className="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Excluindo…' : 'Excluir música'}</button></div></dialog>;
}

export function Operator() {
  const { snapshot, error: syncError, accept, retry } = usePresentation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [playlists, setPlaylists] = useState<SetlistSummary[]>([]);
  const [playlistDialog, setPlaylistDialog] = useState<PlaylistDialogMode | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const libraryLocked = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [libraryLimit, setLibraryLimit] = useState(80);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [outputBusy, setOutputBusy] = useState(false);
  const [editor, setEditor] = useState<{ song: Song | null } | null>(null);
  const [deletion, setDeletion] = useState<{ song: Song; usage: number } | null>(null);
  const [monitors, setMonitors] = useState<Display[]>([]);
  const [monitorId, setMonitorId] = useState('');
  const [status, setStatus] = useState<ProjectionStatus>({ open: false, fullscreen: false, monitorId: null, warning: null });
  const [overflow, setOverflow] = useState(false);
  const selected = songs.find(song => song.id === selectedId) ?? null;
  const currentBlock = snapshot?.blocks[snapshot.blockIndex];
  const visibleSongs = songs.filter(song => (!categoryFilter || song.categoryId === categoryFilter) && searchKey(song.title).includes(searchKey(query)));
  useEffect(() => { setLibraryLimit(80); }, [query, categoryFilter]);
  const refreshLibrary = useCallback(async () => {
    if (libraryLocked.current) return;
    libraryLocked.current = true; setLibraryBusy(true);
    try {
      const [nextSongs, nextSetlist, nextCategories, nextPlaylists] = await Promise.all([api.listSongs(), api.getSetlist(), api.listCategories(), api.listSetlists()]);
      setSongs(nextSongs); setSetlist(nextSetlist); setCategories(nextCategories); setPlaylists(nextPlaylists); setLoaded(true);
    } finally { libraryLocked.current = false; setLibraryBusy(false); }
  }, []);
  const loadLibrary = useCallback(async () => {
    try { await refreshLibrary(); }
    catch (reason) { setError(String(reason)); }
  }, [refreshLibrary]);
  const refreshDisplays = useCallback(async () => {
    try { const [nextMonitors, nextStatus] = await Promise.all([api.listMonitors(), api.projectionStatus()]); setMonitors(nextMonitors); setStatus(nextStatus); }
    catch (reason) { setError(String(reason)); }
  }, []);
  useEffect(() => { void loadLibrary(); }, [loadLibrary]);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void (async () => {
      try { stop = await listen<ProjectionStatus>('projection:status', event => { if (!disposed) setStatus(event.payload); }); if (disposed) { stop(); return; } await refreshDisplays(); }
      catch (reason) { if (!disposed) setError(String(reason)); }
    })();
    window.addEventListener('focus', refreshDisplays);
    return () => { disposed = true; stop?.(); window.removeEventListener('focus', refreshDisplays); };
  }, [refreshDisplays]);
  async function act(action: PresentationAction) {
    if (outputBusy) return;
    setOutputBusy(true); setError('');
    try { accept(await api.action(action)); }
    catch (reason) { setError(String(reason)); }
    finally { setOutputBusy(false); }
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!status.open || editor || deletion || playlistDialog || aboutOpen || managerOpen || importOpen || outputBusy || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.closest('input,textarea,select,dialog,[contenteditable="true"],[data-no-shortcuts]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key.toLowerCase() === 'b') {
        event.preventDefault();
        void act({ type: event.key === 'ArrowRight' ? 'next' : event.key === 'ArrowLeft' ? 'previous' : 'toggleBlank' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  async function outputOperation(operation: () => Promise<ProjectionStatus>) {
    if (outputBusy) return;
    setOutputBusy(true); setError('');
    try { setStatus(await operation()); }
    catch (reason) { setError(String(reason)); }
    finally { setOutputBusy(false); }
  }
  async function changeSetlist(operation: () => Promise<Setlist>, deletedId?: string) {
    if (libraryLocked.current) throw new Error('Aguarde a operação em andamento.');
    libraryLocked.current = true; setLibraryBusy(true); setError('');
    try {
      const next = await operation();
      setSetlist(next); setPlaylists(current => updateSummaries(current, next, deletedId));
      setNotice(`Playlist “${next.name}” selecionada e salva.`);
      try { setPlaylists(await api.listSetlists()); }
      catch (reason) { setError(`A playlist foi salva, mas a lista não pôde ser atualizada. Use Tentar novamente. ${String(reason)}`); }
    } catch (reason) { setError(String(reason)); throw reason; }
    finally { libraryLocked.current = false; setLibraryBusy(false); }
  }
  function requestSetlist(operation: () => Promise<Setlist>) {
    void changeSetlist(operation).catch(() => {});
  }
  async function saveSong(input: SaveSongInput) {
    const saved = await api.saveSong(input);
    setSongs(current => [...current.filter(song => song.id !== saved.id), saved].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')));
    setSelectedId(saved.id); setNotice('Música salva na biblioteca local.');
  }
  async function requestDelete(song: Song) {
    if (libraryLocked.current) return;
    libraryLocked.current = true; setLibraryBusy(true); setError('');
    try { setDeletion({ song, usage: await api.songUsage(song.id) }); }
    catch (reason) { setError(String(reason)); }
    finally { libraryLocked.current = false; setLibraryBusy(false); }
  }
  async function deleteSong() {
    if (!deletion || libraryLocked.current) return;
    libraryLocked.current = true; setLibraryBusy(true); setError('');
    try { await api.deleteSong(deletion.song.id); setSongs(current => current.filter(song => song.id !== deletion.song.id)); if (selectedId === deletion.song.id) setSelectedId(null); setDeletion(null); setSetlist(await api.getSetlist()); setPlaylists(await api.listSetlists()); setNotice('Música excluída. O conteúdo ao vivo foi preservado.'); }
    catch (reason) { setError(String(reason)); }
    finally { libraryLocked.current = false; setLibraryBusy(false); }
  }
  async function demo() {
    if (libraryLocked.current) return;
    libraryLocked.current = true; setLibraryBusy(true);
    try { await saveSong({ id: null, categoryId: 'musica', copyright: null, title: 'Boas-vindas · demonstração', artist: 'Texto de teste do LouvaShow', blocks: [{ id: null, label: 'Abertura', text: 'Seja bem-vindo\nVamos celebrar juntos' }, { id: null, label: 'Encontro', text: 'Uma comunidade reunida\nUm novo encontro começa' }, { id: null, label: 'Encerramento', text: 'Obrigado por estar aqui\nTenha uma semana de paz' }] }); }
    catch (reason) { setError(String(reason)); }
    finally { libraryLocked.current = false; setLibraryBusy(false); }
  }
  return <div className="operator-shell">
    <header className="app-header"><div className="brand"><span className="brand-symbol" aria-hidden="true">L</span><div><h1>Louva<span>Show</span></h1><p>PROJEÇÃO SIMPLES. PRESENÇA INTEIRA.</p></div></div><div className="header-actions"><div className="header-meta"><span className="local-badge">◈ Local e offline</span><span className="version">PRÉVIA 0.3</span></div><button className="about-trigger" onClick={() => setAboutOpen(true)}>Créditos e comunidade</button></div></header>
    {(error || syncError) && <div className="error-banner" role="alert"><span>{error || syncError}</span><button disabled={libraryBusy} onClick={() => { setError(''); retry(); void loadLibrary(); void refreshDisplays(); }}>Tentar novamente</button></div>}
    <div className="workspace">
      <aside className="library-panel panel" aria-labelledby="library-title"><div className="section-heading"><h2 id="library-title">Biblioteca</h2><span className="count">{songs.length}</span></div><button className="primary new-song" disabled={libraryBusy || !loaded} onClick={() => setEditor({ song: null })}>＋ Nova música</button><div className="library-management-actions"><button onClick={() => setManagerOpen(true)} disabled={!loaded || libraryBusy}>☷ Gerenciar biblioteca</button><button onClick={() => setImportOpen(true)} disabled={!loaded || libraryBusy}>↓ Importar músicas</button></div><label className="library-category-filter">Classificação<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">Todas as classificações</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="search-label"><span className="sr-only">Buscar música por título</span><input type="search" placeholder="Buscar música…" value={query} onChange={event => setQuery(event.target.value)} /></label><p className="eyebrow library-subtitle">SUAS MÚSICAS</p><div className="song-list">{visibleSongs.slice(0, libraryLimit).map(song => <button key={song.id} className={`song-row ${selectedId === song.id ? 'selected' : ''}`} onClick={() => setSelectedId(song.id)} aria-pressed={selectedId === song.id}><span className="song-icon" aria-hidden="true">♫</span><span><strong>{song.title}</strong><small>{song.artist || `${song.blocks.length} blocos`}</small>{selectedId === song.id && <small className="selection-label">Em preparação</small>}</span></button>)}{visibleSongs.length > libraryLimit && <button onClick={() => setLibraryLimit(current => current + 80)}>Mostrar mais ({visibleSongs.length - libraryLimit} restantes)</button>}{!visibleSongs.length && <div className="empty"><p>{!loaded ? 'Carregando biblioteca…' : query || categoryFilter ? 'Nenhuma música encontrada. Altere o título ou a classificação.' : 'Sua biblioteca começa aqui. Cadastre uma música ou experimente um texto de demonstração.'}</p>{loaded && !songs.length && <button disabled={libraryBusy} onClick={() => void demo()}>Criar demonstração</button>}</div>}</div><footer className="library-footer">As músicas ficam neste computador.</footer></aside>
      <main className="preparation-panel panel" aria-labelledby="preparation-title"><div className="section-heading"><div><span className="eyebrow">PREPARAÇÃO</span><h2 id="preparation-title">{selected?.title ?? 'Prepare a próxima música'}</h2></div>{selected && <span className="count">{selected.blocks.length} blocos</span>}</div>{selected ? <><p className="muted preparation-description">{selected.artist || 'Sem artista'} · Selecionar uma música não altera a saída.</p><div className="song-toolbar"><button disabled={libraryBusy} onClick={() => setEditor({ song: selected })}>✎ Editar</button><button disabled={libraryBusy || !setlist} onClick={() => { if (setlist) requestSetlist(() => api.addSetlistItem(setlist.id, selected.id)); }}>＋ Adicionar a “{setlist?.name ?? 'playlist'}”</button><button className="text-danger" disabled={libraryBusy} onClick={() => void requestDelete(selected)}>Excluir</button></div><div className="section-heading block-instruction"><span>{status.open ? 'Clique em um bloco para projetar' : 'Abra a projeção para enviar um bloco'}</span><span className="tiny muted">{snapshot?.songId === selected.id ? 'Música da sessão ao vivo' : 'Somente em preparação'}</span></div><div className="block-grid">{selected.blocks.map((block, index) => {
        const live = snapshot?.songId === selected.id && currentBlock?.id === block.id;
        return <button key={block.id} className={`block-card ${live ? 'live' : ''}`} disabled={!status.open || outputBusy} onClick={() => void act({ type: 'present', songId: selected.id, blockId: block.id })}><span className="block-label"><span>{String(index + 1).padStart(2, '0')} · {block.label || 'Bloco'}</span>{live && <strong>{!status.open ? 'NA SESSÃO · DESCONECTADO' : currentBlock.text !== block.text ? 'NA SESSÃO · VERSÃO ANTERIOR' : snapshot.blanked ? 'NA SESSÃO · APAGADO' : '● AO VIVO'}</strong>}</span><span className="block-text">{block.text}</span><span className="block-action">{status.open ? '↗ Projetar bloco' : 'Saída fechada'}</span></button>;
      })}</div></> : <div className="preparation-empty"><span aria-hidden="true">♫</span><h3>Um clique para preparar.<br />Outro para projetar.</h3><p>Escolha uma música na biblioteca ou na playlist do evento.<br />O conteúdo ao vivo só muda quando você comanda.</p></div>}</main>
      <aside className="live-panel panel"><section aria-labelledby="live-title"><div className="section-heading"><h2 id="live-title">Saída ao vivo</h2><span className={`status-badge ${status.open && !snapshot?.blanked ? 'on-air' : ''}`}>{!status.open ? '○ Desconectada' : snapshot?.blanked ? '■ Apagada' : '● Ao vivo'}</span></div><div className="live-preview"><Slide snapshot={snapshot} preview onOverflow={setOverflow} /></div><div className="preview-caption"><strong>{snapshot?.title || 'Nenhum bloco enviado'}</strong><span>{currentBlock ? `${currentBlock.label || 'Bloco'} · ${snapshot!.blockIndex + 1}/${snapshot!.blocks.length}` : 'A abertura inicia com saída preta'}</span></div>{overflow && <p className="warning" role="status">Este bloco excede a área segura. Divida o texto antes de projetar.</p>}</section><div className="live-tools"><SetlistPanel setlist={setlist} playlists={playlists} onSelectPlaylist={id => requestSetlist(() => api.selectSetlist(id))} onManagePlaylist={setPlaylistDialog} songs={songs} selectedId={selectedId} busy={libraryBusy} onSelect={setSelectedId} onRemove={id => { if (setlist) requestSetlist(() => api.removeSetlistItem(setlist.id, id)); }} onReorder={ids => { if (setlist) requestSetlist(() => api.reorderSetlist(setlist.id, ids)); }} />{snapshot && <ThemeEditor theme={snapshot.theme} onApply={theme => act({ type: 'theme', theme })} />}</div></aside>
    </div>
    <footer className="operation-bar"><div className="output-controls"><label>SAÍDA<select aria-label="Tela de projeção" value={monitorId} onChange={event => setMonitorId(event.target.value)} disabled={outputBusy}><option value="">Prévia em janela · mover manualmente</option>{monitors.map(monitor => <option key={monitor.id} value={monitor.id}>{monitor.name} · {monitor.width} × {monitor.height}</option>)}</select></label><button onClick={() => void refreshDisplays()} aria-label="Atualizar lista de telas" title="Atualizar telas">↻</button><button className="primary" disabled={outputBusy} onClick={() => void outputOperation(() => api.openProjection(monitorId || null))}>{status.open ? '↗ Reabrir / mover saída' : '↗ Abrir projeção'}</button><button disabled={!status.open || outputBusy} onClick={() => void outputOperation(() => api.fullscreen(!status.fullscreen))}>{status.fullscreen ? '↙ Sair da tela cheia' : '⛶ Tela cheia'}</button></div><div className="transport"><button disabled={!status.open || !currentBlock || outputBusy || snapshot!.blockIndex === 0} onClick={() => void act({ type: 'previous' })}>← Anterior</button><button disabled={!status.open || !currentBlock || outputBusy || snapshot!.blockIndex === snapshot!.blocks.length - 1} onClick={() => void act({ type: 'next' })}>Próximo →</button><button className={snapshot?.blanked ? 'restore-button' : 'blank-button'} disabled={!status.open || outputBusy || !currentBlock} onClick={() => void act({ type: 'toggleBlank' })}>{snapshot?.blanked ? '◉ Restaurar saída' : '■ Apagar saída'} <kbd>B</kbd></button></div><div className="operation-note"><span>{status.warning || (monitors.length <= 1 ? 'Uma tela detectada: use a prévia em janela para manter os controles acessíveis.' : 'Confira a tela escolhida antes de ativar a tela cheia.')}</span><span>Atalhos: ← → navegar · B apagar/restaurar</span></div></footer>
    <span className="sr-only" role="status">{notice}</span>
    {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    {playlistDialog && <PlaylistDialog mode={playlistDialog} setlist={setlist} busy={libraryBusy} onClose={() => setPlaylistDialog(null)} onSubmit={async name => {
      if (playlistDialog === 'create') await changeSetlist(() => api.createSetlist(name));
      else if (setlist && playlistDialog === 'rename') await changeSetlist(() => api.renameSetlist(setlist.id, name));
      else if (setlist && playlistDialog === 'delete') await changeSetlist(() => api.deleteSetlist(setlist.id), setlist.id);
    }} />}
    {managerOpen && <LibraryManager songs={songs} categories={categories} onRefresh={refreshLibrary} onClose={() => setManagerOpen(false)} />}
    {importOpen && <ImportDialog categories={categories} onRefresh={refreshLibrary} onClose={() => setImportOpen(false)} />}
    {editor && <SongEditor song={editor.song} categories={categories} onSave={saveSong} onClose={() => setEditor(null)} />}
    {deletion && <DeleteConfirm song={deletion.song} usage={deletion.usage} busy={libraryBusy} error={error} onConfirm={() => void deleteSong()} onCancel={() => setDeletion(null)} />}
  </div>;
}

export default Operator;
