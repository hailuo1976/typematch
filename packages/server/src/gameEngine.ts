import type { RoomInfo, WordItem, Difficulty, GameMode, GameResult, Player } from '@typematch/shared';
import {
  DIFFICULTY_CONFIGS,
  GAME_MODE_CONFIGS,
  GAME_COUNTDOWN_SECONDS,
  generateWordBatch,
  calculateScore,
  updatePlayerAccuracy,
  calculateWpm,
  applyWrongPenalty,
  applyTimeoutPenalty,
  applyConsecutiveWrongPenalty,
  shouldApplyConsecutiveWrongPenalty,
  checkInput,
  MIN_INPUT_TIME_PER_CHAR,
} from '@typematch/shared';

interface GameTimer {
  countdownTimer: ReturnType<typeof setInterval> | null;
  wordSpawnTimer: ReturnType<typeof setInterval> | null;
  gameTimer: ReturnType<typeof setInterval> | null;
  rankUpdateTimer: ReturnType<typeof setInterval> | null;
}

interface PlayerGameState {
  consecutiveWrong: number;
  currentWordIndex: number;
  lives: number;
  inputStartTime: number;
}

export class GameEngine {
  private room: RoomInfo;
  private timers: GameTimer;
  private playerStates: Map<string, PlayerGameState>;
  private activeWords: WordItem[];
  private gameStartTime: number;
  private onWordGen: (words: WordItem[]) => void;
  private onScoreUpdate: (players: Player[]) => void;
  private onRankUpdate: (ranks: { playerId: string; rank: number; score: number }[]) => void;
  private onGameEnd: (results: GameResult[], reason: string) => void;
  private onCountdown: (remaining: number) => void;
  private onInputResult: (playerId: string, wordId: string, correct: boolean, score: number) => void;

