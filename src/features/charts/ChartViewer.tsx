import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChartApi } from './api';
import type { Chart, ChartDocument, ChartSummary } from './contracts';
import { ChordSheet } from './ChordSheet';
import { documentSource } from './documentText';
import { chartNotesKey, queueDestination, queueTarget, type ChartQueueItem } from './viewerState';
import './charts.css';

interface ViewSettings { fontSize: number; fontFamily: string; textColor: string; chordColor: string; backgroundColor: string }
const defaults: ViewSettings = { fontSize: 22, fontFamily: 'system-ui', textColor: '#eeeaf6', chordColor: '#c3a3ff', backgroundColor: '#17141f' };
function readSettings(key: string): ViewSettings { try { const { notes: _oldPaneNotes, ...settings } = JSON.parse(localStorage.getItem(key) || '{}') as ViewSettings & {notes?: string}; return { ...defaults, ...settings }; } catch { return defaults; } }
function readNotes(key: string): string { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function useChartNotes(chartId: string | undefined, ownerId: string): [string, (text: string) => void] {
 const key = chartId ? chartNotesKey(chartId, ownerId) : '';
 const [note, setNote] = useState({ key, text: key ? readNotes(key) : '' });
 useEffect(() => { const refresh = () => setNote({ key, text: key ? readNotes(key) : '' }); refresh(); window.addEventListener('louvashow:chart-note', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('louvashow:chart-note', refresh); window.removeEventListener('storage', refresh); }; }, [key]);
 const update = (text: string) => { if (!key) return; setNote({ key, text }); try { localStorage.setItem(key, text); window.dispatchEvent(new Event('louvashow:chart-note')); } catch { /* Keep this edit in memory when browser storage is unavailable. */ } };
 return [note.key === key ? note.text : key ? readNotes(key) : '', update];
}
function ViewerPane({ api, charts, initial, pane, controls, songTitles, queue, ownerId }: { api: ChartApi; charts: ChartSummary[]; initial?: Chart; pane: number; controls: boolean; songTitles?: Record<string, string>; queue?: readonly ChartQueueItem[]; ownerId: string }) {
  const [chart, setChart] = useState<Chart | undefined>(initial);
  const [document, setDocument] = useState<ChartDocument | undefined>(initial?.current.document);
  const rendered = useMemo(() => document ? documentSource(document) : null, [document]);
  const [queueIndex, setQueueIndex] = useState(0);
  const request = useRef(0); const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({top: 0}); }, [chart?.id, chart?.current.revision, queueIndex]);
  useEffect(() => () => { request.current += 1; }, []);
  const [notes, setNotes] = useChartNotes(chart?.id, ownerId);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const storageKey = `louvashow:musician:profile:${encodeURIComponent(ownerId)}:pane:${pane}`;
  const [settings, setSettings] = useState(() => readSettings(storageKey));
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Viewer remains usable without browser storage. */ } }, [settings, storageKey]);
  const select = async (id: string, revision?: number, index?: number) => { const token = ++request.current; setBusy(true); setError(''); try { const next = await api.get(id, revision); if (token !== request.current) return; setChart(next); setDocument(next.current.document); if (index !== undefined) setQueueIndex(index); } catch (reason) { if (token === request.current) setError(String(reason)); } finally { if (token === request.current) setBusy(false); } };
  const navigate = (index: number) => { const item = queueTarget(queue || [], index); if (item) void select(item.chartId, item.revision, index); };
  const transpose = async (semitones: number, capo: number) => { if (!document) return; const token = ++request.current; setBusy(true); setError(''); try { const result = await api.transpose(document, semitones, capo); if (token !== request.current) return; setDocument(result.document); if (result.warnings.length) setError(result.warnings.join(' ')); } catch (reason) { if (token === request.current) setError(String(reason)); } finally { if (token === request.current) setBusy(false); } };
  return <section className="chart-viewer-pane" aria-label={`Painel ${pane}`} style={{ background: settings.backgroundColor, color: settings.textColor }}>
    {controls && <div className="chart-viewer-controls">{queue?.length ? <label>Repertório<select value={queue[queueIndex]?.id || ''} disabled={busy} onChange={event => navigate(queue.findIndex(item => item.id === event.target.value))}>{queue.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {charts.find(value => value.id === item.chartId)?.name || 'Cifra arquivada'} · rev. {item.revision}</option>)}</select></label> : <label>Cifra<select value={chart?.id || ''} disabled={busy} onChange={event => void select(event.target.value)}><option value="" disabled>Selecionar cifra</option>{charts.map(value => <option key={value.id} value={value.id}>{songTitles?.[value.songId] ? `${songTitles[value.songId]} · ` : ''}{value.name}</option>)}</select></label>}<label>Fonte<select value={settings.fontFamily} onChange={event => setSettings({ ...settings, fontFamily: event.target.value })}><option value="system-ui">Sistema</option><option value="Georgia, serif">Serifada</option><option value="monospace">Monoespaçada</option></select></label><label>Tamanho<input type="range" min="14" max="42" value={settings.fontSize} onChange={event => setSettings({ ...settings, fontSize: Number(event.target.value) })}/></label><label>Letra<input type="color" value={settings.textColor} onChange={event => setSettings({ ...settings, textColor: event.target.value })}/></label><label>Acorde<input type="color" value={settings.chordColor} onChange={event => setSettings({ ...settings, chordColor: event.target.value })}/></label><label>Fundo<input type="color" value={settings.backgroundColor} onChange={event => setSettings({ ...settings, backgroundColor: event.target.value })}/></label>{document && <><button disabled={busy} title="Baixar meio tom" onClick={() => void transpose(-1, document.capo)}>−½</button><button disabled={busy} title="Subir meio tom" onClick={() => void transpose(1, document.capo)}>+½</button><label>Capo<select disabled={busy} value={document.capo} onChange={event => void transpose(0, Number(event.target.value))}>{[0, 1, 2, 3, 4, 5].map(value => <option key={value}>{value}</option>)}</select></label></>}</div>}
    {error && <p role="alert" className="chart-notice">{error}</p>}
    {document ? <><header className="chart-viewer-heading"><h2>{document.title}</h2><span>{chart?.name} · rev. {chart?.current.revision} · Tom real {document.concertKey || '—'} · Capo {document.capo}</span></header><div ref={scroll} className="chart-viewer-scroll"><ChordSheet source={rendered?.source || ''} lines={rendered?.lines} {...settings}/>{document.notes && <p className="chart-viewer-notes">{document.notes}</p>}{notes && !controls && <p className="chart-viewer-notes">{notes}</p>}</div></> : <p className="chart-empty">Selecione uma cifra neste painel.</p>}
    {controls && chart && <label className="chart-personal-notes">Notas desta cifra · neste dispositivo<textarea value={notes} onChange={event => setNotes(event.target.value)}/></label>}
    {queue?.length ? <nav className="chart-queue-nav" aria-label="Navegação do repertório"><button disabled={busy || queueDestination(queue, queueIndex, -1) === null} onClick={() => navigate(queueIndex - 1)}>← Anterior</button><span aria-live="polite">{queueIndex + 1} / {queue.length}</span><button disabled={busy || queueDestination(queue, queueIndex, 1) === null} onClick={() => navigate(queueIndex + 1)}>Próximo →</button></nav> : null}
  </section>;
}
export function ChartViewer({ api, charts, initial, onClose, songTitles, queue, ownerId = 'operator' }: { api: ChartApi; charts: ChartSummary[]; initial?: Chart; onClose: () => void; songTitles?: Record<string, string>; queue?: readonly ChartQueueItem[]; ownerId?: string }) {
  const [panes, setPanes] = useState(1); const [controls, setControls] = useState(!queue?.length);
  return createPortal(<div className="chart-viewer" data-no-shortcuts><nav className={`chart-viewer-toolbar ${controls ? '' : 'minimal'}`} aria-label="Visualização da cifra"><button onClick={() => setControls(!controls)}>{controls ? 'Modo palco' : 'Controles'}</button>{controls && <><button aria-pressed={panes === 2} onClick={() => setPanes(panes === 1 ? 2 : 1)}>{panes === 1 ? 'Dois painéis' : 'Um painel'}</button><span className="chart-toolbar-spacer"/><button onClick={onClose}>Fechar</button></>}</nav><div className={`chart-viewer-panes panes-${panes}`}><ViewerPane api={api} charts={charts} initial={initial} pane={1} ownerId={ownerId} controls={controls} songTitles={songTitles} queue={queue}/>{panes === 2 && <ViewerPane api={api} charts={charts} pane={2} ownerId={ownerId} controls={controls} songTitles={songTitles}/>}</div></div>, globalThis.document.body);
}
