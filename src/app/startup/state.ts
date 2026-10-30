export interface StartupState {
  revision: number;
  attempt: number;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  frontendReady: boolean;
  completed: boolean;
}

export function newerStartup(current: StartupState | null, incoming: StartupState): StartupState {
  return !current || incoming.revision > current.revision ? incoming : current;
}

export function canEnterOperator(state: StartupState | null, animationFinished: boolean): boolean {
  return Boolean(animationFinished && state?.status === 'ready' && state.frontendReady && !state.completed);
}

export function operatorResourcesReady(library: boolean, presentation: boolean, displays: boolean, listener: boolean): boolean {
  return library && presentation && displays && listener;
}
