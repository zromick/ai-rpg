mod prompts;

use std::collections::HashMap;
use std::io::{self, Write};
use std::time::{Duration, Instant};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use dotenvy::dotenv;

use prompts::{
    build_system_prompt, pick_side_quests, story_prompts, CommonRuleKind, RuleEntry, RuleSet,
    SideQuest, StoryPrompt,
};

// ─── File paths ───────────────────────────────────────────────────────────────

const STATE_FILE:   &str = "game_state.json";
const CMD_FILE:     &str = "command_queue.json";

// ─── HuggingFace config ───────────────────────────────────────────────────────

const HF_API_BASE: &str = "https://router.huggingface.co";

struct ModelOption { label: &'static str, id: &'static str }

fn available_models() -> Vec<ModelOption> {
    vec![
        ModelOption { label: "meta-llama/Llama-3.1-8B-Instruct (default)", id: "meta-llama/Llama-3.1-8B-Instruct" },
        ModelOption { label: "meta-llama/Llama-3.2-3B-Instruct",           id: "meta-llama/Llama-3.2-3B-Instruct" },
        ModelOption { label: "google/gemma-2-9b-it",                        id: "google/gemma-2-9b-it" },
        ModelOption { label: "mistralai/Mistral-7B-Instruct-v0.3",          id: "mistralai/Mistral-7B-Instruct-v0.3" },
        ModelOption { label: "mistralai/Mistral-Nemo-Instruct-2407",        id: "mistralai/Mistral-Nemo-Instruct-2407" },
        ModelOption { label: "HuggingFaceH4/zephyr-7b-beta",               id: "HuggingFaceH4/zephyr-7b-beta" },
        ModelOption { label: "NousResearch/Hermes-3-Llama-3.1-8B",         id: "NousResearch/Hermes-3-Llama-3.1-8B" },
        ModelOption { label: "chaldene/Llama-3.1-8B-Instruct-Abliterated", id: "chaldene/Llama-3.1-8B-Instruct-Abliterated" },
        ModelOption { label: "mistralai/Mixtral-8x7B-Instruct-v0.1",       id: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
        ModelOption { label: "microsoft/Phi-3-medium-128k-instruct",        id: "microsoft/Phi-3-medium-128k-instruct" },
        ModelOption { label: "Qwen/Qwen2.5-7B-Instruct",                   id: "Qwen/Qwen2.5-7B-Instruct" },
    ]
}

// ─── Character features ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterFeatures {
    pub age:           String,
    pub gender:        String,
    pub build:         String,
    pub height:        String,
    pub hair_color:    String,
    pub hair_style:    String,
    pub eye_color:     String,
    pub skin_tone:     String,
    pub scars:         String,
    pub clothing:      String,
    pub expression:    String,
    pub distinguishing: String,
    #[serde(flatten)]
    pub custom:        HashMap<String, String>,
}

static AGES:       &[&str] = &["early 20s","mid 30s","late 40s","60s"];
static GENDERS:    &[&str] = &["male","female","androgynous"];
static BUILDS:     &[&str] = &["gaunt","wiry","stocky","broad-shouldered","lean","heavyset"];
static HEIGHTS:    &[&str] = &["short","average height","tall","very tall"];
static HCOLORS:    &[&str] = &["black","dark brown","auburn","dirty blonde","ash grey","white","bald"];
static HSTYLES:    &[&str] = &["cropped","unkempt","braided","matted","tied back","shaved sides"];
static ECOLORS:    &[&str] = &["brown","grey","green","blue","hazel","amber"];
static SKINS:      &[&str] = &["pale","fair","olive","tan","dark brown","deep black"];
static SCARS:      &[&str] = &["none","a jagged scar across the cheek","a burn scar on the left hand","a notched ear","a split lip scar","a faded brand on the forearm"];
static CLOTHING:   &[&str] = &["filthy rags","worn peasant tunic","patched leather vest","a threadbare cloak","torn burlap wrap"];
static EXPRESSIONS:&[&str] = &["hollow-eyed and haunted","watchful and guarded","quietly defiant","tired but sharp","blank and unreadable"];
static DISTINCTS:  &[&str] = &["none","a missing finger","a slight limp","calloused hands","an unusual tattoo on the neck","striking bone structure"];

fn rng_pick(list: &[&str], seed: u64) -> String {
    list[(seed as usize) % list.len()].to_string()
}

impl CharacterFeatures {
    pub fn random(player_seed: u64) -> Self {
        CharacterFeatures {
            age:            rng_pick(AGES,         player_seed),
            gender:         rng_pick(GENDERS,      player_seed.wrapping_mul(3)),
            build:          rng_pick(BUILDS,       player_seed.wrapping_mul(7)),
            height:         rng_pick(HEIGHTS,      player_seed.wrapping_mul(11)),
            hair_color:     rng_pick(HCOLORS,      player_seed.wrapping_mul(13)),
            hair_style:     rng_pick(HSTYLES,      player_seed.wrapping_mul(17)),
            eye_color:      rng_pick(ECOLORS,      player_seed.wrapping_mul(19)),
            skin_tone:      rng_pick(SKINS,        player_seed.wrapping_mul(23)),
            scars:          rng_pick(SCARS,        player_seed.wrapping_mul(29)),
            clothing:       rng_pick(CLOTHING,     player_seed.wrapping_mul(31)),
            expression:     rng_pick(EXPRESSIONS,  player_seed.wrapping_mul(37)),
            distinguishing: rng_pick(DISTINCTS,    player_seed.wrapping_mul(41)),
            custom:         HashMap::new(),
        }
    }

