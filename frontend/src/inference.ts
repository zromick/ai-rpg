/**
 * Centralized AI Inference Module
 * 
 * This file documents all AI inference points in the game:
 * 
 * BACKEND (Rust - src/main.rs):
 * - call_hf() - Main LLM chat API to HuggingFace router (line 306)
 * - extract() - Extracts game state from LLM responses (line 318)
 * - opening_scene() - Generates opening scene on game start (line 619)
 * 
 * FRONTEND:
 * - imageServices.ts - Character portrait generation via HF T2I API
 * - narrationService.ts - Text-to-speech via HF TTS API
 * - server/index.ts - Express proxy for TTS/Image APIs
 * 
 * INFERENCE PROMPTS (Rust - src/prompts.rs):
 * - build_system_prompt() - Main game system prompt
 * - extraction prompt in extract() - JSON state extraction
 */

export * from './imageServices'
export * from './narrationService'

export const INFERENCE_POINTS = {
  CHAT_COMPLETION: 'call_hf (main.rs:306)',
  STATE_EXTRACTION: 'extract (main.rs:318)',
  OPENING_SCENE: 'opening_scene (main.rs:619)',
  IMAGE_GENERATION: 'imageServices.ts',
  TEXT_TO_SPEECH: 'narrationService.ts',
} as const
