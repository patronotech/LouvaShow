export interface ChartQueueItem { id: string; chartId: string; revision: number }
export function queueDestination(items: readonly ChartQueueItem[], current: number, direction: -1 | 1): number | null {
 const next = current + direction;
 return next >= 0 && next < items.length ? next : null;
}
export function chartNotesKey(chartId: string, ownerId: string): string { return `louvashow:musician:chart-notes:v2:${encodeURIComponent(ownerId)}:${encodeURIComponent(chartId)}`; }

export function queueTarget(items: readonly ChartQueueItem[], index: number): ChartQueueItem | null { return Number.isInteger(index) && index >= 0 ? items[index] || null : null; }
