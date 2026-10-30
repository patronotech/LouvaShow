import { describe, expect, it } from 'vitest';
import { chartNotesKey, queueDestination, queueTarget } from './viewerState';
const queue = [{id:'first-occurrence',chartId:'same-chart',revision:1},{id:'second-occurrence',chartId:'same-chart',revision:3},{id:'last',chartId:'other-chart',revision:2}];
describe('repertório no visualizador', () => {
 it('preserva ocorrência e revisão mesmo com cifras repetidas', () => { expect(queueTarget(queue,0)).toEqual({id:'first-occurrence',chartId:'same-chart',revision:1}); expect(queueTarget(queue,1)).toEqual({id:'second-occurrence',chartId:'same-chart',revision:3}); });
 it('avança e volta sem circular silenciosamente nas bordas', () => { expect(queueDestination(queue,0,-1)).toBeNull(); expect(queueDestination(queue,0,1)).toBe(1); expect(queueDestination(queue,1,-1)).toBe(0); expect(queueDestination(queue,2,1)).toBeNull(); });
 it('não seleciona posição inválida', () => { expect(queueTarget(queue,-1)).toBeNull(); expect(queueTarget(queue,3)).toBeNull(); expect(queueTarget(queue,1.5)).toBeNull(); expect(queueDestination([],0,1)).toBeNull(); });
 it('isola notas de membros diferentes no mesmo navegador sem reaproveitar chave legada', () => { expect(chartNotesKey('church-chart', 'person-a')).not.toBe(chartNotesKey('church-chart', 'person-b')); expect(chartNotesKey('church-chart', 'person-a')).not.toBe('louvashow:musician:chart-notes:church-chart'); });
 it('notas possuem chave por cifra, independente do painel', () => { expect(chartNotesKey('one', 'person-a')).not.toBe(chartNotesKey('two', 'person-a')); expect(chartNotesKey('one', 'person-a')).toBe('louvashow:musician:chart-notes:v2:person-a:one'); expect(chartNotesKey('id/unsafe', 'person-a')).toContain('id%2Funsafe'); });
});
