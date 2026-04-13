import { v4 as uuidv4 } from 'uuid';
import type { Player, RoomInfo, Difficulty, GameMode, RoomStatus, PlayerStatus } from '@typematch/shared';
import { MAX_PLAYERS } from '@typematch/shared';

export function createPlayer(nickname: string, avatar: string, isHost: boolean = false): Player {
  return {
    id: uuidv4(),
    nickname,
    avatar,
    score: 0,
    accuracy: 1,
    wpm: 0,
    combo: 0,
    maxCombo: 0,
    correctCount: 0,
    wrongCount: 0,
    status: 'connected',
    isHost,
  };
}

export function createRoom(
  hostId: string,
  hostNickname: string,
  roomName: string,
  maxPlayers: number,
  difficulty: Difficulty,
  gameMode: GameMode,
  password?: string
): RoomInfo {
  const host = createPlayer(hostNickname, 'avatar_1', true);
  host.id = hostId;

  return {
    roomId: uuidv4().slice(0, 8),
    roomName,
    hostId,
    players: [host],
    maxPlayers: Math.min(maxPlayers, MAX_PLAYERS),
    difficulty,
    gameMode,
    status: 'waiting',
    allowMidJoin: false,
    password,
  };
}

export function addPlayerToRoom(room: RoomInfo, player: Player): boolean {
  if (room.players.length >= room.maxPlayers) return false;
  if (room.status === 'gaming' && !room.allowMidJoin) return false;
  if (room.players.some(p => p.id === player.id)) return false;
  room.players.push(player);
  return true;
}

export function removePlayerFromRoom(room: RoomInfo, playerId: string): boolean {
  const index = room.players.findIndex(p => p.id === playerId);
  if (index === -1) return false;
  room.players.splice(index, 1);
  return true;
}

export function setPlayerReady(room: RoomInfo, playerId: string, ready: boolean): boolean {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return false;
  player.status = ready ? 'ready' : 'connected';
  return true;
}

export function allPlayersReady(room: RoomInfo): boolean {
  return room.players.length >= 2 && room.players.every(p => p.status === 'ready' || p.isHost);
}

export function transferHost(room: RoomInfo): string | null {
  const remaining = room.players.filter(p => p.status !== 'disconnected');
  if (remaining.length === 0) return null;
  remaining.sort((a, b) => a.id.localeCompare(b.id));
  const newHost = remaining[0];
  const oldHost = room.players.find(p => p.id === room.hostId);
  if (oldHost) oldHost.isHost = false;
  newHost.isHost = true;
  room.hostId = newHost.id;
  return newHost.id;
}

export function resetPlayerStats(room: RoomInfo): void {
  for (const player of room.players) {
    player.score = 0;
    player.accuracy = 1;
    player.wpm = 0;
    player.combo = 0;
    player.maxCombo = 0;
    player.correctCount = 0;
    player.wrongCount = 0;
  }
}

export function getPlayerById(room: RoomInfo, playerId: string): Player | undefined {
  return room.players.find(p => p.id === playerId);
}

export function getRoomStatus(room: RoomInfo): RoomStatus {
  return room.status;
}

export function setRoomStatus(room: RoomInfo, status: RoomStatus): void {
  room.status = status;
}
