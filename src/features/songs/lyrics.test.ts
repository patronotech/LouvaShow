import { describe, expect, it } from 'vitest';
import { moveItem, searchKey, splitLyrics } from './lyrics';

describe('letras e repertório', () => {
  it('separa linhas vazias, preserva acentos e quebras internas', () => {
    expect(splitLyrics('  Canção\r\nCoração\r\n \t\r\n\r\nRefrão\nMais uma linha\n\n')).toEqual(['Canção\nCoração', 'Refrão\nMais uma linha']);
    expect(splitLyrics('\n  \n\n')).toEqual([]);
  });
  it('encontra títulos sem diferenciar acentos e maiúsculas', () => {
    expect(searchKey('CORAÇÃO')).toBe(searchKey('coracao'));
  });
  it('reordena por identidade do item com músicas repetidas', () => {
    const items = [{ id: 'first', songId: 'same' }, { id: 'second', songId: 'other' }, { id: 'third', songId: 'same' }];
    expect(moveItem(items, 'third', 0).map(item => item.id)).toEqual(['third', 'first', 'second']);
    expect(items.map(item => item.id)).toEqual(['first', 'second', 'third']);
    expect(moveItem(items, 'unknown', 0)).toEqual(items);
    expect(moveItem(items, 'first', -1)).toEqual(items);
  });
});
