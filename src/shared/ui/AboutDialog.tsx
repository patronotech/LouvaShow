import { useEffect, useRef, useState } from 'react';
import { version as APP_VERSION } from '../../../package.json';
import { api } from '../contracts/api';
import logoDark from '../assets/logo-dark.png';
import logoLight from '../assets/logo-light.png';
import authorPortrait from '../assets/author-portrait.png';
import './aboutDialog.css';

const SUPPORT_PIX_KEY = '44b40705-0339-4583-bb58-bab854c3eea3';
const SUPPORT_PAYPAL_EMAIL = 'dante.testa@gmail.com';

type SupportMethod = 'pix' | 'paypal';
type ExternalDestination = 'website' | 'community' | 'contact';

function AboutIcon({ name }: { name: 'close' | 'external' | 'globe' | 'chat' | 'copy' | 'heart' | 'chevron' }) {
  const paths = {
    close: 'M6 6l12 12M18 6 6 18',
    external: 'M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c4 5 4 13 0 18-4-5-4-13 0-18Z',
    chat: 'M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5Z',
    copy: 'M9 9h12v12H9ZM15 5V3H3v12h2',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    chevron: 'm6 9 6 6 6-6',
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}

function SupportIcon({ method }: { method: SupportMethod }) {
  // Simple Icons, CC0-1.0; brand names identify payment methods, not endorsement.
  // https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md
  // Paths: icons/pix.svg and icons/paypal.svg in the same official repository.
  const paths = {
    pix: 'M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156',
    paypal: 'M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z',
  };
  return <svg className={`support-brand-icon support-brand-${method}`} viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true" focusable="false"><path d={paths[method]} /></svg>;
}

function SupportOption({ id, title, label, value, expanded, onToggle }: {
  id: SupportMethod;
  title: string;
  label: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState('');

  async function copyValue() {
    if (copying) return;
    setCopying(true);
    setNotice('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setNotice(id === 'pix' ? 'Chave Pix copiada.' : 'E-mail do PayPal copiado.');
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice('Campo selecionado. Use ⌘C ou Ctrl+C para copiar.');
    } finally {
      setCopying(false);
    }
  }

  return <div className={`support-option support-option-${id}`}>
    <button className="support-toggle" aria-expanded={expanded} aria-controls={`support-${id}-details`} onClick={onToggle}>
      <SupportIcon method={id} />
      <strong>{title}</strong>
      <span className="support-chevron"><AboutIcon name="chevron" /></span>
    </button>
    <div id={`support-${id}-details`} className="support-details" hidden={!expanded}>
      <label htmlFor={`support-${id}-value`}>{label}</label>
      <input ref={input} id={`support-${id}-value`} className="support-value" value={value} readOnly spellCheck={false} onFocus={event => event.currentTarget.select()} />
      <button className="support-copy" disabled={copying} onClick={() => void copyValue()}><AboutIcon name="copy" />{copying ? 'Copiando…' : id === 'pix' ? 'Copiar chave Pix' : 'Copiar e-mail'}</button>
      <p className="support-copy-notice" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
    </div>
  </div>;
}

export function AboutDialog({ onClose, colorMode = 'classic' }: { onClose: () => void; colorMode?: 'classic' | 'dark' | 'light' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opening, setOpening] = useState<ExternalDestination | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [supportMethod, setSupportMethod] = useState<SupportMethod | null>(null);
  const busy = opening !== null;

  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);

  async function openExternal(destination: ExternalDestination) {
    if (busy) return;
    setOpening(destination);
    setError('');
    setNotice('');
    try {
      if (destination === 'community') await api.openCommunityGroup();
      else if (destination === 'contact') await api.openAuthorContact();
      else await api.openAuthorWebsite();
      setNotice(destination === 'community' ? 'Convite aberto no navegador.' : destination === 'contact' ? 'Contato aberto no navegador.' : 'Site aberto no navegador.');
    } catch {
      setError('Não foi possível abrir o navegador. Tente novamente.');
    } finally {
      setOpening(null);
    }
  }

  function toggleSupport(method: SupportMethod) {
    setSupportMethod(current => current === method ? null : method);
  }

  return <dialog ref={dialog} className="about-dialog" aria-labelledby="about-title" data-no-shortcuts onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="about-heading">
      <img className="about-brand-logo" src={colorMode === 'dark' ? logoDark : logoLight} alt="LouvaShow" draggable={false} />
      <div className="about-heading-label">
        <h2 id="about-title">Créditos</h2>
        <span className="about-version">LouvaShow {APP_VERSION}</span>
      </div>
      <button className="about-close" autoFocus disabled={busy} onClick={onClose} aria-label="Fechar créditos"><AboutIcon name="close" /></button>
    </header>

    <div className="about-people-row">
      <section className="about-author" aria-label="Autoria">
        <img className="about-author-portrait" src={authorPortrait} alt="Retrato de Dante Testa" draggable={false} />
        <div><strong>Dante Testa</strong><span className="about-author-caption">Idealização e desenvolvimento</span></div>
      </section>
      <section className="about-services" aria-labelledby="about-services-title">
        <h3 id="about-services-title">Tem uma ideia?</h3>
        <p>Vamos desenvolver seu próximo software.</p>
        <button disabled={busy} onClick={() => void openExternal('contact')}><AboutIcon name="chat" />{opening === 'contact' ? 'Abrindo…' : 'Conversar no WhatsApp'}</button>
      </section>
    </div>

    <div className="about-links">
      <button className="about-link-card" disabled={busy} onClick={() => void openExternal('website')} aria-label="Abrir site de Dante Testa no navegador">
        <span className="about-link-icon"><AboutIcon name="globe" /></span>
        <span><strong>{opening === 'website' ? 'Abrindo site…' : 'Site do autor'}</strong><span>dantetesta.com.br</span></span>
        <AboutIcon name="external" />
      </button>
      <button className="about-link-card about-community-card" disabled={busy} onClick={() => void openExternal('community')} aria-label="Abrir grupo do LouvaShow no WhatsApp">
        <span className="about-link-icon"><AboutIcon name="chat" /></span>
        <span><strong>{opening === 'community' ? 'Abrindo convite…' : 'Comunidade'}</strong><span>Sugestões e ajuda no WhatsApp</span></span>
        <AboutIcon name="external" />
      </button>
    </div>
    {error && <p role="alert" className="error-message">{error}</p>}
    <p role="status" className="about-link-notice" aria-live="polite">{notice}</p>

    <section className="support-section" aria-labelledby="support-title">
      <div className="support-heading"><h3 id="support-title"><AboutIcon name="heart" />Apoie o LouvaShow</h3><span>Contribuição voluntária</span></div>
      <div className="support-options">
        <SupportOption id="pix" title="Pix" label="Chave aleatória" value={SUPPORT_PIX_KEY} expanded={supportMethod === 'pix'} onToggle={() => toggleSupport('pix')} />
        <SupportOption id="paypal" title="PayPal" label="E-mail para apoio" value={SUPPORT_PAYPAL_EMAIL} expanded={supportMethod === 'paypal'} onToggle={() => toggleSupport('paypal')} />
      </div>
    </section>
    <footer className="about-footer"><span>Projeção gratuita para igrejas.</span><button disabled={busy} onClick={onClose}>Fechar</button></footer>
  </dialog>;
}
