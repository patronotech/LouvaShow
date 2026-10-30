import { invoke } from '@tauri-apps/api/core';
import type { AssistantConfig } from '../team/contracts';
import type { ChartApi } from './api';
export const desktopChartApi: ChartApi = {
 saveFile: document => invoke('export_chart_file', { document }),
 capoAssistantEnabled: async () => { const config = await invoke<AssistantConfig>('assistant_config'); return config.enabled && config.hasKey && config.capo; },
 rankCapos: async candidates => { const ids = await invoke<string[]>('assistant_rank_capo', { candidates: candidates.map(candidate => ({ id: candidate.id, capo: candidate.capo, score: candidate.score, chords: [...new Set(candidate.document.sections.flatMap(section => section.lines.flatMap(line => line.chords.map(chord => chord.symbol))))] })) }); return [...candidates].sort((a, b) => { const ai = ids.indexOf(a.id); const bi = ids.indexOf(b.id); return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi); }); },
 importUrl: url => invoke('import_chart_url', { url }),
 list: songId => invoke('list_charts', { songId: songId ?? null }),
 get: (id, revision) => invoke('get_chart', { id, revision: revision ?? null }),
 create: songId => invoke('create_chart_document', { songId }),
 save: input => invoke('save_chart', { input }),
 remove: (id, expectedRevision) => invoke('delete_chart', { id, expectedRevision }),
 revisions: id => invoke('list_chart_revisions', { id }),
 import: (text, format) => invoke('import_chart', { text, format }),
 export: document => invoke('export_chart', { document }),
 transpose: (document, semitones, capo) => invoke('transpose_chart', { document, semitones, capo, spelling: document.spelling }),
 keys: document => invoke('suggest_chart_keys', { document }),
 capos: document => invoke('suggest_chart_capos', { document }),
 publish: (id, expectedRevision, name) => invoke('publish_chart', { id, expectedRevision, name }),
};
