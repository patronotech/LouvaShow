import { describe, expect, it } from 'vitest';
import { parseAppearancePreference } from './appearance';

describe('preferência local de aparência', () => {
  it('preserva claro e escuro no esquema conhecido, sem aceitar campos extras', () => {
    expect(parseAppearancePreference('{"version":1,"colorMode":"light","extra":"ignored"}')).toEqual({ version: 1, colorMode: 'light' });
    expect(parseAppearancePreference('{"version":1,"colorMode":"dark"}')).toEqual({ version: 1, colorMode: 'dark' });
  });
  it('volta ao escuro para dados ausentes, inválidos ou de versão desconhecida', () => {
    for (const raw of [null, '', 'null', '[]', 'true', 'malformed', '{"version":2,"colorMode":"light"}', '{"version":1,"colorMode":"unexpected"}', '{"colorMode":"light"}']) {
      expect(parseAppearancePreference(raw)).toEqual({ version: 1, colorMode: 'dark' });
    }
  });
});
