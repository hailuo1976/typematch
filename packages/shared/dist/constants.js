"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_INPUT_TIME_PER_CHAR = exports.CONSECUTIVE_WRONG_THRESHOLD = exports.PENALTY_CONSECUTIVE_WRONG = exports.PENALTY_TIMEOUT = exports.PENALTY_WRONG = exports.COMBO_DIVISOR = exports.MAX_COMBO_BONUS = exports.MIN_ACCURACY_COEFFICIENT = exports.MAX_SPEED_COEFFICIENT = exports.MIN_SPEED_COEFFICIENT = exports.SPEED_STANDARD_TIME_PER_CHAR = exports.SCORE_BASE = exports.GAME_COUNTDOWN_SECONDS = exports.RECONNECT_TIMEOUT = exports.MAX_PLAYERS = exports.BROADCAST_TIMEOUT = exports.BROADCAST_INTERVAL = exports.HTTP_SERVER_PORT = exports.TCP_SERVER_PORT = exports.UDP_BROADCAST_PORT = exports.GAME_MODE_CONFIGS = exports.DIFFICULTY_CONFIGS = void 0;
exports.DIFFICULTY_CONFIGS = {
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
exports.GAME_MODE_CONFIGS = {
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
exports.UDP_BROADCAST_PORT = 25565;
exports.TCP_SERVER_PORT = 25566;
exports.HTTP_SERVER_PORT = 3000;
exports.BROADCAST_INTERVAL = 2000;
exports.BROADCAST_TIMEOUT = 10000;
exports.MAX_PLAYERS = 8;
exports.RECONNECT_TIMEOUT = 30000;
exports.GAME_COUNTDOWN_SECONDS = 3;
exports.SCORE_BASE = 10;
exports.SPEED_STANDARD_TIME_PER_CHAR = 0.3;
exports.MIN_SPEED_COEFFICIENT = 0.5;
exports.MAX_SPEED_COEFFICIENT = 2.0;
exports.MIN_ACCURACY_COEFFICIENT = 0.8;
exports.MAX_COMBO_BONUS = 0.5;
exports.COMBO_DIVISOR = 100;
exports.PENALTY_WRONG = -3;
exports.PENALTY_TIMEOUT = -5;
exports.PENALTY_CONSECUTIVE_WRONG = -10;
exports.CONSECUTIVE_WRONG_THRESHOLD = 3;
exports.MIN_INPUT_TIME_PER_CHAR = 0.1;
//# sourceMappingURL=constants.js.map