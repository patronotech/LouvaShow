import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { UpdateBanner, UpdateSettings } from './UpdateControls';
import type { UpdateSnapshot } from './contracts';

const snapshot: UpdateSnapshot = { revision: 3, status: 'available', currentVersion: '0.7.0', availableVersion: '0.8.0', notes: '<script>texto</script>', publishedAt: null, downloadedBytes: 0, totalBytes: null, error: null };
const actions = { check: async () => undefined, install: async () => undefined, error: '' };

it('mantém a ação recuperável após falha de download', () => {
  const html = renderToStaticMarkup(<UpdateBanner updater={{ ...actions, snapshot: { ...snapshot, status: 'error', error: 'Download interrompido.' } }} outputOpen={false} />);
  expect(html).toContain('0.8.0 disponível');
  expect(html).toContain('Baixar e atualizar');
  expect(html).not.toContain('disabled');
});

it('bloqueia a ação com projeção aberta e explica como continuar', () => {
  const html = renderToStaticMarkup(<UpdateBanner updater={{ ...actions, snapshot }} outputOpen />);
  expect(html).toContain('disabled');
  expect(html).toContain('Feche a projeção para atualizar.');
});

it('não mostra alerta na abertura sem versão nova e mantém consulta manual', () => {
  const updater = { ...actions, snapshot: { ...snapshot, status: 'upToDate' as const, availableVersion: null } };
  expect(renderToStaticMarkup(<UpdateBanner updater={updater} outputOpen={false} />)).toBe('');
  const html = renderToStaticMarkup(<UpdateSettings updater={updater} outputOpen={false} />);
  expect(html).toContain('Verificar atualizações');
  expect(html).toContain('versão mais recente');
});
