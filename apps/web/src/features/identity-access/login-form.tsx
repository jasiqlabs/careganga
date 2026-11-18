"use client";

import { FormEvent, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { showAuthNotification } from "../../shared/auth-notification";

interface LoginFormProps {
  onForgotPassword?: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const router = useRouter();
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

    // Scenario C: Empty fields
    if (!trimmedIdentifier) {
      setIdentifierError("Mobile number or email is required.");
      hasValidationError = true;
    } else if (!isMobile(trimmedIdentifier) && !isEmail(trimmedIdentifier)) {
      // Scenario D: Invalid format
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
      } | null;

      if (!response.ok) {
        setLoading(false);

        if (response.status === 401) {
          // Check if backend explicitly identified an invalid password or invalid identifier
          if (data?.code === "INVALID_PASSWORD") {
            // Scenario A: Explicit incorrect password
            setPasswordError("Incorrect password. Please try again.");
            setGlobalError("Sign-in failed. Please check your credentials and try again.");
            showAuthNotification({
              type: "ERROR",
              title: "Sign-In Failed",
              message: "Incorrect password. Please try again."
            });
          } else if (data?.code === "INVALID_IDENTIFIER") {
            // Scenario B: Explicit invalid identifier
            setIdentifierError("Invalid mobile number or email. Please check and try again.");
            setGlobalError("Sign-in failed. Please check your credentials and try again.");
            showAuthNotification({
              type: "ERROR",
              title: "Sign-In Failed",
              message: "Invalid mobile number or email. Please check and try again."
            });
          } else {
            // Generic 401 credentials failure (Security / OWASP best practice: fields stay neutral)
            setGlobalError("Sign-in failed. Please check your credentials and try again.");
            showAuthNotification({
              type: "ERROR",
              title: "Sign-In Failed",
              message: "Mobile number/email or password could not be confirmed."
            });
          }
        } else if (response.status === 429) {
          // Rate limited
          setGlobalError("Too many login attempts. Please try again later.");
          showAuthNotification({
            type: "ERROR",
            title: "Too Many Attempts",
            message: "Too many sign-in attempts. Please try again later."
          });
        } else {
          // Scenario E: Server or service failure (do not mark fields red)
          setGlobalError("Unable to sign in right now. Please try again later.");
          showAuthNotification({
            type: "ERROR",
            title: "Sign-In Unavailable",
            message: "Unable to sign in right now. Please try again later."
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
      router.replace("/admin");
      router.refresh();
    } catch {
      // Scenario E: Network failure
      setLoading(false);
      setGlobalError("Unable to sign in right now. Please try again later.");
      showAuthNotification({
        type: "ERROR",
        title: "Connection Error",
        message: "Something went wrong. Please check your connection and try again."
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
        <label htmlFor="cg-password" className="cg-form-label">
          PASSWORD
        </label>
        <div
          className={`cg-input-wrapper ${passwordError ? "is-invalid" : ""}`}
        >
          <span className="cg-input-icon" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <input
            id="cg-password"
            type={visible ? "text" : "password"}
            className="cg-text-input"
            value={password}
            onChange={e => handlePasswordChange(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••••••••••"
            maxLength={1024}
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
        <label className="cg-remember-me-label">
          <input
            type="checkbox"
            className="cg-remember-checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            disabled={loading}
            suppressHydrationWarning
          />
          <span>Remember Me</span>
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

      {/* Global Authentication Error Banner strictly positioned ABOVE the Sign In button */}
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

      {/* Sign In Button with Blue-to-Green Gradient */}
      <button
        className="cg-login-submit-gradient-btn"
        type="submit"
        disabled={loading}
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
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>SIGN IN</span>
          </span>
        )}
      </button>

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
