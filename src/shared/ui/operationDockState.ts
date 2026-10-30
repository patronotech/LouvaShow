export interface OperationDockState { version: 1; height: number | null; collapsed: boolean }
export const operationDockKey = 'louvashow:operation-dock:v1';
export const defaultDockState: OperationDockState = { version: 1, height: null, collapsed: false };
export function dockMaximum(viewportHeight: number): number { return Math.max(48, Math.min(320, Math.floor(viewportHeight * .45))); }
export function clampDockHeight(height: number, viewportHeight: number): number { return Math.round(Math.max(48, Math.min(dockMaximum(viewportHeight), height))); }
export function readDockState(raw: string | null): OperationDockState {
  try { const data: unknown = JSON.parse(raw || 'null'); if (!data || typeof data !== 'object') return {...defaultDockState}; const candidate = data as Partial<OperationDockState>; if(candidate.version !== 1) return {...defaultDockState}; return {version:1,height:typeof candidate.height === 'number' && Number.isFinite(candidate.height) ? Math.round(Math.min(320,Math.max(48,candidate.height))) : null,collapsed:candidate.collapsed === true}; }
  catch { return {...defaultDockState}; }
}
export function dragDockHeight(startHeight: number, startY: number, pointerY: number, viewportHeight: number): number { return clampDockHeight(startHeight + startY - pointerY, viewportHeight); }
