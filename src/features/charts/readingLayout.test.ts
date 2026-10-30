import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChordSheet } from './ChordSheet';
import { readingChordRows, readingLineMetrics } from './readingLayout';

describe('leitura sem colisão de acordes', () => {
  it('empilha acordes na mesma âncora sem deslocar a frase', () => {
    expect(readingChordRows([
      { left: 0, top: 0, width: 65 }, { left: 0, top: 0, width: 30 },
      { left: 90, top: 0, width: 40 },
    ])).toEqual([0, 1, 0]);
  });
  it('considera a largura real de um acorde e recomeça numa linha quebrada', () => {
    expect(readingChordRows([
      { left: 12, top: 0, width: 80 }, { left: 40, top: 0, width: 20 },
      { left: 0, top: 72, width: 40 }, { left: 60, top: 72, width: 20 },
    ])).toEqual([0, 1, 0, 0]);
  });
  it('reserva altura para acordes maiores que a letra, inclusive linhas quebradas e empilhadas', () => {
    const metrics = readingLineMetrics(14, 48, 32, 3);
    expect(metrics.chordHeight).toBe(60);
    expect(metrics.chordTop(0) + metrics.chordHeight).toBe(-32);
    expect(metrics.chordTop(1) + metrics.chordHeight).toBeLessThan(metrics.chordTop(0));
    expect(metrics.chordTop(2) + metrics.chordHeight).toBeLessThan(metrics.chordTop(1));
    // First chord stays in the padded line box; the next visual line starts below
    // the preceding lyric line, even with the maximum three chord rows.
    expect(metrics.paddingTop + metrics.stack / 2 + metrics.chordTop(2)).toBe(0);
    expect(metrics.lineHeight + metrics.chordTop(2)).toBe(21);
  });
  it('aumenta apenas a distância vertical ao mudar o intervalo e evita espaço de acordes em letra pura', () => {
    const near = readingLineMetrics(22, 19, 0, 2);
    const far = readingLineMetrics(22, 19, 32, 2);
    expect(far.chordTop(0) - near.chordTop(0)).toBe(-32);
    expect(far.chordTop(1) - near.chordTop(1)).toBe(-32);
    expect(far.lineHeight - near.lineHeight).toBe(32);
    expect(readingLineMetrics(22, 60, 32, 0)).toMatchObject({ lineHeight: 33, paddingTop: 0, stack: 0 });
  });
  it('reavalia colisões quando o acorde fica largo sem deslocar sua âncora', () => {
    const anchors = [{ left: 0, top: 0, width: 20 }, { left: 40, top: 0, width: 20 }];
    expect(readingChordRows(anchors)).toEqual([0, 0]);
    expect(readingChordRows(anchors.map(item => ({ ...item, width: 45 })))).toEqual([0, 1]);
    expect(anchors.map(item => item.left)).toEqual([0, 40]);
  });
  it('renderiza tamanhos e pesos independentes e mantém a mesma letra', () => {
    const html = renderToStaticMarkup(createElement(ChordSheet, {
      source: '[C]Texto [G]de teste', fontSize: 28, fontWeight: 600,
      chordFontSize: 36, chordFontWeight: 400, chordGap: 12,
    }));
    expect(html).toContain('font-size:28px');
    expect(html).toContain('font-weight:600');
    expect(html).toContain('--reading-chord-size:36px');
    expect(html).toContain('--reading-chord-weight:400');
    expect(html).toContain('--reading-chord-gap:12px');
    expect(html).toContain('top:-57px;left:0');
    expect(html).toContain('Texto ');
    expect(html).toContain('de teste');
  });
  it('preserva o modo editor e o tamanho proporcional legado quando a opção está ausente', () => {
    const read = renderToStaticMarkup(createElement(ChordSheet, { source: '[C]Teste', fontSize: 20 }));
    expect(read).toContain('--reading-chord-size:17px');
    const edit = renderToStaticMarkup(createElement(ChordSheet, { source: '[C]Teste', onAnchor: () => {}, chordFontSize: 48, chordGap: 32, fontWeight: 900 }));
    expect(edit).not.toContain('--reading-chord-size');
    expect(edit).not.toContain('font-weight:900');
    expect(edit).toContain('chord-symbol');
  });
});

describe('distância negativa e hierarquia do leitor',()=>{
 it('gap negativo aproxima os acordes mantendo caixas e padding não negativos',()=>{for(const font of [14,22,48])for(const chord of [10,19,48])for(const gap of [-24,-10,0,32])for(const rows of [1,2,3]){const metrics=readingLineMetrics(font,chord,gap,rows);expect(metrics.paddingTop).toBeGreaterThanOrEqual(0);expect(metrics.paddingBottom).toBeGreaterThanOrEqual(0);expect(metrics.lineHeight).toBeGreaterThanOrEqual(font*1.5);const anchor=metrics.paddingTop+metrics.stack/2;expect(anchor+metrics.chordTop(rows-1)).toBeGreaterThanOrEqual(0);expect(anchor+metrics.chordTop(0)+metrics.chordHeight).toBeLessThanOrEqual(metrics.paddingTop+metrics.lineHeight+metrics.paddingBottom);}});
 it('permite overlap solicitado sem alterar ordem das faixas de colisão',()=>{const negative=readingLineMetrics(22,19,-12,3);const normal=readingLineMetrics(22,19,4,3);expect(negative.chordTop(0)-normal.chordTop(0)).toBe(16);expect(negative.chordTop(0)+negative.chordHeight).toBe(12);expect(negative.chordTop(1)).toBeLessThan(negative.chordTop(0));expect(negative.chordTop(2)).toBeLessThan(negative.chordTop(1));});
 it('renderiza títulos e intervalos independentes sem separador oculto entre partes',()=>{const html=renderToStaticMarkup(createElement(ChordSheet,{source:'{comment: Verso}\n[C]Texto\n\n{comment: Refrão}\n[G]Outra frase',fontSize:24,chordGap:-12,sectionFontFamily:'Georgia, serif',sectionFontSize:15,sectionColor:'#15191f',sectionTitleGap:2,sectionGap:10,lineGap:6}));expect(html).toContain('--reading-section-size:15px');expect(html).toContain('--reading-section-color:#15191f');expect(html).toContain('--reading-title-gap:2px');expect(html).toContain('--reading-section-gap:10px');expect(html).toContain('--reading-line-gap:6px');expect(html).toContain('--reading-chord-gap:-12px');expect(html).not.toContain('chord-spacer');expect(html).toContain('Outra frase');});
});
