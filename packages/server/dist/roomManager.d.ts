import type { Player, RoomInfo, Difficulty, GameMode, RoomStatus } from '@typematch/shared';
export declare function createPlayer(nickname: string, avatar: string, isHost?: boolean): Player;
export declare function createRoom(hostId: string, hostNickname: string, roomName: string, maxPlayers: number, difficulty: Difficulty, gameMode: GameMode, password?: string): RoomInfo;
export declare function addPlayerToRoom(room: RoomInfo, player: Player): boolean;
export declare function removePlayerFromRoom(room: RoomInfo, playerId: string): boolean;
export declare function setPlayerReady(room: RoomInfo, playerId: string, ready: boolean): boolean;
export declare function allPlayersReady(room: RoomInfo): boolean;
export declare function transferHost(room: RoomInfo): string | null;
export declare function resetPlayerStats(room: RoomInfo): void;
export declare function getPlayerById(room: RoomInfo, playerId: string): Player | undefined;
export declare function getRoomStatus(room: RoomInfo): RoomStatus;
export declare function setRoomStatus(room: RoomInfo, status: RoomStatus): void;
//# sourceMappingURL=roomManager.d.ts.map