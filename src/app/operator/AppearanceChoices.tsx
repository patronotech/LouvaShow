import type { CSSProperties } from 'react';
import { appearanceOrder, appearanceVariables, interfaceThemes, type ColorMode } from './appearanceThemes';
export function AppearanceChoices({value,onChange}:{value:ColorMode;onChange:(mode:ColorMode)=>void}){
 return <div className="appearance-options" role="group" aria-label="Tema da interface">{appearanceOrder.map(mode=>{
  const theme=interfaceThemes[mode];
  return <button type="button" key={mode} className="appearance-choice" aria-pressed={value===mode} aria-label={theme.name} onClick={()=>onChange(mode)}><span className="appearance-preview" style={appearanceVariables(mode) as CSSProperties} aria-hidden="true"><span className="appearance-preview-toolbar"><i/><i/><i/></span><span className="appearance-preview-layout"><span className="appearance-preview-sidebar"><i/><i/><i/></span><span className="appearance-preview-canvas"><i/><i/><i/></span><span className="appearance-preview-output"><i/></span></span></span><span className="appearance-choice-title"><strong>{theme.name}</strong>{value===mode?<span aria-hidden="true">✓</span>:mode==='classic'?<span className="appearance-default">Padrão</span>:null}</span><span className="appearance-description">{theme.description}</span></button>;
 })}</div>;
}
