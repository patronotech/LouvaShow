import type { BibleChapter, Snapshot } from '../../shared/contracts';
import { searchKey } from '../songs/lyrics';
import type { BibleBrowser } from './useBibleBrowser';
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
  return <aside className="bible-sidebar panel" aria-labelledby="bible-library-title" data-no-shortcuts>
    <div className="section-heading"><h2 id="bible-library-title">Bíblia</h2><span className="count">{browser.books.length} livros</span></div>
    <label className="bible-version">Versão<select value={browser.versionId} disabled={browser.loadingVersions || !browser.versions.length} onChange={event => browser.selectVersion(event.target.value)}>{!browser.versions.length && <option value="">{browser.loadingVersions ? 'Carregando versões…' : 'Nenhuma versão disponível'}</option>}{browser.versions.map(version => <option key={version.id} value={version.id}>{version.abbreviation} · {version.name}</option>)}</select></label>
    {browser.versionsError && <Recovery error={browser.versionsError} retry={browser.retryVersions} busy={browser.loadingVersions} />}
    <label className="bible-book-search"><span className="sr-only">Buscar livro da Bíblia</span><input type="search" value={browser.query} placeholder="Buscar livro…" onChange={event => browser.setQuery(event.target.value)} /></label>
    <p className="eyebrow">LIVROS</p>
    <div className="bible-book-list" role="group" aria-label="Livros da versão selecionada">
      {browser.loadingBooks ? <p role="status" className="empty">Carregando livros…</p> : browser.booksError ? <Recovery error={browser.booksError} retry={browser.retryBooks} busy={browser.loadingBooks} /> : visibleBooks.map(book => <button key={book.id} aria-pressed={book.id === browser.bookId} onClick={() => browser.selectBook(book.id)}><strong>{book.name}</strong><small>{book.chapterCount} {book.chapterCount === 1 ? 'capítulo' : 'capítulos'}</small></button>)}
      {!browser.loadingBooks && !browser.booksError && !visibleBooks.length && <p className="empty">{browser.query ? 'Nenhum livro encontrado. Tente outro nome.' : browser.versionsLoaded ? 'Nenhum livro disponível nesta instalação.' : 'Escolha uma versão para consultar os livros.'}</p>}
    </div>
    {browser.version && <details className="bible-license" open><summary>Fonte, licença e atribuição</summary><strong>{browser.version.name}</strong><p>{browser.version.attribution}</p><dl><dt>Idioma</dt><dd>{browser.version.language}</dd><dt>Licença</dt><dd>{browser.version.license}</dd><dt>Endereço da licença</dt><dd className="bible-source-url">{browser.version.licenseUrl}</dd><dt>Fonte do texto</dt><dd className="bible-source-url">{browser.version.sourceUrl}</dd></dl><p>Texto armazenado localmente. Os endereços podem ser selecionados e copiados.</p></details>}
  </aside>;
}

interface ContentProps { browser: BibleBrowser; snapshot: Snapshot | null; outputOpen: boolean; outputBusy: boolean; onPresent: (verse: string) => void }