  constructor(
    room: RoomInfo,
    callbacks: {
      onWordGen: (words: WordItem[]) => void;
      onScoreUpdate: (players: Player[]) => void;
      onRankUpdate: (ranks: { playerId: string; rank: number; score: number }[]) => void;
      onGameEnd: (results: GameResult[], reason: string) => void;
      onCountdown: (remaining: number) => void;
      onInputResult: (playerId: string, wordId: string, correct: boolean, score: number) => void;
    }
  ) {
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

  start(): void {
    const config = DIFFICULTY_CONFIGS[this.room.difficulty];
    const modeConfig = GAME_MODE_CONFIGS[this.room.gameMode];

    for (const player of this.room.players) {
      this.playerStates.set(player.id, {
        consecutiveWrong: 0,
        currentWordIndex: 0,
        lives: modeConfig.initialLives ?? 3,
        inputStartTime: 0,
      });
    }

    let countdown = GAME_COUNTDOWN_SECONDS;
    this.onCountdown(countdown);

    this.timers.countdownTimer = setInterval(() => {
      countdown--;
      this.onCountdown(countdown);
      if (countdown <= 0) {
        if (this.timers.countdownTimer) clearInterval(this.timers.countdownTimer);
        this.timers.countdownTimer = null;
        this.startGameLoop();
      }
    }, 1000);
  }

  private startGameLoop(): void {
    this.gameStartTime = Date.now();
    const config = DIFFICULTY_CONFIGS[this.room.difficulty];
    const modeConfig = GAME_MODE_CONFIGS[this.room.gameMode];

    const initialWords = generateWordBatch(
      this.room.difficulty,
      this.room.players.length * 3,
      config.wordType,
      config.countdownPerWord
    );
    this.activeWords = initialWords;
    this.onWordGen(initialWords);

    const spawnInterval = Math.round(1000 / config.spawnRate);
    this.timers.wordSpawnTimer = setInterval(() => {
      const newWord = generateWordBatch(
        this.room.difficulty,
        1,
        config.wordType,
        config.countdownPerWord
      );
      this.activeWords.push(...newWord);
      this.onWordGen(newWord);
    }, spawnInterval);

    this.timers.rankUpdateTimer = setInterval(() => {
      this.onRankUpdate(this.getRanks());
    }, 1000);

    if (modeConfig.timeLimit) {
      this.timers.gameTimer = setTimeout(() => {
        this.endGame('时间到');
      }, modeConfig.timeLimit * 1000) as unknown as ReturnType<typeof setInterval>;
    }
  }

  handleInput(playerId: string, wordId: string, input: string, inputTimestamp: number): void {
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    const state = this.playerStates.get(playerId);
    if (!state) return;

    const word = this.activeWords.find(w => w.id === wordId);
    if (!word) {
      this.onInputResult(playerId, wordId, false, 0);
      return;
    }

    const inputTimeSeconds = (inputTimestamp - word.appearedAt) / 1000;
    const minTime = word.length * MIN_INPUT_TIME_PER_CHAR;
    if (inputTimeSeconds < minTime) {
      this.onInputResult(playerId, wordId, false, 0);
      return;
    }

    const correct = checkInput(word, input);

    if (correct) {
      state.consecutiveWrong = 0;
      player.combo++;
      if (player.combo > player.maxCombo) player.maxCombo = player.combo;
      player.correctCount++;

      const score = calculateScore(
        this.room.difficulty,
        word.length,
        inputTimeSeconds,
        player.accuracy,
        player.combo
      );
      player.score += score;

      const wordIndex = this.activeWords.findIndex(w => w.id === wordId);
      if (wordIndex !== -1) this.activeWords.splice(wordIndex, 1);

      this.onInputResult(playerId, wordId, true, score);
    } else {
      state.consecutiveWrong++;
      player.wrongCount++;
      player.combo = 0;

      let penalty = applyWrongPenalty(player);
      if (shouldApplyConsecutiveWrongPenalty(state.consecutiveWrong)) {
        penalty += applyConsecutiveWrongPenalty();
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

    player.accuracy = updatePlayerAccuracy(player);
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    player.wpm = calculateWpm(player.correctCount, elapsed);

    this.onScoreUpdate(this.room.players);

    this.checkWinCondition();
  }

  handleTimeout(playerId: string, wordId: string): void {
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    const state = this.playerStates.get(playerId);
    if (!state) return;

    player.score = Math.max(0, player.score + applyTimeoutPenalty());
    player.combo = 0;
    player.wrongCount++;
    player.accuracy = updatePlayerAccuracy(player);

    const wordIndex = this.activeWords.findIndex(w => w.id === wordId);
    if (wordIndex !== -1) this.activeWords.splice(wordIndex, 1);

    this.onInputResult(playerId, wordId, false, applyTimeoutPenalty());
    this.onScoreUpdate(this.room.players);
  }

  private checkWinCondition(): void {
    const modeConfig = GAME_MODE_CONFIGS[this.room.gameMode];

    if (this.room.gameMode === 'classic' && modeConfig.targetScore) {
      const winner = this.room.players.find(p => p.score >= modeConfig.targetScore!);
      if (winner) {
        this.endGame(`${winner.nickname} 达到目标分数`);
      }
    }
  }

  private checkSurvivalEnd(): void {
    const alive = this.room.players.filter(p => p.status !== 'disconnected');
    if (alive.length <= 1) {
      this.endGame(alive.length === 1 ? `${alive[0].nickname} 是最后存活者` : '所有玩家已淘汰');
    }
  }

  private getRanks(): { playerId: string; rank: number; score: number }[] {
    const sorted = [...this.room.players].sort((a, b) => b.score - a.score);
    return sorted.map((p, i) => ({ playerId: p.id, rank: i + 1, score: p.score }));
  }

  private endGame(reason: string): void {
    this.cleanup();
    const results = this.generateResults();
    this.onGameEnd(results, reason);
  }

  private generateResults(): GameResult[] {
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

  private cleanup(): void {
    if (this.timers.countdownTimer) clearInterval(this.timers.countdownTimer);
    if (this.timers.wordSpawnTimer) clearInterval(this.timers.wordSpawnTimer);
    if (this.timers.gameTimer) clearTimeout(this.timers.gameTimer);
    if (this.timers.rankUpdateTimer) clearInterval(this.timers.rankUpdateTimer);
    this.timers = {
      countdownTimer: null,
      wordSpawnTimer: null,
      gameTimer: null,
      rankUpdateTimer: null,
    };
  }

  stop(): void {
    this.cleanup();
  }

  getActiveWords(): WordItem[] {
    return this.activeWords;
  }
}
