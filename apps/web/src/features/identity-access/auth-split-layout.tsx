"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LoginForm } from "./login-form";
import { RecoveryForm } from "./recovery-form";
import {
  AuthPresentationConfig,
  defaultAuthPresentationConfig
} from "./auth-presentation-config";
import { AuthNotificationContainer } from "../../shared/auth-notification";

interface AuthSplitLayoutProps {
  initialView?: "login" | "recovery";
  config?: AuthPresentationConfig;
}

export function AuthSplitLayout({
  initialView = "login",
  config = defaultAuthPresentationConfig
}: AuthSplitLayoutProps) {
  const [view, setView] = useState<"login" | "recovery">(initialView);
  const shouldReduceMotion = useReducedMotion();

  // Framer Motion Animation Variants with Reduced-Motion Support
  const pageContainerVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const brandingVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : -8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        delay: shouldReduceMotion ? 0 : 0.08
      }
    }
  };

  const editorialVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.55,
        delay: shouldReduceMotion ? 0 : 0.12
      }
    }
  };

  const wheelVariants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.88 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.65,
        delay: shouldReduceMotion ? 0 : 0.16,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const heroVariants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.7,
        delay: shouldReduceMotion ? 0 : 0.2
      }
    }
  };

  const featureContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.07,
        delayChildren: shouldReduceMotion ? 0 : 0.25
      }
    }
  };

  const featureItemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.4,
        ease: "easeOut"
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.65,
        delay: shouldReduceMotion ? 0 : 0.12,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const lockBadgeVariants = {
    hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        delay: shouldReduceMotion ? 0 : 0.24,
        type: "spring",
        stiffness: 260,
        damping: 20
      }
    }
  };

  return (
    <main className="cg-auth-page-root">
      {/* Reusable Top-Right Notification Container */}
      <AuthNotificationContainer />

      {/* Decorative ambient glowing cyan wave curves matching Reference 1 & 2 */}
      <div className="cg-auth-ambient-wave-left" aria-hidden="true">
        <svg viewBox="0 0 600 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="cg-wave-svg">
          <path
            d="M-80 100 C 140 160, 220 380, 80 640 C 0 780, -70 840, -110 890"
            stroke="url(#cyan-glow-gradient-1)"
            strokeWidth="42"
            strokeLinecap="round"
            filter="url(#cyan-blur-1)"
            opacity="0.65"
          />
          <path
            d="M-60 130 C 120 190, 190 380, 70 610"
            stroke="#00f2fe"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          <defs>
            <linearGradient id="cyan-glow-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00c6ff" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#0284c7" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <filter id="cyan-blur-1" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="28" />
            </filter>
          </defs>
        </svg>
      </div>

      <div className="cg-auth-ambient-wave-right" aria-hidden="true">
        <svg viewBox="0 0 600 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="cg-wave-svg">
          <path
            d="M 680 750 C 450 670, 380 450, 520 210 C 580 110, 650 40, 720 -10"
            stroke="url(#cyan-glow-gradient-2)"
            strokeWidth="42"
            strokeLinecap="round"
            filter="url(#cyan-blur-2)"
            opacity="0.6"
          />
          <path
            d="M 650 710 C 460 640, 400 450, 520 230"
            stroke="#38bdf8"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          <defs>
            <linearGradient id="cyan-glow-gradient-2" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <filter id="cyan-blur-2" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="28" />
            </filter>
          </defs>
        </svg>
      </div>

      <motion.div
        className="cg-auth-shell-container"
        variants={pageContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Main Connected Split-Screen Container with Glowing Cyan Border */}
        <div className="cg-auth-split-grid">
          {/* LEFT PANEL: Branding, Welcome, Initiative Wheel & Community Hero */}
          <aside className="cg-auth-left-panel" aria-label="CareGanga Foundation overview">
            {/* Top Row: Logo & Tagline */}
            <motion.header className="cg-auth-brand-header" variants={brandingVariants}>
              <div className="cg-auth-brand-logo-wrap">
                <img
                  src={config.branding.logoSrc}
                  alt={config.branding.logoAlt}
                  width={52}
                  height={52}
                  className="cg-auth-brand-logo-img"
                  onError={e => {
                    // Safe fallback if mark image is missing
                    (e.currentTarget as HTMLImageElement).src = "/careganga-brand-header.png";
                  }}
                />
              </div>
              <div className="cg-auth-brand-text-wrap">
                <div className="cg-auth-brand-title-line">
                  <span className="cg-auth-brand-name">
                    <span className="brand-care">Care</span>
                    <span className="brand-ganga">Ganga</span>
                  </span>
                </div>
                <div className="cg-auth-brand-sub-line">
                  <span className="cg-auth-brand-foundation">{config.branding.foundationLabel}</span>
                </div>
                <div className="cg-auth-brand-tagline">
                  <span className="tagline-word word-care">Care</span>
                  <span className="tagline-dot dot-orange">•</span>
                  <span className="tagline-word word-empower">Empower</span>
                  <span className="tagline-dot dot-blue">•</span>
                  <span className="tagline-word word-transform">Transform</span>
                </div>
              </div>
            </motion.header>

            {/* Middle Section: Welcome, Headings & Mission with Initiative Wheel */}
            <div className="cg-auth-editorial-section">
              <motion.div className="cg-auth-editorial-copy" variants={editorialVariants}>
                <span className="cg-auth-welcome-prefix">{config.editorial.welcomePrefix}</span>
                <h1 className="cg-auth-main-heading">
                  <span className="heading-brand">{config.editorial.brandTitle}</span>{" "}
                  <span className="heading-accent">{config.editorial.accentWord}</span>
                </h1>
                <h2 className="cg-auth-system-subtitle">{config.editorial.systemSubtitle}</h2>
                <p className="cg-auth-mission-statement">{config.editorial.missionStatement}</p>
              </motion.div>

              {/* Initiative Wheel Graphic */}
              <motion.div
                className="cg-auth-wheel-wrapper"
                aria-hidden="true"
                variants={wheelVariants}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.04, rotate: 2 }}
              >
                <div className="cg-auth-wheel-glow-ring" />
                <img
                  src={config.media.initiativeWheelSrc}
                  alt={config.media.initiativeWheelAlt}
                  width={140}
                  height={140}
                  className="cg-auth-wheel-img"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).src = "/careganga-initiative-wheel.jpg";
                  }}
                />
              </motion.div>
            </div>

            {/* Bottom Hero Image with Floating 4-Feature Indicators */}
            <motion.div className="cg-auth-hero-media-wrap" variants={heroVariants}>
              <img
                src={config.media.heroImageSrc}
                alt={config.media.heroImageAlt}
                className="cg-auth-hero-img"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                }}
              />
              <div className="cg-auth-hero-gradient-overlay" aria-hidden="true" />

              {/* Frosted Glass Pill Bar: 4 Core Features */}
              <motion.div
                className="cg-auth-features-frosted-bar"
                variants={featureContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {config.features.map(f => (
                  <motion.div
                    key={f.id}
                    className="cg-feature-item"
                    variants={featureItemVariants}
                  >
                    <span
                      className="cg-feature-badge"
                      style={{ backgroundColor: f.color }}
                      aria-hidden="true"
                    >
                      {f.icon === "shield" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#FFF" strokeWidth="2.5" />
                          <path d="m9 12 2 2 4-4" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {f.icon === "dashboard" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#FFF" />
                          <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#FFF" />
                          <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#FFF" />
                          <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#FFF" />
                        </svg>
                      )}
                      {f.icon === "chart" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <line x1="18" y1="20" x2="18" y2="10" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="12" y1="20" x2="12" y2="4" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="6" y1="20" x2="6" y2="14" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" />
                        </svg>
                      )}
                      {f.icon === "lock" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <rect x="5" y="11" width="14" height="10" rx="2" stroke="#FFF" strokeWidth="2.5" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#FFF" strokeWidth="2.5" />
                        </svg>
                      )}
                    </span>
                    <span className="cg-feature-label">{f.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </aside>

          {/* RIGHT PANEL: Auth Card (Seamlessly connected inside the same parent container) */}
          <section className="cg-auth-right-panel" aria-labelledby="cg-auth-card-title">
            <motion.div className="cg-auth-form-card" variants={cardVariants}>
              {/* Centered Lock Badge with subtle entrance animation */}
              <motion.div
                className="cg-auth-lock-badge"
                aria-hidden="true"
                variants={lockBadgeVariants}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1.5" fill="currentColor" />
                </svg>
              </motion.div>

              {/* Heading & Subtitle */}
              <h2 id="cg-auth-card-title" className="cg-auth-card-heading">
                {view === "login" ? "Sign in to your Account" : "Recover Foundation Staff Access"}
              </h2>
              <p className="cg-auth-card-subheading">
                {view === "login"
                  ? "Please enter your registered mobile number or email and password to continue"
                  : "Reset your password using a secure one-time verification code."}
              </p>

              {/* Form Content Switched In-Place with AnimatePresence */}
              <div className="cg-auth-form-switcher">
                <AnimatePresence mode="wait">
                  {view === "login" ? (
                    <motion.div
                      key="login-form-view"
                      initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: shouldReduceMotion ? 0 : 10 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeInOut" }}
                    >
                      <LoginForm onForgotPassword={() => setView("recovery")} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="recovery-form-view"
                      initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -10 }}
                      transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeInOut" }}
                    >
                      <RecoveryForm onReturnToSignIn={() => setView("login")} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </section>
        </div>

        {/* PAGE FOOTER */}
        <footer className="cg-auth-page-footer">
          <nav className="cg-auth-footer-nav" aria-label="Help and legal links">
            {config.footer.aboutHref && (
              <Link href={config.footer.aboutHref} className="cg-auth-footer-link">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
                  <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" />
                  <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                <span>{config.footer.aboutLabel ?? "About Us"}</span>
              </Link>
            )}

            <Link href={config.footer.verifyEmployeeHref} className="cg-auth-footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <line x1="7" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.8" />
                <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="1.8" />
                <line x1="7" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>{config.footer.verifyEmployeeLabel}</span>
            </Link>

            <Link href={config.footer.contactSupportHref} className="cg-auth-footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
              <span>{config.footer.contactSupportLabel}</span>
            </Link>

            <Link href={config.footer.privacyHref} className="cg-auth-footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>{config.footer.privacyLabel}</span>
            </Link>

            <Link href={config.footer.termsHref} className="cg-auth-footer-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.8" />
                <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" />
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" />
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              <span>{config.footer.termsLabel}</span>
            </Link>
          </nav>

          <div className="cg-auth-footer-meta">
            <span className="cg-auth-copyright">{config.footer.copyrightText}</span>
            <span className="cg-auth-version-badge">{config.footer.versionText}</span>
          </div>
        </footer>
      </motion.div>
    </main>
  );
}
