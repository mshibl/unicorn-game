"use client";

interface GameBoardProps {
  maskedPhrase: string;
  targetPhrase?: string;
  onBoxClick?: (letter: string) => void;
}

export default function GameBoard({ maskedPhrase, targetPhrase, onBoxClick }: GameBoardProps) {
  const words = maskedPhrase.split(" ");
  const targetWords = targetPhrase?.split(" ") ?? words;

  const handleClick = (wi: number, ci: number) => {
    if (!onBoxClick || !targetPhrase) return;
    const flatIndex =
      targetWords.slice(0, wi).join("").length + wi + ci;
    const letter = targetPhrase[flatIndex]?.toUpperCase();
    if (letter && /^[A-Z]$/.test(letter)) {
      onBoxClick(letter);
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-3 px-4 py-8">
      {words.map((word, wi) => (
        <div key={wi} className="flex gap-1.5">
          {word.split("").map((ch, ci) => {
            const isRevealed = ch !== "_";
            const isClickable = onBoxClick && !isRevealed && targetPhrase;
            const flatIndex =
              targetWords.slice(0, wi).join("").length + wi + ci;
            const letter = targetPhrase?.[flatIndex]?.toUpperCase();
            const canReveal = letter && /^[A-Z]$/.test(letter);

            return (
              <div
                key={ci}
                onClick={
                  isClickable && canReveal
                    ? () => handleClick(wi, ci)
                    : undefined
                }
                role={isClickable && canReveal ? "button" : undefined}
                tabIndex={isClickable && canReveal ? 0 : undefined}
                onKeyDown={
                  isClickable && canReveal
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleClick(wi, ci);
                        }
                      }
                    : undefined
                }
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
                  ${isClickable && canReveal ? "cursor-pointer hover:bg-slate-700/80 hover:border-slate-500 active:scale-95" : ""}
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
