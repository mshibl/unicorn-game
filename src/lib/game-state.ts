export interface Player {
  id: string;
  name: string;
}

export type Team = "blue" | "red";

export interface GameState {
  status: "waiting" | "active" | "revealed";
  players: Player[];
  buzzedPlayerId: string | null;
  lastGuesserId: string | null;
  guessedLetters: string[];
  targetPhrase: string;
  skipTurnAfterGuess: boolean;
  buzzersPaused: boolean;
  buzzersReenableAt: number | null; // timestamp when buzzers auto-enable (5s after letter guess)
  winnerPhotoDataUrl: string; // Base64 data URL from host upload
  teamMode: boolean;
  teamAssignments: Record<string, Team>; // playerId -> team
  showDancingUnicorn: boolean;
}

const gameState: GameState = {
  status: "waiting",
  players: [],
  buzzedPlayerId: null,
  lastGuesserId: null,
  guessedLetters: [],
  targetPhrase: "THE UNICORN",
  skipTurnAfterGuess: false,
  buzzersPaused: false,
  buzzersReenableAt: null,
  winnerPhotoDataUrl: "",
  teamMode: false,
  teamAssignments: {},
  showDancingUnicorn: true,
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
  gameState.buzzersPaused = false;
  gameState.buzzersReenableAt = null;
  gameState.teamAssignments = {};
  gameState.showDancingUnicorn = true;
}

export function assignTeams(): void {
  if (!gameState.teamMode || gameState.players.length < 2) {
    gameState.teamAssignments = {};
    return;
  }
  
  // Alternating assignment: first player -> blue, second -> red, third -> blue, etc.
  const assignments: Record<string, Team> = {};
  gameState.players.forEach((player, index) => {
    assignments[player.id] = index % 2 === 0 ? "blue" : "red";
  });
  gameState.teamAssignments = assignments;
}

export function getClientGameState() {
  return {
    status: gameState.status,
    players: gameState.players,
    buzzedPlayerId: gameState.buzzedPlayerId,
    lastGuesserId: gameState.lastGuesserId,
    guessedLetters: gameState.guessedLetters,
    skipTurnAfterGuess: gameState.skipTurnAfterGuess,
    buzzersPaused: gameState.buzzersPaused,
    buzzersReenableAt: gameState.buzzersReenableAt,
    winnerPhotoDataUrl: gameState.winnerPhotoDataUrl,
    teamMode: gameState.teamMode,
    teamAssignments: gameState.teamAssignments,
    showDancingUnicorn: gameState.showDancingUnicorn,
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
