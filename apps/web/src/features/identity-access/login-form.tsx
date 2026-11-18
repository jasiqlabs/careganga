"use client";

import { FormEvent, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { showAuthNotification } from "../../shared/auth-notification";

interface LoginFormProps {
  onForgotPassword?: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Field-level error states
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Global authentication error (positioned strictly above the Sign In button)
  const [globalError, setGlobalError] = useState("");

  // Client format validation aligned with backend contract (session.controller.ts:16-21)
  const isMobile = (val: string) => /^[6-9][0-9]{9}$/.test(val.trim());
  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleIdentifierChange = useCallback((value: string) => {
    setIdentifier(value);
    if (identifierError) setIdentifierError("");
    if (globalError) setGlobalError("");
  }, [identifierError, globalError]);

  const handlePasswordChange = useCallback((value: string) => {
    setPassword(value);
    if (passwordError) setPasswordError("");
    if (globalError) setGlobalError("");
  }, [passwordError, globalError]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    // Reset errors before validation
    setIdentifierError("");
    setPasswordError("");
    setGlobalError("");

    const trimmedIdentifier = identifier.trim();
    let hasValidationError = false;

    if (!trimmedIdentifier) {
      setIdentifierError("Mobile number or email is required.");
      hasValidationError = true;
    } else if (!isMobile(trimmedIdentifier) && !isEmail(trimmedIdentifier)) {
      setIdentifierError("Invalid mobile number or email. Please check and try again.");
      hasValidationError = true;
    }

    if (!password) {
      setPasswordError("Password is required.");
      hasValidationError = true;
    }

    if (hasValidationError) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/session/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: trimmedIdentifier,
          password,
          rememberMe
        })
      });

      const data = (await response.json().catch(() => null)) as {
        message?: string;
        code?: string;
        displayName?: string;
        signedIn?: boolean;
        field?: string;
      } | null;

      if (!response.ok) {
        setLoading(false);

        const safe = data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {};

        if (response.status === 400) {
          const target = safe.field === "identifier" || safe.field === "password" ? safe.field : null;
          const msg =
            typeof safe.message === "string" && safe.message.length >= 10 && safe.message.length <= 220
              ? safe.message
              : "Check the mobile number/email and password fields before signing in.";
          if (target === "identifier") {
            setIdentifierError(msg);
          } else if (target === "password") {
            setPasswordError(msg);
          } else {
            setGlobalError(msg);
          }
          showAuthNotification({
            type: "ERROR",
            title: "Validation Error",
            message: msg
          });
        } else if (response.status === 401) {
          // Identity failures share one generic server-owned, Admin-editable message.
          // Never reveal whether the identifier exists or the account is inactive.
          const isSafe =
            safe.code === "IDENTITY_LOGIN_INVALID" &&
            typeof safe.message === "string" &&
            safe.message.length >= 16 &&
            safe.message.length <= 220;
          const msg = isSafe
            ? (safe.message as string)
            : "Mobile number/email or password could not be confirmed.";
          setGlobalError(msg);
          showAuthNotification({
            type: "ERROR",
            title: "Sign-In Failed",
            message: msg
          });
        } else if (response.status === 429) {
          const msg = "Too many login attempts. Please try again later.";
          setGlobalError(msg);
          showAuthNotification({
            type: "ERROR",
            title: "Too Many Attempts",
            message: msg
          });
        } else {
          const msg = "Sign-in cannot be confirmed right now. Check your connection and retry.";
          setGlobalError(msg);
          showAuthNotification({
            type: "ERROR",
            title: "Sign-In Unavailable",
            message: msg
          });
        }
        return;
      }

      // Successful authentication
      try {
        sessionStorage.setItem(
          "cg_auth_event",
          JSON.stringify({
            type: "LOGIN_SUCCESS",
            displayName: data?.displayName
          })
        );
      } catch {
        // Storage restricted or unavailable
      }

      setPassword("");
      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      const msg = "Sign-in cannot be confirmed right now. Check your connection and retry.";
      setGlobalError(msg);
      showAuthNotification({
        type: "ERROR",
        title: "Connection Error",
        message: msg
      });
    }
  }

  return (
    <form className="cg-login-form-premium" onSubmit={signIn} noValidate suppressHydrationWarning>
      {/* Field 1: Identifier */}
      <div className="cg-form-group">
        <label htmlFor="cg-identifier" className="cg-form-label">
          MOBILE NUMBER OR EMAIL
        </label>
        <div
          className={`cg-input-wrapper ${identifierError ? "is-invalid" : ""}`}
        >
          <span className="cg-input-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path
                d="M4 21c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            id="cg-identifier"
            type="text"
            className="cg-text-input"
            value={identifier}
            onChange={e => handleIdentifierChange(e.target.value)}
            placeholder="9876543210"
            maxLength={254}
            autoCapitalize="none"
            autoComplete="username"
            disabled={loading}
            aria-invalid={Boolean(identifierError)}
            aria-describedby={identifierError ? "identifier-error" : undefined}
            suppressHydrationWarning
          />
        </div>
        {identifierError && (
          <p id="identifier-error" className="cg-field-error-message" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span>{identifierError}</span>
          </p>
        )}
      </div>

      {/* Field 2: Password */}
      <div className="cg-form-group">
        <div className="cg-form-label-row">
          <label htmlFor="cg-password" className="cg-form-label">
            PASSWORD
          </label>
        </div>
        <div className={`cg-input-wrapper ${passwordError ? "is-invalid" : ""}`}>
          <span className="cg-input-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <input
            id="cg-password"
            type={visible ? "text" : "password"}
            className="cg-text-input"
            value={password}
            onChange={e => handlePasswordChange(e.target.value)}
            placeholder="Enter your password"
            maxLength={1024}
            autoComplete="current-password"
            disabled={loading}
            aria-invalid={Boolean(passwordError)}
            aria-describedby={passwordError ? "password-error" : undefined}
            suppressHydrationWarning
          />
          <button
            type="button"
            className="cg-password-visibility-btn"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            tabIndex={0}
            suppressHydrationWarning
          >
            {visible ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M3 21 21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
        {passwordError && (
          <p id="password-error" className="cg-field-error-message" role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            <span>{passwordError}</span>
          </p>
        )}
      </div>

      {/* Row: Remember Me & Forgot Password */}
      <div className="cg-login-row-helpers">
        <label className="cg-remember-me-label" htmlFor="cg-remember-me">
          <input
            id="cg-remember-me"
            type="checkbox"
            className="cg-remember-checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <span className="cg-remember-me-text">Remember Me</span>
        </label>

        {onForgotPassword ? (
          <button
            type="button"
            className="cg-forgot-password-link"
            onClick={onForgotPassword}
            disabled={loading}
          >
            Forgot Password?
          </button>
        ) : (
          <Link href="/admin/recovery" className="cg-forgot-password-link">
            Forgot Password?
          </Link>
        )}
      </div>

      {/* Global Error Banner strictly positioned ABOVE the action button */}
      {globalError && (
        <div className="cg-global-auth-error-banner" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          <span>{globalError}</span>
        </div>
      )}

      {/* Primary Action Button: Gradient Blue-to-Green CTA with Framer Motion feedback */}
      <motion.button
        className="cg-login-submit-gradient-btn"
        type="submit"
        disabled={loading || !identifier.trim() || !password}
        whileHover={
          !loading && identifier.trim() && password && !shouldReduceMotion
            ? { scale: 1.015 }
            : undefined
        }
        whileTap={
          !loading && identifier.trim() && password && !shouldReduceMotion
            ? { scale: 0.985 }
            : undefined
        }
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        suppressHydrationWarning
      >
        {loading ? (
          <span className="cg-btn-spinner-content">
            <span className="cg-spinner-circle" aria-hidden="true" />
            <span>SIGNING IN…</span>
          </span>
        ) : (
          <span className="cg-btn-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M8 7l-5 5 5 5M16 7l5 5-5 5M3 12h18"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>SIGN IN</span>
          </span>
        )}
      </motion.button>

      {/* OR Divider */}
      <div className="cg-login-or-divider">
        <span>OR</span>
      </div>

      {/* Secure Access Section */}
      <div className="cg-login-secure-access-box">
        <div className="cg-secure-access-title">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              stroke="#2563EB"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <strong>Secure Access</strong>
        </div>
        <p className="cg-secure-access-desc">
          Only authorized CareGanga Foundation users can access this portal.
        </p>
      </div>

      {/* Bottom Trust Indicators: SSL Encrypted / Secure System / Authorized Personnel Only */}
      <div className="cg-login-trust-bar">
        <div className="cg-trust-cell">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#10B981" strokeWidth="2" />
            <path d="m9 12 2 2 4-4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="cg-trust-label">SSL Encrypted</span>
        </div>
        <div className="cg-trust-cell cg-trust-cell-divider">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2 2 7l10 5 10-5-10-5Z" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m2 17 10 5 10-5M2 12l10 5 10-5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="cg-trust-label">Secure System</span>
        </div>
        <div className="cg-trust-cell">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="7" r="4" stroke="#F59E0B" strokeWidth="2" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="cg-trust-label">Authorized Personnel Only</span>
        </div>
      </div>
    </form>
  );
}