    pub fn to_image_prompt(&self) -> String {
        let mut parts = vec![
            format!("{} {} person", self.age, self.gender),
            format!("{}, {}", self.build, self.height),
            format!("{} {} hair", self.hair_color, self.hair_style),
            format!("{} eyes", self.eye_color),
            format!("{} skin", self.skin_tone),
            format!("wearing {}", self.clothing),
            format!("expression: {}", self.expression),
        ];
        if self.scars != "none"         { parts.push(format!("with {}", self.scars)); }
        if self.distinguishing != "none"{ parts.push(self.distinguishing.clone()); }
        for (k, v) in &self.custom      { parts.push(format!("{}: {}", k, v)); }
        parts.join(", ")
    }

    pub fn print_table(&self, name: &str) {
        sep('─', 60);
        println!("  CHARACTER FEATURES — {}", name);
        sep('─', 60);
        println!("  age           : {}", self.age);
        println!("  gender        : {}", self.gender);
        println!("  build         : {}", self.build);
        println!("  height        : {}", self.height);
        println!("  hair_color    : {}", self.hair_color);
        println!("  hair_style    : {}", self.hair_style);
        println!("  eye_color     : {}", self.eye_color);
        println!("  skin_tone     : {}", self.skin_tone);
        println!("  scars         : {}", self.scars);
        println!("  clothing      : {}", self.clothing);
        println!("  expression    : {}", self.expression);
        println!("  distinguishing: {}", self.distinguishing);
        for (k, v) in &self.custom { println!("  {:<14}: {}", k, v); }
        sep('─', 60);
        println!("  Image prompt  : {}", self.to_image_prompt());
        sep('─', 60);
    }
}

// ─── Extracted world state ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InventoryItem {
    pub name:     String,
    pub quantity: String,  // "1", "a few", "~12", etc.
    pub note:     String,  // condition or brief context
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SideCharacter {
    pub name:        String,
    pub description: String,
    pub relation:    String, // "ally", "enemy", "neutral", "unknown"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Location {
    pub name:        String,
    pub description: String,
    pub last_visited: String, // turn number as string
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorldState {
    pub inventory:      Vec<InventoryItem>,
    pub side_characters: Vec<SideCharacter>,
    pub locations:      Vec<Location>,
    pub turn:           u64,
}

// ─── Game State ───────────────────────────────────────────────────────────────

struct GameState {
    model: String,
    main_quest: String,
    side_quests: Vec<SideQuest>,
    scenario_title: String,
    session_id: String, // unique per cargo run — triggers frontend reset
}

// ─── Prompt log ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PromptRecord {
    number: u64,
    char_count: usize,
    full_text: String,
}

// ─── Session ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Clone)]
struct PlayerStats {
    name: String,
    prompt_count: u64,
    total_chars: u64,
    prompt_log: Vec<PromptRecord>,
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
    fn new(name: &str, system_prompt: &str, seed: u64) -> Self {
        PlayerSession {
            stats: PlayerStats { name: name.to_string(), prompt_count: 0, total_chars: 0, prompt_log: Vec::new() },
            history: vec![Message { role: "system".to_string(), content: system_prompt.to_string() }],
            system_prompt: system_prompt.to_string(),
            character: CharacterFeatures::random(seed),
            last_gm_reply: String::new(),
            world: WorldState::default(),
        }
    }

    fn restart(&mut self) {
        self.history = vec![Message { role: "system".to_string(), content: self.system_prompt.clone() }];
        self.stats.prompt_count = 0;
        self.stats.total_chars = 0;
        self.stats.prompt_log.clear();
        self.last_gm_reply = String::new();
        self.world = WorldState::default();
    }
}

// ─── State file ───────────────────────────────────────────────────────────────

fn write_state(state: &GameState, sessions: &HashMap<String, PlayerSession>, active_player: &str) {
    let players: Vec<Value> = sessions.values().map(|s| {
        let mut char_obj = serde_json::to_value(&s.character).unwrap_or(Value::Null);
        if let Value::Object(ref mut map) = char_obj {
            let custom = map.remove("custom").unwrap_or(json!({}));
            if let Value::Object(cmap) = custom { for (k, v) in cmap { map.insert(k, v); } }
        }
        json!({
            "name": s.stats.name,
            "prompt_count": s.stats.prompt_count,
            "total_chars": s.stats.total_chars,
            "last_gm_reply": s.last_gm_reply,
            "image_prompt": s.character.to_image_prompt(),
            "character_features": char_obj,
            "inventory": s.world.inventory,
            "side_characters": s.world.side_characters,
            "locations": s.world.locations,
            "turn": s.world.turn,
            "history": s.history.iter().filter(|m| m.role != "system").collect::<Vec<_>>(),
        })
    }).collect();

    let side_quests: Vec<Value> = state.side_quests.iter()
        .map(|q| json!({"title": q.title, "description": q.description}))
        .collect();

    let payload = json!({
        "session_id": state.session_id,
        "scenario": state.scenario_title,
        "model": state.model,
        "main_quest": state.main_quest,
        "side_quests": side_quests,
        "active_player": active_player,
        "players": players,
        "updated_at": chrono::Utc::now().to_rfc3339(),
    });

    if let Ok(s) = serde_json::to_string_pretty(&payload) {
        let _ = std::fs::write(STATE_FILE, s);
    }
}

