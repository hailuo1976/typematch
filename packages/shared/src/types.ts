export type Difficulty = 'easy' | 'medium' | 'hard' | 'master';

export type GameMode = 'classic' | 'timed' | 'survival';

export type RoomStatus = 'waiting' | 'gaming';

export type PlayerStatus = 'connected' | 'disconnected' | 'ready';

export type WordType = 'en' | 'zh';

export interface DifficultyConfig {
  difficulty: Difficulty;
  label: string;
  wordLengthRange: [number, number];
  spawnRate: number;
  totalWords: number;
  countdownPerWord: number;
  scoreMultiplier: number;
  wordType: WordType;
}

export interface GameModeConfig {
  mode: GameMode;
  label: string;
  description: string;
  targetScore?: number;
  timeLimit?: number;
  initialLives?: number;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  accuracy: number;
  wpm: number;
  combo: number;
  maxCombo: number;
  correctCount: number;
  wrongCount: number;
  status: PlayerStatus;
  isHost: boolean;
}

export interface RoomInfo {
  roomId: string;
  roomName: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  difficulty: Difficulty;
  gameMode: GameMode;
  status: RoomStatus;
  allowMidJoin: boolean;
  password?: string;
}

export interface RoomAnnouncePacket {
  type: 'room_announce';
  room_id: string;
  room_name: string;
  player_count: number;
  max_players: number;
  difficulty: Difficulty;
  game_mode: GameMode;
  status: RoomStatus;
  host_ip: string;
  host_port: number;
}

export interface WordItem {
  id: string;
  text: string;
  type: WordType;
  length: number;
  appearedAt: number;
  countdown: number;
}

export interface GameResult {
  playerId: string;
  nickname: string;
  avatar: string;
  score: number;
  accuracy: number;
  wpm: number;
  maxCombo: number;
  correctCount: number;
  wrongCount: number;
  rank: number;
}

export interface LocalStats {
  totalGames: number;
  wins: number;
  bestWpm: number;
  bestAccuracy: number;
  maxCombo: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
}
