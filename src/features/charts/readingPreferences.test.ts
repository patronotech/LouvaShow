import { describe, expect, it } from 'vitest';
import { activeReadingPreset, applyReadingPreset, parseReadingSettings, readingDefaults, readingPresets, readingSettingsKey, parseReadingPreferences, persistReadingPreferences } from './readingPreferences';

function contrastRatio(foreground: string, background: string): number {
 const luminance = (hex: string) => {
  const channels = [1,3,5].map(index => parseInt(hex.slice(index,index+2),16)/255)
   .map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return channels[0]!* .2126 + channels[1]!* .7152 + channels[2]!* .0722;
 };
 const light = luminance(foreground); const dark = luminance(background);
 return (Math.max(light,dark)+.05)/(Math.min(light,dark)+.05);
}

describe('preferências de leitura', () => {
  it('começa em claro com letra grafite e acorde laranja vivo somente quando não há preferência', () => {
    expect(activeReadingPreset(parseReadingSettings(null))).toBe('light');
    expect(readingDefaults).toMatchObject({textColor:'#29313b',chordColor:'#c25300',backgroundColor:'#ffffff'});
  });
  it('mantém contraste de texto normal para letra e acordes nas três paletas', () => {
    for (const preset of readingPresets) {
      expect(contrastRatio(preset.textColor,preset.backgroundColor), `${preset.id}: letra`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.chordColor,preset.backgroundColor), `${preset.id}: acordes`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(preset.sectionColor,preset.backgroundColor), `${preset.id}: títulos`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('preserva inclusive as paletas antigas e personalizadas já salvas', () => {
    const oldDark={...readingDefaults,textColor:'#f1f3f8',chordColor:'#c4adff',backgroundColor:'#191d28'};
    const custom={...readingDefaults,textColor:'#abcdef',chordColor:'#123456',backgroundColor:'#101010'};
    expect(parseReadingSettings(JSON.stringify(oldDark))).toEqual(oldDark);
    const saved=JSON.stringify({version:1,settings:oldDark,custom});
    expect(parseReadingPreferences(saved)).toEqual({version:1,settings:oldDark,custom});
    expect(parseReadingPreferences(JSON.stringify(oldDark)).custom).toEqual(oldDark);
  });
  it('migra tamanho antigo sem apagar cores personalizadas', () => { const result = parseReadingSettings(JSON.stringify({fontSize:30,textColor:'#abcdef',chordColor:'#123456',backgroundColor:'#000001'})); expect(result.chordFontSize).toBe(25.5); expect(result.textColor).toBe('#abcdef'); expect(result.fontWeight).toBe(400); expect(result.chordFontWeight).toBe(700); expect(result.chordGap).toBe(4); });
  it('valida dados corrompidos e limita controles', () => { expect(parseReadingSettings('null')).toEqual(parseReadingSettings('{')); const result = parseReadingSettings(JSON.stringify({fontSize:999,chordFontSize:-3,chordGap:100,fontWeight:50,textColor:'url(x)'})); expect(result.fontSize).toBe(48); expect(result.chordFontSize).toBe(10); expect(result.chordGap).toBe(32); expect(result.fontWeight).toBe(400); expect(result.textColor).toBe(readingDefaults.textColor); });
  it('trocar preset preserva tipografia e não modifica draft original', () => { const original={...readingDefaults,fontSize:35,chordFontSize:28,chordGap:16}; const result=applyReadingPreset(original,readingPresets[1]); expect(result.fontSize).toBe(35); expect(result.chordGap).toBe(16); expect(result.chordFontSize).toBe(28); expect(activeReadingPreset(result)).toBe('light'); expect(original.backgroundColor).toBe(readingDefaults.backgroundColor); });
  it('isola definições entre membros e painéis', () => { expect(readingSettingsKey('a',1)).not.toBe(readingSettingsKey('b',1)); expect(readingSettingsKey('a',1)).not.toBe(readingSettingsKey('a',2)); });
  it('reconhece paleta personalizada sem convertê-la em preset', () => { expect(activeReadingPreset({...readingDefaults,chordColor:'#abcdef'})).toBeNull(); });
});

describe('gravação atômica das preferências',()=>{
 it('grava tema ativo e personalizado com uma única escrita',()=>{const calls:string[]=[];const custom={...readingDefaults,textColor:'#abcdef'};persistReadingPreferences({setItem:(_key,value)=>{calls.push(value);}},'pane',readingDefaults,custom);expect(calls).toHaveLength(1);expect(parseReadingPreferences(calls[0]).custom).toEqual(custom);expect(parseReadingSettings(calls[0])).toEqual(readingDefaults);});
 it('preserva toda a configuração anterior quando armazenamento rejeita escrita',()=>{let stored=JSON.stringify({version:1,settings:readingDefaults,custom:null});const before=stored;const storage={setItem:(_key:string,_value:string)=>{throw new Error('quota');}};expect(()=>persistReadingPreferences(storage,'pane',{...readingDefaults,fontSize:40},readingDefaults)).toThrow('quota');expect(stored).toBe(before);expect(parseReadingPreferences(stored).settings.fontSize).toBe(22);});
 it('migra dados planos e a definição antiga, sem reviver chave antiga após envelope novo',()=>{const custom={...readingDefaults,textColor:'#abcdef'};expect(parseReadingPreferences(JSON.stringify(readingDefaults),JSON.stringify(custom)).custom).toEqual(custom);const envelope=JSON.stringify({version:1,settings:readingDefaults,custom:null});expect(parseReadingPreferences(envelope,JSON.stringify(custom)).custom).toBeNull();});
});

describe('títulos e espaços independentes',()=>{
 it('preenche títulos legíveis em preferências antigas claras, escuras e contraste',()=>{for(const backgroundColor of ['#ffffff','#191d28','#000000']){const settings=parseReadingSettings(JSON.stringify({fontSize:30,fontFamily:'Georgia, serif',chordGap:12,backgroundColor}));expect(settings.fontSize).toBe(30);expect(settings.chordGap).toBe(12);expect(settings.sectionFontFamily).toBe('Georgia, serif');expect(settings.sectionFontSize).toBe(16);expect(contrastRatio(settings.sectionColor,backgroundColor)).toBeGreaterThanOrEqual(4.5);}});
 it('limita espaçamentos e permite negativo no acorde sem tocar tamanho da letra',()=>{const settings=parseReadingSettings(JSON.stringify({fontSize:24,chordGap:-99,sectionFontSize:100,sectionTitleGap:-2,sectionGap:999,lineGap:999}));expect(settings).toMatchObject({fontSize:24,chordGap:-24,sectionFontSize:36,sectionTitleGap:0,sectionGap:96,lineGap:64});expect(parseReadingSettings(JSON.stringify({...settings,chordGap:-7})).chordGap).toBe(-7);});
 it('salva todos os novos campos atomicamente e preserva personalizado ao trocar paleta',()=>{const custom={...readingDefaults,sectionFontFamily:'monospace',sectionFontSize:21,sectionColor:'#654321',sectionTitleGap:3,sectionGap:17,lineGap:9,chordGap:-12};const next=applyReadingPreset(custom,readingPresets[0]);expect(next).toMatchObject({sectionFontFamily:'monospace',sectionFontSize:21,sectionColor:readingPresets[0].sectionColor,sectionTitleGap:3,sectionGap:17,lineGap:9,chordGap:-12});const stored:string[]=[];persistReadingPreferences({setItem:(_key,value)=>stored.push(value)},'pane',next,custom);expect(parseReadingPreferences(stored[0])).toEqual({version:1,settings:next,custom});expect(custom.sectionColor).toBe('#654321');});
 it('atualiza Claro antigo somente quando envelope comprova ausência de personalizado',()=>{const old={fontSize:30,chordGap:12,textColor:'#29313b',chordColor:'#a94a17',backgroundColor:'#ffffff'};const migrated=parseReadingPreferences(JSON.stringify({version:1,settings:old,custom:null}));expect(migrated.settings).toMatchObject({fontSize:30,chordGap:12,chordColor:'#c25300',sectionColor:'#15191f'});const preserved=parseReadingPreferences(JSON.stringify({version:1,settings:old,custom:old}));expect(preserved.settings.chordColor).toBe('#a94a17');expect(preserved.custom!.chordColor).toBe('#a94a17');expect(parseReadingPreferences(JSON.stringify(old)).settings.chordColor).toBe('#a94a17');});
});