// ─── Command queue (written by frontend, polled by game) ──────────────────────

#[derive(Debug, Deserialize)]
struct QueuedCommand {
    player: String,
    text:   String,
}

/// Returns pending commands and clears the file.
fn drain_command_queue() -> Vec<QueuedCommand> {
    let raw = match std::fs::read_to_string(CMD_FILE) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    let cmds: Vec<QueuedCommand> = serde_json::from_str(&raw).unwrap_or_default();
    let _ = std::fs::write(CMD_FILE, "[]");
    cmds
}

// ─── HuggingFace API ──────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct HFChoice { message: HFMessage }
#[derive(Deserialize, Debug)]
struct HFMessage { content: String }
#[derive(Deserialize, Debug)]
struct HFResponse { choices: Vec<HFChoice> }

fn call_hf_api(client: &Client, api_key: &str, model: &str, history: &[Message]) -> Result<String, Box<dyn std::error::Error>> {
    let url = format!("{}/v1/chat/completions", HF_API_BASE);
    let messages_json: Vec<Value> = history.iter().map(|m| json!({"role": m.role, "content": m.content})).collect();
    let body = json!({ "model": model, "messages": messages_json, "max_tokens": 512, "temperature": 0.85, "top_p": 0.95 });
    let resp = client.post(&url).header("Authorization", format!("Bearer {}", api_key)).header("Content-Type", "application/json").json(&body).send()?;
    let status = resp.status();
    let text = resp.text()?;
    if !status.is_success() { return Err(format!("API error {}: {}", status, text).into()); }
    let hf: HFResponse = serde_json::from_str(&text).map_err(|e| format!("Parse error: {}\nRaw: {}", e, text))?;
    hf.choices.into_iter().next().map(|c| c.message.content.trim().to_string()).ok_or_else(|| "Empty response".into())
}

// ─── Extraction inference ─────────────────────────────────────────────────────
// After each GM reply, ask the model to extract structured updates.
// We use a separate one-shot call so it doesn't pollute conversation history.

fn extract_world_state(
    client: &Client,
    api_key: &str,
    model: &str,
    gm_reply: &str,
    player_action: &str,
    current: &WorldState,
) -> WorldState {
    let current_inv   = serde_json::to_string(&current.inventory).unwrap_or_default();
    let current_chars = serde_json::to_string(&current.side_characters).unwrap_or_default();
    let current_locs  = serde_json::to_string(&current.locations).unwrap_or_default();

    let system = "You are a structured data extractor for an RPG game. \
You receive a GM narrative response and a player action. \
You return ONLY valid JSON with no explanation, no markdown, no code fences. \
Extract and update the game state objects described.";

    let user = format!(
        r#"Player action: "{}"

GM reply: "{}"

Current inventory (JSON array): {}
Current side_characters (JSON array): {}
Current locations (JSON array): {}

Return a single JSON object with these exact keys:
{{
  "inventory": [ {{ "name": string, "quantity": string, "note": string }} ],
  "side_characters": [ {{ "name": string, "description": string, "relation": string }} ],
  "locations": [ {{ "name": string, "description": string, "last_visited": string }} ],
  "clothing_update": string or null
}}

Rules:
- inventory: merge current + any items gained/lost/used. Remove consumed items. Update quantities. Keep unchanged items.
- side_characters: merge current + any new NPCs/animals introduced. Update descriptions/relations if they changed.
- locations: merge current + any new areas visited or described. Update descriptions if more info revealed.
- clothing_update: if the player's clothing visibly changed, describe the new clothing in a short phrase. Otherwise null.
- Preserve existing entries even if not mentioned in this turn.
- ONLY return the JSON object, nothing else."#,
        player_action, gm_reply, current_inv, current_chars, current_locs
    );

    let messages = vec![
        Message { role: "system".to_string(), content: system.to_string() },
        Message { role: "user".to_string(),   content: user },
    ];

    match call_hf_api(client, api_key, model, &messages) {
        Err(e) => { eprintln!("  [extraction error] {}", e); current.clone() }
        Ok(raw) => {
            // Strip markdown fences if model adds them
            let cleaned = raw
                .trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim()
                .to_string();

            match serde_json::from_str::<Value>(&cleaned) {
                Err(e) => { eprintln!("  [extraction parse error] {} — raw: {}", e, &cleaned[..cleaned.len().min(200)]); current.clone() }
                Ok(v) => {
                    let inv:   Vec<InventoryItem>   = serde_json::from_value(v["inventory"].clone()).unwrap_or(current.inventory.clone());
                    let chars: Vec<SideCharacter>   = serde_json::from_value(v["side_characters"].clone()).unwrap_or(current.side_characters.clone());
                    let locs:  Vec<Location>        = serde_json::from_value(v["locations"].clone()).unwrap_or(current.locations.clone());
                    let clothing_update = v["clothing_update"].as_str().map(|s| s.to_string());
                    WorldState {
                        inventory: inv,
                        side_characters: chars,
                        locations: locs,
                        turn: current.turn + 1,
                        // clothing_update returned to caller separately
                        ..current.clone()
                    }.with_clothing(clothing_update)
                }
            }
        }
    }
}

