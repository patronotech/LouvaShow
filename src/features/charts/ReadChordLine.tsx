import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { ChartLine } from './chordText';
import { readingChordRows, readingLineMetrics } from './readingLayout';
import './chartReader.css';

export function ReadChordLine({ line, layoutKey, fontSize = 19, chordFontSize = fontSize * .85, chordGap = 4 }: { line: ChartLine; layoutKey: string; fontSize?: number; chordFontSize?: number; chordGap?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ rows: [] as number[], shifts: [] as number[], maximum: 1 });
  const instrumental = !line.tokens.some(token => token.text.trim());
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || instrumental) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const boundary = element.getBoundingClientRect();
      const shifts: number[] = [];
      const rectangles = Array.from(element.querySelectorAll<HTMLElement>('[data-reading-chord]')).map(label => {
        const anchor = label.parentElement!.getClientRects()[0] || label.parentElement!.getBoundingClientRect();
        const width = label.getBoundingClientRect().width;
        const left = Math.max(boundary.left, Math.min(anchor.left, boundary.right - width));
        shifts.push(left - anchor.left);
        return { left, top: anchor.top, width };
      });
      const rows = readingChordRows(rectangles);
      const next = { rows, shifts, maximum: Math.max(1, ...rows.map(row => row + 1)) };
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    element.querySelectorAll('[data-reading-chord]').forEach(label => observer.observe(label));
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', measure); };
  }, [line, layoutKey, instrumental, fontSize, chordFontSize, chordGap]);

  if (instrumental) return <div className="chord-instrumental-line" aria-label="Instrumental">{line.tokens.filter(token => token.chord).map((token, index) => <strong key={index}>{token.chord}</strong>)}</div>;
  const hasChords = line.tokens.some(token => token.chord);
  const metrics = readingLineMetrics(fontSize, chordFontSize, chordGap, hasChords ? layout.maximum : 0);
  let chordIndex = 0;
  return <div ref={root} className="chord-read-line" style={{ lineHeight: `${metrics.lineHeight}px`, paddingTop: `${metrics.paddingTop}px`, '--reading-chord-height': `${metrics.chordHeight}px` } as CSSProperties}>
    {line.tokens.map((token, index) => {
      const position = token.chord ? chordIndex++ : -1;
      return <span className="chord-read-run" key={index}>
        {token.chord && <strong data-reading-chord style={{ top: `${metrics.chordTop(layout.rows[position] || 0)}px`, left: layout.shifts[position] || 0 }}>{token.chord}</strong>}
        {token.text}
      </span>;
    })}
  </div>;
}
