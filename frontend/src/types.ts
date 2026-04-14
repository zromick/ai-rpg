// src/types.ts

export interface CharacterFeatures {
  age: string
  gender: string
  build: string
  height: string
  hair_color: string
  hair_style: string
  eye_color: string
  skin_tone: string
  scars: string
  clothing: string
  expression: string
  distinguishing: string
  [key: string]: string
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface InventoryItem {
  name: string
  quantity: string
  note: string
}

export interface SideCharacter {
  name: string
  description: string
  relation: string
}

export interface Location {
  name: string
  description: string
  last_visited: string
}

export interface PlayerState {
  name: string
  prompt_count: number
  total_chars: number
  last_gm_reply: string
  image_prompt: string
  character_features: CharacterFeatures
  inventory: InventoryItem[]
  side_characters: SideCharacter[]
  locations: Location[]
  turn: number
  history: HistoryMessage[]
}

export interface SideQuest {
  title: string
  description: string
}

export interface GameState {
  session_id: string
  scenario: string
  model: string
  main_quest: string
  side_quests: SideQuest[]
  active_player: string
  players: PlayerState[]
  updated_at: string
}

export interface ImageService {
  id: string
  name: string
  description: string
  buildUrl: (prompt: string, seed: number) => string
}
