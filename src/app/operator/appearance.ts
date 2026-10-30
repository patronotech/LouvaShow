import { useLayoutEffect, useState } from 'react';

import { appearanceVariables, interfaceThemes, type ColorMode } from './appearanceThemes';
export type { ColorMode } from './appearanceThemes';
export interface AppearancePreference { version: 1; colorMode: ColorMode }
export const APPEARANCE_STORAGE_KEY = 'louvashow.appearance.v1';

export function parseAppearancePreference(raw: string | null): AppearancePreference {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value === 'object' && value !== null && 'version' in value && value.version === 1 && 'colorMode' in value && (value.colorMode === 'classic' || value.colorMode === 'dark' || value.colorMode === 'light')) {
      return { version: 1, colorMode: value.colorMode };
    }
  } catch { /* A malformed local preference cannot prevent the operator from opening. */ }
  return { version: 1, colorMode: 'classic' };
}

function initialColorMode(): ColorMode {
  try { return parseAppearancePreference(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).colorMode; }
  catch { return 'classic'; }
}

/** Only the operator's document changes. Presentation themes and snapshots are untouched. */
export function useAppearance() {
  const [colorMode, setMode] = useState<ColorMode>(initialColorMode);
  const [appearanceError, setAppearanceError] = useState('');
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.colorMode = colorMode;
    root.style.colorScheme = interfaceThemes[colorMode].colorScheme;
    for (const [name, value] of Object.entries(appearanceVariables(colorMode))) root.style.setProperty(name, value);
  }, [colorMode]);

  function setColorMode(next: ColorMode) {
    setMode(next); setAppearanceError('');
    try { window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ version: 1, colorMode: next } satisfies AppearancePreference)); }
    catch { setAppearanceError('A aparência foi alterada nesta sessão, mas não foi possível guardar a preferência neste computador.'); }
  }
  return { colorMode, setColorMode, appearanceError };
}
