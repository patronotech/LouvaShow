import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { api } from '../../shared/contracts/api';
import type { Snapshot } from '../../shared/contracts';
export function newer(current: Snapshot|null, incoming:Snapshot):Snapshot { return !current || incoming.revision > current.revision ? incoming : current; }
export function usePresentation() {
 const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
 const [attempt,setAttempt] = useState(0);
 const [error,setError] = useState<string|null>(null);
 useEffect(() => {
  let disposed = false; let stop: (()=>void)|undefined;
  const accept = (next:Snapshot) => { if(!disposed) {setSnapshot(old => newer(old,next));setError(null);} };
  void (async () => {
   try { stop = await listen<Snapshot>('presentation:snapshot', e=>accept(e.payload));
    if(disposed) { stop(); return; }
    accept(await api.getSnapshot());
   } catch(e) { if(!disposed) setError(String(e)); }
  })();
  return () => { disposed=true; stop?.(); };
 },[attempt]);
 return { snapshot, error, retry:()=>setAttempt(v=>v+1), accept: (next:Snapshot)=>setSnapshot(old=>newer(old,next)) };
}
