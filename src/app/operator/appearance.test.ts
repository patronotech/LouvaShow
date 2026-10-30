import { describe, expect, it } from 'vitest';
import { interfaceThemes, appearanceVariables } from './appearanceThemes';
import { parseAppearancePreference } from './appearance';

describe('preferência local de aparência', () => {
  it('preserva claro e escuro no esquema conhecido, sem aceitar campos extras', () => {
    expect(parseAppearancePreference('{"version":1,"colorMode":"light","extra":"ignored"}')).toEqual({ version: 1, colorMode: 'light' });
    expect(parseAppearancePreference('{"version":1,"colorMode":"dark"}')).toEqual({ version: 1, colorMode: 'dark' });
  });
  it('usa clássico como padrão para dados ausentes, inválidos ou de versão desconhecida', () => {
    for (const raw of [null, '', 'null', '[]', 'true', 'malformed', '{"version":2,"colorMode":"light"}', '{"version":1,"colorMode":"unexpected"}', '{"colorMode":"light"}']) {
      expect(parseAppearancePreference(raw)).toEqual({ version: 1, colorMode: 'classic' });
    }
  });
});

function luminance(color:string):number {const channels=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4);return channels[0]!*0.2126+channels[1]!*0.7152+channels[2]!*0.0722;}
function contrast(a:string,b:string):number{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]!+0.05)/(values[1]!+0.05);}
describe('três temas da interface',()=>{
 it('aceita uma escolha clássica explícita sem migrar escolhas anteriores',()=>{expect(parseAppearancePreference('{"version":1,"colorMode":"classic"}')).toEqual({version:1,colorMode:'classic'});for(const mode of ['light','dark'])expect(parseAppearancePreference(JSON.stringify({version:1,colorMode:mode})).colorMode).toBe(mode);});
 it('fornece os mesmos tokens e superfícies distintas para todos os modos',()=>{const names=Object.keys(appearanceVariables('classic')).sort();for(const theme of Object.values(interfaceThemes)){expect(Object.keys(appearanceVariables(theme.id)).sort()).toEqual(names);expect(new Set([theme.colors.bg,theme.colors.panel,theme.colors.canvas,theme.colors.chrome]).size).toBe(4);}});
 it('mantém texto e controles principais com contraste WCAG AA',()=>{for(const theme of Object.values(interfaceThemes)){const colors=theme.colors;for(const surface of ['panel','canvas','raised','input','chrome'] as const){expect(contrast(colors.text,colors[surface]),`${theme.id} texto/${surface}`).toBeGreaterThanOrEqual(4.5);expect(contrast(colors.muted,colors[surface]),`${theme.id} secundário/${surface}`).toBeGreaterThanOrEqual(4.5);}expect(contrast(colors['border-strong'],colors.input),`${theme.id} borda de campo`).toBeGreaterThanOrEqual(3);expect(contrast(colors['accent-text'],colors.accent),`${theme.id} botão principal`).toBeGreaterThanOrEqual(4.5);expect(contrast(colors['chord-ink'],colors['chord-chip']),`${theme.id} acorde`).toBeGreaterThanOrEqual(4.5);for(const state of ['success','warning','error'] as const)expect(contrast(colors[state],colors[`${state}-bg`]),`${theme.id} ${state}`).toBeGreaterThanOrEqual(4.5);}});
});
