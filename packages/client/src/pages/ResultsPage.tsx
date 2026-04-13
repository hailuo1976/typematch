import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { DIFFICULTY_CONFIGS, GAME_MODE_CONFIGS } from '@typematch/shared';

export default function ResultsPage() {
  const store = useGameStore();
  const ws = useWebSocket();
  const results = store.gameResults;
  const myResult = results.find(r => r.playerId === store.playerId);

  const handleBackToRoom = () => {
    store.setPage('room');
  };

  const handleBackToLobby = () => {
    ws.disconnect();
    store.setRoom(null);
    store.setIsHost(false);
    store.setPage('lobby');
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-yellow-400';
      case 2: return 'text-slate-300';
      case 3: return 'text-amber-600';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="game-title text-4xl mb-2">游戏结束</h1>
          {myResult && (
            <div className="mt-4">
              <span className={`text-6xl ${getRankColor(myResult.rank)}`}>
                {getRankEmoji(myResult.rank)}
              </span>
              {myResult.rank === 1 && (
                <p className="text-2xl text-game-success font-bold mt-2 animate-bounce-in">
                  🎉 恭喜获胜！
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card mb-6">
          <h2 className="text-xl font-bold text-game-accent mb-4">排名</h2>
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.playerId}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  result.playerId === store.playerId
                    ? 'bg-primary-900/30 border border-primary-700/50'
                    : 'bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold ${getRankColor(result.rank)}`}>
                    {getRankEmoji(result.rank)}
                  </span>
                  <div>
                    <span className="font-medium text-white text-lg">
                      {result.nickname}
                      {result.playerId === store.playerId && (
                        <span className="text-sm text-primary-400 ml-2">(我)</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-game-warning">{result.score}</div>
                  <div className="text-xs text-slate-400">分</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {myResult && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-game-accent mb-4">个人数据</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-game-accent">{myResult.wpm}</div>
                <div className="text-xs text-slate-400">WPM</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-game-success">
                  {(myResult.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-slate-400">准确率</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary-400">{myResult.maxCombo}</div>
                <div className="text-xs text-slate-400">最大连击</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-game-warning">
                  {myResult.correctCount}/{myResult.correctCount + myResult.wrongCount}
                </div>
                <div className="text-xs text-slate-400">正确/总数</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button onClick={handleBackToRoom} className="btn-primary flex-1">
            返回房间
          </button>
          <button onClick={handleBackToLobby} className="btn-secondary flex-1">
            返回大厅
          </button>
        </div>
      </div>
    </div>
  );
}
