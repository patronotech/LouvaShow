import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { ChartLine } from './chordText';
import { readingChordRows } from './readingLayout';
import './chartReader.css';

export function ReadChordLine({ line, layoutKey }: { line: ChartLine; layoutKey: string }) {
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
    return () => { active = false; observer.disconnect(); };
  }, [line, layoutKey, instrumental]);

  if (instrumental) return <div className="chord-instrumental-line" aria-label="Instrumental">{line.tokens.filter(token => token.chord).map((token, index) => <strong key={index}>{token.chord}</strong>)}</div>;
  let chordIndex = 0;
  return <div ref={root} className="chord-read-line" style={{ '--reading-chord-rows': layout.maximum } as CSSProperties}>
    {line.tokens.map((token, index) => {
      const position = token.chord ? chordIndex++ : -1;
      return <span className="chord-read-run" key={index}>
        {token.chord && <strong data-reading-chord style={{ top: `${-1.35 * ((layout.rows[position] || 0) + 1)}em`, left: layout.shifts[position] || 0 }}>{token.chord}</strong>}
        {token.text}
      </span>;
    })}
  </div>;
}
