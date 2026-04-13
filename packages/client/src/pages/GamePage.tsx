import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { DIFFICULTY_CONFIGS, GAME_MODE_CONFIGS } from '@typematch/shared';
import VirtualKeyboard from '../components/VirtualKeyboard';

export default function GamePage() {
  const store = useGameStore();
  const ws = useWebSocket();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [comboDisplay, setComboDisplay] = useState(0);

  const room = store.room;
  const myPlayer = room?.players.find(p => p.id === store.playerId);
  const activeWords = store.activeWords;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (store.gameCountdown > 0) return;
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [store.gameCountdown]);

  /**
   * 计算当前需要输入的下一个字符
   */
  const targetChar = useMemo(() => {
    if (!selectedWordId || !activeWords.length) return null;
    const targetWord = activeWords.find(w => w.id === selectedWordId);
    if (!targetWord) return null;
    const nextCharIndex = inputValue.length;
    if (nextCharIndex >= targetWord.text.length) return null;
    return targetWord.text[nextCharIndex];
  }, [selectedWordId, activeWords, inputValue]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (!selectedWordId && activeWords.length > 0) {
      const matchingWord = activeWords.find(w => w.text.startsWith(value));
      if (matchingWord) {
        setSelectedWordId(matchingWord.id);
      }
    }

    if (selectedWordId) {
      const targetWord = activeWords.find(w => w.id === selectedWordId);
      if (targetWord && value === targetWord.text) {
        ws.sendInput(selectedWordId, value);
        setInputValue('');
        setSelectedWordId(null);
        setFeedback({ type: 'success', text: '正确!' });
        if (myPlayer) {
          setComboDisplay(myPlayer.combo + 1);
        }
        setTimeout(() => setFeedback(null), 500);
      }
    }
  }, [selectedWordId, activeWords, ws, myPlayer]);

  const handleWordClick = useCallback((wordId: string) => {
    setSelectedWordId(wordId);
    setInputValue('');
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSelectedWordId(null);
      setInputValue('');
    }
    if (e.key === 'Tab' && activeWords.length > 0) {
      e.preventDefault();
      const currentIndex = selectedWordId
        ? activeWords.findIndex(w => w.id === selectedWordId)
        : -1;
      const nextIndex = (currentIndex + 1) % activeWords.length;
      setSelectedWordId(activeWords[nextIndex].id);
      setInputValue('');
    }
  }, [selectedWordId, activeWords]);

  /**
   * 退出游戏
   */
  const handleExitGame = useCallback(() => {
    ws.disconnect();
    store.setRoom(null);
    store.setIsHost(false);
    store.clearChatMessages();
    store.resetGame();
    store.setPage('lobby');
  }, [ws, store]);

  if (store.gameCountdown > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-bounce-in">
          <div className="text-9xl font-bold text-game-accent mb-4">{store.gameCountdown}</div>
          <p className="text-2xl text-slate-400">游戏即将开始</p>
        </div>
      </div>
    );
  }

  if (!room) return null;

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen p-4 flex flex-col" onKeyDown={handleKeyDown}>
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* 顶部信息栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {DIFFICULTY_CONFIGS[room.difficulty].label} · {GAME_MODE_CONFIGS[room.gameMode].label}
            </span>
            {myPlayer && (
              <div className="flex items-center gap-3">
                <span className="text-game-warning font-bold">
                  ⚡ {myPlayer.score} 分
                </span>
                <span className="text-game-accent">
                  🎯 {(myPlayer.accuracy * 100).toFixed(1)}%
                </span>
                <span className="text-game-success">
                  ⌨️ {myPlayer.wpm} WPM
                </span>
                {comboDisplay > 0 && (
                  <span className="text-primary-400 animate-pulse-fast">
                    🔥 {comboDisplay} 连击
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleExitGame}
            className="btn-danger text-sm"
          >
            退出游戏
          </button>
        </div>

        <div className="flex-1 flex gap-4">
          {/* 左侧排名 */}
          <div className="w-56 shrink-0">
            <div className="card h-full">
              <h3 className="text-sm font-bold text-game-accent mb-3">实时排名</h3>
              <div className="space-y-2">
                {sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      player.id === store.playerId ? 'bg-primary-900/30' : 'bg-slate-800/50'
                    }`}
                  >
                    <span className={`font-bold w-5 ${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-slate-300' :
                      index === 2 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-white">{player.nickname}</span>
                    <span className="text-game-warning font-mono">{player.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 中间游戏区域 */}
          <div className="flex-1 flex flex-col">
            {/* 反馈提示 */}
            {feedback && (
              <div className={`text-center py-2 mb-2 rounded-lg font-bold animate-slide-up ${
                feedback.type === 'success'
                  ? 'bg-game-success/20 text-game-success'
                  : 'bg-game-danger/20 text-game-danger'
              }`}>
                {feedback.text}
              </div>
            )}

            {/* 单词区域 */}
            <div className="card flex-1 flex flex-wrap gap-3 content-start overflow-y-auto">
              {activeWords.length === 0 ? (
                <div className="w-full flex items-center justify-center text-slate-500">
                  等待词块出现...
                </div>
              ) : (
                activeWords.map((word) => {
                  const isSelected = word.id === selectedWordId;
                  const matchPrefix = isSelected && inputValue
                    ? word.text.startsWith(inputValue)
                    : true;

                  return (
                    <button
                      key={word.id}
                      onClick={() => handleWordClick(word.id)}
                      className={`px-4 py-3 rounded-lg font-mono text-lg transition-all ${
                        isSelected
                          ? matchPrefix
                            ? 'bg-game-accent text-game-bg scale-110 shadow-lg shadow-game-accent/30'
                            : 'bg-game-danger text-white scale-110'
                          : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                      }`}
                    >
                      {isSelected && inputValue ? (
                        <>
                          <span className="text-game-bg font-bold">{inputValue}</span>
                          <span>{word.text.slice(inputValue.length)}</span>
                        </>
                      ) : (
                        word.text
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 输入区域 */}
            <div className="mt-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  className="w-full px-6 py-4 bg-slate-800 border-2 border-game-border rounded-xl text-xl font-mono text-white placeholder-slate-500 focus:border-game-accent transition-colors"
                  placeholder={selectedWordId ? '输入选中的单词...' : '输入单词或点击选择...'}
                  value={inputValue}
                  onChange={handleInputChange}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {selectedWordId && (
                  <button
                    onClick={() => { setSelectedWordId(null); setInputValue(''); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                点击单词选择目标 · Tab 切换目标 · Esc 取消选择
              </p>
            </div>

            {/* 虚拟键盘 */}
            <div className="mt-4">
              <VirtualKeyboard targetChar={targetChar} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
