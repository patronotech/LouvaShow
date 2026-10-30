import type { BibleChapter, Snapshot } from '../../shared/contracts';
import { searchKey } from '../songs/lyrics';
import type { BibleBrowser } from './useBibleBrowser';
import { bibleKeyboardGesture, shouldProjectVerse, type BibleVerseGesture } from './selection';
import './bible.css';

export function isBibleVerseInSession(snapshot: Snapshot | null, chapter: BibleChapter, verse: string): boolean {
  const bible = snapshot?.bible;
  return Boolean(bible && bible.versionId === chapter.versionId && bible.bookId === chapter.bookId && bible.chapter === chapter.chapter
    && snapshot?.blocks[snapshot.blockIndex]?.id.startsWith(`bible:${chapter.versionId}:${chapter.bookId}:${chapter.chapter}:${verse}:`));
}

function Recovery({ error, retry, busy }: { error: string; retry: () => void; busy: boolean }) {
  return <div className="error-message"><p role="alert">{error}</p><button disabled={busy} onClick={retry}>Tentar novamente</button></div>;
}

export function BibleSidebar({ browser }: { browser: BibleBrowser }) {
  const visibleBooks = browser.books.filter(book => searchKey(book.name).includes(searchKey(browser.query)));
  return <aside className="bible-sidebar panel" aria-label="Livros da Bíblia" data-no-shortcuts>
    <label className="bible-book-search"><span className="sr-only">Buscar livro da Bíblia</span><input type="search" value={browser.query} placeholder="Buscar livro…" onChange={event => browser.setQuery(event.target.value)} /></label>
    <div className="bible-book-list" role="group" aria-label="Livros da versão selecionada">
      {browser.loadingBooks ? <p role="status" className="empty">Carregando livros…</p> : browser.booksError ? <Recovery error={browser.booksError} retry={browser.retryBooks} busy={browser.loadingBooks} /> : visibleBooks.map(book => <button key={book.id} aria-pressed={book.id === browser.bookId} onClick={() => browser.selectBook(book.id)}><strong>{book.name}</strong><small aria-label={`${book.chapterCount} capítulos`}>{book.chapterCount}</small></button>)}
      {!browser.loadingBooks && !browser.booksError && !visibleBooks.length && <p className="empty">{browser.query ? 'Nenhum livro encontrado.' : 'Nenhum livro disponível.'}</p>}
    </div>
    {browser.version && <details className="bible-license"><summary>Fonte e licença · {browser.version.abbreviation}</summary><strong>{browser.version.name}</strong><p>{browser.version.attribution}</p><dl><dt>Idioma</dt><dd>{browser.version.language}</dd><dt>Licença</dt><dd>{browser.version.license}</dd><dt>Endereço da licença</dt><dd className="bible-source-url">{browser.version.licenseUrl}</dd><dt>Fonte do texto</dt><dd className="bible-source-url">{browser.version.sourceUrl}</dd></dl></details>}
  </aside>;
}

interface ContentProps { browser: BibleBrowser; snapshot: Snapshot | null; outputOpen: boolean; outputBusy: boolean; onPresent: (verse: string) => void }

