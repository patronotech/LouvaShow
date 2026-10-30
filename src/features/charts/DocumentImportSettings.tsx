import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './documentImportSettings.css';

import type { DocumentImportConfig as Config, DocumentProviderChoice as Provider } from './documentImportContracts';

export function DocumentImportSettings() {
  const [config, setConfig] = useState<Config | null>(null);
  const [keys, setKeys] = useState({ openai: '', gemini: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const refresh = async () => setConfig(await invoke<Config>('document_import_config'));
  const refreshKeys = async () => {
    const next = await invoke<Config>('document_import_config');
    setConfig(current => current ? { ...current, hasOpenaiKey: next.hasOpenaiKey, hasGeminiKey: next.hasGeminiKey } : next);
  };
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setSaved(false);
    try { await operation(); } catch (reason) { setError(String(reason)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void run(refresh); }, []);

  return <section className="document-import-settings" data-no-shortcuts>
    <h3>Documentos · OpenAI e Gemini</h3>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {config && <>
      <form onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          const { enabled, preferredProvider, openaiModel, geminiModel } = config;
          setConfig(await invoke<Config>('document_import_save_config', {
            config: { enabled, preferredProvider, openaiModel, geminiModel },
          }));
          setSaved(true);
        });
      }}>
        <fieldset disabled={busy}>
          <label className="team-check"><input type="checkbox" checked={config.enabled}
            onChange={event => { setConfig({ ...config, enabled: event.target.checked }); setSaved(false); }}/>
            Habilitar importação com IA</label>
          <div className="document-import-preferences">
            <label>Provedor padrão<select value={config.preferredProvider}
              onChange={event => { setConfig({ ...config, preferredProvider: event.target.value as Provider }); setSaved(false); }}>
              <option value="auto">Automático</option><option value="gemini">Gemini</option><option value="openai">OpenAI</option>
            </select></label>
            <label>Modelo Gemini<select value={config.geminiModel}
              onChange={event => { setConfig({ ...config, geminiModel: event.target.value as Config['geminiModel'] }); setSaved(false); }}>
              <option value="gemini-3.8-flash">Flash · padrão</option><option value="gemini-3.5-flash-lite">Flash-Lite · econômico</option>
            </select></label>
            <button className="primary">Salvar preferências</button>
          </div>
        </fieldset>
      </form>
      <p className="document-import-description">O documento é enviado ao provedor escolhido somente após sua confirmação. Colar cifra e editar continuam disponíveis offline.</p>
      <div className="document-provider-grid">
        {(['gemini', 'openai'] as const).map(provider => {
          const label = provider === 'openai' ? 'OpenAI' : 'Gemini';
          const hasKey = provider === 'openai' ? config.hasOpenaiKey : config.hasGeminiKey;
          return <form key={provider} onSubmit={event => {
            event.preventDefault();
            void run(async () => {
              await invoke('document_import_set_key', { provider, key: keys[provider] });
              setKeys(current => ({ ...current, [provider]: '' }));
              await refreshKeys(); setSaved(true);
            });
          }}>
            <fieldset disabled={busy}>
              <div className="document-provider-title"><strong>{label}</strong><span>{hasKey ? 'Chave guardada' : 'Sem chave'}</span></div>
              <span className="document-provider-model">{provider === 'openai' ? config.openaiModel : config.geminiModel}</span>
              <label>Chave {label}<input type="password" autoComplete="off" spellCheck={false}
                value={keys[provider]} onChange={event => setKeys(current => ({ ...current, [provider]: event.target.value }))}/></label>
              <div className="chart-toolbar compact">
                <button disabled={!keys[provider].trim()}>Guardar chave</button>
                {hasKey && <button type="button" onClick={() => void run(async () => {
                  await invoke('document_import_remove_key', { provider });
                  await refreshKeys(); setSaved(true);
                })}>Remover chave</button>}
              </div>
            </fieldset>
          </form>;
        })}
      </div>
    </>}
    {saved && <p role="status">Configuração salva.</p>}
  </section>;
}
