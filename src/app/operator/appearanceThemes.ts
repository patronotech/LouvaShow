export type ColorMode = 'classic' | 'light' | 'dark';
export interface InterfaceTheme {
 id: ColorMode; name: string; description: string; colorScheme: 'light' | 'dark';
 colors: Record<
  'bg'|'panel'|'canvas'|'raised'|'border'|'border-strong'|'text'|'muted'|'accent'|'accent-dark'|'accent-text'|'accent-hover'|'input'|'chrome'|'hover'|'focus'|'danger'|'success'|'warning'|'error'|'success-bg'|'success-border'|'error-bg'|'error-border'|'warning-bg'|'warning-border'|'selection-text'|'chord-chip'|'chord-ink'|'shadow'|'backdrop',string>;
}
export const interfaceThemes: Record<ColorMode,InterfaceTheme> = {
 classic: {id:'classic',name:'Clássico',description:'Cinza tradicional',colorScheme:'light',colors:{
  bg:'#cbd0d6',panel:'#e4e7eb',canvas:'#f7f8fa',raised:'#f1f3f5',border:'#a4adb8','border-strong':'#7e8b9a',text:'#202934',muted:'#4f5b68',accent:'#365e87','accent-dark':'#d5e3f1','accent-text':'#ffffff','accent-hover':'#294d73',input:'#ffffff',chrome:'#d4dae0',hover:'#dbe2e9',focus:'#1e5c9a',danger:'#992f3b',success:'#1c6637',warning:'#74500c',error:'#992f3b','success-bg':'#dceee3','success-border':'#6b9d7c','error-bg':'#f7e3e5','error-border':'#b77b84','warning-bg':'#f5ebd4','warning-border':'#b69a63','selection-text':'#254d76','chord-chip':'#d5e3f1','chord-ink':'#234b74',shadow:'#24344724',backdrop:'#28364470',
 }},
 light: {id:'light',name:'Claro',description:'Cinza e azul suave',colorScheme:'light',colors:{
  bg:'#edf2f7',panel:'#f8fafc',canvas:'#ffffff',raised:'#e8eff6',border:'#c4d2df','border-strong':'#7d90a3',text:'#223447',muted:'#566b7f',accent:'#33668d','accent-dark':'#e2eff9','accent-text':'#ffffff','accent-hover':'#254f72',input:'#ffffff',chrome:'#e5edf5',hover:'#dce8f3',focus:'#245e92',danger:'#a03642',success:'#246a42',warning:'#79520d',error:'#a03642','success-bg':'#e5f3eb','success-border':'#70a58a','error-bg':'#fcedef','error-border':'#c48892','warning-bg':'#fff3dc','warning-border':'#c3a065','selection-text':'#2b5b81','chord-chip':'#e2eff9','chord-ink':'#27577f',shadow:'#25405d1c',backdrop:'#263e5866',
 }},
 dark: {id:'dark',name:'Escuro',description:'Ardósia e violeta',colorScheme:'dark',colors:{
  bg:'#101827',panel:'#1c293b',canvas:'#152133',raised:'#293b52',border:'#40556e','border-strong':'#60758e',text:'#e8edf5',muted:'#adbcd0',accent:'#b6a0f1','accent-dark':'#393953','accent-text':'#171426','accent-hover':'#c9b7fa',input:'#101b2a',chrome:'#25354a',hover:'#354b65',focus:'#c6b4ff',danger:'#ffc2c4',success:'#b5e5c5',warning:'#f0d69d',error:'#ffc2c4','success-bg':'#183e30','success-border':'#5d9777','error-bg':'#482f3b','error-border':'#aa6c80','warning-bg':'#473c29','warning-border':'#a58a54','selection-text':'#dbccff','chord-chip':'#393953','chord-ink':'#e0d3ff',shadow:'#050b1780',backdrop:'#050b17aa',
 }},
};
export const appearanceOrder: ColorMode[] = ['classic','light','dark'];
export function appearanceVariables(mode:ColorMode): Record<string,string> {
 return Object.fromEntries(Object.entries(interfaceThemes[mode].colors).map(([name,value])=>[`--${name}`,value]));
}
