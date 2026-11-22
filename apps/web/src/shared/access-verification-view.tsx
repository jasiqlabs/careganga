"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

export type AccessVerificationMode = "unverified-access" | "unconfirmed-session" | "service-unavailable";

export interface AccessVerificationViewProps {
  mode?: AccessVerificationMode;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string | null;
  onCtaClick?: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function AccessVerificationView({
  mode = "unverified-access",
  title,
  description,
  ctaLabel,
  ctaHref,
  onCtaClick,
  children
}: AccessVerificationViewProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [isHandling, setIsHandling] = useState(false);

  // Defaults per wireframe specification
  const isAccessUnverified = mode === "unverified-access";
  const isServiceUnavailable = mode === "service-unavailable";

  const resolvedTitle =
    title ??
    (isServiceUnavailable
      ? "Service temporarily unavailable"
      : isAccessUnverified
        ? "Access cannot be verified"
        : "Cannot confirm your access");

  const resolvedDescription =
    description ??
    (isServiceUnavailable
      ? "We are experiencing a temporary connection issue. Please check your connection or try again shortly."
      : isAccessUnverified
        ? "Staff information is hidden until your current permissions are confirmed."
        : "Protected information is unavailable until your session can be verified.");

  const resolvedCtaLabel =
    ctaLabel ??
    (isServiceUnavailable
      ? (onCtaClick ? "Try again" : "Return to my account")
      : isAccessUnverified
        ? "Return to my account"
        : "Sign in");

  const resolvedCtaHref =
    ctaHref === null
      ? null
      : (ctaHref ?? (isServiceUnavailable ? "/admin" : isAccessUnverified ? "/admin" : "/admin/login"));

  const loadingLabel = isServiceUnavailable
    ? (onCtaClick ? "Retrying…" : "Loading…")
    : isAccessUnverified
      ? "Returning…"
      : "Redirecting…";

  const isBusy = isPending || isHandling;
  const hasCta = Boolean(onCtaClick || resolvedCtaHref);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (isBusy) {
      e.preventDefault();
      return;
    }

    if (onCtaClick) {
      e.preventDefault();
      setIsHandling(true);
      Promise.resolve(onCtaClick())
        .catch(() => {})
        .finally(() => setIsHandling(false));
      return;
    }

    if (resolvedCtaHref) {
      e.preventDefault();
      setIsHandling(true);
      startTransition(() => {
        router.push(resolvedCtaHref);
      });
    }
  };

