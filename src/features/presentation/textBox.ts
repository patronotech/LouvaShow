import type { Snapshot, TextBox, Theme } from '../../shared/contracts';

export const DEFAULT_TEXT_BOX: TextBox = { x: 7, y: 7, width: 86, height: 86 };
export const MIN_BOX_SIZE = 10;
export const MIN_FONT_SIZE = 32;
export const BIBLE_TEXT_BOTTOM = 81;
export type BoxHandle = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

export function validTextBox(box: TextBox): boolean {
  return [box.x, box.y, box.width, box.height].every(Number.isFinite)
    && box.x >= 0 && box.y >= 0 && box.width >= MIN_BOX_SIZE && box.height >= MIN_BOX_SIZE
    && box.x + box.width <= 100 && box.y + box.height <= 100;
}

/** Bible references own the bottom 19%; music can use the entire configured canvas. */
export function effectiveTextBox(box: TextBox | undefined, bible = false): TextBox {
  const source = box && validTextBox(box) ? box : DEFAULT_TEXT_BOX;
  if (!bible) return { ...source };
  const y = Math.min(source.y, BIBLE_TEXT_BOTTOM - MIN_BOX_SIZE);
  return { ...source, y, height: Math.min(source.height, BIBLE_TEXT_BOTTOM - y) };
}

/** Deltas are canvas percentages measured from the gesture's original box. */
export function transformTextBox(box: TextBox, handle: BoxHandle, dx: number, dy: number, bible = false): TextBox {
  const source = effectiveTextBox(box, bible);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return source;
  const bottomLimit = bible ? BIBLE_TEXT_BOTTOM : 100;
  if (handle === 'move') return {
    ...source,
    x: Math.min(100 - source.width, round(clamp(source.x + dx, 0, 100 - source.width))),
    y: Math.min(bottomLimit - source.height, round(clamp(source.y + dy, 0, bottomLimit - source.height))),
  };
  let left = source.x; let right = source.x + source.width;
  let top = source.y; let bottom = source.y + source.height;
  if (handle.includes('w')) left = clamp(left + dx, 0, right - MIN_BOX_SIZE);
  if (handle.includes('e')) right = clamp(right + dx, left + MIN_BOX_SIZE, 100);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - MIN_BOX_SIZE);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + MIN_BOX_SIZE, bottomLimit);
  left = round(left); top = round(top);
  return { x: left, y: top, width: Math.min(100 - left, Math.max(MIN_BOX_SIZE, round(right - left))), height: Math.min(bottomLimit - top, Math.max(MIN_BOX_SIZE, round(bottom - top))) };
}

export function numberInRange(raw: string, min: number, max: number): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function fitFontSize(requested: number, fits: (size: number) => boolean): { fontSize: number; overflow: boolean } {
  let fontSize = Number.isFinite(requested) ? clamp(requested, MIN_FONT_SIZE, 100) : 64;
  while (!fits(fontSize)) {
    if (fontSize <= MIN_FONT_SIZE) return { fontSize: MIN_FONT_SIZE, overflow: true };
    fontSize = Math.max(MIN_FONT_SIZE, fontSize - 1);
  }
  return { fontSize, overflow: false };
}

export function copyTheme(theme: Theme): Theme {
  return { ...theme, textBox: { ...(theme.textBox ?? DEFAULT_TEXT_BOX) } };
}

export function validateThemeDraft(theme: Theme): string | null {
  if (!Number.isFinite(theme.fontSize) || theme.fontSize < MIN_FONT_SIZE || theme.fontSize > 100) return 'Use uma fonte entre 32 e 100.';
  if (!validTextBox(theme.textBox)) return 'A caixa precisa ficar dentro da tela e ter largura e altura de pelo menos 10%.';
  if (!/^#[0-9a-f]{6}$/i.test(theme.textColor) || !/^#[0-9a-f]{6}$/i.test(theme.backgroundColor)) return 'Escolha cores válidas para o texto e o fundo.';
  if (!Number.isFinite(theme.overlayOpacity) || theme.overlayOpacity < 0 || theme.overlayOpacity > 1) return 'A camada de contraste precisa ficar entre 0 e 100%.';
  if (!Number.isFinite(theme.transitionDurationMs) || theme.transitionDurationMs < 0 || theme.transitionDurationMs > 500) return 'Use uma duração de transição entre 0 e 500 ms.';
  return null;
}

/** Editing previews reuse content, never mutate or send the live snapshot. */
export function createDraftSnapshot(snapshot: Snapshot | null, draft: Theme): Snapshot {
  const hasContent = Boolean(snapshot?.blocks[snapshot.blockIndex]?.text.trim());
  if (snapshot && hasContent) return { ...snapshot, blanked: false, theme: copyTheme(draft) };
  return {
    revision: snapshot?.revision ?? 0, blanked: false, songId: null, bible: null,
    title: 'Texto de demonstração da edição', blockIndex: 0,
    blocks: [{ id: 'theme-editor-demo', label: null, text: 'Um encontro de fé\nUma comunidade reunida', position: 0 }],
    theme: copyTheme(draft),
  };
}
