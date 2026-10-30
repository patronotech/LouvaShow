import { useEffect, useRef, useState } from 'react';
import type { BibleBook, BibleChapter, BibleVersion } from '../../shared/contracts';
import { api } from '../../shared/contracts/api';
import { LatestRequest } from './latestRequest';

/** Owned by Operator so context changes preserve the reader without affecting the live snapshot. */
export function useBibleBrowser(enabled: boolean) {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [versionId, setVersionId] = useState('');
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [bookId, setBookId] = useState('');
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [chapter, setChapter] = useState<BibleChapter | null>(null);
  const [verseNumber, setVerseNumber] = useState<string | null>(null);
  const [query, setQuery] = useState('');
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
      success: next => { setVersions(next); setVersionsLoaded(true); setVersionId(current => current || next[0]?.id || ''); },
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
      success: next => setBooks(next),
      failure: reason => setBooksError(`Não foi possível carregar os livros. ${String(reason)}`),
      settled: () => setLoadingBooks(false),
    });
    return () => request.invalidate();
  }, [versionId, booksRetry]);

  useEffect(() => {
    if (!versionId || !bookId || chapterNumber === null) return;
    const request = chapterRequest.current;
    setLoadingChapter(true); setChapterError('');
    void request.run(() => api.getBibleChapter(versionId, bookId, chapterNumber), {
      success: next => setChapter(next),
      failure: reason => setChapterError(`Não foi possível carregar este capítulo. ${String(reason)}`),
      settled: () => setLoadingChapter(false),
    });
    return () => request.invalidate();
  }, [versionId, bookId, chapterNumber, chapterRetry]);

  function selectVersion(id: string) {
    if (id === versionId) return;
    booksRequest.current.invalidate(); chapterRequest.current.invalidate();
    setVersionId(id); setBooks([]); setBookId(''); setChapterNumber(null); setChapter(null); setVerseNumber(null);
    setBooksError(''); setChapterError(''); setLoadingChapter(false); setQuery('');
  }
  function selectBook(id: string) {
    if (id === bookId) return;
    chapterRequest.current.invalidate();
    setBookId(id); setChapterNumber(null); setChapter(null); setVerseNumber(null); setChapterError(''); setLoadingChapter(false);
  }
  function selectChapter(number: number) {
    if (number === chapterNumber) return;
    chapterRequest.current.invalidate();
    setChapterNumber(number); setChapter(null); setVerseNumber(null); setChapterError('');
  }
  return {
    versions, versionId, books, bookId, chapterNumber, chapter, verseNumber, query,
    version: versions.find(version => version.id === versionId) ?? null,
    book: books.find(book => book.id === bookId) ?? null,
    verse: chapter?.verses.find(verse => verse.number === verseNumber) ?? null,
    loadingVersions, loadingBooks, loadingChapter, versionsLoaded, versionsError, booksError, chapterError,
    setQuery, selectVersion, selectBook, selectChapter, selectVerse: setVerseNumber,
    retryVersions: () => setVersionsRetry(current => current + 1),
    retryBooks: () => setBooksRetry(current => current + 1),
    retryChapter: () => setChapterRetry(current => current + 1),
  };
}

export type BibleBrowser = ReturnType<typeof useBibleBrowser>;
