import { describe, expect, it } from 'vitest';
import { sectionNavigation, sectionAtScroll } from './sectionNavigation';
import type { ChartDocument } from './contracts';

describe('navegação das partes', () => {
  it('mantém refrões repetidos com identidade própria e rótulo atual', () => {
    const document = {
      sections: [{ id: 'v', label: 'Verso' }, { id: 'r', label: 'Refrão' }],
      sequence: [{ id: 'one', sectionId: 'v' }, { id: 'two', sectionId: 'r' }, { id: 'three', sectionId: 'r' }],
    } as ChartDocument;
    expect(sectionNavigation(document).map(value => [value.id, value.label])).toEqual([
      ['one', 'Verso'], ['two', 'Refrão'], ['three', 'Refrão'],
    ]);
  });
  it('acompanha a rolagem sem depender da altura ou tamanho da fonte', () => {
    expect(sectionAtScroll([100, 300, 500], 0)).toBe(0);
    expect(sectionAtScroll([100, 300, 500], 280)).toBe(1);
    expect(sectionAtScroll([100, 300, 500], 700)).toBe(2);
    expect(sectionAtScroll([100, 300, 500], 90)).toBe(0);
  });
});
