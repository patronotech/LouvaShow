/** Blank lines divide blocks; line breaks inside a block remain unchanged. */
export function splitLyrics(lyrics: string): string[] {
  return lyrics.replace(/\r\n?/g, '\n').split(/\n[\t ]*\n(?:[\t ]*\n)*/)
    .map(text => text.trim()).filter(Boolean);
}

export function searchKey(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function moveItem<T extends { id: string }>(items: readonly T[], id: string, destination: number): T[] {
  const source = items.findIndex(item => item.id === id);
  if (source < 0 || destination < 0 || destination >= items.length || source === destination) return [...items];
  const result = [...items];
  const [item] = result.splice(source, 1);
  result.splice(destination, 0, item!);
  return result;
}
