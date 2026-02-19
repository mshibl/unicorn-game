"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import GameBoard from "@/components/GameBoard";
import Alphabet from "@/components/Alphabet";
import PlayerList from "@/components/PlayerList";
import FinalReveal from "@/components/FinalReveal";
import type { ClientGameState } from "@/lib/game-state";
import { Users, Loader2, Music, Pause, RotateCcw, Play } from "lucide-react";

async function musicAction(action: "music_play" | "music_pause" | "music_reset") {
  await fetch("/api/game/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

export default function WatchPage() {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [musicReady, setMusicReady] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicPlayingRef = useRef(false); // for audio "ended" fallback
  const buzzerSoundRef = useRef<HTMLAudioElement | null>(null);
  const correctChoiceSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongChoiceSoundRef = useRef<HTMLAudioElement | null>(null);
  const prevGuessedCountRef = useRef(0);
  const lastMusicResetRequestedAtRef = useRef<number | null>(null);

  const loadState = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_state" }),
      });
      const data = await res.json();
      if (data?.state) setGameState(data.state);
      else setError("No game data");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  }, []);

  // Auto re-enable buzzers 5 seconds after a letter is guessed (watch page keeps timer in sync)
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
    reenableTimerRef.current = setTimeout(async () => {
      await fetch("/api/game/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reenable_buzzers" }),
      });
      reenableTimerRef.current = null;
    }, delay);
    return () => {
      if (reenableTimerRef.current) {
        clearTimeout(reenableTimerRef.current);
        reenableTimerRef.current = null;
      }
    };
  }, [gameState?.buzzersPaused, gameState?.buzzersReenableAt, gameState?.status]);

  useEffect(() => {
    loadState();

    let client: { unsubscribe: (name: string) => void } | null = null;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2";

    if (key) {
      import("pusher-js").then((Pusher) => {
        const p = new Pusher.default(key, { cluster });
        client = p;
        const ch = p.subscribe("game-channel");
        ch.bind("game-update", (data: ClientGameState) => setGameState(data));
      });
    }

    return () => {
      if (client) client.unsubscribe("game-channel");
    };
  }, [loadState]);

  useEffect(() => {
    const audio = new Audio(
      process.env.NEXT_PUBLIC_GAME_SHOW_MUSIC_URL || "/game-show-music.mp3"
    );
    musicRef.current = audio;
    audio.loop = true;
    audio.volume = 0.1;
    audio.addEventListener("canplaythrough", () => setMusicReady(true));
    audio.addEventListener("error", () => setMusicReady(true));
    audio.addEventListener("ended", () => {
      // Ensure music restarts when it ends (backup to loop property)
      if (musicPlayingRef.current) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    });
    return () => {
      audio.pause();
      musicRef.current = null;
    };
  }, []);

  // Sync audio element with game state (from host or watch controls via Pusher)
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;

    const watchMode = gameState?.watchMode ?? true;
    const musicPlaying = gameState?.musicPlaying ?? false;
    const musicStarted = gameState?.musicStarted ?? false;
    const resetAt = gameState?.musicResetRequestedAt ?? null;

    musicPlayingRef.current = musicPlaying;

    if (!watchMode) {
      music.pause();
      return;
    }

    if (resetAt !== null && resetAt !== lastMusicResetRequestedAtRef.current) {
      lastMusicResetRequestedAtRef.current = resetAt;
      music.currentTime = 0;
      music.play().catch(() => {});
    } else if (musicStarted && musicPlaying) {
      music.play().catch(() => {});
    } else if (!musicPlaying) {
      music.pause();
    }
  }, [gameState?.watchMode, gameState?.musicPlaying, gameState?.musicStarted, gameState?.musicResetRequestedAt]);

  // Set up Media Session API for Mac media keys support (delegates to API for sync)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const mediaSession = navigator.mediaSession;
    mediaSession.metadata = new MediaMetadata({
      title: "Game Show Music",
      artist: "Background Music",
    });

    const handlePlay = () => musicAction("music_play");
    const handlePause = () => musicAction("music_pause");

    mediaSession.setActionHandler("play", handlePlay);
    mediaSession.setActionHandler("pause", handlePause);

    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
    };
  }, []);

  useEffect(() => {
    // Load buzzer sound effect
    const buzzerSound = new Audio(
      process.env.NEXT_PUBLIC_BUZZER_SOUND_URL || "/buzzer-sound.mp3"
    );
    buzzerSound.preload = "auto";
    buzzerSound.volume = 0.8;
    buzzerSound.addEventListener("error", (e) => {
      console.warn("Buzzer sound failed to load:", e);
    });
    buzzerSoundRef.current = buzzerSound;
    return () => {
      buzzerSound.pause();
      buzzerSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Load correct/wrong choice sounds
    const correctSound = new Audio(
      process.env.NEXT_PUBLIC_CORRECT_ANSWER_URL || "/correct-choice.mp3"
    );
    const wrongSound = new Audio(
      process.env.NEXT_PUBLIC_WRONG_ANSWER_URL || "/wrong-choice.mp3"
    );
    correctSound.volume = 0.8;
    wrongSound.volume = 0.4;
    correctChoiceSoundRef.current = correctSound;
    wrongChoiceSoundRef.current = wrongSound;
    return () => {
      correctSound.pause();
      wrongSound.pause();
      correctChoiceSoundRef.current = null;
      wrongChoiceSoundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const guessed = gameState?.guessedLetters ?? [];
    const masked = gameState?.maskedPhrase ?? "";
    const watchMode = gameState?.watchMode ?? true;
    const prevCount = prevGuessedCountRef.current;

    if (guessed.length === prevCount + 1) {
      const newLetter = guessed[guessed.length - 1]?.toUpperCase();
      prevGuessedCountRef.current = guessed.length;
      if (newLetter && watchMode) {
        const isCorrect = masked.toUpperCase().includes(newLetter);
        const sound = isCorrect ? correctChoiceSoundRef.current : wrongChoiceSoundRef.current;
        if (sound) {
          sound.currentTime = 0;
          sound.play().catch(() => {});
        }
      }
    } else {
      prevGuessedCountRef.current = guessed.length;
    }
  }, [gameState?.guessedLetters, gameState?.maskedPhrase, gameState?.watchMode]);

  // Keep Media Session playback state in sync with game state (for OS media controls)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const playing = gameState?.musicPlaying ?? false;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [gameState?.musicPlaying]);

  const watchMode = gameState?.watchMode ?? true;

  const startMusic = () => {
    if (!watchMode) return;
    const music = musicRef.current;
    if (music) {
      music.play().catch(() => {});
    }
    musicAction("music_play");
  };
  const pauseMusic = () => {
    musicRef.current?.pause();
    musicAction("music_pause");
  };
  const resumeMusic = () => {
    if (!watchMode) return;
    musicRef.current?.play().catch(() => {});
    musicAction("music_play");
  };
  const resetMusic = () => {
    if (!watchMode) return;
    const music = musicRef.current;
    if (music) {
      music.currentTime = 0;
      music.play().catch(() => {});
    }
    musicAction("music_reset");
  };

  useEffect(() => {
    if (gameState?.status === "revealed") musicRef.current?.pause();
  }, [gameState?.status]);

  useEffect(() => {
    const music = musicRef.current;
    const watchMode = gameState?.watchMode ?? true;
    if (!music) return;

    if (gameState?.buzzedPlayerId) {
      music.volume = 0.04;
      if (watchMode) {
        const buzzer = buzzerSoundRef.current;
        if (buzzer) {
          buzzer.currentTime = 0;
          buzzer.play().catch((e) => console.warn("Buzzer play failed:", e));
        }
      }
    } else {
      music.volume = 0.1;
    }
  }, [gameState?.buzzedPlayerId, gameState?.watchMode]);

  if (gameState?.status === "revealed") {
    return (
      <FinalReveal
        fullName={gameState.maskedPhrase}
        winnerPhotoSrc={gameState.winnerPhotoDataUrl}
      />
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 text-white p-6">
      {/* Dancing unicorn strolling along the bottom (board only, not on final reveal) */}
      {gameState?.showDancingUnicorn && (
        <div
          className="fixed bottom-6 left-0 right-0 h-16 pointer-events-none z-40 overflow-hidden"
          aria-hidden
        >
          <img
            src="/dancing-unicorn.gif"
            alt=""
            className="absolute h-14 w-auto object-contain"
            style={{
              animation: "unicorn-stroll 35s linear infinite",
            }}
          />
        </div>
      )}

      {musicReady && (gameState?.watchMode ?? true) && (
        <div className="group fixed bottom-0 right-0 z-50 p-6">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {gameState?.musicPlaying ? (
              <div className="flex items-center gap-3 shadow-lg">
                <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Music
                </span>
                <button
                  onClick={pauseMusic}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-full transition-colors"
                  title="Pause music"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
                <button
                  onClick={resetMusic}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-full transition-colors"
                  title="Reset music"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            ) : gameState?.musicStarted ? (
              <div className="flex items-center gap-3 shadow-lg">
                <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Music
                </span>
                <button
                  onClick={resumeMusic}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-full transition-colors"
                  title="Resume music"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
                <button
                  onClick={resetMusic}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-full transition-colors"
                  title="Reset music"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            ) : (
              <button
                onClick={startMusic}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-full shadow-lg transition-colors"
              >
                <Music className="w-4 h-4" />
                Start music
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto flex gap-6">
        <aside className="w-56 shrink-0">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <h3 className="text-slate-400 text-sm font-medium mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Players ({gameState?.players?.length ?? 0})
            </h3>
            <PlayerList
              players={gameState?.players ?? []}
              buzzedPlayerId={gameState?.buzzedPlayerId ?? null}
              teamMode={gameState?.teamMode ?? false}
              teamAssignments={gameState?.teamAssignments ?? {}}
            />
          </div>
        </aside>

        <main className="flex-1 flex flex-col items-center justify-center min-w-0">
          {error ? (
            <div className="text-center space-y-3">
              <p className="text-red-400">{error}</p>
              <button
                onClick={loadState}
                className="px-4 py-2 bg-slate-600 rounded-lg hover:bg-slate-500"
              >
                Retry
              </button>
            </div>
          ) : !gameState ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p>Connecting…</p>
            </div>
          ) : gameState.status === "waiting" ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Waiting room</h2>
              <p className="text-slate-400">Host will start shortly</p>
            </div>
          ) : (
            <div className="w-full max-w-2xl space-y-6">
              {gameState.buzzedPlayerId && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full text-amber-300 text-sm">
                    ⚡ {gameState.players.find((p) => p.id === gameState.buzzedPlayerId)?.name ?? "Someone"} is guessing…
                    {gameState.teamMode &&
                      gameState.teamAssignments?.[gameState.buzzedPlayerId] && (
                        <span
                          className={`ml-2 px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            gameState.teamAssignments[gameState.buzzedPlayerId] === "blue"
                              ? "bg-blue-500/30 text-blue-200"
                              : "bg-red-500/30 text-red-200"
                          }`}
                        >
                          {gameState.teamAssignments[gameState.buzzedPlayerId]}
                        </span>
                      )}
                  </div>
                </div>
              )}
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-amber-300 to-emerald-400 text-center">
                Guess The Unicorn Name
              </h1>
              <GameBoard maskedPhrase={gameState.maskedPhrase} />
              <p className="text-center text-slate-500 text-sm">
                Players buzz on their screens
              </p>
            </div>
          )}
        </main>

        <aside className="w-32 shrink-0 flex flex-col items-center">
          <span className="text-xs text-slate-500 mb-2">Letters</span>
          {gameState?.status === "active" ? (
            <Alphabet
              guessedLetters={gameState.guessedLetters}
              canGuess={false}
              onGuess={() => {}}
            />
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                <div
                  key={l}
                  className="w-8 h-7 rounded bg-slate-800 flex items-center justify-center text-xs text-slate-500"
                >
                  {l}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
