"use client";

import { useEffect, useState } from "react";
import ReactConfetti from "react-confetti";
import { Star, Sparkles } from "lucide-react";

// Unicorn horn SVG
function UnicornHorn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 48" className={className} fill="none">
      <defs>
        <linearGradient id="unicornHorn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L16 46 L8 46 Z"
        fill="url(#unicornHorn)"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

interface FinalRevealProps {
  fullName: string;
  winnerPhotoSrc?: string; // Data URL or image path
}

export default function FinalReveal({ fullName, winnerPhotoSrc }: FinalRevealProps) {
  const [showName, setShowName] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);

    const t1 = setTimeout(() => setShowName(true), 300);
    const t2 = setTimeout(() => setShowPhoto(true), 1000);
    const t3 = setTimeout(() => setShowConfetti(false), 10000);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
      {/* Magical gradient background */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4c1d95 50%, #831843 75%, #1e3a5f 100%)",
          backgroundSize: "400% 400%",
          animation: "aurora 8s ease infinite",
        }}
      />
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      {showConfetti && (
        <ReactConfetti
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={350}
          recycle={true}
          colors={["#ec4899", "#a855f7", "#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#818cf8"]}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-6 sm:gap-8 px-4">
        {/* Unicorn horn + sparkles header */}
        <div
          className={`transition-all duration-1000 ${
            showName ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-90"
          }`}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <Star className="w-7 h-7 sm:w-8 sm:h-8 text-pink-300 animate-spin" style={{ animationDuration: "4s" }} />
            <UnicornHorn className="w-10 h-20 sm:w-12 sm:h-24 drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]" />
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-300" style={{ animation: "sparkle 1.5s ease-in-out infinite" }} />
          </div>
        </div>

        <div
          className={`transition-all duration-1000 delay-200 ${
            showName ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <p className="text-lg sm:text-xl font-medium tracking-[0.3em] uppercase text-center bg-clip-text text-transparent bg-linear-to-r from-pink-300 via-purple-300 to-cyan-300">
            Our Unicorn
          </p>
        </div>

        {/* Rainbow-shifting name */}
        <div
          className={`transition-all duration-1000 delay-500 ${
            showName ? "opacity-100 scale-100" : "opacity-0 scale-75"
          }`}
        >
          <h1
            className="text-5xl sm:text-7xl md:text-8xl font-extrabold text-center drop-shadow-2xl"
            style={{
              background: "linear-gradient(90deg, #f472b6, #a78bfa, #38bdf8, #34d399, #fbbf24, #f472b6)",
              backgroundSize: "300% 100%",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              animation: "rainbow-shift 4s ease infinite",
            }}
          >
            {fullName}
          </h1>
        </div>

        {/* Photo with rainbow ring */}
        <div
          className={`transition-all duration-1000 delay-700 ${
            showPhoto
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-10 scale-90"
          }`}
        >
          <div className="relative">
            <div
              className="absolute -inset-3 rounded-full opacity-80"
              style={{
                background: "linear-gradient(90deg, #ec4899, #a855f7, #22d3ee, #34d399, #fbbf24, #ec4899)",
                backgroundSize: "300% 300%",
                filter: "blur(12px)",
                animation: "rainbow-shift 3s ease infinite",
              }}
            />
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl bg-slate-800 ring-4 ring-pink-400/30 ring-purple-400/30">
              <img
                src={winnerPhotoSrc || "/winner-photo.png"}
                alt={fullName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement("div");
                    fallback.className =
                      "w-full h-full flex items-center justify-center text-6xl font-bold text-amber-400";
                    fallback.textContent = fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("");
                    parent.appendChild(fallback);
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div
          className={`transition-all duration-1000 delay-1000 ${
            showPhoto ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
          }`}
        >
          <p className="text-2xl sm:text-3xl font-light text-center flex items-center justify-center gap-3">
            <span className="animate-bounce">🦄</span>
            <span className="text-white/90">Congratulations!</span>
            <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>✨</span>
          </p>
        </div>
      </div>
    </div>
  );
}
