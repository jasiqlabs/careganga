"use client";
import { useEffect, useState } from "react";

export function CmsScrollFlowerButton() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = c * progress;

  return (
    <button
      type="button"
      className="cg-site-float-flower"
      aria-label="Scroll to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <svg viewBox="0 0 52 52" className="cg-flower-ring" aria-hidden="true">
        <defs>
          <linearGradient id="cgFlowerRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#84CC16" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
        <circle cx="26" cy="26" r={r} fill="#0F172A" stroke="#1E293B" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="url(#cgFlowerRingGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 26 26)"
        />
        {/* Soil */}
        <ellipse cx="26" cy="40" rx="8" ry="2.2" fill="#78350F" />
        {/* Stem & Leaves */}
        <path d="M26 39 L26 25" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M26 34 Q20 31 20 27 Q24 28 26 32 Z" fill="#4ADE80" />
        <path d="M26 32 Q32 29 32 25 Q28 26 26 30 Z" fill="#22C55E" />
        {/* Pink Flower Petals */}
        <circle cx="26" cy="17.5" r="3.4" fill="#F9A8D4" />
        <circle cx="21.5" cy="20.5" r="3.4" fill="#F472B6" />
        <circle cx="30.5" cy="20.5" r="3.4" fill="#F472B6" />
        <circle cx="23" cy="24.5" r="3.2" fill="#F9A8D4" />
        <circle cx="29" cy="24.5" r="3.2" fill="#F9A8D4" />
        <circle cx="26" cy="21" r="2.6" fill="#FACC15" />
      </svg>
    </button>
  );
}
