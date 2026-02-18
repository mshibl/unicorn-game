"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { getPusherClient } from "@/lib/pusher-client";
import type { ClientGameState } from "@/lib/game-state";
import GameBoard from "@/components/GameBoard";
import Alphabet from "@/components/Alphabet";
import PlayerList from "@/components/PlayerList";
import BuzzerButton from "@/components/BuzzerButton";
import FinalReveal from "@/components/FinalReveal";
import { Users, Loader2, LogIn } from "lucide-react";

async function gameAction(body: Record<string, unknown>) {
  const res = await fetch("/api/game/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const LETTERS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

export default function PlayerPage() {
  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [buzzerFlash, setBuzzerFlash] = useState(false);
  const [joining, setJoining] = useState(false);
  const playerIdRef = useRef<string | null>(null);
  const buzzerSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let id = sessionStorage.getItem("playerId");
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem("playerId", id);
    }
    setPlayerId(id);
    playerIdRef.current = id;
  }, []);

  useEffect(() => {
    const buzzer = new Audio(
      process.env.NEXT_PUBLIC_BUZZER_SOUND_URL || "/buzzer-sound.mp3"
    );
    buzzer.volume = 0.8;
    buzzerSoundRef.current = buzzer;
    return () => {
      buzzerSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("game-channel");

    channel.bind("game-update", (data: ClientGameState) => {
      setGameState(data);
    });

    channel.bind("buzz-event", () => {
      setBuzzerFlash(true);
      setTimeout(() => setBuzzerFlash(false), 600);
    });

    gameAction({ action: "get_state" }).then((res) => {
      if (res.state) setGameState(res.state);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("game-channel");
    };
  }, []);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim() || !playerId) return;
    setJoining(true);
    const res = await gameAction({
      action: "join",
      playerId,
      playerName: playerName.trim(),
    });
    if (res.ok) {
      setJoined(true);
      sessionStorage.setItem("playerName", playerName.trim());
      if (res.state) setGameState(res.state);
    }
    setJoining(false);
  }, [playerName, playerId]);

  useEffect(() => {
    const savedName = sessionStorage.getItem("playerName");
    if (savedName && playerId) {
      setPlayerName(savedName);
      // Auto-rejoin: check if player is in game, if not, rejoin them
      gameAction({ action: "get_state" }).then((res) => {
        if (res.state) {
          const isInGame = res.state.players.some(
            (p: { id: string }) => p.id === playerId
          );
          if (isInGame) {
            // Player is already in game, just restore their state
            setJoined(true);
            setGameState(res.state);
          } else {
            // Player not in game (e.g., server restart), rejoin them automatically
            gameAction({
              action: "join",
              playerId,
              playerName: savedName.trim(),
            }).then((joinRes) => {
              if (joinRes.ok) {
                setJoined(true);
                if (joinRes.state) setGameState(joinRes.state);
              }
            });
          }
        }
      });
    }
  }, [playerId]);

  // Remove player when they leave the page
  useEffect(() => {
    if (!joined || !playerIdRef.current) return;

    const removePlayer = () => {
      // Use sendBeacon for reliable delivery during page unload
      const data = JSON.stringify({
        action: "remove_player",
        playerId: playerIdRef.current,
      });
      navigator.sendBeacon(
        "/api/game/action",
        new Blob([data], { type: "application/json" })
      );
    };

    // Use beforeunload for page navigation/close
    window.addEventListener("beforeunload", removePlayer);

    return () => {
      window.removeEventListener("beforeunload", removePlayer);
      // Also try to remove on component unmount (e.g., React navigation)
      if (playerIdRef.current) {
        removePlayer();
      }
    };
  }, [joined]);

  // Spacebar buzzer
  useEffect(() => {
    if (!joined || !gameState || gameState.status !== "active") return;
    const skipTurn = gameState.skipTurnAfterGuess !== false;
    const iAmOnCooldown = skipTurn && gameState.lastGuesserId === playerIdRef.current;
    if (iAmOnCooldown || gameState.buzzersPaused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && gameState.buzzedPlayerId === null) {
        e.preventDefault();
        const buzzer = buzzerSoundRef.current;
        if (buzzer) {
          buzzer.currentTime = 0;
          buzzer.play().catch(() => {});
        }
        gameAction({ action: "buzz", playerId: playerIdRef.current });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [joined, gameState]);

  // Keyboard letter selection (when it's your turn to guess)
  useEffect(() => {
    if (!joined || !gameState || gameState.status !== "active") return;
    const iAmBuzzed = gameState.buzzedPlayerId === playerIdRef.current;
    if (!iAmBuzzed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (LETTERS.has(key) && !gameState.guessedLetters.includes(key)) {
        e.preventDefault();
        gameAction({
          action: "guess_letter",
          letter: key,
          playerId: playerIdRef.current,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [joined, gameState]);

  const handleGuess = useCallback(
    async (letter: string) => {
      await gameAction({
        action: "guess_letter",
        letter,
        playerId: playerIdRef.current,
      });
    },
    []
  );

  const handleBuzz = useCallback(async () => {
    if (!gameState || gameState.buzzedPlayerId !== null) return;
    const skipTurn = gameState.skipTurnAfterGuess !== false;
    if (skipTurn && gameState.lastGuesserId === playerIdRef.current) return;
    if (gameState.buzzersPaused) return;
    // Play buzzer sound immediately on click (user interaction unlocks audio)
    const buzzer = buzzerSoundRef.current;
    if (buzzer) {
      buzzer.currentTime = 0;
      buzzer.play().catch(() => {});
    }
    await gameAction({ action: "buzz", playerId: playerIdRef.current });
  }, [gameState]);

  if (gameState?.status === "revealed") {
    return (
      <FinalReveal
        fullName={gameState.maskedPhrase}
        winnerPhotoSrc={gameState.winnerPhotoDataUrl || undefined}
      />
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-300 to-emerald-400 mb-3">
              Guess The Unicorn Name
            </h1>
            <p className="text-slate-400 text-lg">
              Enter your name to join the game
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
            <div className="space-y-4">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Your Name"
                maxLength={20}
                className="w-full px-5 py-4 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-500 text-lg focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all"
                autoFocus
              />
              <button
                onClick={handleJoin}
                disabled={!playerName.trim() || joining}
                className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-slate-900 disabled:cursor-not-allowed font-bold text-lg rounded-xl transition-all duration-200 hover:shadow-[0_0_30px_rgba(251,191,36,0.3)] disabled:shadow-none"
              >
                {joining ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {joining ? "Joining..." : "Join Game"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gameState || gameState.status === "waiting") {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        {gameState?.showDancingUnicorn && (
          <div
            className="fixed bottom-6 left-0 right-0 h-16 pointer-events-none z-40 overflow-hidden"
            aria-hidden
          >
            <img
              src="/dancing-unicorn.gif"
              alt=""
              className="absolute h-14 w-auto object-contain"
              style={{ animation: "unicorn-stroll 35s linear infinite" }}
            />
          </div>
        )}
        <div className="w-full max-w-lg text-center">
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-300 to-emerald-400 mb-6">
              Guess The Unicorn Name
            </h1>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium mb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Connected
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Waiting Room</h2>
            <p className="text-slate-400 text-lg">
              Hang tight — the host will start the game shortly.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                Players ({gameState?.players.length ?? 0})
              </span>
            </div>
            <PlayerList
              players={gameState?.players ?? []}
              buzzedPlayerId={null}
              currentPlayerId={playerId ?? undefined}
              teamMode={gameState?.teamMode ?? false}
              teamAssignments={gameState?.teamAssignments ?? {}}
            />
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Waiting for host...</span>
          </div>
        </div>
      </div>
    );
  }

  const iAmBuzzed = gameState.buzzedPlayerId === playerId;
  const someoneElseBuzzed = gameState.buzzedPlayerId !== null && !iAmBuzzed;
  const skipTurn = gameState.skipTurnAfterGuess !== false;
  const iAmOnCooldown = skipTurn && gameState.lastGuesserId === playerId;
  const canBuzz =
    gameState.status === "active" &&
    gameState.buzzedPlayerId === null &&
    !iAmOnCooldown &&
    !gameState.buzzersPaused;

  const cooldownReason = iAmOnCooldown
    ? "You just guessed — another player must buzz first this round."
    : gameState.buzzersPaused
    ? "Buzzers are paused — wait for host to enable them"
    : undefined;

  return (
    <div
      className={`min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 transition-all duration-300 ${
        buzzerFlash ? "ring-4 ring-inset ring-amber-400/30" : ""
      }`}
    >
      {gameState.showDancingUnicorn && (
        <div
          className="fixed bottom-6 left-0 right-0 h-16 pointer-events-none z-40 overflow-hidden"
          aria-hidden
        >
          <img
            src="/dancing-unicorn.gif"
            alt=""
            className="absolute h-14 w-auto object-contain"
            style={{ animation: "unicorn-stroll 35s linear infinite" }}
          />
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6 min-h-screen">
        {/* ── Left: Players ───────────────────────────────────────── */}
        <aside className="w-64 shrink-0">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5 sticky top-6">
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                Players ({gameState.players.length})
              </span>
            </div>
            <PlayerList
              players={gameState.players}
              buzzedPlayerId={gameState.buzzedPlayerId}
              currentPlayerId={playerId ?? undefined}
              teamMode={gameState.teamMode ?? false}
              teamAssignments={gameState.teamAssignments ?? {}}
            />
          </div>
        </aside>

        {/* ── Center: Board + Buzzer ───────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center gap-6 min-w-0">
          <div className="w-full flex items-center justify-center min-h-[3.5rem]">
            {someoneElseBuzzed && (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 font-medium animate-pulse">
                <span className="text-lg">⚡</span>
                {gameState.players.find(
                  (p) => p.id === gameState.buzzedPlayerId
                )?.name ?? "Someone"}{" "}
                is guessing...
              </div>
            )}
            {iAmBuzzed && (
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-emerald-300 font-bold animate-bounce">
                <span className="text-lg">🎯</span>
                Pick a letter! (keyboard or click)
              </div>
            )}
          </div>

          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-300 to-emerald-400 text-center">
            Guess The Unicorn Name
          </h1>

          <div className="w-full max-w-3xl">
            <GameBoard maskedPhrase={gameState.maskedPhrase} />
          </div>

          <BuzzerButton
            canBuzz={canBuzz}
            hasBuzzed={iAmBuzzed}
            onBuzz={handleBuzz}
            cooldownReason={cooldownReason}
          />
        </main>

        {/* ── Right: Alphabet (3 columns) ────────────────────────────── */}
        <aside className="w-36 shrink-0 flex flex-col items-center py-6">
          <span className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
            Letters
          </span>
          <Alphabet
            guessedLetters={gameState.guessedLetters}
            canGuess={iAmBuzzed}
            onGuess={handleGuess}
          />
        </aside>
      </div>
    </div>
  );
}
