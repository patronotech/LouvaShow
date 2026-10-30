import { useEffect, useRef, useState } from 'react';
import { version } from '../../../package.json';
import intro from '../../shared/assets/intro.mp4';
import poster from '../../shared/assets/intro-poster.jpg';
import { startupApi } from './api';
import { canEnterOperator } from './state';
import { useStartupState } from './useStartupState';
import './startup.css';

export function Startup() {
  const { state, error: connectionError, reconnect, accept } = useStartupState();
  const video = useRef<HTMLVideoElement>(null);
  const completing = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [animationFinished, setAnimationFinished] = useState(reducedMotion);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [commandError, setCommandError] = useState('');
  const [busy, setBusy] = useState(false);
  const [minimumAttempt, setMinimumAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { setReducedMotion(query.matches); if (query.matches) setAnimationFinished(true); };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    if (reducedMotion || animationFinished) return;
    const element = video.current;
    if (!element) return;
    let disposed = false;
    const fallback = () => { if (!disposed) { setMediaFailed(true); setAnimationFinished(true); } };
    // A broken decoder or stalled media must never hold the application indefinitely.
    const timeout = window.setTimeout(fallback, 20_000);
    element.defaultMuted = true; element.muted = true; element.volume = 0;
    void element.play().catch(fallback);
    return () => { disposed = true; window.clearTimeout(timeout); element.pause(); };
  }, [reducedMotion, animationFinished]);

  useEffect(() => {
    setSlow(false);
    const timeout = window.setTimeout(() => setSlow(true), 30_000);
    return () => window.clearTimeout(timeout);
  }, [state?.attempt]);

  useEffect(() => {
    if (busy || !state || state.attempt < minimumAttempt || !canEnterOperator(state, animationFinished) || connectionError || commandError || completing.current) return;
    completing.current = true;
    void startupApi.complete().catch(reason => {
      completing.current = false; setCommandError(String(reason));
    });
  }, [state, animationFinished, connectionError, commandError, busy, minimumAttempt]);

  async function retry() {
    if (busy) return;
    // The command can resolve before its event reaches this webview. Keep the
    // old ready snapshot ineligible until the retry's newer attempt is read.
    setMinimumAttempt((state?.attempt ?? -1) + 1);
    setBusy(true); setCommandError('');
    try { accept(await startupApi.retry()); reconnect(); }
    catch (reason) { setCommandError(String(reason)); }
    finally { setBusy(false); }
  }
  async function close() {
    try { await startupApi.close(); }
    catch { setCommandError('Não foi possível fechar. Use o comando Sair do aplicativo.'); }
  }
  const error = state?.error || connectionError || commandError;
  return <main className="startup-screen" aria-label="Abertura do LouvaShow">
    {reducedMotion || mediaFailed
      ? <img className="startup-video" src={poster} alt="" />
      : <video ref={video} className="startup-video" src={intro} poster={poster} autoPlay muted playsInline preload="auto" aria-hidden="true"
        onEnded={() => setAnimationFinished(true)}
        onError={() => { setMediaFailed(true); setAnimationFinished(true); }} />}
    <div className="startup-drag" data-tauri-drag-region aria-hidden="true" />
    <button className="startup-close" aria-label="Fechar LouvaShow" title="Fechar" onClick={() => void close()}>×</button>
    {error ? <section className="startup-error" aria-label="Falha na inicialização"><p role="alert">{error}</p><button disabled={busy} onClick={() => void retry()}>{busy ? 'Tentando…' : 'Tentar novamente'}</button></section>
      : slow && <section className="startup-error"><p role="status">A inicialização está demorando mais que o esperado.</p><button disabled={busy} onClick={() => void retry()}>Tentar novamente</button></section>}
    <footer className="startup-caption">
      <div><span>Por Dante Testa</span><span>Gratuito · Licença do código em definição</span></div>
      <span className="startup-version">v{version}</span>
    </footer>
    <div className={`startup-progress ${error ? 'failed' : ''}`} role="progressbar" aria-label={error ? 'Inicialização interrompida' : 'Carregando LouvaShow'} aria-valuetext={error ? 'Erro na inicialização' : 'Carregando'}><span /></div>
  </main>;
}
