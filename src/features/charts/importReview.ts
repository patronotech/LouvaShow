import type { ChartDocument } from './contracts';
import { mergeChartNotes } from './lineChordModel';

export function hasImportedIdentity(document: ChartDocument): boolean {
  return (!!document.title.trim() && document.title.trim() !== 'Cifra importada') || !!document.artist?.trim();
}

/** Importing a chart never edits the linked library Song. Identity changes are explicit. */
export function applyReviewedChart(current: ChartDocument, imported: ChartDocument, useIdentity: boolean): ChartDocument {
  const title = imported.title.trim() && imported.title.trim() !== 'Cifra importada' ? imported.title : current.title;
  const attribution = !useIdentity && hasImportedIdentity(imported)
    ? `Créditos do arquivo: ${[imported.artist, imported.title.trim() === 'Cifra importada' ? null : imported.title].filter(Boolean).join(' — ')}`
    : '';
  return {
    ...imported,
    title: useIdentity ? title : current.title,
    artist: useIdentity ? imported.artist : current.artist,
    notes: mergeChartNotes(mergeChartNotes(current.notes, imported.notes), attribution),
  };
}
