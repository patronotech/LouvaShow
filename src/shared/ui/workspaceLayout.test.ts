import { describe, expect, it } from 'vitest';
import {
  CENTER_MIN, DEFAULT_WORKSPACE_LAYOUT, PANE_MAX, WORKSPACE_STORAGE_PREFIX,
  dragWorkspaceResize, fitWorkspaceLayout, keyboardWorkspaceResize,
  parseWorkspaceLayout, readWorkspaceLayout, resetWorkspaceLayouts,
  resizeWorkspacePane, saveWorkspaceLayout, toggleWorkspacePane,
} from './workspaceLayout';
import type { WorkspaceLayout } from './workspaceLayout';

class MemoryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
const defaults = (): WorkspaceLayout => ({ ...DEFAULT_WORKSPACE_LAYOUT });

describe('preferências do workspace', () => {
  it('recupera configurações ausentes, malformadas, futuras ou não finitas', () => {
    for (const raw of [null, '', '{', 'null', '[]', '{}', '{"version":2}', JSON.stringify({ ...defaults(), leftWidth: '260' }), '{"version":1,"leftWidth":1e999,"rightWidth":340,"leftCollapsed":false,"rightCollapsed":false}']) {
      expect(parseWorkspaceLayout(raw)).toEqual(defaults());
    }
    const limited = parseWorkspaceLayout(JSON.stringify({ ...defaults(), leftWidth: -5, rightWidth: 1_000_000 }));
    expect(limited.leftWidth).toBe(200);
    expect(limited.rightWidth).toBe(PANE_MAX);
  });

  it('persiste dimensões e recolhimento separadamente para cada contexto', () => {
    const storage = new MemoryStorage();
    const live = { ...defaults(), leftWidth: 280, rightCollapsed: true };
    const settings = { ...defaults(), rightWidth: 420, leftCollapsed: true };
    expect(saveWorkspaceLayout('live', live, storage)).toBe(true);
    saveWorkspaceLayout('settings', settings, storage);
    expect(readWorkspaceLayout('live', storage)).toEqual(live);
    expect(readWorkspaceLayout('settings', storage)).toEqual(settings);
    expect(readWorkspaceLayout('songs', storage)).toEqual(defaults());
  });

  it('mantém operação quando o storage está indisponível ou lança exceção', () => {
    const denied = {
      get length(): number { throw Error('denied'); },
      key(): string | null { throw Error('denied'); },
      getItem(): string | null { throw Error('denied'); },
      setItem(): void { throw Error('denied'); },
      removeItem(): void { throw Error('denied'); },
    };
    expect(readWorkspaceLayout('live', denied)).toEqual(defaults());
    expect(saveWorkspaceLayout('live', defaults(), denied)).toBe(false);
    expect(resetWorkspaceLayouts(denied)).toBe(false);
    expect(saveWorkspaceLayout('live', defaults(), null)).toBe(false);
  });

  it('restaura apenas as preferências do workspace, preservando outras chaves', () => {
    const storage = new MemoryStorage();
    storage.setItem('another-setting', 'unchanged');
    saveWorkspaceLayout('live', defaults(), storage);
    saveWorkspaceLayout('settings', defaults(), storage);
    expect(storage.length).toBe(3);
    expect(resetWorkspaceLayouts(storage)).toBe(true);
    expect(storage.length).toBe(1);
    expect(storage.getItem('another-setting')).toBe('unchanged');
    expect(storage.key(0)?.startsWith(WORKSPACE_STORAGE_PREFIX)).toBe(false);
  });
});

