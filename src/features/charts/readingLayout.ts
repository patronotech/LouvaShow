export interface ReadingChordRect { left: number; top: number; width: number }

/** Pixel geometry keeps chord size independent from lyrics and reserves space on wraps. */
export function readingLineMetrics(fontSize: number, chordFontSize: number, gap: number, rows: number) {
  const chordHeight = chordFontSize * 1.25;
  const rowStep = chordHeight + 2;
  const count = Math.max(0, Math.ceil(rows));
  const above = count ? Math.max(0,chordHeight + (count - 1) * rowStep + gap) : 0;
  const below = count ? Math.max(0,-gap-fontSize*1.5) : 0;
  const stack = above + below;
  return {
    chordHeight,
    rowStep,
    stack,
    // Reserve the union of lyric and chord boxes. Negative gap permits overlap,
    // but never negative padding or an outer chord crossing adjacent metadata.
    lineHeight: fontSize * 1.5 + stack,
    paddingTop: above / 2,
    paddingBottom: below / 2,
    chordTop: (row: number) => -(chordHeight + gap + row * rowStep),
  };
}
/** Avoid collisions without inserting spaces or moving the words underneath. */
export function readingChordRows(rectangles: readonly ReadingChordRect[]): number[] {
  const result = rectangles.map(() => 0);
  const visualLines: { top: number; ends: number[] }[] = [];
  const order = rectangles.map((rectangle, index) => ({ ...rectangle, index }))
    .sort((a, b) => Math.abs(a.top - b.top) < 3 ? a.left - b.left || a.index - b.index : a.top - b.top);
  for (const item of order) {
    let line = visualLines.find(value => Math.abs(value.top - item.top) < 3);
    if (!line) { line = { top: item.top, ends: [] }; visualLines.push(line); }
    let row = line.ends.findIndex(end => end + 7 <= item.left);
    if (row < 0) row = line.ends.length;
    line.ends[row] = item.left + item.width;
    result[item.index] = row;
  }
  return result;
}
