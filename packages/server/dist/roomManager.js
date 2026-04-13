"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlayer = createPlayer;
exports.createRoom = createRoom;
exports.addPlayerToRoom = addPlayerToRoom;
exports.removePlayerFromRoom = removePlayerFromRoom;
exports.setPlayerReady = setPlayerReady;
exports.allPlayersReady = allPlayersReady;
exports.transferHost = transferHost;
exports.resetPlayerStats = resetPlayerStats;
exports.getPlayerById = getPlayerById;
exports.getRoomStatus = getRoomStatus;
exports.setRoomStatus = setRoomStatus;
const uuid_1 = require("uuid");
const shared_1 = require("@typematch/shared");
function createPlayer(nickname, avatar, isHost = false) {
    return {
        id: (0, uuid_1.v4)(),
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
function createRoom(hostId, hostNickname, roomName, maxPlayers, difficulty, gameMode, password) {
    const host = createPlayer(hostNickname, 'avatar_1', true);
    host.id = hostId;
    return {
        roomId: (0, uuid_1.v4)().slice(0, 8),
        roomName,
        hostId,
        players: [host],
        maxPlayers: Math.min(maxPlayers, shared_1.MAX_PLAYERS),
        difficulty,
        gameMode,
        status: 'waiting',
        allowMidJoin: false,
        password,
    };
}
function addPlayerToRoom(room, player) {
    if (room.players.length >= room.maxPlayers)
        return false;
    if (room.status === 'gaming' && !room.allowMidJoin)
        return false;
    if (room.players.some(p => p.id === player.id))
        return false;
    room.players.push(player);
    return true;
}
function removePlayerFromRoom(room, playerId) {
    const index = room.players.findIndex(p => p.id === playerId);
    if (index === -1)
        return false;
    room.players.splice(index, 1);
    return true;
}
function setPlayerReady(room, playerId, ready) {
    const player = room.players.find(p => p.id === playerId);
    if (!player)
        return false;
    player.status = ready ? 'ready' : 'connected';
    return true;
}
function allPlayersReady(room) {
    return room.players.length >= 2 && room.players.every(p => p.status === 'ready' || p.isHost);
}
function transferHost(room) {
    const remaining = room.players.filter(p => p.status !== 'disconnected');
    if (remaining.length === 0)
        return null;
    remaining.sort((a, b) => a.id.localeCompare(b.id));
    const newHost = remaining[0];
    const oldHost = room.players.find(p => p.id === room.hostId);
    if (oldHost)
        oldHost.isHost = false;
    newHost.isHost = true;
    room.hostId = newHost.id;
    return newHost.id;
}
function resetPlayerStats(room) {
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
function getPlayerById(room, playerId) {
    return room.players.find(p => p.id === playerId);
}
function getRoomStatus(room) {
    return room.status;
}
function setRoomStatus(room, status) {
    room.status = status;
}
//# sourceMappingURL=roomManager.js.map