import { useEffect, useRef, useState } from 'react';
import type { BlockStyleOverride, PresentationBlock, SaveBlockStyleResult, Theme } from '../../shared/contracts';
import { blockStylePreview, copyBlockStyle, hasBlockStyle, resolveBlockTheme, updateBlockStyle } from './blockStyle';
import { Slide, type SlideFit } from './Slide';
import { TextBoxEditor } from './TextBoxEditor';
import { numberInRange, validateThemeDraft } from './textBox';
import './blockStyleEditor.css';
export interface BlockStyleTarget {songId:string;title:string;block:PresentationBlock;theme:Theme}
export function BlockPaletteIcon(){return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.8h2a4 4 0 0 0 4-4A8 8 0 0 0 12 3Z"/><circle cx="7" cy="10" r="1"/><circle cx="10" cy="6.5" r="1"/><circle cx="15" cy="7" r="1"/></svg>;}
export function BlockStyleEditor({target,isLive,onSave,onClose}:{target:BlockStyleTarget;isLive:boolean;onSave:(style:BlockStyleOverride|null,applyToLive:boolean)=>Promise<SaveBlockStyleResult>;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);const locked=useRef(false);
 const [draft,setDraft]=useState(()=>copyBlockStyle(target.block.styleOverride));
 const [fontInput,setFontInput]=useState(String(resolveBlockTheme(target.theme,target.block.styleOverride).fontSize));
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [status,setStatus]=useState('');const [fit,setFit]=useState<SlideFit|null>(null);
 useEffect(()=>{const node=dialog.current;const previous=document.activeElement as HTMLElement|null;node?.showModal();return()=>{node?.close();if(previous?.isConnected)previous.focus();};},[]);
 const effective=resolveBlockTheme(target.theme,draft);const preview=blockStylePreview(target.songId,target.title,target.block,target.theme,draft);
 const invalid=numberInRange(fontInput,32,100)===null?'Use uma fonte entre 32 e 100.':validateThemeDraft(effective);
 const change=<K extends Exclude<keyof BlockStyleOverride,'version'>>(key:K,value:BlockStyleOverride[K])=>{setDraft(current=>updateBlockStyle(current,key,value));setStatus('');setError('');};
 const save=async(applyToLive:boolean)=>{if(locked.current||invalid)return;locked.current=true;setBusy(true);setError('');setStatus('');try{const result=await onSave(copyBlockStyle(draft),applyToLive);setStatus(result.appliedToLive?'Bloco salvo e aplicado à saída.':applyToLive?'Bloco salvo. A saída mudou; o bloco atual foi preservado.':'Bloco salvo. A saída ao vivo foi preservada.');}catch(reason){setError(String(reason));}finally{locked.current=false;setBusy(false);}};
 return <dialog ref={dialog} className="block-style-dialog" aria-labelledby="block-style-title" data-no-shortcuts onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <header><div><h2 id="block-style-title">Ajustar bloco</h2><span>{target.title} · {target.block.label||`Bloco ${target.block.position+1}`}</span></div><button aria-label="Fechar ajuste do bloco" title="Fechar" disabled={busy} onClick={onClose}>×</button></header>
  <fieldset disabled={busy}>
   <div className="block-style-fields"><label>Fonte<select value={draft?.fontFamily??''} onChange={event=>change('fontFamily',event.target.value||null)}><option value="">Padrão · {target.theme.fontFamily}</option>{['Arial','Georgia','Verdana'].map(font=><option key={font}>{font}</option>)}</select></label><label>Tamanho<input type="number" min="32" max="100" value={fontInput} onChange={event=>{setFontInput(event.target.value);const value=numberInRange(event.target.value,32,100);if(value!==null)change('fontSize',value);}}/></label><label>Cor<input type="color" value={effective.textColor} onChange={event=>change('textColor',event.target.value)}/></label><label>Alinhamento<select value={draft?.textAlign??''} onChange={event=>change('textAlign',(event.target.value||null) as BlockStyleOverride['textAlign'])}><option value="">Padrão global</option><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label><label>Vertical<select value={draft?.verticalAlign??''} onChange={event=>change('verticalAlign',(event.target.value||null) as BlockStyleOverride['verticalAlign'])}><option value="">Padrão global</option><option value="start">Superior</option><option value="center">Centro</option><option value="end">Inferior</option></select></label></div>
   <div className="block-style-preview-label"><span>Prévia do bloco</span><span>{hasBlockStyle(draft)?'Personalizado':'Padrão global'}</span></div>
   <TextBoxEditor box={effective.textBox} bible={false} disabled={busy} onChange={box=>change('textBox',box)}><Slide snapshot={preview} preview previewLabel="Prévia de ajuste do bloco, sem alterar a saída" onFit={setFit}/></TextBoxEditor>
   {fit&&fit.actualFontSize<fit.requestedFontSize&&<p className="block-style-fit" role="status">Fonte ajustada para caber: {fit.actualFontSize} (solicitada: {fit.requestedFontSize}).</p>}
   {fit?.overflow&&<p className="warning" role="status">O texto ainda não cabe. Amplie a caixa ou divida o bloco.</p>}
   <button className="block-style-reset" onClick={()=>{setDraft(null);setFontInput(String(target.theme.fontSize));setStatus('Padrão global na prévia. Salve para confirmar.');setError('');}}>Usar padrão global</button>
  </fieldset>
  {invalid&&<p className="warning" role="status">{invalid}</p>}{error&&<p className="error-message" role="alert">{error}</p>}{status&&<p className="block-style-status" role="status">{status}</p>}
  <footer><button disabled={busy} onClick={onClose}>Fechar</button><button disabled={busy||!!invalid} onClick={()=>void save(false)}>Salvar bloco</button>{isLive&&<button className="primary" disabled={busy||!!invalid} onClick={()=>void save(true)}>Salvar e aplicar ao vivo</button>}</footer>
 </dialog>;
}
