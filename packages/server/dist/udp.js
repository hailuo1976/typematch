"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UdpScanner = exports.UdpBroadcaster = void 0;
const dgram_1 = __importDefault(require("dgram"));
const shared_1 = require("@typematch/shared");
class UdpBroadcaster {
    constructor(hostIp, hostPort, port = shared_1.UDP_BROADCAST_PORT) {
        this.socket = null;
        this.intervalId = null;
        this.hostIp = hostIp;
        this.hostPort = hostPort;
        this.port = port;
    }
    start(room) {
        this.socket = dgram_1.default.createSocket('udp4');
        this.socket.bind(() => {
            if (this.socket) {
                this.socket.setBroadcast(true);
            }
        });
        this.intervalId = setInterval(() => {
            this.broadcast(room);
        }, shared_1.BROADCAST_INTERVAL);
    }
    broadcast(room) {
        if (!this.socket)
            return;
        const packet = {
            type: 'room_announce',
            room_id: room.roomId,
            room_name: room.roomName,
            player_count: room.players.length,
            max_players: room.maxPlayers,
            difficulty: room.difficulty,
            game_mode: room.gameMode,
            status: room.status,
            host_ip: this.hostIp,
            host_port: this.hostPort,
        };
        const message = Buffer.from(JSON.stringify(packet));
        this.socket.send(message, 0, message.length, this.port, '255.255.255.255', (err) => {
            if (err) {
                console.error('[UDP] 广播发送失败:', err.message);
            }
        });
    }
    updateRoom(room) {
        // 下一次广播自动使用最新房间信息
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
exports.UdpBroadcaster = UdpBroadcaster;
class UdpScanner {
    constructor(onRoomFound, port = shared_1.UDP_BROADCAST_PORT) {
        this.socket = null;
        this.rooms = new Map();
        this.cleanupInterval = null;
        this.port = port;
        this.onRoomFound = onRoomFound;
    }
    start() {
        this.socket = dgram_1.default.createSocket('udp4');
        this.socket.on('message', (msg) => {
            try {
                const packet = JSON.parse(msg.toString());
                if (packet.type === 'room_announce') {
                    this.rooms.set(packet.room_id, { ...packet, lastSeen: Date.now() });
                    this.notifyRooms();
                }
            }
            catch {
                // 忽略无效包
            }
        });
        this.socket.bind(this.port, () => {
            console.log(`[UDP] 扫描器监听端口 ${this.port}`);
        });
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, room] of this.rooms) {
                if (now - room.lastSeen > 10000) {
                    this.rooms.delete(id);
                }
            }
            this.notifyRooms();
        }, 5000);
    }
    notifyRooms() {
        const rooms = Array.from(this.rooms.values()).map(({ lastSeen, ...rest }) => rest);
        this.onRoomFound(rooms);
    }
    getRooms() {
        return Array.from(this.rooms.values()).map(({ lastSeen, ...rest }) => rest);
    }
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
exports.UdpScanner = UdpScanner;
//# sourceMappingURL=udp.js.map