import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AssistantConfig, SplitProposal } from './contracts';
import { appendDictation, canUseDictation, createDictationGuard, stopCapture } from './dictation';
interface Props { text: string; onInsert: (value: string) => void; onReplace?: (value: string) => void; compact?: boolean; fieldLabel?: string; disabled?: boolean; maxLength?: number }
export function AssistantTextTools({ text, onInsert, onReplace, compact = false, fieldLabel = 'texto', disabled = false, maxLength }: Props) {
 const [config, setConfig] = useState<AssistantConfig | null>(null);
 const [expanded, setExpanded] = useState(!compact);
 const [recording, setRecording] = useState(false); const [audio, setAudio] = useState<Blob | null>(null); const [audioUrl, setAudioUrl] = useState(''); const [fileName, setFileName] = useState('gravacao.webm');
 const [transcript, setTranscript] = useState<string | null>(null); const [split, setSplit] = useState<SplitProposal | null>(null); const [sourceText, setSourceText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const input = useRef<HTMLInputElement>(null); const guard = useRef(createDictationGuard());
 const cancelCapture = useCallback(() => { guard.current.invalidate(); stopCapture(recorder.current, stream.current); recorder.current = null; stream.current = null; }, []);
 const reset = useCallback(() => { cancelCapture(); setRecording(false); setAudio(null); setTranscript(null); setSplit(null); setBusy(false); setError(''); }, [cancelCapture]);
 useEffect(() => {
   let active = true; let request = 0;
   const load = () => { const token = ++request; void invoke<AssistantConfig>('assistant_config').then(value => { if (active && token === request) setConfig(value); }).catch(() => { if (active && token === request) setConfig(null); }); };
   load(); window.addEventListener('louvashow:assistant-config', load);
   return () => { active = false; cancelCapture(); window.removeEventListener('louvashow:assistant-config', load); };
 }, [cancelCapture]);
 const transcriptionAllowed = canUseDictation(config, disabled);
 const organizeAllowed = Boolean(!disabled && !compact && onReplace && config?.enabled && config.hasKey && config.organize);
 useEffect(() => { reset(); if (compact && !transcriptionAllowed) setExpanded(false); }, [transcriptionAllowed, organizeAllowed, compact, reset]);
 useEffect(() => { if (!audio) { setAudioUrl(''); return; } const url = URL.createObjectURL(audio); setAudioUrl(url); return () => URL.revokeObjectURL(url); }, [audio]);
 const run = async (action: (token: number) => Promise<void>) => { const token = guard.current.capture(); setBusy(true); setError(''); try { await action(token); } catch (reason) { if (guard.current.current(token)) setError(String(reason)); } finally { if (guard.current.current(token)) setBusy(false); } };
 const startRecording = async (token: number) => {
   if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Gravação não disponível neste sistema. Selecione um arquivo de áudio.');
   const media = await navigator.mediaDevices.getUserMedia({ audio: true });
   if (!guard.current.current(token)) { stopCapture(null, media); return; }
   stream.current = media;
   try {
     const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
     const current = new MediaRecorder(media, mimeType ? { mimeType } : undefined); recorder.current = current;
     const chunks: BlobPart[] = []; let bytes = 0;
     current.ondataavailable = event => { chunks.push(event.data); bytes += event.data.size; if (bytes > 23 * 1024 * 1024 && current.state === 'recording') current.stop(); };
     current.onstop = () => {
       stopCapture(null, media);
       if (!guard.current.current(token)) return;
       setRecording(false); const result = new Blob(chunks, { type: current.mimeType });
       if (result.size > 24 * 1024 * 1024) { setError('Gravação muito grande. Use até 24 MB.'); return; }
       setAudio(result); setTranscript(null); setFileName(current.mimeType.includes('mp4') ? 'gravacao.m4a' : 'gravacao.webm');
     };
     current.onerror = () => { stopCapture(null, media); if (guard.current.current(token)) { setRecording(false); setError('Não foi possível gravar. Selecione um arquivo de áudio.'); } };
     current.start(1000); setRecording(true);
   } catch (reason) { stopCapture(null, media); throw reason; }
 };
 if (!transcriptionAllowed && !organizeAllowed) return null;
 return <div className={`assistant-text-tools ${compact ? 'assistant-compact' : ''}`} data-no-shortcuts>
   {compact && <button type="button" className="dictation-trigger" disabled={disabled} aria-label={`Ditar ${fieldLabel}`} aria-expanded={expanded} onClick={() => { if (expanded) reset(); setExpanded(!expanded); }}>🎤 {expanded ? 'Fechar ditado' : 'Ditar'}</button>}
   {expanded && <div className="assistant-controls"><div className="chart-toolbar compact">
     {transcriptionAllowed && <><button type="button" disabled={busy} onClick={() => { if (recording) recorder.current?.stop(); else void run(startRecording); }}>{recording ? '■ Parar gravação' : '● Gravar voz'}</button><button type="button" disabled={busy || recording} onClick={() => input.current?.click()}>Importar áudio</button><input hidden ref={input} type="file" accept="audio/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg" onChange={event => { const file = event.target.files?.[0]; if (file) { if (file.size > 24 * 1024 * 1024) setError('O áudio deve ter até 24 MB.'); else { setAudio(file); setFileName(file.name); setTranscript(null); } } event.target.value = ''; }}/></>}
     {organizeAllowed && <button type="button" disabled={busy || recording || !text.trim()} onClick={() => { if (window.confirm('Enviar esta letra à Groq para sugerir divisões? O texto original será preservado até sua confirmação.')) void run(async token => { const result = await invoke<SplitProposal>('assistant_split', { text }); if (guard.current.current(token)) { setSourceText(text); setSplit(result); } }); }}>Sugerir divisões · IA</button>}
   </div>{recording && <p role="status">Gravando {fieldLabel}…</p>}{error && <p role="alert" className="error-banner">{error}</p>}
   {audio && !recording && <div className="assistant-proposal"><audio controls src={audioUrl}/><div className="chart-toolbar compact"><button type="button" disabled={busy} onClick={() => { if (window.confirm('Enviar este áudio à Groq para transcrição?')) void run(async token => { const bytes = Array.from(new Uint8Array(await audio.arrayBuffer())); if (!guard.current.current(token)) return; const result = await invoke<string>('assistant_transcribe', { bytes, fileName }); if (guard.current.current(token)) setTranscript(result); }); }}>{busy ? 'Transcrevendo…' : 'Transcrever · Groq'}</button><button type="button" disabled={busy} onClick={() => { setAudio(null); setTranscript(null); }}>Descartar áudio</button></div></div>}
   {transcript !== null && <div className="assistant-proposal"><label>Revisar transcrição{compact ? ` · ${fieldLabel}` : ''}<textarea rows={compact ? 2 : 4} value={transcript} onChange={event => setTranscript(event.target.value)}/></label><button type="button" disabled={!transcript.trim() || disabled} onClick={() => {
     if (compact && maxLength && [...appendDictation(text, transcript)].length > maxLength) { setError(`O campo aceita até ${maxLength} caracteres. Reduza a transcrição antes de inserir.`); return; }
     onInsert(transcript); setTranscript(null); setAudio(null); if (compact) setExpanded(false);
   }}>{compact ? `Inserir em ${fieldLabel}` : 'Inserir no campo'}</button></div>}
   {split && <div className="assistant-proposal"><div className="assistant-split-preview">{split.blocks.map((block, index) => <pre key={index}>{block}</pre>)}</div><div className="chart-toolbar compact"><button type="button" disabled={text !== sourceText} onClick={() => { onReplace?.(split.blocks.join('\n\n')); setSplit(null); }}>Usar divisões</button><button type="button" onClick={() => setSplit(null)}>Descartar sugestão</button>{text !== sourceText && <span>A letra mudou. Gere uma nova sugestão.</span>}</div></div>}
   </div>}
 </div>;
}
