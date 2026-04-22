use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelOption {
    pub label: &'static str,
    pub id: &'static str,
}

pub fn available_models() -> Vec<ModelOption> {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterFeatures {
    pub age: String,
    pub gender: String,
    pub build: String,
    pub height: String,
    pub hair_color: String,
    pub hair_style: String,
    pub eye_color: String,
    pub skin_tone: String,
    pub scars: String,
    pub clothing: String,
    pub expression: String,
    pub distinguishing: String,
    pub current_location: String,
    #[serde(flatten)]
    pub custom: HashMap<String, String>,
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
            format!(", {}", self.build),
            format!(", {}", self.height),
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InventoryItem {
    pub name: String,
    pub quantity: String,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SideCharacter {
    pub name: String,
    pub description: String,
    pub relation: String,
    pub outline_color: Option<String>,
    pub character_features: Option<HashMap<String, String>>,
    pub inventory: Option<Vec<InventoryItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Location {
    pub name: String,
    pub description: String,
    pub last_visited: u64,
    pub outline_color: Option<String>,
    pub location_features: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocationFeatures {
    pub interior: String,
    pub exterior: String,
    pub mood: String,
}

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
    pub kind: String,
    pub active: bool,
    pub current_level: u8,
    pub max_level: u8,
    pub level_names: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct SettingsUpdate {
    pub model: Option<String>,
    pub common_rules: Option<Vec<CommonRuleInput>>,
    pub scenario_rules: Option<Vec<bool>>,
}

#[derive(Debug, Deserialize)]
pub struct CommonRuleInput {
    pub active: bool,
    pub current_level: u8,
}

#[derive(Debug, Deserialize)]
pub struct SetupPayload {
    pub model: String,
    pub scenario_idx: usize,
    pub scenario_rules: Vec<bool>,
    pub common_rules: Vec<CommonRuleInput>,
    pub players: Vec<PlayerInput>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PlayerInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct QueuedCommand {
    pub player: String,
    pub text: String,
}

pub fn player_color(name: &str) -> String {
    let mut h: u64 = 0;
    for (i, c) in name.bytes().enumerate() {
        h = h.wrapping_add((c as u64).wrapping_mul(31u64.wrapping_pow(i as u32)));
    }
    let colors = ["#4a90d9", "#d97a4a", "#6bd94a", "#d94ab8", "#4ad9d1", "#d9c84a", "#8a4ad9", "#4ad96b"];
    let idx = (h as usize) % colors.len();
    colors[idx].to_string()
}