export interface StickyNoteLayout { version: 1; x: number; y: number; collapsed: boolean; visible: boolean }
export const defaultStickyNoteLayout: StickyNoteLayout = { version: 1, x: 65, y: 12, collapsed: false, visible: false };

export function parseStickyNoteLayout(raw: string | null, hasText: boolean): StickyNoteLayout {
  const fallback = { ...defaultStickyNoteLayout, visible: hasText };
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1) return fallback;
    const v = value as Record<string, unknown>;
    return {
      version: 1,
      x: typeof v.x === 'number' && Number.isFinite(v.x) ? Math.min(100, Math.max(0, v.x)) : fallback.x,
      y: typeof v.y === 'number' && Number.isFinite(v.y) ? Math.min(100, Math.max(0, v.y)) : fallback.y,
      collapsed: typeof v.collapsed === 'boolean' ? v.collapsed : false,
      visible: typeof v.visible === 'boolean' ? v.visible : hasText,
    };
  } catch { return fallback; }
}

export function moveStickyNote(x: number, y: number, parentWidth: number, parentHeight: number, noteWidth: number, noteHeight: number): Pick<StickyNoteLayout, 'x' | 'y'> {
  return {
    x: Math.max(0, Math.min(x, Math.max(0, parentWidth - noteWidth))) / Math.max(1, parentWidth) * 100,
    y: Math.max(0, Math.min(y, Math.max(0, parentHeight - noteHeight))) / Math.max(1, parentHeight) * 100,
  };
}
