import { describe, expect, it, vi } from 'vitest';
import type { BibleChapter, Snapshot } from '../../shared/contracts';
import { LatestRequest } from './latestRequest';
import { isBibleVerseInSession } from './BiblePanels';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe('consulta bíblica assíncrona', () => {
  it('descarta a resposta de um capítulo antigo que termina depois do capítulo escolhido', async () => {
    const request = new LatestRequest();
    const first = deferred<string>(); const second = deferred<string>();
    const success = vi.fn(); const failure = vi.fn(); const settled = vi.fn();
    const a = request.run(() => first.promise, { success, failure, settled });
    const b = request.run(() => second.promise, { success, failure, settled });
    second.resolve('capítulo atual'); await b;
    first.resolve('capítulo anterior'); await a;
    expect(success).toHaveBeenCalledExactlyOnceWith('capítulo atual');
    expect(failure).not.toHaveBeenCalled(); expect(settled).toHaveBeenCalledOnce();
  });

  it('invalida imediatamente ao trocar livro, antes mesmo do próximo efeito iniciar', async () => {
    const request = new LatestRequest(); const first = deferred<string>();
    const success = vi.fn(); const failure = vi.fn(); const settled = vi.fn();
    const pending = request.run(() => first.promise, { success, failure, settled });
    request.invalidate(); first.reject(new Error('erro do livro anterior')); await pending;
    expect(success).not.toHaveBeenCalled(); expect(failure).not.toHaveBeenCalled(); expect(settled).not.toHaveBeenCalled();
    await request.run(async () => 'novo livro', { success, failure, settled });
    expect(success).toHaveBeenCalledExactlyOnceWith('novo livro');
  });

  it('expõe a falha atual e permite uma tentativa posterior bem-sucedida', async () => {
    const request = new LatestRequest(); const success = vi.fn(); const failure = vi.fn(); const settled = vi.fn();
    const error = new Error('arquivo indisponível');
    await request.run(async () => { throw error; }, { success, failure, settled });
    expect(failure).toHaveBeenCalledExactlyOnceWith(error);
    await request.run(async () => 'recuperado', { success, failure, settled });
    expect(success).toHaveBeenCalledExactlyOnceWith('recuperado'); expect(settled).toHaveBeenCalledTimes(2);
  });
});

describe('identificação do versículo da sessão', () => {
  const chapter: BibleChapter = { versionId: 'version', bookId: 'book', bookName: 'Livro de teste', chapter: 1, verses: [{ number: '1', text: 'Texto de teste' }, { number: '10', text: 'Outro texto' }] };
  const snapshot: Snapshot = { revision: 1, blanked: false, songId: null, title: 'Livro de teste 1', blockIndex: 0, bible: { versionId: 'version', bookId: 'book', chapter: 1, versionAbbreviation: 'TESTE', attribution: 'Fixture original' }, blocks: [{ id: 'bible:version:book:1:10:2', label: 'Livro de teste 1:10 · parte 2/2', text: 'Outro texto', position: 0 }], theme: { id: 'default', name: 'Padrão', fontFamily: 'Arial', fontSize: 60, textColor: '#ffffff', backgroundColor: '#000000', textAlign: 'center', verticalAlign: 'center', backgroundMediaId: null, overlayOpacity: 0, transitionType: 'none', transitionDurationMs: 0, textBox: { x: 7, y: 7, width: 86, height: 86 } } };
  it('diferencia versículos 1 e 10 e aceita páginas do mesmo versículo', () => {
    expect(isBibleVerseInSession(snapshot, chapter, '1')).toBe(false);
    expect(isBibleVerseInSession(snapshot, chapter, '10')).toBe(true);
    expect(isBibleVerseInSession(snapshot, { ...chapter, versionId: 'other' }, '10')).toBe(false);
    expect(isBibleVerseInSession(snapshot, { ...chapter, chapter: 2 }, '10')).toBe(false);
  });
  it('preserva a identidade textual de versículos agrupados em intervalos', () => {
    const ranged = { ...snapshot, blocks: [{ ...snapshot.blocks[0]!, id: 'bible:version:book:1:1-2:1' }] };
    expect(isBibleVerseInSession(ranged, chapter, '1-2')).toBe(true);
    expect(isBibleVerseInSession(ranged, chapter, '1')).toBe(false);
  });
});
