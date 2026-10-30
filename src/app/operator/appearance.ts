import { useLayoutEffect, useState } from 'react';

export type ColorMode = 'dark' | 'light';
export interface AppearancePreference { version: 1; colorMode: ColorMode }
export const APPEARANCE_STORAGE_KEY = 'louvashow.appearance.v1';

export function parseAppearancePreference(raw: string | null): AppearancePreference {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value === 'object' && value !== null && 'version' in value && value.version === 1 && 'colorMode' in value && (value.colorMode === 'dark' || value.colorMode === 'light')) {
      return { version: 1, colorMode: value.colorMode };
    }
  } catch { /* A malformed local preference cannot prevent the operator from opening. */ }
  return { version: 1, colorMode: 'dark' };
}

function initialColorMode(): ColorMode {
  try { return parseAppearancePreference(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).colorMode; }
  catch { return 'dark'; }
}

/** Only the operator's document changes. Presentation themes and snapshots are untouched. */
export function useAppearance() {
  const [colorMode, setMode] = useState<ColorMode>(initialColorMode);
  const [appearanceError, setAppearanceError] = useState('');
  useLayoutEffect(() => { document.documentElement.dataset.colorMode = colorMode; }, [colorMode]);

  function setColorMode(next: ColorMode) {
    setMode(next); setAppearanceError('');
    try { window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ version: 1, colorMode: next } satisfies AppearancePreference)); }
    catch { setAppearanceError('A aparência foi alterada nesta sessão, mas não foi possível guardar a preferência neste computador.'); }
  }
  return { colorMode, setColorMode, appearanceError };
}
