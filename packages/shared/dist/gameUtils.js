"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORDS_ZH_MASTER = exports.WORDS_ZH_HARD = exports.WORDS_ZH_MEDIUM = exports.WORDS_ZH_EASY = exports.WORDS_EN_MASTER = exports.WORDS_EN_HARD = exports.WORDS_EN_MEDIUM = exports.WORDS_EN_EASY = exports.ALL_WORDS_BY_DIFFICULTY = void 0;
exports.getRandomWord = getRandomWord;
exports.generateWordItem = generateWordItem;
exports.generateWordBatch = generateWordBatch;
exports.checkInput = checkInput;
const words_1 = require("./words");
var words_2 = require("./words");
Object.defineProperty(exports, "ALL_WORDS_BY_DIFFICULTY", { enumerable: true, get: function () { return words_2.ALL_WORDS_BY_DIFFICULTY; } });
Object.defineProperty(exports, "WORDS_EN_EASY", { enumerable: true, get: function () { return words_2.WORDS_EN_EASY; } });
Object.defineProperty(exports, "WORDS_EN_MEDIUM", { enumerable: true, get: function () { return words_2.WORDS_EN_MEDIUM; } });
Object.defineProperty(exports, "WORDS_EN_HARD", { enumerable: true, get: function () { return words_2.WORDS_EN_HARD; } });
Object.defineProperty(exports, "WORDS_EN_MASTER", { enumerable: true, get: function () { return words_2.WORDS_EN_MASTER; } });
Object.defineProperty(exports, "WORDS_ZH_EASY", { enumerable: true, get: function () { return words_2.WORDS_ZH_EASY; } });
Object.defineProperty(exports, "WORDS_ZH_MEDIUM", { enumerable: true, get: function () { return words_2.WORDS_ZH_MEDIUM; } });
Object.defineProperty(exports, "WORDS_ZH_HARD", { enumerable: true, get: function () { return words_2.WORDS_ZH_HARD; } });
Object.defineProperty(exports, "WORDS_ZH_MASTER", { enumerable: true, get: function () { return words_2.WORDS_ZH_MASTER; } });
let wordCounter = 0;
function getRandomWord(difficulty, wordType = 'en') {
    const pool = words_1.ALL_WORDS_BY_DIFFICULTY[difficulty][wordType];
    return pool[Math.floor(Math.random() * pool.length)];
}
function generateWordItem(difficulty, wordType = 'en', countdown) {
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
function generateWordBatch(difficulty, count, wordType = 'en', countdown) {
    return Array.from({ length: count }, () => generateWordItem(difficulty, wordType, countdown));
}
function checkInput(word, input) {
    return word.text === input.trim();
}
//# sourceMappingURL=gameUtils.js.map