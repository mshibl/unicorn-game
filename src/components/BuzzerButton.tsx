"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";

const REENABLE_DURATION_MS = 5000;

interface BuzzerButtonProps {
  canBuzz: boolean;
  hasBuzzed: boolean;
  onBuzz: () => void;
  cooldownReason?: string;
  buzzersReenableAt?: number | null;
}

export default function BuzzerButton({
  canBuzz,
  hasBuzzed,
  onBuzz,
  cooldownReason,
  buzzersReenableAt,
}: BuzzerButtonProps) {
  const [progress, setProgress] = useState(0);

  // Show loading ring when buzzers are auto-reenabling (5s after letter guess)
  const now = Date.now();
  const showReenableRing =
    !!buzzersReenableAt &&
    now < buzzersReenableAt &&
    !canBuzz &&
    !hasBuzzed;

  useEffect(() => {
    if (!showReenableRing || !buzzersReenableAt) return;

    const update = () => {
      const now = Date.now();
      if (now >= buzzersReenableAt) {
        setProgress(1);
        return;
      }
      const elapsed = now - (buzzersReenableAt - REENABLE_DURATION_MS);
      setProgress(Math.min(1, elapsed / REENABLE_DURATION_MS));
    };

    update();
    const id = setInterval(update, 50);
    return () => clearInterval(id);
  }, [showReenableRing, buzzersReenableAt]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center overflow-visible">
        {/* Loading ring that surrounds the buzzer during 5s cooldown */}
        {showReenableRing && (
          <svg
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 sm:w-40 sm:h-40 -rotate-90 pointer-events-none"
            viewBox="0 0 36 36"
            aria-hidden
          >
            {/* Track: faint background ring */}
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-slate-600"
            />
            {/* Progress: amber ring that fills clockwise */}
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-amber-400 transition-all duration-75"
              strokeDasharray={2 * Math.PI * 16}
              strokeDashoffset={2 * Math.PI * 16 * (1 - progress)}
            />
          </svg>
        )}
        <button
          onClick={onBuzz}
          disabled={!canBuzz}
          className={`
            relative z-10 group flex flex-col items-center justify-center gap-1
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
          {canBuzz && <span className="leading-tight">BUZZ IN</span>}
        </button>
      </div>
      <span className="text-xs text-slate-400/80 text-center max-w-xs">
        {cooldownReason ?? "Click or press Spacebar to buzz in"}
      </span>
    </div>
  );
}
