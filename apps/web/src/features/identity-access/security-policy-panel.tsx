"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type Values = {
  maxSessionAgeSeconds: number;
  idleTimeoutSeconds: number;
  failedAttemptWindowSeconds: number;
  maxFailedAttempts: number;
  rootPasswordReauthRequired: true;
};

type View = Values & { revision: number; updatedAt: string | null };

type Draft = {
  maxSessionMinutes: number;
  idleMinutes: number;
  attemptWindowMinutes: number;
  maxFailedAttempts: number;
};

type Notice = { kind: "success" | "error" | "uncertain"; message: string };

type ControlConfig = {
  key: keyof Draft;
  name: string;
  min: number;
  max: number;
  hint: string;
  fieldHint: string;
  placeholder: string;
  unit: "minutes" | "attempts";
  icon: "clock" | "hourglass" | "lightning" | "users";
};

const controls: ControlConfig[] = [
  {
    key: "maxSessionMinutes",
    name: "Maximum session age",
    min: 15,
    max: 480,
    hint: "15 minutes to 8 hours",
    fieldHint: "15 minutes to 8 hours (in minutes)",
    placeholder: "Enter minutes (15–480)",
    unit: "minutes",
    icon: "clock"
  },
  {
    key: "idleMinutes",
    name: "Idle session timeout",
    min: 5,
    max: 60,
    hint: "5 to 60 minutes",
    fieldHint: "5 to 60 minutes (in minutes)",
    placeholder: "Enter minutes (5–60)",
    unit: "minutes",
    icon: "hourglass"
  },
  {
    key: "attemptWindowMinutes",
    name: "Failed-attempt window",
    min: 5,
    max: 60,
    hint: "5 to 60 minutes",
    fieldHint: "5 to 60 minutes (in minutes)",
    placeholder: "Enter minutes (5–60)",
    unit: "minutes",
    icon: "lightning"
  },
  {
    key: "maxFailedAttempts",
    name: "Allowed failed attempts",
    min: 3,
    max: 10,
    hint: "3 to 10 attempts",
    fieldHint: "3 to 10 attempts",
    placeholder: "Enter attempts (3–10)",
    unit: "attempts",
    icon: "users"
  }
];

function draft(p: View): Draft {
  return {
    maxSessionMinutes: p.maxSessionAgeSeconds / 60,
    idleMinutes: p.idleTimeoutSeconds / 60,
    attemptWindowMinutes: p.failedAttemptWindowSeconds / 60,
    maxFailedAttempts: p.maxFailedAttempts
  };
}

function valid(p: unknown): p is View {
  if (!p || typeof p !== "object") return false;
  const d = p as Record<string, unknown>;
  return (
    d.rootPasswordReauthRequired === true &&
    Number.isInteger(d.revision) &&
    Number(d.revision) >= 0 &&
    controls.every(c => {
      const seconds =
        c.key === "maxSessionMinutes"
          ? d.maxSessionAgeSeconds
          : c.key === "idleMinutes"
          ? d.idleTimeoutSeconds
          : c.key === "attemptWindowMinutes"
          ? d.failedAttemptWindowSeconds
          : d.maxFailedAttempts;
      const n = c.key === "maxFailedAttempts" ? seconds : Number(seconds) / 60;
      return Number.isInteger(n) && Number(n) >= c.min && Number(n) <= c.max;
    }) &&
    Number(d.idleTimeoutSeconds) <= Number(d.maxSessionAgeSeconds) &&
    (d.updatedAt === null || typeof d.updatedAt === "string")
  );
}

