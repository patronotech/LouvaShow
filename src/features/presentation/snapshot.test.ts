import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../shared/contracts';
import { newer } from './usePresentation';

function snapshot(revision: number, title = `Revisão ${revision}`): Snapshot {
  return {
    revision,
    title,
    blanked: true,
    songId: null,
    bible: null,
    blocks: [],
    blockIndex: 0,
    theme: {
      id: 'test-theme', name: 'Teste', fontFamily: 'sans-serif', fontSize: 60,
      textColor: '#ffffff', backgroundColor: '#000000', textAlign: 'center',
      verticalAlign: 'center', backgroundMediaId: null, overlayOpacity: 0,
      transitionType: 'none', transitionDurationMs: 0,
      textBox: { x: 7, y: 7, width: 86, height: 86 },
    },
  };
}

describe('coordenação dos snapshots da apresentação', () => {
  it('aceita a revisão inicial zero quando ainda não há estado', () => {
    const initial = snapshot(0);
    expect(newer(null, initial)).toBe(initial);
  });

  it('não substitui o estado por um evento antigo recebido fora de ordem', () => {
    const current = snapshot(7, 'Conteúdo ao vivo');
    expect(newer(current, snapshot(5, 'Conteúdo antigo'))).toBe(current);
  });

  it('ignora outra carga com a mesma revisão, preservando o estado aceito', () => {
    const current = snapshot(7, 'Estado aceito');
    expect(newer(current, snapshot(7, 'Carga duplicada divergente'))).toBe(current);
  });

  it('não deixa a busca inicial sobrescrever evento mais recente do listener', () => {
    const event = snapshot(3, 'Publicado durante a busca');
    const current = newer(null, event);
    const delayedInitialResponse = snapshot(2, 'Resposta inicial atrasada');
    expect(newer(current, delayedInitialResponse)).toBe(event);
  });

  it('aceita o snapshot completo mais recente incluindo apagar e restaurar', () => {
    const projected = { ...snapshot(10), blanked: false };
    const blanked = { ...snapshot(11), blanked: true };
    const restored = { ...snapshot(12), blanked: false };
    const result = [blanked, projected, restored, blanked].reduce(newer, projected);
    expect(result).toBe(restored);
    expect(result.blanked).toBe(false);
  });

  it('preserva a referência bíblica e as páginas ao receber uma música atrasada', () => {
    const bible: Snapshot = {
      ...snapshot(13, 'Livro de teste 1 · TESTE'),
      blanked: false,
      bible: { versionId: 'test', bookId: 'TST', chapter: 1, versionAbbreviation: 'TESTE', attribution: 'Conteúdo de teste' },
      blocks: [{ id: 'bible:test:TST:1:1:1', label: 'Livro de teste 1:1', text: 'Texto de teste.', position: 0 }],
    };
    const oldSong = { ...snapshot(12), songId: 'song' };
    expect(newer(bible, oldSong)).toBe(bible);
    expect(newer(bible, { ...bible, revision: 14, blanked: true }).blocks).toEqual(bible.blocks);
  });
});
