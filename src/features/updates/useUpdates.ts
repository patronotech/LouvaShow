import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { acceptUpdateSnapshot, type UpdateSnapshot } from './contracts';

export function useUpdates(startupReady: boolean) {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const initialCheck = useRef(false);
  const accept = useCallback((incoming: UpdateSnapshot) => setSnapshot(current => acceptUpdateSnapshot(current, incoming)), []);

  useEffect(() => {
    let disposed = false;
    let stop: (() => void) | undefined;
    void (async () => {
      try {
        stop = await listen<UpdateSnapshot>('updates:state', event => { if (!disposed) accept(event.payload); });
        if (disposed) { stop(); return; }
        const current = await invoke<UpdateSnapshot>('get_update_state');
        if (!disposed) accept(current);
      } catch { /* A consulta manual oferece o erro recuperável, sem interromper a abertura. */ }
    })();
    return () => { disposed = true; stop?.(); };
  }, [accept]);

  const check = useCallback(async (automatic = false) => {
    if (busy.current) return;
    busy.current = true;
    setError('');
    try { accept(await invoke<UpdateSnapshot>('check_for_updates')); }
    catch (reason) { if (!automatic) setError(String(reason)); }
    finally { busy.current = false; }
  }, [accept]);

  useEffect(() => {
    if (!startupReady || initialCheck.current) return;
    const timer = window.setTimeout(() => { initialCheck.current = true; void check(true); }, 5000);
    return () => window.clearTimeout(timer);
  }, [startupReady, check]);

  const install = useCallback(async () => {
    if (busy.current) throw new Error('Aguarde a verificação em andamento.');
    busy.current = true;
    setError('');
    try {
      const current = await invoke<UpdateSnapshot>('get_update_state');
      const downloaded = current.status === 'ready' ? current : await invoke<UpdateSnapshot>('download_update');
      accept(downloaded);
      if (downloaded.status !== 'ready') throw new Error(downloaded.error || 'Não foi possível preparar a atualização. Tente novamente.');
      accept(await invoke<UpdateSnapshot>('install_update', { confirmed: true }));
    } catch (reason) { setError(String(reason)); throw reason; }
    finally { busy.current = false; }
  }, [accept]);

  return { snapshot, error, check, install };
}
