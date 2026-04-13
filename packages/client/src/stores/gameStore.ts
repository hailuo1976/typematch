import { create } from 'zustand';
import type { Player, RoomInfo, WordItem, GameResult, Difficulty, GameMode, LocalStats, Achievement } from '@typematch/shared';
import { DIFFICULTY_CONFIGS, GAME_MODE_CONFIGS } from '@typematch/shared';

type AppPage = 'lobby' | 'room' | 'game' | 'results' | 'settings';

interface ChatMessage {
  nickname: string;
  message: string;
}

interface GameState {
  currentPage: AppPage;
  playerId: string;
  nickname: string;
  avatar: string;
  room: RoomInfo | null;
  activeWords: WordItem[];
  currentInput: string;
  targetWordId: string | null;
  gameResults: GameResult[];
  gameCountdown: number;
  isHost: boolean;
  wsConnected: boolean;
  localStats: LocalStats;
  achievements: Achievement[];
  serverIp: string;
  serverPort: number;
  chatMessages: ChatMessage[];

  setPage: (page: AppPage) => void;
  setPlayerInfo: (id: string, nickname: string, avatar: string) => void;
  setRoom: (room: RoomInfo | null) => void;
  setActiveWords: (words: WordItem[]) => void;
  addActiveWords: (words: WordItem[]) => void;
  removeActiveWord: (wordId: string) => void;
  setCurrentInput: (input: string) => void;
  setTargetWordId: (wordId: string | null) => void;
  setGameResults: (results: GameResult[]) => void;
  setGameCountdown: (countdown: number) => void;
  setIsHost: (isHost: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  setServerInfo: (ip: string, port: number) => void;
  updateLocalStats: (result: GameResult) => void;
  resetGame: () => void;
  addChatMessage: (nickname: string, message: string) => void;
  clearChatMessages: () => void;
}

const STORAGE_KEY = 'typematch_stats';
const PLAYER_KEY = 'typematch_player';

function loadStats(): LocalStats {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { totalGames: 0, wins: 0, bestWpm: 0, bestAccuracy: 0, maxCombo: 0 };
}

function saveStats(stats: LocalStats): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function loadPlayerInfo(): { nickname: string; avatar: string } {
  try {
    const data = localStorage.getItem(PLAYER_KEY);
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return { nickname: `玩家${Math.floor(Math.random() * 9000 + 1000)}`, avatar: 'avatar_1' };
}

function generatePlayerId(): string {
  let id = localStorage.getItem('typematch_player_id');
  if (!id) {
    id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('typematch_player_id', id);
  }
  return id;
}

const savedPlayer = loadPlayerInfo();

export const useGameStore = create<GameState>((set, get) => ({
  currentPage: 'lobby',
  playerId: generatePlayerId(),
  nickname: savedPlayer.nickname,
  avatar: savedPlayer.avatar,
  room: null,
  activeWords: [],
  currentInput: '',
  targetWordId: null,
  gameResults: [],
  gameCountdown: 0,
  isHost: false,
  wsConnected: false,
  localStats: loadStats(),
  achievements: [],
  serverIp: '',
  serverPort: 3000,
  chatMessages: [],

  setPage: (page) => set({ currentPage: page }),
  setPlayerInfo: (id, nickname, avatar) => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ nickname, avatar }));
    set({ playerId: id, nickname, avatar });
  },
  setRoom: (room) => set({ room }),
  setActiveWords: (words) => set({ activeWords: words }),
  addActiveWords: (words) => set((state) => ({ activeWords: [...state.activeWords, ...words] })),
  removeActiveWord: (wordId) => set((state) => ({
    activeWords: state.activeWords.filter(w => w.id !== wordId),
  })),
  setCurrentInput: (input) => set({ currentInput: input }),
  setTargetWordId: (wordId) => set({ targetWordId: wordId }),
  setGameResults: (results) => set({ gameResults: results }),
  setGameCountdown: (countdown) => set({ gameCountdown: countdown }),
  setIsHost: (isHost) => set({ isHost }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setServerInfo: (ip, port) => set({ serverIp: ip, serverPort: port }),
  updateLocalStats: (result) => {
    const stats = { ...get().localStats };
    stats.totalGames++;
    if (result.rank === 1) stats.wins++;
    if (result.wpm > stats.bestWpm) stats.bestWpm = result.wpm;
    if (result.accuracy > stats.bestAccuracy) stats.bestAccuracy = result.accuracy;
    if (result.maxCombo > stats.maxCombo) stats.maxCombo = result.maxCombo;
    saveStats(stats);
    set({ localStats: stats });
  },
  resetGame: () => set({
    activeWords: [],
    currentInput: '',
    targetWordId: null,
    gameResults: [],
    gameCountdown: 0,
  }),
  addChatMessage: (nickname, message) => set((state) => ({
    chatMessages: [...state.chatMessages, { nickname, message }],
  })),
  clearChatMessages: () => set({ chatMessages: [] }),
}));
