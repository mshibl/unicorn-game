"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import GameBoard from "@/components/GameBoard";
import Alphabet from "@/components/Alphabet";
import PlayerList from "@/components/PlayerList";
import FinalReveal from "@/components/FinalReveal";
import { Users, Loader2, Music, Pause, RotateCcw, Play } from "lucide-react";

type GameState = {
  status: "waiting" | "active" | "revealed";
  players: { id: string; name: string }[];
  buzzedPlayerId: string | null;
  guessedLetters: string[];
  maskedPhrase: string;
  winnerPhotoDataUrl?: string;
  teamMode?: boolean;
  teamAssignments?: Record<string, "blue" | "red">;
  showDancingUnicorn?: boolean;
};

export default function WatchPage() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicPlayingRef = useRef(false);
  const buzzerSoundRef = useRef<HTMLAudioElement | null>(null);
  const correctChoiceSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongChoiceSoundRef = useRef<HTMLAudioElement | null>(null);
  const musicStartedRef = useRef(false);
  const prevGuessedCountRef = useRef(0);

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
        ch.bind("game-update", (data: GameState) => setGameState(data));
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
    audio.volume = 0.4;
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

  // Set up Media Session API for Mac media keys support
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const mediaSession = navigator.mediaSession;
    
    // Set metadata
    mediaSession.metadata = new MediaMetadata({
      title: "Game Show Music",
      artist: "Background Music",
    });

    // Handle play action (from media keys)
    const handlePlay = () => {
      if (musicStartedRef.current && !musicPlayingRef.current) {
        // Resume if already started
        musicRef.current?.play().then(() => {
          musicPlayingRef.current = true;
          setMusicPlaying(true);
          updateMediaSessionState();
        });
      } else if (!musicStartedRef.current) {
        // Start if not started
        musicRef.current?.play().then(() => {
          musicPlayingRef.current = true;
          musicStartedRef.current = true;
          setMusicPlaying(true);
          setMusicStarted(true);
          updateMediaSessionState();
        });
      }
    };

    // Handle pause action (from media keys)
    const handlePause = () => {
      if (musicPlayingRef.current) {
        musicRef.current?.pause();
        musicPlayingRef.current = false;
        setMusicPlaying(false);
        updateMediaSessionState();
      }
    };

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
      process.env.NEXT_PUBLIC_CORRECT_ANSWER_URL || "/correct-answer.mp3"
    );
    const wrongSound = new Audio(
      process.env.NEXT_PUBLIC_WRONG_ANSWER_URL || "/wrong-answer.mp3"
    );
    correctSound.volume = 0.8;
    wrongSound.volume = 0.8;
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
    // Play correct/wrong sound when a letter is guessed
    const guessed = gameState?.guessedLetters ?? [];
    const masked = gameState?.maskedPhrase ?? "";
    const prevCount = prevGuessedCountRef.current;

    if (guessed.length === prevCount + 1) {
      const newLetter = guessed[guessed.length - 1]?.toUpperCase();
      prevGuessedCountRef.current = guessed.length;
      if (newLetter) {
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
  }, [gameState?.guessedLetters, gameState?.maskedPhrase]);

  const updateMediaSessionState = () => {
    if ("mediaSession" in navigator) {
      const mediaSession = navigator.mediaSession;
      if (musicPlayingRef.current) {
        mediaSession.playbackState = "playing";
      } else {
        mediaSession.playbackState = "paused";
      }
    }
  };

  const startMusic = () => {
    musicRef.current?.play().then(() => {
      musicPlayingRef.current = true;
      musicStartedRef.current = true;
      setMusicPlaying(true);
      setMusicStarted(true);
      updateMediaSessionState();
    });
  };

  const pauseMusic = () => {
    musicRef.current?.pause();
    musicPlayingRef.current = false;
    setMusicPlaying(false);
    updateMediaSessionState();
  };

  const resumeMusic = () => {
    musicRef.current?.play().then(() => {
      musicPlayingRef.current = true;
      setMusicPlaying(true);
      updateMediaSessionState();
    });
  };

  const resetMusic = () => {
    if (musicRef.current) {
      musicRef.current.currentTime = 0;
      musicRef.current.play().then(() => {
        musicPlayingRef.current = true;
        musicStartedRef.current = true;
        setMusicPlaying(true);
        setMusicStarted(true);
        updateMediaSessionState();
      });
    }
  };

  useEffect(() => {
    if (gameState?.status === "revealed") musicRef.current?.pause();
  }, [gameState?.status]);

  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;

    if (gameState?.buzzedPlayerId) {
      // Lower music volume while buzzer is active (don't pause)
      music.volume = 0.04;
      // Play buzzer sound effect
      const buzzer = buzzerSoundRef.current;
      if (buzzer) {
        buzzer.currentTime = 0;
        buzzer.play().catch((e) => console.warn("Buzzer play failed:", e));
      }
    } else {
      // Restore normal music volume when buzzer is released
      music.volume = 0.4;
    }
  }, [gameState?.buzzedPlayerId]);

  if (gameState?.status === "revealed") {
    return (
      <FinalReveal
        fullName={gameState.maskedPhrase}
        winnerPhotoSrc={gameState.winnerPhotoDataUrl}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
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

      {musicReady && (
        musicPlaying ? (
          <div className="fixed bottom-6 right-6 flex items-center gap-3 z-50 shadow-lg">
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
        ) : musicStarted ? (
          <div className="fixed bottom-6 right-6 flex items-center gap-3 z-50 shadow-lg">
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
            className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-full z-50 shadow-lg transition-colors"
          >
            <Music className="w-4 h-4" />
            Start music
          </button>
        )
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
