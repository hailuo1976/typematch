import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { DIFFICULTY_CONFIGS, GAME_MODE_CONFIGS } from '@typematch/shared';
import type { Difficulty, GameMode } from '@typematch/shared';

export default function LobbyPage() {
  const store = useGameStore();
  const ws = useWebSocket();
  const [roomName, setRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [joinIp, setJoinIp] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (store.room && store.wsConnected && loading) {
      store.setPage('room');
      setLoading(false);
    }
  }, [store.room, store.wsConnected]);

  const handleCreateRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: store.playerId,
          hostNickname: store.nickname,
          roomName: roomName || `${store.nickname}的房间`,
          maxPlayers,
          difficulty,
          gameMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '创建房间失败');
        setLoading(false);
        return;
      }

      if (data.room) {
        store.setRoom(data.room);
        store.setIsHost(true);

        try {
          await ws.connect();
          ws.joinRoom(store.nickname, store.avatar);
        } catch (wsErr) {
          setError('WebSocket 连接失败，请检查服务器是否运行');
          console.error('WebSocket 连接失败:', wsErr);
          setLoading(false);
        }
      }
    } catch (err) {
      setError('无法连接服务器，请确保后端服务已启动 (npm run dev:server)');
      console.error('创建房间失败:', err);
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setLoading(true);
    setError('');
    try {
      const ip = joinIp.trim() || window.location.hostname;
      const port = joinIp.trim() ? 3000 : undefined;

      store.setIsHost(false);
      await ws.connect(ip, port);
      ws.joinRoom(store.nickname, store.avatar);
    } catch (err) {
      setError(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
      console.error('加入房间失败:', err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-10">
          <h1 className="game-title text-5xl mb-3">TypeMaster LAN</h1>
          <p className="text-slate-400 text-lg">局域网多人打字竞技游戏</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm animate-slide-up">
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-game-accent">创建房间</h2>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="text-sm text-slate-400 hover:text-white"
              >
                {showCreate ? '收起 ▲' : '展开 ▼'}
              </button>
            </div>

            {showCreate && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">房间名称</label>
                  <input
                    className="input-field"
                    placeholder={`${store.nickname}的房间`}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">最大人数</label>
                  <select
                    className="input-field"
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  >
                    {[2, 4, 6, 8].map(n => (
                      <option key={n} value={n}>{n}人</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">难度</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(DIFFICULTY_CONFIGS).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setDifficulty(key as Difficulty)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          difficulty === key
                            ? 'bg-game-accent text-game-bg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {config.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">游戏模式</label>
                  <div className="space-y-2">
                    {Object.entries(GAME_MODE_CONFIGS).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setGameMode(key as GameMode)}
                        className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                          gameMode === key
                            ? 'bg-game-accent text-game-bg'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <div className="font-medium">{config.label}</div>
                        <div className={`text-xs mt-1 ${gameMode === key ? 'text-game-bg/70' : 'text-slate-500'}`}>
                          {config.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className={`btn-primary w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? '创建中...' : '🚀 创建房间'}
                </button>
              </div>
            )}

            {!showCreate && (
              <button onClick={() => setShowCreate(true)} className="btn-primary w-full">
                🚀 创建房间
              </button>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-game-accent mb-4">加入房间</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">房主IP地址</label>
                <input
                  className="input-field"
                  placeholder="例如: 192.168.1.101 (留空则连接本机)"
                  value={joinIp}
                  onChange={(e) => setJoinIp(e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">同一局域网内输入房主IP即可加入</p>
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className={`btn-success w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? '连接中...' : '🎮 加入房间'}
              </button>

              <div className="border-t border-game-border pt-4">
                <h3 className="text-sm font-medium text-slate-400 mb-2">本机信息</h3>
                <div className="space-y-1 text-sm">
                  <p>昵称: <span className="text-white">{store.nickname}</span></p>
                  <p>设备ID: <span className="text-slate-500">{store.playerId.slice(0, 16)}...</span></p>
                </div>
              </div>

              <button
                onClick={() => store.setPage('settings')}
                className="btn-secondary w-full"
              >
                ⚙️ 设置
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 card">
          <h2 className="text-xl font-bold text-game-accent mb-4">个人战绩</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{store.localStats.totalGames}</div>
              <div className="text-xs text-slate-400">总场次</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-game-success">{store.localStats.wins}</div>
              <div className="text-xs text-slate-400">胜场</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-game-accent">{store.localStats.bestWpm}</div>
              <div className="text-xs text-slate-400">最快WPM</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-game-warning">
                {store.localStats.bestAccuracy > 0 ? `${(store.localStats.bestAccuracy * 100).toFixed(1)}%` : '-'}
              </div>
              <div className="text-xs text-slate-400">最高准确率</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary-400">{store.localStats.maxCombo}</div>
              <div className="text-xs text-slate-400">最长连击</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
