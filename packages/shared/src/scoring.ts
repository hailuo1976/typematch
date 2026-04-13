import type { Player, Difficulty } from './types';
import {
  SCORE_BASE,
  SPEED_STANDARD_TIME_PER_CHAR,
  MIN_SPEED_COEFFICIENT,
  MAX_SPEED_COEFFICIENT,
  MIN_ACCURACY_COEFFICIENT,
  MAX_COMBO_BONUS,
  COMBO_DIVISOR,
  PENALTY_WRONG,
  PENALTY_TIMEOUT,
  PENALTY_CONSECUTIVE_WRONG,
  CONSECUTIVE_WRONG_THRESHOLD,
} from './constants';

export function calculateSpeedCoefficient(wordLength: number, actualTimeSeconds: number): number {
  const standardTime = wordLength * SPEED_STANDARD_TIME_PER_CHAR;
  const coefficient = standardTime / Math.max(actualTimeSeconds, 0.01);
  return Math.max(MIN_SPEED_COEFFICIENT, Math.min(MAX_SPEED_COEFFICIENT, coefficient));
}

export function calculateAccuracyCoefficient(currentAccuracy: number): number {
  if (currentAccuracy < 0.8) return MIN_ACCURACY_COEFFICIENT;
  return 1 + (currentAccuracy - 0.8) * 0.5;
}

export function calculateComboCoefficient(combo: number): number {
  return 1 + Math.min(MAX_COMBO_BONUS, combo / COMBO_DIVISOR);
}

export function calculateScore(
  difficulty: Difficulty,
  wordLength: number,
  actualTimeSeconds: number,
  currentAccuracy: number,
  combo: number
): number {
  const difficultyMultiplier = getDifficultyMultiplier(difficulty);
  const baseScore = SCORE_BASE * difficultyMultiplier;
  const speedCoeff = calculateSpeedCoefficient(wordLength, actualTimeSeconds);
  const accuracyCoeff = calculateAccuracyCoefficient(currentAccuracy);
  const comboCoeff = calculateComboCoefficient(combo);
  return Math.round(baseScore * speedCoeff * accuracyCoeff * comboCoeff);
}

export function getDifficultyMultiplier(difficulty: Difficulty): number {
  const multipliers: Record<Difficulty, number> = {
    easy: 1.0,
    medium: 1.5,
    hard: 2.0,
    master: 3.0,
  };
  return multipliers[difficulty];
}

export function applyWrongPenalty(player: Player): number {
  return PENALTY_WRONG;
}

export function applyTimeoutPenalty(): number {
  return PENALTY_TIMEOUT;
}

export function applyConsecutiveWrongPenalty(): number {
  return PENALTY_CONSECUTIVE_WRONG;
}

export function shouldApplyConsecutiveWrongPenalty(consecutiveWrong: number): boolean {
  return consecutiveWrong >= CONSECUTIVE_WRONG_THRESHOLD;
}

export function updatePlayerAccuracy(player: Player): number {
  const total = player.correctCount + player.wrongCount;
  if (total === 0) return 1;
  return player.correctCount / total;
}

export function calculateWpm(correctCount: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return Math.round((correctCount / elapsedSeconds) * 60);
}
