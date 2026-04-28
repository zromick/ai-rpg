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
    // The HF Inference Providers router only serves models that the current
    // free-tier providers (Together AI, Fireworks, Hyperbolic, etc.) actually
    // host. The list below is ordered with the currently-most-likely-available
    // options first; if the user gets `model_not_found`, switching down the
    // list in Settings is usually enough to get unstuck.
    vec![
        ModelOption { label: "Llama 3.3 70B Instruct (default)", id: "meta-llama/Llama-3.3-70B-Instruct" },
        ModelOption { label: "Qwen 2.5 72B Instruct",            id: "Qwen/Qwen2.5-72B-Instruct" },
        ModelOption { label: "Mistral Nemo 2407",                id: "mistralai/Mistral-Nemo-Instruct-2407" },
        ModelOption { label: "Llama 3.1 8B Instruct",            id: "meta-llama/Llama-3.1-8B-Instruct" },
        ModelOption { label: "Gemma 2 9B IT",                    id: "google/gemma-2-9b-it" },
        ModelOption { label: "Mistral 7B v0.3",                  id: "mistralai/Mistral-7B-Instruct-v0.3" },
        ModelOption { label: "Zephyr 7B Beta",                   id: "HuggingFaceH4/zephyr-7b-beta" },
        ModelOption { label: "Hermes 3 Llama 3.1 8B",            id: "NousResearch/Hermes-3-Llama-3.1-8B" },
        ModelOption { label: "Mixtral 8x7B",                     id: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
        ModelOption { label: "Phi-3 Medium 128k",                id: "microsoft/Phi-3-medium-128k-instruct" },
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
    #[serde(default)]
    pub romance_mode: bool,
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
    /// Last set of AI-suggested actions (3 strings) the user can pick by typing
    /// 1/2/3, or 4 to re-roll. Cleared once the player takes any action.
    assistant_options: Vec<String>,
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
            assistant_options: Vec::new(),
        }
    }
    fn restart(&mut self) {
        self.history = vec![Message { role: "system".to_string(), content: self.system_prompt.clone() }];
        self.stats.prompt_count = 0; self.stats.total_chars = 0; self.stats.prompt_log.clear();
        self.last_gm_reply = String::new();
        self.assistant_options.clear();
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
            "romance_mode": s.world.romance_mode,
            "turn": s.world.turn,
            "history": s.history.iter().filter(|m| m.role != "system").collect::<Vec<_>>(),
            "assistant_options": s.assistant_options,
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
    if !cmds.is_empty() {
        eprintln!("[queue] drained {} command(s) from {}", cmds.len(), CMD_FILE);
    }
    cmds
}


// ─── HuggingFace API ──────────────────────────────────────────────────────────

#[derive(Deserialize)] struct HFChoice { message: HFMsg }
#[derive(Deserialize)] struct HFMsg { content: String }
#[derive(Deserialize)] struct HFResp { choices: Vec<HFChoice> }

