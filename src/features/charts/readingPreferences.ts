export interface ViewSettings {
  fontSize: number; fontFamily: string; fontWeight: number;
  chordFontSize: number; chordFontWeight: number; chordGap: number;
  textColor: string; chordColor: string; backgroundColor: string;
  sectionFontFamily: string; sectionFontSize: number; sectionColor: string;
  sectionTitleGap: number; sectionGap: number; lineGap: number;
}
export const readingPresets = [
  { id: 'dark', name: 'Escuro', textColor: '#f1f3f8', chordColor: '#f4aa64', sectionColor: '#f1f3f8', backgroundColor: '#191d28' },
  { id: 'light', name: 'Claro', textColor: '#29313b', chordColor: '#c25300', sectionColor: '#15191f', backgroundColor: '#ffffff' },
  { id: 'contrast', name: 'Contraste', textColor: '#ffffff', chordColor: '#ffeb55', sectionColor: '#ffffff', backgroundColor: '#000000' },
] as const;
export const readingDefaults: ViewSettings = { fontSize: 22, fontFamily: 'system-ui', fontWeight: 400, chordFontSize: 19, chordFontWeight: 700, chordGap: 4, sectionFontFamily:'system-ui', sectionFontSize:16, sectionColor:readingPresets[1].sectionColor, sectionTitleGap:8, sectionGap:24, lineGap:0, textColor: readingPresets[1].textColor, chordColor: readingPresets[1].chordColor, backgroundColor: readingPresets[1].backgroundColor };
const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const weight = (value: unknown, fallback: number) => typeof value === 'number' && [400,500,600,700,800].includes(value) ? value : fallback;
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
export function parseReadingSettings(raw: string | null): ViewSettings {
  let data: Record<string, unknown>;
  try { const parsed: unknown = JSON.parse(raw || '{}'); data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { data = {}; }
  if (data.version === 1 && data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) data = data.settings as Record<string, unknown>;
  const backgroundColor=color(data.backgroundColor,readingDefaults.backgroundColor);
  const brightness=[1,3,5].map((offset,index)=>parseInt(backgroundColor.slice(offset,offset+2),16)*[.2126,.7152,.0722][index]!).reduce((a,b)=>a+b,0);
  const fontSize = bounded(data.fontSize, readingDefaults.fontSize, 14, 48);
  return {
    fontSize, fontFamily: ['system-ui','Georgia, serif','monospace'].includes(String(data.fontFamily)) ? String(data.fontFamily) : readingDefaults.fontFamily,
    fontWeight: weight(data.fontWeight, 400), chordFontWeight: weight(data.chordFontWeight, 700),
    chordFontSize: bounded(data.chordFontSize, typeof data.fontSize === 'number' ? fontSize * .85 : 19, 10, 48),
    chordGap: bounded(data.chordGap, 4, -24, 32),
    sectionFontFamily: ['system-ui','Georgia, serif','monospace'].includes(String(data.sectionFontFamily))?String(data.sectionFontFamily):['system-ui','Georgia, serif','monospace'].includes(String(data.fontFamily))?String(data.fontFamily):'system-ui',
    sectionFontSize:bounded(data.sectionFontSize,16,10,36),sectionColor:color(data.sectionColor,brightness>140?'#15191f':'#ffffff'),
    sectionTitleGap:bounded(data.sectionTitleGap,8,0,64),sectionGap:bounded(data.sectionGap,24,0,96),lineGap:bounded(data.lineGap,0,0,64),
    textColor: color(data.textColor, readingDefaults.textColor), chordColor: color(data.chordColor, readingDefaults.chordColor), backgroundColor,
  };
}
export function applyReadingPreset(settings: ViewSettings, preset: typeof readingPresets[number]): ViewSettings {
  return { ...settings, textColor: preset.textColor, chordColor: preset.chordColor, backgroundColor: preset.backgroundColor, sectionColor:preset.sectionColor };
}
export function activeReadingPreset(settings: ViewSettings): string | null {
  return readingPresets.find(preset => preset.textColor.toLowerCase() === settings.textColor.toLowerCase() && preset.chordColor.toLowerCase() === settings.chordColor.toLowerCase() && preset.backgroundColor.toLowerCase() === settings.backgroundColor.toLowerCase() && preset.sectionColor.toLowerCase() === settings.sectionColor.toLowerCase())?.id || null;
}
export function readingSettingsKey(ownerId: string, pane: number): string { return `louvashow:musician:profile:${encodeURIComponent(ownerId)}:pane:${pane}`; }
export interface ReadingPreferences { version: 1; settings: ViewSettings; custom: ViewSettings | null }
export function parseReadingPreferences(raw: string | null, legacyCustom: string | null = null): ReadingPreferences {
  const settings = parseReadingSettings(raw);
  let parsed: unknown;
  try { parsed = JSON.parse(raw || 'null'); } catch { parsed = null; }
  if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1 && 'settings' in parsed) {
    const custom = 'custom' in parsed && parsed.custom && typeof parsed.custom === 'object' && !Array.isArray(parsed.custom) ? parseReadingSettings(JSON.stringify(parsed.custom)) : null;
    const oldLight=settings.textColor.toLowerCase()==='#29313b'&&settings.chordColor.toLowerCase()==='#a94a17'&&settings.backgroundColor.toLowerCase()==='#ffffff';
    return {version:1,settings:!custom&&oldLight?applyReadingPreset(settings,readingPresets[1]):settings,custom};
  }
  return {version:1,settings,custom:legacyCustom ? parseReadingSettings(legacyCustom) : activeReadingPreset(settings) ? null : settings};
}
export function persistReadingPreferences(storage: Pick<Storage, 'setItem'>, key: string, settings: ViewSettings, custom: ViewSettings | null): void {
  storage.setItem(key, JSON.stringify({version:1,settings,custom} satisfies ReadingPreferences));
}
