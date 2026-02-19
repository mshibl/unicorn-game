"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import type { ClientGameState } from "@/lib/game-state";
import PlayerList from "@/components/PlayerList";
import GameBoard from "@/components/GameBoard";
import {
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Zap,
  AlertTriangle,
  Award,
  Type,
  ImagePlus,
  Loader2,
  Pause,
  Music,
  Volume2,
} from "lucide-react";

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Local preview from the file we just read - bypasses CDN/browser cache when blob URL is overwritten
  const [localPreviewDataUrl, setLocalPreviewDataUrl] = useState<string | null>(null);
  const [localPhotoFileName, setLocalPhotoFileName] = useState<string | null>(null);

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


  const handleRemovePlayer = useCallback(async (playerId: string) => {
    await gameAction({ action: "remove_player", playerId });
  }, []);

  const handleRevealLetter = useCallback(async (letter?: string) => {
    const body: Record<string, unknown> = { action: "reveal_letter" };
    if (letter && /^[A-Z]$/i.test(letter)) {
      body.letter = letter.toUpperCase();
    }
    await gameAction(body);
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

  const handleSetTeamMode = useCallback(async (enabled: boolean) => {
    await gameAction({ action: "set_team_mode", teamMode: enabled });
  }, []);

  const handleSetDancingUnicorn = useCallback(async (enabled: boolean) => {
    await gameAction({ action: "set_dancing_unicorn", showDancingUnicorn: enabled });
  }, []);

  const handleToggleBuzzersPause = useCallback(async () => {
    await gameAction({ action: "toggle_buzzers_pause" });
  }, []);

  const handleSetWatchMode = useCallback(async (enabled: boolean) => {
    await gameAction({ action: "set_watch_mode", watchMode: enabled });
  }, []);

  const handleMusicPlay = useCallback(() => gameAction({ action: "music_play" }), []);
  const handleMusicPause = useCallback(() => gameAction({ action: "music_pause" }), []);
  const handleMusicReset = useCallback(() => gameAction({ action: "music_reset" }), []);

  // Auto re-enable buzzers 5 seconds after a letter is guessed
  const reenableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const reenableAt = gameState?.buzzersReenableAt;
    if (!gameState?.buzzersPaused || !reenableAt || gameState.status !== "active") {
      if (reenableTimerRef.current) {
        clearTimeout(reenableTimerRef.current);
        reenableTimerRef.current = null;
      }
      return;
    }
    const delay = Math.max(0, reenableAt - Date.now());
    reenableTimerRef.current = setTimeout(() => {
      gameAction({ action: "reenable_buzzers" });
      reenableTimerRef.current = null;
    }, delay);
    return () => {
      if (reenableTimerRef.current) {
        clearTimeout(reenableTimerRef.current);
        reenableTimerRef.current = null;
      }
    };
  }, [gameState?.buzzersPaused, gameState?.buzzersReenableAt, gameState?.status]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      setUploadingPhoto(true);
      setPhotoError(null);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const res = await gameAction({
            action: "set_winner_photo",
            winnerPhotoDataUrl: dataUrl,
          });
          if (res.ok) {
            // Use URL from response (blob URL in prod, data URL locally)
            const url = res.winnerPhotoDataUrl ?? dataUrl;
            setGameState((prev) =>
              prev ? { ...prev, winnerPhotoDataUrl: url } : prev
            );
            setLocalPreviewDataUrl(dataUrl);
            setLocalPhotoFileName(file.name);
          } else {
            setPhotoError(res.error ?? "Upload failed");
          }
        } catch {
          setPhotoError("Upload failed");
        } finally {
          setUploadingPhoto(false);
        }
      };
      reader.onerror = () => {
        setPhotoError("Failed to read file");
        setUploadingPhoto(false);
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

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 p-6">
      <div className="max-w-[1600px] mx-auto">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-300 to-emerald-400 text-center mb-6">
          Guess The Unicorn Name
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="text-center sm:text-left">
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-purple-400 to-pink-400 mb-2">
              Host Dashboard
            </h2>
            <p className="text-slate-500">
              Control the game from here. Players won&apos;t see this page.
            </p>
          </div>
          <div className="flex justify-center sm:justify-end shrink-0">
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
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
                  className="px-4 py-2.5 bg-amber-500/80 hover:bg-amber-500 text-slate-900 font-medium rounded-xl transition-colors shrink-0"
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

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
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
                disabled={uploadingPhoto}
              />
              {uploadingPhoto ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-600 shrink-0 flex items-center justify-center bg-slate-700/50">
                    <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
                  </div>
                  <span className="text-slate-500 text-sm">Uploading…</span>
                </div>
              ) : gameState?.winnerPhotoDataUrl ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-600 shrink-0 bg-slate-700/50">
                    <img
                      src={localPreviewDataUrl ?? gameState.winnerPhotoDataUrl}
                      alt="Winner preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    {localPhotoFileName && (
                      <span className="text-sm text-slate-400 truncate" title={localPhotoFileName}>
                        {localPhotoFileName}
                      </span>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors self-start"
                    >
                      Change photo
                    </button>
                  </div>
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
            {photoError && (
              <p className="mt-2 text-sm text-amber-400/90 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {photoError}
              </p>
            )}
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
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

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-300">Dancing Unicorn</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Show a small unicorn strolling along the bottom of the board
                </p>
              </div>
              <button
                onClick={() =>
                  handleSetDancingUnicorn(!(gameState?.showDancingUnicorn ?? false))
                }
                className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
                  gameState?.showDancingUnicorn
                    ? "bg-pink-500"
                    : "bg-slate-600"
                }`}
                role="switch"
                aria-checked={gameState?.showDancingUnicorn ?? false}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    gameState?.showDancingUnicorn ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-300 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-slate-400" />
                  Watch Mode Audio
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  When on, music &amp; sound effects only play on the watch page
                </p>
              </div>
              <button
                onClick={() =>
                  handleSetWatchMode(!(gameState?.watchMode ?? true))
                }
                className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
                  gameState?.watchMode !== false
                    ? "bg-emerald-600"
                    : "bg-slate-600"
                }`}
                role="switch"
                aria-checked={gameState?.watchMode !== false}
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    gameState?.watchMode !== false
                      ? "left-7"
                      : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-3">
              <Music className="w-5 h-5" />
              <span className="font-medium">Watch Page Music</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Control background music on the watch screen
            </p>
            <div className="flex flex-wrap gap-2">
              {gameState?.musicPlaying ? (
                <button
                  onClick={handleMusicPause}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                  title="Pause music"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              ) : (
                <button
                  onClick={handleMusicPlay}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                  title="Start or resume music"
                >
                  <Play className="w-4 h-4" />
                  Play
                </button>
              )}
              <button
                onClick={handleMusicReset}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500/80 text-white text-sm font-medium rounded-lg transition-colors"
                title="Restart music from beginning"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-300">Team Mode</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Divide players into Blue and Red teams. Teams are auto-assigned when game starts.
                </p>
              </div>
              <button
                onClick={() =>
                  handleSetTeamMode(!(gameState?.teamMode ?? false))
                }
                disabled={gameState?.status !== "waiting"}
                className={`relative shrink-0 w-14 h-8 rounded-full transition-colors ${
                  gameState?.teamMode
                    ? "bg-blue-600"
                    : "bg-slate-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                role="switch"
                aria-checked={gameState?.teamMode ?? false}
                title={
                  gameState?.status !== "waiting"
                    ? "Can only change team mode before game starts"
                    : undefined
                }
              >
                <span
                  className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    gameState?.teamMode ? "left-7" : "left-1"
                  }`}
                />
              </button>
            </div>
            {gameState?.teamMode && gameState.players.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-slate-400">
                      Blue:{" "}
                      {
                        gameState.players.filter(
                          (p) => gameState.teamAssignments?.[p.id] === "blue"
                        ).length
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-slate-400">
                      Red:{" "}
                      {
                        gameState.players.filter(
                          (p) => gameState.teamAssignments?.[p.id] === "red"
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 mb-6 lg:min-h-[calc(100vh-16rem)]">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 flex flex-col min-h-0 lg:min-h-[calc(100vh-16rem)]">
            <div className="flex items-center gap-2 text-slate-400 mb-4 shrink-0">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                Players ({gameState?.players.length ?? 0})
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <PlayerList
                players={gameState?.players ?? []}
                buzzedPlayerId={gameState?.buzzedPlayerId ?? null}
                teamMode={gameState?.teamMode ?? false}
                teamAssignments={gameState?.teamAssignments ?? {}}
                onUnbuzz={handleUnbuzz}
                onRemovePlayer={handleRemovePlayer}
              />
            </div>
          </div>

          <div className="flex flex-col min-w-0 gap-6">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 shrink-0">
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
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 border border-slate-600"
            >
              <RotateCcw className="w-5 h-5" />
              Reset
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
              onClick={handleToggleBuzzersPause}
              disabled={gameState?.status !== "active"}
              className={`flex items-center gap-2 px-6 py-3 font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:cursor-not-allowed ${
                gameState?.buzzersPaused
                  ? "bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                  : "bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white hover:shadow-[0_0_25px_rgba(251,146,60,0.3)] disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:hover:shadow-none"
              }`}
              title={
                gameState?.buzzersPaused
                  ? "Enable buzzers — players can buzz in again"
                  : "Pause buzzers — prevent players from buzzing in"
              }
            >
              {gameState?.buzzersPaused ? (
                <>
                  <Play className="w-5 h-5" />
                  Enable Buzzers
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5" />
                  Pause Buzzers
                </>
              )}
            </button>

            {(gameState?.status === "active" &&
              gameState.guessedLetters.length < 26) && (
              <button
                onClick={() => handleRevealLetter()}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-xl text-slate-300 font-bold transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                title="Reveal a random letter from the phrase"
              >
                <Type className="w-5 h-5" />
                Reveal Letter
              </button>
            )}

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

            <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-6 min-w-0 flex-1">
              <h3 className="text-slate-400 font-medium mb-4 text-center">
                Board Preview
                {gameState && gameState.status === "active" && (
                  <span className="block text-slate-500 text-sm font-normal mt-1">
                    Click a box to reveal that letter to everyone
                  </span>
                )}
              </h3>
              {gameState ? (
                <div className="max-w-4xl mx-auto">
                  <GameBoard
                    maskedPhrase={gameState.maskedPhrase}
                    targetPhrase={gameState.targetPhrase}
                    onBoxClick={
                      gameState?.status === "active"
                        ? handleRevealLetter
                        : undefined
                    }
                  />
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
        </div>
      </div>
    </div>
  );
}
