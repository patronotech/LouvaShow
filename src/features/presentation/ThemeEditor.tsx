import { useEffect, useState } from 'react';
import type { Snapshot, TextBox, Theme } from '../../shared/contracts';
import { Slide, type SlideFit } from './Slide';
import { TextBoxEditor } from './TextBoxEditor';
import { copyTheme, createDraftSnapshot, effectiveTextBox, numberInRange, validTextBox, validateThemeDraft } from './textBox';

interface Props {
  theme: Theme;
  snapshot: Snapshot | null;
  defaultOpen?: boolean;
  busy?: boolean;
  onApply: (theme: Theme) => Promise<void>;
}
type BoxFields = Record<keyof TextBox, string>;
const boxFields = (box: TextBox): BoxFields => ({ x: String(box.x), y: String(box.y), width: String(box.width), height: String(box.height) });
function parseBox(fields: BoxFields, bible: boolean): TextBox | null {
  const x = numberInRange(fields.x, 0, 90);
  const y = numberInRange(fields.y, 0, bible ? 71 : 90);
  const width = numberInRange(fields.width, 10, 100);
  const height = numberInRange(fields.height, 10, 100);
  if (x === null || y === null || width === null || height === null) return null;
  const candidate = { x, y, width, height };
  return validTextBox(candidate) && y + height <= (bible ? 81 : 100) ? candidate : null;
}

