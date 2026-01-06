/**
 * Type definitions for the LLM Bot Player system
 */
export interface OllamaModel {
    name: string;
    size: number;
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
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    repeat_penalty?: number;
    seed?: number;
    num_ctx?: number;
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
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export interface BotConfig {
    id: string;
    displayName: string;
    modelName: string;
    ollamaOptions: OllamaGenerateOptions;
    personality?: string;
    difficulty: BotDifficulty;
}
export interface BotConfigInput {
    displayName: string;
    modelName: string;
    ollamaOptions?: OllamaGenerateOptions;
    personality?: string;
    difficulty?: BotDifficulty;
}
export interface PlayerInfo {
    id: string;
    displayName: string;
    userId?: string;
    isBot: boolean;
    wordLength: number;
    revealedPositions: (string | null)[];
    missedLetters: string[];
    totalScore: number;
    isEliminated: boolean;
    turnOrder: number;
}
export interface GameContext {
    roomCode: string;
    botPlayerId: string;
    players: PlayerInfo[];
    myWord?: string;
    myPaddedWord?: string;
    myRevealedPositions?: boolean[];
    currentTurnPlayerId: string;
    roundNumber: number;
    turnTimerSeconds: number;
}
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
export interface IBotStrategy {
    selectWord(ctx: GameContext, config: BotConfig): Promise<WordSelection>;
    selectTarget(ctx: GameContext, config: BotConfig): Promise<string>;
    guessLetter(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    shouldGuessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<boolean>;
    guessWord(ctx: GameContext, targetPlayer: PlayerInfo, config: BotConfig): Promise<string>;
    selectBlankPosition(positions: number[], ctx: GameContext, config: BotConfig): Promise<number>;
    selectDuplicatePosition(positions: number[], letter: string, ctx: GameContext, config: BotConfig): Promise<number>;
}
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
//# sourceMappingURL=types.d.ts.map