import { describe, expect, it } from 'vitest';
import type { Song } from '../../shared/contracts';
import { filterSongs } from './LibraryManager';
import { MAX_IMPORT_BYTES, validateImportFiles } from './ImportDialog';

const song = (id: string, title: string, categoryId: string): Song => ({ id, title, categoryId, copyright: null, artist: null, createdAt: '', updatedAt: '', blocks: [] });
describe('gerenciamento e importação', () => {
  it('combina título sem acentos e classificação sem vazar músicas de outro filtro', () => {
    const songs = [song('1', 'Coração', 'hinos'), song('2', 'Coração', 'musica'), song('3', 'Paz', 'hinos')];
    expect(filterSongs(songs, 'CORACAO', 'hinos').map(item => item.id)).toEqual(['1']);
    expect(filterSongs(songs, '', 'hinos').map(item => item.id)).toEqual(['1', '3']);
    expect(filterSongs(songs, '', '').length).toBe(3);
  });
  it('rejeita formatos não suportados e soma tamanhos antes de ler arquivos', () => {
    expect(validateImportFiles([{ name: 'hinos.zip', size: MAX_IMPORT_BYTES }, { name: 'outro.txt', size: 1 }])).toContain('10 MiB');
    expect(validateImportFiles([{ name: 'programa.exe', size: 10 }])).toContain('XML');
    expect(validateImportFiles([])).toContain('Escolha');
    expect(validateImportFiles([{ name: 'música.XML', size: 100 }, { name: 'biblioteca.json', size: 100 }])).toBeNull();
  });
});
