"use client";

import { FormEvent, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { showAuthNotification } from "../../shared/auth-notification";

interface RecoveryFormProps {
  onReturnToSignIn?: () => void;
}

export function RecoveryForm({ onReturnToSignIn }: RecoveryFormProps) {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("sms");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  // Error states
  const [identifierError, setIdentifierError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const requestKey = useRef("");

  // Format validation
  const isMobile = (val: string) => /^[6-9][0-9]{9}$/.test(val.trim());
  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleIdentifierChange = useCallback((val: string) => {
    setIdentifier(val);
    setChannel(val.includes("@") ? "email" : "sms");
    if (identifierError) setIdentifierError("");
    if (globalError) setGlobalError("");
  }, [identifierError, globalError]);

  const handleOtpChange = useCallback((val: string) => {
    const cleaned = val.replace(/[^0-9]/g, "").slice(0, 6);
    setOtp(cleaned);
    if (otpError) setOtpError("");
    if (globalError) setGlobalError("");
  }, [otpError, globalError]);

  const handlePasswordChange = useCallback((val: string) => {
    setNewPassword(val);
    if (passwordError) setPasswordError("");
    if (globalError) setGlobalError("");
  }, [passwordError, globalError]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    // Reset error feedback
    setIdentifierError("");
    setOtpError("");
    setPasswordError("");
    setGlobalError("");
    setUncertain(false);

    const trimmed = identifier.trim();

    if (step === "request") {
      let hasError = false;
      if (!trimmed) {
        setIdentifierError("Registered mobile number or email is required.");
        hasError = true;
      } else if (!isMobile(trimmed) && !isEmail(trimmed)) {
        setIdentifierError("Invalid mobile number or email. Please check and try again.");
        hasError = true;
      }

      if (hasError) return;

      if (!requestKey.current) {
        requestKey.current = crypto.randomUUID();
      }

      setLoading(true);
      try {
        const response = await fetch("/api/session/recovery/request", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: trimmed,
            channel,
            requestKey: requestKey.current
          })
        });

        if (!response.ok) {
          setLoading(false);
          if (response.status === 429) {
            setGlobalError("Too many attempts. Please try again later.");
            showAuthNotification({
              type: "ERROR",
              title: "Limit Exceeded",
              message: "Too many recovery attempts. Please try again later."
            });
          } else {
            setGlobalError("Unable to process recovery request. Please try again later.");
            showAuthNotification({
              type: "ERROR",
              title: "Recovery Unavailable",
              message: "Unable to send the verification code right now. Please try again later."
            });
          }
          return;
        }

        setLoading(false);
        setStep("confirm");
        setInfoMessage(
          "If this account exists, a 6-digit verification code will be sent to its registered contact. Codes expire in 10 minutes."
        );
      } catch {
        setLoading(false);
        setGlobalError("Unable to confirm request outcome. Please check your connection and try again.");
        showAuthNotification({
          type: "ERROR",
          title: "Connection Error",
          message: "Something went wrong. Please try again later."
        });
      }
    } else {
      // Step: confirm
      let hasError = false;
      if (!otp || otp.length !== 6) {
        setOtpError("Enter the 6-digit verification code.");
        hasError = true;
      }
      if (!newPassword || newPassword.length < 8) {
        setPasswordError("New password must be at least 8 characters.");
        hasError = true;
      }

      if (hasError) return;

      setLoading(true);
      try {
        const response = await fetch("/api/session/recovery/confirm", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: trimmed,
            otp,
            newPassword
          })
        });

        if (!response.ok) {
          setLoading(false);
          if (response.status === 429) {
            setGlobalError("Too many verification attempts. Please try again later.");
            showAuthNotification({
              type: "ERROR",
              title: "Limit Exceeded",
              message: "Too many verification attempts. Please try again later."
            });
          } else if (response.status === 400) {
            setOtpError("Invalid verification code. Please check and try again.");
            setGlobalError("Verification code or new password could not be confirmed.");
            showAuthNotification({
              type: "ERROR",
              title: "Verification Failed",
              message: "Invalid verification code. Please check and try again."
            });
          } else {
            setGlobalError("Password recovery is temporarily unavailable.");
            showAuthNotification({
              type: "ERROR",
              title: "Recovery Failed",
              message: "Something went wrong. Please try again later."
            });
            if (response.status >= 500) setUncertain(true);
          }
          return;
        }

        setLoading(false);
        setDone(true);
        setOtp("");
        setNewPassword("");
        setInfoMessage("Your password has been successfully reset. Please return to sign in.");
        showAuthNotification({
          type: "SUCCESS",
          title: "Password Reset Successful",
          message: "Your password has been updated. You can now sign in.",
          durationMs: 4000
        });
      } catch {
        setLoading(false);
        setUncertain(true);
        setGlobalError("We could not confirm the outcome. Please check before submitting again.");
        showAuthNotification({
          type: "ERROR",
          title: "Connection Error",
          message: "Something went wrong. Please try again later."
        });
      }
    }
  }

  return (
    <form className="cg-login-form-premium" onSubmit={submit} noValidate suppressHydrationWarning>
      {/* Informational Message Banner */}
      {infoMessage && (
        <div className="cg-recovery-info-banner" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Step 1: Request OTP */}
      {step === "request" && !done && (
        <>
          <div className="cg-form-group">
            <label htmlFor="cg-recovery-identifier" className="cg-form-label">
              REGISTERED MOBILE NUMBER OR EMAIL
            </label>
            <div className={`cg-input-wrapper ${identifierError ? "is-invalid" : ""}`}>
              <span className="cg-input-icon" aria-hidden="true">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M4 21c0-4.5 3.5-7.5 8-7.5s8 3 8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                id="cg-recovery-identifier"
                type="text"
                className="cg-text-input"
                value={identifier}
                onChange={e => handleIdentifierChange(e.target.value)}
                placeholder="Enter mobile number or email"
                maxLength={254}
                autoComplete="username"
                disabled={loading}
                aria-invalid={Boolean(identifierError)}
                aria-describedby={identifierError ? "recovery-id-error" : undefined}
                suppressHydrationWarning
              />
            </div>
            {identifierError && (
              <p id="recovery-id-error" className="cg-field-error-message" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <span>{identifierError}</span>
              </p>
            )}
          </div>

          <div className="cg-form-group">
            <label className="cg-form-label">RECEIVE RESET OTP BY</label>
            <div className="cg-channel-selector-row">
              <button
                type="button"
                className={`cg-channel-pill-btn ${channel === "sms" ? "is-selected" : ""}`}
                onClick={() => setChannel("sms")}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>SMS</span>
              </button>
              <button
                type="button"
                className={`cg-channel-pill-btn ${channel === "email" ? "is-selected" : ""}`}
                onClick={() => setChannel("email")}
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" />
                  <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Email</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Confirm OTP & Set New Password */}
      {step === "confirm" && !done && (
        <>
          <div className="cg-form-group">
            <label htmlFor="cg-recovery-otp" className="cg-form-label">
              RESET OTP
            </label>
            <div className={`cg-input-wrapper ${otpError ? "is-invalid" : ""}`}>
              <span className="cg-input-icon" aria-hidden="true">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
              <input
                id="cg-recovery-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="cg-text-input"
                value={otp}
                onChange={e => handleOtpChange(e.target.value)}
                placeholder="Enter 6-digit OTP"
                autoComplete="one-time-code"
                disabled={loading}
                aria-invalid={Boolean(otpError)}
                aria-describedby={otpError ? "recovery-otp-error" : undefined}
                suppressHydrationWarning
              />
            </div>
            {otpError && (
              <p id="recovery-otp-error" className="cg-field-error-message" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <span>{otpError}</span>
              </p>
            )}
          </div>

          <div className="cg-form-group">
            <label htmlFor="cg-recovery-new-password" className="cg-form-label">
              NEW PASSWORD
            </label>
            <div className={`cg-input-wrapper ${passwordError ? "is-invalid" : ""}`}>
              <span className="cg-input-icon" aria-hidden="true">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
              <input
                id="cg-recovery-new-password"
                type={visible ? "text" : "password"}
                className="cg-text-input"
                value={newPassword}
                onChange={e => handlePasswordChange(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={1024}
                disabled={loading}
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? "recovery-pwd-error" : undefined}
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
              <p id="recovery-pwd-error" className="cg-field-error-message" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
                <span>{passwordError}</span>
              </p>
            )}
          </div>
        </>
      )}

      {/* Global Error Banner strictly positioned ABOVE the action button */}
      {globalError && (
        <div className={`cg-global-auth-error-banner ${uncertain ? "is-uncertain" : ""}`} role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
          <span>{globalError}</span>
        </div>
      )}

      {/* Action Buttons */}
      {!done && (
        <motion.button
          className="cg-login-submit-gradient-btn"
          type="submit"
          disabled={loading || uncertain || (step === "confirm" && (otp.length !== 6 || newPassword.length < 8))}
          whileHover={
            !loading && !uncertain && !(step === "confirm" && (otp.length !== 6 || newPassword.length < 8)) && !shouldReduceMotion
              ? { scale: 1.015 }
              : undefined
          }
          whileTap={
            !loading && !uncertain && !(step === "confirm" && (otp.length !== 6 || newPassword.length < 8)) && !shouldReduceMotion
              ? { scale: 0.985 }
              : undefined
          }
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          suppressHydrationWarning
        >
          {loading ? (
            <span className="cg-btn-spinner-content">
              <span className="cg-spinner-circle" aria-hidden="true" />
              <span>{step === "request" ? "SENDING CODE…" : "RESETTING PASSWORD…"}</span>
            </span>
          ) : (
            <span className="cg-btn-content">
              <span>{step === "request" ? "SEND RESET OTP" : "RESET PASSWORD"}</span>
            </span>
          )}
        </motion.button>
      )}

      {/* Request another OTP action */}
      {step === "confirm" && !done && (
        <motion.button
          type="button"
          className="cg-secondary-action-btn"
          disabled={loading}
          whileHover={!loading && !shouldReduceMotion ? { scale: 1.01 } : undefined}
          whileTap={!loading && !shouldReduceMotion ? { scale: 0.99 } : undefined}
          onClick={() => {
            setStep("request");
            setOtp("");
            setNewPassword("");
            requestKey.current = "";
            setInfoMessage("You can request another verification code after the resend cooldown.");
          }}
        >
          Request another OTP
        </motion.button>
      )}

      {/* Return to Sign In */}
      <div className="cg-return-signin-container">
        {onReturnToSignIn ? (
          <button
            type="button"
            className="cg-return-signin-btn"
            onClick={onReturnToSignIn}
            disabled={loading}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5m7-7l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Return to Sign In</span>
          </button>
        ) : (
          <Link href="/admin/login" className="cg-return-signin-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5m7-7l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Return to Sign In</span>
          </Link>
        )}
      </div>
    </form>
  );
}
