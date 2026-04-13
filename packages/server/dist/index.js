"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeMatchServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const network_1 = require("./network");
const udp_1 = require("./udp");
const websocket_1 = require("./websocket");
const roomManager_1 = require("./roomManager");
const shared_1 = require("@typematch/shared");
class TypeMatchServer {
    constructor() {
        this.udpBroadcaster = null;
        this.room = null;
        this.app = (0, express_1.default)();
        this.localIp = (0, network_1.getLocalIpAddress)();
        this.server = (0, http_1.createServer)(this.app);
        this.wsHandler = new websocket_1.WsHandler(this.server);
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        const clientPath = path_1.default.resolve(__dirname, '../../client/dist');
        this.app.use(express_1.default.static(clientPath));
    }
    setupRoutes() {
        this.app.get('/api/info', (_req, res) => {
            const wsRoom = this.wsHandler.getRoom();
            if (wsRoom) {
                this.room = wsRoom;
            }
            else {
                this.room = null;
            }
            res.json({
                ip: this.localIp,
                room: this.room,
            });
        });
        this.app.post('/api/room', (req, res) => {
            const { hostId, hostNickname, roomName, maxPlayers, difficulty, gameMode, password } = req.body;
            const wsRoom = this.wsHandler.getRoom();
            if (wsRoom) {
                res.status(400).json({ error: '房间已存在，请先删除旧房间' });
                return;
            }
            if (this.room) {
                this.room = null;
                this.stopBroadcasting();
            }
            this.room = (0, roomManager_1.createRoom)(hostId, hostNickname, roomName || `${hostNickname}的房间`, maxPlayers || 8, difficulty || 'medium', gameMode || 'classic', password);
            this.wsHandler.setRoom(this.room);
            this.startBroadcasting();
            console.log(`[房间] 已创建: ${this.room.roomName} (${this.room.roomId})`);
            res.json({ room: this.room });
        });
        this.app.post('/api/room/start', (_req, res) => {
            if (!this.room) {
                res.status(400).json({ error: '房间不存在' });
                return;
            }
            if (!(0, roomManager_1.allPlayersReady)(this.room)) {
                res.status(400).json({ error: '并非所有玩家都已准备' });
                return;
            }
            this.wsHandler.startGame();
            res.json({ success: true });
        });
        this.app.delete('/api/room', (_req, res) => {
            this.stopBroadcasting();
            this.wsHandler.stopGame();
            this.room = null;
            this.wsHandler.setRoom(null);
            console.log('[房间] 已删除');
            res.json({ success: true });
        });
        this.app.get('*', (_req, res) => {
            const clientPath = path_1.default.resolve(__dirname, '../../client/dist');
            res.sendFile(path_1.default.join(clientPath, 'index.html'));
        });
    }
    startBroadcasting() {
        if (!this.room)
            return;
        this.udpBroadcaster = new udp_1.UdpBroadcaster(this.localIp, shared_1.HTTP_SERVER_PORT);
        this.udpBroadcaster.start(this.room);
        console.log(`[UDP] 开始广播房间: ${this.room.roomName}`);
    }
    stopBroadcasting() {
        if (this.udpBroadcaster) {
            this.udpBroadcaster.stop();
            this.udpBroadcaster = null;
        }
    }
    start() {
        this.server.listen(shared_1.HTTP_SERVER_PORT, '0.0.0.0', () => {
            console.log('========================================');
            console.log('  TypeMaster LAN 服务器已启动');
            console.log('========================================');
            console.log(`  本机IP: ${this.localIp}`);
            console.log(`  端口: ${shared_1.HTTP_SERVER_PORT} (HTTP + WebSocket)`);
            console.log(`  访问地址: http://${this.localIp}:${shared_1.HTTP_SERVER_PORT}`);
            console.log('========================================');
        });
    }
}
exports.TypeMatchServer = TypeMatchServer;
const server = new TypeMatchServer();
server.start();
//# sourceMappingURL=index.js.map