impl WorldState {
    fn with_clothing(self, update: Option<String>) -> Self { (self, update).0 }
}

// We return clothing separately so the caller can update CharacterFeatures
fn extract_world_state_full(
    client: &Client,
    api_key: &str,
    model: &str,
    gm_reply: &str,
    player_action: &str,
    current: &WorldState,
) -> (WorldState, Option<String>) {
    let current_inv   = serde_json::to_string(&current.inventory).unwrap_or_default();
    let current_chars = serde_json::to_string(&current.side_characters).unwrap_or_default();
    let current_locs  = serde_json::to_string(&current.locations).unwrap_or_default();

    let system = "You are a structured data extractor for an RPG game. \
You receive a GM narrative response and a player action. \
Return ONLY valid JSON with no explanation, no markdown, no code fences.";

    let user = format!(
        r#"Player action: "{}"

GM reply: "{}"

Current inventory: {}
Current side_characters: {}
Current locations: {}

Return exactly this JSON structure:
{{
  "inventory": [ {{ "name": string, "quantity": string, "note": string }} ],
  "side_characters": [ {{ "name": string, "description": string, "relation": string }} ],
  "locations": [ {{ "name": string, "description": string, "last_visited": string }} ],
  "clothing_update": string or null
}}

- inventory: merge current list with changes from this turn (items gained, lost, used, modified)
- side_characters: merge current list with any newly introduced or updated characters/animals
- locations: merge current list with any new or updated areas
- clothing_update: if player's clothes visibly changed, brief phrase of new clothing. Otherwise null.
- Preserve all unchanged entries. Return ONLY the JSON."#,
        player_action, gm_reply, current_inv, current_chars, current_locs
    );

    let messages = vec![
        Message { role: "system".to_string(), content: system.to_string() },
        Message { role: "user".to_string(),   content: user },
    ];

    match call_hf_api(client, api_key, model, &messages) {
        Err(e) => { eprintln!("  [extraction] {}", e); (current.clone(), None) }
        Ok(raw) => {
            let cleaned = raw.trim()
                .trim_start_matches("```json").trim_start_matches("```")
                .trim_end_matches("```").trim().to_string();
            match serde_json::from_str::<Value>(&cleaned) {
                Err(e) => { eprintln!("  [extraction parse] {} | raw: {}", e, &cleaned[..cleaned.len().min(300)]); (current.clone(), None) }
                Ok(v) => {
                    let inv   = serde_json::from_value(v["inventory"].clone()).unwrap_or(current.inventory.clone());
                    let chars = serde_json::from_value(v["side_characters"].clone()).unwrap_or(current.side_characters.clone());
                    let locs  = serde_json::from_value(v["locations"].clone()).unwrap_or(current.locations.clone());
                    let clothing = v["clothing_update"].as_str().filter(|s| !s.is_empty() && *s != "null").map(|s| s.to_string());
                    (WorldState { inventory: inv, side_characters: chars, locations: locs, turn: current.turn + 1 }, clothing)
                }
            }
        }
    }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

fn sep(ch: char, width: usize) { println!("{}", ch.to_string().repeat(width)); }

fn print_header() {
    sep('═', 60);
    println!("       ♛  BEGGARS TO CROWNS  ♛       ");
    println!("     An AI-Powered Open World RPG     ");
    sep('═', 60);
}

fn read_line(prompt: &str) -> String {
    print!("{}", prompt);
    io::stdout().flush().unwrap();
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).unwrap();
    buf.trim().to_string()
}

fn print_main_quest(state: &GameState) {
    sep('═', 60); println!("  ♛  MAIN QUEST"); sep('─', 60);
    println!("  {}", state.main_quest); sep('═', 60);
}

fn print_side_quests(state: &GameState) {
    sep('═', 60); println!("  ⚔  SIDE QUESTS"); sep('─', 60);
    if state.side_quests.is_empty() { println!("  No side quests active."); }
    else { for (i,q) in state.side_quests.iter().enumerate() { println!("  [{}] {}\n      {}", i+1, q.title, q.description); } }
    sep('═', 60);
}

fn print_inventory(session: &PlayerSession) {
    sep('─', 60); println!("  🎒 INVENTORY — {}", session.stats.name); sep('─', 60);
    if session.world.inventory.is_empty() { println!("  (empty)"); }
    else { for item in &session.world.inventory { println!("  {} x{}  — {}", item.name, item.quantity, item.note); } }
    sep('─', 60);
}

fn print_side_characters(session: &PlayerSession) {
    sep('─', 60); println!("  👥 CHARACTERS MET — {}", session.stats.name); sep('─', 60);
    if session.world.side_characters.is_empty() { println!("  (none yet)"); }
    else { for c in &session.world.side_characters { println!("  {} [{}]\n    {}", c.name, c.relation, c.description); } }
    sep('─', 60);
}

