// src/types.ts

export interface CharacterFeatures {
  age: string; gender: string; build: string; height: string
  hair_color: string; hair_style: string; eye_color: string
  skin_tone: string; scars: string; clothing: string
  expression: string; distinguishing: string; current_location: string
  [key: string]: string
}

export interface HistoryMessage { role: 'user' | 'assistant'; content: string }
export interface InventoryItem  { name: string; quantity: string; note: string }
export interface SideCharacter  { name: string; description: string; relation: string; outline_color?: string; character_features?: Record<string, string>; inventory?: InventoryItem[] }
export interface Location       { name: string; description: string; last_visited: number; outline_color?: string; location_features?: Record<string, string> }

export interface PlayerState {
  name: string; prompt_count: number; total_chars: number
  last_gm_reply: string; image_prompt: string
  character_features: CharacterFeatures
  nicknames?: string[]; current_nickname?: string; battle_mode?: boolean
  romance_mode?: boolean; win_mode?: boolean
  inventory: InventoryItem[]; side_characters: SideCharacter[]; locations: Location[]
  current_location?: string; start_datetime?: string; current_datetime?: string; end_datetime?: string; turn: number; history: HistoryMessage[]
  assistant_options?: string[]
}

export interface SideQuest { title: string; description: string; steps?: string[] }

export interface ScenarioRuleSetting { label: string; description: string; enabled: boolean }
export interface CommonRuleSetting {
  label: string; description: string; kind: 'boolean' | 'level'
  active: boolean; current_level: number; max_level: number; level_names: string[]
}
export interface GameSettings {
  model: string; scenario_title: string
  scenario_rules: ScenarioRuleSetting[]; common_rules: CommonRuleSetting[]
}

export interface QuestStepStatus {
  step: string; completed: boolean; completed_at?: string
}

export interface GameState {
  session_id: string; scenario: string; model: string
  main_quest: string; main_quest_steps?: string[]; main_quest_step_status?: QuestStepStatus[]; side_quests: SideQuest[]
  active_player: string; players: PlayerState[]
  settings: GameSettings; updated_at: string
}

export interface ImageService {
  id: string
  name: string
  description: string
  fetchImage: (prompt: string, seed: number) => Promise<string>
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
