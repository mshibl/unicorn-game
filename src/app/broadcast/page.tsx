"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getPusherClient } from "@/lib/pusher-client";
import type { ClientGameState } from "@/lib/game-state";
import GameBoard from "@/components/GameBoard";
import Alphabet from "@/components/Alphabet";
import PlayerList from "@/components/PlayerList";
import FinalReveal from "@/components/FinalReveal";
import { Users, Loader2, Music, Monitor } from "lucide-react";

async function gameAction(body: Record<string, unknown>) {
  const res = await fetch("/api/game/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function BroadcastPage() {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicReady, setMusicReady] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const audioRef = useRef<InstanceType<typeof Audio> | null>(null);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("game-channel");

    channel.bind("game-update", (data: ClientGameState) => {
      setGameState(data);
    });

    gameAction({ action: "get_state" }).then((res) => {
      if (res.state) setGameState(res.state);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("game-channel");
    };
  }, []);

  const handleStartMusic = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => setMusicPlaying(true)).catch(() => {});
  }, []);

  useEffect(() => {
    const musicUrl =
      process.env.NEXT_PUBLIC_GAME_SHOW_MUSIC_URL || "/game-show-music.mp3";
    const audio = new Audio(musicUrl);
    audioRef.current = audio;
    audio.loop = true;
    audio.volume = 0.4;

    audio.addEventListener("canplaythrough", () => setMusicReady(true));
    audio.addEventListener("error", () => {
      setMusicReady(true);
      setMusicError(true);
    });

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  if (gameState?.status === "revealed") {
    return (
      <div className="relative">
        <FinalReveal
          fullName={gameState.maskedPhrase}
          winnerPhotoSrc={gameState.winnerPhotoDataUrl || undefined}
        />
        {/* Music continues during reveal - floating music indicator */}
        {musicPlaying && (
          <div className="fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full text-white/80 backdrop-blur">
            <Music className="w-4 h-4 animate-pulse" />
            <span className="text-sm">Music on</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-900 to-slate-950">
      {/* Broadcast badge + music control */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-600/80 rounded-full text-white text-sm font-medium backdrop-blur">
          <Monitor className="w-4 h-4" />
          Broadcast view — Share this tab
        </div>
        {!musicPlaying ? (
          <button
            onClick={handleStartMusic}
            disabled={!musicReady || musicError}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-bold rounded-full transition-all hover:scale-105 shadow-lg"
            title={musicError ? "Add game-show-music.mp3 to /public folder" : undefined}
          >
            <Music className="w-5 h-5" />
            {musicError ? "No music file" : musicReady ? "▶ Start music" : "Loading…"}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600/80 rounded-full text-white text-sm backdrop-blur">
            <Music className="w-4 h-4 animate-pulse" />
            Music playing
          </div>
        )}
      </div>


      <div className="max-w-7xl mx-auto px-4 py-16 flex gap-6 min-h-screen pt-24">
        {/* ── Left: Players ───────────────────────────────────────── */}
        <aside className="w-64 shrink-0">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-5 sticky top-24">
            <div className="flex items-center gap-2 text-slate-400 mb-4">
              <Users className="w-5 h-5" />
              <span className="font-medium">
                Players ({gameState?.players.length ?? 0})
              </span>
            </div>
            <PlayerList
              players={gameState?.players ?? []}
              buzzedPlayerId={gameState?.buzzedPlayerId ?? null}
            />
          </div>
        </aside>

        {/* ── Center: Board (no buzzer) ─────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center gap-6 min-w-0">
          {!gameState ? (
            <div className="flex flex-col items-center gap-4 text-slate-500">
              <Loader2 className="w-12 h-12 animate-spin" />
              <p>Connecting to game…</p>
            </div>
          ) : gameState.status === "waiting" ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <h2 className="text-3xl font-bold text-white">Waiting room</h2>
              <p className="text-slate-400">
                The host will start the game shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="w-full flex items-center justify-center min-h-[3.5rem]">
                {gameState.buzzedPlayerId && (
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500/20 border border-amber-400/40 rounded-full text-amber-300 font-medium animate-pulse">
                    <span className="text-lg">⚡</span>
                    {gameState.players.find(
                      (p) => p.id === gameState.buzzedPlayerId
                    )?.name ?? "Someone"}{" "}
                    is guessing...
                  </div>
                )}
              </div>

              <div className="w-full max-w-3xl">
                <GameBoard maskedPhrase={gameState.maskedPhrase} />
              </div>

              {/* No buzzer - just a visual placeholder */}
              <div className="h-24 flex items-center justify-center">
                <p className="text-slate-600 text-sm">
                  Players buzz in on their own screens
                </p>
              </div>
            </>
          )}
        </main>

        {/* ── Right: Alphabet (read-only) ────────────────────────────── */}
        <aside className="w-36 shrink-0 flex flex-col items-center py-6">
          <span className="text-xs text-slate-500 mb-2 uppercase tracking-wider">
            Letters
          </span>
          {gameState && gameState.status === "active" ? (
            <Alphabet
              guessedLetters={gameState.guessedLetters}
              canGuess={false}
              onGuess={() => {}}
            />
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                <div
                  key={l}
                  className="w-9 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-500 font-bold"
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
