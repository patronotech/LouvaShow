import type { BibleBook, BibleChapter } from '../../shared/contracts';

export interface BibleSelection {
  versionId: string;
  bookId: string;
  chapterNumber: number | null;
  verseNumber: string | null;
}
export const initialSelection: BibleSelection = { versionId: '', bookId: '', chapterNumber: null, verseNumber: null };

export function shouldProjectVerse(projectOnClick: boolean, outputOpen: boolean, outputBusy: boolean): boolean {
  return projectOnClick && outputOpen && !outputBusy;
}
export type SelectionAction =
  | { type: 'version'; id: string }
  | { type: 'book'; id: string }
  | { type: 'chapter'; number: number }
  | { type: 'verse'; number: string };

/** Translation changes retain the canonical location; only explicit navigation resets descendants. */
export function selectLocation(state: BibleSelection, action: SelectionAction): BibleSelection {
  switch (action.type) {
    case 'version': return { ...state, versionId: action.id };
    case 'book': return { ...state, bookId: action.id, chapterNumber: null, verseNumber: null };
    case 'chapter': return { ...state, chapterNumber: action.number, verseNumber: null };
    case 'verse': return { ...state, verseNumber: action.number };
  }
}

export function passageAvailability(selection: BibleSelection, books: BibleBook[], booksVersionId: string, chapter: BibleChapter | null): string {
  if (!selection.bookId || booksVersionId !== selection.versionId) return '';
  const book = books.find(item => item.id === selection.bookId);
  if (!book) return 'Livro indisponível nesta versão';
  if (selection.chapterNumber !== null && (selection.chapterNumber < 1 || selection.chapterNumber > book.chapterCount)) return 'Capítulo indisponível nesta versão';
  if (chapter && chapter.versionId === selection.versionId && chapter.bookId === selection.bookId && chapter.chapter === selection.chapterNumber
    && selection.verseNumber !== null && !chapter.verses.some(verse => verse.number === selection.verseNumber)) return 'Versículo indisponível nesta versão';
  return '';
}
