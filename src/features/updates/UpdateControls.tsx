import { useEffect, useRef, useState } from 'react';
import { canStartUpdate, updateProgress, type UpdateSnapshot } from './contracts';
import './updates.css';

type Updater = {
  snapshot: UpdateSnapshot | null;
  error: string;
  check: (automatic?: boolean) => Promise<void>;
  install: () => Promise<void>;
};

function UpdateDialog({ updater, outputOpen, onClose }: { updater: Updater; outputOpen: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const state = updater.snapshot;
  const progress = state ? updateProgress(state) : undefined;
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  async function install() {
    if (busy || !canStartUpdate(state, outputOpen)) return;
    setBusy(true); setError('');
    try { await updater.install(); }
    catch (reason) { setError(String(reason)); setBusy(false); }
  }
  return <dialog ref={dialog} className="update-dialog" aria-labelledby="update-title" aria-describedby="update-description" data-no-shortcuts onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <h2 id="update-title">Atualizar para {state?.availableVersion}?</h2>
    <p id="update-description">Salve as edições antes de continuar. O LouvaShow será fechado e reaberto; a biblioteca e as configurações serão mantidas.</p>
    {state?.notes && <details className="update-notes"><summary>Novidades</summary><p>{state.notes}</p></details>}
    {outputOpen && <p className="warning">Feche a janela de projeção para atualizar.</p>}
    {busy && <div className="update-progress" role="status" aria-live="polite"><p>{state?.status === 'installing' ? 'Instalando e reiniciando…' : state?.status === 'ready' ? 'Download verificado. Preparando instalação…' : `Baixando atualização${progress === undefined ? '…' : ` · ${progress}%`}`}</p><progress max={100} value={progress} aria-label="Download da atualização" /></div>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <div className="dialog-actions"><button autoFocus disabled={busy} onClick={onClose}>Agora não</button><button className="primary" disabled={busy || !canStartUpdate(state, outputOpen)} onClick={() => void install()}>{busy ? 'Atualizando…' : error ? 'Tentar novamente' : 'Atualizar e reiniciar'}</button></div>
  </dialog>;
}

export function UpdateBanner({ updater, outputOpen }: { updater: Updater; outputOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const state = updater.snapshot;
  const available = !!state?.availableVersion && ['available', 'ready', 'downloading', 'installing', 'error'].includes(state.status);
  if (!available && !open) return null;
  return <>{available && <div className="update-banner" role="status"><span>↑ LouvaShow {state.availableVersion} disponível</span><button disabled={!canStartUpdate(state, outputOpen)} onClick={() => setOpen(true)}>Baixar e atualizar</button>{outputOpen && <small>Feche a projeção para atualizar.</small>}</div>}{open && <UpdateDialog updater={updater} outputOpen={outputOpen} onClose={() => setOpen(false)} />}</>;
}

export function UpdateSettings({ updater, outputOpen }: { updater: Updater; outputOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const state = updater.snapshot;
  const busy = !!state && ['checking', 'downloading', 'installing'].includes(state.status);
  return <div className="update-settings"><h3>Atualizações</h3><div className="update-settings-row"><span>Versão {state?.currentVersion ?? '…'}</span><button disabled={busy} onClick={() => void updater.check()}>{state?.status === 'checking' ? 'Verificando…' : 'Verificar atualizações'}</button>{canStartUpdate(state, outputOpen) && <button className="primary" onClick={() => setOpen(true)}>Baixar e atualizar</button>}</div>{state?.status === 'upToDate' && <p role="status">Você está na versão mais recente.</p>}{state?.availableVersion && outputOpen && <p>Feche a projeção para atualizar.</p>}{(updater.error || state?.error) && <p className="error-message" role="alert">{updater.error || state?.error}</p>}{open && <UpdateDialog updater={updater} outputOpen={outputOpen} onClose={() => setOpen(false)} />}</div>;
}
