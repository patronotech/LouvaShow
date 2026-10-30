export interface TeamUser { id: string; name: string; email: string; roles: string[]; gravatarEnabled: boolean; canPublish: boolean }
export interface SaveTeamUser { id: string | null; name: string; email: string; roles: string[]; gravatarEnabled: boolean; canPublish: boolean }
export interface TeamDevice { id: string; pairCode: string; userId: string; userName: string; deviceName: string; approved: boolean; createdAt: string; lastSeenAt: string }
export interface TeamStatus { running: boolean; url: string | null; warning: string | null }
export interface TeamInterface { name: string; ip: string }
export interface PersonalSetlistItem { id: string; chartId: string; revision: number }
export interface PersonalSetlist { id: string; name: string; revision: number; items: PersonalSetlistItem[] }
export interface SavePersonalSetlist { id: string | null; name: string; expectedRevision: number | null; items: PersonalSetlistItem[] }
export interface AssistantConfig { enabled: boolean; transcription: boolean; organize: boolean; capo: boolean; hasKey: boolean }
export interface AssistantPreferences { enabled: boolean; transcription: boolean; organize: boolean; capo: boolean }
export interface SplitProposal { breakAfterLines: number[]; breakAfterParts?: number[]; blocks: string[] }
export interface AssistantCapoCandidate { id: string; capo: number; score: number; chords: string[] }
