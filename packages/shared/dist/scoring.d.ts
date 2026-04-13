import type { Player, Difficulty } from './types';
export declare function calculateSpeedCoefficient(wordLength: number, actualTimeSeconds: number): number;
export declare function calculateAccuracyCoefficient(currentAccuracy: number): number;
export declare function calculateComboCoefficient(combo: number): number;
export declare function calculateScore(difficulty: Difficulty, wordLength: number, actualTimeSeconds: number, currentAccuracy: number, combo: number): number;
export declare function getDifficultyMultiplier(difficulty: Difficulty): number;
export declare function applyWrongPenalty(player: Player): number;
export declare function applyTimeoutPenalty(): number;
export declare function applyConsecutiveWrongPenalty(): number;
export declare function shouldApplyConsecutiveWrongPenalty(consecutiveWrong: number): boolean;
export declare function updatePlayerAccuracy(player: Player): number;
export declare function calculateWpm(correctCount: number, elapsedSeconds: number): number;
//# sourceMappingURL=scoring.d.ts.map