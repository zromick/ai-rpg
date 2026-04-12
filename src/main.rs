mod prompts;

use std::collections::HashMap;
use std::io::{self, Write};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use dotenvy::dotenv;

use prompts::{
    build_system_prompt, pick_side_quests, story_prompts, CommonRuleKind, RuleEntry, RuleSet,
    SideQuest, StoryPrompt,
};

// ─── HuggingFace config ───────────────────────────────────────────────────────

const HF_API_BASE: &str = "https://router.huggingface.co";

struct ModelOption {
    label: &'static str,
    id: &'static str,
}

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

// ─── Game State (shared across all players) ───────────────────────────────────

struct GameState {
    model: String,
    main_quest: String,
    side_quests: Vec<SideQuest>,
}

// ─── Prompt log ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct PromptRecord {
    number: u64,
    char_count: usize,
    full_text: String,
}

// ─── Session data ─────────────────────────────────────────────────────────────

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
}

impl PlayerSession {
    fn new(name: &str, system_prompt: &str) -> Self {
        PlayerSession {
            stats: PlayerStats {
                name: name.to_string(),
                prompt_count: 0,
                total_chars: 0,
                prompt_log: Vec::new(),
            },
            history: vec![Message {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            }],
            system_prompt: system_prompt.to_string(),
        }
    }

    fn restart(&mut self) {
        self.history = vec![Message {
            role: "system".to_string(),
            content: self.system_prompt.clone(),
        }];
        self.stats.prompt_count = 0;
        self.stats.total_chars = 0;
        self.stats.prompt_log.clear();
    }
}

// ─── HuggingFace API ──────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct HFChoice {
    message: HFMessage,
}
#[derive(Deserialize, Debug)]
struct HFMessage {
    content: String,
}
#[derive(Deserialize, Debug)]
struct HFResponse {
    choices: Vec<HFChoice>,
}