describe('dimensionamento responsivo', () => {
  it('mantém tamanhos preferidos quando há espaço e reserva centro legível', () => {
    const wide = fitWorkspaceLayout(defaults(), 1360);
    expect(wide.leftWidth).toBe(260);
    expect(wide.rightWidth).toBe(340);
    expect(wide.centerWidth).toBe(744);
    const fitted = fitWorkspaceLayout(defaults(), 900);
    expect(fitted.leftCollapsed).toBe(false);
    expect(fitted.rightCollapsed).toBe(false);
    expect(fitted.leftWidth).toBeGreaterThanOrEqual(200);
    expect(fitted.rightWidth).toBeGreaterThanOrEqual(260);
    expect(fitted.centerWidth).toBeCloseTo(CENTER_MIN);
  });

  it('em 760px recolhe a esquerda e preserva a prévia sem perder preferências', () => {
    const preferred = { ...defaults(), leftWidth: 300, rightWidth: 360 };
    const narrow = fitWorkspaceLayout(preferred, 760);
    expect(narrow.leftCollapsed).toBe(true);
    expect(narrow.leftAutoCollapsed).toBe(true);
    expect(narrow.rightCollapsed).toBe(false);
    expect(narrow.leftWidth).toBe(34);
    expect(narrow.centerWidth).toBeGreaterThanOrEqual(CENTER_MIN);
    expect(preferred.leftCollapsed).toBe(false);
    const wide = fitWorkspaceLayout(preferred, 1360);
    expect(wide.leftWidth).toBe(300);
    expect(wide.rightWidth).toBe(360);
  });

  it('reabrir painel automático em 760px troca espaço com o lado oposto', () => {
    const opened = toggleWorkspacePane(defaults(), 'left', 760);
    const view = fitWorkspaceLayout(opened, 760);
    expect(view.leftCollapsed).toBe(false);
    expect(view.rightCollapsed).toBe(true);
    expect(view.leftWidth).toBe(260);
    const switchedBack = fitWorkspaceLayout(toggleWorkspacePane(opened, 'right', 760), 760);
    expect(switchedBack.leftCollapsed).toBe(true);
    expect(switchedBack.rightCollapsed).toBe(false);
  });

  it('não estoura o container em larguras extremas ou preferências grandes', () => {
    for (const width of [0, 20, 60, 100, 360, 404, 600, 630, 760, 796, 900, 1360, 2600]) {
      for (const leftCollapsed of [false, true]) for (const rightCollapsed of [false, true]) {
        const view = fitWorkspaceLayout({ ...defaults(), leftWidth: 960, rightWidth: 960, leftCollapsed, rightCollapsed }, width);
        expect(view.leftWidth + view.rightWidth + view.handleWidth * 2 + view.centerWidth).toBeCloseTo(width);
        expect(view.centerWidth).toBeGreaterThanOrEqual(0);
        if (width >= 404) expect(view.centerWidth + 0.0001).toBeGreaterThanOrEqual(CENTER_MIN);
      }
    }
  });

  it('redimensionamento explícito usa dimensões visíveis e não causa saltos', () => {
    const initial = fitWorkspaceLayout(defaults(), 900);
    const resized = resizeWorkspacePane(defaults(), 'left', 220, 900);
    const view = fitWorkspaceLayout(resized, 900);
    expect(view.leftWidth).toBeCloseTo(220);
    expect(view.rightWidth).toBeCloseTo(initial.rightWidth);
    expect(view.centerWidth).toBeGreaterThan(CENTER_MIN);
  });
});

describe('controles de teclado e arraste', () => {
  it('setas movem cada divisor na direção física correta', () => {
    expect(keyboardWorkspaceResize(defaults(), 'left', 'ArrowRight', 1360)?.leftWidth).toBe(276);
    expect(keyboardWorkspaceResize(defaults(), 'left', 'ArrowLeft', 1360)?.leftWidth).toBe(244);
    expect(keyboardWorkspaceResize(defaults(), 'right', 'ArrowRight', 1360)?.rightWidth).toBe(324);
    expect(keyboardWorkspaceResize(defaults(), 'right', 'ArrowLeft', 1360)?.rightWidth).toBe(356);
    expect(keyboardWorkspaceResize(defaults(), 'left', 'b', 1360)).toBeNull();
  });

  it('Home/End respeitam limites e Enter restaura a dimensão anterior', () => {
    const preferred = { ...defaults(), leftWidth: 310 };
    expect(keyboardWorkspaceResize(preferred, 'left', 'Home', 1360)?.leftWidth).toBe(200);
    const maximum = keyboardWorkspaceResize(preferred, 'left', 'End', 1360)!;
    expect(fitWorkspaceLayout(maximum, 1360).centerWidth).toBe(CENTER_MIN);
    const hidden = keyboardWorkspaceResize(preferred, 'left', 'Enter', 1360)!;
    expect(hidden.leftCollapsed).toBe(true);
    expect(hidden.leftWidth).toBe(310);
    const reopened = keyboardWorkspaceResize(hidden, 'left', 'Enter', 1360)!;
    expect(reopened.leftCollapsed).toBe(false);
    expect(reopened.leftWidth).toBe(310);
  });

  it('arraste até a borda recolhe sem substituir a largura de restauração', () => {
    const original = { ...defaults(), leftWidth: 310 };
    const collapsed = dragWorkspaceResize(original, original, 'left', 90, 1360);
    expect(collapsed.leftCollapsed).toBe(true);
    expect(collapsed.leftWidth).toBe(310);
    const movedBack = dragWorkspaceResize(original, original, 'left', 240, 1360);
    expect(movedBack.leftCollapsed).toBe(false);
    expect(movedBack.leftWidth).toBe(240);
    expect(original).toEqual({ ...defaults(), leftWidth: 310 });
  });
});
