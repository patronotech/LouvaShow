export type WorkspaceSide = 'left' | 'right';
export interface WorkspaceLayout {
  version: 1;
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

export const DEFAULT_WORKSPACE_LAYOUT: Readonly<WorkspaceLayout> = Object.freeze({
  version: 1, leftWidth: 260, rightWidth: 340, leftCollapsed: false, rightCollapsed: false,
});
export const WORKSPACE_RESET_EVENT = 'louvashow:reset-layout';
export const WORKSPACE_STORAGE_PREFIX = 'louvashow.workspace.v1.';
export const CENTER_MIN = 320;
export const RAIL_WIDTH = 34;
export const HANDLE_WIDTH = 8;
export const PANE_MAX = 960;
const minimum = { left: 200, right: 260 } as const;
type LayoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function browserStorage(): LayoutStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

const keyFor = (context: string) => WORKSPACE_STORAGE_PREFIX + encodeURIComponent(context);
const fresh = (): WorkspaceLayout => ({ ...DEFAULT_WORKSPACE_LAYOUT });
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function parseWorkspaceLayout(raw: string | null): WorkspaceLayout {
  if (!raw) return fresh();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return fresh();
    const saved = value as Partial<WorkspaceLayout>;
    if (saved.version !== 1 || typeof saved.leftWidth !== 'number' || !Number.isFinite(saved.leftWidth)
      || typeof saved.rightWidth !== 'number' || !Number.isFinite(saved.rightWidth)
      || typeof saved.leftCollapsed !== 'boolean' || typeof saved.rightCollapsed !== 'boolean') return fresh();
    return {
      version: 1,
      leftWidth: clamp(saved.leftWidth, minimum.left, PANE_MAX),
      rightWidth: clamp(saved.rightWidth, minimum.right, PANE_MAX),
      leftCollapsed: saved.leftCollapsed,
      rightCollapsed: saved.rightCollapsed,
    };
  } catch { return fresh(); }
}

export function readWorkspaceLayout(context: string, storage: LayoutStorage | null = browserStorage()): WorkspaceLayout {
  try { return parseWorkspaceLayout(storage?.getItem(keyFor(context)) ?? null); }
  catch { return fresh(); }
}

export function saveWorkspaceLayout(context: string, layout: WorkspaceLayout, storage: LayoutStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(keyFor(context), JSON.stringify(layout));
    return true;
  } catch { return false; }
}

/** Restores every workspace context; storage denial never prevents the UI reset. */
export function resetWorkspaceLayouts(storage: LayoutStorage | null = browserStorage()): boolean {
  let persisted = storage !== null;
  try {
    if (storage) {
      const keys: string[] = [];
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key?.startsWith(WORKSPACE_STORAGE_PREFIX)) keys.push(key);
      }
      keys.forEach(key => storage.removeItem(key));
    }
  } catch { persisted = false; }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(WORKSPACE_RESET_EVENT, { detail: { persisted } }));
  return persisted;
}

export interface FittedWorkspace {
  leftWidth: number;
  rightWidth: number;
  centerWidth: number;
  handleWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  leftAutoCollapsed: boolean;
  rightAutoCollapsed: boolean;
  leftMin: number;
  rightMin: number;
  leftMax: number;
  rightMax: number;
}

