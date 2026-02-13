"use client";

interface GameBoardProps {
  maskedPhrase: string;
}

export default function GameBoard({ maskedPhrase }: GameBoardProps) {
  const words = maskedPhrase.split(" ");

  return (
    <div className="flex flex-wrap justify-center gap-3 px-4 py-8">
      {words.map((word, wi) => (
        <div key={wi} className="flex gap-1.5">
          {word.split("").map((ch, ci) => {
            const isRevealed = ch !== "_";
            return (
              <div
                key={ci}
                className={`
                  flex items-center justify-center
                  w-14 h-16 sm:w-16 sm:h-20 md:w-20 md:h-24
                  rounded-lg text-2xl sm:text-3xl md:text-4xl font-bold
                  uppercase tracking-wider transition-all duration-500
                  ${
                    isRevealed
                      ? "bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105"
                      : "bg-slate-800/80 border-2 border-slate-600 text-transparent shadow-inner"
                  }
                `}
              >
                {isRevealed ? ch : "\u00A0"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
