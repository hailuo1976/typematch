import { useRef, useCallback } from 'react';
import type { WsMessage } from '@typematch/shared';
import { useGameStore } from '../stores/gameStore';
import { getWsClient, createWsClient, buildWsUrl } from '../services/wsClient';

export function useWebSocket() {
  const store = useGameStore();
  const clientRef = useRef(getWsClient());

  const connect = useCallback(async (host?: string, port?: number) => {
    const wsHost = host || window.location.hostname;
    const wsPort = port || undefined;
    const wsUrl = buildWsUrl(wsHost, wsPort);

    store.setServerInfo(wsHost, wsPort || 3000);
    const client = createWsClient(wsUrl);
    clientRef.current = client;

    client.on('JOIN_ACK', (msg) => {
      const payload = msg.payload as { playerId: string; room: import('@typematch/shared').RoomInfo };
      store.setRoom(payload.room);
    });

    client.on('ROOM_STATE', (msg) => {
      const payload = msg.payload as { room: import('@typematch/shared').RoomInfo };
      store.setRoom(payload.room);
    });

    client.on('PLAYER_JOINED', (msg) => {
      const payload = msg.payload as { player: import('@typematch/shared').Player };
      if (store.room) {
        const exists = store.room.players.some(p => p.id === payload.player.id);
        if (!exists) {
          store.setRoom({
            ...store.room,
            players: [...store.room.players, payload.player],
          });
        }
      }
    });

    client.on('PLAYER_LEFT', (msg) => {
      const payload = msg.payload as { playerId: string };
      if (store.room) {
        store.setRoom({
          ...store.room,
          players: store.room.players.filter(p => p.id !== payload.playerId),
        });
      }
    });

    client.on('GAME_START', () => {
      store.resetGame();
      store.setPage('game');
    });

    client.on('GAME_COUNTDOWN', (msg) => {
      const payload = msg.payload as { remaining: number };
      store.setGameCountdown(payload.remaining);
    });

    client.on('WORD_GEN', (msg) => {
      const payload = msg.payload as { words: import('@typematch/shared').WordItem[] };
      store.addActiveWords(payload.words);
    });

    client.on('INPUT_RESULT', (msg) => {
      const payload = msg.payload as {
        playerId: string;
        wordId: string;
        correct: boolean;
        score: number;
      };
      if (payload.playerId === store.playerId && payload.correct) {
        store.removeActiveWord(payload.wordId);
        store.setCurrentInput('');
        store.setTargetWordId(null);
      }
    });

    client.on('SCORE_UPDATE', (msg) => {
      const payload = msg.payload as {
        players: { id: string; score: number; combo: number; accuracy: number; wpm: number }[];
      };
      if (store.room) {
        const updatedPlayers = store.room.players.map(p => {
          const updated = payload.players.find(u => u.id === p.id);
          return updated ? { ...p, ...updated } : p;
        });
        store.setRoom({ ...store.room, players: updatedPlayers });
      }
    });

    client.on('RANK_UPDATE', () => {
      // 排名更新已通过 SCORE_UPDATE 处理
    });

    client.on('GAME_END', (msg) => {
      const payload = msg.payload as { results: import('@typematch/shared').GameResult[]; reason: string };
      store.setGameResults(payload.results);
      const myResult = payload.results.find(r => r.playerId === store.playerId);
      if (myResult) store.updateLocalStats(myResult);
      store.setPage('results');
    });

    client.on('CHAT_MESSAGE', (msg) => {
      const payload = msg.payload as { nickname: string; message: string };
      store.addChatMessage(payload.nickname, payload.message);
    });

    client.on('ERROR', (msg) => {
      const payload = msg.payload as { code: string; message: string };
      console.error('[WS Error]', payload.code, payload.message);
    });

    await client.connect();
  }, [store]);

  const joinRoom = useCallback((nickname: string, avatar: string) => {
    const client = clientRef.current;
    if (!client) return;
    client.send('JOIN', {
      playerId: store.playerId,
      nickname,
      avatar,
    });
  }, [store.playerId]);

  const setReady = useCallback((ready: boolean) => {
    const client = clientRef.current;
    if (!client) return;
    client.send('PLAYER_READY', {
      playerId: store.playerId,
      ready,
    });
  }, [store.playerId]);

  const sendInput = useCallback((wordId: string, input: string) => {
    const client = clientRef.current;
    if (!client) return;
    client.send('INPUT_REPORT', {
      playerId: store.playerId,
      wordId,
      input,
      inputTime: Date.now(),
    });
  }, [store.playerId]);

  const sendChat = useCallback((message: string) => {
    const client = clientRef.current;
    if (!client) return;
    client.send('CHAT_MESSAGE', {
      playerId: store.playerId,
      nickname: store.nickname,
      message,
    });
  }, [store.playerId, store.nickname]);

  const disconnect = useCallback(() => {
    const client = clientRef.current;
    if (client) client.disconnect();
  }, []);

  return {
    connect,
    joinRoom,
    setReady,
    sendInput,
    sendChat,
    disconnect,
    isConnected: store.wsConnected,
  };
}
