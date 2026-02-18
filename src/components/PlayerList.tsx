"use client";

import { User, Zap, UserMinus } from "lucide-react";

interface Player {
  id: string;
  name: string;
}

type Team = "blue" | "red";

interface PlayerListProps {
  players: Player[];
  buzzedPlayerId: string | null;
  currentPlayerId?: string;
  teamMode?: boolean;
  teamAssignments?: Record<string, Team>;
  onUnbuzz?: () => void;
  onRemovePlayer?: (playerId: string) => void;
}

export default function PlayerList({
  players,
  buzzedPlayerId,
  currentPlayerId,
  teamMode = false,
  teamAssignments = {},
  onUnbuzz,
  onRemovePlayer,
}: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="text-slate-500 text-sm text-center py-4">
        No players yet...
      </div>
    );
  }

  // Buzzed user first, then everyone else
  // In team mode, group by team (blue first, then red)
  const sorted = [...players].sort((a, b) => {
    if (a.id === buzzedPlayerId) return -1;
    if (b.id === buzzedPlayerId) return 1;
    if (teamMode) {
      const teamA = teamAssignments[a.id] || "blue";
      const teamB = teamAssignments[b.id] || "blue";
      if (teamA !== teamB) {
        return teamA === "blue" ? -1 : 1;
      }
    }
    return 0;
  });

  return (
    <div className="space-y-2">
      {sorted.map((player) => {
        const isBuzzed = player.id === buzzedPlayerId;
        const isMe = player.id === currentPlayerId;
        const team = teamMode ? teamAssignments[player.id] : null;
        const teamColor = team === "blue" ? "blue" : team === "red" ? "red" : null;

        return (
          <div
            key={player.id}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
              ${
                isBuzzed
                  ? "bg-amber-500/20 border border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                  : teamMode && teamColor === "blue"
                  ? "bg-blue-500/10 border border-blue-500/30"
                  : teamMode && teamColor === "red"
                  ? "bg-red-500/10 border border-red-500/30"
                  : "bg-slate-800/50 border border-slate-700/50"
              }
              ${isMe ? "ring-1 ring-cyan-400/30" : ""}
            `}
          >
            <div
              className={`
              flex items-center justify-center w-8 h-8 rounded-full shrink-0
              ${
                isBuzzed
                  ? "bg-amber-500/30"
                  : teamMode && teamColor === "blue"
                  ? "bg-blue-500/30"
                  : teamMode && teamColor === "red"
                  ? "bg-red-500/30"
                  : "bg-slate-700"
              }
            `}
            >
              {isBuzzed ? (
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
              ) : (
                <User
                  className={`w-4 h-4 ${
                    teamMode && teamColor === "blue"
                      ? "text-blue-400"
                      : teamMode && teamColor === "red"
                      ? "text-red-400"
                      : "text-slate-400"
                  }`}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {teamMode && teamColor && (
                  <span
                    className={`text-xs font-bold uppercase tracking-wider shrink-0 ${
                      teamColor === "blue" ? "text-blue-400" : "text-red-400"
                    }`}
                  >
                    {teamColor}
                  </span>
                )}
                <span
                  className={`font-medium truncate ${
                    isBuzzed ? "text-amber-300" : "text-slate-300"
                  }`}
                >
                  {player.name}
                  {isMe && (
                    <span className="text-xs text-cyan-400 ml-2">(you)</span>
                  )}
                </span>
              </div>
            </div>
            {isBuzzed && (
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider animate-pulse shrink-0">
                Buzzed!
              </span>
            )}
            {onUnbuzz && isBuzzed && (
              <button
                onClick={onUnbuzz}
                className="shrink-0 px-2 py-1 text-xs font-medium bg-blue-600/80 hover:bg-blue-500 text-white rounded-lg transition-colors"
                title="Unbuzz — open floor for others"
              >
                Unbuzz
              </button>
            )}
            {onRemovePlayer && (
              <button
                onClick={() => onRemovePlayer(player.id)}
                className="shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Remove player"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
