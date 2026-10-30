import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ChartApi } from './api';
import type { Chart, ChartDocument, ChartSummary } from './contracts';
import { ChordSheet } from './ChordSheet';
import { documentSource } from './documentText';
import { chartNotesKey, queueDestination, queueTarget, type ChartQueueItem } from './viewerState';
import { sectionNavigation, sectionAtScroll } from './sectionNavigation';
import './charts.css';
import './chartReader.css';
import './viewerControls.css';
import { activeReadingPreset, applyReadingPreset, parseReadingPreferences, persistReadingPreferences, readingPresets, readingSettingsKey, type ViewSettings } from './readingPreferences';
import { StickyChartNote } from './StickyChartNote';

function readPreferences(key: string) { try { return parseReadingPreferences(localStorage.getItem(key),localStorage.getItem(`${key}:custom`)); } catch { return parseReadingPreferences(null); } }
function ViewerIcon({ name }: { name: 'settings' | 'close' | 'panels' | 'stage' | 'notes' | 'controls' | 'left' | 'right' }) {
 const paths = {settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3l1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2V9L3 7l2-3L7 4Z',close:'M6 6l12 12M18 6 6 18',panels:'M3 4h18v16H3ZM12 4v16',stage:'M3 3h18v14H3ZM8 21h8M12 17v4',notes:'M4 3h16v12l-6 6H4ZM14 21v-6h6',controls:'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',left:'M15 5l-7 7 7 7',right:'M9 5l7 7-7 7'};
 return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
function ReadingRange({label,value,min,max,onChange}:{label:string;value:number;min:number;max:number;onChange:(value:number)=>void}) {
 const id=useId();const [raw,setRaw]=useState(String(value));
 useEffect(()=>setRaw(String(value)),[value]);
 return <div className="reading-spacing-control"><label htmlFor={id}>{label}</label><div><input id={id} aria-label={label} type="range" min={min} max={max} step="1" value={value} onChange={event=>onChange(Number(event.target.value))}/><input aria-label={`${label} em pixels`} type="number" min={min} max={max} step="1" value={raw} onChange={event=>{setRaw(event.target.value);const next=Number(event.target.value);if(event.target.value.trim()&&Number.isFinite(next)&&next>=min&&next<=max)onChange(next);}} onBlur={()=>setRaw(String(value))}/><span>px</span></div></div>;
}
function ReadingCustomization({ draft, onChange, onCancel, onSave, error }: { draft: ViewSettings; onChange: (settings: ViewSettings) => void; onCancel: () => void; onSave: () => void; error: string }) {
 const dialog = useRef<HTMLDialogElement>(null);
 useEffect(() => { const popup = dialog.current; const previous = globalThis.document.activeElement as HTMLElement | null; popup?.showModal(); return () => { popup?.close(); if(previous?.isConnected) previous.focus(); }; }, []);
 const change = <K extends keyof ViewSettings,>(key: K, value: ViewSettings[K]) => onChange({...draft,[key]:value});
 return <dialog ref={dialog} className="reading-customization" aria-labelledby="reading-custom-title" onCancel={event => { event.preventDefault(); onCancel(); }} onKeyDown={event => { event.stopPropagation(); if(event.key==='Escape'){ event.preventDefault(); onCancel(); } }}>
  <header><h3 id="reading-custom-title">Personalizar leitura</h3><button type="button" className="reader-icon-button" title="Cancelar personalização" aria-label="Cancelar personalização" onClick={onCancel}><ViewerIcon name="close"/></button></header>
  <label className="reading-family">Fonte<select value={draft.fontFamily} onChange={event=>change('fontFamily',event.target.value)}><option value="system-ui">Sistema</option><option value="Georgia, serif">Serifada</option><option value="monospace">Monoespaçada</option></select></label>
  <div className="reading-type-grid">{(['lyric','chord'] as const).map(kind=>{ const size=kind==='lyric'?'fontSize':'chordFontSize'; const weight=kind==='lyric'?'fontWeight':'chordFontWeight'; const color=kind==='lyric'?'textColor':'chordColor'; return <fieldset key={kind}><legend>{kind==='lyric'?'Letra':'Acordes'}</legend><label>Tamanho <output>{Math.round(draft[size]*10)/10} px</output><input aria-label={kind==='lyric'?'Tamanho da letra':'Tamanho dos acordes'} type="range" min={kind==='lyric'?14:10} max="48" step="1" value={draft[size]} onChange={event=>change(size,Number(event.target.value))}/></label><label>Peso<select value={draft[weight]} onChange={event=>change(weight,Number(event.target.value))}>{[400,500,600,700,800].map((value,index)=><option key={value} value={value}>{['Normal','Médio','Seminegrito','Negrito','Extranegrito'][index]}</option>)}</select></label><label className="reading-color">Cor<input type="color" value={draft[color]} onChange={event=>change(color,event.target.value)}/></label></fieldset>; })}</div>
  <fieldset className="reading-section-controls"><legend>Título da parte</legend><label>Fonte<select value={draft.sectionFontFamily} onChange={event=>change('sectionFontFamily',event.target.value)}><option value="system-ui">Sistema</option><option value="Georgia, serif">Serifada</option><option value="monospace">Monoespaçada</option></select></label><label className="reading-color">Cor<input type="color" value={draft.sectionColor} onChange={event=>change('sectionColor',event.target.value)}/></label><ReadingRange label="Tamanho do título" value={draft.sectionFontSize} min={10} max={36} onChange={value=>change('sectionFontSize',value)}/></fieldset>
  <fieldset className="reading-spacing-controls"><legend>Espaçamento</legend><ReadingRange label="Acorde–letra" value={draft.chordGap} min={-24} max={32} onChange={value=>change('chordGap',value)}/><ReadingRange label="Título–primeira linha" value={draft.sectionTitleGap} min={0} max={64} onChange={value=>change('sectionTitleGap',value)}/><ReadingRange label="Entre partes" value={draft.sectionGap} min={0} max={96} onChange={value=>change('sectionGap',value)}/><ReadingRange label="Entre linhas" value={draft.lineGap} min={0} max={64} onChange={value=>change('lineGap',value)}/></fieldset>
  <label className="reading-color">Fundo<input type="color" value={draft.backgroundColor} onChange={event=>change('backgroundColor',event.target.value)}/></label>
  {error && <p role="alert">{error}</p>}<footer><button onClick={onCancel}>Cancelar</button><button className="reading-save" onClick={onSave}>Salvar definição</button></footer>
 </dialog>;
}
interface NoteDraft { text: string; dirty: boolean; error: string }
const noteDrafts = new Map<string, NoteDraft>();
function readNote(key: string): NoteDraft {
 const pending=noteDrafts.get(key); if(pending?.dirty) return pending;
 try { return {text:key ? localStorage.getItem(key)||'' : '',dirty:false,error:''}; }
 catch { return pending || {text:'',dirty:true,error:'Não foi possível ler a nota deste dispositivo.'}; }
}
function useChartNotes(chartId: string | undefined, ownerId: string): [string, (text: string) => void, string] {
 const key = chartId ? chartNotesKey(chartId, ownerId) : '';
 const [note,setNote]=useState(()=>({key,...readNote(key)}));
 useEffect(()=>{
   const refresh=()=>setNote({key,...readNote(key)}); refresh();
   const changed=(event:Event)=>{if((event as CustomEvent<{key:string}>).detail?.key===key)refresh();};
   const stored=(event:StorageEvent)=>{try{if(event.storageArea===localStorage && (event.key===key || event.key===null))refresh();}catch{/* A blocked storage provider must not discard the draft. */}};
   window.addEventListener('louvashow:chart-note',changed);window.addEventListener('storage',stored);
   return()=>{window.removeEventListener('louvashow:chart-note',changed);window.removeEventListener('storage',stored);};
 },[key]);
 const update=(text:string)=>{
   if(!key)return;
   const draft:NoteDraft={text,dirty:true,error:''}; noteDrafts.set(key,draft);
   try { localStorage.setItem(key,text);draft.dirty=false; }
   catch { draft.error='Nota não salva. O texto permanece nesta sessão; edite para tentar novamente.'; }
   noteDrafts.set(key,draft);setNote({key,...draft});
   window.dispatchEvent(new CustomEvent('louvashow:chart-note',{detail:{key}}));
 };
 const current=note.key===key?note:readNote(key);
 return [current.text,update,current.error];
}
function ViewerPane({ api, charts, initial, pane, controls, songTitles, queue, ownerId }: { api: ChartApi; charts: ChartSummary[]; initial?: Chart; pane: number; controls: boolean; songTitles?: Record<string, string>; queue?: readonly ChartQueueItem[]; ownerId: string }) {
  const [chart, setChart] = useState<Chart | undefined>(initial);
  const [document, setDocument] = useState<ChartDocument | undefined>(initial?.current.document);
  const rendered = useMemo(() => document ? documentSource(document) : null, [document]);
  const [queueIndex, setQueueIndex] = useState(0);
  const sectionPrefix = useId();
  const navigation = useMemo(() => document ? sectionNavigation(document) : [], [document]);
  const sectionIds = navigation.map(item => `${sectionPrefix}-${item.id}`);
  const [activeSection, setActiveSection] = useState(0);
  const trackPart = () => {
    const root = scroll.current;
    if (!root) return;
    const headings = root.querySelectorAll<HTMLElement>('.chord-section[id]');
    setActiveSection(sectionAtScroll(Array.from(headings, item => item.getBoundingClientRect().top), root.getBoundingClientRect().top));
  };
  const jumpPart = (index: number) => {
    const root = scroll.current;
    const heading = globalThis.document.getElementById(sectionIds[index] || '');
    if (!root || !heading || !root.contains(heading)) return;
    root.scrollTo({ top: Math.max(0, root.scrollTop + heading.getBoundingClientRect().top - root.getBoundingClientRect().top - 12), behavior: 'auto' });
    setActiveSection(index);
  };
  const request = useRef(0); const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({top: 0}); setActiveSection(0); }, [chart?.id, chart?.current.revision, queueIndex]);
  useEffect(() => () => { request.current += 1; }, []);
  const [notes, setNotes, notesError] = useChartNotes(chart?.id, ownerId);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const storageKey = readingSettingsKey(ownerId, pane);
  const [initialPreferences] = useState(() => readPreferences(storageKey));
  const [settings, setSettings] = useState(initialPreferences.settings);
  const [custom, setCustom] = useState<ViewSettings | null>(initialPreferences.custom);
  const [draft, setDraft] = useState<ViewSettings | null>(null);
  const [preferenceError, setPreferenceError] = useState('');
  const [noteOpenRequest, setNoteOpenRequest] = useState(0);
  const visibleSettings = draft || settings;
  const saveSettings = (next: ViewSettings, asCustom = false) => {
    try { persistReadingPreferences(localStorage, storageKey, next, asCustom ? next : custom); setPreferenceError(''); setSettings(next); if(asCustom) { setCustom(next); setDraft(null); } }
    catch { setPreferenceError('Não foi possível salvar a preferência neste dispositivo.'); }
  };
  const colors = {background:visibleSettings.backgroundColor,color:visibleSettings.textColor,'--reader-text':visibleSettings.textColor,'--reader-chord':visibleSettings.chordColor,'--reader-bg':visibleSettings.backgroundColor} as CSSProperties;
  const select = async (id: string, revision?: number, index?: number) => { const token = ++request.current; setBusy(true); setError(''); try { const next = await api.get(id, revision); if (token !== request.current) return; setChart(next); setDocument(next.current.document); if (index !== undefined) setQueueIndex(index); } catch (reason) { if (token === request.current) setError(String(reason)); } finally { if (token === request.current) setBusy(false); } };
  const navigate = (index: number) => { const item = queueTarget(queue || [], index); if (item) void select(item.chartId, item.revision, index); };
  const transpose = async (semitones: number, capo: number) => { if (!document) return; const token = ++request.current; setBusy(true); setError(''); try { const result = await api.transpose(document, semitones, capo); if (token !== request.current) return; setDocument(result.document); if (result.warnings.length) setError(result.warnings.join(' ')); } catch (reason) { if (token === request.current) setError(String(reason)); } finally { if (token === request.current) setBusy(false); } };
  return <section className="chart-viewer-pane" aria-label={`Painel ${pane}`} style={colors}>
    {controls && <div className="chart-viewer-controls reader-controls">
      <div className="reader-selection">{queue?.length ? <select aria-label="Música do repertório" value={queue[queueIndex]?.id || ''} disabled={busy} onChange={event => navigate(queue.findIndex(item => item.id === event.target.value))}>{queue.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {charts.find(value => value.id === item.chartId)?.name || 'Cifra arquivada'} · rev. {item.revision}</option>)}</select> : <select aria-label="Cifra" value={chart?.id || ''} disabled={busy} onChange={event => void select(event.target.value)}><option value="" disabled>Selecionar cifra</option>{charts.map(value => <option key={value.id} value={value.id}>{songTitles?.[value.songId] ? `${songTitles[value.songId]} · ` : ''}{value.name}</option>)}</select>}</div>
      {document && <div className="reader-control-group" aria-label="Tom e capotraste"><button disabled={busy} aria-label="Baixar meio tom" title="Baixar meio tom" onClick={() => void transpose(-1,document.capo)}>−</button><span className="reader-key" title="Tom real">{document.concertKey || 'Tom'}</span><button disabled={busy} aria-label="Subir meio tom" title="Subir meio tom" onClick={() => void transpose(1,document.capo)}>+</button><label className="reader-capo">Capo<select aria-label="Capotraste" disabled={busy} value={document.capo} onChange={event => void transpose(0,Number(event.target.value))}>{[0,1,2,3,4,5].map(value=><option key={value}>{value}</option>)}</select></label></div>}
      <div className="reader-palette" role="group" aria-label="Cores de leitura">{readingPresets.map(preset=><button key={preset.id} aria-pressed={activeReadingPreset(settings)===preset.id} title={preset.id==='contrast'?'Alto contraste':preset.name} onClick={()=>saveSettings(applyReadingPreset(settings,preset))}><i aria-hidden="true" style={{background:preset.backgroundColor,color:preset.chordColor}}>A</i><span>{preset.name}</span></button>)}{custom && <button aria-pressed={JSON.stringify(settings)===JSON.stringify(custom)} title="Restaurar definição personalizada" onClick={()=>saveSettings(custom)}>Minha</button>}</div>
      <div className="reader-control-group reader-tools"><button className="reader-icon-button" title="Personalizar leitura" aria-label="Personalizar leitura" onClick={()=>{setPreferenceError('');setDraft({...settings});}}><ViewerIcon name="settings"/></button><button className="reader-icon-button" title="Notas desta cifra" aria-label="Notas desta cifra" disabled={!chart} onClick={()=>setNoteOpenRequest(value=>value+1)}><ViewerIcon name="notes"/></button></div>
    </div>}
    {preferenceError && !draft && <p role="alert" className="chart-notice">{preferenceError}</p>}
    {draft && <ReadingCustomization draft={draft} onChange={setDraft} onCancel={()=>{setDraft(null);setPreferenceError('');}} onSave={()=>saveSettings(draft,true)} error={preferenceError}/>}
    {error && <p role="alert" className="chart-notice">{error}</p>}
    {document ? <><header className="chart-viewer-heading"><h2>{document.title}</h2><span>{chart?.name} · rev. {chart?.current.revision} · Tom real {document.concertKey || '—'} · Capo {document.capo}</span></header><nav className="chart-part-navigation" aria-label={`Partes da música · painel ${pane}`}>{navigation.map((item, index) => <button key={item.id} aria-current={index === activeSection ? 'location' : undefined} onClick={() => jumpPart(index)} title={`${index + 1}. ${item.label}`}>{item.label}</button>)}</nav><div ref={scroll} onScroll={trackPart} className="chart-viewer-scroll"><ChordSheet sectionIds={sectionIds} source={rendered?.source || ''} lines={rendered?.lines} {...visibleSettings}/>{document.notes && <p className="chart-viewer-notes">{document.notes}</p>}</div></> : <p className="chart-empty">Selecione uma cifra neste painel.</p>}
    {chart && <StickyChartNote key={chart.id} chartId={chart.id} ownerId={ownerId} text={notes} onChange={setNotes} openRequest={noteOpenRequest} persistenceError={notesError}/>}
    {queue?.length ? <nav className="chart-queue-nav" aria-label="Navegação do repertório"><button disabled={busy || queueDestination(queue, queueIndex, -1) === null} onClick={() => navigate(queueIndex - 1)}>← Anterior</button><span aria-live="polite">{queueIndex + 1} / {queue.length}</span><button disabled={busy || queueDestination(queue, queueIndex, 1) === null} onClick={() => navigate(queueIndex + 1)}>Próximo →</button></nav> : null}
  </section>;
}
export function ChartViewer({ api, charts, initial, onClose, songTitles, queue, ownerId = 'operator' }: { api: ChartApi; charts: ChartSummary[]; initial?: Chart; onClose: () => void; songTitles?: Record<string, string>; queue?: readonly ChartQueueItem[]; ownerId?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || (event.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      event.preventDefault(); closeRef.current();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => {
    const previous = globalThis.document.activeElement as HTMLElement | null;
    const background = globalThis.document.getElementById('root');
    const previousInert = background?.inert || false;
    if (background) background.inert = true;
    container.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (background) background.inert = previousInert; if (previous?.isConnected) previous.focus(); };
  }, []);
  const [panes, setPanes] = useState(1); const [controls, setControls] = useState(!queue?.length);
  return createPortal(<div ref={container} className="chart-viewer" role="dialog" aria-modal="true" aria-label="Leitura da cifra" data-no-shortcuts onKeyDown={event => {
    if (event.key === 'Escape' && !(event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const elements = Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || []).filter(element => element.offsetParent !== null);
    const first = elements[0]; const last = elements.at(-1);
    if (event.shiftKey && globalThis.document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && globalThis.document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}><nav className={`chart-viewer-toolbar ${controls ? '' : 'minimal'}`} aria-label="Visualização da cifra"><button onClick={() => setControls(!controls)} title={controls ? 'Modo palco' : 'Mostrar controles'}><ViewerIcon name={controls ? 'stage' : 'controls'}/>{controls ? 'Palco' : 'Controles'}</button>{controls && <><button aria-pressed={panes === 2} onClick={() => setPanes(panes === 1 ? 2 : 1)}><ViewerIcon name="panels"/>{panes === 1 ? 'Dois painéis' : 'Um painel'}</button><span className="chart-toolbar-spacer"/><button className="reader-icon-button" onClick={onClose} title="Fechar leitura" aria-label="Fechar leitura"><ViewerIcon name="close"/></button></>}</nav><div className={`chart-viewer-panes panes-${panes}`}><ViewerPane key={`${ownerId}:1`} api={api} charts={charts} initial={initial} pane={1} ownerId={ownerId} controls={controls} songTitles={songTitles} queue={queue}/>{panes === 2 && <ViewerPane key={`${ownerId}:2`} api={api} charts={charts} pane={2} ownerId={ownerId} controls={controls} songTitles={songTitles}/>}</div></div>, globalThis.document.body);
}