fn call_hf_api(
    client: &Client,
    api_key: &str,
    model: &str,
    history: &[Message],
) -> Result<String, Box<dyn std::error::Error>> {
    let url = format!("{}/v1/chat/completions", HF_API_BASE);
    let messages_json: Vec<serde_json::Value> = history
        .iter()
        .map(|m| json!({"role": m.role, "content": m.content}))
        .collect();
    let body = json!({
        "model": model,
        "messages": messages_json,
        "max_tokens": 512,
        "temperature": 0.85,
        "top_p": 0.95
    });
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()?;
    let status = resp.status();
    let text = resp.text()?;
    if !status.is_success() {
        return Err(format!("API error {}: {}", status, text).into());
    }
    let hf: HFResponse = serde_json::from_str(&text)
        .map_err(|e| format!("Parse error: {}\nRaw: {}", e, text))?;
    hf.choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .ok_or_else(|| "Empty response from API".into())
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

fn sep(ch: char, width: usize) {
    println!("{}", ch.to_string().repeat(width));
}

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

// ─── Quest display helpers ────────────────────────────────────────────────────

fn print_main_quest(state: &GameState) {
    sep('═', 60);
    println!("  ♛  MAIN QUEST");
    sep('─', 60);
    println!("  {}", state.main_quest);
    sep('═', 60);
}

fn print_side_quests(state: &GameState) {
    sep('═', 60);
    println!("  ⚔  SIDE QUESTS");
    sep('─', 60);
    if state.side_quests.is_empty() {
        println!("  No side quests are active for this game.");
    } else {
        for (i, q) in state.side_quests.iter().enumerate() {
            println!("  [{}] {}", i + 1, q.title);
            println!("      {}", q.description);
            if i + 1 < state.side_quests.len() {
                sep('·', 60);
            }
        }
    }
    sep('═', 60);
}

fn print_quests_summary(state: &GameState) {
    print_main_quest(state);
    print_side_quests(state);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

fn print_stats(sessions: &HashMap<String, PlayerSession>) {
    sep('═', 60);
    println!("  PLAYER STATS");
    sep('═', 60);
    let mut players: Vec<&PlayerSession> = sessions.values().collect();
    players.sort_by_key(|s| &s.stats.name);
    for s in players {
        sep('─', 60);
        println!(
            "  Player: {}  │  Total Prompts: {}  │  Total Chars: {}",
            s.stats.name, s.stats.prompt_count, s.stats.total_chars
        );
        sep('─', 60);
        if s.stats.prompt_log.is_empty() {
            println!("  (no prompts yet)");
        } else {
            for rec in &s.stats.prompt_log {
                println!("  ── Prompt #{} ({} chars) ──", rec.number, rec.char_count);
                println!("  {}", rec.full_text);
            }
        }
    }
    sep('═', 60);
}

// ─── Model selection ──────────────────────────────────────────────────────────

fn select_model() -> String {
    let models = available_models();
    sep('═', 60);
    println!("  SELECT AI MODEL");
    sep('─', 60);
    for (i, m) in models.iter().enumerate() {
        println!("  [{}] {}", i + 1, m.label);
    }
    sep('─', 60);
    println!("  Press Enter to use the default (Llama-3.1-8B-Instruct).");
    sep('─', 60);
    loop {
        let raw = read_line("  Choose model > ");
        if raw.is_empty() {
            println!("  ✓ Using default: {}", models[0].id);
            return models[0].id.to_string();
        }
        if let Ok(n) = raw.trim().parse::<usize>() {
            if n >= 1 && n <= models.len() {
                println!("  ✓ Model selected: {}", models[n - 1].id);
                return models[n - 1].id.to_string();
            }
        }
        println!("  Enter a number 1–{} or press Enter for default.", models.len());
    }
}

// ─── Scenario selection ───────────────────────────────────────────────────────

fn select_scenario() -> usize {
    let scenarios = story_prompts();
    sep('═', 60);
    println!("  SELECT A SCENARIO");
    sep('─', 60);
    for (i, s) in scenarios.iter().enumerate() {
        println!("  [{}] {}", i + 1, s.title);
        println!("      {}", s.description);
    }
    sep('─', 60);
    println!("  [H] Help — inspect a scenario in detail before choosing");
    sep('─', 60);
    loop {
        let raw = read_line("  Choose scenario (or H) > ");
        let lower = raw.trim().to_lowercase();
        if lower == "h" || lower == "help" {
            scenario_help_menu(&scenarios);
            sep('─', 60);
            for (i, s) in scenarios.iter().enumerate() {
                println!("  [{}] {}", i + 1, s.title);
                println!("      {}", s.description);
            }
            sep('─', 60);
            continue;
        }
        if let Ok(n) = raw.trim().parse::<usize>() {
            if n >= 1 && n <= scenarios.len() {
                println!("\n  ✓ Scenario selected: {}\n", scenarios[n - 1].title);
                return n - 1;
            }
        }
        println!("  Please enter a number 1–{} or H.", scenarios.len());
    }
}

// ─── Scenario help viewer ─────────────────────────────────────────────────────

fn scenario_help_menu(scenarios: &[StoryPrompt]) {
    println!();
    sep('─', 60);
    println!("  HELP — which scenario do you want to inspect?");
    for (i, s) in scenarios.iter().enumerate() {
        println!("  [{}] {}", i + 1, s.title);
    }
    sep('─', 60);
    let idx: usize = loop {
        let r = read_line("  Scenario > ");
        match r.trim().parse::<usize>() {
            Ok(n) if n >= 1 && n <= scenarios.len() => break n - 1,
            _ => println!("  Enter 1–{}.", scenarios.len()),
        }
    };
    let story = &scenarios[idx];
    loop {
        println!();
        sep('─', 60);
        println!("  INSPECTING: {}", story.title);
        sep('─', 60);
        println!("  [1] Title");
        println!("  [2] Description");
        println!("  [3] System Instructions");
        println!("  [4] Setting Details");
        println!("  [5] Opening Scene");
        println!("  [6] Starting Condition");
        println!("  [7] Starting Inventory");
        println!("  [8] Scenario Rules");
        println!("  [9] Win Conditions");
        println!("  [B] Back");
        sep('─', 60);
        let choice = read_line("  Inspect field > ");
        match choice.trim().to_lowercase().as_str() {
            "1" => println!("\n  TITLE:\n  {}", story.title),
            "2" => println!("\n  DESCRIPTION:\n  {}", story.description),
            "3" => println!("\n  SYSTEM INSTRUCTIONS:\n  {}", story.system_instructions),
            "4" => {
                println!("\n  SETTING DETAILS:");
                for (i, sd) in story.setting_details.iter().enumerate() {
                    println!("  [{}] {}: {}", i + 1, sd.label, sd.detail);
                }
            }
            "5" => println!("\n  OPENING SCENE:\n  {}", story.opening_scene),
            "6" => println!("\n  STARTING CONDITION:\n  {}", story.user_condition),
            "7" => println!("\n  STARTING INVENTORY:\n  {}", story.user_inventory),
            "8" => {
                println!("\n  SCENARIO RULES:");
                for (i, r) in story.scenario_rules.iter().enumerate() {
                    let default_str = match r.kind {
                        prompts::RuleKind::Boolean { default } => {
                            if default { "ON".to_string() } else { "OFF".to_string() }
                        }
                        prompts::RuleKind::Level { default, .. } => format!("Level {}", default),
                    };
                    println!("  [{}] {} (default: {})", i + 1, r.label, default_str);
                    println!("      {}", r.description);
                }
            }
            "9" => println!("\n  WIN CONDITIONS:\n  {}", story.win_conditions),
            "b" | "back" => break,
            _ => println!("  Unknown option."),
        }
    }
}

// ─── Scenario rule configurator ───────────────────────────────────────────────

fn configure_scenario_rules(story: &StoryPrompt) -> Vec<bool> {
    let mut enabled: Vec<bool> = story
        .scenario_rules
        .iter()
        .map(|r| match r.kind {
            prompts::RuleKind::Boolean { default } => default,
            prompts::RuleKind::Level { default, .. } => default > 0,
        })
        .collect();
    if story.scenario_rules.is_empty() {
        return enabled;
    }
    loop {
        println!();
        sep('─', 60);
        println!("  SCENARIO RULES — toggle before play (or DONE to continue)");
        sep('─', 60);
        for (i, r) in story.scenario_rules.iter().enumerate() {
            let state = if enabled[i] { "ON " } else { "OFF" };
            println!("  [{}] [{}] {}", i + 1, state, r.label);
            println!("          {}", r.description);
        }
        sep('─', 60);
        let input = read_line("  Toggle rule # (or DONE) > ");
        match input.trim().to_lowercase().as_str() {
            "done" | "d" | "" => break,
            s => {
                if let Ok(n) = s.parse::<usize>() {
                    if n >= 1 && n <= enabled.len() {
                        enabled[n - 1] = !enabled[n - 1];
                        println!(
                            "  ✓ '{}' is now {}.",
                            story.scenario_rules[n - 1].label,
                            if enabled[n - 1] { "ON" } else { "OFF" }
                        );
                        continue;
                    }
                }
                println!("  Enter a rule number or DONE.");
            }
        }
    }
    enabled
}

// ─── Common rule configurator ─────────────────────────────────────────────────

fn configure_common_rules() -> RuleSet {
    let mut rule_set = RuleSet::from_defaults();
    loop {
        println!();
        sep('─', 60);
        println!("  UNIVERSAL GM RULES — configure before play (or DONE to continue)");
        sep('─', 60);
        for (i, entry) in rule_set.entries.iter().enumerate() {
            let state_str = rule_entry_state_str(entry);
            println!("  [{:>2}] [{}] {}", i + 1, state_str, entry.label);
            println!("          {}", entry.description);
        }
        sep('─', 60);
        println!("  Enter a rule number to toggle/adjust, or DONE to continue.");
        sep('─', 60);
        let input = read_line("  > ");
        match input.trim().to_lowercase().as_str() {
            "done" | "d" | "" => break,
            s => {
                if let Ok(n) = s.parse::<usize>() {
                    if n >= 1 && n <= rule_set.entries.len() {
                        edit_rule_entry(&mut rule_set.entries[n - 1]);
                        continue;
                    }
                }
                println!("  Enter a rule number or DONE.");
            }
        }
    }
    rule_set
}

fn rule_entry_state_str(entry: &RuleEntry) -> String {
    match &entry.kind {
        CommonRuleKind::Boolean { .. } => {
            if entry.active { "ON ".to_string() } else { "OFF".to_string() }
        }
        CommonRuleKind::Level { levels, .. } => {
            let lv = entry.current_level;
            let name = levels.iter().find(|l| l.level == lv).map(|l| l.name).unwrap_or("?");
            format!("Lv {:>2} — {}", lv, name)
        }
    }
}

fn edit_rule_entry(entry: &mut RuleEntry) {
    match &entry.kind {
        CommonRuleKind::Boolean { .. } => {
            entry.active = !entry.active;
            println!(
                "  ✓ '{}' is now {}.",
                entry.label,
                if entry.active { "ON" } else { "OFF" }
            );
        }
        CommonRuleKind::Level { levels, .. } => {
            println!();
            sep('─', 60);
            println!("  SETTING LEVEL: {}", entry.label);
            sep('─', 60);
            for l in levels.iter() {
                let cur = if l.level == entry.current_level { " ◄" } else { "" };
                println!("  [{:>2}] {:>12}  — {}{}", l.level, l.name, l.description, cur);
            }
            sep('─', 60);
            loop {
                let r = read_line(&format!(
                    "  Enter level 1–{} (current: {}) or Enter to keep > ",
                    levels.len(),
                    entry.current_level
                ));
                if r.is_empty() { break; }
                match r.trim().parse::<u8>() {
                    Ok(n) if levels.iter().any(|l| l.level == n) => {
                        // For Side Quests, level 0 = off
                        entry.current_level = n;
                        entry.active = n > 0;
                        let name = levels.iter().find(|l| l.level == n).map(|l| l.name).unwrap_or("?");
                        println!("  ✓ '{}' set to Level {} ({}).", entry.label, n, name);
                        break;
                    }
                    _ => println!("  Enter a number 1–{}.", levels.len()),
                }
            }
        }
    }
}

// ─── Player setup ─────────────────────────────────────────────────────────────

fn setup_players(system_prompt: &str) -> HashMap<String, PlayerSession> {
    let mut sessions = HashMap::new();
    println!();
    sep('─', 60);
    println!("  PLAYER SETUP");
    sep('─', 60);
    println!("  How many players? (1–8)");
    let count: usize = loop {
        let s = read_line("  > ");
        match s.trim().parse::<usize>() {
            Ok(n) if n >= 1 && n <= 8 => break n,
            _ => println!("  Please enter a number between 1 and 8."),
        }
    };
    for i in 1..=count {
        let name = loop {
            let n = read_line(&format!("  Name for Player {}: ", i));
            if n.is_empty() {
                println!("  Name cannot be empty.");
            } else if sessions.contains_key(&n) {
                println!("  Name already taken.");
            } else {
                break n;
            }
        };
        println!("  ✓ {} added.", name);
        sessions.insert(name.clone(), PlayerSession::new(&name, system_prompt));
    }
    sessions
}

// ─── Opening scene ────────────────────────────────────────────────────────────

fn opening_scene(
    client: &Client,
    api_key: &str,
    model: &str,
    session: &mut PlayerSession,
) {
    println!("\n  Generating opening scene for {}...", session.stats.name);
    let intro = "Begin the game. Deliver the opening scene exactly as written in \
your instructions. Describe the environment vividly with full sensory detail and present \
the first situation and choices. Address the player as 'you'.".to_string();
    session.history.push(Message { role: "user".to_string(), content: intro });
    match call_hf_api(client, api_key, model, &session.history) {
        Ok(reply) => {
            session.history.push(Message {
                role: "assistant".to_string(),
                content: reply.clone(),
            });
            sep('─', 60);
            println!("\n{}\n", reply);
        }
        Err(e) => eprintln!("  [ERROR] Could not reach AI: {}", e),
    }
}

// ─── Title setup ──────────────────────────────────────────────────────────────

fn run_title_setup(
    client: &Client,
    api_key: &str,
) -> (GameState, HashMap<String, PlayerSession>) {
    print_header();

    let model = select_model();
    let scenario_idx = select_scenario();
    let scenarios = story_prompts();
    let story = &scenarios[scenario_idx];

    let _scenario_rule_states = configure_scenario_rules(story);
    let common_rules = configure_common_rules();

    // ── Pick side quests ONCE, shared by all players ──────────────────────────
    let sq_count = common_rules
        .entries
        .iter()
        .find(|e| e.label == "Side Quests")
        .map(|e| if e.active { e.current_level as usize } else { 0 })
        .unwrap_or(0);
    let side_quests: Vec<SideQuest> = pick_side_quests(sq_count);

    // ── Build system prompt (uses same side_quests for every player) ──────────
    let system_prompt = build_system_prompt(story, &common_rules, &side_quests);

    let state = GameState {
        model,
        main_quest: story.win_conditions.to_string(),
        side_quests,
    };

    let mut sessions = setup_players(&system_prompt);

    // Show quests before opening scenes so players know what they're doing
    println!();
    print_quests_summary(&state);

    println!("\n  Generating opening scenes for all players...");
    let names: Vec<String> = sessions.keys().cloned().collect();
    for name in &names {
        let session = sessions.get_mut(name).unwrap();
        opening_scene(client, api_key, &state.model, session);
    }

    (state, sessions)
}

// ─── Main game loop ───────────────────────────────────────────────────────────

/// Returns true to go back to title, false to exit fully.
fn game_loop(
    client: &Client,
    api_key: &str,
    state: &GameState,
    sessions: &mut HashMap<String, PlayerSession>,
) -> bool {
    let player_names: Vec<String> = {
        let mut names: Vec<String> = sessions.keys().cloned().collect();
        names.sort();
        names
    };
    let mut turn_index = 0usize;

    loop {
        let name = player_names[turn_index % player_names.len()].clone();
        turn_index += 1;

        sep('═', 60);
        println!("  [ {}'s Turn ]  │  Model: {}", name, state.model);
        sep('═', 60);
        println!("  Commands: quit | title | restart | stats | quest | sidequests | switch <n>");
        println!("  Or just type your action:\n");

        let input = read_line(&format!("  {} > ", name));

        match input.to_lowercase().trim() {
            "quit" | "exit" => {
                println!("\n  Thanks for playing! Final stats:");
                print_stats(sessions);
                return false;
            }
            "title" => {
                println!("\n  Returning to title screen...");
                return true;
            }
            "restart" => {
                let session = sessions.get_mut(&name).unwrap();
                session.restart();
                println!("\n  Restarting {}'s game from the opening scene...", name);
                opening_scene(client, api_key, &state.model, session);
                turn_index = turn_index.saturating_sub(1);
                continue;
            }
            "stats" => {
                print_stats(sessions);
                turn_index = turn_index.saturating_sub(1);
                continue;
            }
            "quest" => {
                print_main_quest(state);
                turn_index = turn_index.saturating_sub(1);
                continue;
            }
            "sidequests" | "sidequest" | "sq" => {
                print_side_quests(state);
                turn_index = turn_index.saturating_sub(1);
                continue;
            }
            cmd if cmd.starts_with("switch ") => {
                let target = cmd[7..].trim().to_string();
                if let Some(idx) = player_names.iter().position(|n| n == &target) {
                    turn_index = idx;
                    println!("  Switched to {}.", target);
                } else {
                    println!(
                        "  Player '{}' not found. Players: {}",
                        target,
                        player_names.join(", ")
                    );
                    turn_index = turn_index.saturating_sub(1);
                }
                continue;
            }
            "" => {
                println!("  (Empty input — skipping turn)");
                turn_index = turn_index.saturating_sub(1);
                continue;
            }
            _ => {}
        }

        // Record full prompt
        {
            let session = sessions.get_mut(&name).unwrap();
            let chars = input.chars().count();
            session.stats.prompt_count += 1;
            session.stats.total_chars += chars as u64;
            let n = session.stats.prompt_count;
            session.stats.prompt_log.push(PromptRecord {
                number: n,
                char_count: chars,
                full_text: input.clone(),
            });
            session.history.push(Message {
                role: "user".to_string(),
                content: input.clone(),
            });
        }

        println!("\n  [The world responds...]\n");
        let history_snapshot = sessions[&name].history.clone();
        match call_hf_api(client, api_key, &state.model, &history_snapshot) {
            Ok(reply) => {
                sessions.get_mut(&name).unwrap().history.push(Message {
                    role: "assistant".to_string(),
                    content: reply.clone(),
                });
                println!("{}\n", reply);
            }
            Err(e) => {
                eprintln!("  [ERROR] {}", e);
                eprintln!("  (GM could not respond. Your turn was not counted. Try again.)");
                let session = sessions.get_mut(&name).unwrap();
                session.history.pop();
                if let Some(rec) = session.stats.prompt_log.pop() {
                    session.stats.prompt_count -= 1;
                    session.stats.total_chars -= rec.char_count as u64;
                }
            }
        }
    }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

fn main() {
    dotenv().ok(); // load .env file if present (HF_API_KEY can live there)
    print_header();
    println!();
    let api_key = match std::env::var("HF_API_KEY") {
        Ok(k) if !k.is_empty() => {
            println!("  ✓ HuggingFace API key loaded from HF_API_KEY env var.");
            k
        }
        _ => {
            println!("  Enter your HuggingFace API key (free at huggingface.co/settings/tokens):");
            read_line("  HF_API_KEY > ")
        }
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("Failed to build HTTP client");

    loop {
        let (state, mut sessions) = run_title_setup(&client, &api_key);
        let go_to_title = game_loop(&client, &api_key, &state, &mut sessions);
        if !go_to_title {
            break;
        }
        println!();
        sep('═', 60);
        println!("  Back at the title screen. Starting new setup...");
    }

    println!("\n  Until next time, hero!");
}