  return (
    <div className="cg-access-verify-root" role="alert" aria-live="polite">
      {/* Decorative Subtle Ambient Background Waves Matching Wireframe */}
      <div className="cg-access-verify-ambient" aria-hidden="true">
        {/* Top-Right Soft Wave Accent */}
        <svg
          className="cg-access-verify-wave-top-right"
          viewBox="0 0 600 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 120 -80 C 260 40, 360 80, 520 20 C 600 -10, 640 -50, 680 -90 L 680 500 L -20 500 Z"
            fill="url(#cg-verify-ambient-tr)"
            opacity="0.45"
          />
          <path
            d="M 180 -60 C 300 70, 420 120, 620 50"
            stroke="#93C5FD"
            strokeWidth="28"
            strokeLinecap="round"
            opacity="0.25"
            filter="url(#cg-verify-blur-tr)"
          />
          <defs>
            <linearGradient id="cg-verify-ambient-tr" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#BAE6FD" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.1" />
            </linearGradient>
            <filter id="cg-verify-blur-tr" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="30" />
            </filter>
          </defs>
        </svg>

        {/* Bottom-Left Soft Wave Accent */}
        <svg
          className="cg-access-verify-wave-bottom-left"
          viewBox="0 0 600 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M -100 520 C 80 400, 220 380, 320 460 C 380 510, 420 560, 460 620 L -100 620 Z"
            fill="url(#cg-verify-ambient-bl)"
            opacity="0.4"
          />
          <defs>
            <linearGradient id="cg-verify-ambient-bl" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>

        {/* Bottom-Right Soft Wave Accent */}
        <svg
          className="cg-access-verify-wave-bottom-right"
          viewBox="0 0 600 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 680 500 C 500 380, 360 410, 260 490 L 680 580 Z"
            fill="#E0F2FE"
            opacity="0.5"
          />
        </svg>
      </div>

      {/* Top Left CareGanga Foundation Logo Header */}
      <header className="cg-access-verify-header">
        <Link href="/admin" className="cg-access-verify-brand" aria-label="CareGanga Foundation Home">
          <img
            src="/careganga-mark.png"
            alt="CareGanga Foundation Mark"
            width={44}
            height={44}
            className="cg-access-verify-brand-logo"
            onError={e => {
              (e.currentTarget as HTMLImageElement).src = "/careganga-brand-header.png";
            }}
          />
          <div className="cg-access-verify-brand-text">
            <span className="cg-access-verify-brand-title">CareGanga</span>
            <span className="cg-access-verify-brand-sub">FOUNDATION</span>
          </div>
        </Link>
      </header>

      {/* Main Centered Content Canvas */}
      <main className="cg-access-verify-main">
        <motion.div
          className="cg-access-verify-card"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 14, scale: shouldReduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: shouldReduceMotion ? 0 : 0.42,
            ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
          }}
        >
          {/* Centered Graphic Illustration matching wireframe */}
          <div className="cg-access-verify-illustration-wrap" aria-hidden="true">
            {isAccessUnverified ? (
              /* State 1: Shield with Padlock and Exclamation Alert Badge on Light Blue Arch */
              <svg
                className="cg-access-verify-illustration-svg"
                viewBox="0 0 180 150"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Top-Left Ray Accent Ticks */}
                <line x1="28" y1="46" x2="35" y2="39" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="22" y1="57" x2="31" y2="57" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="26" y1="68" x2="34" y2="71" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />

                {/* Base Semi-Circle Arch */}
                <path
                  d="M 22 132 A 68 68 0 0 1 158 132 Z"
                  fill="#E0F2FE"
                />

                {/* 3D Glassy Blue Shield */}
                <g filter="url(#cg-shield-shadow)">
                  <path
                    d="M 54 44 C 70 39, 110 39, 126 44 C 130 74, 122 106, 90 126 C 58 106, 50 74, 54 44 Z"
                    fill="url(#cg-shield-gradient)"
                  />
                  {/* Subtle Top Inner Highlight */}
                  <path
                    d="M 58 48 C 72 43, 108 43, 122 48 C 124 64, 121 84, 108 102 C 102 96, 94 92, 86 92 C 72 92, 63 99, 58 104 C 55 86, 56 64, 58 48 Z"
                    fill="url(#cg-shield-highlight)"
                    opacity="0.32"
                  />
                </g>

                {/* White Padlock on Shield */}
                {/* Shackle */}
                <path
                  d="M 80 69 V 59 C 80 53.5, 100 53.5, 100 59 V 69"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                />
                {/* Lock Body */}
                <rect
                  x="73"
                  y="67"
                  width="34"
                  height="26"
                  rx="5"
                  fill="#FFFFFF"
                  filter="url(#cg-lock-subtle-shadow)"
                />
                {/* Keyhole */}
                <circle cx="90" cy="78" r="2.8" fill="#1D4ED8" />
                <polygon points="88.2,78 91.8,78 92.4,85 87.6,85" fill="#1D4ED8" />

                {/* Pinkish-Red Exclamation Alert Badge at Bottom Right */}
                <g filter="url(#cg-badge-shadow)">
                  <circle cx="126" cy="108" r="16.5" fill="url(#cg-exclaim-gradient)" />
                  {/* White Exclamation Mark */}
                  <rect x="124.4" y="99" width="3.2" height="10" rx="1.6" fill="#FFFFFF" />
                  <circle cx="126" cy="113.8" r="1.8" fill="#FFFFFF" />
                </g>

                <defs>
                  {/* Shield Gradient */}
                  <linearGradient id="cg-shield-gradient" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA" />
                    <stop offset="42%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>

                  <linearGradient id="cg-shield-highlight" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </linearGradient>

                  {/* Exclamation Badge Gradient */}
                  <linearGradient id="cg-exclaim-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FB7185" />
                    <stop offset="45%" stopColor="#F43F5E" />
                    <stop offset="100%" stopColor="#E11D48" />
                  </linearGradient>

                  {/* Filter Shadows */}
                  <filter id="cg-shield-shadow" x="30" y="24" width="120" height="120" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#1D4ED8" floodOpacity="0.28" />
                  </filter>

                  <filter id="cg-lock-subtle-shadow" x="70" y="65" width="40" height="32" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E3A8A" floodOpacity="0.16" />
                  </filter>

                  <filter id="cg-badge-shadow" x="104" y="86" width="44" height="44" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#E11D48" floodOpacity="0.38" />
                  </filter>
                </defs>
              </svg>
            ) : isServiceUnavailable ? (
              /* State 3: Cloud / Service Offline with Amber Alert Badge on Light Blue Arch */
              <svg
                className="cg-access-verify-illustration-svg"
                viewBox="0 0 180 150"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Top-Left Ray Accent Ticks */}
                <line x1="28" y1="46" x2="35" y2="39" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="22" y1="57" x2="31" y2="57" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="26" y1="68" x2="34" y2="71" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />

                {/* Base Semi-Circle Arch */}
                <path
                  d="M 22 132 A 68 68 0 0 1 158 132 Z"
                  fill="#E0F2FE"
                />

                {/* 3D Glassy Cloud Body */}
                <g filter="url(#cg-cloud-shadow)">
                  <path
                    d="M 64 92 C 54 92, 46 84, 46 74 C 46 64.5, 53 56.5, 62 56 C 66 43, 78 34, 92 34 C 108 34, 121 45, 124 60 C 132 61, 138 68, 138 76 C 138 85, 131 92, 122 92 Z"
                    fill="url(#cg-cloud-gradient)"
                  />
                  {/* Subtle Top Inner Highlight */}
                  <path
                    d="M 66 88 C 58 88, 52 82, 52 74 C 52 66, 58 60, 65 59 C 69 48, 80 40, 92 40 C 105 40, 116 49, 119 62 C 126 63, 131 69, 131 76 C 131 83, 126 88, 119 88 Z"
                    fill="url(#cg-shield-highlight)"
                    opacity="0.25"
                  />
                </g>

                {/* Signal Arcs on Cloud */}
                <path
                  d="M 74 72 C 84 64, 100 64, 110 72"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <path
                  d="M 82 80 C 87 76, 97 76, 102 80"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <circle cx="92" cy="87" r="2.4" fill="#FFFFFF" />

                {/* Amber Alert / Offline Badge at Bottom Right */}
                <g filter="url(#cg-amber-badge-shadow)">
                  <circle cx="126" cy="108" r="16.5" fill="url(#cg-amber-badge-gradient)" />
                  <rect x="124.4" y="99" width="3.2" height="10" rx="1.6" fill="#FFFFFF" />
                  <circle cx="126" cy="113.8" r="1.8" fill="#FFFFFF" />
                </g>

                <defs>
                  <linearGradient id="cg-cloud-gradient" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#60A5FA" />
                    <stop offset="45%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>

                  <linearGradient id="cg-amber-badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FBBF24" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                  </linearGradient>

                  <filter id="cg-cloud-shadow" x="26" y="20" width="132" height="100" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#1D4ED8" floodOpacity="0.25" />
                  </filter>

                  <filter id="cg-amber-badge-shadow" x="104" y="86" width="44" height="44" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#D97706" floodOpacity="0.38" />
                  </filter>
                </defs>
              </svg>
            ) : (
              /* State 2: ID Card with Lanyard Clip, Avatar, and Blue Lock Badge on Light Blue Arch */
              <svg
                className="cg-access-verify-illustration-svg"
                viewBox="0 0 180 150"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Top-Left Ray Accent Ticks */}
                <line x1="28" y1="46" x2="35" y2="39" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="22" y1="57" x2="31" y2="57" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                <line x1="26" y1="68" x2="34" y2="71" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />

                {/* Base Semi-Circle Arch */}
                <path
                  d="M 22 132 A 68 68 0 0 1 158 132 Z"
                  fill="#E0F2FE"
                />

                {/* Lanyard Top Clip */}
                <g filter="url(#cg-clip-shadow)">
                  <rect x="80.5" y="32" width="19" height="14" rx="4" fill="#2563EB" />
                  <rect x="84" y="36.5" width="12" height="5" rx="2.5" fill="#FFFFFF" />
                </g>

                {/* ID Card Body */}
                <g filter="url(#cg-idcard-shadow)">
                  <rect
                    x="42"
                    y="42"
                    width="96"
                    height="68"
                    rx="10"
                    fill="#FFFFFF"
                    stroke="#93C5FD"
                    strokeWidth="2.4"
                  />

                  {/* Left Avatar Portrait Box */}
                  <rect x="52" y="53" width="28" height="32" rx="5" fill="#DBEAFE" />
                  {/* Avatar Head Silhouette */}
                  <circle cx="66" cy="63.5" r="5.2" fill="#93C5FD" />
                  {/* Avatar Body Silhouette */}
                  <path
                    d="M 57 81 C 57 73.5, 75 73.5, 75 81 Z"
                    fill="#93C5FD"
                  />

                  {/* Right Credential Lines */}
                  <rect x="86" y="56" width="40" height="5" rx="2.5" fill="#60A5FA" />
                  <rect x="86" y="66" width="30" height="4.5" rx="2.25" fill="#93C5FD" />
                  <rect x="86" y="75" width="22" height="4" rx="2" fill="#BFDBFE" />
                </g>

                {/* Royal Blue Lock Badge at Bottom Right of ID Card */}
                <g filter="url(#cg-lockbadge-shadow)">
                  <circle cx="128" cy="106" r="16" fill="url(#cg-id-lock-gradient)" />
                  {/* White Padlock Inside Badge */}
                  <path
                    d="M 124 102 V 97.5 C 124 94.8, 132 94.8, 132 97.5 V 102"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <rect x="120.5" y="101" width="15" height="11" rx="2.5" fill="#FFFFFF" />
                  <circle cx="128" cy="105.5" r="1.3" fill="#1D4ED8" />
                  <rect x="127.35" y="105.5" width="1.3" height="3" fill="#1D4ED8" />
                </g>

                <defs>
                  {/* ID Card Lock Badge Gradient */}
                  <linearGradient id="cg-id-lock-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#1D4ED8" />
                  </linearGradient>

                  {/* ID Card Drop Shadow */}
                  <filter id="cg-idcard-shadow" x="26" y="28" width="128" height="100" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#1D4ED8" floodOpacity="0.2" />
                  </filter>

                  <filter id="cg-clip-shadow" x="74" y="28" width="32" height="26" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1E3A8A" floodOpacity="0.22" />
                  </filter>

                  <filter id="cg-lockbadge-shadow" x="106" y="84" width="44" height="44" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#1D4ED8" floodOpacity="0.38" />
                  </filter>
                </defs>
              </svg>
            )}
          </div>

          {/* Heading */}
          <h1 className="cg-access-verify-title">{resolvedTitle}</h1>

          {/* Supporting Text */}
          <p className="cg-access-verify-desc">{resolvedDescription}</p>

          {/* Interactive CTA Button or Link */}
          {hasCta ? (
            <div className="cg-access-verify-cta-wrap">
              {resolvedCtaHref ? (
                <Link
                  href={resolvedCtaHref}
                  onClick={handleClick}
                  className={`cg-access-verify-btn ${isBusy ? "cg-access-verify-btn-busy" : ""}`}
                  aria-label={resolvedCtaLabel}
                  aria-busy={isBusy}
                >
                  {isBusy ? (
                    <>
                      <span className="cg-access-verify-spinner" aria-hidden="true" />
                      <span>{loadingLabel}</span>
                    </>
                  ) : isServiceUnavailable ? (
                    <>
                      <svg
                        className="cg-access-verify-btn-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      <span>{resolvedCtaLabel}</span>
                    </>
                  ) : isAccessUnverified ? (
                    <>
                      {/* Left Arrow Icon */}
                      <svg
                        className="cg-access-verify-btn-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                      <span>{resolvedCtaLabel}</span>
                    </>
                  ) : (
                    <>
                      {/* User Sign-In Icon */}
                      <svg
                        className="cg-access-verify-btn-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span>{resolvedCtaLabel}</span>
                    </>
                  )}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleClick}
                  className={`cg-access-verify-btn ${isBusy ? "cg-access-verify-btn-busy" : ""}`}
                  aria-label={resolvedCtaLabel}
                  aria-busy={isBusy}
                >
                  {isBusy ? (
                    <>
                      <span className="cg-access-verify-spinner" aria-hidden="true" />
                      <span>{loadingLabel}</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="cg-access-verify-btn-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="23 4 23 10 17 10" />
                        <polyline points="1 20 1 14 7 14" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      <span>{resolvedCtaLabel}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : null}

          {children ? <div className="cg-access-verify-children" style={{ marginTop: "1rem", width: "100%" }}>{children}</div> : null}
        </motion.div>
      </main>
    </div>
  );
}