fn print_locations(session: &PlayerSession) {
    sep('─', 60); println!("  🗺  LOCATIONS VISITED — {}", session.stats.name); sep('─', 60);
    if session.world.locations.is_empty() { println!("  (none yet)"); }
    else { for l in &session.world.locations { println!("  {} (turn {})\n    {}", l.name, l.last_visited, l.description); } }
    sep('─', 60);
}

fn print_stats(sessions: &HashMap<String, PlayerSession>) {
    sep('═', 60); println!("  PLAYER STATS"); sep('═', 60);
    let mut players: Vec<&PlayerSession> = sessions.values().collect();
    players.sort_by_key(|s| &s.stats.name);
    for s in players {
        sep('─', 60);
        println!("  Player: {}  │  Prompts: {}  │  Chars: {}", s.stats.name, s.stats.prompt_count, s.stats.total_chars);
        sep('─', 60);
        if s.stats.prompt_log.is_empty() { println!("  (no prompts yet)"); }
        else { for rec in &s.stats.prompt_log { println!("  ── Prompt #{} ({} chars) ──\n  {}", rec.number, rec.char_count, rec.full_text); } }
    }
    sep('═', 60);
}

// ─── Character editor ────────────────────────────────────────────────────────

fn edit_character(session: &mut PlayerSession) {
    loop {
        session.character.print_table(&session.stats.name);
        println!("  set <field> <value>  |  unset <field>  |  DONE");
        sep('─', 60);
        let input = read_line("  character > ");
        let lower = input.trim().to_lowercase();
        if lower == "done" || lower.is_empty() { break; }
        if lower.starts_with("unset ") {
            let field = input[6..].trim().to_string();
            if session.character.custom.remove(&field).is_some() { println!("  ✓ Removed '{}'.", field); }
            else { println!("  '{}' is not a custom field.", field); }
            continue;
        }
        if lower.starts_with("set ") {
            let rest = input[4..].trim();
            if let Some(space) = rest.find(' ') {
                let field = rest[..space].trim().to_lowercase();
                let value = rest[space+1..].trim().to_string();
                match field.as_str() {
                    "age"           => session.character.age           = value,
                    "gender"        => session.character.gender        = value,
                    "build"         => session.character.build         = value,
                    "height"        => session.character.height        = value,
                    "hair_color"    => session.character.hair_color    = value,
                    "hair_style"    => session.character.hair_style    = value,
                    "eye_color"     => session.character.eye_color     = value,
                    "skin_tone"     => session.character.skin_tone     = value,
                    "scars"         => session.character.scars         = value,
                    "clothing"      => session.character.clothing      = value,
                    "expression"    => session.character.expression    = value,
                    "distinguishing"=> session.character.distinguishing= value,
                    _ => { session.character.custom.insert(field.clone(), value.clone()); println!("  ✓ Custom '{}' = '{}'.", field, value); continue; }
                }
                println!("  ✓ {} updated.", field);
            } else { println!("  Usage: set <field> <value>"); }
        }
    }
}

// ─── Model / scenario / rules selection (unchanged) ──────────────────────────

fn select_model() -> String {
    let models = available_models();
    sep('═', 60); println!("  SELECT AI MODEL"); sep('─', 60);
    for (i,m) in models.iter().enumerate() { println!("  [{}] {}", i+1, m.label); }
    sep('─', 60); println!("  Enter to use default."); sep('─', 60);
    loop {
        let raw = read_line("  > ");
        if raw.is_empty() { println!("  ✓ Default: {}", models[0].id); return models[0].id.to_string(); }
        if let Ok(n) = raw.trim().parse::<usize>() {
            if n >= 1 && n <= models.len() { println!("  ✓ {}", models[n-1].id); return models[n-1].id.to_string(); }
        }
        println!("  Enter 1–{} or Enter.", models.len());
    }
}

fn select_scenario() -> usize {
    let scenarios = story_prompts();
    sep('═', 60); println!("  SELECT A SCENARIO"); sep('─', 60);
    for (i,s) in scenarios.iter().enumerate() { println!("  [{}] {}\n      {}", i+1, s.title, s.description); }
    sep('─', 60); println!("  [H] Help"); sep('─', 60);
    loop {
        let raw = read_line("  > ");
        let lower = raw.trim().to_lowercase();
        if lower == "h" || lower == "help" {
            scenario_help_menu(&scenarios);
            sep('─', 60);
            for (i,s) in scenarios.iter().enumerate() { println!("  [{}] {}", i+1, s.title); }
            sep('─', 60);
            continue;
        }
        if let Ok(n) = raw.trim().parse::<usize>() {
            if n >= 1 && n <= scenarios.len() { println!("\n  ✓ {}\n", scenarios[n-1].title); return n-1; }
        }
        println!("  Enter 1–{} or H.", scenarios.len());
    }
}