/// Some models — especially smaller Llama variants — return a reply that
/// repeats itself either as two near-identical halves or as the same sentence
/// twice in a row. This helper applies both checks: first it scans for any
/// substring that occurs back-to-back with itself (covers the "Crashing waves
/// fill your mouthCrashing waves fill your mouth" pattern), then it dedupes
/// consecutive identical sentences. Comparison ignores whitespace and case so
/// minor punctuation drift doesn't defeat the check.
fn deduplicate_self_repeat(reply: &str) -> String {
    let trimmed = reply.trim();
    if trimmed.len() < 30 { return trimmed.to_string(); }

    let normalize = |s: &str| -> String {
        s.chars().filter(|c| !c.is_whitespace()).flat_map(char::to_lowercase).collect()
    };

    // Pass 1: substring-doubled detection — find the longest k such that the
    // first k normalized chars equal the next k. If k is ≥30 chars (or ≥40%
    // of the reply), we treat the second copy as a hallucinated repeat and
    // truncate at a sentence boundary just past the first copy.
    let norm = normalize(trimmed);
    let n = norm.len();
    if n >= 30 {
        let max_k = n / 2;
        // Walk down from the largest plausible repeat (n/2) and look for the
        // largest k where norm[..k] == norm[k..2k]. Bail out as soon as we
        // hit a hit because that's the dominant repeat.
        for k in (30..=max_k).rev() {
            if &norm[..k] == &norm[k..2 * k] {
                // Find the sentence-terminating byte offset in the original
                // text that corresponds to roughly k normalized chars.
                let mut consumed = 0usize;
                let mut cut = trimmed.len();
                for (i, c) in trimmed.char_indices() {
                    if consumed >= k {
                        // Walk forward to the next sentence terminator so we
                        // don't slice mid-word. If there's no terminator,
                        // fall through and use the current position.
                        cut = trimmed[i..]
                            .find(|cc: char| matches!(cc, '.' | '!' | '?'))
                            .map(|j| i + j + 1)
                            .unwrap_or(i);
                        break;
                    }
                    if !c.is_whitespace() {
                        consumed += c.to_lowercase().count();
                    }
                }
                return trimmed[..cut].trim().to_string();
            }
        }
    }

    // Pass 2: consecutive-sentence dedup. Splits on .!? then drops any
    // sentence that is a normalized duplicate of the immediately preceding
    // one. Joins back with single spaces.
    let sentences: Vec<&str> = trimmed
        .split_inclusive(|c: char| matches!(c, '.' | '!' | '?'))
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    if sentences.len() < 2 { return trimmed.to_string(); }
    let mut kept: Vec<&str> = Vec::with_capacity(sentences.len());
    let mut last_norm: String = String::new();
    for s in &sentences {
        let n = normalize(s);
        if n == last_norm { continue; }
        last_norm = n;
        kept.push(s);
    }
    if kept.len() == sentences.len() { return trimmed.to_string(); }
    kept.join(" ")
}

/// HF's inference API is case-sensitive on model IDs. If the configured model
/// matches a known option case-insensitively but with the wrong casing, repair
/// it before the request goes out — otherwise we get `model_not_found` even
/// though the user picked a valid model from our list.
fn normalize_model_id(model: &str) -> String {
    let lower = model.to_lowercase();
    for opt in available_models() {
        if opt.id.to_lowercase() == lower {
            return opt.id.to_string();
        }
    }
    model.to_string()
}

fn call_hf(client: &Client, key: &str, model: &str, msgs: &[Message], max_tokens: u32) -> Result<String, Box<dyn std::error::Error>> {
    let url  = format!("{}/v1/chat/completions", HF_API_BASE);
    let model = normalize_model_id(model);
    // Roll up the prompt size so the player can see what's being shipped to HF
    // every turn — useful when debugging slow or failing calls.
    let prompt_chars: usize = msgs.iter().map(|m| m.content.chars().count()).sum();
    let started = std::time::Instant::now();
    eprintln!("[hf-call] → model={} max_tokens={} prompt_chars={} messages={}", model, max_tokens, prompt_chars, msgs.len());
    let body = json!({ "model": model, "messages": msgs.iter().map(|m| json!({"role":m.role,"content":m.content})).collect::<Vec<_>>(), "max_tokens": max_tokens, "temperature": 0.85, "top_p": 0.95 });
    let resp = client.post(&url).header("Authorization", format!("Bearer {}", key)).header("Content-Type","application/json").json(&body).send()?;
    let status = resp.status(); let text = resp.text()?;
    let elapsed_ms = started.elapsed().as_millis();
    if !status.is_success() {
        let err = format!("API {} Bad Request : {}", status, text);
        eprintln!("[hf-call] ✗ FAIL model={} status={} elapsed={}ms body={}", model, status, elapsed_ms, &text[..text.len().min(400)]);
        let _ = std::fs::write(ERROR_FILE, serde_json::to_string(&json!({"error": err})).unwrap_or_default());
        return Err(err.into());
    }
    let r: HFResp = serde_json::from_str(&text).map_err(|e| format!("parse: {} | {}", e, &text[..text.len().min(300)]))?;
    let reply = r.choices.into_iter().next().map(|c| c.message.content.trim().to_string()).ok_or_else(|| "empty response".to_string())?;
    eprintln!("[hf-call] ✓ ok model={} elapsed={}ms reply_chars={}", model, elapsed_ms, reply.chars().count());
    Ok(reply)
}

