/** Stable grapheme anchors: offsets count Intl.Segmenter graphemes, never UTF-16 units. */
export interface ChartChord { id: string; offset: number; symbol: string }
export interface ChartLine { id: string; text: string; chords: ChartChord[] }
export interface ChartSection { id: string; label: string; lines: ChartLine[] }
export interface ChartOccurrence { id: string; sectionId: string }
export type ChartSpelling = 'sharps' | 'flats';
export type ChartScope = 'personal' | 'church';
export interface ChartDocument {
  schemaVersion: 1;
  title: string;
  artist: string | null;
  /** Sounding/concert key; null means not confirmed. Chords store displayed shapes. */
  concertKey: string | null;
  capo: number;
  spelling: ChartSpelling;
  sections: ChartSection[];
  sequence: ChartOccurrence[];
  notes: string;
  /** Unknown ChordPro directives retained with an import warning. */
  preservedDirectives: string[];
}
export interface ChartSummary {
  id: string; songId: string; name: string; ownerId: string; scope: ChartScope;
  revision: number; createdAt: string; updatedAt: string; sourceChartId: string | null;
  sourceRevisionId?: string | null; sourceAuthorId?: string | null;
}
export interface ChartRevision {
  id: string; chartId: string; revision: number; authorId: string; createdAt: string;
  document: ChartDocument; sourceSongUpdatedAt: string;
}
export interface Chart extends ChartSummary { current: ChartRevision }
export interface SaveChartInput {
  id: string | null; songId: string; name: string; scope: ChartScope;
  expectedRevision: number | null; document: ChartDocument;
  sourceChartId: string | null;
}
export interface ChartTransformResult { document: ChartDocument; warnings: string[] }
export interface ChartImportResult extends ChartTransformResult { format: 'chordpro' | 'text' }
export interface KeySuggestion { key: string; score: number; explanation: string }
export interface CapoSuggestion {
  id: string; capo: number; shapeKey: string | null; score: number; explanation: string;
  document: ChartDocument; warnings: string[];
}
/** Desktop invoke contracts (all return Promise):
 * list_charts({songId: string|null}) => ChartSummary[]
 * get_chart({id, revision: number|null}) => Chart (current contains selected revision)
 * create_chart_document({songId}) => ChartDocument
 * save_chart({input: SaveChartInput}) => Chart
 * delete_chart({id, expectedRevision}) => void (soft archive; pinned revisions survive)
 * list_chart_revisions({id}) => ChartRevision[]
 * import_chart({text, format:'chordpro'|'text'}) => ChartImportResult
 * export_chart({document}) => string (ChordPro, sequence expanded)
 * export_chart_file({document}) => {fileName:string}|null (native save picker)
 * transpose_chart({document, semitones, capo, spelling}) => ChartTransformResult
 *   semitones changes sounding key; capo selects shapes while preserving new sound.
 * suggest_chart_capos({document}) => CapoSuggestion[] (up to three; capo0..5)
 * suggest_chart_keys({document}) => KeySuggestion[] (heuristic, never applies automatically)
 * publish_chart({id, expectedRevision, name}) => Chart (new church copy, operator only)
 * CAS conflict: error starts CONFLICT:. Keep draft and fetch current before retry.
 */
