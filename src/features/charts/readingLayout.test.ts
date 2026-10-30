import { describe, expect, it } from 'vitest';
import { readingChordRows } from './readingLayout';

describe('leitura sem colisão de acordes', () => {
  it('empilha acordes na mesma âncora sem deslocar a frase', () => {
    expect(readingChordRows([
      { left: 0, top: 0, width: 65 }, { left: 0, top: 0, width: 30 },
      { left: 90, top: 0, width: 40 },
    ])).toEqual([0, 1, 0]);
  });
  it('considera a largura real de um acorde e recomeça numa linha quebrada', () => {
    expect(readingChordRows([
      { left: 12, top: 0, width: 80 }, { left: 40, top: 0, width: 20 },
      { left: 0, top: 72, width: 40 }, { left: 60, top: 72, width: 20 },
    ])).toEqual([0, 1, 0, 0]);
  });
});