/// Wraps `call_hf` for GM responses with a soft 200-character cap. The base
/// prompt is augmented with a brevity instruction; if the model still overshoots
/// (>250 chars) we make a *second* call asking it to summarise its own reply
/// down to ≤200 characters while preserving the story beats. The summary
/// becomes the canonical reply that's stored in history and shown to the user.
const RESPONSE_CHAR_LIMIT: usize = 200;
const RESPONSE_CHAR_HARD_CAP: usize = 250;

fn call_hf_capped(client: &Client, key: &str, model: &str, msgs: &[Message]) -> Result<String, Box<dyn std::error::Error>> {
    let mut augmented: Vec<Message> = msgs.to_vec();
    // Append a per-turn brevity nudge as a system message so it doesn't pollute
    // the canonical history we pass back. We work on a clone.
    augmented.push(Message {
        role: "system".to_string(),
        content: format!(
            "BREVITY RULE: Reply in roughly {RESPONSE_CHAR_LIMIT} characters or fewer. \
Tighten prose. End on a clear hook for the player. Never exceed {RESPONSE_CHAR_HARD_CAP} characters."
        ),
    });

    let reply = deduplicate_self_repeat(&call_hf(client, key, model, &augmented, 1024)?);
    if reply.chars().count() <= RESPONSE_CHAR_HARD_CAP {
        return Ok(reply);
    }

    // Second pass: ask the model to summarise its own reply.
    eprintln!("  [brevity] reply was {} chars; summarising to ≤{}", reply.chars().count(), RESPONSE_CHAR_LIMIT);
    let summary_msgs = vec![
        Message {
            role: "system".to_string(),
            content: format!(
                "You are a literary editor. Rewrite the provided GM passage in {RESPONSE_CHAR_LIMIT} characters or fewer, \
preserving every named character, location, and key story beat. Keep the tone of the original. \
Output ONLY the rewritten passage — no preamble, no quotation marks, no metadata. Never exceed {RESPONSE_CHAR_HARD_CAP} characters."
            ),
        },
        Message { role: "user".to_string(), content: format!("Rewrite this:\n\n{}", reply) },
    ];
    match call_hf(client, key, model, &summary_msgs, 256) {
        Ok(s) if !s.trim().is_empty() => Ok(deduplicate_self_repeat(s.trim())),
        _ => Ok(reply), // fall back to the long version rather than dropping the turn
    }
}

// ─── AI Assistant: suggest 3 actions based on the current scene ───────────────

