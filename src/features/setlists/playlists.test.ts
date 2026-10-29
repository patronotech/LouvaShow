import { describe, expect, it, vi } from 'vitest';
import type { Setlist } from '../../shared/contracts';
import { updateSummaries } from './summaries';
import { playlistNameError } from './PlaylistDialog';
import { api } from '../../shared/contracts/api';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));

const setlist = (id: string, name: string, count: number): Setlist => ({ id, name, createdAt: '', updatedAt: '', items: Array.from({ length: count }, (_, index) => ({ id: `${id}-${index}`, setlistId: id, songId: 'repeated-song', position: index })) });

describe('playlists de eventos', () => {
  it('atualiza contagens por identidade, preservando as demais playlists', () => {
    const current = [{ id: 'a', name: 'Domingo', itemCount: 0 }, { id: 'b', name: 'Quarta', itemCount: 3 }];
    const next = updateSummaries(current, setlist('a', 'Domingo', 2));
    expect(next).toEqual([{ id: 'a', name: 'Domingo', itemCount: 2 }, { id: 'b', name: 'Quarta', itemCount: 3 }]);
    expect(current[0].itemCount).toBe(0);
    expect(updateSummaries(next, setlist('b', 'Quarta', 3), 'a')).toEqual([{ id: 'b', name: 'Quarta', itemCount: 3 }]);
  });
  it('rejeita nome vazio ou acima de 120 caracteres', () => {
    expect(playlistNameError('  ')).not.toBeNull();
    expect(playlistNameError('a'.repeat(121))).not.toBeNull();
    expect(playlistNameError('Culto de domingo')).toBeNull();
  });
  it('envia a identidade explícita da playlist em cada mutação de item', async () => {
    await api.addSetlistItem('event-a', 'song-1');
    expect(invoke).toHaveBeenLastCalledWith('add_setlist_item', { setlistId: 'event-a', songId: 'song-1' });
    await api.removeSetlistItem('event-b', 'item-2');
    expect(invoke).toHaveBeenLastCalledWith('remove_setlist_item', { setlistId: 'event-b', itemId: 'item-2' });
    await api.reorderSetlist('event-a', ['item-3', 'item-1']);
    expect(invoke).toHaveBeenLastCalledWith('reorder_setlist', { setlistId: 'event-a', orderedIds: ['item-3', 'item-1'] });
  });
});
