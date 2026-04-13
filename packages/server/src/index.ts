import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { getLocalIpAddress } from './network';
import { UdpBroadcaster } from './udp';
import { WsHandler } from './websocket';
import { createRoom, addPlayerToRoom, allPlayersReady } from './roomManager';
import type { Difficulty, GameMode, RoomInfo } from '@typematch/shared';
import { HTTP_SERVER_PORT } from '@typematch/shared';

export class TypeMatchServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wsHandler: WsHandler;
  private udpBroadcaster: UdpBroadcaster | null = null;
  private room: RoomInfo | null = null;
  private localIp: string;

  constructor() {
    this.app = express();
    this.localIp = getLocalIpAddress();
    this.server = createServer(this.app);
    this.wsHandler = new WsHandler(this.server);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    const clientPath = path.resolve(__dirname, '../../client/dist');
    this.app.use(express.static(clientPath));
  }

  private setupRoutes(): void {
    this.app.get('/api/info', (_req, res) => {
      const wsRoom = this.wsHandler.getRoom();
      if (wsRoom) {
        this.room = wsRoom;
      } else {
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

      this.room = createRoom(
        hostId,
        hostNickname,
        roomName || `${hostNickname}的房间`,
        maxPlayers || 8,
        difficulty as Difficulty || 'medium',
        gameMode as GameMode || 'classic',
        password
      );

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

      if (!allPlayersReady(this.room)) {
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
      this.wsHandler.setRoom(null as unknown as RoomInfo);
      console.log('[房间] 已删除');
      res.json({ success: true });
    });

    this.app.get('*', (_req, res) => {
      const clientPath = path.resolve(__dirname, '../../client/dist');
      res.sendFile(path.join(clientPath, 'index.html'));
    });
  }

  private startBroadcasting(): void {
    if (!this.room) return;
    this.udpBroadcaster = new UdpBroadcaster(this.localIp, HTTP_SERVER_PORT);
    this.udpBroadcaster.start(this.room);
    console.log(`[UDP] 开始广播房间: ${this.room.roomName}`);
  }

  private stopBroadcasting(): void {
    if (this.udpBroadcaster) {
      this.udpBroadcaster.stop();
      this.udpBroadcaster = null;
    }
  }

  start(): void {
    this.server.listen(HTTP_SERVER_PORT, '0.0.0.0', () => {
      console.log('========================================');
      console.log('  TypeMaster LAN 服务器已启动');
      console.log('========================================');
      console.log(`  本机IP: ${this.localIp}`);
      console.log(`  端口: ${HTTP_SERVER_PORT} (HTTP + WebSocket)`);
      console.log(`  访问地址: http://${this.localIp}:${HTTP_SERVER_PORT}`);
      console.log('========================================');
    });
  }
}

const server = new TypeMatchServer();
server.start();
