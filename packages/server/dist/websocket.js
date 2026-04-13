"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsHandler = void 0;
const ws_1 = require("ws");
const roomManager_1 = require("./roomManager");
const gameEngine_1 = require("./gameEngine");
class WsHandler {
    constructor(server) {
        this.connections = new Map();
        this.room = null;
        this.gameEngine = null;
        this.wss = new ws_1.WebSocketServer({ server, path: '/ws' });
        this.setup();
    }
    setup() {
        this.wss.on('connection', (ws) => {
            console.log('[WS] 新连接');
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(ws, message);
                }
                catch (err) {
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
                }
                else {
                    conn.isAlive = false;
                    conn.ws.ping();
                }
            }
        }, 30000);
    }
    handleMessage(ws, message) {
        switch (message.type) {
            case 'JOIN':
                this.handleJoin(ws, message.payload);
                break;
            case 'PLAYER_READY':
                this.handleReady(message.payload);
                break;
            case 'CHAT_MESSAGE':
                this.handleChat(message.payload);
                break;
            case 'INPUT_REPORT':
                this.handleInputReport(message.payload);
                break;
            case 'KICK_PLAYER':
                this.handleKick(message.payload);
                break;
            default:
                this.sendError(ws, 'UNKNOWN_MESSAGE', `未知消息类型: ${message.type}`);
        }
    }
    handleJoin(ws, payload) {
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
            const ackPayload = {
                playerId: existingPlayer.id,
                room: this.room,
            };
            this.send(ws, 'JOIN_ACK', ackPayload);
            this.broadcastRoomState();
            return;
        }
        const player = (0, roomManager_1.createPlayer)(payload.nickname, payload.avatar);
        player.id = payload.playerId;
        if (!(0, roomManager_1.addPlayerToRoom)(this.room, player)) {
            this.sendError(ws, 'JOIN_FAILED', '加入房间失败');
            return;
        }
        this.connections.set(player.id, { ws, playerId: player.id, isAlive: true });
        const ackPayload = {
            playerId: player.id,
            room: this.room,
        };
        this.send(ws, 'JOIN_ACK', ackPayload);
        const joinedPayload = { player };
        this.broadcast('PLAYER_JOINED', joinedPayload, player.id);
        this.broadcastRoomState();
    }
    handleReady(payload) {
        if (!this.room)
            return;
        (0, roomManager_1.setPlayerReady)(this.room, payload.playerId, payload.ready);
        this.broadcastRoomState();
    }
    handleChat(payload) {
        this.broadcast('CHAT_MESSAGE', payload);
    }
    handleInputReport(payload) {
        if (!this.gameEngine)
            return;
        this.gameEngine.handleInput(payload.playerId, payload.wordId, payload.input, payload.inputTime);
    }
    handleKick(payload) {
        if (!this.room)
            return;
        if (payload.playerId !== this.room.hostId)
            return;
        const conn = this.connections.get(payload.targetId);
        if (conn) {
            this.send(conn.ws, 'ERROR', { code: 'KICKED', message: '你已被踢出房间' });
            conn.ws.close();
        }
        this.handlePlayerLeave(payload.targetId);
    }
    handleDisconnect(ws) {
        for (const [id, conn] of this.connections) {
            if (conn.ws === ws) {
                this.handlePlayerLeave(id);
                break;
            }
        }
    }
    handlePlayerLeave(playerId) {
        if (!this.room)
            return;
        const wasHost = playerId === this.room.hostId;
        (0, roomManager_1.removePlayerFromRoom)(this.room, playerId);
        this.connections.delete(playerId);
        const leftPayload = { playerId };
        this.broadcast('PLAYER_LEFT', leftPayload);
        if (this.room.players.length === 0) {
            this.stopGame();
            this.room = null;
            console.log('[WS] 所有玩家已离开，房间已清理');
            return;
        }
        if (wasHost) {
            const newHostId = (0, roomManager_1.transferHost)(this.room);
            if (newHostId) {
                console.log(`[WS] 房主迁移至: ${newHostId}`);
            }
        }
        this.broadcastRoomState();
    }
    setRoom(room) {
        this.room = room;
    }
    getRoom() {
        return this.room;
    }
    startGame() {
        if (!this.room)
            return;
        (0, roomManager_1.resetPlayerStats)(this.room);
        const startPayload = {
            difficulty: this.room.difficulty,
            gameMode: this.room.gameMode,
            countdown: 3,
        };
        this.broadcast('GAME_START', startPayload);
        this.gameEngine = new gameEngine_1.GameEngine(this.room, {
            onWordGen: (words) => {
                const payload = { words };
                this.broadcast('WORD_GEN', payload);
            },
            onScoreUpdate: (players) => {
                const payload = {
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
                const payload = { ranks };
                this.broadcast('RANK_UPDATE', payload);
            },
            onGameEnd: (results, reason) => {
                const payload = { results, reason };
                this.broadcast('GAME_END', payload);
                this.gameEngine = null;
                if (this.room)
                    this.room.status = 'waiting';
            },
            onCountdown: (remaining) => {
                const payload = { remaining };
                this.broadcast('GAME_COUNTDOWN', payload);
            },
            onInputResult: (playerId, wordId, correct, score) => {
                const player = this.room ? (0, roomManager_1.getPlayerById)(this.room, playerId) : undefined;
                const payload = {
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
    stopGame() {
        if (this.gameEngine) {
            this.gameEngine.stop();
            this.gameEngine = null;
        }
        if (this.room) {
            this.room.status = 'waiting';
        }
    }
    broadcastRoomState() {
        if (!this.room)
            return;
        const payload = { room: this.room };
        this.broadcast('ROOM_STATE', payload);
    }
    broadcast(type, payload, excludeId) {
        const message = {
            type: type,
            payload,
            timestamp: Date.now(),
        };
        const data = JSON.stringify(message);
        for (const [id, conn] of this.connections) {
            if (id !== excludeId && conn.ws.readyState === ws_1.WebSocket.OPEN) {
                conn.ws.send(data);
            }
        }
    }
    send(ws, type, payload) {
        if (ws.readyState !== ws_1.WebSocket.OPEN)
            return;
        const message = {
            type: type,
            payload,
            timestamp: Date.now(),
        };
        ws.send(JSON.stringify(message));
    }
    sendError(ws, code, message) {
        const payload = { code, message };
        this.send(ws, 'ERROR', payload);
    }
    close() {
        this.stopGame();
        for (const [, conn] of this.connections) {
            conn.ws.close();
        }
        this.connections.clear();
        this.wss.close();
    }
}
exports.WsHandler = WsHandler;
//# sourceMappingURL=websocket.js.map