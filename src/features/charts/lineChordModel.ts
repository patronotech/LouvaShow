import type { ChartDocument, ChartLine, ChartChord } from './contracts';
import { graphemes } from './chordText';
import { newChartId } from './documentText';
export const partNames = ['Verso', 'Refrão', 'Intro', 'Ponte', 'Final', 'Interlúdio', 'Solo', 'Pré-refrão'];
export const chordEdgeSlots = 8;
/** Virtual columns become real spaces only when an anchor is placed before the text. */
export function lineLeadingSlots(text: string): number {
 const letters=graphemes(text);let whitespace=0;while(whitespace<letters.length&&/^\s+$/.test(letters[whitespace]!.text))whitespace++;
 if(whitespace===letters.length)return 0; // Instrumentals have no first word; keep their absolute columns stable.
 return Math.max(0,chordEdgeSlots-whitespace);
}
export function editLineText(line: ChartLine, text: string): ChartLine {
 const before = graphemes(line.text).map(value => value.text); const after = graphemes(text).map(value => value.text);
 let prefix = 0; while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
 let suffix = 0; while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
 const oldEnd = before.length - suffix; const newEnd = after.length - suffix;
 return { ...line, text, chords: line.chords.map(chord => ({ ...chord, offset: Math.max(0, Math.min(after.length, chord.offset < prefix ? chord.offset : chord.offset >= oldEnd ? chord.offset + after.length - before.length : Math.min(newEnd, prefix + chord.offset - prefix))) })) };
}
export function replaceLine(document: ChartDocument, sectionId: string, lineId: string, change: (line: ChartLine) => ChartLine): ChartDocument {
 return {...document, sections: document.sections.map(section => section.id !== sectionId ? section : {...section, lines: section.lines.map(line => line.id === lineId ? change(line) : line)})};
}
export function placeChord(document: ChartDocument, sectionId: string, lineId: string, offset: number, symbol: string, chordId = newChartId()): ChartDocument {
 const value = symbol.trim(); if (!value || /[\[\]\r\n]/.test(value)) throw new Error('Informe um acorde sem colchetes ou quebras de linha.');
 if (!Number.isFinite(offset)) throw new Error('Informe uma coluna válida.');
 return replaceLine(document, sectionId, lineId, line => {
  const column = Math.max(-lineLeadingSlots(line.text), Math.min(2000, Math.round(offset)));
  const prefix = Math.max(0,-column);
  return { ...line, text: ' '.repeat(prefix) + line.text + ' '.repeat(Math.max(0, column - graphemes(line.text).length)), chords: [...line.chords.filter(chord => chord.id !== chordId).map(chord=>({...chord,offset:chord.offset+prefix})), {id:chordId,offset:column+prefix,symbol:value}].sort((a,b)=>a.offset-b.offset) };
 });
}
export function moveLineChord(document: ChartDocument, fromSection: string, fromLine: string, chordId: string, toSection: string, toLine: string, offset: number): ChartDocument {
 const chord = document.sections.find(section=>section.id===fromSection)?.lines.find(line=>line.id===fromLine)?.chords.find(chord=>chord.id===chordId);
 if (!chord || !document.sections.find(section=>section.id===toSection)?.lines.some(line=>line.id===toLine)) return document;
 const removed = replaceLine(document,fromSection,fromLine,line=>({...line,chords:line.chords.filter(value=>value.id!==chordId)}));
 return placeChord(removed,toSection,toLine,offset,chord.symbol,chord.id);
}
export function splitChartLine(document: ChartDocument, sectionId: string, lineId: string, offset: number): ChartDocument {
 return {...document,sections:document.sections.map(section=>section.id!==sectionId?section:{...section,lines:section.lines.flatMap(line=>{
  if(line.id!==lineId)return[line]; const chars=graphemes(line.text).map(value=>value.text); const at=Math.max(0,Math.min(chars.length,offset));
  return [{...line,text:chars.slice(0,at).join(''),chords:line.chords.filter(chord=>chord.offset<at)},{id:newChartId(),text:chars.slice(at).join(''),chords:line.chords.filter(chord=>chord.offset>=at).map(chord=>({...chord,offset:chord.offset-at}))}];
 })})};
}
export function joinChartLine(document: ChartDocument, sectionId: string, lineId: string): ChartDocument {
 return {...document,sections:document.sections.map(section=>{
  if(section.id!==sectionId)return section; const index=section.lines.findIndex(line=>line.id===lineId); const line=section.lines[index]; const next=section.lines[index+1]; if(!line||!next)return section;
  const separator=line.text&&next.text&&!/\s$/.test(line.text)&&!/^\s/.test(next.text)?' ':''; const offset=graphemes(line.text+separator).length;
  const joined={...line,text:line.text+separator+next.text,chords:[...line.chords,...next.chords.map(chord=>({...chord,offset:chord.offset+offset}))]};
  return {...section,lines:[...section.lines.slice(0,index),joined,...section.lines.slice(index+2)]};
 })};
}
export function createPartFromLines(document: ChartDocument, lineIds: readonly string[], label: string): ChartDocument {
 const sections=document.sections.filter(section=>section.lines.some(line=>lineIds.includes(line.id)));
 if(sections.length!==1)throw new Error('Selecione linhas consecutivas da mesma parte.');
 const section=sections[0]!; const indexes=section.lines.flatMap((line,index)=>lineIds.includes(line.id)?[index]:[]); const first=indexes[0]!;const last=indexes.at(-1)!;
 if(indexes.length!==last-first+1)throw new Error('Selecione linhas consecutivas da mesma parte.');
 const name=label.trim();if(!name)throw new Error('Informe o nome da parte.');
 if(first===0&&last===section.lines.length-1)return {...document,sections:document.sections.map(value=>value.id===section.id?{...value,label:name}:value)};
 const before=section.lines.slice(0,first);const selected=section.lines.slice(first,last+1);const after=section.lines.slice(last+1);
 const parts=[...(before.length?[{...section,lines:before}]:[]),{id:newChartId(),label:name,lines:selected},...(after.length?[{id:before.length?newChartId():section.id,label:before.length?`${section.label} · continuação`:section.label,lines:after}]:[])];
 return {...document,sections:document.sections.flatMap(value=>value.id===section.id?parts:[value]),sequence:document.sequence.flatMap(occurrence=>occurrence.sectionId!==section.id?[occurrence]:parts.map((part,index)=>({id:index===0?occurrence.id:newChartId(),sectionId:part.id})))};
}
export function chordRows(chords: readonly ChartChord[]): {chord:ChartChord;row:number}[] {
 const ends:number[]=[];
 return [...chords].sort((a,b)=>a.offset-b.offset).map(chord=>{let row=ends.findIndex(end=>end<=chord.offset);if(row<0)row=ends.length;ends[row]=chord.offset+Math.max(2,graphemes(chord.symbol).length+1);return {chord,row};});
}
export function pointerColumn(clientX:number,left:number,width:number,columns:number,grabOffset=0):number{return Math.max(0,Math.min(columns-1,Math.round((clientX-left-grabOffset)/(width/columns))));}

/** Preserve imported attribution/OCR notes while avoiding identical paragraphs. */
export function mergeChartNotes(current:string,imported:string):string {
 const paragraphs=[current,imported].flatMap(text=>text.replace(/\r\n?/g,'\n').split(/\n[ \t]*\n/).map(value=>value.trim()).filter(Boolean));
 return [...new Set(paragraphs)].join('\n\n');
}
