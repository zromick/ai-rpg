mod prompts;

use std::collections::HashMap;
use std::io::{self, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use dotenvy::dotenv;

use prompts::{
    build_system_prompt, common_rule_definitions, pick_side_quests, story_prompts,
    CommonRuleKind, RuleSet, SideQuest,
};

// ─── File paths ───────────────────────────────────────────────────────────────

const STATE_FILE: &str  = "game_state.json";
const CMD_FILE: &str    = "command_queue.json";
const SETUP_FILE: &str  = "setup_state.json";
const ERROR_FILE: &str  = "last_error.json";

// ─── HuggingFace ─────────────────────────────────────────────────────────────

const HF_API_BASE: &str = "https://router.huggingface.co";

#[derive(Serialize)]
struct ModelOption { label: &'static str, id: &'static str }

fn available_models() -> Vec<ModelOption> {
    vec![
        ModelOption { label: "Llama 3.1 8B Instruct (default)", id: "meta-llama/Llama-3.1-8B-Instruct" },
        ModelOption { label: "Gemma 2 9B IT",                   id: "google/gemma-2-9b-it" },
        ModelOption { label: "Mistral 7B v0.3",                 id: "mistralai/Mistral-7B-Instruct-v0.3" },
        ModelOption { label: "Mistral Nemo 2407",              id: "mistralai/Mistral-Nemo-Instruct-2407" },
        ModelOption { label: "Zephyr 7B Beta",                  id: "HuggingFaceH4/zephyr-7b-beta" },
        ModelOption { label: "Hermes 3 Llama 3.1 8B",           id: "NousResearch/Hermes-3-Llama-3.1-8B" },
        ModelOption { label: "Llama 3.1 8B Abliterated",        id: "chaldene/Llama-3.1-8B-Instruct-Abliterated" },
        ModelOption { label: "Mixtral 8x7B",                    id: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
        ModelOption { label: "Phi-3 Medium 128k",               id: "microsoft/Phi-3-medium-128k-instruct" },
    ]
}

// ─── Character features ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterFeatures {
    pub age: String, pub gender: String, pub build: String, pub height: String,
    pub hair_color: String, pub hair_style: String, pub eye_color: String,
    pub skin_tone: String, pub scars: String, pub clothing: String,
    pub expression: String, pub distinguishing: String, pub current_location: String,
    #[serde(flatten)] pub custom: HashMap<String, String>,
}

fn rng_pick(list: &[&str], seed: u64) -> String {
    list[(seed as usize) % list.len()].to_string()
}

impl CharacterFeatures {
    pub fn random(s: u64) -> Self {
        Self {
            age: rng_pick(&["early 20s","mid 30s","late 40s","60s"], s),
            gender: rng_pick(&["male","female","androgynous"], s.wrapping_mul(3)),
            build: rng_pick(&["gaunt","wiry","stocky","broad-shouldered","lean","heavyset"], s.wrapping_mul(7)),
            height: rng_pick(&["short","average height","tall","very tall"], s.wrapping_mul(11)),
            hair_color: rng_pick(&["black","dark brown","auburn","dirty blonde","ash grey","white","bald"], s.wrapping_mul(13)),
            hair_style: rng_pick(&["cropped","unkempt","braided","matted","tied back","shaved sides"], s.wrapping_mul(17)),
            eye_color: rng_pick(&["brown","grey","green","blue","hazel","amber"], s.wrapping_mul(19)),
            skin_tone: rng_pick(&["pale","fair","olive","tan","dark brown","deep black"], s.wrapping_mul(23)),
            scars: rng_pick(&["none","a jagged scar across the cheek","a burn scar on the left hand","a notched ear","a split lip scar","a faded brand on the forearm"], s.wrapping_mul(29)),
            clothing: rng_pick(&["filthy rags","worn peasant tunic","patched leather vest","a threadbare cloak","torn burlap wrap"], s.wrapping_mul(31)),
            expression: rng_pick(&["hollow-eyed and haunted","watchful and guarded","quietly defiant","tired but sharp","blank and unreadable"], s.wrapping_mul(37)),
            distinguishing: rng_pick(&["none","a missing finger","a slight limp","calloused hands","an unusual tattoo on the neck","striking bone structure"], s.wrapping_mul(41)),
            current_location: String::new(),
            custom: HashMap::new(),
        }
    }
    pub fn to_image_prompt(&self) -> String {
        let mut p = vec![
            format!("{} {} person", self.age, self.gender),
            format!("{}, {}", self.build, self.height),
            format!("{} {} hair", self.hair_color, self.hair_style),
            format!("{} eyes", self.eye_color),
            format!("{} skin", self.skin_tone),
            format!("wearing {}", self.clothing),
            format!("expression: {}", self.expression),
        ];
        if self.scars != "none" { p.push(format!("with {}", self.scars)); }
        if self.distinguishing != "none" { p.push(self.distinguishing.clone()); }
        for (k,v) in &self.custom { p.push(format!("{}: {}", k, v)); }
        if !self.current_location.is_empty() { p.push(format!("at {}", self.current_location)); }
        p.join(", ")
    }
}

// ─── World state ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InventoryItem { pub name: String, pub quantity: String, pub note: String }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SideCharacter { pub name: String, pub description: String, pub relation: String, pub outline_color: Option<String>, pub character_features: Option<HashMap<String, String>>, pub inventory: Option<Vec<InventoryItem>> }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Location { pub name: String, pub description: String, pub last_visited: u64, pub outline_color: Option<String>, pub location_features: Option<HashMap<String, String>> }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocationFeatures { pub interior: String, pub exterior: String, pub mood: String }

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldState {
    pub inventory: Vec<InventoryItem>,
    pub side_characters: Vec<SideCharacter>,
    pub locations: Vec<Location>,
    pub current_location: Option<String>,
    pub start_datetime: Option<String>,
    pub current_datetime: Option<String>,
    pub end_datetime: Option<String>,
    pub nicknames: Vec<String>,
    pub current_nickname: Option<String>,
    #[serde(default)]
    pub battle_mode: bool,
    pub turn: u64,
}

// ─── Game settings (stored so UI can display/update them) ─────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSettings {
    pub model: String,
    pub scenario_title: String,
    pub scenario_rules: Vec<ScenarioRuleSetting>,
    pub common_rules: Vec<CommonRuleSetting>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioRuleSetting {
    pub label: String,
    pub description: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommonRuleSetting {
    pub label: String,
    pub description: String,
    pub kind: String,          // "boolean" or "level"
    pub active: bool,
    pub current_level: u8,
    pub max_level: u8,
    pub level_names: Vec<String>,
}

// ─── Game state ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct QuestStepStatus {
    step: String,
    completed: bool,
    completed_at: Option<String>,
}

struct GameState {
    model: String,
    main_quest: String,
    main_quest_steps: Vec<String>,
    main_quest_step_status: Vec<QuestStepStatus>,
    side_quests: Vec<SideQuest>,
    scenario_title: String,
    session_id: String,
    system_prompt: String,
    settings: GameSettings,
}

// ─── Session ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Message { role: String, content: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PromptRecord { number: u64, char_count: usize, full_text: String }

#[derive(Debug, Clone)]
struct PlayerStats {
    name: String, prompt_count: u64, total_chars: u64, prompt_log: Vec<PromptRecord>,
}

#[derive(Debug, Clone)]
struct PlayerSession {
    stats: PlayerStats,
    history: Vec<Message>,
    system_prompt: String,
    character: CharacterFeatures,
    last_gm_reply: String,
    world: WorldState,
}

impl PlayerSession {
    fn new(name: &str, system_prompt: &str, seed: u64, start_datetime: &str) -> Self {
        let world = WorldState {
            start_datetime: Some(start_datetime.to_string()),
            current_datetime: Some(start_datetime.to_string()),
            nicknames: vec![name.to_string()],
            current_nickname: Some(name.to_string()),
            ..Default::default()
        };
        Self {
            stats: PlayerStats { name: name.to_string(), prompt_count: 0, total_chars: 0, prompt_log: vec![] },
            history: vec![Message { role: "system".to_string(), content: system_prompt.to_string() }],
            system_prompt: system_prompt.to_string(),
            character: CharacterFeatures::random(seed),
            last_gm_reply: String::new(),
            world,
        }
    }
    fn restart(&mut self) {
        self.history = vec![Message { role: "system".to_string(), content: self.system_prompt.clone() }];
        self.stats.prompt_count = 0; self.stats.total_chars = 0; self.stats.prompt_log.clear();
        self.last_gm_reply = String::new();
        let start = self.world.start_datetime.clone().unwrap_or_default();
        self.world = WorldState::default();
        self.world.start_datetime = Some(start.clone());
        self.world.current_datetime = Some(start);
    }
}

// ─── Setup state file (UI reads this to render the setup wizard) ───────────────

fn write_setup_state(phase: &str, data: Value) {
    let payload = json!({ "phase": phase, "data": data, "updated_at": chrono::Utc::now().to_rfc3339() });
    let _ = std::fs::write(SETUP_FILE, serde_json::to_string_pretty(&payload).unwrap_or_default());
}

// ─── Game state file ──────────────────────────────────────────────────────────

fn write_state(gs: &GameState, sessions: &HashMap<String, PlayerSession>, active: &str) {
    // Generate a consistent color for each player using hash
    fn player_color(name: &str) -> String {
        let mut h: u64 = 0;
        for (i, c) in name.bytes().enumerate() {
            h = h.wrapping_add((c as u64).wrapping_mul(31u64.wrapping_pow(i as u32)));
        }
        let colors = ["#4a90d9", "#d97a4a", "#6bd94a", "#d94ab8", "#4ad9d1", "#d9c84a", "#8a4ad9", "#4ad96b"];
        let idx = (h as usize) % colors.len();
        colors[idx].to_string()
    }

    let players: Vec<Value> = sessions.values().map(|s| {
        let mut cf = serde_json::to_value(&s.character).unwrap_or(Value::Null);
        if let Value::Object(ref mut m) = cf {
            if let Some(Value::Object(c)) = m.remove("custom") { for (k,v) in c { m.insert(k,v); } }
            m.insert("current_location".to_string(), serde_json::to_value(&s.world.current_location).unwrap_or(Value::Null));
        }
        // Include main player as first character in the list
        let mut chars = s.world.side_characters.clone();
        let player_char = SideCharacter {
            name: s.stats.name.clone(),
            description: format!("Player character: {}", s.character.to_image_prompt()),
            relation: "player".to_string(),
            outline_color: Some(player_color(&s.stats.name)),
            character_features: None,
            inventory: None,
        };
        chars.insert(0, player_char);
        json!({
            "name": s.stats.name,
            "prompt_count": s.stats.prompt_count,
            "total_chars": s.stats.total_chars,
            "last_gm_reply": s.last_gm_reply,
            "image_prompt": s.character.to_image_prompt(),
            "character_features": cf,
            "inventory": s.world.inventory,
            "side_characters": chars,
            "locations": s.world.locations,
            "current_location": s.world.current_location,
            "start_datetime": s.world.start_datetime,
            "current_datetime": s.world.current_datetime,
            "end_datetime": s.world.end_datetime,
            "nicknames": s.world.nicknames,
            "current_nickname": s.world.current_nickname,
            "battle_mode": s.world.battle_mode,
            "turn": s.world.turn,
            "history": s.history.iter().filter(|m| m.role != "system").collect::<Vec<_>>(),
        })
    }).collect();
    let sqs: Vec<Value> = gs.side_quests.iter().map(|q| json!({"title":q.title,"description":q.description,"steps":q.steps})).collect();
    let payload = json!({
        "session_id": gs.session_id,
        "scenario": gs.scenario_title,
        "model": gs.model,
        "main_quest": gs.main_quest,
        "main_quest_steps": gs.main_quest_steps,
        "main_quest_step_status": gs.main_quest_step_status,
        "side_quests": sqs,
        "active_player": active,
        "settings": gs.settings,
        "players": players,
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });
    let _ = std::fs::write(STATE_FILE, serde_json::to_string_pretty(&payload).unwrap_or_default());
}

// ─── Command queue ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct QueuedCommand { player: String, text: String }

fn drain_queue() -> Vec<QueuedCommand> {
    let raw = match std::fs::read_to_string(CMD_FILE) { Ok(s) => s, Err(_) => return vec![] };
    let cmds: Vec<QueuedCommand> = serde_json::from_str(&raw).unwrap_or_default();
    let _ = std::fs::write(CMD_FILE, "[]");
    cmds
}


// ─── HuggingFace API ──────────────────────────────────────────────────────────

#[derive(Deserialize)] struct HFChoice { message: HFMsg }
#[derive(Deserialize)] struct HFMsg { content: String }
#[derive(Deserialize)] struct HFResp { choices: Vec<HFChoice> }

fn call_hf(client: &Client, key: &str, model: &str, msgs: &[Message], max_tokens: u32) -> Result<String, Box<dyn std::error::Error>> {
    let url  = format!("{}/v1/chat/completions", HF_API_BASE);
    let body = json!({ "model": model, "messages": msgs.iter().map(|m| json!({"role":m.role,"content":m.content})).collect::<Vec<_>>(), "max_tokens": max_tokens, "temperature": 0.85, "top_p": 0.95 });
    let resp = client.post(&url).header("Authorization", format!("Bearer {}", key)).header("Content-Type","application/json").json(&body).send()?;
    let status = resp.status(); let text = resp.text()?;
    if !status.is_success() { let err = format!("API {} Bad Request : {}", status, text); eprintln!("[RUST] [ERROR] {}", err); let _ = std::fs::write(ERROR_FILE, serde_json::to_string(&json!({"error": err})).unwrap_or_default()); return Err(err.into()); }
    let r: HFResp = serde_json::from_str(&text).map_err(|e| format!("parse: {} | {}", e, &text[..text.len().min(300)]))?;
    r.choices.into_iter().next().map(|c| c.message.content.trim().to_string()).ok_or_else(|| "empty response".into())
}

// ─── Extraction ───────────────────────────────────────────────────────────────

fn extract(client: &Client, key: &str, model: &str, action: &str, reply: &str, world: &WorldState) -> (WorldState, Option<String>, bool, Option<u32>) {
    let inv   = serde_json::to_string(&world.inventory).unwrap_or_default();
    let chars = serde_json::to_string(&world.side_characters).unwrap_or_default();
    let locs  = serde_json::to_string(&world.locations).unwrap_or_default();

    let sys = r#"You are a JSON extraction engine for an RPG. You receive game events and return ONLY a raw JSON object — no markdown, no code fences, no explanation. Any deviation from pure JSON will cause a system error."#;

let user = format!(r##"Player action: {action}
GM response: {reply}

Current inventory JSON: {inv}
Current side_characters JSON: {chars}
Current locations JSON: {locs}
Current in-game time: {curr_time}
Current nicknames: {nicknames}

Produce this exact JSON (all fields required, use the exact field names shown):
{{
  "inventory": [
    {{"name": "item name", "quantity": "number or description", "note": "condition or context"}}
  ],
  "side_characters": [
    {{"name": "full name (first and last)", "description": "2 sentences describing physical appearance and personality", "relation": "ally|enemy|neutral|unknown", "outline_color": "#RRGGBB", "character_features": {{"gender": "male/female/etc", "build": "slender/muscular/etc", "age": "young/middle-aged/etc", "clothing": "what they're wearing"}}, "inventory": []}}
  ],
  "locations": [
    {{"name": "place name", "description": "2 sentences describing the atmosphere and notable features", "last_visited": {turn}, "outline_color": "#RRGGBB", "location_features": {{"interior": "what it looks like inside", "exterior": "what it looks like outside", "mood": "the feeling/atmosphere"}}}}
  ],
  "current_location": "name of the location the player is currently at" or null,
  "current_datetime": "estimated in-game date and time in format like '7 August 1200, 11:45 PM'" or null,
  "game_won": true or false,
  "clothing_update": "new clothing description" or null,
  "new_nickname": "any nickname or title the player earns (e.g., 'the Brave', 'Cora Brightblade', 'Captain')" or null,
  "completed_quest_step": "number (1-indexed) of quest step completed, or null if none" or null,
  "battle_mode": true or false
}}

Critical rules:
  1. COPY ALL existing entries from current arrays unless they explicitly changed.
  2. ADD any new characters mentioned BY NAME in the GM response (guards, merchants, named NPCs, animals with roles). EXCLUDE the word "You" — do NOT add it as a character.
  3. ADD the current location if it can be identified from context.
  4. last_visited must be the integer {turn}, not a string.
  5. current_datetime: Estimate the new in-game time based on time passing in the narrative. Advance time realistically — typically 15-60 minutes per action, more if resting/traveling. If time crosses midnight, advance the date. Format: '7 August 1200, 11:45 PM'.
  6. game_won: Set to true ONLY if the GM response explicitly shows the main quest is complete (e.g., "You are crowned as King", "You have escaped the island", "The curse is destroyed"). Otherwise false. This should be rare.
  7. clothing_update: set ONLY if clothing explicitly changed in this scene. Otherwise null (not the string "null").
   8. relation values must be exactly one of: ally, enemy, neutral, unknown.
   9. outline_color: Use a CONSISTENT color based on the name string hash. Same name always gets the same color. Use these legible colors: "#4a90d9" (blue), "#d97a4a" (orange), "#6bd94a" (green), "#d94ab8" (pink), "#4ad9d1" (cyan), "#d9c84a" (gold), "#8a4ad9" (purple), "#4ad96b" (lime). Hash the name to pick one deterministically.
  10. Character names MUST include both first and last name when possible (e.g., "John Smith" not just "John").
  11. DO NOT add duplicate characters with similar names (e.g., if "John Smith" exists, do NOT add just "John" as a new character).
  12. DO NOT add duplicate locations with the same name. If the location already exists, update its description only.
  13. new_nickname: If the GM response gives the player a nickname or title (e.g., "You are now called the Brave", "From this day forth, you shall be known as..."), extract it. Set to null if no new nickname is given. This becomes the current_nickname.
  14. completed_quest_step: If the GM response shows completing a main quest step (e.g., player finds food/shelter, earns coin, gains foothold), set this to the 1-based step number completed. Otherwise null.
  15. Return ONLY the JSON object starting with {{ — nothing before or after."##,
        action=action, reply=reply, inv=inv, chars=chars, locs=locs, turn=world.turn+1, curr_time=world.current_datetime.as_deref().unwrap_or("unknown"), nicknames=world.nicknames.join(", "));

    let msgs = vec![
        Message { role: "system".to_string(), content: sys.to_string() },
        Message { role: "user".to_string(), content: user },
    ];

    match call_hf(client, key, model, &msgs, 1024) {
        Err(e) => { eprintln!("  [extract err] {}", e); (world.clone(), None, false, None) }
        Ok(raw) => {
            // Strip any accidental markdown fences
            let s = raw.trim();
            let s = s.strip_prefix("```json").or_else(|| s.strip_prefix("```")).unwrap_or(s);
            let s = s.strip_suffix("```").unwrap_or(s).trim();
            // Find the outermost JSON object
            let start = s.find('{').unwrap_or(0);
            let end   = s.rfind('}').map(|i| i+1).unwrap_or(s.len());
            let json_str = &s[start..end];

            match serde_json::from_str::<Value>(json_str) {
                Err(e) => { eprintln!("  [extract parse] {} | raw snippet: {}", e, &json_str[..json_str.len().min(400)]); (world.clone(), None, false, None) }
                Ok(v) => {
                    let new_inv:   Vec<InventoryItem>  = serde_json::from_value(v["inventory"].clone()).unwrap_or(world.inventory.clone());
                    let new_chars: Vec<SideCharacter>  = serde_json::from_value(v["side_characters"].clone()).unwrap_or(world.side_characters.clone());
                    let new_locs:  Vec<Location>       = serde_json::from_value(v["locations"].clone()).unwrap_or(world.locations.clone());
                    let curr_loc   = v["current_location"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let curr_time = v["current_datetime"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let clothing  = v["clothing_update"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let game_won  = v["game_won"].as_bool().unwrap_or(false);
                    let new_nickname = v["new_nickname"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let completed_step = v["completed_quest_step"].as_u64().map(|n| n as u32);
                    let battle_mode = v["battle_mode"].as_bool().unwrap_or(false);
                    let mut new_world = WorldState { inventory: new_inv, side_characters: new_chars, locations: new_locs, current_location: curr_loc, current_datetime: curr_time, turn: world.turn+1, battle_mode, ..Default::default() };
                    new_world.start_datetime = world.start_datetime.clone();
                    if let Some(nn) = new_nickname {
                        if !nn.is_empty() && !world.nicknames.contains(&nn) {
                            new_world.nicknames.push(nn.clone());
                            new_world.current_nickname = Some(nn);
                        }
                    } else {
                        new_world.current_nickname = world.current_nickname.clone();
                    }
                    new_world.nicknames = world.nicknames.clone();
                    (new_world, clothing, game_won, completed_step)
                }
            }
        }
    }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────


fn read_line(prompt: &str) -> String {
    print!("{}", prompt); io::stdout().flush().unwrap();
    let mut buf = String::new(); io::stdin().read_line(&mut buf).unwrap();
    buf.trim().to_string()
}

// ─── Setup via command queue (UI-driven) ──────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SetupPayload {
    model:         String,
    scenario_idx:  usize,
    scenario_rules: Vec<bool>,
    common_rules:  Vec<CommonRuleInput>,
    players:       Vec<PlayerInput>,
}

#[derive(Debug, Deserialize)]
struct CommonRuleInput { active: bool, current_level: u8 }

#[derive(Debug, Deserialize, Clone)]
struct PlayerInput { name: String }

/// Write setup_state.json so the UI knows what options to show, then block
/// until the UI posts a __setup_complete__ command with choices.
fn wait_for_ui_setup(_client: &Client, _key: &str) -> SetupPayload {
    // Build the options payload for the UI
    let scenarios: Vec<Value> = story_prompts().iter().map(|s| json!({
        "title": s.title,
        "description": s.description,
        "scenario_rules": s.scenario_rules.iter().map(|r| json!({"label":r.label,"description":r.description,"default":matches!(r.kind, prompts::RuleKind::Boolean{default:true})})).collect::<Vec<_>>(),
        "win_conditions": s.win_conditions,
        "opening_scene": s.opening_scene,
        "user_condition": s.user_condition,
        "user_inventory": s.user_inventory,
    })).collect();

    let models: Vec<Value> = available_models().iter().map(|m| json!({"label":m.label,"id":m.id})).collect();

    let common: Vec<Value> = common_rule_definitions().iter().map(|r| {
        let (kind_str, max_lv, level_names) = match &r.kind {
            prompts::CommonRuleKind::Boolean { default } => ("boolean".to_string(), 1u8, vec![if *default {"ON"} else {"OFF"}.to_string()]),
            prompts::CommonRuleKind::Level { levels, .. } => ("level".to_string(), levels.iter().map(|l| l.level).max().unwrap_or(1), levels.iter().map(|l| l.name.to_string()).collect()),
        };
        let default_active = match &r.kind { prompts::CommonRuleKind::Boolean { default } => *default, prompts::CommonRuleKind::Level { default, .. } => *default > 0 };
        let default_level  = match &r.kind { prompts::CommonRuleKind::Boolean { .. } => 1u8, prompts::CommonRuleKind::Level { default, .. } => *default };
        json!({"label":r.label,"description":r.description,"kind":kind_str,"default_active":default_active,"default_level":default_level,"max_level":max_lv,"level_names":level_names})
    }).collect();

    write_setup_state("waiting", json!({"models":models,"scenarios":scenarios,"common_rules":common}));
    eprintln!("[game] Waiting for UI setup... open http://localhost:5173");

    // Poll for __setup_complete__
    loop {
        thread::sleep(Duration::from_millis(500));
        let cmds = drain_queue();
        for cmd in cmds {
            if cmd.text.starts_with("__setup_complete__") {
                let json_part = cmd.text.trim_start_matches("__setup_complete__").trim();
                match serde_json::from_str::<SetupPayload>(json_part) {
                    Ok(payload) => {
                        eprintln!("[game] Setup received from UI.");
                        // Mark setup done
                        write_setup_state("done", json!({}));
                        return payload;
                    }
                    Err(e) => eprintln!("[game] Setup parse error: {}", e),
                }
            }
        }
    }
}

fn build_game_from_setup(payload: &SetupPayload, key: &str, client: &Client) -> (GameState, HashMap<String, PlayerSession>) {
    let _ = (key, client); // reserved for future async validation
    let scenarios = story_prompts();
    let story = &scenarios[payload.scenario_idx.min(scenarios.len()-1)];

    // Apply common rule settings
    let mut rule_set = RuleSet::from_defaults();
    for (i, input) in payload.common_rules.iter().enumerate() {
        if let Some(entry) = rule_set.entries.get_mut(i) {
            entry.active        = input.active;
            entry.current_level = input.current_level;
        }
    }

    let sq_count = rule_set.entries.iter().find(|e| e.label == "Side Quests")
        .map(|e| if e.active { e.current_level as usize } else { 0 }).unwrap_or(0);
    let side_quests = pick_side_quests(sq_count);
    let system_prompt = build_system_prompt(story, &rule_set, &side_quests, Some(&payload.scenario_rules));

    // Build settings snapshot for UI display
    let scenario_rule_settings: Vec<ScenarioRuleSetting> = story.scenario_rules.iter().enumerate().map(|(i, r)| ScenarioRuleSetting {
        label: r.label.to_string(),
        description: r.description.to_string(),
        enabled: payload.scenario_rules.get(i).copied().unwrap_or(matches!(r.kind, prompts::RuleKind::Boolean { default: true })),
    }).collect();

    let common_rule_settings: Vec<CommonRuleSetting> = rule_set.entries.iter().map(|e| {
        let (kind, max_lv, names) = match &e.kind {
            CommonRuleKind::Boolean { .. } => ("boolean".to_string(), 1u8, vec!["ON".to_string(),"OFF".to_string()]),
            CommonRuleKind::Level { levels, .. } => ("level".to_string(), levels.iter().map(|l| l.level).max().unwrap_or(1), levels.iter().map(|l| l.name.to_string()).collect()),
        };
        CommonRuleSetting { label: e.label.to_string(), description: e.description.to_string(), kind, active: e.active, current_level: e.current_level, max_level: max_lv, level_names: names }
    }).collect();

    let settings = GameSettings {
        model: payload.model.clone(),
        scenario_title: story.title.to_string(),
        scenario_rules: scenario_rule_settings,
        common_rules: common_rule_settings,
    };

    let session_id = chrono::Utc::now().timestamp_millis().to_string();
    let main_quest_step_status: Vec<QuestStepStatus> = story.main_quest_steps.iter().map(|s| QuestStepStatus { step: s.to_string(), completed: false, completed_at: None }).collect();
    let gs = GameState {
        model: payload.model.clone(),
        main_quest: story.win_conditions.to_string(),
        main_quest_steps: story.main_quest_steps.iter().map(|s| s.to_string()).collect(),
        main_quest_step_status,
        side_quests,
        scenario_title: story.title.to_string(),
        session_id,
        system_prompt: system_prompt.clone(),
        settings,
    };

    let seed_base = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0);
    let mut sessions = HashMap::new();
    for (i, p) in payload.players.iter().enumerate() {
        let seed = seed_base.wrapping_add(i as u64 * 997);
        sessions.insert(p.name.clone(), PlayerSession::new(&p.name, &system_prompt, seed, story.start_datetime));
    }
    (gs, sessions)
}

// ─── Settings update ──────────────────────────────────────────────────────────

/// Handle __settings_update__ command: rebuild system prompt and push to all sessions.
fn apply_settings_update(gs: &mut GameState, sessions: &mut HashMap<String, PlayerSession>, json_str: &str) {
    #[derive(Deserialize)]
    struct SettingsUpdate { model: Option<String>, common_rules: Option<Vec<CommonRuleInput>>, scenario_rules: Option<Vec<bool>> }

    let update: SettingsUpdate = match serde_json::from_str(json_str) {
        Ok(u) => u, Err(e) => { eprintln!("[settings] parse error: {}", e); return; }
    };

    if let Some(m) = update.model { gs.model = m.clone(); gs.settings.model = m; }

    // Update scenario rules if provided
    if let Some(ref sr) = update.scenario_rules {
        for (i, &enabled) in sr.iter().enumerate() {
            if let Some(rule) = gs.settings.scenario_rules.get_mut(i) {
                rule.enabled = enabled;
            }
        }
    }

    // Always rebuild common rules and system prompt (either common_rules or scenario_rules changed)
    let mut rule_set = RuleSet::from_defaults();
    if let Some(rule_inputs) = &update.common_rules {
        for (i, input) in rule_inputs.iter().enumerate() {
            if let Some(entry) = rule_set.entries.get_mut(i) {
                entry.active        = input.active;
                entry.current_level = input.current_level;
            }
        }
    } else {
        // Use existing common rules from settings
        for (i, s) in gs.settings.common_rules.iter().enumerate() {
            if let Some(entry) = rule_set.entries.get_mut(i) {
                entry.active = s.active;
                entry.current_level = s.current_level;
            }
        }
    }

    // Check if side quest count changed and re-pick if needed
    let new_sq_count = rule_set.entries.iter().find(|e| e.label == "Side Quests")
        .map(|e| if e.active { e.current_level as usize } else { 0 }).unwrap_or(0);
    let old_sq_count = gs.side_quests.len();
    if new_sq_count != old_sq_count {
        gs.side_quests = pick_side_quests(new_sq_count);
        eprintln!("[settings] Side quests changed: {} → {}", old_sq_count, new_sq_count);
    }

    // Get scenario rule enabled flags for prompt rebuild
    let scenario_enabled: Vec<bool> = gs.settings.scenario_rules.iter().map(|r| r.enabled).collect();

    // Rebuild system prompt
    let scenarios = story_prompts();
    if let Some(story) = scenarios.iter().find(|s| s.title == gs.scenario_title) {
        let new_prompt = build_system_prompt(story, &rule_set, &gs.side_quests, Some(&scenario_enabled));
        gs.system_prompt = new_prompt.clone();
        for session in sessions.values_mut() {
            session.system_prompt = new_prompt.clone();
            // Replace system message in history
            if let Some(m) = session.history.iter_mut().find(|m| m.role == "system") {
                m.content = new_prompt.clone();
            }
        }
        // Update settings snapshot
        gs.settings.common_rules = rule_set.entries.iter().map(|e| {
            let (kind, max_lv, names) = match &e.kind {
                CommonRuleKind::Boolean { .. } => ("boolean".to_string(), 1u8, vec!["ON".to_string(),"OFF".to_string()]),
                CommonRuleKind::Level { levels, .. } => ("level".to_string(), levels.iter().map(|l| l.level).max().unwrap_or(1), levels.iter().map(|l| l.name.to_string()).collect()),
            };
            CommonRuleSetting { label: e.label.to_string(), description: e.description.to_string(), kind, active: e.active, current_level: e.current_level, max_level: max_lv, level_names: names }
        }).collect();
        eprintln!("[settings] Updated and applied to all sessions.");
    }
}

// ─── Opening scene ────────────────────────────────────────────────────────────

fn opening_scene(client: &Client, key: &str, gs: &GameState, session: &mut PlayerSession, snap: &HashMap<String, PlayerSession>) {
    println!("  Generating opening scene for {}...", session.stats.name);
    let intro = format!("Begin the game. Deliver the opening scene exactly as written in your instructions. The player character looks like: {}. Weave their appearance naturally. Address the player as 'you'.", session.character.to_image_prompt());
    session.history.push(Message { role: "user".to_string(), content: intro });
    match call_hf(client, key, &gs.model, &session.history, 1024) {
        Ok(reply) => {
            println!("\n{}\n", reply);
            session.last_gm_reply = reply.clone();
            session.history.push(Message { role: "assistant".to_string(), content: reply.clone() });
            print!("  [extracting world state...]"); io::stdout().flush().unwrap();
            let (w, _, _, _) = extract(client, key, &gs.model, "game start", &reply, &session.world);
            session.world = w;
            println!(" done.");
            let mut s2 = snap.clone(); s2.insert(session.stats.name.clone(), session.clone());
            write_state(gs, &s2, &session.stats.name);
        }
        Err(e) => eprintln!("  [ERROR opening scene] {}", e),
    }
}

// ─── Process action ───────────────────────────────────────────────────────────

fn process_action(client: &Client, key: &str, gs: &mut GameState, sessions: &mut HashMap<String, PlayerSession>, name: &str, input: &str) {
    match input.trim().to_lowercase().as_str() {
        "quest"|"q" => { println!("♛ MAIN QUEST\n{}", gs.main_quest); return; }
        "sidequests"|"sidequest"|"sq" => {
            if gs.side_quests.is_empty() { println!("No side quests active."); }
            else { for (i,q) in gs.side_quests.iter().enumerate() { println!("[{}] {}\n    {}", i+1, q.title, q.description); } }
            return;
        }
        "stats"|"s" => {
            for sess in sessions.values() {
                let start_dt = sess.world.start_datetime.as_deref().unwrap_or("unknown");
                let curr_dt = sess.world.current_datetime.as_deref().unwrap_or("unknown");
                let char_count = sess.world.side_characters.len();
                let loc_count = sess.world.locations.len();
                println!("=== STATS for {} ===", sess.stats.name);
                println!("  Elapsed game time: {} → {}", start_dt, curr_dt);
                println!("  Prompts: {} | Total chars: {}", sess.stats.prompt_count, sess.stats.total_chars);
                println!("  Characters met: {} | Locations visited: {}", char_count, loc_count);
                for (i, r) in sess.stats.prompt_log.iter().enumerate() {
                    println!("    [{}] {} chars: {}", i + 1, r.char_count, r.full_text.chars().take(60).collect::<String>());
                }
            }
            return;
        }
        "inventory"|"inv" => { if let Some(s) = sessions.get(name) { for i in &s.world.inventory { println!("• {} x{} — {}", i.name, i.quantity, i.note); } } return; }
        "characters"|"chars"|"npcs"|"n" => { if let Some(s) = sessions.get(name) { for c in &s.world.side_characters { println!("• {} [{}]: {}", c.name, c.relation, c.description); } } return; }
        "locations"|"locs"|"map" => { if let Some(s) = sessions.get(name) { for l in &s.world.locations { println!("• {} (turn {}): {}", l.name, l.last_visited, l.description); } } return; }
        "settings"|"se" => {
            println!("Model: {}", gs.model);
            println!("Scenario: {}", gs.scenario_title);
            for r in &gs.settings.common_rules { println!("  [{}] {} — active:{} lv:{}", r.label, r.kind, r.active, r.current_level); }
            return;
        }
        "character"|"char"|"c" => {
            if let Some(s) = sessions.get_mut(name) {
                loop {
                    println!("{}", serde_json::to_string_pretty(&s.character).unwrap_or_default());
                    println!("set <field> <value> | unset <field> | DONE");
                    let inp = read_line("> ");
                    let low = inp.trim().to_lowercase();
                    if low == "done" || low.is_empty() { break; }
                    if low.starts_with("unset ") { let f = inp[6..].trim().to_string(); s.character.custom.remove(&f); continue; }
                    if low.starts_with("set ") {
                        let rest = inp[4..].trim();
                        if let Some(sp) = rest.find(' ') {
                            let field = rest[..sp].trim().to_lowercase(); let val = rest[sp+1..].trim().to_string();
                            match field.as_str() {
                                "age" => s.character.age = val, "gender" => s.character.gender = val,
                                "build" => s.character.build = val, "height" => s.character.height = val,
                                "hair_color" => s.character.hair_color = val, "hair_style" => s.character.hair_style = val,
                                "eye_color" => s.character.eye_color = val, "skin_tone" => s.character.skin_tone = val,
                                "scars" => s.character.scars = val, "clothing" => s.character.clothing = val,
                                "expression" => s.character.expression = val, "distinguishing" => s.character.distinguishing = val,
                                _ => { s.character.custom.insert(field, val); }
                            }
                        }
                    }
                }
                write_state(gs, sessions, name);
            }
            return;
        }
        _ => {}
    }

    // AI action
    let session = sessions.get_mut(name).unwrap();
    let chars = input.chars().count();
    session.stats.prompt_count += 1; session.stats.total_chars += chars as u64;
    let n = session.stats.prompt_count;
    session.stats.prompt_log.push(PromptRecord { number: n, char_count: chars, full_text: input.to_string() });
    session.history.push(Message { role: "user".to_string(), content: input.to_string() });

    println!("\n  [The GM responds...]\n");
    let hist = sessions[name].history.clone();
    match call_hf(client, key, &gs.model, &hist, 1024) {
        Ok(reply) => {
            println!("{}\n", reply);
            print!("  [updating world state...]"); io::stdout().flush().unwrap();
            let world = sessions[name].world.clone();
            let (new_world, clothing, game_won, completed_step) = extract(client, key, &gs.model, input, &reply, &world);
            println!(" done.");
            let s = sessions.get_mut(name).unwrap();
            s.last_gm_reply = reply.clone();
            s.history.push(Message { role: "assistant".to_string(), content: reply });
            if let Some(c) = clothing { println!("  [clothing → {}]", c); s.character.clothing = c; }
            s.world = new_world;
            if let Some(step_num) = completed_step {
                if let Some(step_status) = gs.main_quest_step_status.get_mut((step_num - 1) as usize) {
                    if !step_status.completed {
                        step_status.completed = true;
                        step_status.completed_at = s.world.current_datetime.clone();
                        eprintln!("[🎯] Quest step {} completed: {}", step_num, step_status.step);
                    }
                }
            }
            if game_won {
                let end_time = s.world.current_datetime.clone().unwrap_or_else(|| "unknown".to_string());
                eprintln!("\n[🎉] GAME WON! The player has completed the main quest!");
                eprintln!("    End time: {}", end_time);
            }
            write_state(gs, sessions, name);
        }
        Err(e) => {
            eprintln!("  [ERROR] {}", e);
            let s = sessions.get_mut(name).unwrap();
            s.history.pop();
            if let Some(r) = s.stats.prompt_log.pop() { s.stats.prompt_count -= 1; s.stats.total_chars -= r.char_count as u64; }
        }
    }
}

// ─── Game loop ────────────────────────────────────────────────────────────────

fn game_loop(client: &Client, key: &str, gs: &mut GameState, sessions: &mut HashMap<String, PlayerSession>) -> bool {
    let names: Vec<String> = { let mut v: Vec<_> = sessions.keys().cloned().collect(); v.sort(); v };
    let turn = 0usize;

    // Shared flag: stdin thread sets to true when user types "title" or "quit"
    let exit_flag = Arc::new(Mutex::new(Option::<bool>::None)); // None=running, Some(true)=title, Some(false)=quit
    let exit_flag_stdin = Arc::clone(&exit_flag);

    // Optional stdin thread for terminal power-users
    let stdin_cmds: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(vec![]));
    let stdin_cmds_t = Arc::clone(&stdin_cmds);
    let first_player = names.first().cloned().unwrap_or_default();

    thread::spawn(move || {
        loop {
            let mut buf = String::new();
            if io::stdin().read_line(&mut buf).is_err() { break; }
            let line = buf.trim().to_string();
            if line.is_empty() { continue; }
            match line.to_lowercase().as_str() {
                "title"   => { *exit_flag_stdin.lock().unwrap() = Some(true);  break; }
                _ => { stdin_cmds_t.lock().unwrap().push((first_player.clone(), line)); }
            }
        }
    });

    println!("[game] Running. Commands arrive from UI or terminal.");

    loop {
        // Check exit flag from stdin thread
        if let Some(go_title) = *exit_flag.lock().unwrap() { return go_title; }

        // Drain stdin commands
        let mut sc = stdin_cmds.lock().unwrap().drain(..).collect::<Vec<_>>();
        drop(stdin_cmds.lock());  // release immediately
        for (player, text) in sc.drain(..) {
            process_action(client, key, gs, sessions, &player, &text);
        }

        // Drain UI queue
        let cmds = drain_queue();
        for cmd in cmds {
            let player = cmd.player.clone();
            let text   = cmd.text.trim().to_string();

            match text.to_lowercase().as_str() {
                "title"   => { write_state(gs, sessions, &names[turn % names.len()]); return true; }
                "restart" => {
                    let mut sess = sessions.remove(&player).unwrap();
                    sess.restart();
                    let mut new_sess = sess.clone();
                    opening_scene(client, key, gs, &mut new_sess, sessions);
                    sessions.insert(player.clone(), new_sess);
                }
                t if t.starts_with("__settings_update__") => {
                    let json_str = t.trim_start_matches("__settings_update__").trim();
                    apply_settings_update(gs, sessions, json_str);
                    write_state(gs, sessions, &names[turn % names.len()]);
                }
                _ => {
                    if sessions.contains_key(&player) {
                        process_action(client, key, gs, sessions, &player, &text);
                    }
                }
            }
        }

        thread::sleep(Duration::from_millis(200));
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

fn main() {
    dotenv().ok();
    let key = match std::env::var("HF_API_TOKEN") {
        Ok(k) if !k.is_empty() => { eprintln!("[game] HF_API_TOKEN loaded."); k }
        _ => { eprint!("HF_API_TOKEN not set. Enter key: "); io::stdout().flush().unwrap(); read_line("") }
    };
    let client = Client::builder().timeout(Duration::from_secs(180)).build().unwrap();
    // Clear files from any previous session
    let _ = std::fs::write(CMD_FILE, "[]");
    let _ = std::fs::remove_file(STATE_FILE);

    loop {
        // Wait for UI to complete setup
        let payload = wait_for_ui_setup(&client, &key);
        let (mut gs, mut sessions) = build_game_from_setup(&payload, &key, &client);

        // Generate opening scenes
        let names: Vec<String> = sessions.keys().cloned().collect();
        for name in &names {
            let mut sess = sessions.remove(name).unwrap();
            opening_scene(&client, &key, &gs, &mut sess, &sessions);
            sessions.insert(name.clone(), sess);
        }
        write_state(&gs, &sessions, names.first().map(|s| s.as_str()).unwrap_or(""));

        let go_title = game_loop(&client, &key, &mut gs, &mut sessions);
        let _ = std::fs::remove_file(STATE_FILE);
        if !go_title { break; }
        eprintln!("[game] Returning to title...");
    }
    eprintln!("[game] Goodbye.");
}
