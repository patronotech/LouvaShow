import { expect, it } from 'vitest';
import { applyReviewedChart, hasImportedIdentity } from './importReview';
import type { ChartDocument } from './contracts';

const current: ChartDocument = { schemaVersion: 1, title: 'Canção original', artist: 'Autor original', concertKey: null, capo: 0, spelling: 'sharps', sections: [], sequence: [], notes: 'Nota atual', preservedDirectives: [] };

it('mantém a identidade e atribui o arquivo quando a troca não é escolhida', () => {
  const imported = { ...current, title: 'Canção de teste - 9', artist: 'Autor exemplo', notes: 'Observação do arquivo' };
  const result = applyReviewedChart(current, imported, false);
  expect(result.title).toBe(current.title);
  expect(result.artist).toBe(current.artist);
  expect(result.notes).toContain('Autor exemplo — Canção de teste - 9');
  expect(result.notes).toContain('Nota atual');
  expect(result.notes).toContain('Observação do arquivo');
});

it('aplica metadados somente por escolha explícita sem alterar o documento de origem', () => {
  const imported = { ...current, title: 'Outra canção', artist: 'Outro autor' };
  expect(applyReviewedChart(current, imported, true)).toMatchObject({ title: 'Outra canção', artist: 'Outro autor' });
  expect(current.title).toBe('Canção original');
});

it('não substitui o título por um nome genérico de importação', () => {
  const imported = { ...current, title: 'Cifra importada', artist: null };
  expect(hasImportedIdentity(imported)).toBe(false);
  expect(applyReviewedChart(current, imported, true).title).toBe(current.title);
});
