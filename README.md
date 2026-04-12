# ♛ Beggars to Crowns — AI RPG

Written with the help of Claude Sonnet 4.6.

A terminal-based multi-player RPG powered by the HuggingFace Inference API.
Each player has their own isolated story context, memory, and universe.

---

## Requirements

- [Rust](https://rustup.rs/) (stable, 1.70+)
- A free HuggingFace account + API token

---

## Setup

### 1. Get a HuggingFace API token (free)

1. Sign up at https://huggingface.co
2. Go to **Settings → Access Tokens**
3. Create a token with **"Read"** permission (free tier)

### 2. Set your API key

Create a `.env` file in the project root:

```
HF_API_KEY=hf_yourtoken
```

Or set it as an environment variable:

```bash
export HF_API_KEY=hf_yourtoken   # Linux / macOS
set HF_API_KEY=hf_yourtoken      # Windows CMD
```

### 3. Build and run

```bash
cargo build --release
cargo run --release
```

---

## Launch flow

When you start the game you will be walked through these steps in order:

1. **Model selection** — choose from 11 available HuggingFace models
2. **Scenario selection** — pick one of the available story scenarios (press `H` to inspect any scenario's full details before choosing)
3. **Scenario rule configuration** — toggle per-scenario rules ON/OFF
4. **Universal rule configuration** — adjust shared GM rules including difficulty, response length, and side quests
5. **Player setup** — enter 1–8 player names
6. **Quest summary** — your main quest and any active side quests are displayed before the game begins
7. **Opening scenes** — each player receives their own opening scene from the AI

---

## Scenarios

| # | Title | Premise |
|---|-------|---------|
| 1 | Beggars to Crowns | Rise from a nameless Beggar to be crowned King of Aethelgard |
| 2 | Shipwrecked on the Obsidian Shore | Survive a hostile volcanic island — escape, or conquer it |
| 3 | The Haunted Precinct | A 1920s detective unravels supernatural murders in a cursed city |
| 4 | Void Merchant | Trade and scheme across a dying star system aboard a salvage freighter |

---

## In-game commands

| Command | Effect |
|---------|--------|
| `quest` | Display your main quest (win condition) |
| `sidequests` / `sq` | Display all active side quests |
| `stats` | Show full prompt log with character counts for all players |
| `restart` | Wipe current player's history and restart from the opening scene |
| `title` | Return to the title screen and start a new setup |
| `switch <name>` | Jump to a specific player's turn |
| `quit` / `exit` | End the game and show final stats |

Commands are intercepted locally and never sent to the AI.

---

## Universal GM rules (configurable)

These rules apply to every scenario and can be toggled or adjusted before play begins:

| Rule | Default | Type |
|------|---------|------|
| Immersive Narration | ON | Boolean |
| Real Consequences | ON | Boolean |
| Stat Tracking | ON | Boolean |
| No Dice / No Attributes (not D&D) | ON | Boolean |
| Player Controls Only Main Character | ON | Boolean |
| NPC Memory & Agendas | ON | Boolean |
| Time Passes Realistically | ON | Boolean |
| No Action Choices at Turn End | ON | Boolean |
| Difficulty / World Hostility | 14 — Apocalyptic | Level 1–15 |
| Response Length | 15 — Mythic (no limit) | Level 1–15 |
| Side Quests | 0 — Disabled | Level 0–10 |

**Difficulty levels** range from Level 1 (Gentle — mistakes are recoverable) to Level 15 (Impossible — designed to be lost). Default is **14 (Apocalyptic)** — resources near zero, every scene potentially fatal.

**Response Length** levels range from Level 1 (~50 words, terse) to Level 15 (Mythic — no word limit). Default is **15**.

**Side Quests** — setting this to any level 1–10 randomly selects that many side quests from a pool of 10 and adds them as mandatory win conditions. All players in a session share the same side quests.

---

## Models

| Model | Notes |
|-------|-------|
| `meta-llama/Llama-3.1-8B-Instruct` *(default)* | Strong storytelling, generous free tier |
| `meta-llama/Llama-3.2-3B-Instruct` | Lighter and faster |
| `google/gemma-2-9b-it` | Google's instruction-tuned model |
| `mistralai/Mistral-7B-Instruct-v0.3` | Reliable and efficient |
| `mistralai/Mistral-Nemo-Instruct-2407` | Mistral's newer Nemo series |
| `HuggingFaceH4/zephyr-7b-beta` | Fine-tuned for helpfulness |
| `NousResearch/Hermes-3-Llama-3.1-8B` | Nous Research fine-tune |
| `chaldene/Llama-3.1-8B-Instruct-Abliterated` | Uncensored variant |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | Mixture-of-experts, high quality |
| `microsoft/Phi-3-medium-128k-instruct` | Long context window |
| `Qwen/Qwen2.5-7B-Instruct` | Alibaba's multilingual model |

All models use the HuggingFace Router (`https://router.huggingface.co/v1/chat/completions`).

---

## Adding scenarios and rules

**New scenario** — add a new `StoryPrompt` to the `story_prompts()` function in `src/prompts.rs`. Every scenario requires: `title`, `description`, `system_instructions`, `setting_details`, `opening_scene`, `user_condition`, `user_inventory`, `scenario_rules`, and `win_conditions`.

**New side quest** — push a new `SideQuest { title, description }` into `side_quest_pool()` in `src/prompts.rs`.

**New universal rule** — add a `CommonRuleDef` to `common_rule_definitions()` in `src/prompts.rs`. Boolean rules toggle ON/OFF; Level rules present a 1–N picker.

---

## How it works

### Isolated player universes

Each player has a `PlayerSession` with their own `history: Vec<Message>`. When a player takes a turn, only *their* history is sent to the API. Player A's AI has no knowledge of Player B's actions.

### What the AI sees

On the first turn, the AI receives:

1. A **system message** — the full output of `build_system_prompt()`, containing scenario instructions, setting details, starting inventory, active rules, win conditions, and any side quests
2. A hardcoded **first user message** — instructing the GM to deliver the opening scene verbatim

### What the AI does NOT see

- The player's name (used only in the local UI)
- Other players' sessions or actions
- Any command typed (`quit`, `stats`, `restart`, etc.) — these are intercepted before reaching the API
- Empty inputs — skipped locally, not forwarded
- All setup menus and configuration screens

### Side quests

Side quests are picked **once** at setup using a time-seeded Fisher-Yates shuffle (no external crates). The same list is embedded in every player's system prompt, so all players share identical side quest objectives even though their story paths diverge.

### Prompt log

Every prompt you send is recorded in full (not truncated) with its character count and sequence number. Type `stats` to review the complete history.
