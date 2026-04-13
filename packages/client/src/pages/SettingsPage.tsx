import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';

const AVATARS = ['avatar_1', 'avatar_2', 'avatar_3', 'avatar_4', 'avatar_5', 'avatar_6'];
const AVATAR_EMOJIS: Record<string, string> = {
  avatar_1: '🎮',
  avatar_2: '🚀',
  avatar_3: '⚡',
  avatar_4: '🎯',
  avatar_5: '🔥',
  avatar_6: '💎',
};

export default function SettingsPage() {
  const store = useGameStore();
  const [nickname, setNickname] = useState(store.nickname);
  const [selectedAvatar, setSelectedAvatar] = useState(store.avatar);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    store.setPlayerInfo(store.playerId, nickname, selectedAvatar);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearStats = () => {
    if (window.confirm('确定要清除所有本地战绩数据吗？此操作不可恢复。')) {
      localStorage.removeItem('typematch_stats');
      window.location.reload();
    }
  };

  const handleBack = () => {
    store.setPage('lobby');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">设置</h1>
          <button onClick={handleBack} className="btn-secondary text-sm">
            返回
          </button>
        </div>

        <div className="card space-y-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">昵称</label>
            <input
              className="input-field"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="输入你的昵称"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">头像</label>
            <div className="flex gap-3">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                    selectedAvatar === avatar
                      ? 'bg-game-accent scale-110 ring-2 ring-game-accent'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {AVATAR_EMOJIS[avatar]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">设备ID</label>
            <p className="text-sm text-slate-500 font-mono bg-slate-800 p-2 rounded">
              {store.playerId}
            </p>
          </div>

          <div className="border-t border-game-border pt-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3">数据管理</h3>
            <button onClick={handleClearStats} className="btn-danger text-sm">
              清除本地战绩
            </button>
          </div>

          <button onClick={handleSave} className="btn-primary w-full">
            {saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}