function getFieldError(
  key: string,
  currentValues: Draft | null,
  password: string
): string | null {
  if (!currentValues) return null;
  if (key === "maxSessionMinutes") {
    const v = currentValues.maxSessionMinutes;
    if (isNaN(v) || v < 15 || v > 480 || !Number.isInteger(v)) {
      return "Enter a value between 15 and 480 minutes.";
    }
  } else if (key === "idleMinutes") {
    const v = currentValues.idleMinutes;
    if (isNaN(v) || v < 5 || v > 60 || !Number.isInteger(v)) {
      return "Enter a value between 5 and 60 minutes.";
    }
    if (v > currentValues.maxSessionMinutes) {
      return "Idle timeout cannot exceed maximum session age.";
    }
  } else if (key === "attemptWindowMinutes") {
    const v = currentValues.attemptWindowMinutes;
    if (isNaN(v) || v < 5 || v > 60 || !Number.isInteger(v)) {
      return "Enter a value between 5 and 60 minutes.";
    }
  } else if (key === "maxFailedAttempts") {
    const v = currentValues.maxFailedAttempts;
    if (isNaN(v) || v < 3 || v > 10 || !Number.isInteger(v)) {
      return "Enter a value between 3 and 10 attempts.";
    }
  } else if (key === "currentPassword") {
    if (!password || password.trim().length === 0) {
      return "Current password is required.";
    }
    if (password.length < 8) {
      return "Current password must be at least 8 characters.";
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
   Clean inline SVGs matching CareGanga Foundation visual language
   -------------------------------------------------------------------------- */

function LockIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ClockIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function HourglassIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

function LightningIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function UsersIcon({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CalendarIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function RefreshIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function EditIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CloseIcon({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EyeIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function AlertCircleIcon({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function renderControlIcon(icon: ControlConfig["icon"]) {
  switch (icon) {
    case "clock":
      return <ClockIcon size={18} />;
    case "hourglass":
      return <HourglassIcon size={18} />;
    case "lightning":
      return <LightningIcon size={18} />;
    case "users":
      return <UsersIcon size={18} />;
  }
}

/* --------------------------------------------------------------------------
   Premium Shimmer Skeleton Placeholder Matching Actual Screen Layout
   -------------------------------------------------------------------------- */

function SecurityPolicySkeleton() {
  return (
    <div className="cg-sp-skeleton-wrapper" aria-busy="true" aria-label="Loading security policy">
      {/* Skeleton Page Header */}
      <div className="cg-sp-header">
        <div className="cg-sp-header-left">
          <div className="cg-sp-header-icon-box cg-sp-skeleton-bone" />
          <div className="cg-sp-header-text">
            <div
              className="cg-sp-skeleton-bone"
              style={{ width: "11rem", height: "1.45rem", marginBottom: "0.35rem" }}
            />
            <div
              className="cg-sp-skeleton-bone"
              style={{ width: "22rem", maxWidth: "100%", height: "0.85rem" }}
            />
          </div>
        </div>
        <div className="cg-sp-header-actions">
          <div
            className="cg-sp-skeleton-bone"
            style={{ width: "5.5rem", height: "2.375rem", borderRadius: "0.5rem" }}
          />
          <div
            className="cg-sp-skeleton-bone"
            style={{ width: "6.5rem", height: "2.375rem", borderRadius: "0.5rem" }}
          />
        </div>
      </div>

      {/* Skeleton Configuration Cards Grid — 5 Cards */}
      <div className="cg-sp-grid">
        {[
          { titleW: "9.5rem", valW: "6.5rem", hintW: "8rem" },
          { titleW: "8.5rem", valW: "5.5rem", hintW: "7rem" },
          { titleW: "9.5rem", valW: "5.5rem", hintW: "7rem" },
          { titleW: "10rem", valW: "5.5rem", hintW: "6.5rem" },
          { titleW: "13rem", isBadge: true, hintW: "8.5rem" }
        ].map((item, idx) => (
          <div className="cg-sp-card" key={idx}>
            <div className="cg-sp-card-icon-wrap cg-sp-skeleton-bone" />
            <div className="cg-sp-card-content">
              <div
                className="cg-sp-skeleton-bone"
                style={{ width: item.titleW, maxWidth: "80%", height: "0.8125rem", marginBottom: "0.35rem" }}
              />
              {item.isBadge ? (
                <div className="cg-sp-card-badge-wrap">
                  <div
                    className="cg-sp-skeleton-bone"
                    style={{ width: "4.75rem", height: "1.35rem", borderRadius: "9999px" }}
                  />
                </div>
              ) : (
                <div
                  className="cg-sp-skeleton-bone"
                  style={{ width: item.valW, height: "1.45rem", marginBottom: "0.35rem" }}
                />
              )}
              <div
                className="cg-sp-skeleton-bone"
                style={{ width: item.hintW, maxWidth: "60%", height: "0.75rem" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton Last Updated bar */}
      <div className="cg-sp-last-updated-bar">
        <div
          className="cg-sp-skeleton-bone"
          style={{ width: "1rem", height: "1rem", borderRadius: "0.25rem", flexShrink: 0 }}
        />
        <div
          className="cg-sp-skeleton-bone"
          style={{ width: "15rem", maxWidth: "80%", height: "0.8125rem" }}
        />
      </div>
    </div>
  );
}

export function SecurityPolicyPanel() {
  const [policy, setPolicy] = useState<View | null>(null);
  const [values, setValues] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingOutcome, setCheckingOutcome] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const requestKey = useRef("");
  const readGeneration = useRef(0);
  const dialog = useRef<HTMLElement | null>(null);
  const saveBusy = useRef(false);

  const shouldReduceMotion = useReducedMotion();

  const closeDrawer = useCallback(() => {
    setEditing(false);
    setReview(false);
    setCurrentPassword("");
    setShowPassword(false);
    setTouched({});
  }, []);

  const read = useCallback(async (expectedRevision?: number): Promise<boolean> => {
    const gen = ++readGeneration.current;
    setLoading(true);
    try {
      const resp = await fetch("/api/session/security-policy", {
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!resp.ok)
        throw Error(
          resp.status === 401
            ? "Your session expired. Sign in again."
            : resp.status === 403
            ? "Only the Foundation Super Admin may access this policy."
            : "The current policy cannot be verified."
        );
      const body: unknown = await resp.json();
      if (!valid(body)) throw Error("The policy response could not be verified.");
      if (gen !== readGeneration.current) return false;
      const matched = expectedRevision === undefined || body.revision >= expectedRevision;
      setPolicy(body);
      setValues(draft(body));
      setEditing(false);
      setReview(false);
      setCurrentPassword("");
      setShowPassword(false);
      setTouched({});

      if (matched) {
        setUncertain(false);
        setNotice(null);
        requestKey.current = "";
      } else {
        setUncertain(true);
        setNotice({
          kind: "uncertain",
          message: "The saved revision is not visible yet. Check the previous change before retrying."
        });
      }
      return matched;
    } catch (e) {
      if (gen !== readGeneration.current) return false;
      setPolicy(null);
      setValues(null);
      setEditing(false);
      setReview(false);
      setShowPassword(false);
      setTouched({});
      setNotice({
        kind: "error",
        message: e instanceof Error ? e.message : "Security policy is unavailable."
      });
      return false;
    } finally {
      if (gen === readGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void read();
    return () => {
      ++readGeneration.current;
    };
  }, [read]);

  useEffect(() => {
    if (editing || uncertain) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") void read();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [read, editing, uncertain]);

  useEffect(() => {
    if (!editing) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saveBusy.current) {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const all = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>("input:not([disabled]),button:not([disabled])") ?? []
      ).filter(el => el.getClientRects().length > 0);
      if (!all.length) return;
      if (event.shiftKey && document.activeElement === all[0]) {
        event.preventDefault();
        all[all.length - 1].focus();
      }
      if (!event.shiftKey && document.activeElement === all[all.length - 1]) {
        event.preventDefault();
        all[0].focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [editing, closeDrawer]);

  async function checkOutcome() {
    if (!uncertain || !requestKey.current || checkingOutcome) return;
    setCheckingOutcome(true);
    try {
      const result = await fetch(
        "/api/session/security-policy/changes/" + encodeURIComponent(requestKey.current),
        { cache: "no-store", credentials: "same-origin" }
      );
      if (result.status === 401 || result.status === 403) {
        setPolicy(null);
        setEditing(false);
        setNotice({
          kind: "error",
          message: "Protected access expired. Sign in again to check the change."
        });
        return;
      }
      if (!result.ok) throw Error("No confirmation");
      const value = (await result.json()) as { status?: string; revision?: number | null };
      if (value.status === "CONFIRMED" && Number.isInteger(value.revision)) {
        const verified = await read(Number(value.revision));
        setUncertain(!verified);
        setNotice(
          verified
            ? {
                kind: "success",
                message: "The previously submitted security change was confirmed and reloaded."
              }
            : {
                kind: "uncertain",
                message: "The change was recorded, but its effective revision needs another verification."
              }
        );
      } else {
        setNotice({
          kind: "uncertain",
          message:
            "No committed result is visible for that request yet. Check again or contact Foundation support before retrying."
        });
      }
    } catch {
      setNotice({
        kind: "uncertain",
        message: "The result remains unconfirmed. Check again before making another change."
      });
    } finally {
      setCheckingOutcome(false);
    }
  }

  function start() {
    if (!policy) return;
    requestKey.current = crypto.randomUUID();
    setValues(draft(policy));
    setReview(false);
    setCurrentPassword("");
    setShowPassword(false);
    setTouched({});
    setNotice(null);
    setUncertain(false);
    setEditing(true);
  }

  function change(key: keyof Draft, value: string) {
    setValues(before => (before ? { ...before, [key]: value.trim() === "" ? NaN : Number(value) } : before));
    setReview(false);
    setTouched(prev => ({ ...prev, [key]: true }));
  }

  function handleBlur(key: string) {
    setTouched(prev => ({ ...prev, [key]: true }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policy || !values || busy || uncertain) return;

    setTouched({
      maxSessionMinutes: true,
      idleMinutes: true,
      attemptWindowMinutes: true,
      maxFailedAttempts: true,
      currentPassword: true
    });

    const hasAnyError =
      controls.some(c => getFieldError(c.key, values, currentPassword) !== null) ||
      getFieldError("currentPassword", values, currentPassword) !== null;

    if (hasAnyError) {
      setNotice({
        kind: "error",
        message: "Please correct the highlighted field errors before submitting."
      });
      return;
    }

    if (!review) {
      setReview(true);
      return;
    }

    saveBusy.current = true;
    setBusy(true);
    setNotice(null);
    const payload = {
      maxSessionAgeSeconds: values.maxSessionMinutes * 60,
      idleTimeoutSeconds: values.idleMinutes * 60,
      failedAttemptWindowSeconds: values.attemptWindowMinutes * 60,
      maxFailedAttempts: values.maxFailedAttempts,
      rootPasswordReauthRequired: true,
      expectedRevision: policy.revision,
      idempotencyKey: requestKey.current,
      currentPassword
    };
    try {
      const resp = await fetch("/api/session/security-policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        if (resp.status >= 500) {
          setUncertain(true);
          setNotice({
            kind: "uncertain",
            message: "The outcome could not be confirmed. Refresh to check before retrying."
          });
        } else if (resp.status === 401 || resp.status === 403) {
          setPolicy(null);
          setEditing(false);
          setShowPassword(false);
          setNotice({ kind: "error", message: "Your protected access is no longer verified." });
        } else if (resp.status === 409) {
          setNotice({
            kind: "error",
            message: "This policy changed elsewhere. Keep your values and refresh before saving."
          });
        } else {
          const message =
            resp.status === 429
              ? "Too many code attempts. Try again later."
              : "Policy change was not accepted. Verify the limits and enter a current password.";
          setReview(false);
          setNotice({ kind: "error", message });
        }
        return;
      }
      const ack: unknown = await resp.json();
      if (!ack || typeof ack !== "object" || !("revision" in ack) || !Number.isInteger(ack.revision))
        throw Error("Unconfirmed result");

      setEditing(false);
      setReview(false);
      setCurrentPassword("");
      setShowPassword(false);
      setTouched({});
      const verified = await read(Number(ack.revision));
      if (!verified) setUncertain(true);
      setNotice(
        verified
          ? {
              kind: "success",
              message: "Security policy saved and verified. Existing staff sessions follow the updated limits."
            }
          : {
              kind: "uncertain",
              message:
                "The server acknowledged the change, but the effective policy could not be verified. Check the previous change before editing."
            }
      );
    } catch {
      setUncertain(true);
      setNotice({
        kind: "uncertain",
        message: "The result may already have been saved. Refresh the effective policy before another attempt."
      });
    } finally {
      setBusy(false);
      saveBusy.current = false;
    }
  }

  const formattedDate =
    policy?.updatedAt != null
      ? new Date(policy.updatedAt).toLocaleString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        })
      : "Secure Foundation defaults";

  const passwordError = touched.currentPassword
    ? getFieldError("currentPassword", values, currentPassword)
    : null;

  const isInitialLoading = loading && !policy;

  return (
    <motion.section
      className="cg-sp-workspace"
      aria-label="Security Policy Management"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {/* 1. Initial Loading State — Premium Shimmer Skeleton Layout */}
      {isInitialLoading ? (
        <SecurityPolicySkeleton />
      ) : !loading && !policy ? (
        /* 2. Error State — No Policy Loaded */
        <div className="cg-sp-error-state" role="alert">
          <div className="cg-sp-notice error">
            {notice?.message || "Security policy information is temporarily unavailable."}
          </div>
          <button
            type="button"
            className="cg-sp-btn-retry"
            onClick={() => void read()}
            aria-label="Retry loading security policy"
          >
            <RefreshIcon size={15} />
            <span>Retry</span>
          </button>
        </div>
      ) : policy ? (
        /* 3. Successful State & Background Refresh */
        <>
          {/* Page Header / Title Section */}
          <header className="cg-sp-header">
            <div className="cg-sp-header-left">
              <div className="cg-sp-header-icon-box" aria-hidden="true">
                <LockIcon size={22} />
              </div>
              <div className="cg-sp-header-text">
                <h1 className="cg-sp-title">Security Policy</h1>
                <p className="cg-sp-subtitle">
                  Authentication and session security settings for the foundation platform.
                </p>
              </div>
            </div>
            <div className="cg-sp-header-actions">
              <button
                type="button"
                className="cg-sp-btn-refresh"
                disabled={loading || busy || uncertain}
                onClick={() => void read()}
                aria-label="Refresh security policy"
              >
                <RefreshIcon size={15} className={loading ? "cg-sp-spin" : ""} />
                <span>{loading ? "Refreshing…" : "Refresh"}</span>
              </button>
              {!editing && (
                <button
                  type="button"
                  className="cg-sp-btn-edit"
                  onClick={start}
                  disabled={loading || busy || uncertain}
                  aria-label="Edit security policy"
                >
                  <EditIcon size={15} />
                  <span>Edit Policy</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Notice Banner (when not in drawer) */}
          {notice && !editing && (
            <div
              className={`cg-sp-notice ${notice.kind}`}
              role={notice.kind === "success" ? "status" : "alert"}
            >
              {notice.message}
            </div>
          )}

          {/* Uncertain Outcome Notice */}
          {uncertain && (
            <div className="cg-sp-uncertain-box" role="alert">
              <div className="cg-sp-uncertain-content">
                <p className="cg-sp-uncertain-text">
                  Do not submit the same change again until its saved outcome is checked.
                </p>
                <button
                  type="button"
                  className="cg-sp-btn-check-outcome"
                  disabled={checkingOutcome}
                  onClick={() => void checkOutcome()}
                >
                  {checkingOutcome ? "Checking…" : "Check previous change"}
                </button>
              </div>
            </div>
          )}

          {/* Security Configuration Cards Grid */}
          <div className="cg-sp-grid">
            {/* Cards 1-4: Editable Policies */}
            {controls.map(c => {
              const currentVal = draft(policy)[c.key];
              return (
                <motion.article
                  className="cg-sp-card"
                  key={c.key}
                  whileHover={shouldReduceMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}
                >
                  <div className="cg-sp-card-icon-wrap" aria-hidden="true">
                    {renderControlIcon(c.icon)}
                  </div>
                  <div className="cg-sp-card-content">
                    <h3 className="cg-sp-card-title">{c.name}</h3>
                    <p className="cg-sp-card-value">
                      {currentVal} {c.unit}
                    </p>
                    <p className="cg-sp-card-hint">{c.hint}</p>
                  </div>
                </motion.article>
              );
            })}

            {/* Card 5: Super Admin Password Confirmation (Mandatory) */}
            <motion.article
              className="cg-sp-card"
              whileHover={shouldReduceMotion ? undefined : { y: -2, transition: { duration: 0.15 } }}
            >
              <div className="cg-sp-card-icon-wrap" aria-hidden="true">
                <LockIcon size={18} />
              </div>
              <div className="cg-sp-card-content">
                <h3 className="cg-sp-card-title">Super Admin password confirmation</h3>
                <div className="cg-sp-card-badge-wrap">
                  <span className="cg-sp-badge-required">Required</span>
                </div>
                <p className="cg-sp-card-hint">Cannot be turned off.</p>
              </div>
            </motion.article>
          </div>

          {/* Last Updated Information */}
          <div className="cg-sp-last-updated-bar">
            <CalendarIcon size={15} className="cg-sp-last-updated-icon" />
            <span>
              Last updated: <strong className="cg-sp-last-updated-time">{formattedDate}</strong>
            </span>
          </div>
        </>
      ) : null}

      {/* Edit Security Policy — Right-side 3-Part Viewport-Aware Drawer */}
      <AnimatePresence>
        {editing && policy && values && (
          <motion.div
            className="cg-sp-drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            onClick={e => {
              if (e.target === e.currentTarget && !busy) {
                closeDrawer();
              }
            }}
          >
            <motion.section
              className="cg-sp-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="security-policy-title"
              ref={dialog}
              initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
              animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", damping: 32, stiffness: 350 }
              }
            >
              {/* Sticky/Fixed Drawer Header */}
              <header className="cg-sp-drawer-header">
                <div className="cg-sp-drawer-header-left">
                  <div className="cg-sp-drawer-icon-box" aria-hidden="true">
                    <EditIcon size={16} />
                  </div>
                  <div className="cg-sp-drawer-header-text">
                    <h2 id="security-policy-title" className="cg-sp-drawer-title">
                      Edit Security Policy
                    </h2>
                    <p className="cg-sp-drawer-subtitle">
                      Update authentication and session security settings
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-sp-drawer-close-btn"
                  aria-label="Close drawer"
                  disabled={busy}
                  onClick={closeDrawer}
                >
                  <CloseIcon size={18} />
                </button>
              </header>

              {/* Drawer Form Container with independent scrolling body and fixed footer */}
              <form className="cg-sp-drawer-form" onSubmit={e => void submit(e)} noValidate>
                <div className="cg-sp-drawer-body">
                  {/* 4 Editable Fields in Exact Order */}
                  {controls.map(c => {
                    const fieldError = touched[c.key] ? getFieldError(c.key, values, currentPassword) : null;
                    return (
                      <div className="cg-sp-field" key={c.key}>
                        <label htmlFor={`cg-sp-${c.key}`} className="cg-sp-label">
                          {c.name} <span className="cg-sp-required" aria-hidden="true">*</span>
                        </label>
                        <input
                          id={`cg-sp-${c.key}`}
                          required
                          type="number"
                          min={c.min}
                          max={c.max}
                          step={1}
                          inputMode="numeric"
                          placeholder={c.placeholder}
                          className={`cg-sp-input${fieldError ? " invalid" : ""}`}
                          aria-invalid={!!fieldError}
                          aria-describedby={fieldError ? `cg-sp-${c.key}-error` : `cg-sp-${c.key}-help`}
                          value={Number.isFinite(values[c.key]) ? values[c.key] : ""}
                          onChange={e => change(c.key, e.target.value)}
                          onBlur={() => handleBlur(c.key)}
                        />
                        {fieldError ? (
                          <div className="cg-sp-field-error" id={`cg-sp-${c.key}-error`} role="alert">
                            <AlertCircleIcon size={13} className="cg-sp-field-error-icon" />
                            <span>{fieldError}</span>
                          </div>
                        ) : (
                          <span className="cg-sp-helper" id={`cg-sp-${c.key}-help`}>
                            {c.fieldHint}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Super Admin Password Confirmation: Mandatory Info Section */}
                  <div className="cg-sp-mandatory-box">
                    <div className="cg-sp-mandatory-icon" aria-hidden="true">
                      <LockIcon size={17} />
                    </div>
                    <div className="cg-sp-mandatory-content">
                      <div className="cg-sp-mandatory-row">
                        <span>Super Admin password confirmation:</span>
                        <span className="cg-sp-badge-required">Required</span>
                      </div>
                      <p className="cg-sp-mandatory-sub">
                        This setting is mandatory and cannot be turned off.
                      </p>
                    </div>
                  </div>

                  {/* Current Password Confirmation with Eye Show/Hide Toggle */}
                  <div className="cg-sp-field">
                    <label htmlFor="cg-sp-current-password" className="cg-sp-label">
                      Confirm with your current password <span className="cg-sp-required" aria-hidden="true">*</span>
                    </label>
                    <div className="cg-sp-password-wrap">
                      <input
                        id="cg-sp-current-password"
                        required
                        type={showPassword ? "text" : "password"}
                        minLength={8}
                        maxLength={1024}
                        autoComplete="current-password"
                        placeholder="Enter your current password"
                        className={`cg-sp-password-input${passwordError ? " invalid" : ""}`}
                        aria-invalid={!!passwordError}
                        aria-describedby={passwordError ? "cg-sp-password-error" : undefined}
                        value={currentPassword}
                        onChange={e => {
                          setCurrentPassword(e.target.value);
                          setReview(false);
                          setTouched(prev => ({ ...prev, currentPassword: true }));
                        }}
                        onBlur={() => handleBlur("currentPassword")}
                      />
                      <button
                        type="button"
                        className="cg-sp-password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(v => !v)}
                      >
                        {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    {passwordError && (
                      <div className="cg-sp-field-error" id="cg-sp-password-error" role="alert">
                        <AlertCircleIcon size={13} className="cg-sp-field-error-icon" />
                        <span>{passwordError}</span>
                      </div>
                    )}
                  </div>

                  {/* Review Change Workflow Banner */}
                  {review && (
                    <div className="cg-sp-review-banner" role="status">
                      <div className="cg-sp-review-title">Review security policy change</div>
                      <p className="cg-sp-review-desc">
                        Existing sessions may expire immediately when limits are shortened. This change is audited.
                      </p>
                    </div>
                  )}

                  {/* Drawer-level Notice / Validation Error */}
                  {notice && (
                    <div
                      className={`cg-sp-notice ${notice.kind}`}
                      role={notice.kind === "success" ? "status" : "alert"}
                    >
                      {notice.message}
                    </div>
                  )}
                </div>

                {/* Persistent Fixed Drawer Footer */}
                <div className="cg-sp-drawer-footer">
                  <button
                    type="button"
                    className="cg-sp-btn-cancel"
                    disabled={busy}
                    onClick={closeDrawer}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cg-sp-btn-submit"
                    disabled={busy || uncertain || currentPassword.length < 8}
                  >
                    {busy ? (
                      <>
                        <span className="cg-sp-btn-spinner" aria-hidden="true" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={15} />
                        <span>{review ? "Confirm and save" : "Review Change"}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
