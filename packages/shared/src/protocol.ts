export type WsMessageType =
  | 'JOIN'
  | 'JOIN_ACK'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'PLAYER_READY'
  | 'KICK_PLAYER'
  | 'ROOM_STATE'
  | 'CHAT_MESSAGE'
  | 'GAME_START'
  | 'GAME_COUNTDOWN'
  | 'WORD_GEN'
  | 'INPUT_REPORT'
  | 'INPUT_RESULT'
  | 'SCORE_UPDATE'
  | 'RANK_UPDATE'
  | 'GAME_END'
  | 'ERROR'
  | 'PONG';

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  timestamp: number;
}

export interface JoinPayload {
  playerId: string;
  nickname: string;
  avatar: string;
}

export interface JoinAckPayload {
  playerId: string;
  room: import('./types').RoomInfo;
}

export interface PlayerJoinedPayload {
  player: import('./types').Player;
}

export interface PlayerLeftPayload {
  playerId: string;
}

export interface PlayerReadyPayload {
  playerId: string;
  ready: boolean;
}

export interface KickPlayerPayload {
  playerId: string;
}

export interface RoomStatePayload {
  room: import('./types').RoomInfo;
}

export interface ChatMessagePayload {
  playerId: string;
  nickname: string;
  message: string;
}

export interface GameStartPayload {
  difficulty: import('./types').Difficulty;
  gameMode: import('./types').GameMode;
  countdown: number;
}

export interface GameCountdownPayload {
  remaining: number;
}

export interface WordGenPayload {
  words: import('./types').WordItem[];
}

export interface InputReportPayload {
  playerId: string;
  wordId: string;
  input: string;
  inputTime: number;
}

export interface InputResultPayload {
  playerId: string;
  wordId: string;
  correct: boolean;
  score: number;
  combo: number;
  accuracy: number;
  wpm: number;
}

export interface ScoreUpdatePayload {
  players: Pick<import('./types').Player, 'id' | 'score' | 'combo' | 'accuracy' | 'wpm'>[];
}

export interface RankUpdatePayload {
  ranks: { playerId: string; rank: number; score: number }[];
}

export interface GameEndPayload {
  results: import('./types').GameResult[];
  reason: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
