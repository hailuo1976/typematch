import { useState, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { DIFFICULTY_CONFIGS, GAME_MODE_CONFIGS } from '@typematch/shared';

export default function RoomPage() {
  const store = useGameStore();
  const ws = useWebSocket();
  const [chatInput, setChatInput] = useState('');

  const room = store.room;
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">房间信息加载中...</p>
      </div>
    );
  }

  const myPlayer = room.players.find(p => p.id === store.playerId);
  const isReady = myPlayer?.status === 'ready';
  const allReady = room.players.length >= 2 && room.players.every(p => p.status === 'ready' || p.isHost);

  /**
   * 切换准备状态
   */
  const handleReady = useCallback(() => {
    ws.setReady(!isReady);
  }, [ws, isReady]);

  /**
   * 开始游戏
   */
  const handleStartGame = async () => {
    if (!store.isHost) return;
    try {
      await fetch('/api/room/start', { method: 'POST' });
    } catch (err) {
      console.error('开始游戏失败:', err);
    }
  };

  /**
   * 删除房间（仅房主）
   */
  const handleDeleteRoom = async () => {
    if (!store.isHost) return;
    try {
      await fetch('/api/room', { method: 'DELETE' });
      ws.disconnect();
      store.setRoom(null);
      store.setIsHost(false);
      store.clearChatMessages();
      store.setPage('lobby');
    } catch (err) {
      console.error('删除房间失败:', err);
    }
  };

  /**
   * 离开房间
   */
  const handleLeaveRoom = () => {
    ws.disconnect();
    store.setRoom(null);
    store.setIsHost(false);
    store.clearChatMessages();
    store.setPage('lobby');
  };

  /**
   * 发送聊天消息
   */
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    ws.sendChat(chatInput.trim());
    setChatInput('');
  };

  const sortedPlayers = [...room.players].sort((a, b) => (a.isHost ? -1 : 1) - (b.isHost ? -1 : 1));

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{room.roomName}</h1>
            <p className="text-sm text-slate-400">
              {DIFFICULTY_CONFIGS[room.difficulty].label} · {GAME_MODE_CONFIGS[room.gameMode].label} · {room.players.length}/{room.maxPlayers}人
            </p>
          </div>
          <div className="flex gap-2">
            {store.isHost && (
              <button onClick={handleDeleteRoom} className="btn-danger text-sm">
                删除房间
              </button>
            )}
            <button onClick={handleLeaveRoom} className="btn-secondary text-sm">
              离开房间
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <h2 className="text-lg font-bold text-game-accent mb-4">玩家列表</h2>
            <div className="space-y-3">
              {sortedPlayers.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    player.id === store.playerId ? 'bg-primary-900/30 border border-primary-700/50' : 'bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                      {player.avatar === 'avatar_1' ? '🎮' : '👤'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{player.nickname}</span>
                        {player.isHost && (
                          <span className="px-2 py-0.5 bg-game-accent/20 text-game-accent text-xs rounded-full">
                            房主
                          </span>
                        )}
                        {player.id === store.playerId && (
                          <span className="px-2 py-0.5 bg-primary-600/20 text-primary-400 text-xs rounded-full">
                            我
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    {player.status === 'ready' ? (
                      <span className="px-3 py-1 bg-game-success/20 text-game-success text-sm rounded-full">
                        已准备
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-600/50 text-slate-400 text-sm rounded-full">
                        未准备
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {!store.isHost && (
                <button
                  onClick={handleReady}
                  className={isReady ? 'btn-secondary flex-1' : 'btn-success flex-1'}
                >
                  {isReady ? '取消准备' : '准备'}
                </button>
              )}
              {store.isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={!allReady}
                  className={`btn-primary flex-1 ${!allReady ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {allReady ? '开始游戏' : `等待玩家准备 (${room.players.filter(p => p.status === 'ready' || p.isHost).length}/${room.players.length})`}
                </button>
              )}
            </div>
          </div>

          <div className="card flex flex-col">
            <h2 className="text-lg font-bold text-game-accent mb-4">聊天</h2>
            <div className="flex-1 min-h-[300px] max-h-[400px] overflow-y-auto space-y-2 mb-4">
              {store.chatMessages.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-8">暂无消息</p>
              ) : (
                store.chatMessages.map((msg, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-game-accent font-medium">{msg.nickname}: </span>
                    <span className="text-slate-300">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="输入消息..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button onClick={handleSendChat} className="btn-primary text-sm px-4">
                发送
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