fn scenario_help_menu(scenarios: &[StoryPrompt]) {
    println!(); sep('─', 60);
    for (i,s) in scenarios.iter().enumerate() { println!("  [{}] {}", i+1, s.title); }
    sep('─', 60);
    let idx: usize = loop {
        match read_line("  Scenario > ").trim().parse::<usize>() {
            Ok(n) if n >= 1 && n <= scenarios.len() => break n-1,
            _ => println!("  Enter 1–{}.", scenarios.len()),
        }
    };
    let story = &scenarios[idx];
    loop {
        println!(); sep('─', 60);
        println!("  [1]Title [2]Desc [3]Sys [4]Setting [5]Opening [6]Cond [7]Inv [8]Rules [9]Win [B]Back");
        sep('─', 60);
        match read_line("  > ").trim().to_lowercase().as_str() {
            "1" => println!("\n  {}", story.title),
            "2" => println!("\n  {}", story.description),
            "3" => println!("\n  {}", story.system_instructions),
            "4" => { for sd in story.setting_details { println!("  • {}: {}", sd.label, sd.detail); } }
            "5" => println!("\n  {}", story.opening_scene),
            "6" => println!("\n  {}", story.user_condition),
            "7" => println!("\n  {}", story.user_inventory),
            "8" => { for (i,r) in story.scenario_rules.iter().enumerate() { println!("  [{}] {}\n      {}", i+1, r.label, r.description); } }
            "9" => println!("\n  {}", story.win_conditions),
            "b"|"back" => break,
            _ => println!("  Unknown."),
        }
    }
}

fn configure_scenario_rules(story: &StoryPrompt) -> Vec<bool> {
    let mut enabled: Vec<bool> = story.scenario_rules.iter().map(|r| match r.kind {
        prompts::RuleKind::Boolean { default } => default,
        prompts::RuleKind::Level { default, .. } => default > 0,
    }).collect();
    if story.scenario_rules.is_empty() { return enabled; }
    loop {
        println!(); sep('─', 60); println!("  SCENARIO RULES (DONE to continue)"); sep('─', 60);
        for (i,r) in story.scenario_rules.iter().enumerate() {
            println!("  [{}] [{}] {}\n          {}", i+1, if enabled[i] {"ON "} else {"OFF"}, r.label, r.description);
        }
        sep('─', 60);
        match read_line("  # or DONE > ").trim().to_lowercase().as_str() {
            "done"|"d"|"" => break,
            s => if let Ok(n) = s.parse::<usize>() {
                if n >= 1 && n <= enabled.len() {
                    enabled[n-1] = !enabled[n-1];
                    println!("  ✓ '{}' → {}", story.scenario_rules[n-1].label, if enabled[n-1] {"ON"} else {"OFF"});
                }
            }
        }
    }
    enabled
}

fn configure_common_rules() -> RuleSet {
    let mut rule_set = RuleSet::from_defaults();
    loop {
        println!(); sep('─', 60); println!("  UNIVERSAL RULES (DONE to continue)"); sep('─', 60);
        for (i,e) in rule_set.entries.iter().enumerate() {
            println!("  [{:>2}] [{}] {}\n          {}", i+1, rule_entry_state_str(e), e.label, e.description);
        }
        sep('─', 60);
        match read_line("  # or DONE > ").trim().to_lowercase().as_str() {
            "done"|"d"|"" => break,
            s => if let Ok(n) = s.parse::<usize>() {
                if n >= 1 && n <= rule_set.entries.len() { edit_rule_entry(&mut rule_set.entries[n-1]); }
            }
        }
    }
    rule_set
}

fn rule_entry_state_str(entry: &RuleEntry) -> String {
    match &entry.kind {
        CommonRuleKind::Boolean { .. } => if entry.active {"ON ".to_string()} else {"OFF".to_string()},
        CommonRuleKind::Level { levels, .. } => { let name = levels.iter().find(|l| l.level == entry.current_level).map(|l| l.name).unwrap_or("?"); format!("Lv {:>2} — {}", entry.current_level, name) }
    }
}

fn edit_rule_entry(entry: &mut RuleEntry) {
    match &entry.kind {
        CommonRuleKind::Boolean { .. } => { entry.active = !entry.active; println!("  ✓ '{}' → {}", entry.label, if entry.active {"ON"} else {"OFF"}); }
        CommonRuleKind::Level { levels, .. } => {
            println!(); sep('─', 60); println!("  LEVEL: {}", entry.label);
            for l in levels.iter() { println!("  [{:>2}] {:>12} — {}{}", l.level, l.name, l.description, if l.level == entry.current_level {" ◄"} else {""}); }
            sep('─', 60);
            loop {
                let r = read_line(&format!("  1–{} or Enter > ", levels.len()));
                if r.is_empty() { break; }
                match r.trim().parse::<u8>() {
                    Ok(n) if levels.iter().any(|l| l.level == n) => { entry.current_level = n; entry.active = n > 0; println!("  ✓ Lv {}", n); break; }
                    _ => println!("  Enter 1–{}.", levels.len()),
                }
            }
        }
    }
}

// ─── Player setup ─────────────────────────────────────────────────────────────

