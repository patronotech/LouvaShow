/** One guard belongs to one field: late work cannot migrate into another input. */
export function createDictationGuard() {
 let revision = 0;
 return { capture: () => revision, current: (token: number) => token === revision, invalidate: () => { revision += 1; } };
}
export function appendDictation(current: string, incoming: string): string {
 const words = incoming.replace(/\s+/g, ' ').trim();
 if (!words) return current;
 return current + (current && !/\s$/.test(current) ? ' ' : '') + words;
}
export function canUseDictation(config: { enabled: boolean; hasKey: boolean; transcription: boolean } | null, disabled = false): boolean {
 return Boolean(!disabled && config?.enabled && config.hasKey && config.transcription);
}
export function stopCapture(recorder: { state: string; stop: () => void } | null, stream: { getTracks: () => { stop: () => void }[] } | null): void {
 try { if (recorder?.state === 'recording' || recorder?.state === 'paused') recorder.stop(); } catch { /* A device may already have stopped capture. */ }
 finally { stream?.getTracks().forEach(track => track.stop()); }
}
