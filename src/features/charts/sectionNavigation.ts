import type { ChartDocument } from './contracts';

export interface SectionNavigationItem { id: string; sectionId: string; label: string }
/** Occurrences remain independent even when a refrain references the same section. */
export function sectionNavigation(document: ChartDocument): SectionNavigationItem[] {
  const sections = new Map(document.sections.map(section => [section.id, section]));
  return document.sequence.flatMap(occurrence => {
    const section = sections.get(occurrence.sectionId);
    return section ? [{ id: occurrence.id, sectionId: section.id, label: section.label || 'Parte' }] : [];
  });
}

export function sectionAtScroll(headingTops: readonly number[], viewportTop: number): number {
  let active = 0;
  for (let index = 0; index < headingTops.length; index += 1) {
    if (headingTops[index]! <= viewportTop + 32) active = index;
  }
  return active;
}
