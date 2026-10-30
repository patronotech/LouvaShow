import type { BlockStyleOverride, PresentationBlock, Snapshot, Theme } from '../../shared/contracts';
import { copyTheme } from './textBox';
const overrideKeys = ['textBox','fontSize','fontFamily','textColor','textAlign','verticalAlign'] as const;
export function copyBlockStyle(style?: BlockStyleOverride | null): BlockStyleOverride | null {
  if(!style || style.version!==1)return null;
  return {...style,...(style.textBox?{textBox:{...style.textBox}}:{})};
}
export function resolveBlockTheme(base: Theme, style?: BlockStyleOverride | null): Theme {
  const result=copyTheme(base);
  if(!style || style.version!==1)return result;
  if(style.textBox)result.textBox={...style.textBox};
  if(style.fontSize!=null)result.fontSize=style.fontSize;
  if(style.fontFamily!=null)result.fontFamily=style.fontFamily;
  if(style.textColor!=null)result.textColor=style.textColor;
  if(style.textAlign!=null)result.textAlign=style.textAlign;
  if(style.verticalAlign!=null)result.verticalAlign=style.verticalAlign;
  return result;
}
export function hasBlockStyle(style?:BlockStyleOverride|null):boolean{return !!style&&style.version===1&&overrideKeys.some(key=>style[key]!=null);}
export function updateBlockStyle<K extends typeof overrideKeys[number]>(style:BlockStyleOverride|null,key:K,value:BlockStyleOverride[K]):BlockStyleOverride|null {
  const next={...(copyBlockStyle(style)||{version:1 as const}),[key]:value};
  if(value==null)delete next[key];
  return hasBlockStyle(next)?next:null;
}
export function blockStylePreview(songId:string,title:string,block:PresentationBlock,theme:Theme,style:BlockStyleOverride|null):Snapshot {
  return {revision:0,blanked:false,songId,bible:null,title,blockIndex:0,theme:copyTheme(theme),blocks:[{...block,styleOverride:copyBlockStyle(style)}]};
}
