import { WebSocketServer, WebSocket } from 'ws';
import type { RoomInfo, Player, WordItem, GameResult } from '@typematch/shared';
import type {
  WsMessage,
  JoinPayload,
  JoinAckPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PlayerReadyPayload,
  RoomStatePayload,
  ChatMessagePayload,
  GameStartPayload,
  GameCountdownPayload,
  WordGenPayload,
  InputReportPayload,
  InputResultPayload,
  ScoreUpdatePayload,
  RankUpdatePayload,
  GameEndPayload,
  ErrorPayload,
} from '@typematch/shared';
import {
  createPlayer,
  addPlayerToRoom,
  removePlayerFromRoom,
  setPlayerReady,
  allPlayersReady,
  transferHost,
  resetPlayerStats,
  getPlayerById,
} from './roomManager';
import { GameEngine } from './gameEngine';
import type { Server } from 'http';

interface ClientConnection {
  ws: WebSocket;
  playerId: string;
  isAlive: boolean;
}

export class WsHandler {
  private wss: WebSocketServer;
  private connections: Map<string, ClientConnection> = new Map();
  private room: RoomInfo | null = null;
  private gameEngine: GameEngine | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setup();
  }

  private setup(): void {
    this.wss.on('connection', (ws) => {
      console.log('[WS] 新连接');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as WsMessage;
          this.handleMessage(ws, message);
        } catch (err) {
          this.sendError(ws, 'PARSE_ERROR', '消息解析失败');
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('pong', () => {
        for (const [, conn] of this.connections) {
          if (conn.ws === ws) {
            conn.isAlive = true;
          }
        }
      });
    });

    setInterval(() => {
      for (const [id, conn] of this.connections) {
        if (!conn.isAlive) {
          conn.ws.terminate();
          this.handlePlayerLeave(id);
        } else {
          conn.isAlive = false;
          conn.ws.ping();
        }
      }
    }, 30000);
  }

  private handleMessage(ws: WebSocket, message: WsMessage): void {
    switch (message.type) {
      case 'JOIN':
        this.handleJoin(ws, message.payload as JoinPayload);
        break;
      case 'PLAYER_READY':
        this.handleReady(message.payload as PlayerReadyPayload);
        break;
      case 'CHAT_MESSAGE':
        this.handleChat(message.payload as ChatMessagePayload);
        break;
      case 'INPUT_REPORT':
        this.handleInputReport(message.payload as InputReportPayload);
        break;
      case 'KICK_PLAYER':
        this.handleKick(message.payload as { playerId: string; targetId: string });
        break;
      default:
        this.sendError(ws, 'UNKNOWN_MESSAGE', `未知消息类型: ${message.type}`);
    }
  }

  private handleJoin(ws: WebSocket, payload: JoinPayload): void {
    if (!this.room) {
      this.sendError(ws, 'NO_ROOM', '房间不存在');
      return;
    }

    if (this.room.players.length >= this.room.maxPlayers) {
      this.sendError(ws, 'ROOM_FULL', '房间已满');
      return;
    }

    const existingPlayer = this.room.players.find(p => p.id === payload.playerId);
    if (existingPlayer) {
      this.connections.set(existingPlayer.id, { ws, playerId: existingPlayer.id, isAlive: true });

      const ackPayload: JoinAckPayload = {
        playerId: existingPlayer.id,
        room: this.room,
      };
      this.send(ws, 'JOIN_ACK', ackPayload);
      this.broadcastRoomState();
      return;
    }

    const player = createPlayer(payload.nickname, payload.avatar);
    player.id = payload.playerId;

    if (!addPlayerToRoom(this.room, player)) {
      this.sendError(ws, 'JOIN_FAILED', '加入房间失败');
      return;
    }

    this.connections.set(player.id, { ws, playerId: player.id, isAlive: true });

    const ackPayload: JoinAckPayload = {
      playerId: player.id,
      room: this.room,
    };
    this.send(ws, 'JOIN_ACK', ackPayload);

    const joinedPayload: PlayerJoinedPayload = { player };
    this.broadcast('PLAYER_JOINED', joinedPayload, player.id);

    this.broadcastRoomState();
  }

  private handleReady(payload: PlayerReadyPayload): void {
    if (!this.room) return;
    setPlayerReady(this.room, payload.playerId, payload.ready);
    this.broadcastRoomState();
  }

  private handleChat(payload: ChatMessagePayload): void {
    this.broadcast('CHAT_MESSAGE', payload);
  }

  private handleInputReport(payload: InputReportPayload): void {
    if (!this.gameEngine) return;
    this.gameEngine.handleInput(payload.playerId, payload.wordId, payload.input, payload.inputTime);
  }

  private handleKick(payload: { playerId: string; targetId: string }): void {
    if (!this.room) return;
    if (payload.playerId !== this.room.hostId) return;

    const conn = this.connections.get(payload.targetId);
    if (conn) {
      this.send(conn.ws, 'ERROR', { code: 'KICKED', message: '你已被踢出房间' });
      conn.ws.close();
    }
    this.handlePlayerLeave(payload.targetId);
  }

  private handleDisconnect(ws: WebSocket): void {
    for (const [id, conn] of this.connections) {
      if (conn.ws === ws) {
        this.handlePlayerLeave(id);
        break;
      }
    }
  }

  private handlePlayerLeave(playerId: string): void {
    if (!this.room) return;

    const wasHost = playerId === this.room.hostId;
    removePlayerFromRoom(this.room, playerId);
    this.connections.delete(playerId);

    const leftPayload: PlayerLeftPayload = { playerId };
    this.broadcast('PLAYER_LEFT', leftPayload);

    if (wasHost && this.room.players.length > 0) {
      const newHostId = transferHost(this.room);
      if (newHostId) {
        console.log(`[WS] 房主迁移至: ${newHostId}`);
      }
    }

    if (this.room.players.length === 0) {
      this.stopGame();
    }

    this.broadcastRoomState();
  }

  setRoom(room: RoomInfo): void {
    this.room = room;
  }

  getRoom(): RoomInfo | null {
    return this.room;
  }

  startGame(): void {
    if (!this.room) return;

    resetPlayerStats(this.room);

    const startPayload: GameStartPayload = {
      difficulty: this.room.difficulty,
      gameMode: this.room.gameMode,
      countdown: 3,
    };
    this.broadcast('GAME_START', startPayload);

    this.gameEngine = new GameEngine(this.room, {
      onWordGen: (words) => {
        const payload: WordGenPayload = { words };
        this.broadcast('WORD_GEN', payload);
      },
      onScoreUpdate: (players) => {
        const payload: ScoreUpdatePayload = {
          players: players.map(p => ({
            id: p.id,
            score: p.score,
            combo: p.combo,
            accuracy: p.accuracy,
            wpm: p.wpm,
          })),
        };
        this.broadcast('SCORE_UPDATE', payload);
      },
      onRankUpdate: (ranks) => {
        const payload: RankUpdatePayload = { ranks };
        this.broadcast('RANK_UPDATE', payload);
      },
      onGameEnd: (results, reason) => {
        const payload: GameEndPayload = { results, reason };
        this.broadcast('GAME_END', payload);
        this.gameEngine = null;
        if (this.room) this.room.status = 'waiting';
      },
      onCountdown: (remaining) => {
        const payload: GameCountdownPayload = { remaining };
        this.broadcast('GAME_COUNTDOWN', payload);
      },
      onInputResult: (playerId, wordId, correct, score) => {
        const player = this.room ? getPlayerById(this.room, playerId) : undefined;
        const payload: InputResultPayload = {
          playerId,
          wordId,
          correct,
          score,
          combo: player?.combo ?? 0,
          accuracy: player?.accuracy ?? 1,
          wpm: player?.wpm ?? 0,
        };
        this.broadcast('INPUT_RESULT', payload);
      },
    });

    this.room.status = 'gaming';
    this.gameEngine.start();
  }

  stopGame(): void {
    if (this.gameEngine) {
      this.gameEngine.stop();
      this.gameEngine = null;
    }
    if (this.room) {
      this.room.status = 'waiting';
    }
  }

  private broadcastRoomState(): void {
    if (!this.room) return;
    const payload: RoomStatePayload = { room: this.room };
    this.broadcast('ROOM_STATE', payload);
  }

  private broadcast<T>(type: string, payload: T, excludeId?: string): void {
    const message: WsMessage<T> = {
      type: type as WsMessage['type'],
      payload,
      timestamp: Date.now(),
    };
    const data = JSON.stringify(message);

    for (const [id, conn] of this.connections) {
      if (id !== excludeId && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(data);
      }
    }
  }

  private send(ws: WebSocket, type: string, payload: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const message: WsMessage = {
      type: type as WsMessage['type'],
      payload,
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(message));
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    const payload: ErrorPayload = { code, message };
    this.send(ws, 'ERROR', payload);
  }

  close(): void {
    this.stopGame();
    for (const [, conn] of this.connections) {
      conn.ws.close();
    }
    this.connections.clear();
    this.wss.close();
  }
}
