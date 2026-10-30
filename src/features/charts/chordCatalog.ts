export const chordRoots = ['A','B','C','D','E','F','G'] as const;
export type ChordRoot = typeof chordRoots[number];
export type ChordAccidental = ''|'#'|'b';
export const chordVariations = {
  major: [
    {suffix:'',label:'Maior'}, {suffix:'6',label:'Sexta'}, {suffix:'7',label:'Sétima dominante'},
    {suffix:'maj7',label:'Sétima maior'}, {suffix:'7M',label:'Sétima maior'},
    {suffix:'9',label:'Dominante com nona'}, {suffix:'7(9)',label:'Dominante com nona'},
    {suffix:'add9',label:'Nona adicionada'}, {suffix:'sus2',label:'Segunda suspensa'},
    {suffix:'sus4',label:'Quarta suspensa'}, {suffix:'7sus4',label:'Sétima e quarta suspensa'},
    {suffix:'aug',label:'Aumentado'},
  ],
  minor: [
    {suffix:'m',label:'Menor'}, {suffix:'m6',label:'Menor com sexta'}, {suffix:'m7',label:'Menor com sétima'},
    {suffix:'m9',label:'Menor com nona'}, {suffix:'m(maj7)',label:'Menor com sétima maior'},
    {suffix:'m7b5',label:'Meio-diminuto'}, {suffix:'dim',label:'Tríade diminuta'}, {suffix:'dim7',label:'Sétima diminuta'},
  ],
} as const;
export function chordSymbolError(symbol:string):string|null {
  if(!symbol.trim())return 'Informe um acorde.';
  if(/[\[\]\r\n]/.test(symbol))return 'Use um símbolo sem colchetes ou quebras de linha.';
  if(new TextEncoder().encode(symbol.trim()).length>80)return 'O acorde deve ocupar no máximo 80 bytes em UTF-8.';
  return null;
}
export function chordRootParts(symbol:string):{root:ChordRoot;accidental:ChordAccidental;suffix:string}|null {
  const match=/^([A-G])([#b]?)(.*)$/.exec(symbol.trim());
  return match?{root:match[1] as ChordRoot,accidental:match[2] as ChordAccidental,suffix:match[3]!}:null;
}
export function catalogSymbol(root:ChordRoot,accidental:ChordAccidental,suffix:string):string{return `${root}${accidental}${suffix}`;}
export const customChordStorageKey='louvashow:custom-chords:v1';
export const customChordLimit=100;
export function readCustomChords(raw:string|null):string[] {
  if(raw===null)return [];
  if(raw.length>32000)throw new Error('A galeria local excedeu o tamanho permitido.');
  let data:unknown;try{data=JSON.parse(raw);}catch{throw new Error('Não foi possível ler a galeria local de acordes.');}
  if(!data||typeof data!=='object'||!('version' in data)||data.version!==1||!('symbols' in data)||!Array.isArray(data.symbols))throw new Error('Formato da galeria local de acordes não reconhecido.');
  return [...new Set(data.symbols.filter((symbol):symbol is string=>typeof symbol==='string'&&!chordSymbolError(symbol)).map(symbol=>symbol.trim()))].slice(0,customChordLimit);
}
export function addCustomChord(symbols:readonly string[],raw:string):string[] {
  const error=chordSymbolError(raw);if(error)throw new Error(error);
  const symbol=raw.trim();if(symbols.includes(symbol))return [...symbols];
  if(symbols.length>=customChordLimit)throw new Error(`A galeria comporta até ${customChordLimit} acordes. Remova um para adicionar outro.`);
  return [...symbols,symbol];
}
export function saveCustomChords(storage:Pick<Storage,'setItem'>,symbols:readonly string[]):void {
  const clean=readCustomChords(JSON.stringify({version:1,symbols}));
  storage.setItem(customChordStorageKey,JSON.stringify({version:1,symbols:clean}));
}
