import type { Difficulty, DifficultyConfig, GameMode, GameModeConfig } from './types';

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    difficulty: 'easy',
    label: '简单',
    wordLengthRange: [3, 5],
    spawnRate: 0.5,
    totalWords: 50,
    countdownPerWord: 10,
    scoreMultiplier: 1.0,
    wordType: 'en',
  },
  medium: {
    difficulty: 'medium',
    label: '中等',
    wordLengthRange: [4, 7],
    spawnRate: 0.8,
    totalWords: 100,
    countdownPerWord: 7,
    scoreMultiplier: 1.5,
    wordType: 'en',
  },
  hard: {
    difficulty: 'hard',
    label: '困难',
    wordLengthRange: [6, 10],
    spawnRate: 1.2,
    totalWords: 150,
    countdownPerWord: 5,
    scoreMultiplier: 2.0,
    wordType: 'en',
  },
  master: {
    difficulty: 'master',
    label: '大师',
    wordLengthRange: [8, 15],
    spawnRate: 1.8,
    totalWords: 200,
    countdownPerWord: 3,
    scoreMultiplier: 3.0,
    wordType: 'en',
  },
};

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  classic: {
    mode: 'classic',
    label: '经典模式',
    description: '先达到目标分数者胜',
    targetScore: 200,
  },
  timed: {
    mode: 'timed',
    label: '限时模式',
    description: '限时内得分最高者胜',
    timeLimit: 120,
  },
  survival: {
    mode: 'survival',
    label: '生存模式',
    description: '每错3次扣1生命，最后存活者胜',
    initialLives: 3,
  },
};

export const UDP_BROADCAST_PORT = 25565;
export const TCP_SERVER_PORT = 25566;
export const HTTP_SERVER_PORT = 3000;
export const BROADCAST_INTERVAL = 2000;
export const BROADCAST_TIMEOUT = 10000;
export const MAX_PLAYERS = 8;
export const RECONNECT_TIMEOUT = 30000;
export const GAME_COUNTDOWN_SECONDS = 3;

export const SCORE_BASE = 10;
export const SPEED_STANDARD_TIME_PER_CHAR = 0.3;
export const MIN_SPEED_COEFFICIENT = 0.5;
export const MAX_SPEED_COEFFICIENT = 2.0;
export const MIN_ACCURACY_COEFFICIENT = 0.8;
export const MAX_COMBO_BONUS = 0.5;
export const COMBO_DIVISOR = 100;

export const PENALTY_WRONG = -3;
export const PENALTY_TIMEOUT = -5;
export const PENALTY_CONSECUTIVE_WRONG = -10;
export const CONSECUTIVE_WRONG_THRESHOLD = 3;

export const MIN_INPUT_TIME_PER_CHAR = 0.1;
