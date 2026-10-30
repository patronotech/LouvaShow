import { invoke } from '@tauri-apps/api/core';
import type { StartupState } from './state';

export const startupApi = {
  getState: () => invoke<StartupState>('get_startup_state'),
  operatorReady: (attempt: number) => invoke<void>('mark_operator_ready', { attempt }),
  operatorFailed: (attempt: number, message: string) => invoke<void>('mark_operator_failed', { attempt, message }),
  complete: () => invoke<void>('complete_startup'),
  retry: () => invoke<StartupState>('retry_startup'),
  close: () => invoke<void>('close_startup'),
};
