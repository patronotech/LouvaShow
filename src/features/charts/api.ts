import type { CapoSuggestion, KeySuggestion, Chart, ChartDocument, ChartImportResult, ChartRevision, ChartSummary, ChartTransformResult, SaveChartInput } from './contracts';
import type { Song } from '../../shared/contracts';
export interface ChartApi {
  capoAssistantEnabled?: () => Promise<boolean>;
  rankCapos?: (candidates: CapoSuggestion[]) => Promise<CapoSuggestion[]>;
  saveFile?: (document: ChartDocument) => Promise<{fileName: string} | null>;
  importDocument?: (file: File, provider: 'auto' | 'openai' | 'gemini', useAi?: boolean) => Promise<ChartImportResult>;
  list(songId?: string): Promise<ChartSummary[]>;
  get(id: string, revision?: number): Promise<Chart>;
  create(songId: string): Promise<ChartDocument>;
  save(input: SaveChartInput): Promise<Chart>;
  remove(id: string, expectedRevision: number): Promise<void>;
  revisions(id: string): Promise<ChartRevision[]>;
  import(text: string, format: 'chordpro' | 'text'): Promise<ChartImportResult>;
  export(document: ChartDocument): Promise<string>;
  transpose(document: ChartDocument, semitones: number, capo: number): Promise<ChartTransformResult>;
  keys(document: ChartDocument): Promise<KeySuggestion[]>;
  capos(document: ChartDocument): Promise<CapoSuggestion[]>;
  publish(id: string, expectedRevision: number, name: string): Promise<Chart>;
}
export async function browserRequest<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const response = await fetch(path, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-LouvaShow-Request': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) { const text = await response.text(); throw new Error(text || `Não foi possível concluir (${response.status}).`); }
  if (response.status === 204) return undefined as T;
  const text = await response.text(); return text ? JSON.parse(text) as T : undefined as T;
}
export const browserChartApi: ChartApi = {
  list: songId => browserRequest(`/api/charts${songId ? `?songId=${encodeURIComponent(songId)}` : ''}`),
  get: (id, revision) => browserRequest(`/api/charts/${encodeURIComponent(id)}${revision ? `?revision=${revision}` : ''}`),
  create: songId => browserRequest('/api/charts/document', { songId }),
  save: input => browserRequest('/api/charts', input),
  remove: (id, expectedRevision) => browserRequest(`/api/charts/${encodeURIComponent(id)}`, { expectedRevision }, 'DELETE'),
  revisions: id => browserRequest(`/api/charts/${encodeURIComponent(id)}/revisions`),
  import: (text, format) => browserRequest('/api/charts/import', { text, format }),
  export: document => browserRequest('/api/charts/export', { document }),
  transpose: (document, semitones, capo) => browserRequest('/api/charts/transpose', { document, semitones, capo, spelling: document.spelling }),
  keys: document => browserRequest('/api/charts/keys', { document }),
  capos: document => browserRequest('/api/charts/capos', { document }),
  publish: (id, expectedRevision, name) => browserRequest(`/api/charts/${encodeURIComponent(id)}/publish`, { expectedRevision, name }),
};
export const browserSongs = () => browserRequest<Song[]>('/api/songs');