fn setup_players(system_prompt: &str) -> HashMap<String, PlayerSession> {
    let mut sessions = HashMap::new();
    println!(); sep('─', 60); println!("  PLAYER SETUP"); sep('─', 60);
    println!("  How many players? (1–8)");
    let count: usize = loop {
        match read_line("  > ").trim().parse::<usize>() {
            Ok(n) if n >= 1 && n <= 8 => break n,
            _ => println!("  Enter 1–8."),
        }
    };
    let seed_base = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(999);
    for i in 1..=count {
        let name = loop {
            let n = read_line(&format!("  Name for Player {}: ", i));
            if n.is_empty() { println!("  Name cannot be empty."); }
            else if sessions.contains_key(&n) { println!("  Name taken."); }
            else { break n; }
        };
        let seed = seed_base.wrapping_add(i as u64 * 997);
        let session = PlayerSession::new(&name, system_prompt, seed);
        println!("  ✓ {} added.", name);
        session.character.print_table(&name);
        sessions.insert(name, session);
    }
    sessions
}

// ─── Opening scene ────────────────────────────────────────────────────────────

fn opening_scene(client: &Client, api_key: &str, model: &str, state: &GameState, session: &mut PlayerSession, sessions_snap: &HashMap<String, PlayerSession>) {
    println!("\n  Generating opening scene for {}...", session.stats.name);
    let char_desc = session.character.to_image_prompt();
    let intro = format!(
        "Begin the game. Deliver the opening scene exactly as written in your instructions. \
         The player character looks like: {}. \
         Weave their appearance naturally into the opening narration. Address the player as 'you'.",
        char_desc
    );
    session.history.push(Message { role: "user".to_string(), content: intro.clone() });
    match call_hf_api(client, api_key, model, &session.history) {
        Ok(reply) => {
            session.last_gm_reply = reply.clone();
            session.history.push(Message { role: "assistant".to_string(), content: reply.clone() });
            sep('─', 60); println!("\n{}\n", reply);

            // Extract initial world state from opening scene
            print!("  [extracting initial state...]");
            io::stdout().flush().unwrap();
            let (world, _) = extract_world_state_full(client, api_key, model, &reply, "game start", &session.world);
            session.world = world;
            println!(" done.");

            let mut snap = sessions_snap.clone();
            snap.insert(session.stats.name.clone(), session.clone());
            write_state(state, &snap, &session.stats.name);
        }
        Err(e) => eprintln!("  [ERROR] {}", e),
    }
}

// ─── Title setup ──────────────────────────────────────────────────────────────

fn run_title_setup(client: &Client, api_key: &str) -> (GameState, HashMap<String, PlayerSession>) {
    print_header();
    let model = select_model();
    let scenario_idx = select_scenario();
    let scenarios = story_prompts();
    let story = &scenarios[scenario_idx];
    let _sr = configure_scenario_rules(story);
    let common_rules = configure_common_rules();

    let sq_count = common_rules.entries.iter().find(|e| e.label == "Side Quests")
        .map(|e| if e.active { e.current_level as usize } else { 0 }).unwrap_or(0);
    let side_quests = pick_side_quests(sq_count);
    let system_prompt = build_system_prompt(story, &common_rules, &side_quests);

    // Unique session ID — changing this tells the frontend to reset its local state
    let session_id = chrono::Utc::now().timestamp_millis().to_string();

    let state = GameState {
        model,
        main_quest: story.win_conditions.to_string(),
        side_quests,
        scenario_title: story.title.to_string(),
        session_id,
    };

    // Clear command queue from previous session
    let _ = std::fs::write(CMD_FILE, "[]");
    // Clear state file so frontend shows splash until new game is ready
    let _ = std::fs::remove_file(STATE_FILE);

    let mut sessions = setup_players(&system_prompt);
    println!(); print_main_quest(&state); print_side_quests(&state);
    println!("\n  Generating opening scenes...");
    let names: Vec<String> = sessions.keys().cloned().collect();
    for name in &names {
        let mut session = sessions.remove(name).unwrap();
        opening_scene(client, api_key, &state.model, &state, &mut session, &sessions);
        sessions.insert(name.clone(), session);
    }
    (state, sessions)
}

// ─── Process a single action (used by both terminal and UI queue) ─────────────

fn process_action(
    client: &Client,
    api_key: &str,
    state: &GameState,
    sessions: &mut HashMap<String, PlayerSession>,
    name: &str,
    input: &str,
) {
    // Handle local commands
    match input.trim().to_lowercase().as_str() {
        "quest"                          => { print_main_quest(state); return; }
        "sidequests"|"sidequest"|"sq"    => { print_side_quests(state); return; }
        "stats"                          => { print_stats(sessions); return; }
        "inventory"|"inv"                => { if let Some(s) = sessions.get(name) { print_inventory(s); } return; }
        "characters"|"chars"|"npcs"      => { if let Some(s) = sessions.get(name) { print_side_characters(s); } return; }
        "locations"|"locs"|"map"         => { if let Some(s) = sessions.get(name) { print_locations(s); } return; }
        "character"|"char"               => {
            if let Some(s) = sessions.get_mut(name) {
                edit_character(s);
                write_state(state, sessions, name);
            }
            return;
        }
        _ => {}
    }

    // AI action
    {
        let s = sessions.get_mut(name).unwrap();
        let chars = input.chars().count();
        s.stats.prompt_count += 1;
        s.stats.total_chars += chars as u64;
        let n = s.stats.prompt_count;
        s.stats.prompt_log.push(PromptRecord { number: n, char_count: chars, full_text: input.to_string() });
        s.history.push(Message { role: "user".to_string(), content: input.to_string() });
    }

    println!("\n  [The world responds...]\n");
    let history_snapshot = sessions[name].history.clone();
    match call_hf_api(client, api_key, &state.model, &history_snapshot) {
        Ok(reply) => {
            println!("{}\n", reply);

            // Extract world state update
            print!("  [updating world state...]");
            io::stdout().flush().unwrap();
            let current_world = sessions[name].world.clone();
            let (new_world, clothing_update) = extract_world_state_full(client, api_key, &state.model, &reply, input, &current_world);
            println!(" done.");

            let s = sessions.get_mut(name).unwrap();
            s.last_gm_reply = reply.clone();
            s.history.push(Message { role: "assistant".to_string(), content: reply });
            if let Some(clothing) = clothing_update {
                s.character.clothing = clothing.clone();
                println!("  [clothing updated: {}]", clothing);
            }
            s.world = new_world;
            write_state(state, sessions, name);
        }
        Err(e) => {
            eprintln!("  [ERROR] {}", e);
            let s = sessions.get_mut(name).unwrap();
            s.history.pop();
            if let Some(rec) = s.stats.prompt_log.pop() {
                s.stats.prompt_count -= 1;
                s.stats.total_chars -= rec.char_count as u64;
            }
        }
    }
}

