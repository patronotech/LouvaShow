import { describe, expect, it } from 'vitest';
import type { Snapshot, TextBox, Theme } from '../../shared/contracts';
import { copyTheme, createDraftSnapshot, DEFAULT_TEXT_BOX, effectiveTextBox, fitFontSize, numberInRange, transformTextBox, validTextBox, validateThemeDraft, type BoxHandle } from './textBox';

const theme: Theme = { id: 'default', name: 'Padrão', fontFamily: 'Arial', fontSize: 64, textColor: '#ffffff', backgroundColor: '#000000', textAlign: 'center', verticalAlign: 'center', backgroundMediaId: null, overlayOpacity: 0, transitionType: 'none', transitionDurationMs: 120, textBox: { ...DEFAULT_TEXT_BOX } };
const live: Snapshot = { revision: 12, blanked: true, songId: 'song', bible: null, title: 'Demonstração', blocks: [{ id: 'block', label: 'Abertura', text: 'Uma comunidade reunida', position: 0 }], blockIndex: 0, theme };

describe('limites da caixa de texto', () => {
  it('mantém a caixa musical e reserva o rodapé bíblico sem alterar o original', () => {
    expect(effectiveTextBox(DEFAULT_TEXT_BOX)).toEqual(DEFAULT_TEXT_BOX);
    expect(effectiveTextBox(DEFAULT_TEXT_BOX, true)).toEqual({ x: 7, y: 7, width: 86, height: 74 });
    const low = { x: 0, y: 80, width: 100, height: 20 };
    expect(effectiveTextBox(low, true)).toEqual({ x: 0, y: 71, width: 100, height: 10 });
    expect(low.y).toBe(80);
  });
  it('rejeita dimensões inválidas, não finitas e valores que saem da tela', () => {
    for (const box of [{ ...DEFAULT_TEXT_BOX, x: -1 }, { ...DEFAULT_TEXT_BOX, width: 9 }, { ...DEFAULT_TEXT_BOX, y: 30 }, { ...DEFAULT_TEXT_BOX, width: NaN }, { ...DEFAULT_TEXT_BOX, height: Infinity }]) expect(validTextBox(box)).toBe(false);
  });
  it('move sem mudar tamanho e trava nos limites do canvas ou da referência bíblica', () => {
    expect(transformTextBox(DEFAULT_TEXT_BOX, 'move', 1000, -1000)).toEqual({ x: 14, y: 0, width: 86, height: 86 });
    expect(transformTextBox(DEFAULT_TEXT_BOX, 'move', 1000, 1000, true)).toEqual({ x: 14, y: 7, width: 86, height: 74 });
  });
  it('mantém a borda oposta ao redimensionar e impede inverter a caixa', () => {
    const initial = { x: 20, y: 20, width: 40, height: 30 };
    expect(transformTextBox(initial, 'nw', 100, 100)).toEqual({ x: 50, y: 40, width: 10, height: 10 });
    expect(transformTextBox(initial, 'se', -100, -100)).toEqual({ x: 20, y: 20, width: 10, height: 10 });
    expect(transformTextBox(initial, 'se', 100, 100, true)).toEqual({ x: 20, y: 20, width: 80, height: 61 });
    expect(initial).toEqual({ x: 20, y: 20, width: 40, height: 30 });
  });
  it('preserva mínimos e limites em todos os lados, inclusive deltas fracionários extremos', () => {
    const handles: BoxHandle[] = ['move', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
    const boxes: TextBox[] = [DEFAULT_TEXT_BOX, { x: 9.75, y: 20.5, width: 30.25, height: 49.5 }, { x: 90, y: 90, width: 10, height: 10 }];
    for (const box of boxes) for (const bible of [false, true]) for (const handle of handles) for (const dx of [-1000, -5.333, 0, 2.719, 1000]) for (const dy of [-1000, -5.333, 0, 2.719, 1000]) {
      const result = transformTextBox(box, handle, dx, dy, bible);
      expect(validTextBox(result)).toBe(true);
      expect(result.y + result.height).toBeLessThanOrEqual(bible ? 81 : 100);
    }
  });
});

describe('rascunho independente e encaixe de fonte', () => {
  it('edita uma cópia e permite restaurar a caixa original sem alterar a saída apagada', () => {
    const draft = copyTheme(theme);
    const original = { ...draft.textBox };
    draft.textBox = transformTextBox(draft.textBox, 'se', -30, -30);
    draft.fontSize = 90; draft.textColor = '#ff0000';
    const preview = createDraftSnapshot(live, draft);
    expect(preview.blanked).toBe(false); expect(preview.theme.fontSize).toBe(90);
    expect(preview.blocks[0].text).toBe(live.blocks[0].text);
    expect(live.blanked).toBe(true); expect(live.revision).toBe(12);
    expect(live.theme.fontSize).toBe(64); expect(live.theme.textColor).toBe('#ffffff');
    draft.textBox = original;
    expect(draft.textBox).toEqual(theme.textBox);
    expect(copyTheme(theme).textBox).not.toBe(theme.textBox);
  });
  it('gera texto próprio quando a sessão ainda não tem conteúdo', () => {
    const preview = createDraftSnapshot(null, theme);
    expect(preview.blocks.length).toBe(1); expect(preview.blocks[0].text.length).toBeGreaterThan(0);
    expect(preview.bible).toBeNull(); expect(preview.blanked).toBe(false);
  });
  it('nunca reduz abaixo de 32 e avisa quando não couber nem no mínimo', () => {
    expect(fitFontSize(64, size => size <= 48)).toEqual({ fontSize: 48, overflow: false });
    expect(fitFontSize(64.5, size => size <= 32)).toEqual({ fontSize: 32, overflow: false });
    expect(fitFontSize(100, () => false)).toEqual({ fontSize: 32, overflow: true });
  });
  it('não aceita campo numérico vazio/NaN nem transições além do limite nativo', () => {
    for (const raw of ['', ' ', 'NaN', 'Infinity', '31', '101']) expect(numberInRange(raw, 32, 100)).toBeNull();
    expect(numberInRange('64.5', 32, 100)).toBe(64.5);
    expect(validateThemeDraft({ ...theme, fontSize: NaN })).not.toBeNull();
    expect(validateThemeDraft({ ...theme, transitionDurationMs: 501 })).not.toBeNull();
    expect(validateThemeDraft(theme)).toBeNull();
  });
});
