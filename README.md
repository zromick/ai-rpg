# ♛ AI RPG

Written with the help of Claude Sonnet 4.6.

A terminal-based multi-player RPG powered by the HuggingFace Inference API.
Each player has their own isolated story context, memory, and universe.
An optional React frontend provides a live dashboard with AI-generated scene images.

## Requirements

- [Rust](https://rustup.rs/) 1.85+ (for edition 2024)
- C++ Build Tools (Required for the linker):
  - Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#:~:text=Build%20Tools%20for%20Visual%20Studio (Check 'Desktop development with C++')
  - macOS: `xcode-select --install`
  - Linux:
    - Ubuntu/Debian: `sudo apt install build-essential`
    - Fedora: `sudo dnf groupinstall "Development Tools"`
    - Arch: `sudo pacman -S base-devel`
- [Node.js](https://nodejs.org/) 24+
- A free [HuggingFace](https://huggingface.co) account + API token

---

## Setup

### 1. Get a HuggingFace API token

1. Sign up at https://huggingface.co
2. Go to **Settings → Access Tokens**
3. Create a token with **"Read"** permission (free tier)

### 2. Set your API key

Create `.env` in the project root:

```
HF_API_TOKEN=hf_yourtoken
```

### 3. Build and run the Rust game

```bash
cargo build --release
cargo run --release
```

### 4. Run the frontend (separate terminal)

```bash
cd frontend
npm install
npm start        # starts bridge server on :3001 AND Vite on :5173
```

Open **http://localhost:5173**

---

## Gameplay — Rust terminal

Walk through the setup screens (model → scenario → rules → players), then play:

### Commands

| Command | Effect |
|---------|--------|
| `quest` | Show main quest (win condition) |
| `sidequests` / `sq` | Show active side quests |
| `character` / `char` | View and edit your character features |
| `stats` | Full prompt log with character counts |
| `restart` | Wipe current player's history, replay opening scene |
| `title` | Return to title screen for a new game |
| `switch <name>` | Jump to another player's turn |
| `quit` / `exit` | End the game |

### Character editor (via `character` command)

```
set age        old and weathered
set clothing   stolen nobleman's coat
set scar       a brand on the left forearm
set nickname   The Crow          ← custom field, any name you want
unset nickname                   ← removes custom fields only
```

Changes are saved immediately to `game_state.json` and reflected in the frontend.

---

## Frontend — browser UI

The browser UI mirrors the Rust terminal and adds visual context.

### Features

- **Scene images** — generated after every GM reply using the character's exact
  appearance + the first sentence of the GM's response.
- **Interactive input** — type commands directly in the browser and send to Rust.
- **Typewriter effect** — new GM responses type themselves out
- **Multi-player tabs** — switch between players' views
- **Image engine picker** — swap image styles in the topbar dropdown
- **Live polling** — auto-refreshes when `game_state.json` changes
- **Battle mode** — auto-switches theme and music during combat/tense moments

### Image engines

Uses HuggingFace Inference API (requires API token):

| Engine | Style |
|--------|-------|
| FLUX.1 Schnell (default) | Black Forest Labs, fast |
| FLUX.1 Dev | Higher quality, slower |
| Dark Fantasy | Brooding oil-painting atmosphere |
| Painterly | Impressionist brushstroke texture |
| Anime | Illustrated anime / manga aesthetic |
| Portrait Focus | Tight character face crop |
| Ink Sketch | Pen-and-ink etching style |
| Widescreen Scene | Wide cinematic environment shot |

---

## Scenarios

| # | Title | Premise |
|---|-------|---------|
| 1 | Beggars to Crowns | Rise from a nameless Beggar to King of Aethelgard |
| 2 | Shipwrecked on the Obsidian Shore | Survive a volcanic island — escape or conquer |
| 3 | The Haunted Precinct | 1920s detective unravels supernatural murders |
| 4 | Void Merchant | Trade and scheme across a dying star system |

---

## Universal GM rules (configurable before play)

| Rule | Default |
|------|---------|
| Immersive Narration | ON |
| Real Consequences | ON |
| Stat Tracking | ON |
| No Dice / No Attributes (not D&D) | ON |
| Player Controls Only Main Character | ON |
| NPC Memory & Agendas | ON |
| Time Passes Realistically | ON |
| No Action Choices at Turn End | ON |
| Difficulty / World Hostility | 14 — Apocalyptic |
| Response Length | 15 — Mythic (no limit) |
| Side Quests | 0 — Disabled (set 1–10 to enable) |

---

## Available AI models

| Model | Notes |
|-------|-------|
| `meta-llama/Llama-3.1-8B-Instruct` *(default)* | Best storytelling on free tier |
| `google/gemma-2-9b-it` | Google instruction-tuned |
| `mistralai/Mistral-7B-Instruct-v0.3` | Reliable and efficient |
| `mistralai/Mistral-Nemo-Instruct-2407` | Mistral Nemo series |
| `HuggingFaceH4/zephyr-7b-beta` | Fine-tuned for instruction following |
| `NousResearch/Hermes-3-Llama-3.1-8B` | Nous Research fine-tune |
| `chaldene/Llama-3.1-8B-Instruct-Abliterated` | Uncensored variant |
| `mistralai/Mixtral-8x7B-Instruct-v0.1` | Mixture-of-experts, high quality |
| `microsoft/Phi-3-medium-128k-instruct` | Long context window |

All models use `https://router.huggingface.co/v1/chat/completions`.

---

## How it works

### Isolated player universes

Each player has a `PlayerSession` with their own `history: Vec<Message>`. Only
that player's history is sent to the API per turn. Player A's AI has no knowledge
of Player B's choices.

### What the AI sees

1. A **system message** — the output of `build_system_prompt()`: scenario
   instructions, setting, active rules, starting inventory, win conditions, side quests
2. A **first user message** — tells the GM to deliver the opening scene verbatim
3. On subsequent turns — the player's action injected with their character description

### What the AI does not see

- The player's name (UI only)
- Other players' sessions
- Commands (`quest`, `stats`, `restart`, etc.) — intercepted before the API call
- Empty inputs
- All setup menus and config screens

### Character features and images

Each player gets randomly generated `CharacterFeatures` on creation (seeded per
player so they're unique). The features compile into a natural-language
`image_prompt` string stored in `game_state.json`. After every GM reply, the
frontend combines this with the first sentence of the GM's response to form an
image prompt, then fetches a 768×512 image from Pollinations.ai. The character
seed is derived from the player's name hash so the same player gets a visually
consistent character across turns.

### Side quests

Picked **once** at setup with a time-seeded Fisher-Yates shuffle. The same list
is embedded in every player's system prompt so all players share identical
objectives even though their story paths diverge.

---

## Project structure

```
beggars_to_crowns/
│
├── Cargo.toml                  ← Rust dependencies (edition 2024)
├── .env                        ← HF_API_TOKEN=hf_yourtoken  (you create this)
├── game_state.json             ← Live data file written by Rust, read by frontend
│
├── src/
│   ├── main.rs                 ← Game engine, CLI, character system, state writer
│   └── prompts.rs              ← Scenarios, rules, side quests, system prompt builder
│
└── frontend/
    ├── index.html              ← Vite HTML entry
    ├── package.json            ← npm dependencies and scripts
    ├── tsconfig.json           ← TypeScript config (ES2022, bundler, .ts + .tsx)
    ├── vite.config.ts          ← Vite + React plugin + proxy to bridge server
    │
    ├── server/
    │   ├── index.ts            ← Express bridge server (reads game_state.json)
    │   └── tsconfig.json       ← Separate TS config for Node/ESM server
    │
    └── src/
        ├── main.tsx            ← React entry point
        ├── App.tsx             ← Root component, layout, state
        ├── App.css             ← Full stylesheet (dark medieval aesthetic)
        ├── types.ts            ← Shared TypeScript interfaces
        ├── imageServices.ts    ← 10 image generation service definitions
        │
        ├── hooks/
        │   ├── useGameState.ts       ← Polls /api/state every 2s
        │   └── useCharacterImage.ts  ← Builds and loads scene images
        │
        └── components/
            ├── Terminal.tsx          ← Narrative log + interactive input box
            ├── CharacterPanel.tsx    ← AI scene image + character feature table
            ├── QuestPanel.tsx        ← Main quest + side quests sidebar
            ├── PlayerTabs.tsx        ← Multi-player tab switcher
            └── ServicePicker.tsx     ← Image engine dropdown (topbar)
```

---

## What is game_state.json?

`game_state.json` lives in the **project root** (next to `Cargo.toml`). It is
written automatically by the Rust game after every GM reply and every character
edit. You never edit it manually.

It contains the current full game state: all players, their conversation
histories, character features, image prompts, quest data, and a timestamp.

The frontend **cannot read files directly** (browsers are sandboxed), so the
tiny Express bridge server in `frontend/server/index.ts` reads the file on disk
and serves it over HTTP at `http://localhost:3001/api/state`. The React app polls
that endpoint every 2 seconds. When the timestamp changes, the UI updates.

Think of it as a poor-man's WebSocket: Rust writes → file → bridge reads →
React polls. No socket setup required.

---
