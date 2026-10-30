import { describe, expect, it } from 'vitest';
import { canEnterOperator, newerStartup, operatorResourcesReady, type StartupState } from './state';

const ready: StartupState = { revision: 3, attempt: 0, status: 'ready', error: null, frontendReady: true, completed: false };

describe('coordenação da abertura', () => {
  it('aguarda vídeo e os dois estágios de inicialização, em qualquer ordem', () => {
    expect(canEnterOperator(ready, false)).toBe(false);
    expect(canEnterOperator({ ...ready, frontendReady: false }, true)).toBe(false);
    expect(canEnterOperator({ ...ready, status: 'loading' }, true)).toBe(false);
    expect(canEnterOperator(ready, true)).toBe(true);
  });
  it('não revela o operador automaticamente em erro ou após concluir', () => {
    expect(canEnterOperator({ ...ready, status: 'error', error: 'Banco indisponível' }, true)).toBe(false);
    expect(canEnterOperator({ ...ready, completed: true }, true)).toBe(false);
    expect(canEnterOperator(null, true)).toBe(false);
  });
  it('uma consulta antiga não substitui evento mais recente', () => {
    expect(newerStartup(ready, { ...ready, revision: 2, frontendReady: false })).toBe(ready);
    expect(newerStartup(ready, { ...ready, frontendReady: false })).toBe(ready);
    const next = { ...ready, revision: 4, attempt: 1, frontendReady: false };
    expect(newerStartup(ready, next)).toBe(next);
    expect(newerStartup(null, ready)).toBe(ready);
  });
  it('não informa pronto antes da biblioteca, snapshot, monitores e listener', () => {
    expect(operatorResourcesReady(true, true, true, true)).toBe(true);
    expect(operatorResourcesReady(false, true, true, true)).toBe(false);
    expect(operatorResourcesReady(true, false, true, true)).toBe(false);
    expect(operatorResourcesReady(true, true, false, true)).toBe(false);
    expect(operatorResourcesReady(true, true, true, false)).toBe(false);
  });
});
