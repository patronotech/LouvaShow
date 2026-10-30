import type { ChartImportResult } from './contracts';

export type DocumentProvider = 'openai' | 'gemini';
export type DocumentProviderChoice = 'auto' | DocumentProvider;
export interface DocumentImportPreferences {
  enabled: boolean;
  preferredProvider: DocumentProviderChoice;
  openaiModel: 'gpt-5.4-mini';
  geminiModel: 'gemini-3.8-flash' | 'gemini-3.5-flash-lite';
}
export interface DocumentImportConfig extends DocumentImportPreferences {
  hasOpenaiKey: boolean;
  hasGeminiKey: boolean;
}
export interface DocumentImportInput {
  fileName: string;
  bytes: number[];
  provider: DocumentProviderChoice;
  /** Confirms consent to the selected external provider; required only when useAi is true. */
  authorized: boolean;
  /** false: TXT/DOCX local extraction; PDF/DOC require external interpretation. */
  useAi: boolean;
}
export interface DocumentImportResult extends ChartImportResult {
  provider: 'local' | DocumentProvider;
  model: string | null;
}
/** Native operator commands; never exposed through the LAN server.
 * document_import_config() -> DocumentImportConfig
 * document_import_save_config({config: DocumentImportPreferences}) -> DocumentImportConfig
 * document_import_set_key({provider: DocumentProvider, key: string}) -> void
 * document_import_remove_key({provider: DocumentProvider}) -> void
 * import_chart_document(DocumentImportInput) -> DocumentImportResult
 * Keys are stored in the OS vault. No command returns their value.
 * Maximum input 12 MiB; PDF maximum 20 pages; extracted text maximum 100 KB.
 * Auto prefers Gemini for PDF/text/DOCX; DOC uses OpenAI. No retry with another provider.
 */
