"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TAGLINES = [
  "Serving Communities...",
  "Building Hope Along The Ganga...",
  "Direct Field Impact & Transparency...",
  "Welcome to CareGanga Foundation"
];

export function CareGangaLivePreloader({ onFinish }: { onFinish?: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      const currentPct = Math.min(100, Math.round((tick / 56) * 100));
      setProgress(currentPct);

      if (tick === 14) setTaglineIdx(1);
      if (tick === 34) setTaglineIdx(2);
      if (tick === 48) setTaglineIdx(3);

      if (tick >= 56) {
        clearInterval(interval);
        setTimeout(() => {
          setIsVisible(false);
          onFinish?.();
        }, 250);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#FAF7EE] text-slate-800 select-none overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(4px)" }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
        >
          {/* Top accent loading strip */}
          <div className="fixed top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#134938] via-[#4EAECB] to-[#F2D03F] z-[99999] origin-left shadow-md" />

          {/* Ambient luminous glow circles */}
          <div className="absolute w-[600px] h-[600px] rounded-full bg-[#4EAECB]/15 blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-[#134938]/15 blur-[90px] pointer-events-none" />

          {/* Centered Content */}
          <div className="relative z-10 flex flex-col items-center max-w-md px-6 text-center">
            {/* Multi-Ring Rotating Spinner with Centered Logo */}
            <div className="relative mb-8 flex items-center justify-center w-36 h-36">
              {/* Outer Slow Ring */}
              <div
                className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#134938] border-r-[#4EAECB] border-b-[#F2D03F] p-1 opacity-80"
                style={{
                  animation: "cgSpinSlow 6s linear infinite"
                }}
              />

              {/* Inner Reverse Ring */}
              <div
                className="absolute inset-2 rounded-full border-2 border-transparent border-b-[#4EAECB] border-l-[#134938] opacity-70"
                style={{
                  animation: "cgSpinReverse 8s linear infinite"
                }}
              />

              {/* Inner Pulsing Gradient */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-[#134938]/20 via-[#4EAECB]/20 to-[#F2D03F]/20 animate-pulse" />

              {/* Elevated Logo Card with Floating Wave Motion */}
              <motion.div
                className="relative z-10 w-20 h-20 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-amber-100 p-3.5 flex items-center justify-center"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 120 }}
                style={{
                  animation: "cgWaveFloat 3s ease-in-out infinite"
                }}
              >
                <img
                  src="/logo.png"
                  alt="CareGanga Foundation Logo"
                  className="w-full h-full object-contain drop-shadow-sm"
                />
              </motion.div>
            </div>

            {/* Brand Title */}
            <motion.h1
              className="text-4xl font-extrabold font-serif tracking-tight mb-0.5"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <span className="bg-gradient-to-r from-[#134938] via-[#0F766E] to-[#4EAECB] bg-clip-text text-transparent">
                CareGanga
              </span>
            </motion.h1>

            {/* Sub-label */}
            <motion.span
              className="text-xs font-bold tracking-[0.3em] text-[#134938] uppercase mb-4 block"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              Foundation
            </motion.span>

            {/* Rotating Taglines */}
            <div className="h-6 mb-6 overflow-hidden flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={taglineIdx}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs font-semibold uppercase tracking-widest text-[#134938]"
                >
                  {TAGLINES[taglineIdx]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Progress Bar */}
            <div className="w-64 bg-slate-200/80 h-2.5 rounded-full overflow-hidden p-0.5 shadow-inner border border-slate-300/30 mb-3 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-[#134938] via-[#4EAECB] to-[#F2D03F] rounded-full shadow-sm relative overflow-hidden"
                style={{ width: `${progress}%` }}
                transition={{ ease: "easeOut" }}
              >
                <div className="absolute inset-0 bg-white/30 animate-pulse" />
              </motion.div>
            </div>

            {/* Percentage Display */}
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4EAECB] animate-ping" />
              <span>{progress}%</span>
            </div>
          </div>

          {/* Bottom Wave River Graphic */}
          <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none opacity-40 pointer-events-none">
            <svg
              className="relative block w-full h-16 sm:h-24"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path
                d="M0,0 C150,90 350,-40 500,40 C650,120 900,10 1200,50 L1200,120 L0,120 Z"
                fill="#134938"
              />
              <path
                d="M0,20 C200,100 450,10 700,70 C950,130 1100,30 1200,60 L1200,120 L0,120 Z"
                fill="#4EAECB"
                opacity="0.6"
              />
            </svg>
          </div>

          {/* Embedded keyframe styles */}
          <style jsx>{`
            @keyframes cgSpinSlow {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }
            @keyframes cgSpinReverse {
              0% {
                transform: rotate(360deg);
              }
              100% {
                transform: rotate(0deg);
              }
            }
            @keyframes cgWaveFloat {
              0%,
              100% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-4px);
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