// ─── Main game loop ───────────────────────────────────────────────────────────

fn game_loop(client: &Client, api_key: &str, state: &GameState, sessions: &mut HashMap<String, PlayerSession>) -> bool {
    let player_names: Vec<String> = { let mut n: Vec<_> = sessions.keys().cloned().collect(); n.sort(); n };
    let mut turn_index = 0usize;

    // Poll interval for checking command queue from UI
    let poll_interval = Duration::from_millis(300);
    let mut last_poll  = Instant::now();

    loop {
        // ── Poll UI command queue ─────────────────────────────────────────────
        if last_poll.elapsed() >= poll_interval {
            last_poll = Instant::now();
            let cmds = drain_command_queue();
            for cmd in cmds {
                if sessions.contains_key(&cmd.player) {
                    println!("\n  [UI: {}] {}", cmd.player, cmd.text);
                    match cmd.text.trim().to_lowercase().as_str() {
                        "quit"|"exit"   => { println!("\n  Game ended via UI."); print_stats(sessions); return false; }
                        "title"         => { println!("\n  → Title via UI."); return true; }
                        "restart"       => {
                            let s = sessions.get_mut(&cmd.player).unwrap();
                            s.restart();
                            println!("\n  Restarting {}...", cmd.player);
                            let mut sess = sessions.remove(&cmd.player).unwrap();
                            opening_scene(client, api_key, &state.model, state, &mut sess, sessions);
                            sessions.insert(cmd.player.clone(), sess);
                            write_state(state, sessions, &cmd.player);
                        }
                        _ => { process_action(client, api_key, state, sessions, &cmd.player, &cmd.text); }
                    }
                }
            }
        }

        // ── Terminal input ────────────────────────────────────────────────────
        let name = player_names[turn_index % player_names.len()].clone();
        turn_index += 1;

        sep('═', 60);
        println!("  [ {}'s Turn ]  │  {}", name, state.model);
        sep('═', 60);
        println!("  Commands: quit | title | restart | stats | quest | sidequests | inventory | characters | locations | character | switch <n>");
        println!("  Or type your action:\n");

        let input = read_line(&format!("  {} > ", name));

        match input.to_lowercase().trim() {
            "quit"|"exit" => { println!("\n  Thanks for playing!"); print_stats(sessions); return false; }
            "title" => { println!("\n  → Title."); return true; }
            "restart" => {
                let s = sessions.get_mut(&name).unwrap();
                s.restart();
                println!("\n  Restarting {}...", name);
                let mut sess = sessions.remove(&name).unwrap();
                opening_scene(client, api_key, &state.model, state, &mut sess, sessions);
                sessions.insert(name.clone(), sess);
                turn_index = turn_index.saturating_sub(1);
                continue;
            }
            cmd if cmd.starts_with("switch ") => {
                let target = cmd[7..].trim().to_string();
                if let Some(idx) = player_names.iter().position(|n| n == &target) { turn_index = idx; println!("  → {}", target); }
                else { println!("  Not found. Players: {}", player_names.join(", ")); turn_index = turn_index.saturating_sub(1); }
                continue;
            }
            "" => { turn_index = turn_index.saturating_sub(1); continue; }
            _ => {}
        }

        process_action(client, api_key, state, sessions, &name, &input);
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

fn main() {
    dotenv().ok();
    print_header();
    println!();
    let api_key = match std::env::var("HF_API_KEY") {
        Ok(k) if !k.is_empty() => { println!("  ✓ HF_API_KEY loaded."); k }
        _ => { println!("  Enter HuggingFace API key:"); read_line("  HF_API_KEY > ") }
    };
    let client = Client::builder().timeout(Duration::from_secs(120)).build().unwrap();
    loop {
        let (state, mut sessions) = run_title_setup(&client, &api_key);
        if !game_loop(&client, &api_key, &state, &mut sessions) { break; }
        println!(); sep('═', 60); println!("  Back at title...");
    }
    println!("\n  Goodbye.");
}
