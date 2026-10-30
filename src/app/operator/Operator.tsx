import { useCallback, useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../../shared/contracts/api';
import type { Category, Display, PresentationAction, ProjectionStatus, SaveSongInput, Setlist, SetlistSummary, Song, Theme } from '../../shared/contracts';
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
import { useBibleBrowser } from '../../features/bible/useBibleBrowser';
import { BibleSidebar, BibleContent, BiblePreparationSummary } from '../../features/bible/BiblePanels';
import { AboutDialog } from '../../shared/ui/AboutDialog';
import { ResizableWorkspace } from '../../shared/ui/ResizableWorkspace';
import { resetWorkspaceLayouts } from '../../shared/ui/workspaceLayout';
import { ContextNavigation, SettingsNavigation, type OperatorContext, type SettingsSection } from './contextNavigation';
import '../../shared/styles/operator.css';
import './contextNavigation.css';
import { useAppearance } from './appearance';
import logoDark from '../../shared/assets/logo-dark.png';
import logoLight from '../../shared/assets/logo-light.png';
import './appearance.css';

function DeleteConfirm({ song, usage, busy, error, onConfirm, onCancel }: { song: Song; usage: number; busy: boolean; error: string; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="confirm-dialog" aria-labelledby="delete-title" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}><h2 id="delete-title">Excluir “{song.title}”?</h2><p>A música e seus blocos serão excluídos da biblioteca. {usage > 0 ? `Também serão removidas ${usage} ocorrências nos repertórios.` : 'Ela não está em nenhum repertório.'}</p><p>O trecho já projetado continuará na saída até você trocá-lo. Esta exclusão não pode ser desfeita.</p>{error && <p role="alert" className="error-message">{error}</p>}<div className="dialog-actions"><button autoFocus onClick={onCancel} disabled={busy}>Cancelar</button><button className="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Excluindo…' : 'Excluir música'}</button></div></dialog>;
}

export function Operator() {
  const { colorMode, setColorMode, appearanceError } = useAppearance();
  const { snapshot, error: syncError, accept, retry } = usePresentation();
  const [songs, setSongs] = useState<Song[]>([]);
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [playlists, setPlaylists] = useState<SetlistSummary[]>([]);
  const [playlistDialog, setPlaylistDialog] = useState<PlaylistDialogMode | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [context, setContext] = useState<OperatorContext>('live');
  const bibleBrowser = useBibleBrowser(context === 'bible');
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('projection');
  const [layoutNotice, setLayoutNotice] = useState('');
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
  async function applyTheme(theme: Theme): Promise<void> {
    if (outputBusy) throw new Error('Aguarde a operação de saída em andamento.');
    setOutputBusy(true); setError('');
    try { accept(await api.action({ type: 'theme', theme })); }
    finally { setOutputBusy(false); }
  }
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
      if ((context !== 'live' && context !== 'bible') || !status.open || editor || deletion || playlistDialog || aboutOpen || managerOpen || importOpen || outputBusy || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target?.closest('input,textarea,select,dialog,[contenteditable="true"],[data-no-shortcuts]')) return;
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
      setNotice(`Repertório “${next.name}” selecionado e salvo.`);
      try { setPlaylists(await api.listSetlists()); }
      catch (reason) { setError(`O repertório foi salvo, mas a lista não pôde ser atualizada. Use Tentar novamente. ${String(reason)}`); }
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
  function presentBibleVerse(verse: string) {
    const chapter = bibleBrowser.chapter;
    if (!status.open || outputBusy || !chapter || !chapter.verses.some(item => item.number === verse)) return;
    void act({ type: 'presentBible', versionId: chapter.versionId, bookId: chapter.bookId, chapter: chapter.chapter, verse });
  }
  function addSelectedToSetlist() {
    if (selected && setlist) requestSetlist(() => api.addSetlistItem(setlist.id, selected.id));
  }
  const setlistPanel = <SetlistPanel setlist={setlist} playlists={playlists} onSelectPlaylist={id => requestSetlist(() => api.selectSetlist(id))} onManagePlaylist={setPlaylistDialog} songs={songs} selectedId={selectedId} busy={libraryBusy} onSelect={setSelectedId} onRemove={id => { if (setlist) requestSetlist(() => api.removeSetlistItem(setlist.id, id)); }} onReorder={ids => { if (setlist) requestSetlist(() => api.reorderSetlist(setlist.id, ids)); }} />;
  const selectedSummary = <section className="context-selection">
    <div className="section-heading"><h3>{selected?.title ?? 'Nenhuma música selecionada'}</h3>{selected && <span className="compact-meta">{selected.blocks.length} blocos</span>}</div>
    {selected && <><button className="primary" disabled={libraryBusy || !setlist} onClick={addSelectedToSetlist}>＋ Adicionar a “{setlist?.name ?? 'repertório'}”</button><button onClick={() => setContext('live')}>Ir para operação →</button><button disabled={libraryBusy} onClick={() => setEditor({ song: selected })}>✎ Editar música</button></>}
  </section>;
  const previewPanel = <aside key="live-preview-panel" className="live-panel panel"><section aria-labelledby="live-title"><div className="section-heading"><h2 id="live-title">Saída ao vivo</h2><span className={`status-badge ${status.open && !snapshot?.blanked ? 'on-air' : ''}`}>{!status.open ? '○ Desconectada' : snapshot?.blanked ? '■ Apagada' : '● Ao vivo'}</span></div><div className="live-preview"><Slide snapshot={snapshot} preview onOverflow={setOverflow} /></div><div className="preview-caption"><strong>{snapshot?.title || 'Nenhum bloco enviado'}</strong>{currentBlock && <span>{snapshot?.bible ? `${currentBlock.label || snapshot.title} · página ${snapshot.blockIndex + 1}/${snapshot.blocks.length}` : `${currentBlock.label || 'Bloco'} · ${snapshot!.blockIndex + 1}/${snapshot!.blocks.length}`}</span>}</div><button className="preview-theme-shortcut" onClick={() => { setSettingsSection('projection'); setContext('settings'); }}>Ajustar texto e aparência</button>{overflow && <p className="warning" role="status">{snapshot?.bible ? 'Texto fora da área segura. Reduza a fonte ou ajuste a caixa.' : 'Texto fora da área segura. Divida o bloco ou ajuste a caixa.'}</p>}</section><div className="live-tools">{context === 'live' ? setlistPanel : context === 'bible' ? <BiblePreparationSummary browser={bibleBrowser} outputOpen={status.open} outputBusy={outputBusy} onPresent={presentBibleVerse} /> : context === 'settings' ? <section className="context-selection"><button onClick={() => setContext('live')}>Voltar à operação →</button></section> : selectedSummary}</div></aside>;
  const preparedSongPanel = <section className="preparation-panel panel" aria-labelledby="preparation-title">
    <div className="section-heading compact-heading"><h2 id="preparation-title">{selected?.title ?? 'Música'}</h2>{selected && <span className="compact-meta">{selected.artist ? `${selected.artist} · ` : ''}{selected.blocks.length} blocos{context === 'songs' ? ' · somente leitura' : ''}</span>}</div>
    {selected ? <><div className="song-toolbar"><button disabled={libraryBusy} onClick={() => setEditor({ song: selected })}>✎ Editar música</button><button disabled={libraryBusy || !setlist} onClick={addSelectedToSetlist}>＋ Adicionar a “{setlist?.name ?? 'repertório'}”</button>{context === 'songs' && <button className="text-danger" disabled={libraryBusy} onClick={() => void requestDelete(selected)}>Excluir música</button>}</div>{context === 'songs' && selected.copyright && <p className="song-copyright">Créditos: {selected.copyright}</p>}<div className="block-grid">{selected.blocks.map((block, index) => {
      const live = snapshot?.songId === selected.id && currentBlock?.id === block.id;
      const content = <><span className="block-label"><span>{String(index + 1).padStart(2, '0')} · {block.label || 'Bloco'}</span>{live && <strong>{!status.open ? 'NA SESSÃO · DESCONECTADO' : currentBlock.text !== block.text ? 'NA SESSÃO · VERSÃO ANTERIOR' : snapshot.blanked ? 'NA SESSÃO · APAGADO' : '● AO VIVO'}</strong>}</span><span className="block-text">{block.text}</span>{context !== 'songs' && <span className="block-action">{status.open ? '↗ Projetar bloco' : 'Saída fechada'}</span>}</>;
      return context === 'songs' ? <article key={block.id} className="block-card readonly-block">{content}</article> : <button key={block.id} className={`block-card ${live ? 'live' : ''} ${live && status.open && !snapshot.blanked ? 'on-air' : ''}`} disabled={!status.open || outputBusy} onClick={() => void act({ type: 'present', songId: selected.id, blockId: block.id })}>{content}</button>;
    })}</div></> : <div className="preparation-empty compact-empty"><p>Selecione uma música na biblioteca.</p><button disabled={libraryBusy || !loaded} onClick={() => setEditor({ song: null })}>＋ Nova música</button></div>}
  </section>;
  const settingsContent = <section key="settings-content" className="settings-content panel" hidden={context !== 'settings'} data-no-shortcuts><div className="section-heading"><div><h2>{settingsSection === 'projection' ? 'Projeção' : settingsSection === 'appearance' ? 'Aparência' : settingsSection === 'shortcuts' ? 'Atalhos de teclado' : 'Sobre o LouvaShow'}</h2></div></div>
    <div hidden={settingsSection !== 'projection'}><section className="settings-card"><h3>Tela de saída</h3><label>Monitor<select value={monitorId} disabled={outputBusy} onChange={event => setMonitorId(event.target.value)}><option value="">Prévia em janela · mover manualmente</option>{monitors.map(monitor => <option key={monitor.id} value={monitor.id}>{monitor.name} · {monitor.width} × {monitor.height}</option>)}</select></label><div className="context-actions"><button onClick={() => void refreshDisplays()}>↻ Atualizar telas</button><button className="primary" disabled={outputBusy} onClick={() => void outputOperation(() => api.openProjection(monitorId || null))}>{status.open ? 'Reabrir / mover saída' : 'Abrir projeção'}</button><button disabled={!status.open || outputBusy} onClick={() => void outputOperation(() => api.fullscreen(!status.fullscreen))}>{status.fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}</button></div>{status.warning && <p className="warning" role="status">{status.warning}</p>}</section>{snapshot && <ThemeEditor key="presentation-theme" theme={snapshot.theme} snapshot={snapshot} busy={outputBusy} defaultOpen onApply={applyTheme} />}</div>
    <section className="settings-card" hidden={settingsSection !== 'appearance'}><div className="appearance-options" role="group" aria-label="Aparência da interface"><button className="appearance-choice" aria-pressed={colorMode === 'dark'} onClick={() => setColorMode('dark')}><span className="appearance-sample" aria-hidden="true" /><strong>Escuro</strong></button><button className="appearance-choice" aria-pressed={colorMode === 'light'} onClick={() => setColorMode('light')}><span className="appearance-sample light-sample" aria-hidden="true" /><strong>Claro</strong></button></div>{appearanceError && <p role="status" className="warning">{appearanceError}</p>}<div className="appearance-layout-controls"><h3>Painéis</h3><button onClick={() => { resetWorkspaceLayouts(); setLayoutNotice('Tamanhos e painéis restaurados em todas as áreas.'); }}>Restaurar organização dos painéis</button>{layoutNotice && <p role="status">{layoutNotice}</p>}</div></section>
    <section className="settings-card" hidden={settingsSection !== 'shortcuts'}><dl className="shortcut-list"><div><dt>← / →</dt><dd>Anterior / próximo na sessão projetada.</dd></div><div><dt>B</dt><dd>Apagar ou restaurar a saída.</dd></div><div><dt>Espaço + setas</dt><dd>Reordenar pela alça; Espaço confirma e Escape cancela.</dd></div></dl><p>Projeção: ativos em Operação ao vivo e Bíblia, fora de campos e diálogos.</p></section>
    <section className="settings-card" hidden={settingsSection !== 'about'}><button onClick={() => setAboutOpen(true)}>Créditos e comunidade</button></section>
  </section>;
  const libraryPanel = <aside className="library-panel panel" aria-labelledby="library-title"><div className="section-heading"><h2 id="library-title">{context === 'setlists' ? 'Adicionar músicas' : context === 'songs' ? 'Biblioteca de músicas' : 'Biblioteca'}</h2><span className="count">{songs.length}</span></div>{context === 'songs' && <><button className="primary new-song" disabled={libraryBusy || !loaded} onClick={() => setEditor({ song: null })}>＋ Nova música</button><div className="library-management-actions"><button onClick={() => setManagerOpen(true)} disabled={!loaded || libraryBusy}>☷ Gerenciar biblioteca</button><button onClick={() => setImportOpen(true)} disabled={!loaded || libraryBusy}>↓ Importar músicas</button></div></>}<label className="library-category-filter">Classificação<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">Todas as classificações</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="search-label"><span className="sr-only">Buscar música por título</span><input type="search" placeholder="Buscar música…" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="song-list">{visibleSongs.slice(0, libraryLimit).map(song => <button key={song.id} className={`song-row ${selectedId === song.id ? 'selected' : ''}`} onClick={() => setSelectedId(song.id)} aria-pressed={selectedId === song.id}><span className="song-icon" aria-hidden="true">♫</span><span><strong>{song.title}</strong><small>{song.artist || `${song.blocks.length} blocos`}</small>{selectedId === song.id && <small className="selection-label">Em preparação</small>}</span></button>)}{visibleSongs.length > libraryLimit && <button onClick={() => setLibraryLimit(current => current + 80)}>Mostrar mais ({visibleSongs.length - libraryLimit} restantes)</button>}{!visibleSongs.length && <div className="empty"><p>{!loaded ? 'Carregando biblioteca…' : query || categoryFilter ? 'Nenhuma música encontrada.' : 'Biblioteca vazia.'}</p>{loaded && !songs.length && <button disabled={libraryBusy} onClick={() => void demo()}>Criar demonstração</button>}</div>}</div></aside>;
  return <div className={`operator-shell context-${context}`}>
    <header className="app-header"><div className="brand"><h1 className="sr-only">LouvaShow</h1><img className="brand-logo" src={colorMode === 'light' ? logoLight : logoDark} alt="" aria-hidden="true" draggable={false} /></div><ContextNavigation value={context} onChange={setContext} /><div className="header-actions"><div className="header-meta"><span className="local-badge">◈ Offline</span><span className="version">PRÉVIA 0.5</span></div><button className="about-trigger" onClick={() => setAboutOpen(true)}>Créditos</button></div></header>
    {(error || syncError) && <div className="error-banner" role="alert"><span>{error || syncError}</span><button disabled={libraryBusy} onClick={() => { setError(''); retry(); void loadLibrary(); void refreshDisplays(); }}>Tentar novamente</button></div>}
    <ResizableWorkspace context={context} leftLabel={context === 'settings' ? 'Configurações' : context === 'bible' ? 'Livros da Bíblia' : 'Biblioteca'} rightLabel="Saída ao vivo" left={context === 'settings' ? <SettingsNavigation value={settingsSection} onChange={setSettingsSection} /> : context === 'bible' ? <BibleSidebar browser={bibleBrowser} /> : libraryPanel} right={previewPanel}>
      <main className="context-main">
        {(context === 'live' || context === 'songs') && preparedSongPanel}
        {context === 'setlists' && <section className="repertoire-workspace panel"><div className="section-heading"><h2>{setlist?.name ?? 'Repertório'}</h2><button onClick={() => setContext('live')}>Ir para operação →</button></div><div className="repertoire-add"><div><strong>{selected?.title ?? 'Selecione uma música na biblioteca'}</strong></div><button className="primary" disabled={libraryBusy || !setlist || !selected} onClick={addSelectedToSetlist}>＋ Adicionar ao repertório</button></div>{setlistPanel}</section>}
        {context === 'bible' && <BibleContent browser={bibleBrowser} snapshot={snapshot} outputOpen={status.open} outputBusy={outputBusy} onPresent={presentBibleVerse} />}
        {settingsContent}
      </main>
    </ResizableWorkspace>
    <footer className="operation-bar"><div className="output-controls"><label>SAÍDA<select aria-label="Tela de projeção" value={monitorId} onChange={event => setMonitorId(event.target.value)} disabled={outputBusy}><option value="">Prévia em janela · mover manualmente</option>{monitors.map(monitor => <option key={monitor.id} value={monitor.id}>{monitor.name} · {monitor.width} × {monitor.height}</option>)}</select></label><button onClick={() => void refreshDisplays()} aria-label="Atualizar lista de telas" title="Atualizar telas">↻</button><button className="primary" disabled={outputBusy} onClick={() => void outputOperation(() => api.openProjection(monitorId || null))}>{status.open ? '↗ Reabrir / mover saída' : '↗ Abrir projeção'}</button><button disabled={!status.open || outputBusy} onClick={() => void outputOperation(() => api.fullscreen(!status.fullscreen))}>{status.fullscreen ? '↙ Sair da tela cheia' : '⛶ Tela cheia'}</button></div><div className="transport"><button disabled={!status.open || !currentBlock || outputBusy || snapshot!.blockIndex === 0} onClick={() => void act({ type: 'previous' })}>← Anterior</button><button disabled={!status.open || !currentBlock || outputBusy || snapshot!.blockIndex === snapshot!.blocks.length - 1} onClick={() => void act({ type: 'next' })}>Próximo →</button><button className={snapshot?.blanked ? 'restore-button' : 'blank-button'} disabled={!status.open || outputBusy || !currentBlock} onClick={() => void act({ type: 'toggleBlank' })}>{snapshot?.blanked ? '◉ Restaurar saída' : '■ Apagar saída'} <kbd>B</kbd></button></div>{(status.warning || monitors.length <= 1) && <div className="operation-note" role="status">{status.warning || 'Uma tela detectada. Use a prévia em janela.'}</div>}</footer>
    <span className="sr-only" role="status">{notice}</span>
    {aboutOpen && <AboutDialog colorMode={colorMode} onClose={() => setAboutOpen(false)} />}
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