/// Generate three short, context-aware suggested actions for the player based
/// on the GM's last reply. Returns the parsed list (up to 3 entries) or empty
/// on any failure. The model is instructed to output one suggestion per line,
/// so this is just a quick second-pass call.
fn generate_assistant_options(client: &Client, key: &str, model: &str, last_gm_reply: &str) -> Vec<String> {
    if last_gm_reply.trim().is_empty() { return Vec::new(); }
    eprintln!("[assistant-call] generating 3 options model={} ctx_chars={}", model, last_gm_reply.chars().count());
    let sys = "You are a helpful suggestion engine for a text-based RPG. Given the GM's most recent message, you must propose three distinct, short actions the player could plausibly take next. Each action must be 4–12 words, written in second person, beginning with a verb. Output exactly three lines, one suggestion per line. No numbering, no preamble, no commentary. Just three lines.";
    let user = format!("GM: {}\n\nReturn three suggested actions, one per line.", last_gm_reply);
    let msgs = vec![
        Message { role: "system".to_string(), content: sys.to_string() },
        Message { role: "user".to_string(), content: user },
    ];
    match call_hf(client, key, model, &msgs, 256) {
        Ok(text) => text
            .lines()
            .map(|l| l.trim().trim_start_matches(|c: char| c.is_ascii_digit() || matches!(c, '.' | ')' | '-' | '*' | ':')).trim().to_string())
            .filter(|l| !l.is_empty())
            .take(3)
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// True if the AI Assistant common rule is currently active.
fn assistant_enabled(gs: &GameState) -> bool {
    gs.settings.common_rules.iter().any(|r| r.label == "AI Assistant" && r.active)
}

/// Schema-placeholder fragments the model occasionally parrots back verbatim
/// instead of filling in real values ("item name", "full name (first and last)",
/// etc.). If any of these substrings appears inside an extracted field we treat
/// the entry as garbage and drop it.
const SCHEMA_PLACEHOLDER_FRAGMENTS: &[&str] = &[
    "item name",
    "number or description",
    "condition or context",
    "full name (first and last)",
    "2 sentences describing physical appearance",
    "2 sentences describing the atmosphere",
    "ally|enemy|neutral|unknown",
    "place name",
    "what they're wearing",
    "slender/muscular",
    "young/middle-aged",
    "male/female/etc",
    "#rrggbb",
];

fn looks_like_schema_placeholder(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    if lower.is_empty() { return false; }
    SCHEMA_PLACEHOLDER_FRAGMENTS.iter().any(|frag| lower.contains(frag))
}

fn inventory_item_is_placeholder(item: &InventoryItem) -> bool {
    looks_like_schema_placeholder(&item.name)
        || looks_like_schema_placeholder(&item.quantity)
        || looks_like_schema_placeholder(&item.note)
}

fn side_character_is_placeholder(c: &SideCharacter) -> bool {
    looks_like_schema_placeholder(&c.name)
        || looks_like_schema_placeholder(&c.description)
        || looks_like_schema_placeholder(&c.relation)
}

fn location_is_placeholder(l: &Location) -> bool {
    looks_like_schema_placeholder(&l.name) || looks_like_schema_placeholder(&l.description)
}

/// Parse a scenario's `user_inventory` string ("Rusted spoon, threadbare tunic,
/// 3 copper coins") into structured InventoryItems so the player has gear from
/// turn 0 instead of waiting for the model to materialise the list. Quantity is
/// pulled out of leading digits when present, otherwise defaults to "1".
fn parse_starting_inventory(raw: &str) -> Vec<InventoryItem> {
    raw.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|entry| {
            let mut quantity = String::from("1");
            let mut name = entry.to_string();
            let mut chars = entry.chars();
            let leading_num: String = chars.by_ref().take_while(|c| c.is_ascii_digit()).collect();
            if !leading_num.is_empty() {
                let rest: String = entry[leading_num.len()..].trim_start().to_string();
                if !rest.is_empty() {
                    quantity = leading_num;
                    name = rest;
                }
            }
            InventoryItem { name, quantity, note: String::new() }
        })
        .collect()
}

// ─── Extraction ───────────────────────────────────────────────────────────────

/// Common English words that the LLM occasionally tries to register as
/// characters or locations. We filter these post-extraction to keep the JSON
/// output usable even if the prompt-side rules are partially ignored.
const NAME_STOPWORDS: &[&str] = &[
    "the", "a", "an", "you", "i", "he", "she", "it", "they", "we", "me", "us",
    "this", "that", "these", "those", "my", "your", "his", "her", "their",
    "sir", "lady", "lord", "miss", "mr", "mrs",
];

fn is_name_stopword(name: &str) -> bool {
    let trimmed = name.trim();
    if trimmed.len() < 2 { return true; }
    let lower = trimmed.to_lowercase();
    if NAME_STOPWORDS.contains(&lower.as_str()) { return true; }
    // Drop "names" that are entirely a stopword token followed by a non-letter.
    let first_word = lower.split_whitespace().next().unwrap_or("");
    NAME_STOPWORDS.contains(&first_word) && lower.split_whitespace().count() == 1
}

/// Two names refer to the same entity when one is a substring of the other
/// (case-insensitive, whole-word-aware on at least one side). Examples:
///   "John" ↔ "John Smith"           → same
///   "Aldric Shadowmere" ↔ "Aldric"  → same
///   "Tavern" ↔ "The Sleeping Tavern"→ same
///   "Aldric" ↔ "Aldric's Tavern"    → same (location includes character name; we keep the longer one)
fn names_overlap(a: &str, b: &str) -> bool {
    let a = a.trim().to_lowercase();
    let b = b.trim().to_lowercase();
    if a.is_empty() || b.is_empty() { return false; }
    if a == b { return true; }
    // Substring containment with word-boundary check: "Al" should not match "Aldric"
    // but "Aldric" should match "Aldric Shadowmere".
    fn contains_word(haystack: &str, needle: &str) -> bool {
        for (i, _) in haystack.match_indices(needle) {
            let before_ok = i == 0 || !haystack.as_bytes()[i - 1].is_ascii_alphanumeric();
            let end = i + needle.len();
            let after_ok = end == haystack.len() || !haystack.as_bytes()[end].is_ascii_alphanumeric();
            if before_ok && after_ok { return true; }
        }
        false
    }
    contains_word(&a, &b) || contains_word(&b, &a)
}

/// Collapse near-duplicates in a name-keyed list, preferring the longer name
/// when two entries overlap (longer is usually richer — "Aldric Shadowmere"
/// beats "Aldric"). Order is preserved otherwise.
fn dedup_by_name<T, F>(items: Vec<T>, name_of: F) -> Vec<T>
where F: Fn(&T) -> String {
    let mut kept: Vec<T> = Vec::with_capacity(items.len());
    for item in items {
        let name = name_of(&item);
        // Find an existing entry that overlaps with this one.
        let dup_idx = kept.iter().position(|k| names_overlap(&name_of(k), &name));
        match dup_idx {
            Some(i) => {
                let existing = name_of(&kept[i]);
                // Replace existing only if the new name is strictly longer
                // (more informative). Otherwise keep what we already have.
                if name.len() > existing.len() {
                    kept[i] = item;
                }
            }
            None => kept.push(item),
        }
    }
    kept
}

fn extract(client: &Client, key: &str, model: &str, action: &str, reply: &str, world: &WorldState) -> (WorldState, Option<String>, bool, Option<u32>) {
    let inv   = serde_json::to_string(&world.inventory).unwrap_or_default();
    let chars = serde_json::to_string(&world.side_characters).unwrap_or_default();
    let locs  = serde_json::to_string(&world.locations).unwrap_or_default();

    let sys = r#"You are a JSON extraction engine for an RPG. You receive game events and return ONLY a raw JSON object — no markdown, no code fences, no explanation. Any deviation from pure JSON will cause a system error."#;

let prev_battle = world.battle_mode;
    let prev_romance = world.romance_mode;
    let main_steps_hint = "(check the system prompt's main_quest_steps list for step numbers)";

    let user = format!(r##"Player action: {action}
GM response: {reply}

Current inventory JSON: {inv}
Current side_characters JSON: {chars}
Current locations JSON: {locs}
Current in-game time: {curr_time}
Current nicknames: {nicknames}
Previous battle_mode: {prev_battle}
Previous romance_mode: {prev_romance}

Produce this exact JSON (all fields required, use the exact field names shown, do not hallucinate, do not make up answers):
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
  "battle_mode": true or false,
  "romance_mode": true or false
}}

Critical rules (every one of these rules is important):
  1. COPY ALL existing entries from current arrays unless they explicitly changed.
  2. ADD any new characters mentioned BY NAME in the GM response (guards, merchants, named NPCs, animals with roles).
     STRICT EXCLUSION LIST — never add as a character: "You", "the", "The", "I", "He", "She", "It", "They", "We",
     "A", "An", "Sir", "Lady", "Lord", or any single-letter token. These are common English words, not names.
     A character name MUST contain at least one capitalised proper noun that isn't on the exclusion list.
  3. ADD the current location if it can be identified from context. Apply the same exclusion list — never add "The" or "You" as a location.
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
  14. completed_quest_step: Look at BOTH the player action AND the GM response together. If the action+reply pair clearly resolves a step from the main quest steps {main_steps_hint} (e.g., player finds food and the GM confirms food was acquired; player negotiates with a guard and the GM confirms safe passage), set this to the 1-based step number completed. If neither the action NOR the reply shows a step finishing, return null. Do NOT mark a step done speculatively.
  15. battle_mode: Look at BOTH the action AND the response. Set true if EITHER the player's action initiates combat/violence/threat (drawing weapons, attacking, fleeing under fire) OR the GM response describes active combat, weapon use, blood being spilled, or imminent physical danger. Set false if the scene becomes peaceful or the fight ends. If neither side indicates a change, keep the previous value ({prev_battle}).
  16. romance_mode: Look at BOTH the action AND the response. Set true if EITHER the player initiates intimacy/flirtation OR the GM response describes mutual romantic intimacy, kissing, declarations of love, or an erotically charged scene. Set false when the moment passes. If neither side indicates a change, keep the previous value ({prev_romance}).
  17. Return ONLY the JSON object starting with {{ — nothing before or after."##,
        action=action, reply=reply, inv=inv, chars=chars, locs=locs, turn=world.turn+1, curr_time=world.current_datetime.as_deref().unwrap_or("unknown"), nicknames=world.nicknames.join(", "), prev_battle=prev_battle, prev_romance=prev_romance, main_steps_hint=main_steps_hint);

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
                    let mut new_inv:   Vec<InventoryItem>  = serde_json::from_value(v["inventory"].clone()).unwrap_or(world.inventory.clone());
                    let mut new_chars: Vec<SideCharacter>  = serde_json::from_value(v["side_characters"].clone()).unwrap_or(world.side_characters.clone());
                    let mut new_locs:  Vec<Location>       = serde_json::from_value(v["locations"].clone()).unwrap_or(world.locations.clone());
                    // Drop any entry where the model just parroted the schema's
                    // placeholder text ("item name", "full name (first and last)",
                    // etc.) instead of filling in a real value.
                    new_inv.retain(|i| !inventory_item_is_placeholder(i));
                    new_chars.retain(|c| !side_character_is_placeholder(c));
                    new_locs.retain(|l| !location_is_placeholder(l));
                    new_chars.retain(|c| !is_name_stopword(&c.name));
                    new_locs.retain(|l| !is_name_stopword(&l.name));
                    // Drop any side_character whose name overlaps with a
                    // nickname the player already goes by — otherwise the
                    // model re-extracts the player as an "unknown" NPC every
                    // turn and the characters pane fills with duplicates of
                    // the player themselves.
                    new_chars.retain(|c| {
                        !world.nicknames.iter().any(|nn| names_overlap(&c.name, nn))
                    });
                    // Same protection for inventory: filter out entries that
                    // duplicate an existing inventory item by name (e.g. the
                    // model re-emits the starting kit on every turn).
                    new_inv = dedup_by_name(new_inv, |i| i.name.clone());
                    // Collapse near-duplicates ("John" vs "John Smith") so the
                    // characters/locations panes don't accumulate variants of
                    // the same entity.
                    new_chars = dedup_by_name(new_chars, |c| c.name.clone());
                    new_locs  = dedup_by_name(new_locs,  |l| l.name.clone());
                    let curr_loc   = v["current_location"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let curr_time = v["current_datetime"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let clothing  = v["clothing_update"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let game_won  = v["game_won"].as_bool().unwrap_or(false);
                    let new_nickname = v["new_nickname"].as_str().filter(|s| !s.trim().is_empty() && *s != "null").map(str::to_string);
                    let completed_step = v["completed_quest_step"].as_u64().map(|n| n as u32);
                    // Only set modes to true if explicitly returned as true - preserve existing if not specified
                    let battle_mode = v["battle_mode"].as_bool().unwrap_or(world.battle_mode);
                    let romance_mode = v["romance_mode"].as_bool().unwrap_or(world.romance_mode);
                    let mut new_world = WorldState { inventory: new_inv, side_characters: new_chars, locations: new_locs, current_location: curr_loc, current_datetime: curr_time, turn: world.turn+1, battle_mode, romance_mode, ..Default::default() };
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

    // Set Theme based on scenario
    let scenario_title_lower = story.title.to_lowercase();
    let default_theme = if scenario_title_lower.contains("void") || scenario_title_lower.contains("merchant") || scenario_title_lower.contains("space") {
        5 // Space theme
    } else if scenario_title_lower.contains("debt collector") || scenario_title_lower.contains("cursed relic") || scenario_title_lower.contains("assassin") || scenario_title_lower.contains("forgotten temple") || scenario_title_lower.contains("haunted") {
        4 // Crimson theme
    } else if scenario_title_lower.contains("shipwreck") || scenario_title_lower.contains("veteran") || scenario_title_lower.contains("double agent") || scenario_title_lower.contains("obsidian") {
        3 // Ocean theme
    } else if scenario_title_lower.contains("grain") || scenario_title_lower.contains("poison") || scenario_title_lower.contains("forest") {
        2 // Forest theme
    } else {
        1 // Classic theme (default)
    };

    // Update Theme rule to scenario default if not explicitly set by user
    for entry in rule_set.entries.iter_mut() {
        if entry.label == "Theme" && entry.current_level == 1 {
            entry.current_level = default_theme;
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
    match call_hf_capped(client, key, &gs.model, &session.history) {
        Ok(reply) => {
            println!("\n{}\n", reply);
            session.last_gm_reply = reply.clone();
            session.history.push(Message { role: "assistant".to_string(), content: reply.clone() });
            print!("  [extracting world state...]"); io::stdout().flush().unwrap();
            let (mut w, _, _, _) = extract(client, key, &gs.model, "game start", &reply, &session.world);
            // The opening scene is narrative scene-setting, not combat or romance.
            // Forcing both modes to false on turn 0 prevents the GM from accidentally
            // marking the player as already-in-battle just because the prompt
            // mentions a sword or a fight that's about to happen.
            w.battle_mode = false;
            w.romance_mode = false;
            // Seed the player with the scenario's starting gear if the extract
            // step came back empty — otherwise the inventory pane reads "(empty)"
            // even when the scenario explicitly hands the player items.
            if w.inventory.is_empty() {
                if let Some(story) = story_prompts().iter().find(|s| s.title == gs.scenario_title) {
                    let seeded = parse_starting_inventory(story.user_inventory);
                    if !seeded.is_empty() {
                        w.inventory = seeded;
                    }
                }
            }
            session.world = w;
            // If the AI Assistant rule is on, suggest the player's first three moves.
            if assistant_enabled(gs) {
                session.assistant_options = generate_assistant_options(client, key, &gs.model, &session.last_gm_reply);
            }
            println!(" done.");
            let mut s2 = snap.clone(); s2.insert(session.stats.name.clone(), session.clone());
            write_state(gs, &s2, &session.stats.name);
        }
        Err(e) => { eprintln!("  [ERROR opening scene] {}", e); let _ = std::fs::write(ERROR_FILE, serde_json::to_string(&json!({"error": e.to_string()})).unwrap_or_default()); },
    }
}

// ─── Process action ───────────────────────────────────────────────────────────

fn process_action(client: &Client, key: &str, gs: &mut GameState, sessions: &mut HashMap<String, PlayerSession>, name: &str, input: &str) {
    // Log every action that reaches the engine. Truncated so a long action
    // doesn't dominate the console, but enough to trace what the player typed.
    let preview: String = input.chars().take(80).collect();
    eprintln!("[action] player={} input=\"{}\"", name, preview);
    // Resolve numeric shortcuts (1/2/3/4) when assistant options are pending.
    // 1/2/3 → submit the corresponding option as the player's action.
    // 4     → request a fresh assistant pass without taking an action.
    let resolved_input = {
        let trimmed = input.trim();
        if let Some(s) = sessions.get(name) {
            if !s.assistant_options.is_empty() {
                match trimmed {
                    "1" | "2" | "3" => {
                        let idx: usize = trimmed.parse::<usize>().unwrap_or(1) - 1;
                        s.assistant_options.get(idx).cloned()
                    }
                    "4" => Some("assistant".to_string()),
                    _ => None,
                }
            } else { None }
        } else { None }
    };
    let input_owned = resolved_input.unwrap_or_else(|| input.to_string());
    let input = input_owned.as_str();

    // Explicit assistant command — always available, regardless of the
    // AI Assistant rule's on/off state.
    let trimmed_lower = input.trim().to_lowercase();
    if trimmed_lower == "assistant" || trimmed_lower == "a" {
        // Pull the most recent GM context. `last_gm_reply` is the canonical
        // source, but it can be empty right after a save is restored — fall
        // back to the last assistant turn in history so the suggestion call
        // still has something to work with.
        let last_reply = sessions.get(name).map(|s| {
            if !s.last_gm_reply.trim().is_empty() {
                s.last_gm_reply.clone()
            } else {
                s.history.iter().rev()
                    .find(|m| m.role == "assistant")
                    .map(|m| m.content.clone())
                    .unwrap_or_default()
            }
        }).unwrap_or_default();
        eprintln!("[assistant] requested by {}; context={} chars", name, last_reply.len());
        let options = generate_assistant_options(client, key, &gs.model, &last_reply);
        if options.is_empty() {
            // Silent empty options leave the UI stuck on "Asking…" forever.
            // Surface the failure so the snackbar fires and the player knows
            // to retry or swap models.
            eprintln!("[assistant] no options returned (model={}, ctx_empty={})", gs.model, last_reply.trim().is_empty());
            let msg = if last_reply.trim().is_empty() {
                "Assistant has no scene context yet — take a turn first, then try again."
            } else {
                "Assistant couldn't suggest moves right now — try a different model from Settings or try again."
            };
            let _ = std::fs::write(ERROR_FILE, serde_json::to_string(&json!({"error": msg})).unwrap_or_default());
        }
        if let Some(s) = sessions.get_mut(name) { s.assistant_options = options; }
        write_state(gs, sessions, name);
        return;
    }

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
    // The previous turn's assistant suggestions are stale once the player
    // chooses their next action. Clear them.
    session.assistant_options.clear();

    println!("\n  [The GM responds...]\n");
    let hist = sessions[name].history.clone();
    match call_hf_capped(client, key, &gs.model, &hist) {
        Ok(reply) => {
            println!("{}\n", reply);
            print!("  [updating world state...]"); io::stdout().flush().unwrap();
            let world = sessions[name].world.clone();
            let (new_world, clothing, game_won, completed_step) = extract(client, key, &gs.model, input, &reply, &world);
            println!(" done.");
            let s = sessions.get_mut(name).unwrap();
            s.last_gm_reply = reply.clone();
            // Backend-side dedup: don't append an assistant message that's
            // identical to the previous assistant turn. This prevents the
            // history from growing duplicate entries that the UI used to mask
            // with its own dedup pass.
            let last_assistant = s.history.iter().rev().find(|m| m.role == "assistant").map(|m| m.content.clone());
            if last_assistant.as_deref() != Some(reply.as_str()) {
                s.history.push(Message { role: "assistant".to_string(), content: reply });
            } else {
                eprintln!("  [dedup] skipped duplicate assistant reply");
            }
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
            // If the AI Assistant rule is on, generate suggestions for the next turn.
            if assistant_enabled(gs) {
                let last_reply = sessions.get(name).map(|s| s.last_gm_reply.clone()).unwrap_or_default();
                let options = generate_assistant_options(client, key, &gs.model, &last_reply);
                if let Some(s) = sessions.get_mut(name) { s.assistant_options = options; }
            }
            write_state(gs, sessions, name);
        }
        Err(e) => {
            eprintln!("  [ERROR] {}", e);
            let _ = std::fs::write(ERROR_FILE, serde_json::to_string(&json!({"error": e.to_string()})).unwrap_or_default());
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
    // When launched via `npm run start`, the cwd is frontend/, so a bare
    // dotenv() may miss the project-root .env. Try the project root first
    // (anchored on CARGO_MANIFEST_DIR), then fall back to cwd.
    let manifest_env = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    let _ = dotenvy::from_path(&manifest_env).or_else(|_| dotenv().map(|_| ()));
    let key = match std::env::var("HF_TOKEN") {
        Ok(k) if !k.is_empty() => { eprintln!("[game] HF_TOKEN loaded."); k }
        _ => { eprint!("HF_TOKEN not set. Enter key: "); io::stdout().flush().unwrap(); read_line("") }
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
