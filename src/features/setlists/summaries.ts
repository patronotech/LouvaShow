import type { Setlist, SetlistSummary } from '../../shared/contracts';

/** Reflect a committed operation immediately, even if the subsequent list refresh fails. */
export function updateSummaries(current: SetlistSummary[], next: Setlist, deletedId?: string): SetlistSummary[] {
  const summary = { id: next.id, name: next.name, itemCount: next.items.length };
  return [...current.filter(item => item.id !== deletedId && item.id !== next.id), summary]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
