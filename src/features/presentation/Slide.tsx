import { useLayoutEffect, useRef, useState } from 'react';
import type { Snapshot } from '../../shared/contracts';
import { effectiveTextBox, fitFontSize } from './textBox';
import './slide.css';

export interface SlideFit { requestedFontSize: number; actualFontSize: number; overflow: boolean }
interface Props {
  snapshot: Snapshot | null;
  preview?: boolean;
  previewLabel?: string;
  onOverflow?: (value: boolean) => void;
  onFit?: (fit: SlideFit) => void;
}

export function Slide({ snapshot, preview = false, previewLabel = 'Prévia da saída', onOverflow, onFit }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [font, setFont] = useState(64);
  const block = snapshot?.blocks[snapshot.blockIndex];
  const theme = snapshot?.theme;
  const bible = snapshot?.bible;
  const box = effectiveTextBox(theme?.textBox, Boolean(bible));
  const requestedFont = theme?.fontSize ?? 64;

  useLayoutEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const container = area.current;
    const content = text.current;
    // Hidden panels report zero dimensions; fit again when the observer reports reopening.
    if (!container || !content || !host.current?.clientWidth || !container.clientWidth || !container.clientHeight) return;
    const result = fitFontSize(requestedFont, value => {
      content.style.fontSize = `${value}px`;
      return content.scrollHeight <= container.clientHeight && content.scrollWidth <= container.clientWidth;
    });
    setFont(result.fontSize);
    onOverflow?.(result.overflow);
    onFit?.({ requestedFontSize: requestedFont, actualFontSize: result.fontSize, overflow: result.overflow });
  }, [block?.id, block?.text, requestedFont, theme?.fontFamily, box.x, box.y, box.width, box.height, size.width, size.height, onOverflow, onFit]);

  const scale = Math.min(size.width / 1280, size.height / 720);
  return <div ref={host} className={`slide-host ${preview ? 'slide-preview' : ''}`} aria-label={preview ? previewLabel : undefined}>
    <div className="slide-stage" style={{ width: 1280, height: 720, left: (size.width - 1280 * scale) / 2, top: (size.height - 720 * scale) / 2, transform: `scale(${scale})`, background: theme?.backgroundColor ?? '#000', color: theme?.textColor ?? '#fff', fontFamily: theme?.fontFamily ?? 'Arial' }}>
      <div className="slide-overlay" style={{ opacity: theme?.overlayOpacity ?? 0 }} />
      <div ref={area} className="slide-safe" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, justifyContent: theme?.verticalAlign === 'start' ? 'flex-start' : theme?.verticalAlign === 'end' ? 'flex-end' : 'center', textAlign: theme?.textAlign ?? 'center' }}>
        <div ref={text} key={block?.id} className={theme?.transitionType === 'fade' ? 'slide-text fade' : 'slide-text'} style={{ fontSize: font, animationDuration: `${theme?.transitionDurationMs ?? 0}ms` }}>{block?.text ?? ''}</div>
      </div>
      {bible && <div className="slide-reference"><span>{block?.label}</span><span>{bible.versionAbbreviation}</span></div>}
      {(!snapshot || snapshot.blanked) && <div className="slide-blackout" />}
    </div>
  </div>;
}