/** Responsive fitting never mutates or persists the user's preferred sizes. */
export function fitWorkspaceLayout(layout: WorkspaceLayout, containerWidth: number): FittedWorkspace {
  const width = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  const handle = Math.min(HANDLE_WIDTH, width / 4);
  const rail = Math.min(RAIL_WIDTH, Math.max(0, (width - handle * 2) / 2));
  let leftCollapsed = layout.leftCollapsed;
  let rightCollapsed = layout.rightCollapsed;
  const minimumTotal = () => (leftCollapsed ? rail : minimum.left)
    + (rightCollapsed ? rail : minimum.right) + CENTER_MIN + handle * 2;
  // Preserve the live preview first when both sidebars cannot fit.
  if (minimumTotal() > width && !leftCollapsed) leftCollapsed = true;
  if (minimumTotal() > width && !rightCollapsed) rightCollapsed = true;
  const leftMin = leftCollapsed ? rail : minimum.left;
  const rightMin = rightCollapsed ? rail : minimum.right;
  let left = leftCollapsed ? rail : clamp(layout.leftWidth, minimum.left, PANE_MAX);
  let right = rightCollapsed ? rail : clamp(layout.rightWidth, minimum.right, PANE_MAX);
  const available = Math.max(leftMin + rightMin, width - CENTER_MIN - handle * 2);
  const excess = Math.max(0, left + right - available);
  if (excess > 0) {
    const flexibleLeft = left - leftMin;
    const flexibleRight = right - rightMin;
    const flexible = flexibleLeft + flexibleRight;
    if (flexible > 0) {
      left -= excess * flexibleLeft / flexible;
      right -= excess * flexibleRight / flexible;
    }
  }
  return {
    leftWidth: left,
    rightWidth: right,
    centerWidth: Math.max(0, width - left - right - handle * 2),
    handleWidth: handle,
    leftCollapsed,
    rightCollapsed,
    leftAutoCollapsed: leftCollapsed && !layout.leftCollapsed,
    rightAutoCollapsed: rightCollapsed && !layout.rightCollapsed,
    leftMin,
    rightMin,
    leftMax: Math.max(leftMin, Math.min(PANE_MAX, width - CENTER_MIN - right - handle * 2)),
    rightMax: Math.max(rightMin, Math.min(PANE_MAX, width - CENTER_MIN - left - handle * 2)),
  };
}

export function toggleWorkspacePane(layout: WorkspaceLayout, side: WorkspaceSide, width: number): WorkspaceLayout {
  const fitted = fitWorkspaceLayout(layout, width);
  const collapsed = side === 'left' ? fitted.leftCollapsed : fitted.rightCollapsed;
  const next = { ...layout, [side === 'left' ? 'leftCollapsed' : 'rightCollapsed']: !collapsed };
  // Explicitly reopening an auto-collapsed pane may trade space with the other
  // sidebar, instead of presenting a button that appears to do nothing.
  if (collapsed && minimum.left + minimum.right + CENTER_MIN + HANDLE_WIDTH * 2 > width) {
    next[side === 'left' ? 'rightCollapsed' : 'leftCollapsed'] = true;
  }
  return next;
}

export function resizeWorkspacePane(layout: WorkspaceLayout, side: WorkspaceSide, requested: number, width: number): WorkspaceLayout {
  if (!Number.isFinite(requested)) return layout;
  const fitted = fitWorkspaceLayout(layout, width);
  if (side === 'left' ? fitted.leftCollapsed : fitted.rightCollapsed) return layout;
  const value = clamp(requested, minimum[side], side === 'left' ? fitted.leftMax : fitted.rightMax);
  // Explicit resizing starts from visible dimensions; responsive fitting alone
  // still leaves both preferred widths intact.
  return {
    ...layout,
    leftWidth: fitted.leftCollapsed ? layout.leftWidth : fitted.leftWidth,
    rightWidth: fitted.rightCollapsed ? layout.rightWidth : fitted.rightWidth,
    [side === 'left' ? 'leftWidth' : 'rightWidth']: value,
  };
}

export function dragWorkspaceResize(original: WorkspaceLayout, base: WorkspaceLayout, side: WorkspaceSide, requested: number, width: number): WorkspaceLayout {
  if (requested < 100) return { ...original, [side === 'left' ? 'leftCollapsed' : 'rightCollapsed']: true };
  return resizeWorkspacePane(base, side, requested, width);
}

/** Arrow direction describes the divider's physical movement, not pane growth. */
export function keyboardWorkspaceResize(layout: WorkspaceLayout, side: WorkspaceSide, key: string, width: number, step = 16): WorkspaceLayout | null {
  if (key === 'Enter') return toggleWorkspacePane(layout, side, width);
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return null;
  let fitted = fitWorkspaceLayout(layout, width);
  const collapsed = side === 'left' ? fitted.leftCollapsed : fitted.rightCollapsed;
  const delta = (key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1) * step;
  let next = layout;
  if (collapsed) {
    if (key === 'Home' || (key !== 'End' && delta < 0)) return layout;
    next = toggleWorkspacePane(layout, side, width);
    fitted = fitWorkspaceLayout(next, width);
    if (key !== 'End') return next;
  }
  const current = side === 'left' ? fitted.leftWidth : fitted.rightWidth;
  const requested = key === 'Home' ? minimum[side]
    : key === 'End' ? (side === 'left' ? fitted.leftMax : fitted.rightMax)
      : current + delta;
  return resizeWorkspacePane(next, side, requested, width);
}
