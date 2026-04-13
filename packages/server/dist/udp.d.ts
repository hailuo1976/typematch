import type { RoomInfo, RoomAnnouncePacket } from '@typematch/shared';
export declare class UdpBroadcaster {
    private socket;
    private intervalId;
    private port;
    private hostIp;
    private hostPort;
    constructor(hostIp: string, hostPort: number, port?: number);
    start(room: RoomInfo): void;
    private broadcast;
    updateRoom(room: RoomInfo): void;
    stop(): void;
}
export declare class UdpScanner {
    private socket;
    private rooms;
    private port;
    private onRoomFound;
    private cleanupInterval;
    constructor(onRoomFound: (rooms: RoomAnnouncePacket[]) => void, port?: number);
    start(): void;
    private notifyRooms;
    getRooms(): RoomAnnouncePacket[];
    stop(): void;
}
//# sourceMappingURL=udp.d.ts.map