import { describe, expect, it, vi } from 'vitest';
import type { BibleChapter, Snapshot } from '../../shared/contracts';
import { LatestRequest } from './latestRequest';
import { isBibleVerseInSession } from './BiblePanels';
import { initialSelection, passageAvailability, selectLocation, shouldProjectVerse } from './selection';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe('troca de tradução preserva a passagem preparada', () => {
  const prepared = { versionId: 'blivre', bookId: 'GEN', chapterNumber: 3, verseNumber: '16' };
  const books = [{ id: 'GEN', name: 'Gênesis', chapterCount: 50 }];
  it('troca e retorna sem perder livro, capítulo ou versículo', () => {
    const changed = selectLocation(prepared, { type: 'version', id: 'onbv' });
    expect(changed).toEqual({ ...prepared, versionId: 'onbv' });
    expect(selectLocation(changed, { type: 'version', id: 'blivre' })).toEqual(prepared);
    expect(passageAvailability(changed, books, 'onbv', null)).toBe('');
  });
  it('preserva Gênesis ao consultar uma versão só do Novo Testamento e permite voltar', () => {
    const changed = selectLocation(prepared, { type: 'version', id: 'blt' });
    expect(passageAvailability(changed, [{ id: 'MAT', name: 'Mateus', chapterCount: 28 }], 'blt', null)).toBe('Livro indisponível nesta versão');
    expect(changed.bookId).toBe('GEN');
    expect(selectLocation(changed, { type: 'version', id: 'blivre' })).toEqual(prepared);
    expect(passageAvailability(changed, books, 'blivre', null)).toBe(''); // Previous books never decide availability.
  });
  it('informa capítulo ou versículo ausente sem inventar uma nova referência', () => {
    expect(passageAvailability(prepared, [{ ...books[0]!, chapterCount: 2 }], 'blivre', null)).toBe('Capítulo indisponível nesta versão');
    const chapter: BibleChapter = { versionId: 'blivre', bookId: 'GEN', bookName: 'Gênesis', chapter: 3, verses: [{ number: '15-16', text: 'Texto agrupado da fixture' }] };
    expect(passageAvailability(prepared, books, 'blivre', chapter)).toBe('Versículo indisponível nesta versão');
    expect(passageAvailability({ ...prepared, verseNumber: '15-16' }, books, 'blivre', chapter)).toBe('');
  });
  it('navegação explícita em livro e capítulo limpa somente seleções descendentes', () => {
    expect(selectLocation(prepared, { type: 'book', id: 'MAT' })).toEqual({ versionId: 'blivre', bookId: 'MAT', chapterNumber: null, verseNumber: null });
    expect(selectLocation(prepared, { type: 'chapter', number: 4 })).toEqual({ ...prepared, chapterNumber: 4, verseNumber: null });
    expect(selectLocation(initialSelection, { type: 'version', id: 'blivre' }).bookId).toBe('');
  });
  it('descarta o capítulo antigo ao trocar de tradução antes da nova lista de livros', async () => {
    const request = new LatestRequest();
    const oldChapter = deferred<string>();
    let displayed: string | null = null;
    const handlers = { success: (text: string) => { displayed = text; }, failure: vi.fn(), settled: vi.fn() };
    const pending = request.run(() => oldChapter.promise, handlers);
    request.invalidate(); // Synchronous version-selection boundary, before effects.
    const changed = selectLocation(prepared, { type: 'version', id: 'onbv' });
    oldChapter.resolve('Texto da tradução antiga'); await pending;
    expect(displayed).toBeNull();
    expect(changed.chapterNumber).toBe(3); expect(changed.verseNumber).toBe('16');
    await request.run(async () => 'Texto da nova tradução', handlers);
    expect(displayed).toBe('Texto da nova tradução');
  });
});

describe('modo de clique do versículo', () => {
  it('preparar nunca envia à projeção, mesmo com a saída aberta', () => {
    expect(shouldProjectVerse(false, true, false)).toBe(false);
    expect(shouldProjectVerse(false, false, false)).toBe(false);
  });
  it('projetar ao clicar requer saída aberta e disponível', () => {
    expect(shouldProjectVerse(true, true, false)).toBe(true);
    expect(shouldProjectVerse(true, false, false)).toBe(false);
    expect(shouldProjectVerse(true, true, true)).toBe(false);
  });
});

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
