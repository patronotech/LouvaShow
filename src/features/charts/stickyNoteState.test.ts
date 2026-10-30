import { describe, expect, it } from 'vitest';
import { moveStickyNote, parseStickyNoteLayout } from './stickyNoteState';

describe('post-it de uma cifra', () => {
  it('não abre um campo vazio na leitura e preserva notas antigas', () => {
    expect(parseStickyNoteLayout(null, false).visible).toBe(false);
    expect(parseStickyNoteLayout(null, true).visible).toBe(true);
  });
  it('guarda ocultar e minimizar sem eliminar o texto', () => {
    const layout = parseStickyNoteLayout(JSON.stringify({ version: 1, x: 30, y: 20, visible: false, collapsed: true }), true);
    expect(layout).toEqual({ version: 1, x: 30, y: 20, visible: false, collapsed: true });
  });
  it('limita o arraste à área do painel inclusive quando ele é menor que a nota', () => {
    expect(moveStickyNote(900, -10, 800, 600, 250, 180)).toEqual({ x: 68.75, y: 0 });
    expect(moveStickyNote(100, 100, 200, 100, 250, 180)).toEqual({ x: 0, y: 0 });
  });
  it('recupera preferências corrompidas sem esconder uma nota existente', () => {
    expect(parseStickyNoteLayout('{', true).visible).toBe(true);
    expect(parseStickyNoteLayout('{"version":1,"x":999,"y":-20}', false)).toMatchObject({ x: 100, y: 0 });
  });
});
