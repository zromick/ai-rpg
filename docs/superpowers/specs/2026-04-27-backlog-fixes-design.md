# 2026-04-27 — Backlog Fixes Design

User-provided backlog of 14 bugs/enhancements across four subsystems. User explicitly granted full decision-making autonomy (no clarifying questions, no approval gates).

## Decisions at a glance

| Issue | Decision |
|---|---|
| Free narrator API broken | Replace HF with **browser Web Speech API** as default + **Pollinations.ai TTS** as a higher-quality alt. Drop HF dependency for TTS. |
| Free image API broken | Replace HF with **Pollinations.ai image API** (`https://image.pollinations.ai/prompt/...`). Free, no auth, no key. Drop HF dependency for images. |
| Save corruption after delete-and-restart | `handleDelete` does not signal the running Rust process. Send `"title"` command before deleting state file so Rust returns to setup loop. |
| Splash before play (main quest + actions) | Add `GameStartSplash` overlay shown once on first turn of a fresh game. Lists scenario, main quest, available commands, “Begin” dismiss button. |
| 200-char response cap | (a) Add explicit `<=200 chars` instruction in system prompt. (b) If actual reply > 250 chars, auto-call the model a second time to summarize to ≤200 chars. Final reply replaces the long one. |
| AI repeats itself | Add backend dedup in `process_action`: skip pushing assistant message if identical to previous assistant content. Keep existing UI dedup as belt-and-suspenders. |
| Narrator/radio height match terminal input | All three rows pinned to `min-height: 40px` consistently (terminal-input-row currently lacks it). |
| Color toggles instant | Optimistic local override in `App.tsx` so the toggle takes effect immediately, reconciled when Rust round-trip completes. |
| Click-location vs click-character routing | Tag highlight matches with explicit `kind: 'character' \| 'location'` instead of re-checking by name. Sub-name expansions inherit kind. |
| Common-word filter for highlights | Stopword set (`{the, a, an, you, i, he, she, it, we, they, ...}` + 1-letter words). Skip in both highlight regex and Rust extract prompt. |
| Radio autoplay on station switch | `switchStation` always plays after switching, regardless of prior `playing` state. |
| Battle/romance inference from prompt + response | Already passes both; sharpen the extract prompt with explicit “set true if action OR response involves combat/intimacy.” Default rule: stays at previous value if neither indicates change. |
| Task-cross inference from prompt + response | Same: sharpen the extract prompt for `completed_quest_step` to consider both action AND response. |
| Skip natural settings steps | Stepper skips `scenario_rules` step when `scenario.scenario_rules.length === 0`. Stepper pip count reflects only visible steps. |

## Architecture notes

- **TTS** — `narrationService.ts` becomes provider-agnostic. Web Speech provider implements `fetchAudio` by speaking directly via `speechSynthesis` (no audio URL, returns a sentinel; Narrator component handles play/pause via `speechSynthesis.cancel/speak`). Pollinations provider returns a real audio URL.
- **Images** — `imageServices.ts` switches each entry from HF model IDs to Pollinations URL builders. Bridge server `/api/image` keeps proxying for CORS / consistency, calling Pollinations instead of HF.
- **Splash overlay** — gated by `gameState.players[active].prompt_count === 0 && !dismissed`; dismissed flag in component-local state, not persisted.
- **200-char enforcement** — implemented in `call_hf_with_cap` wrapper. Cheap fallback: only triggers when full reply > 250 chars. Disabled by a new `Response Brevity` common rule (default ON, level 200).
- **Highlight kind tags** — `highlightNames` produces `Array<{ name, color, kind }>`. Click handler reads `kind` directly; no DOM queries by `nth-child` index.
- **Settings round-trip** — color toggles still go through Rust for persistence, but `App` uses an optimistic local override map keyed on rule label. Override clears when next `gameState` arrives.
- **Stopwords** — single source list defined in `frontend/src/highlightStopwords.ts` plus mirrored in Rust extract prompt rules so both layers filter the same set.

## Out of scope (explicitly)

- No new Google Cloud changes. Save corruption is a local state-flow bug, not an OAuth bug.
- No model swap. The user mentions HF Inference for LLM still works; only TTS/image are broken.
- No mobile-only revisions. Heights apply across all layouts.

## Verification

After implementing, run:
- `cargo test` (Rust)
- `npm test` (Vitest)
- Manual: start game, type a long action, see ≤200-char reply, click character/location names, toggle colors, switch radio, delete and start fresh.
