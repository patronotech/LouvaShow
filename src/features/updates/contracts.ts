export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'installing' | 'upToDate' | 'error';

export interface UpdateSnapshot {
  revision: number;
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  notes: string | null;
  publishedAt: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  error: string | null;
}

export function acceptUpdateSnapshot(current: UpdateSnapshot | null, incoming: UpdateSnapshot): UpdateSnapshot {
  return current === null || incoming.revision > current.revision ? incoming : current;
}

export function updateProgress(snapshot: UpdateSnapshot): number | undefined {
  if (!snapshot.totalBytes || snapshot.totalBytes <= 0) return undefined;
  return Math.min(100, Math.max(0, Math.floor(snapshot.downloadedBytes / snapshot.totalBytes * 100)));
}

export function canStartUpdate(snapshot: UpdateSnapshot | null, outputOpen: boolean): boolean {
  return !outputOpen && !!snapshot?.availableVersion && ['available', 'ready', 'error'].includes(snapshot.status);
}
