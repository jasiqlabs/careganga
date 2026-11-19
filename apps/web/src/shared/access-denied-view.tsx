"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

export interface AccessDeniedViewProps {
  title?: string;
  reason?: string;
  accountHref?: string;
  accountLabel?: string;
  onAccountClick?: () => void;
}

export function AccessDeniedView({
  title = "Access Denied",
  reason = "Security Policy is restricted to the Foundation Super Admin.",
  accountHref = "/admin",
  accountLabel = "My Account",
  onAccountClick
}: AccessDeniedViewProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="cg-access-denied-root" role="alert" aria-live="polite">
      {/* Background Ambient Gradient Waves */}
      <div className="cg-access-denied-ambient" aria-hidden="true">
        {/* Top-Left Waves */}
        <svg
          className="cg-access-denied-wave-top-left"
          viewBox="0 0 700 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M -100 -50 C 150 50, 280 250, 160 520 C 120 590, 50 640, -20 680"
            stroke="url(#cg-wave-grad-1)"
            strokeWidth="58"
            strokeLinecap="round"
            filter="url(#cg-wave-blur-1)"
            opacity="0.7"
          />
          <path
            d="M -60 40 C 180 120, 260 300, 190 480"
            stroke="url(#cg-wave-grad-2)"
            strokeWidth="28"
            strokeLinecap="round"
            filter="url(#cg-wave-blur-2)"
            opacity="0.8"
          />
          <path
            d="M -40 100 C 120 160, 200 280, 150 420"
            stroke="#38BDF8"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.65"
          />
          <defs>
            <linearGradient id="cg-wave-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="cg-wave-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6EE7B7" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#0EA5E9" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.2" />
            </linearGradient>
            <filter id="cg-wave-blur-1" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="32" />
            </filter>
            <filter id="cg-wave-blur-2" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="20" />
            </filter>
          </defs>
        </svg>

        {/* Bottom-Right Waves */}
        <svg
          className="cg-access-denied-wave-bottom-right"
          viewBox="0 0 700 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 800 650 C 550 550, 420 350, 540 80 C 580 10, 650 -40, 720 -80"
            stroke="url(#cg-wave-grad-3)"
            strokeWidth="64"
            strokeLinecap="round"
            filter="url(#cg-wave-blur-3)"
            opacity="0.75"
          />
          <path
            d="M 760 560 C 520 480, 440 300, 510 120"
            stroke="url(#cg-wave-grad-4)"
            strokeWidth="32"
            strokeLinecap="round"
            filter="url(#cg-wave-blur-4)"
            opacity="0.8"
          />
          <path
            d="M 720 500 C 540 430, 480 310, 530 180"
            stroke="#06B6D4"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.65"
          />
          <defs>
            <linearGradient id="cg-wave-grad-3" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#0284C7" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="cg-wave-grad-4" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#34D399" stopOpacity="0.8" />
              <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#1E53DC" stopOpacity="0.25" />
            </linearGradient>
            <filter id="cg-wave-blur-3" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="32" />
            </filter>
            <filter id="cg-wave-blur-4" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="18" />
            </filter>
          </defs>
        </svg>
      </div>

      {/* Centered Premium Access Denied Card */}
      <motion.main
        className="cg-access-denied-card"
        initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.45,
          ease: [0.16, 1, 0.3, 1] as [number, number, number, number]
        }}
      >
        {/* Top Accent Gradient Border */}
        <div className="cg-access-denied-card-top-accent" aria-hidden="true" />

        {/* Branding Section */}
        <header className="cg-access-denied-brand">
          <img
            src="/careganga-mark.png"
            alt="CareGanga Foundation"
            width={46}
            height={46}
            className="cg-access-denied-brand-logo"
            onError={e => {
              (e.currentTarget as HTMLImageElement).src = "/careganga-brand-header.png";
            }}
          />
          <div className="cg-access-denied-brand-text">
            <span className="cg-access-denied-brand-title">CAREGANGA</span>
            <span className="cg-access-denied-brand-sub">FOUNDATION</span>
          </div>
        </header>

        {/* Security Illustration */}
        <div className="cg-access-denied-illustration-wrap" aria-hidden="true">
          <div className="cg-access-denied-glow-circle" />
          <svg
            className="cg-access-denied-shield-svg"
            viewBox="0 0 88 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Sparkle / Accent Rays at Top Right */}
            <line x1="72" y1="12" x2="80" y2="8" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="78" y1="19" x2="86" y2="19" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="74" y1="26" x2="81" y2="30" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />

            {/* Radiant Shield */}
            <path
              d="M 44 8 C 63 8, 74 14, 78 20 C 78 52, 65 74, 44 87 C 23 74, 10 52, 10 20 C 14 14, 25 8, 44 8 Z"
              fill="url(#cg-shield-gradient)"
              stroke="rgba(255, 255, 255, 0.45)"
              strokeWidth="1.5"
            />

            {/* Inner Shield Shimmer */}
            <path
              d="M 44 13 C 60 13, 69 18, 72 23 C 72 50, 60 69, 44 80 C 28 69, 16 50, 16 23 C 19 18, 28 13, 44 13 Z"
              fill="url(#cg-shield-inner-glow)"
              opacity="0.45"
            />

            {/* Padlock Shackle */}
            <path
              d="M 37 44 V 35 C 37 30, 51 30, 51 35 V 44"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4.2"
              strokeLinecap="round"
            />

            {/* Padlock Body */}
            <rect
              x="32"
              y="42"
              width="24"
              height="19"
              rx="4"
              fill="#FFFFFF"
            />

            {/* Keyhole Cutout */}
            <circle cx="44" cy="50" r="2.2" fill="#1D4ED8" />
            <polygon points="42.8,50 45.2,50 45.8,55.5 42.2,55.5" fill="#1D4ED8" />

            <defs>
              <linearGradient id="cg-shield-gradient" x1="30%" y1="0%" x2="70%" y2="100%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="48%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <linearGradient id="cg-shield-inner-glow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Main Heading */}
        <h1 className="cg-access-denied-title">{title}</h1>

        {/* Restriction Reason */}
        <p className="cg-access-denied-reason">{reason}</p>

        {/* My Account CTA */}
        {onAccountClick ? (
          <button
            type="button"
            className="cg-access-denied-btn"
            onClick={onAccountClick}
            aria-label={accountLabel}
          >
            <svg
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
            <span>{accountLabel}</span>
            <svg
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
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        ) : (
          <Link
            href={accountHref}
            className="cg-access-denied-btn"
            aria-label={accountLabel}
          >
            <svg
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
            <span>{accountLabel}</span>
            <svg
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
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        )}
      </motion.main>
    </div>
  );
}
