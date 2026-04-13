import dgram from 'dgram';
import type { RoomInfo, RoomAnnouncePacket } from '@typematch/shared';
import { UDP_BROADCAST_PORT, BROADCAST_INTERVAL } from '@typematch/shared';

export class UdpBroadcaster {
  private socket: dgram.Socket | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private port: number;
  private hostIp: string;
  private hostPort: number;

  constructor(hostIp: string, hostPort: number, port: number = UDP_BROADCAST_PORT) {
    this.hostIp = hostIp;
    this.hostPort = hostPort;
    this.port = port;
  }

  start(room: RoomInfo): void {
    this.socket = dgram.createSocket('udp4');
    this.socket.bind(() => {
      if (this.socket) {
        this.socket.setBroadcast(true);
      }
    });

    this.intervalId = setInterval(() => {
      this.broadcast(room);
    }, BROADCAST_INTERVAL);
  }

  private broadcast(room: RoomInfo): void {
    if (!this.socket) return;

    const packet: RoomAnnouncePacket = {
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

  updateRoom(room: RoomInfo): void {
    // 下一次广播自动使用最新房间信息
  }

  stop(): void {
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

export class UdpScanner {
  private socket: dgram.Socket | null = null;
  private rooms: Map<string, RoomAnnouncePacket & { lastSeen: number }> = new Map();
  private port: number;
  private onRoomFound: (rooms: RoomAnnouncePacket[]) => void;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(onRoomFound: (rooms: RoomAnnouncePacket[]) => void, port: number = UDP_BROADCAST_PORT) {
    this.port = port;
    this.onRoomFound = onRoomFound;
  }

  start(): void {
    this.socket = dgram.createSocket('udp4');

    this.socket.on('message', (msg) => {
      try {
        const packet = JSON.parse(msg.toString()) as RoomAnnouncePacket;
        if (packet.type === 'room_announce') {
          this.rooms.set(packet.room_id, { ...packet, lastSeen: Date.now() });
          this.notifyRooms();
        }
      } catch {
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

  private notifyRooms(): void {
    const rooms = Array.from(this.rooms.values()).map(({ lastSeen, ...rest }) => rest);
    this.onRoomFound(rooms);
  }

  getRooms(): RoomAnnouncePacket[] {
    return Array.from(this.rooms.values()).map(({ lastSeen, ...rest }) => rest);
  }

  stop(): void {
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
