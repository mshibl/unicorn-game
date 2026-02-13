"use client";

import { Zap } from "lucide-react";

interface BuzzerButtonProps {
  canBuzz: boolean;
  hasBuzzed: boolean;
  onBuzz: () => void;
  cooldownReason?: string;
}

export default function BuzzerButton({
  canBuzz,
  hasBuzzed,
  onBuzz,
  cooldownReason,
}: BuzzerButtonProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onBuzz}
        disabled={!canBuzz}
        className={`
          group relative flex flex-col items-center justify-center gap-1
          w-28 h-28 sm:w-32 sm:h-32 rounded-full font-bold text-sm
          transition-all duration-200 uppercase tracking-wider
          ${
            hasBuzzed
              ? "bg-amber-500/20 border-2 border-amber-400 text-amber-300 cursor-default"
              : canBuzz
              ? "bg-linear-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white border-2 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_50px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 cursor-pointer"
              : "bg-slate-800 border-2 border-slate-700 text-slate-500 cursor-not-allowed"
          }
        `}
      >
        <Zap
          className={`w-7 h-7 sm:w-8 sm:h-8 ${
            hasBuzzed
              ? "text-amber-400 animate-pulse"
              : canBuzz
              ? "text-white group-hover:animate-bounce"
              : "text-slate-500"
          }`}
        />
        {(canBuzz || hasBuzzed) && <span className="leading-tight">BUZZ IN</span>}
      </button>
      <span className="text-xs text-slate-400/80 text-center max-w-xs">
        {cooldownReason ?? "Click or press Spacebar to buzz in"}
      </span>
    </div>
  );
}
