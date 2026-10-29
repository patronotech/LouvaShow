export type OperatorContext = 'live' | 'setlists' | 'songs' | 'settings';
export type SettingsSection = 'projection' | 'appearance' | 'shortcuts' | 'about';

const contexts: { id: OperatorContext; label: string; path: string }[] = [
  { id: 'live', label: 'Operação ao vivo', path: 'M3 4h18v12H3z M8 21h8 M12 16v5 M9 8l6 3-6 3z' },
  { id: 'setlists', label: 'Repertórios', path: 'M8 5h13 M8 12h13 M8 19h13 M3 5h1 M3 12h1 M3 19h1' },
  { id: 'songs', label: 'Músicas', path: 'M9 18V5l11-2v13 M9 8l11-2 M9 18c0 2-6 4-6 1s6-4 6-1 M20 16c0 2-6 4-6 1s6-4 6-1' },
  { id: 'settings', label: 'Configurações', path: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6' },
];

export function ContextNavigation({ value, onChange }: { value: OperatorContext; onChange: (next: OperatorContext) => void }) {
  return <nav className="context-navigation" aria-label="Navegação principal" data-no-shortcuts>{contexts.map(context => <button key={context.id} aria-current={value === context.id ? 'page' : undefined} onClick={() => onChange(context.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={context.path} /></svg>{context.label}</button>)}</nav>;
}

export function SettingsNavigation({ value, onChange }: { value: SettingsSection; onChange: (next: SettingsSection) => void }) {
  const sections: { id: SettingsSection; label: string; description: string }[] = [
    { id: 'projection', label: 'Projeção', description: 'Monitor, texto e fundo' },
    { id: 'appearance', label: 'Aparência', description: 'Tamanho e posição dos painéis' },
    { id: 'shortcuts', label: 'Atalhos', description: 'Operação pelo teclado' },
    { id: 'about', label: 'Sobre', description: 'Créditos e comunidade' },
  ];
  return <aside className="settings-sidebar panel" data-no-shortcuts><span className="eyebrow">PREFERÊNCIAS</span><h2>Configurações</h2><nav aria-label="Seções de configurações">{sections.map(section => <button key={section.id} aria-current={value === section.id ? 'page' : undefined} onClick={() => onChange(section.id)}><strong>{section.label}</strong><span>{section.description}</span></button>)}</nav><p className="muted tiny">As configurações de apresentação só mudam a saída quando você aplica.</p></aside>;
}
