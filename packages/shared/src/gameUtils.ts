import type { Difficulty, WordType, WordItem } from './types';
import { ALL_WORDS_BY_DIFFICULTY } from './words';

export { ALL_WORDS_BY_DIFFICULTY, WORDS_EN_EASY, WORDS_EN_MEDIUM, WORDS_EN_HARD, WORDS_EN_MASTER, WORDS_ZH_EASY, WORDS_ZH_MEDIUM, WORDS_ZH_HARD, WORDS_ZH_MASTER } from './words';

let wordCounter = 0;

export function getRandomWord(difficulty: Difficulty, wordType: WordType = 'en'): string {
  const pool = ALL_WORDS_BY_DIFFICULTY[difficulty][wordType];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateWordItem(difficulty: Difficulty, wordType: WordType = 'en', countdown: number): WordItem {
  const text = getRandomWord(difficulty, wordType);
  wordCounter++;
  return {
    id: `word_${Date.now()}_${wordCounter}`,
    text,
    type: wordType,
    length: text.length,
    appearedAt: Date.now(),
    countdown,
  };
}

export function generateWordBatch(difficulty: Difficulty, count: number, wordType: WordType = 'en', countdown: number): WordItem[] {
  return Array.from({ length: count }, () => generateWordItem(difficulty, wordType, countdown));
}

export function checkInput(word: WordItem, input: string): boolean {
  return word.text === input.trim();
}
