import { useEffect, useReducer, useRef, useState } from 'react';
import type { BibleBook, BibleChapter, BibleVersion } from '../../shared/contracts';
import { api } from '../../shared/contracts/api';
import { LatestRequest } from './latestRequest';
import { initialSelection, initialBibleInteractionMode, passageAvailability, selectLocation, type BibleInteractionMode } from './selection';

/** Owned by Operator so context changes preserve the reader without affecting the live snapshot. */
export function useBibleBrowser(enabled: boolean) {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [selection, dispatch] = useReducer(selectLocation, initialSelection);
  const { versionId, bookId, chapterNumber, verseNumber } = selection;
  const [booksVersionId, setBooksVersionId] = useState('');
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [bookNames, setBookNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [query, setQuery] = useState('');
  const [interactionMode, setInteractionMode] = useState<BibleInteractionMode>(initialBibleInteractionMode);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingChapter, setLoadingChapter] = useState(false);
  const [versionsError, setVersionsError] = useState('');
  const [booksError, setBooksError] = useState('');
  const [chapterError, setChapterError] = useState('');
  const [versionsRetry, setVersionsRetry] = useState(0);
  const [booksRetry, setBooksRetry] = useState(0);
  const [chapterRetry, setChapterRetry] = useState(0);
  const versionsRequest = useRef(new LatestRequest());
  const booksRequest = useRef(new LatestRequest());
  const chapterRequest = useRef(new LatestRequest());

  useEffect(() => {
    if (!enabled || versionsLoaded) return;
    const request = versionsRequest.current;
    setLoadingVersions(true); setVersionsError('');
    void request.run(api.listBibleVersions, {
      success: next => { setVersions(next); setVersionsLoaded(true); dispatch({ type: 'version', id: next[0]?.id || '' }); },
      failure: reason => setVersionsError(`Não foi possível carregar as versões da Bíblia. ${String(reason)}`),
      settled: () => setLoadingVersions(false),
    });
    return () => request.invalidate();
  }, [enabled, versionsLoaded, versionsRetry]);

  useEffect(() => {
    if (!versionId) return;
    const request = booksRequest.current;
    setLoadingBooks(true); setBooksError('');
    void request.run(() => api.listBibleBooks(versionId), {
      success: next => {
        setBooks(next); setBooksVersionId(versionId);
        // Retain labels only: text and availability still belong to the current translation.
        setBookNames(current => new Map([...current, ...next.map(book => [book.id, book.name] as const)]));
      },
      failure: reason => setBooksError(`Não foi possível carregar os livros. ${String(reason)}`),
      settled: () => setLoadingBooks(false),
    });
    return () => request.invalidate();
  }, [versionId, booksRetry]);

  useEffect(() => {
    if (!versionId || !bookId || chapterNumber === null || booksVersionId !== versionId) return;
    const selectedBook = books.find(book => book.id === bookId);
    if (!selectedBook || chapterNumber > selectedBook.chapterCount) return;
    const request = chapterRequest.current;
    setLoadingChapter(true); setChapterError('');
    void request.run(() => api.getBibleChapter(versionId, bookId, chapterNumber), {
      success: next => setChapter(next),
      failure: reason => setChapterError(`Não foi possível carregar este capítulo. ${String(reason)}`),
      settled: () => setLoadingChapter(false),
    });
    return () => request.invalidate();
  }, [versionId, bookId, chapterNumber, chapterRetry, books, booksVersionId]);

  function selectVersion(id: string) {
    if (id === versionId) return;
    booksRequest.current.invalidate(); chapterRequest.current.invalidate();
    dispatch({ type: 'version', id }); setBooks([]); setBooksVersionId(''); setChapter(null);
    setBooksError(''); setChapterError(''); setLoadingChapter(false);
  }
  function selectBook(id: string) {
    if (id === bookId) return;
    chapterRequest.current.invalidate();
    dispatch({ type: 'book', id }); setChapter(null); setChapterError(''); setLoadingChapter(false);
  }
  function selectChapter(number: number) {
    if (number === chapterNumber) return;
    chapterRequest.current.invalidate();
    dispatch({ type: 'chapter', number }); setChapter(null); setChapterError('');
  }
  return {
    versions, versionId, books, bookId, chapterNumber, chapter, verseNumber, query, interactionMode, setInteractionMode,
    version: versions.find(version => version.id === versionId) ?? null,
    book: books.find(book => book.id === bookId) ?? null,
    bookName: bookNames.get(bookId) ?? null,
    verse: chapter?.verses.find(verse => verse.number === verseNumber) ?? null,
    loadingVersions, loadingBooks, loadingChapter, versionsLoaded, versionsError, booksError, chapterError,
    locationMessage: passageAvailability(selection, books, booksVersionId, chapter),
    setQuery, selectVersion, selectBook, selectChapter, selectVerse: (number: string) => dispatch({ type: 'verse', number }),
    retryVersions: () => setVersionsRetry(current => current + 1),
    retryBooks: () => setBooksRetry(current => current + 1),
    retryChapter: () => setChapterRetry(current => current + 1),
  };
}

export type BibleBrowser = ReturnType<typeof useBibleBrowser>;
