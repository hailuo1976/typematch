"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpeedCoefficient = calculateSpeedCoefficient;
exports.calculateAccuracyCoefficient = calculateAccuracyCoefficient;
exports.calculateComboCoefficient = calculateComboCoefficient;
exports.calculateScore = calculateScore;
exports.getDifficultyMultiplier = getDifficultyMultiplier;
exports.applyWrongPenalty = applyWrongPenalty;
exports.applyTimeoutPenalty = applyTimeoutPenalty;
exports.applyConsecutiveWrongPenalty = applyConsecutiveWrongPenalty;
exports.shouldApplyConsecutiveWrongPenalty = shouldApplyConsecutiveWrongPenalty;
exports.updatePlayerAccuracy = updatePlayerAccuracy;
exports.calculateWpm = calculateWpm;
const constants_1 = require("./constants");
function calculateSpeedCoefficient(wordLength, actualTimeSeconds) {
    const standardTime = wordLength * constants_1.SPEED_STANDARD_TIME_PER_CHAR;
    const coefficient = standardTime / Math.max(actualTimeSeconds, 0.01);
    return Math.max(constants_1.MIN_SPEED_COEFFICIENT, Math.min(constants_1.MAX_SPEED_COEFFICIENT, coefficient));
}
function calculateAccuracyCoefficient(currentAccuracy) {
    if (currentAccuracy < 0.8)
        return constants_1.MIN_ACCURACY_COEFFICIENT;
    return 1 + (currentAccuracy - 0.8) * 0.5;
}
function calculateComboCoefficient(combo) {
    return 1 + Math.min(constants_1.MAX_COMBO_BONUS, combo / constants_1.COMBO_DIVISOR);
}
function calculateScore(difficulty, wordLength, actualTimeSeconds, currentAccuracy, combo) {
    const difficultyMultiplier = getDifficultyMultiplier(difficulty);
    const baseScore = constants_1.SCORE_BASE * difficultyMultiplier;
    const speedCoeff = calculateSpeedCoefficient(wordLength, actualTimeSeconds);
    const accuracyCoeff = calculateAccuracyCoefficient(currentAccuracy);
    const comboCoeff = calculateComboCoefficient(combo);
    return Math.round(baseScore * speedCoeff * accuracyCoeff * comboCoeff);
}
function getDifficultyMultiplier(difficulty) {
    const multipliers = {
        easy: 1.0,
        medium: 1.5,
        hard: 2.0,
        master: 3.0,
    };
    return multipliers[difficulty];
}
function applyWrongPenalty(player) {
    return constants_1.PENALTY_WRONG;
}
function applyTimeoutPenalty() {
    return constants_1.PENALTY_TIMEOUT;
}
function applyConsecutiveWrongPenalty() {
    return constants_1.PENALTY_CONSECUTIVE_WRONG;
}
function shouldApplyConsecutiveWrongPenalty(consecutiveWrong) {
    return consecutiveWrong >= constants_1.CONSECUTIVE_WRONG_THRESHOLD;
}
function updatePlayerAccuracy(player) {
    const total = player.correctCount + player.wrongCount;
    if (total === 0)
        return 1;
    return player.correctCount / total;
}
function calculateWpm(correctCount, elapsedSeconds) {
    if (elapsedSeconds <= 0)
        return 0;
    return Math.round((correctCount / elapsedSeconds) * 60);
}
//# sourceMappingURL=scoring.js.map