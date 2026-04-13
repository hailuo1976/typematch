"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngine = void 0;
const shared_1 = require("@typematch/shared");
class GameEngine {
    constructor(room, callbacks) {
        this.room = room;
        this.timers = {
            countdownTimer: null,
            wordSpawnTimer: null,
            gameTimer: null,
            rankUpdateTimer: null,
        };
        this.playerStates = new Map();
        this.activeWords = [];
        this.gameStartTime = 0;
        this.onWordGen = callbacks.onWordGen;
        this.onScoreUpdate = callbacks.onScoreUpdate;
        this.onRankUpdate = callbacks.onRankUpdate;
        this.onGameEnd = callbacks.onGameEnd;
        this.onCountdown = callbacks.onCountdown;
        this.onInputResult = callbacks.onInputResult;
    }
    start() {
        const config = shared_1.DIFFICULTY_CONFIGS[this.room.difficulty];
        const modeConfig = shared_1.GAME_MODE_CONFIGS[this.room.gameMode];
        for (const player of this.room.players) {
            this.playerStates.set(player.id, {
                consecutiveWrong: 0,
                currentWordIndex: 0,
                lives: modeConfig.initialLives ?? 3,
                inputStartTime: 0,
            });
        }
        let countdown = shared_1.GAME_COUNTDOWN_SECONDS;
        this.onCountdown(countdown);
        this.timers.countdownTimer = setInterval(() => {
            countdown--;
            this.onCountdown(countdown);
            if (countdown <= 0) {
                if (this.timers.countdownTimer)
                    clearInterval(this.timers.countdownTimer);
                this.timers.countdownTimer = null;
                this.startGameLoop();
            }
        }, 1000);
    }
    startGameLoop() {
        this.gameStartTime = Date.now();
        const config = shared_1.DIFFICULTY_CONFIGS[this.room.difficulty];
        const modeConfig = shared_1.GAME_MODE_CONFIGS[this.room.gameMode];
        const initialWords = (0, shared_1.generateWordBatch)(this.room.difficulty, this.room.players.length * 3, config.wordType, config.countdownPerWord);
        this.activeWords = initialWords;
        this.onWordGen(initialWords);
        const spawnInterval = Math.round(1000 / config.spawnRate);
        this.timers.wordSpawnTimer = setInterval(() => {
            const newWord = (0, shared_1.generateWordBatch)(this.room.difficulty, 1, config.wordType, config.countdownPerWord);
            this.activeWords.push(...newWord);
            this.onWordGen(newWord);
        }, spawnInterval);
        this.timers.rankUpdateTimer = setInterval(() => {
            this.onRankUpdate(this.getRanks());
        }, 1000);
        if (modeConfig.timeLimit) {
            this.timers.gameTimer = setTimeout(() => {
                this.endGame('时间到');
            }, modeConfig.timeLimit * 1000);
        }
    }
    handleInput(playerId, wordId, input, inputTimestamp) {
        const player = this.room.players.find(p => p.id === playerId);
        if (!player)
            return;
        const state = this.playerStates.get(playerId);
        if (!state)
            return;
        const word = this.activeWords.find(w => w.id === wordId);
        if (!word) {
            this.onInputResult(playerId, wordId, false, 0);
            return;
        }
        const inputTimeSeconds = (inputTimestamp - word.appearedAt) / 1000;
        const minTime = word.length * shared_1.MIN_INPUT_TIME_PER_CHAR;
        if (inputTimeSeconds < minTime) {
            this.onInputResult(playerId, wordId, false, 0);
            return;
        }
        const correct = (0, shared_1.checkInput)(word, input);
        if (correct) {
            state.consecutiveWrong = 0;
            player.combo++;
            if (player.combo > player.maxCombo)
                player.maxCombo = player.combo;
            player.correctCount++;
            const score = (0, shared_1.calculateScore)(this.room.difficulty, word.length, inputTimeSeconds, player.accuracy, player.combo);
            player.score += score;
            const wordIndex = this.activeWords.findIndex(w => w.id === wordId);
            if (wordIndex !== -1)
                this.activeWords.splice(wordIndex, 1);
            this.onInputResult(playerId, wordId, true, score);
        }
        else {
            state.consecutiveWrong++;
            player.wrongCount++;
            player.combo = 0;
            let penalty = (0, shared_1.applyWrongPenalty)(player);
            if ((0, shared_1.shouldApplyConsecutiveWrongPenalty)(state.consecutiveWrong)) {
                penalty += (0, shared_1.applyConsecutiveWrongPenalty)();
            }
            player.score = Math.max(0, player.score + penalty);
            if (this.room.gameMode === 'survival') {
                if (state.consecutiveWrong % 3 === 0) {
                    state.lives--;
                    if (state.lives <= 0) {
                        player.status = 'disconnected';
                        this.checkSurvivalEnd();
                    }
                }
            }
            this.onInputResult(playerId, wordId, false, penalty);
        }
        player.accuracy = (0, shared_1.updatePlayerAccuracy)(player);
        const elapsed = (Date.now() - this.gameStartTime) / 1000;
        player.wpm = (0, shared_1.calculateWpm)(player.correctCount, elapsed);
        this.onScoreUpdate(this.room.players);
        this.checkWinCondition();
    }
    handleTimeout(playerId, wordId) {
        const player = this.room.players.find(p => p.id === playerId);
        if (!player)
            return;
        const state = this.playerStates.get(playerId);
        if (!state)
            return;
        player.score = Math.max(0, player.score + (0, shared_1.applyTimeoutPenalty)());
        player.combo = 0;
        player.wrongCount++;
        player.accuracy = (0, shared_1.updatePlayerAccuracy)(player);
        const wordIndex = this.activeWords.findIndex(w => w.id === wordId);
        if (wordIndex !== -1)
            this.activeWords.splice(wordIndex, 1);
        this.onInputResult(playerId, wordId, false, (0, shared_1.applyTimeoutPenalty)());
        this.onScoreUpdate(this.room.players);
    }
    checkWinCondition() {
        const modeConfig = shared_1.GAME_MODE_CONFIGS[this.room.gameMode];
        if (this.room.gameMode === 'classic' && modeConfig.targetScore) {
            const winner = this.room.players.find(p => p.score >= modeConfig.targetScore);
            if (winner) {
                this.endGame(`${winner.nickname} 达到目标分数`);
            }
        }
    }
    checkSurvivalEnd() {
        const alive = this.room.players.filter(p => p.status !== 'disconnected');
        if (alive.length <= 1) {
            this.endGame(alive.length === 1 ? `${alive[0].nickname} 是最后存活者` : '所有玩家已淘汰');
        }
    }
    getRanks() {
        const sorted = [...this.room.players].sort((a, b) => b.score - a.score);
        return sorted.map((p, i) => ({ playerId: p.id, rank: i + 1, score: p.score }));
    }
    endGame(reason) {
        this.cleanup();
        const results = this.generateResults();
        this.onGameEnd(results, reason);
    }
    generateResults() {
        const sorted = [...this.room.players].sort((a, b) => b.score - a.score);
        return sorted.map((p, i) => ({
            playerId: p.id,
            nickname: p.nickname,
            avatar: p.avatar,
            score: p.score,
            accuracy: p.accuracy,
            wpm: p.wpm,
            maxCombo: p.maxCombo,
            correctCount: p.correctCount,
            wrongCount: p.wrongCount,
            rank: i + 1,
        }));
    }
    cleanup() {
        if (this.timers.countdownTimer)
            clearInterval(this.timers.countdownTimer);
        if (this.timers.wordSpawnTimer)
            clearInterval(this.timers.wordSpawnTimer);
        if (this.timers.gameTimer)
            clearTimeout(this.timers.gameTimer);
        if (this.timers.rankUpdateTimer)
            clearInterval(this.timers.rankUpdateTimer);
        this.timers = {
            countdownTimer: null,
            wordSpawnTimer: null,
            gameTimer: null,
            rankUpdateTimer: null,
        };
    }
    stop() {
        this.cleanup();
    }
    getActiveWords() {
        return this.activeWords;
    }
}
exports.GameEngine = GameEngine;
//# sourceMappingURL=gameEngine.js.map