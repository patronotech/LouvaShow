import { useEffect, useRef, useState } from 'react';
import { api } from '../contracts/api';

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.showModal();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  async function openCommunity() {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.openCommunityGroup(); setNotice('O convite foi enviado ao navegador padrão.'); }
    catch (reason) { setError(`Não foi possível abrir o grupo. Verifique seu navegador e tente novamente. ${String(reason)}`); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="about-dialog" aria-labelledby="about-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="section-heading"><div><span className="eyebrow">CRÉDITOS E COMUNIDADE</span><h2 id="about-title">LouvaShow</h2></div><button autoFocus disabled={busy} onClick={onClose} aria-label="Fechar créditos e comunidade">×</button></div>
    <p>Software gratuito de projeção para igrejas, feito para facilitar a operação por voluntários.</p>
    <p>A biblioteca e a projeção funcionam localmente, sem conta ou conexão com a internet.</p>
    <section className="community-section" aria-labelledby="community-title"><h3 id="community-title">Construa o LouvaShow com a comunidade</h3><p>Participe do grupo para enviar sugestões, colaborar com o projeto e reportar bugs.</p><button className="primary" disabled={busy} onClick={() => void openCommunity()}>{busy ? 'Abrindo convite…' : '↗ Abrir grupo no WhatsApp'}</button><p className="muted tiny">Abre um convite de chat.whatsapp.com no navegador padrão. O acesso ao grupo requer internet e é opcional.</p></section>
    {error && <p role="alert" className="error-message">{error}</p>}{notice && <p role="status" className="manager-notice">{notice}</p>}
    <div className="dialog-actions"><button disabled={busy} onClick={onClose}>Fechar</button></div>
  </dialog>;
}
