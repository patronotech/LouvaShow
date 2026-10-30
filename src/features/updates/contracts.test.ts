import { describe, expect, it } from 'vitest';
import { acceptUpdateSnapshot, canStartUpdate, updateProgress, type UpdateSnapshot } from './contracts';

const base: UpdateSnapshot = { revision: 2, status: 'available', currentVersion: '0.7.0', availableVersion: '0.8.0', notes: null, publishedAt: null, downloadedBytes: 0, totalBytes: null, error: null };

describe('atualizações', () => {
  it('não aplica eventos ou buscas anteriores ao estado já recebido', () => {
    const ready = { ...base, revision: 5, status: 'ready' as const };
    expect(acceptUpdateSnapshot(ready, base)).toBe(ready);
    expect(acceptUpdateSnapshot(ready, { ...ready })).toBe(ready);
    expect(acceptUpdateSnapshot(null, base)).toBe(base);
  });
  it('exige uma versão disponível e a saída fechada', () => {
    expect(canStartUpdate(base, false)).toBe(true);
    expect(canStartUpdate(base, true)).toBe(false);
    expect(canStartUpdate({ ...base, status: 'checking' }, false)).toBe(false);
    expect(canStartUpdate({ ...base, status: 'error', error: 'Download interrompido.' }, false)).toBe(true);
    expect(canStartUpdate({ ...base, availableVersion: null }, false)).toBe(false);
  });
  it('trata download sem tamanho conhecido e limita o progresso', () => {
    expect(updateProgress(base)).toBeUndefined();
    expect(updateProgress({ ...base, downloadedBytes: 25, totalBytes: 100 })).toBe(25);
    expect(updateProgress({ ...base, downloadedBytes: 110, totalBytes: 100 })).toBe(100);
  });
});
