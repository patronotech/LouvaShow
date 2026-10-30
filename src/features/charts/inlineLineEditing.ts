import type { ChartLine } from './contracts';
import { graphemes } from './chordText';
import { editLineText } from './lineChordModel';

/** DOM selections use UTF-16; persisted anchors use complete graphemes. */
export function inlineCursorOffset(text: string, cursor: number): number {
  const position = Math.max(0, Math.min(text.length, cursor));
  return graphemes(text).filter(part => part.index + part.text.length <= position).length;
}

/** A lyric line stays one line; pasted paragraphs retain their word separators. */
export function pasteInlineText(line: ChartLine, start: number, end: number, pasted: string): { line: ChartLine; cursor: number } {
  const parts = graphemes(line.text);
  const startOffset = inlineCursorOffset(line.text, start);
  const from = parts[startOffset]?.index ?? line.text.length;
  const until = end <= start ? from : parts.find(part => part.index >= end)?.index ?? line.text.length;
  const inserted = pasted.replace(/\r\n?|\n/g, ' ');
  const text = line.text.slice(0, from) + inserted + line.text.slice(until);
  return { line: editLineText(line, text), cursor: from + inserted.length };
}
