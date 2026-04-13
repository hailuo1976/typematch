import type { RoomInfo } from '@typematch/shared';
import type { Server } from 'http';
export declare class WsHandler {
    private wss;
    private connections;
    private room;
    private gameEngine;
    constructor(server: Server);
    private setup;
    private handleMessage;
    private handleJoin;
    private handleReady;
    private handleChat;
    private handleInputReport;
    private handleKick;
    private handleDisconnect;
    private handlePlayerLeave;
    setRoom(room: RoomInfo): void;
    getRoom(): RoomInfo | null;
    startGame(): void;
    stopGame(): void;
    private broadcastRoomState;
    private broadcast;
    private send;
    private sendError;
    close(): void;
}
//# sourceMappingURL=websocket.d.ts.map