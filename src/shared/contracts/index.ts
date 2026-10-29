export interface SongBlock { id: string; songId: string; label: string | null; text: string; position: number }
export interface Song { id: string; categoryId: string; copyright: string | null; title: string; artist: string | null; createdAt: string; updatedAt: string; blocks: SongBlock[] }
export interface SaveSongInput { id: string | null; categoryId: string; copyright: string | null; title: string; artist: string | null; blocks: {id: string | null; label: string | null; text: string}[] }
export interface SetlistItem { id: string; setlistId: string; songId: string; position: number }
export interface SetlistSummary { id: string; name: string; itemCount: number }
export interface Setlist { id: string; name: string; createdAt: string; updatedAt: string; items: SetlistItem[] }
export interface Theme { id: string; name: string; fontFamily: string; fontSize: number; textColor: string; backgroundColor: string; textAlign: 'left'|'center'|'right'; verticalAlign: 'start'|'center'|'end'; backgroundMediaId: string|null; overlayOpacity: number; transitionType: 'none'|'fade'; transitionDurationMs: number }
export interface Snapshot { revision: number; blanked: boolean; songId: string|null; title: string; blocks: SongBlock[]; blockIndex: number; theme: Theme }
export type PresentationAction = {type:'present'; songId:string; blockId:string} | {type:'next'|'previous'|'toggleBlank'} | {type:'theme'; theme:Theme};
export interface Display { id:string; name:string; width:number; height:number; x:number; y:number; scale:number }
export interface ProjectionStatus { open:boolean; fullscreen:boolean; monitorId:string|null; warning:string|null }

export interface Category { id: string; name: string }
export interface ImportFile { name: string; bytes: number[] }
export interface ImportSong { categoryName?: string | null; title: string; artist: string | null; copyright: string | null; blocks: { label: string | null; text: string }[] }
export interface ImportPreview { songs: ImportSong[]; warnings: string[]; fileCount: number }
export interface ImportResult { imported: number; skipped: number }