export function BibleContent({ browser, snapshot, outputOpen, outputBusy, onPresent }: ContentProps) {
  const { book, chapter, verse, version } = browser;
  function chooseVerse(number: string) {
    browser.selectVerse(number);
    if (outputOpen && !outputBusy) onPresent(number);
  }
  return <section className="bible-workspace panel" aria-labelledby="bible-content-title">
    <div className="section-heading"><div><span className="eyebrow">CONSULTA E PROJEÇÃO</span><h2 id="bible-content-title">{book?.name ?? 'Texto bíblico'}</h2></div>{version && <span className="count">{version.abbreviation}</span>}</div>
    <p className="muted bible-description">Escolher versão, livro ou capítulo prepara a consulta e preserva a saída ao vivo.</p>
    {!book ? <div className="preparation-empty"><span aria-hidden="true">▤</span><h3>Escolha um livro para começar.</h3><p>Depois, selecione o capítulo e o versículo.<br />O texto fica disponível mesmo sem internet.</p></div> : <>
      <section className="bible-number-section" aria-labelledby="bible-chapters-title" data-no-shortcuts><div className="section-heading"><h3 id="bible-chapters-title">Capítulos</h3><span className="muted tiny">{book.chapterCount} disponíveis</span></div><div className="bible-number-grid chapter-grid">{Array.from({ length: book.chapterCount }, (_, index) => index + 1).map(number => <button key={number} aria-label={`${book.name}, capítulo ${number}`} aria-pressed={browser.chapterNumber === number} onClick={() => browser.selectChapter(number)}>{number}</button>)}</div></section>
      {browser.loadingChapter && <p role="status" className="empty">Carregando capítulo {browser.chapterNumber}…</p>}
      {browser.chapterError && <Recovery error={browser.chapterError} retry={browser.retryChapter} busy={browser.loadingChapter} />}
      {chapter && <section className="bible-number-section" aria-labelledby="bible-verses-title" data-no-shortcuts><div className="section-heading"><h3 id="bible-verses-title">{chapter.bookName} {chapter.chapter} · Versículos</h3><span className="count">{chapter.verses.length}</span></div><p className={`bible-click-hint ${outputOpen ? 'output-active' : ''}`}>{outputOpen ? 'Saída aberta: clicar em um versículo prepara e projeta imediatamente.' : 'Saída fechada: clicar em um versículo apenas prepara o texto.'}</p><div className="bible-number-grid verse-grid">{chapter.verses.map(item => {
        const inSession = isBibleVerseInSession(snapshot, chapter, item.number);
        const onAir = inSession && outputOpen && !snapshot?.blanked;
        return <button key={item.number} className={onAir ? 'on-air' : inSession ? 'in-session' : ''} aria-label={`${outputOpen ? 'Projetar' : 'Preparar'} ${chapter.bookName} ${chapter.chapter}:${item.number}${inSession ? onAir ? ', ao vivo' : ', na sessão' : ''}`} aria-pressed={browser.verseNumber === item.number} disabled={outputBusy} onClick={() => chooseVerse(item.number)}><span>{item.number}</span>{inSession && <small>{onAir ? 'Ao vivo' : 'Na sessão'}</small>}</button>;
      })}</div>{!chapter.verses.length && <p className="empty">Este capítulo não contém versículos disponíveis.</p>}</section>}
      {chapter && verse && <article className="bible-prepared" aria-labelledby="bible-prepared-title"><div className="section-heading"><div><span className="eyebrow">VERSÍCULO EM PREPARAÇÃO</span><h3 id="bible-prepared-title">{chapter.bookName} {chapter.chapter}:{verse.number} <span>{version?.abbreviation}</span></h3></div><span className="status-badge">{isBibleVerseInSession(snapshot, chapter, verse.number) ? outputOpen && !snapshot?.blanked ? '● Ao vivo' : '■ Na sessão' : 'Preparado'}</span></div><p className="bible-verse-text">{verse.text}</p><div className="bible-prepared-actions"><button className="primary" disabled={!outputOpen || outputBusy} onClick={() => onPresent(verse.number)}>↗ Projetar versículo</button><span className="muted tiny">{outputOpen ? 'As setas da barra navegam no capítulo que está na sessão.' : 'Abra a projeção pela barra inferior para enviar este texto.'}</span></div></article>}
    </>}
  </section>;
}

export function BiblePreparationSummary({ browser, outputOpen, outputBusy, onPresent }: Omit<ContentProps, 'snapshot'>) {
  const { chapter, verse, version } = browser;
  return <section className="context-selection"><span className="eyebrow">BÍBLIA EM PREPARAÇÃO</span><h3>{chapter && verse ? `${chapter.bookName} ${chapter.chapter}:${verse.number}` : browser.book?.name ?? 'Selecione um livro'}</h3><p>{version ? `${version.abbreviation} · ${version.name}` : 'Escolha a versão na coluna esquerda.'}</p>{chapter && verse ? <><p className="muted tiny">O texto completo está na área central. A prévia acima mostra a sessão efetivamente projetada.</p><button className="primary" disabled={!outputOpen || outputBusy} onClick={() => onPresent(verse.number)}>↗ Projetar versículo</button></> : <p>Escolha um capítulo e um versículo. Consultar outro livro não altera a projeção.</p>}<p className="muted tiny">Anterior e Próximo permanecem no capítulo já enviado à sessão, mesmo se você preparar outro livro.</p></section>;
}