export function ThemeEditor({ theme, snapshot, onApply, defaultOpen = false, busy = false }: Props) {
  // The parent keeps this component mounted across navigation. Live revisions never overwrite the draft.
  const [draft, setDraft] = useState(() => copyTheme(theme));
  const [fontInput, setFontInput] = useState(String(theme.fontSize));
  const [coordinates, setCoordinates] = useState(() => boxFields(effectiveTextBox(theme.textBox, Boolean(snapshot?.bible))));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [fit, setFit] = useState<SlideFit | null>(null);
  const draftSnapshot = createDraftSnapshot(snapshot, draft);
  const bible = Boolean(draftSnapshot.bible);
  const disabled = pending || busy;
  const coordinateBox = parseBox(coordinates, bible);
  const invalid = numberInRange(fontInput, 32, 100) === null ? 'Informe um tamanho de fonte entre 32 e 100. A prévia mantém o último valor válido.'
    : !coordinateBox ? `Use valores válidos para a caixa: largura e altura mínimas de 10%, sem ultrapassar ${bible ? 'a área bíblica de 81%' : 'a tela'}. A prévia mantém a última caixa válida.`
    : validateThemeDraft(draft);

  // A different content type changes the effective footer boundary, not the stored theme draft.
  useEffect(() => { setCoordinates(boxFields(effectiveTextBox(draft.textBox, bible))); }, [bible]);

  function update<K extends keyof Theme>(key: K, value: Theme[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setError(''); setStatus('');
  }
  function updateFont(raw: string) {
    setFontInput(raw); setError(''); setStatus('');
    const value = numberInRange(raw, 32, 100);
    if (value !== null) setDraft(current => ({ ...current, fontSize: value }));
  }
  function updateBox(box: TextBox) {
    setCoordinates(boxFields(effectiveTextBox(box, bible)));
    update('textBox', { ...box });
  }
  function updateCoordinate(key: keyof TextBox, raw: string) {
    const next = { ...coordinates, [key]: raw };
    setCoordinates(next); setError(''); setStatus('');
    const candidate = parseBox(next, bible);
    if (candidate) setDraft(current => ({ ...current, textBox: candidate }));
  }
  function restoreApplied() {
    const applied = copyTheme(theme);
    setDraft(applied); setFontInput(String(applied.fontSize));
    setCoordinates(boxFields(effectiveTextBox(applied.textBox, bible)));
    setError(''); setStatus('A prévia voltou ao tema atualmente aplicado.');
  }
  async function apply() {
    if (invalid || disabled) return;
    setPending(true); setError(''); setStatus('');
    try { await onApply(copyTheme(draft)); setStatus('Tema aplicado à saída.'); }
    catch (reason) { setError(`Não foi possível aplicar o tema. Seu rascunho foi mantido. ${String(reason)}`); }
    finally { setPending(false); }
  }

  return <details className="theme-editor" open={defaultOpen} data-no-shortcuts>
    <summary>Tema da projeção</summary>
    <fieldset disabled={disabled}>
      <div className="theme-editor-fields">
        <label>Fonte<select value={draft.fontFamily} onChange={event => update('fontFamily', event.target.value)}>{['Arial', 'Georgia', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select></label>
        <label>Tamanho<input type="number" min={32} max={100} step={1} value={fontInput} aria-invalid={numberInRange(fontInput, 32, 100) === null} onChange={event => updateFont(event.target.value)} /></label>
        <label>Cor do texto<input type="color" value={draft.textColor} onInput={event => update('textColor', event.currentTarget.value)} onChange={event => update('textColor', event.target.value)} /></label>
        <label>Cor do fundo<input type="color" value={draft.backgroundColor} onInput={event => update('backgroundColor', event.currentTarget.value)} onChange={event => update('backgroundColor', event.target.value)} /></label>
      </div>
      <div className="theme-editor-preview-heading"><strong>Prévia de edição</strong><span className="theme-draft-badge">Rascunho</span></div>
      <TextBoxEditor box={draft.textBox} bible={bible} disabled={disabled} onChange={updateBox}>
        <Slide snapshot={draftSnapshot} preview previewLabel="Prévia de edição — não está ao vivo" onFit={setFit} />
      </TextBoxEditor>
      {fit && fit.actualFontSize < fit.requestedFontSize && <p className="theme-fit-status">Fonte ajustada para caber: {fit.actualFontSize.toLocaleString('pt-BR')} (solicitada: {fit.requestedFontSize.toLocaleString('pt-BR')}).</p>}
      {fit?.overflow && <p role="status" className="warning">O texto ainda não cabe no tamanho mínimo de 32. Amplie a caixa{bible ? ' ou ajuste o tema antes de aplicar.' : ' ou divida o bloco antes de projetar.'}</p>}
      <section className="theme-box-section" aria-labelledby="theme-box-heading">
        <h3 id="theme-box-heading">Área do texto (% da tela)</h3>
        <div className="theme-box-fields">{([{ key: 'x', label: 'Posição X' }, { key: 'y', label: 'Posição Y' }, { key: 'width', label: 'Largura' }, { key: 'height', label: 'Altura' }] as const).map(field => <label key={field.key}>{field.label}<input type="number" step={0.1} min={field.key === 'width' || field.key === 'height' ? 10 : 0} max={100} value={coordinates[field.key]} aria-invalid={!coordinateBox} onChange={event => updateCoordinate(field.key, event.target.value)} /></label>)}</div>
      </section>
      <div className="theme-editor-fields">
        <label>Alinhamento<select value={draft.textAlign} onChange={event => update('textAlign', event.target.value as Theme['textAlign'])}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
        <label>Posição vertical<select value={draft.verticalAlign} onChange={event => update('verticalAlign', event.target.value as Theme['verticalAlign'])}><option value="start">Superior</option><option value="center">Centro</option><option value="end">Inferior</option></select></label>
        <label>Transição<select value={draft.transitionType} onChange={event => update('transitionType', event.target.value as Theme['transitionType'])}><option value="none">Sem transição</option><option value="fade">Fade curto</option></select></label>
      </div>
    </fieldset>
    {invalid && <p role="status" className="draft-invalid">{invalid}</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    {status && <p role="status" className="theme-applied">{status}</p>}
    <div className="theme-actions"><button className="primary" disabled={disabled || Boolean(invalid)} onClick={() => void apply()}>{pending ? 'Aplicando…' : 'Aplicar tema à saída'}</button><button className="secondary" disabled={disabled} onClick={restoreApplied} aria-label="Reverter rascunho para o tema aplicado">Reverter rascunho</button></div>
  </details>;
}
