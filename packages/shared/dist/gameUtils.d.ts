import type { Difficulty, WordType, WordItem } from './types';
export { ALL_WORDS_BY_DIFFICULTY, WORDS_EN_EASY, WORDS_EN_MEDIUM, WORDS_EN_HARD, WORDS_EN_MASTER, WORDS_ZH_EASY, WORDS_ZH_MEDIUM, WORDS_ZH_HARD, WORDS_ZH_MASTER } from './words';
export declare function getRandomWord(difficulty: Difficulty, wordType?: WordType): string;
export declare function generateWordItem(difficulty: Difficulty, wordType: WordType | undefined, countdown: number): WordItem;
export declare function generateWordBatch(difficulty: Difficulty, count: number, wordType: WordType | undefined, countdown: number): WordItem[];
export declare function checkInput(word: WordItem, input: string): boolean;
//# sourceMappingURL=gameUtils.d.ts.map