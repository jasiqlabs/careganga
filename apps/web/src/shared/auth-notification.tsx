"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type AuthNotificationType = "SUCCESS" | "ERROR" | "INFO" | "WARNING";

export interface AuthNotificationItem {
  id: string;
  type: AuthNotificationType;
  title: string;
  subtitle?: string;
  message: string;
  durationMs?: number;
}

// Global listener store for in-page notification triggers
type NotificationListener = (item: AuthNotificationItem | null) => void;
const listeners = new Set<NotificationListener>();

export function showAuthNotification(notification: Omit<AuthNotificationItem, "id"> & { id?: string }) {
  const item: AuthNotificationItem = {
    ...notification,
    id: notification.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    durationMs: notification.durationMs ?? 3000
  };
  listeners.forEach(fn => fn(item));
}

export function dismissAuthNotification() {
  listeners.forEach(fn => fn(null));
}

/**
 * Premium Compact Notification Container
 * - Fixed top-right corner, 320–360px desktop width
 * - Synchronized 3-second progress countdown
 * - Smooth slide-in/fade-in from right and smooth slide-out on dismissal
 * - Instant manual dismissal via [ OK ] or [ X ] with timeout cancellation
 */
export function AuthNotificationContainer() {
  const [current, setCurrent] = useState<AuthNotificationItem | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);
  const isDismissingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    clearTimers();
    setIsDismissing(true);

    // Smooth exit transition before removing from DOM
    exitTimerRef.current = setTimeout(() => {
      setCurrent(null);
      setIsDismissing(false);
      isDismissingRef.current = false;
    }, 220);
  }, [clearTimers]);

  useEffect(() => {
    const onNotify: NotificationListener = item => {
      clearTimers();
      isDismissingRef.current = false;

      if (!item) {
        setIsDismissing(true);
        exitTimerRef.current = setTimeout(() => {
          setCurrent(null);
          setIsDismissing(false);
        }, 220);
        return;
      }

      setIsDismissing(false);
      setCurrent(item);
      const duration = item.durationMs ?? 3000;
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    };

    listeners.add(onNotify);
    return () => {
      listeners.delete(onNotify);
      clearTimers();
    };
  }, [clearTimers, handleDismiss]);

  if (!current) return null;

  const isSuccess = current.type === "SUCCESS";
  const durationMs = current.durationMs ?? 3000;

  return (
    <aside
      className={`cg-auth-toast-root ${isDismissing ? "is-exiting" : "is-entering"}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className={`cg-auth-toast-card ${isSuccess ? "cg-auth-toast-success" : "cg-auth-toast-error"}`}>
        <div className="cg-auth-toast-header">
          <div className="cg-auth-toast-badge-group">
            <span className={`cg-auth-toast-badge ${isSuccess ? "badge-success" : "badge-error"}`}>
              {isSuccess ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
              )}
              <span>{isSuccess ? "Success" : "Error"}</span>
            </span>
          </div>
          <button
            type="button"
            className="cg-auth-toast-close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="cg-auth-toast-body">
          <h2 className="cg-auth-toast-title">{current.title}</h2>
          {current.subtitle && <p className="cg-auth-toast-subtitle">{current.subtitle}</p>}
          <p className="cg-auth-toast-message">{current.message}</p>
        </div>

        <div className="cg-auth-toast-actions">
          <button
            type="button"
            className={`cg-auth-toast-ok-btn ${isSuccess ? "ok-btn-success" : "ok-btn-error"}`}
            onClick={handleDismiss}
          >
            OK
          </button>
        </div>

        {/* Synchronized animated 3-second progress indicator */}
        <div className="cg-auth-toast-progress-track" aria-hidden="true">
          <div
            className={`cg-auth-toast-progress-bar ${isSuccess ? "progress-success" : "progress-error"}`}
            style={{ animationDuration: `${durationMs}ms` }}
            onAnimationEnd={handleDismiss}
          />
        </div>
      </div>
    </aside>
  );
}

/**
 * Client listener for dashboard pages (e.g. /admin).
 * Checks sessionStorage for a pending login welcome event, displays the toast once,
 * and immediately purges the session event to prevent duplicate triggers on refresh or navigation.
 */
export function AuthWelcomeListener({
  displayName,
  roleName
}: {
  displayName?: string;
  roleName?: string;
}) {
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("cg_auth_event");
      if (stored) {
        sessionStorage.removeItem("cg_auth_event");
        const parsed = JSON.parse(stored) as { type?: string; displayName?: string };
        if (parsed.type === "LOGIN_SUCCESS") {
          const name = displayName || parsed.displayName || "Staff Member";
          const roleSuffix = roleName ? ` (${roleName})` : "";
          showAuthNotification({
            type: "SUCCESS",
            title: "Welcome Back!",
            subtitle: `Welcome, ${name}${roleSuffix}.`,
            message: "Successfully signed in to CareGanga Foundation.",
            durationMs: 3000
          });
        }
      }
    } catch {
      // sessionStorage unavailable or restricted
    }
  }, [displayName, roleName]);

  return <AuthNotificationContainer />;
}
