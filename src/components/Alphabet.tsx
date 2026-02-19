"use client";

import { X } from "lucide-react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface AlphabetProps {
  guessedLetters: string[];
  canGuess: boolean;
  onGuess: (letter: string) => void;
}

export default function Alphabet({
  guessedLetters,
  canGuess,
  onGuess,
}: AlphabetProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {LETTERS.map((letter) => {
        const isGuessed = guessedLetters.includes(letter);
        const isDisabled = !canGuess;

        return (
          <button
            key={letter}
            disabled={isDisabled}
            onClick={() => onGuess(letter)}
            className={`
              relative flex items-center justify-center
              w-9 h-8 rounded-md font-bold text-xs
              transition-all duration-200 uppercase
              ${
                isGuessed
                  ? "bg-slate-800/80 text-slate-600 cursor-not-allowed border border-slate-700"
                  : canGuess
                  ? "bg-linear-to-b from-amber-400 to-amber-600 text-slate-900 hover:from-amber-300 hover:to-amber-500 hover:scale-105 hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] active:scale-95 cursor-pointer border border-amber-300"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
              }
            `}
          >
            {isGuessed ? (
              <span className="relative inline-flex items-center justify-center">
                <span className="text-slate-500 line-through">{letter}</span>
                <X className="absolute w-4 h-4 text-red-400/90" strokeWidth={3} style={{ inset: 0, margin: "auto" }} />
              </span>
            ) : (
              letter
            )}
          </button>
        );
      })}
    </div>
  );
}
