import { useEffect, useRef, useState } from 'react';
import { version as APP_VERSION } from '../../../package.json';
import { api } from '../contracts/api';
import logoDark from '../assets/logo-dark.png';
import logoLight from '../assets/logo-light.png';
import authorPortrait from '../assets/author-portrait.png';

const SUPPORT_PIX_KEY = '44b40705-0339-4583-bb58-bab854c3eea3';
const SUPPORT_PAYPAL_EMAIL = 'dante.testa@gmail.com';

type SupportMethod = 'pix' | 'paypal';

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
      setNotice('Não foi possível copiar automaticamente. O campo está selecionado: use o comando Copiar do seu sistema.');
    } finally {
      setCopying(false);
    }
  }

  return <div className={`support-option support-option-${id}`}>
    <button className="support-toggle" aria-expanded={expanded} aria-controls={`support-${id}-details`} onClick={onToggle}>
      <span className="support-method-icon" aria-hidden="true">{id === 'pix' ? '◇' : 'P'}</span>
      <span>{title}</span>
      <span className="support-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    <div id={`support-${id}-details`} className="support-details" hidden={!expanded}>
      <label htmlFor={`support-${id}-value`}>{label}</label>
      <input ref={input} id={`support-${id}-value`} className="support-value" value={value} readOnly spellCheck={false} onFocus={event => event.currentTarget.select()} />
      <button disabled={copying} onClick={() => void copyValue()}>{copying ? 'Copiando…' : id === 'pix' ? 'Copiar chave Pix' : 'Copiar e-mail do PayPal'}</button>
      <p className="support-copy-notice" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
    </div>
  </div>;
}

export function AboutDialog({ onClose, colorMode = 'dark' }: { onClose: () => void; colorMode?: 'dark' | 'light' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opening, setOpening] = useState<'website' | 'community' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [supportMethod, setSupportMethod] = useState<SupportMethod | null>(null);
  const busy = opening !== null;

  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);

  async function openExternal(destination: 'website' | 'community') {
    if (busy) return;
    setOpening(destination);
    setError('');
    setNotice('');
    try {
      if (destination === 'website') await api.openAuthorWebsite();
      else await api.openCommunityGroup();
      setNotice(destination === 'website' ? 'O site foi enviado ao navegador padrão.' : 'O convite foi enviado ao navegador padrão.');
    } catch (reason) {
      setError(`Não foi possível abrir ${destination === 'website' ? 'o site' : 'o grupo'}. Verifique seu navegador e tente novamente. ${String(reason)}`);
    } finally {
      setOpening(null);
    }
  }

  function toggleSupport(method: SupportMethod) {
    setSupportMethod(current => current === method ? null : method);
  }

  return <dialog ref={dialog} className="about-dialog" aria-labelledby="about-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="about-heading">
      <div>
        <span className="eyebrow">CRÉDITOS E COMUNIDADE</span>
        <h2 id="about-title" className="sr-only">LouvaShow</h2>
        <img className="about-brand-logo" src={colorMode === 'light' ? logoLight : logoDark} alt="" aria-hidden="true" draggable={false} />
        <span className="about-version">Versão {APP_VERSION}</span>
      </div>
      <button autoFocus disabled={busy} onClick={onClose} aria-label="Fechar créditos e comunidade">×</button>
    </header>

    <section className="about-author" aria-label="Autoria">
      <img className="about-author-portrait" src={authorPortrait} alt="Retrato de Dante Testa" draggable={false} />
      <div><span className="about-author-caption">Idealização e desenvolvimento por</span><strong>Dante Testa.</strong></div>
    </section>
    <p>Software gratuito de projeção para igrejas, feito para facilitar a operação por voluntários. A biblioteca e a projeção funcionam localmente, sem conta ou conexão com a internet.</p>

    <div className="about-links">
      <button className="about-link-card" disabled={busy} onClick={() => void openExternal('website')} aria-label="Abrir site de Dante Testa no navegador">
        <span className="about-link-icon" aria-hidden="true">↗</span>
        <span><strong>{opening === 'website' ? 'Abrindo site…' : 'www.dantetesta.com.br'}</strong><span>Conheça outros projetos de Dante Testa</span></span>
        <span aria-hidden="true">↗</span>
      </button>
      <button className="about-link-card about-community-card" disabled={busy} onClick={() => void openExternal('community')} aria-label="Abrir grupo do LouvaShow no WhatsApp">
        <span className="about-link-icon" aria-hidden="true">☏</span>
        <span><strong>{opening === 'community' ? 'Abrindo convite…' : 'Comunidade no WhatsApp'}</strong><span>Sugestões, colaboração e relatos de bugs</span></span>
        <span aria-hidden="true">↗</span>
      </button>
    </div>
    <p className="tiny about-external-note">Os links abrem no navegador padrão. Acesso opcional, com internet.</p>
    {error && <p role="alert" className="error-message">{error}</p>}
    <p role="status" className="about-link-notice" aria-live="polite">{notice}</p>

    <section className="support-section" aria-labelledby="support-title">
      <h3 id="support-title">Apoie o projeto</h3>
      <p>O LouvaShow é gratuito. Sua contribuição ajuda o desenvolvimento e é inteiramente voluntária.</p>
      <div className="support-options">
        <SupportOption id="pix" title="Apoiar com Pix" label="Chave Pix aleatória" value={SUPPORT_PIX_KEY} expanded={supportMethod === 'pix'} onToggle={() => toggleSupport('pix')} />
        <SupportOption id="paypal" title="Apoiar com PayPal" label="E-mail do PayPal" value={SUPPORT_PAYPAL_EMAIL} expanded={supportMethod === 'paypal'} onToggle={() => toggleSupport('paypal')} />
      </div>
    </section>
    <div className="dialog-actions"><button disabled={busy} onClick={onClose}>Fechar</button></div>
  </dialog>;
}
