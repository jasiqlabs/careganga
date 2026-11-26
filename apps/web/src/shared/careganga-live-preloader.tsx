"use client";

import { useEffect, useState } from "react";

const messages = [
  "Connecting communities...",
  "Spreading care...",
  "Building brighter futures...",
  "Welcome to CareGanga Foundation"
];

export function CareGangaLivePreloader({
  onFinish,
  logoSrc = "/logo.png"
}: {
  onFinish?: () => void;
  logoSrc?: string;
}) {
  const [pct, setPct] = useState(0);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => Math.min(100, p + Math.ceil(Math.random() * 6)));
    }, 70);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (pct < 100) return;
    const a = setTimeout(() => setHide(true), 400);
    const b = setTimeout(() => {
      onFinish?.();
    }, 1000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [pct, onFinish]);

  const msg = messages[Math.min(messages.length - 1, Math.floor(pct / 26))];

  return (
    <div
      className="cg-loader-bg"
      aria-label="Loading CareGanga Foundation"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        transition: "opacity 0.5s ease",
        opacity: hide ? 0 : 1,
        pointerEvents: hide ? "none" : "auto",
        userSelect: "none"
      }}
    >
      {/* Concentric animated rings + floating logo card */}
      <div style={{ position: "relative", width: 144, height: 144 }}>
        <div className="cg-ring cg-ring-1" />
        <div className="cg-ring cg-ring-2" />
        <div className="cg-ring cg-ring-3" />
        <div
          className="cg-float"
          style={{
            position: "absolute",
            inset: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
            border: "1px solid color-mix(in srgb, var(--gold) 45%, transparent)",
            background: "var(--card)",
            boxShadow: "var(--shadow-soft)"
          }}
        >
          <img
            src={logoSrc}
            alt="CareGanga logo"
            style={{ width: 42, height: 42, objectFit: "contain", borderRadius: "9999px" }}
          />
        </div>
      </div>

      {/* Brand title */}
      <p
        className="text-brand-gradient"
        style={{
          marginTop: 40,
          marginBottom: 0,
          fontFamily: '"Merriweather", Georgia, serif',
          fontSize: "2.25rem",
          fontWeight: 900,
          letterSpacing: "-0.025em",
          lineHeight: 1.1
        }}
      >
        CareGanga
      </p>
      <p
        style={{
          marginTop: 4,
          marginBottom: 0,
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.35em",
          color: "var(--primary)",
          fontFamily: '"Poppins", system-ui, sans-serif'
        }}
      >
        FOUNDATION
      </p>

      {/* Dynamic loading status message */}
      <p
        style={{
          marginTop: 24,
          marginBottom: 0,
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--primary)",
          fontFamily: '"Poppins", system-ui, sans-serif'
        }}
      >
        {msg}
      </p>

      {/* Progress bar */}
      <div
        style={{
          marginTop: 24,
          height: 6,
          width: 256,
          overflow: "hidden",
          borderRadius: 9999,
          backgroundColor: "var(--border)"
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 9999,
            transition: "width 0.15s ease",
            background: "linear-gradient(90deg, var(--primary), var(--teal), var(--gold))"
          }}
        />
      </div>

      {/* Percentage */}
      <p
        style={{
          marginTop: 12,
          marginBottom: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--muted-foreground)",
          fontFamily: '"Poppins", system-ui, sans-serif'
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 9999,
            backgroundColor: "var(--teal)",
            display: "inline-block"
          }}
        />
        {pct}%
      </p>

      {/* Animated SVG waves at bottom */}
      <div
        className="cg-wave-slow"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 112,
          width: "200%",
          opacity: 0.5,
          pointerEvents: "none"
        }}
      >
        <svg
          viewBox="0 0 2880 120"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", fill: "var(--primary)", display: "block" }}
        >
          <path d="M0 40 C 360 0 720 0 1080 50 S 1800 80 2160 40 S 2700 20 2880 40 V120 H0Z" />
        </svg>
      </div>
      <div
        className="cg-wave"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 80,
          width: "200%",
          opacity: 0.4,
          pointerEvents: "none"
        }}
      >
        <svg
          viewBox="0 0 2880 100"
          preserveAspectRatio="none"
          style={{ width: "100%", height: "100%", fill: "var(--teal)", display: "block" }}
        >
          <path d="M0 30 C 480 60 960 0 1440 30 S 2400 60 2880 30 V100 H0Z" />
        </svg>
      </div>
    </div>
  );
}
