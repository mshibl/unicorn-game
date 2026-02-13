export interface Player {
  id: string;
  name: string;
}

export interface GameState {
  status: "waiting" | "active" | "revealed";
  players: Player[];
  buzzedPlayerId: string | null;
  lastGuesserId: string | null;
  guessedLetters: string[];
  targetPhrase: string;
  skipTurnAfterGuess: boolean;
  winnerPhotoDataUrl: string; // Base64 data URL from host upload
}

const gameState: GameState = {
  status: "waiting",
  players: [],
  buzzedPlayerId: null,
  lastGuesserId: null,
  guessedLetters: [],
  targetPhrase: "MARK SHIBLEY",
  skipTurnAfterGuess: true,
  winnerPhotoDataUrl: "",
};

export function getGameState(): GameState {
  return gameState;
}

export function resetGameState(): void {
  gameState.status = "waiting";
  gameState.players = [];
  gameState.buzzedPlayerId = null;
  gameState.lastGuesserId = null;
  gameState.guessedLetters = [];
}

export function getClientGameState() {
  return {
    status: gameState.status,
    players: gameState.players,
    buzzedPlayerId: gameState.buzzedPlayerId,
    lastGuesserId: gameState.lastGuesserId,
    guessedLetters: gameState.guessedLetters,
    skipTurnAfterGuess: gameState.skipTurnAfterGuess,
    winnerPhotoDataUrl: gameState.winnerPhotoDataUrl,
    phraseLength: gameState.targetPhrase.length,
    maskedPhrase: gameState.targetPhrase
      .split("")
      .map((ch) => {
        if (ch === " ") return " ";
        if (gameState.guessedLetters.includes(ch.toUpperCase())) return ch;
        if (gameState.status === "revealed") return ch;
        return "_";
      })
      .join(""),
  };
}

export type ClientGameState = ReturnType<typeof getClientGameState>;