export function BibleContent({ browser, snapshot, outputOpen, outputBusy, onPresent }: ContentProps) {
  const { book, chapter, verse, version } = browser;
  const selectedInSession = Boolean(chapter && verse && isBibleVerseInSession(snapshot, chapter, verse.number));
  const selectedOnAir = selectedInSession && outputOpen && !snapshot?.blanked;
  function chooseVerse(number: string, gesture:BibleVerseGesture='click') {
    browser.selectVerse(number);
    if (shouldProjectVerse(browser.interactionMode, gesture, outputOpen, outputBusy)) onPresent(number);
  }
  return <section className="bible-workspace panel" aria-labelledby="bible-content-title">
    <div className="bible-version-strip" role="group" aria-label="Tradução da Bíblia" data-no-shortcuts>
      {browser.versions.map(item => <button key={item.id} type="button" aria-pressed={item.id === browser.versionId} title={item.name} aria-label={`${item.abbreviation}: ${item.name}`} onClick={() => browser.selectVersion(item.id)}>{item.abbreviation}</button>)}
      {browser.loadingVersions && <span role="status">Carregando versões…</span>}
    </div>
    <div className="bible-click-controls" data-no-shortcuts>
      <div className="bible-click-mode" style={{flexWrap:'wrap'}} role="group" aria-label="Ação ao clicar em um versículo">
        <button type="button" aria-pressed={browser.interactionMode==='prepare'} disabled={outputBusy} onClick={() => browser.setInteractionMode('prepare')}>Preparar</button>
        <button type="button" aria-pressed={browser.interactionMode==='single'} disabled={outputBusy} onClick={() => browser.setInteractionMode('single')}>Projetar ao clicar</button>
        <button type="button" aria-pressed={browser.interactionMode==='double'} disabled={outputBusy} onClick={() => browser.setInteractionMode('double')} title="Clique duplo ou Shift+Enter para projetar">Clique duplo</button>
      </div>
      {!outputOpen && <span className="muted" role="status">Saída fechada</span>}
    </div>
    {browser.versionsError && <Recovery error={browser.versionsError} retry={browser.retryVersions} busy={browser.loadingVersions} />}
    <div className="section-heading bible-heading"><h2 id="bible-content-title">{book?.name ?? browser.bookName ?? 'Bíblia'}{browser.chapterNumber !== null && ` ${browser.chapterNumber}`}</h2>{version && <span className="muted" title={version.name}>{version.abbreviation}</span>}</div>
    {browser.locationMessage && <p className="bible-location-message" role="status">{browser.locationMessage}</p>}
    {!book ? !browser.locationMessage && <p className="empty">{browser.loadingBooks ? 'Carregando livros…' : 'Selecione um livro.'}</p> : <>
      <section className="bible-number-section" aria-labelledby="bible-chapters-title" data-no-shortcuts><h3 id="bible-chapters-title">Capítulos</h3><div className="bible-number-grid chapter-grid">{Array.from({ length: book.chapterCount }, (_, index) => index + 1).map(number => <button key={number} aria-label={`${book.name}, capítulo ${number}`} aria-pressed={browser.chapterNumber === number} onClick={() => browser.selectChapter(number)}>{number}</button>)}</div></section>
      {browser.loadingChapter && <p role="status" className="empty">Carregando capítulo…</p>}
      {browser.chapterError && <Recovery error={browser.chapterError} retry={browser.retryChapter} busy={browser.loadingChapter} />}
      {chapter && <section className="bible-number-section" aria-labelledby="bible-verses-title" data-no-shortcuts><h3 id="bible-verses-title">Versículos</h3><div className="bible-number-grid verse-grid">{chapter.verses.map(item => {
        const inSession = isBibleVerseInSession(snapshot, chapter, item.number);
        const onAir = inSession && outputOpen && !snapshot?.blanked;
        return <button key={item.number} className={onAir ? 'on-air' : inSession ? 'in-session' : ''} aria-label={`${shouldProjectVerse(browser.interactionMode, 'click', outputOpen, outputBusy) ? 'Projetar' : 'Preparar'} ${chapter.bookName} ${chapter.chapter}:${item.number}${inSession ? onAir ? ', ao vivo' : ', na sessão' : ''}`} aria-pressed={browser.verseNumber === item.number} aria-keyshortcuts={browser.interactionMode==='double'?'Shift+Enter':undefined} title={browser.interactionMode==='double'?'Clique duplo ou Shift+Enter para projetar':undefined} onClick={() => chooseVerse(item.number)} onDoubleClick={browser.interactionMode==='double'?()=>chooseVerse(item.number,'doubleClick'):undefined} onKeyDown={event=>{if(browser.interactionMode!=='double')return;const gesture=bibleKeyboardGesture(event.key,event.shiftKey,event.repeat);if(event.key==='Enter'&&event.shiftKey){event.preventDefault();event.stopPropagation();if(gesture)chooseVerse(item.number,gesture);}}}>{item.number}</button>;
      })}</div>{!chapter.verses.length && <p className="empty">Sem versículos disponíveis.</p>}</section>}
      {chapter && verse && <article className="bible-prepared" aria-labelledby="bible-prepared-title"><div className="section-heading"><h3 id="bible-prepared-title">{chapter.bookName} {chapter.chapter}:{verse.number} <span>{version?.abbreviation}</span></h3>{(selectedInSession || browser.interactionMode!=='single') && <span className={`status-badge ${selectedOnAir ? 'on-air' : ''}`} role="status">{selectedInSession ? selectedOnAir ? '● Ao vivo' : '■ Na sessão' : 'Preparado'}</span>}</div><p className="bible-verse-text">{verse.text}</p></article>}
    </>}
  </section>;
}

export function BiblePreparationSummary({ browser, outputOpen, outputBusy, onPresent }: Omit<ContentProps, 'snapshot'>) {
  const { chapter, verse, version } = browser;
  return <section className="context-selection bible-preparation-summary"><h3>{chapter && verse ? `${chapter.bookName} ${chapter.chapter}:${verse.number}` : browser.book?.name ?? browser.bookName ?? 'Bíblia'}</h3>{version && <p>{version.abbreviation}</p>}{chapter && verse && <button className="primary" disabled={!outputOpen || outputBusy} onClick={() => {if(shouldProjectVerse(browser.interactionMode,'explicit',outputOpen,outputBusy))onPresent(verse.number);}}>↗ Projetar versículo</button>}</section>;
}
