// src/types.ts

export interface CharacterFeatures {
  age: string; gender: string; build: string; height: string
  hair_color: string; hair_style: string; eye_color: string
  skin_tone: string; scars: string; clothing: string
  expression: string; distinguishing: string
  [key: string]: string
}

export interface HistoryMessage { role: 'user' | 'assistant'; content: string }
export interface InventoryItem  { name: string; quantity: string; note: string }
export interface SideCharacter  { name: string; description: string; relation: string }
export interface Location       { name: string; description: string; last_visited: number }

export interface PlayerState {
  name: string; prompt_count: number; total_chars: number
  last_gm_reply: string; image_prompt: string
  character_features: CharacterFeatures
  inventory: InventoryItem[]; side_characters: SideCharacter[]; locations: Location[]
  turn: number; history: HistoryMessage[]
}

export interface SideQuest { title: string; description: string }

export interface ScenarioRuleSetting { label: string; description: string; enabled: boolean }
export interface CommonRuleSetting {
  label: string; description: string; kind: 'boolean' | 'level'
  active: boolean; current_level: number; max_level: number; level_names: string[]
}
export interface GameSettings {
  model: string; scenario_title: string
  scenario_rules: ScenarioRuleSetting[]; common_rules: CommonRuleSetting[]
}

export interface GameState {
  session_id: string; scenario: string; model: string
  main_quest: string; side_quests: SideQuest[]
  active_player: string; players: PlayerState[]
  settings: GameSettings; updated_at: string
}

export interface ImageService {
  id: string; name: string; description: string
  buildUrl: (prompt: string, seed: number) => string
}

// ── Setup wizard types ─────────────────────────────────────────────────────────

export interface ModelOption { label: string; id: string }

export interface ScenarioOption {
  title: string; description: string; win_conditions: string
  opening_scene: string; user_condition: string; user_inventory: string
  scenario_rules: Array<{ label: string; description: string; default: boolean }>
}

export interface CommonRuleOption {
  label: string; description: string; kind: 'boolean' | 'level'
  default_active: boolean; default_level: number; max_level: number; level_names: string[]
}

export interface SetupData {
  models: ModelOption[]
  scenarios: ScenarioOption[]
  common_rules: CommonRuleOption[]
}

export interface SetupState {
  phase: 'waiting' | 'done'
  data: SetupData
  updated_at: string
}
