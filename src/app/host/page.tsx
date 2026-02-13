"use client";

import { useEffect, useState, useCallback } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import type { ClientGameState } from "@/lib/game-state";
import PlayerList from "@/components/PlayerList";
import GameBoard from "@/components/GameBoard";
import FinalReveal from "@/components/FinalReveal";
import { useRef } from "react";
import {
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Zap,
  AlertTriangle,
  Award,
  TimerOff,
  Type,
  ImagePlus,
} from "lucide-react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type HostGameState = ClientGameState & { targetPhrase?: string };

async function gameAction(body: Record<string, unknown>) {
  const res = await fetch("/api/game/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function HostPage() {
  const [gameState, setGameState] = useState<HostGameState | null>(null);
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [phraseInput, setPhraseInput] = useState("");

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("game-channel");

    channel.bind("game-update", (data: ClientGameState) => {
      setGameState((prev) => ({
        ...data,
        targetPhrase: (prev as HostGameState)?.targetPhrase ?? "",
      }));
    });

    gameAction({ action: "get_host_state" }).then((res) => {
      if (res.state) {
        const state = res.state as HostGameState;
        setGameState(state);
        setPhraseInput(state.targetPhrase ?? "");
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("game-channel");
    };
  }, []);

  const handleStart = useCallback(async () => {
    await gameAction({ action: "start" });
  }, []);

  const handleUnbuzz = useCallback(async () => {
    await gameAction({ action: "clear_buzzer" });
  }, []);

  const handleClearCooldown = useCallback(async () => {
    await gameAction({ action: "clear_cooldown" });
  }, []);

  const handleRemovePlayer = useCallback(async (playerId: string) => {
    await gameAction({ action: "remove_player", playerId });
  }, []);

  const handleRevealLetter = useCallback(async (letter: string) => {
    await gameAction({ action: "reveal_letter", letter });
  }, []);

  const handleReveal = useCallback(async () => {
    if (!confirmReveal) {
      setConfirmReveal(true);
      setTimeout(() => setConfirmReveal(false), 5000);
      return;
    }
    await gameAction({ action: "reveal" });
    setConfirmReveal(false);
  }, [confirmReveal]);

  const handleReset = useCallback(async () => {
    await gameAction({ action: "reset" });
  }, []);

  const handleSetSkipTurn = useCallback(async (enabled: boolean) => {
    await gameAction({ action: "set_skip_turn", skipTurnAfterGuess: enabled });
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const res = await gameAction({
          action: "set_winner_photo",
          winnerPhotoDataUrl: dataUrl,
        });
        if (res.ok) {
          setGameState((prev) =>
            prev ? { ...prev, winnerPhotoDataUrl: dataUrl } : prev
          );
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const handleSetPhrase = useCallback(async () => {
    const res = await gameAction({ action: "set_phrase", phrase: phraseInput });
    if (res.ok) {
      setGameState((prev) =>
        prev ? { ...prev, targetPhrase: phraseInput.toUpperCase() } : prev
      );
    }
  }, [phraseInput]);

  if (gameState?.status === "revealed") {
    return (
      <div className="relative">
        <FinalReveal
          fullName={gameState.maskedPhrase}
          winnerPhotoSrc={gameState.winnerPhotoDataUrl || undefined}
        />
        <div className="fixed bottom-8 right-8 z-[100]">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 rounded-xl text-slate-300 font-medium transition-all hover:scale-105 backdrop-blur shadow-2xl"
          >
            <RotateCcw className="w-5 h-5" />
            Reset Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-400 mb-2">
            Host Dashboard
          </h1>
          <p className="text-slate-500">
            Control the game from here. Players won&apos;t see this page.
          </p>
        </div>

        <div className="mb-8 space-y-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <Award className="w-5 h-5" />
              <span className="font-medium">Unicorn Name</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                onBlur={handleSetPhrase}
                onKeyDown={(e) => e.key === "Enter" && handleSetPhrase()}
                disabled={gameState?.status !== "waiting"}
                placeholder="e.g. Mark Smith"
                className="flex-1 px-4 py-2.5 bg-slate-900/80 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {gameState?.status === "waiting" && (
                <button
                  onClick={handleSetPhrase}
                  className="px-4 py-2.5 bg-amber-500/80 hover:bg-amber-500 text-slate-900 font-medium rounded-xl transition-colors"
                >
                  Save
                </button>
              )}
            </div>
            {gameState?.status !== "waiting" && (
              <p className="text-xs text-slate-500 mt-2">
                Phrase is locked after game starts. Reset to change.
              </p>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5 max-w-md mx-auto">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <ImagePlus className="w-5 h-5" />
              <span className="font-medium">Unicorn Photo</span>
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {gameState?.winnerPhotoDataUrl ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-600 shrink-0">
                    <img
                      src={gameState.winnerPhotoDataUrl}
                      alt="Winner preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Change photo
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors border border-slate-600 border-dashed"
                >
                  <ImagePlus className="w-5 h-5" />
                  Upload photo
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5 max-w-md mx-auto">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-slate-300">Skip turn after guess</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When on, the player who just guessed must wait for someone else to buzz first
                </p>
              </div>
              <button
                onClick={() =>
                  handleSetSkipTurn(!(gameState?.skipTurnAfterGuess ?? true))
                }
                className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
                  gameState?.skipTurnAfterGuess !== false
                    ? "bg-emerald-600"
                    : "bg-slate-600"
                }`}
                role="switch"
                aria-checked={gameState?.skipTurnAfterGuess !== false}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    gameState?.skipTurnAfterGuess !== false
                      ? "left-7"
                      : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-8">
          <div
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-sm uppercase tracking-wider border ${
              !gameState || gameState.status === "waiting"
                ? "bg-slate-700/50 border-slate-600 text-slate-300"
                : gameState.status === "active"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-amber-500/20 border-amber-500/40 text-amber-300"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                !gameState || gameState.status === "waiting"
                  ? "bg-slate-400"
                  : gameState.status === "active"
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400"
              }`}
            />
            {gameState?.status ?? "waiting"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                Players ({gameState?.players.length ?? 0})
              </span>
            </div>
            <PlayerList
              players={gameState?.players ?? []}
              buzzedPlayerId={gameState?.buzzedPlayerId ?? null}
              onUnbuzz={handleUnbuzz}
              onRemovePlayer={handleRemovePlayer}
            />
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 min-w-0">
            <h3 className="text-slate-400 font-medium mb-4 text-center">
              Board Preview
            </h3>
            {gameState ? (
              <div className="max-w-4xl mx-auto">
                <GameBoard maskedPhrase={gameState.maskedPhrase} />
              </div>
            ) : (
              <div className="text-center text-slate-600 py-12">
                Game not started
              </div>
            )}

            {gameState && gameState.guessedLetters.length > 0 && (
              <div className="mt-4 text-center">
                <span className="text-slate-500 text-sm">Guessed: </span>
                <span className="text-slate-300 font-mono tracking-wider">
                  {gameState.guessedLetters.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-slate-400 font-medium mb-6 text-center">
            Game Controls
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleStart}
              disabled={gameState?.status === "active"}
              className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all duration-200 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:hover:shadow-none disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              Start Game
            </button>

            <button
              onClick={handleUnbuzz}
              disabled={!gameState?.buzzedPlayerId}
              className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all duration-200 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:hover:shadow-none disabled:cursor-not-allowed"
              title="Remove current player from the floor so others can buzz"
            >
              <Zap className="w-5 h-5" />
              Unbuzz
            </button>

            <button
              onClick={handleClearCooldown}
              disabled={!gameState?.lastGuesserId}
              className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:cursor-not-allowed"
              title="Let the last guesser buzz again (for 2-player games)"
            >
              <TimerOff className="w-5 h-5" />
              Clear Cooldown
            </button>

            {(gameState?.status === "active" &&
              gameState.guessedLetters.length < 26) && (
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const letter = e.target.value;
                    if (letter) handleRevealLetter(letter);
                    e.target.value = "";
                  }}
                  className="px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/50 cursor-pointer"
                  title="Manually reveal a letter if game is stuck"
                >
                  <option value="">Reveal letter…</option>
                  {LETTERS.filter((l) => !gameState.guessedLetters.includes(l)).map(
                    (l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    )
                  )}
                </select>
                <Type className="w-5 h-5 text-slate-400" />
              </div>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 border border-slate-600"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </button>

            <button
              onClick={handleReveal}
              className={`flex items-center gap-2 px-8 py-3 font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
                confirmReveal
                  ? "bg-linear-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse"
                  : "bg-linear-to-r from-amber-500 via-purple-500 to-pink-500 hover:from-amber-400 hover:via-purple-400 hover:to-pink-400 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)]"
              }`}
            >
              {confirmReveal ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  Click Again to Confirm
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Reveal Unicorn
                  <Sparkles className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {gameState?.buzzedPlayerId && (
            <div className="mt-6 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-5 py-3 bg-amber-500/20 border border-amber-400/40 rounded-xl text-amber-300 font-medium">
                <Zap className="w-5 h-5 animate-pulse" />
                <span>
                  <strong>
                    {gameState.players.find(
                      (p) => p.id === gameState.buzzedPlayerId
                    )?.name ?? "Unknown"}
                  </strong>{" "}
                  has the floor — waiting for their letter guess.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
