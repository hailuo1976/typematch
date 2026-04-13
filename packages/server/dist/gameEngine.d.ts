import type { RoomInfo, WordItem, GameResult, Player } from '@typematch/shared';
export declare class GameEngine {
    private room;
    private timers;
    private playerStates;
    private activeWords;
    private gameStartTime;
    private onWordGen;
    private onScoreUpdate;
    private onRankUpdate;
    private onGameEnd;
    private onCountdown;
    private onInputResult;
    constructor(room: RoomInfo, callbacks: {
        onWordGen: (words: WordItem[]) => void;
        onScoreUpdate: (players: Player[]) => void;
        onRankUpdate: (ranks: {
            playerId: string;
            rank: number;
            score: number;
        }[]) => void;
        onGameEnd: (results: GameResult[], reason: string) => void;
        onCountdown: (remaining: number) => void;
        onInputResult: (playerId: string, wordId: string, correct: boolean, score: number) => void;
    });
    start(): void;
    private startGameLoop;
    handleInput(playerId: string, wordId: string, input: string, inputTimestamp: number): void;
    handleTimeout(playerId: string, wordId: string): void;
    private checkWinCondition;
    private checkSurvivalEnd;
    private getRanks;
    private endGame;
    private generateResults;
    private cleanup;
    stop(): void;
    getActiveWords(): WordItem[];
}
//# sourceMappingURL=gameEngine.d.ts.map