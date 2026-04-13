import { useState, useEffect, useCallback, useMemo } from 'react';

interface VirtualKeyboardProps {
  targetChar: string | null;
  onKeyPress?: (key: string) => void;
}

interface KeyState {
  isPressed: boolean;
  isTarget: boolean;
}

type KeyLayout = string[][];

const KEYBOARD_LAYOUT: KeyLayout = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Alt', 'Space', 'Alt', 'Ctrl'],
];

const KEY_WIDTHS: Record<string, string> = {
  Backspace: 'w-20',
  Tab: 'w-14',
  '\\': 'w-14',
  Caps: 'w-16',
  Enter: 'w-20',
  Shift: 'w-24',
  Ctrl: 'w-14',
  Alt: 'w-12',
  Space: 'w-80',
};

const KEY_DISPLAY: Record<string, string> = {
  Backspace: '⌫',
  Tab: 'Tab',
  Caps: 'Caps',
  Enter: 'Enter',
  Shift: 'Shift',
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Space: 'Space',
  '`': '`',
  '\\': '\\',
};

/**
 * 虚拟键盘组件
 * 显示标准QWERTY键盘布局，支持按键高亮和反馈动画
 */
export default function VirtualKeyboard({ targetChar, onKeyPress }: VirtualKeyboardProps) {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [keyStates, setKeyStates] = useState<Map<string, KeyState>>(new Map());

  const normalizedTargetChar = useMemo(() => {
    if (!targetChar) return null;
    const char = targetChar.toUpperCase();
    if (char === ' ') return 'Space';
    return char;
  }, [targetChar]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'Backspace' || key === 'Enter' || key === 'Tab' || key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'CapsLock') {
      if (key === 'CapsLock') key = 'Caps';
      else if (key === 'Control') key = 'Ctrl';
    }

    setPressedKeys(prev => new Set(prev).add(key));
    onKeyPress?.(key);

    setTimeout(() => {
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 150);
  }, [onKeyPress]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    let key = e.key;
    if (key === ' ') key = 'Space';
    else if (key.length === 1) key = key.toUpperCase();
    else if (key === 'CapsLock') key = 'Caps';
    else if (key === 'Control') key = 'Ctrl';
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const getKeyClass = useCallback((key: string): string => {
    const isPressed = pressedKeys.has(key);
    const isTarget = normalizedTargetChar === key;

    let baseClass = 'relative flex items-center justify-center rounded-lg font-mono text-sm transition-all duration-100 select-none';
    const widthClass = KEY_WIDTHS[key] || 'w-10';
    const heightClass = 'h-10';

    if (isTarget && !isPressed) {
      baseClass += ` ${widthClass} ${heightClass} bg-game-accent/30 border-2 border-game-accent text-game-accent shadow-lg shadow-game-accent/30 animate-pulse`;
    } else if (isPressed) {
      baseClass += ` ${widthClass} ${heightClass} bg-game-accent text-game-bg scale-95 shadow-inner`;
    } else {
      baseClass += ` ${widthClass} ${heightClass} bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600`;
    }

    return baseClass;
  }, [pressedKeys, normalizedTargetChar]);

  const getKeyDisplay = useCallback((key: string): string => {
    return KEY_DISPLAY[key] || key;
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
      <div className="flex flex-col gap-1.5">
        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1.5 justify-center">
            {row.map((key, keyIndex) => (
              <div
                key={`${rowIndex}-${keyIndex}`}
                className={getKeyClass(key)}
                role="button"
                aria-label={key}
              >
                <span className="pointer-events-none">{getKeyDisplay(key)}</span>
                {normalizedTargetChar === key && !pressedKeys.has(key) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-game-accent rounded-full animate-ping" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 text-center text-xs text-slate-500">
        高亮按键为下一个需要输入的字符
      </div>
    </div>
  );
}
