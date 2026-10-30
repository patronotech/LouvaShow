import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { startupApi } from './api';
import { newerStartup, type StartupState } from './state';

/** Subscribe before reading: a late query cannot replace a newer event. */
export function useStartupState() {
  const [state, setState] = useState<StartupState | null>(null);
  const [error, setError] = useState('');
  const [subscriptionAttempt, setSubscriptionAttempt] = useState(0);
  const reconnect = useCallback(() => setSubscriptionAttempt(value => value + 1), []);
  const accept = useCallback((next: StartupState) => {
    setState(previous => newerStartup(previous, next)); setError('');
  }, []);
  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    const receive = (next: StartupState) => { if (!disposed) accept(next); };
    void (async () => {
      try {
        stop = await listen<StartupState>('startup:state', event => receive(event.payload));
        if (disposed) { stop(); return; }
        receive(await startupApi.getState());
      } catch {
        if (!disposed) setError('Não foi possível acompanhar a inicialização. Tente novamente.');
      }
    })();
    return () => { disposed = true; stop?.(); };
  }, [subscriptionAttempt, accept]);
  return { state, error, reconnect, accept };
}
