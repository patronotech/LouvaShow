import { useCallback, useEffect, useState } from 'react';
import Operator from '../operator/Operator';
import { startupApi } from './api';
import { useStartupState } from './useStartupState';

export function OperatorStartup() {
  const { state, error, reconnect, accept } = useStartupState();
  const [commandError, setCommandError] = useState('');
  const attempt = state?.attempt ?? 0;
  useEffect(() => { setCommandError(''); }, [attempt]);
  const ready = useCallback(() => {
    void startupApi.operatorReady(attempt).catch(() => setCommandError('Não foi possível concluir a abertura do operador.'));
  }, [attempt]);
  const failed = useCallback((message: string) => {
    void startupApi.operatorFailed(attempt, message).catch(() => setCommandError(message));
  }, [attempt]);
  async function retry() {
    setCommandError('');
    try { accept(await startupApi.retry()); reconnect(); }
    catch (reason) { setCommandError(String(reason)); }
  }
  if (state?.status === 'ready' && !error && !commandError) {
    return <Operator key={state.attempt} onStartupReady={ready} onStartupError={failed} />;
  }
  const message = state?.error || error || commandError;
  return <main className="operator-shell" style={{ padding: 24, gap: 12 }}>
    <h1 style={{ fontSize: 20 }}>LouvaShow</h1>
    <p role={message ? 'alert' : 'status'}>{message || 'Carregando…'}</p>
    {message && <div><button onClick={() => void retry()}>Tentar novamente</button></div>}
  </main>;
}
