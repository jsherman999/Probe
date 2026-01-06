/**
 * Type definitions for the LLM Bot Player system
 */

// ============================================================================
// Ollama API Types
// ============================================================================

export interface OllamaModel {
  name: string;           // e.g., "llama3.2:3b"
  size: number;           // bytes
  digest: string;
  modified_at: string;
  details?: OllamaModelDetails;
}

export interface OllamaModelDetails {
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModelInfo {
  modelfile: string;
  parameters: string;
  template: string;
  details: OllamaModelDetails;
}

export interface OllamaGenerateOptions {
  temperature?: number;      // 0.0-2.0, default 0.7
  top_p?: number;            // 0.0-1.0, default 0.9
  top_k?: number;            // default 40
  num_predict?: number;      // max tokens, default 100
  stop?: string[];           // stop sequences
  repeat_penalty?: number;   // default 1.1
  seed?: number;             // for reproducibility
  num_ctx?: number;          // context window size
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: OllamaGenerateOptions;
  system?: string;
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  options?: OllamaGenerateOptions;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

// ============================================================================
// Bot Configuration Types
// ============================================================================

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotConfig {
  id: string;
  displayName: string;
  modelName: string;
  ollamaOptions: OllamaGenerateOptions;
  personality?: string;     // optional system prompt modifier
  difficulty: BotDifficulty;
}

export interface BotConfigInput {
  displayName: string;
  modelName: string;
  ollamaOptions?: OllamaGenerateOptions;
  personality?: string;
  difficulty?: BotDifficulty;
}

// ============================================================================
// Game Context Types (for bot decision making)
// ============================================================================

export interface PlayerInfo {
  id: string;
  odisplayName: string;
  oduserId?: string;
  isBoot: boolean;
  wordLength: number;
  revealedPositions: (string | null)[];  // letter or null for each position
  missedLetters: string[];
  totalScore: number;
  isEliminated: boolean;
  turnOrder: number;
}

export interface GameContext {
  roomCode: string;
  odotPlayerId: string;
  players: PlayerInfo[];
  myWord?: string;
  myPaddedWord?: string;
  myRevealedPositions?: boolean[];
  currentTurnPlayerId: string;
  roundNumber: number;
  turnTimerSeconds: number;
}

// ============================================================================
// Bot Action Types
// ============================================================================

export interface WordSelection {
  word: string;
  frontPadding: number;
  backPadding: number;
}

export interface LetterGuessAction {
  type: 'letterGuess';
  targetPlayerId: string;
  letter: string;
}

export interface WordGuessAction {
  type: 'wordGuess';
  targetPlayerId: string;
  word: string;
}

export type TurnAction = LetterGuessAction | WordGuessAction;

// ============================================================================
// Bot Strategy Interface
// ============================================================================

export interface IBotStrategy {
  selectWord(ctx: GameContext, config: BotConfig): Promise<WordSelection>;
  selectTarget(ctx: GameContext, config: BotConfig): Promise<string>;
  guessLetter(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
  shouldGuessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;
  guessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
  selectBlankPosition(positions: number[], ctx: GameContext, config: BotConfig): Promise<number>;
  selectDuplicatePosition(positions: number[], letter: string, ctx: GameContext, config: BotConfig): Promise<number>;
}

// ============================================================================
// Bot Preset Types
// ============================================================================

export interface BotPreset {
  id: string;
  presetName: string;
  displayName: string;
  modelName: string;
  ollamaOptions: OllamaGenerateOptions;
  personality?: string;
  difficulty: BotDifficulty;
  createdAt: Date;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface OllamaStatusResponse {
  available: boolean;
  version?: string;
  error?: string;
}

export interface OllamaModelsResponse {
  models: OllamaModel[];
}

export interface BotCreateResponse {
  id: string;
  config: BotConfig;
}
