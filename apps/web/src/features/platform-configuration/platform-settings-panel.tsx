"use client";
import "./general-settings.css";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type {
  CG21SettingView as Setting,
  CG21SettingRevision as History,
  CG21IntegrationView as Connection
} from "@careganga/api-contracts";
import {
  SlidersIcon,
  HistoryIcon,
  PlugIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  PencilIcon,
  CheckIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
  LayersIcon,
  ChevronRightIcon,
  KeyIcon,
  InfoIcon
} from "./general-settings-icons";
import {
  GeneralSettingsFeedbackModal,
  type FeedbackModalState
} from "./general-settings-feedback-modal";

export class PlatformApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    message?: string
  ) {
    super(message || "API_ERROR");
    this.name = "PlatformApiError";
  }
}

type Notice = { kind: "success" | "error" | "uncertain"; message: string };
const label = (v: string) => v.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const referencePattern = /^secretref:[A-Za-z0-9/_-]{10,230}$/;

async function request<T>(path: string, method = "GET", payload?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/platform/" + path, {
      method, credentials: "same-origin", cache: "no-store",
      ...(payload ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {})
    });
  } catch {
    throw new PlatformApiError(503, "UNCONFIRMED", "The outcome could not be confirmed. Check status before retrying.");
  }
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    const errorMsg = typeof errorBody?.message === "string" ? errorBody.message : undefined;
    const errorCode = typeof errorBody?.code === "string" ? errorBody.code : undefined;
    if (response.status === 401 || response.status === 403) {
      throw new PlatformApiError(response.status, errorCode || "ACCESS_DENIED", errorMsg);
    }
    if (response.status === 409) {
      throw new PlatformApiError(response.status, errorCode || "CONFLICT", errorMsg);
    }
    if (response.status === 400) {
      throw new PlatformApiError(response.status, errorCode || "VALIDATION", errorMsg);
    }
    if (response.status === 429) {
      throw new PlatformApiError(response.status, errorCode || "RETRY_LATER", errorMsg);
    }
    throw new PlatformApiError(response.status, "UNCONFIRMED", errorMsg);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new PlatformApiError(500, "UNCONFIRMED", "The response could not be parsed.");
  }
}

function isSetting(x: unknown): x is Setting {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const s = x as Record<string, unknown>;
  return s.key === "audit.default_page_size" && Number.isInteger(s.value) &&
    Number(s.value) >= 10 && Number(s.value) <= 100 && Number.isInteger(s.revision) &&
    Number(s.revision) >= 0 && (s.updatedAt === null || typeof s.updatedAt === "string");
}

const message = (e: unknown) => {
  if (e instanceof PlatformApiError) {
    if (e.code === "CONFLICT" || e.status === 409) return "This setting changed elsewhere. Refresh before saving.";
    if (e.code === "ACCESS_DENIED" || e.status === 401 || e.status === 403) return e.message || "Your Foundation access is no longer verified. Sign in again.";
    if (e.code === "VALIDATION" || e.status === 400) return e.message || "Check the permitted values and enter a fresh current password.";
    if (e.code === "RETRY_LATER" || e.status === 429) return "Too many verification attempts. Try again later.";
    return "The outcome could not be confirmed. Check the previous change before retrying.";
  }
  const k = e instanceof Error ? e.message : "UNCONFIRMED";
  return k === "CONFLICT" ? "This setting changed elsewhere. Refresh before saving." :
    k === "ACCESS_DENIED" ? "Your Foundation access is no longer verified. Sign in again." :
      k === "VALIDATION" ? "Check the permitted values and enter a fresh current password." :
        k === "RETRY_LATER" ? "Too many verification attempts. Try again later." :
          "The outcome could not be confirmed. Check the previous change before retrying.";
};

export type PlatformSettingsPanelProps = {
  canEdit?: boolean;
};

export function PlatformSettingsPanel({ canEdit = false }: PlatformSettingsPanelProps) {
  const [setting, setSetting] = useState<Setting | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [feedback, setFeedback] = useState<FeedbackModalState | null>(null);
  const [edit, setEdit] = useState(false);
  const [review, setReview] = useState(false);
  const [pageSize, setPageSize] = useState("25");
  const [pageSizeError, setPageSizeError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showAuditPassword, setShowAuditPassword] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [formProvider, setFormProvider] = useState("");
  const [formPurpose, setFormPurpose] = useState("");
  const [formReference, setFormReference] = useState("");
  const [integrationPassword, setIntegrationPassword] = useState("");
  const [integrationEdit, setIntegrationEdit] = useState(false);
  const [integrationReview, setIntegrationReview] = useState(false);
  const [showIntegrationSecret, setShowIntegrationSecret] = useState(false);
  const [showIntegrationPassword, setShowIntegrationPassword] = useState(false);
  const [checking, setChecking] = useState("");
  const [integrationDrawerNotice, setIntegrationDrawerNotice] = useState<string | null>(null);
  const [refFormatError, setRefFormatError] = useState<string | null>(null);
  const [providerFormatError, setProviderFormatError] = useState<string | null>(null);
  const [purposeFormatError, setPurposeFormatError] = useState<string | null>(null);
  const [auditDrawerNotice, setAuditDrawerNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"parameters" | "history" | "integrations" | "errors">("parameters");
  const prefersReducedMotion = useReducedMotion();
  const requestKey = useRef("");
  const pendingAction = useRef<"SETTING_SAVE" | "INTEGRATION_REFERENCE">("SETTING_SAVE");
  const pendingConnection = useRef<{ provider: string; purpose: string } | null>(null);
  const generation = useRef(0);
  const auditDrawerRef = useRef<HTMLElement>(null);
  const integrationDrawerRef = useRef<HTMLElement>(null);

  const reload = useCallback(async (expectedRevision?: number,
    expectedConnection?: { provider: string; purpose: string; revision: number }): Promise<boolean> => {
    const seq = ++generation.current; setLoading(true);
    try {
      const [s, h, c] = await Promise.all([
        request<unknown>("settings"),
        request<{ events: History[] }>("settings/history?limit=20"),
        request<{ connections: Connection[] }>("integrations")
      ]);
      if (!isSetting(s) || !Array.isArray(h.events) || !Array.isArray(c.connections))
        throw Error("UNCONFIRMED");
      if (seq !== generation.current) return false;
      setSetting(s); setHistory(h.events); setConnections(c.connections);
      setPageSize(String(s.value));
      const matchedSetting = expectedRevision === undefined || s.revision >= expectedRevision;
      const savedConnection = expectedConnection ? c.connections.find(x =>
        x.provider === expectedConnection.provider && x.purpose === expectedConnection.purpose) : null;
      const matchedConnection = !expectedConnection ||
        (savedConnection !== null && savedConnection !== undefined &&
          savedConnection.revision >= expectedConnection.revision);
      const matched = matchedSetting && matchedConnection;
      if (matched && (expectedRevision !== undefined || expectedConnection !== undefined)) {
        setUnknown(false); requestKey.current = "";
      }
      return matched;
    } catch (e) {
      if (seq !== generation.current) return false;
      setSetting(null); setHistory([]); setConnections([]);
      setNotice({ kind: "error", message: message(e) });
      return false;
    } finally { if (seq === generation.current) setLoading(false); }
  }, []);

  useEffect(() => {
    void reload();
    return () => { ++generation.current; };
  }, [reload]);

  // Focus management and keyboard trap for Audit Drawer
  useEffect(() => {
    if (!edit) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = setTimeout(() => {
      auditDrawerRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    }, 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busy) cancelEdit();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(auditDrawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ) ?? []).filter(el => el.getClientRects().length > 0);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [edit, busy]);

  // Focus management and keyboard trap for Integration Drawer
  useEffect(() => {
    if (!integrationEdit) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = setTimeout(() => {
      integrationDrawerRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    }, 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busy) cancelIntegration();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(integrationDrawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ) ?? []).filter(el => el.getClientRects().length > 0);
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [integrationEdit, busy]);

  function handleTabClick(tab: "parameters" | "history" | "integrations" | "errors") {
    setActiveTab(tab);
    if (tab === "errors") {
      const errorSection = document.getElementById("error-messages-section");
      if (errorSection) {
        errorSection.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      }
      return;
    }
    const targetId =
      tab === "parameters" ? "system-parameters-section" :
        tab === "history" ? "setting-history-section" :
          "api-integrations-section";
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    }
  }

  function begin() {
    if (!setting || unknown || busy || integrationEdit || !canEdit) return;
    pendingAction.current = "SETTING_SAVE";
    requestKey.current = crypto.randomUUID();
    setPageSize(String(setting.value));
    setPageSizeError(null);
    setCurrentPassword("");
    setShowAuditPassword(false);
    setReview(false);
    setAuditDrawerNotice(null);
    setEdit(true);
    setNotice(null);
  }

  function cancelEdit() {
    if (busy) return;
    setEdit(false);
    setReview(false);
    setCurrentPassword("");
    setPageSizeError(null);
    setAuditDrawerNotice(null);
    if (setting) setPageSize(String(setting.value));
  }

  function handlePageSizeChange(val: string) {
    setPageSize(val);
    setReview(false);
    setAuditDrawerNotice(null);
    const trimmed = val.trim();
    if (trimmed === "") {
      setPageSizeError("Required field — enter a whole number between 10 and 100.");
      return;
    }
    const n = Number(trimmed);
    if (!/^\d+$/.test(trimmed) || !Number.isInteger(n) || n < 10 || n > 100) {
      setPageSizeError("Enter a whole number between 10 and 100.");
      return;
    }
    if (setting && n === setting.value) {
      setPageSizeError("Choose a different whole-number page size (currently " + setting.value + ").");
      return;
    }
    setPageSizeError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!setting || busy || unknown || !canEdit) return;
    const n = Number(pageSize.trim());
    if (!/^\d+$/.test(pageSize.trim()) || !Number.isInteger(n) || n < 10 || n > 100 || n === setting.value) {
      setPageSizeError("Choose a different whole-number page size between 10 and 100.");
      return;
    }
    if (!review) {
      setReview(true);
      setAuditDrawerNotice(null);
      return;
    }
    if (currentPassword.length < 8 || currentPassword.length > 1024) {
      setFeedback({
        type: "error",
        badge: "ERROR",
        title: "Password Required",
        message: "Enter your fresh current password (at least 8 characters) to confirm.",
        nextStep: "Enter your sign-in password in the security confirmation field.",
        primaryActionLabel: "Try Again",
        focusTargetOnClose: "current-password-input",
        onPrimaryAction: () => setFeedback(null),
        onClose: () => setFeedback(null)
      });
      return;
    }
    setBusy(true);
    setAuditDrawerNotice(null);
    setNotice(null);
    try {
      const ack = await request<{ revision: number }>("settings", "PATCH", {
        key: "audit.default_page_size",
        value: n,
        expectedRevision: setting.revision,
        requestKey: requestKey.current,
        currentPassword
      });
      if (!Number.isInteger(ack.revision)) throw new PlatformApiError(500, "UNCONFIRMED");
      setEdit(false);
      setReview(false);
      setCurrentPassword("");
      setPageSizeError(null);
      setAuditDrawerNotice(null);
      const verified = await reload(ack.revision);
      if (!verified) {
        setUnknown(true);
        setFeedback({
          type: "verification-required",
          badge: "VERIFICATION REQUIRED",
          title: "Verification Required",
          message: "The write was acknowledged but could not be verified by the server. Do not submit the same change again until its outcome is confirmed.",
          nextStep: "Check the previous change or contact Foundation support before retrying.",
          primaryActionLabel: "Check Previous Change",
          onPrimaryAction: () => {
            setFeedback(null);
            void checkOutcome();
          },
          secondaryActionLabel: "Close",
          onSecondaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else {
        setFeedback({
          type: "success",
          badge: "SUCCESS",
          title: "Changes Saved Successfully",
          message: `Audit Default Page Size updated to ${n} records per page (revision ${ack.revision}).`,
          nextStep: "The new default page size is now active for platform audit queries.",
          primaryActionLabel: "Done",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      }
    } catch (err) {
      if (err instanceof PlatformApiError && (err.status === 401 || err.status === 403)) {
        // Centered feedback modal on authentication / password confirmation rejection
        setFeedback({
          type: "error",
          badge: "ERROR",
          title: "Authentication Failed",
          message: "The password you entered is incorrect. Please try again.",
          nextStep: "Verify your sign-in password and enter it carefully before retrying.",
          primaryActionLabel: "Try Again",
          focusTargetOnClose: "current-password-input",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else if (err instanceof PlatformApiError && (err.code === "UNCONFIRMED" || err.status >= 500)) {
        setUnknown(true);
        setFeedback({
          type: "verification-required",
          badge: "VERIFICATION REQUIRED",
          title: "Verification Required",
          message: "The outcome could not be confirmed. Do not submit the same change again until its outcome is confirmed by the server.",
          nextStep: "Check the previous change before retrying.",
          primaryActionLabel: "Check Previous Change",
          onPrimaryAction: () => {
            setFeedback(null);
            void checkOutcome();
          },
          secondaryActionLabel: "Close",
          onSecondaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else if (err instanceof PlatformApiError && err.status === 409) {
        setFeedback({
          type: "error",
          badge: "ACTION REQUIRED",
          title: "Configuration Conflict",
          message: "This setting changed elsewhere. Refresh before saving.",
          nextStep: "Refresh the verified settings to load the latest revision.",
          primaryActionLabel: "Refresh Settings",
          onPrimaryAction: () => {
            setFeedback(null);
            cancelEdit();
            void reload();
          },
          secondaryActionLabel: "Close",
          onSecondaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else {
        const msg = message(err);
        setFeedback({
          type: "error",
          badge: "ERROR",
          title: "Operation Failed",
          message: msg,
          nextStep: "Please review the entered values and try again.",
          primaryActionLabel: "Try Again",
          focusTargetOnClose: "current-password-input",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      }
    } finally { setBusy(false); }
  }

  async function checkOutcome() {
    if (!unknown || !requestKey.current || busy) return;
    setBusy(true);
    try {
      const result = await request<{ status: string; revision: number | null }>(
        "changes/" + pendingAction.current + "/" + encodeURIComponent(requestKey.current));
      if (result.status === "CONFIRMED" && Number.isInteger(result.revision)) {
        const ref = pendingConnection.current;
        const ok = pendingAction.current === "SETTING_SAVE"
          ? await reload(Number(result.revision))
          : ref ? await reload(undefined, { ...ref, revision: Number(result.revision) }) : false;
        if (!ok) {
          setUnknown(true);
          setFeedback({
            type: "verification-required",
            badge: "VERIFICATION REQUIRED",
            title: "Verification Incomplete",
            message: "Recorded change has not been reverified. Check again.",
            nextStep: "Click Check previous change to retry confirmation.",
            primaryActionLabel: "Check Again",
            onPrimaryAction: () => {
              setFeedback(null);
              void checkOutcome();
            },
            secondaryActionLabel: "Close",
            onSecondaryAction: () => setFeedback(null),
            onClose: () => setFeedback(null)
          });
        } else {
          setEdit(false);
          setIntegrationEdit(false);
          setFormReference("");
          setFeedback({
            type: "success",
            badge: "SUCCESS",
            title: "Changes Saved Successfully",
            message: "Previously submitted change confirmed by the server.",
            nextStep: "The verified state has been synchronized with the platform.",
            primaryActionLabel: "Done",
            onPrimaryAction: () => setFeedback(null),
            onClose: () => setFeedback(null)
          });
        }
      } else {
        setFeedback({
          type: "verification-required",
          badge: "VERIFICATION REQUIRED",
          title: "Verification Incomplete",
          message: "No committed result is visible. Contact Foundation support before retrying.",
          nextStep: "Do not resubmit the same change blindly while outcome is pending.",
          primaryActionLabel: "Understood",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      }
    } catch (e) {
      setFeedback({
        type: "error",
        badge: "ERROR",
        title: "Verification Request Failed",
        message: message(e),
        nextStep: "Check network connection and retry verification.",
        primaryActionLabel: "Dismiss",
        onPrimaryAction: () => setFeedback(null),
        onClose: () => setFeedback(null)
      });
    } finally { setBusy(false); }
  }

  function startIntegration(row?: Connection) {
    if (unknown || busy || edit) return;
    pendingAction.current = "INTEGRATION_REFERENCE";
    pendingConnection.current = null;
    requestKey.current = crypto.randomUUID();
    setFormProvider(row?.provider ?? "");
    setFormPurpose(row?.purpose ?? "");
    setFormReference("");
    setIntegrationPassword("");
    setShowIntegrationSecret(false);
    setShowIntegrationPassword(false);
    setIntegrationReview(false);
    setIntegrationDrawerNotice(null);
    setRefFormatError(null);
    setProviderFormatError(null);
    setPurposeFormatError(null);
    setIntegrationEdit(true);
    setNotice(null);
  }

  function cancelIntegration() {
    if (busy) return;
    setIntegrationEdit(false);
    setIntegrationReview(false);
    setFormReference("");
    setIntegrationPassword("");
    setShowIntegrationSecret(false);
    setShowIntegrationPassword(false);
    setIntegrationDrawerNotice(null);
    setRefFormatError(null);
    setProviderFormatError(null);
    setPurposeFormatError(null);
  }

  async function saveIntegration(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || unknown) return;
    const provider = formProvider.trim().toLowerCase();
    const purpose = formPurpose.trim().toLowerCase();
    const reference = formReference.trim();
    let hasError = false;

    if (!/^[a-z][a-z0-9_-]{1,62}$/.test(provider)) {
      setProviderFormatError("Provider label must start with a letter and contain 2–63 lowercase alphanumeric characters, dashes, or underscores.");
      hasError = true;
    } else {
      setProviderFormatError(null);
    }

    if (!/^[a-z][a-z0-9_-]{1,62}$/.test(purpose)) {
      setPurposeFormatError("Purpose label must start with a letter and contain 2–63 lowercase alphanumeric characters, dashes, or underscores.");
      hasError = true;
    } else {
      setPurposeFormatError(null);
    }

    if (reference.startsWith("sk_") || reference.startsWith("key_") || reference.startsWith("token_") || reference.includes("=")) {
      setRefFormatError("Raw API keys or secrets are strictly forbidden. Format must be 'secretref:path' without '=' or spaces.");
      hasError = true;
    } else if (!referencePattern.test(reference)) {
      setRefFormatError("Format must be 'secretref:path' (e.g. secretref:vault/careganga/sms-key) with 10–230 path characters.");
      hasError = true;
    } else {
      setRefFormatError(null);
    }

    if (hasError) {
      setIntegrationDrawerNotice("Please correct the highlighted fields before proceeding. Raw API keys or secrets are strictly forbidden.");
      return;
    }

    if (!integrationReview) {
      setIntegrationDrawerNotice(null);
      setIntegrationReview(true);
      return;
    }

    if (integrationPassword.length < 8 || integrationPassword.length > 1024) {
      setFeedback({
        type: "error",
        badge: "ERROR",
        title: "Password Required",
        message: "Enter your fresh current sign-in password (at least 8 characters) to confirm.",
        nextStep: "Enter your sign-in password in the security confirmation field.",
        primaryActionLabel: "Try Again",
        focusTargetOnClose: "integration-current-password",
        onPrimaryAction: () => setFeedback(null),
        onClose: () => setFeedback(null)
      });
      return;
    }

    setBusy(true);
    setIntegrationDrawerNotice(null);
    setNotice(null);
    const existing = connections.find(x => x.provider === provider && x.purpose === purpose);
    pendingConnection.current = { provider, purpose };
    try {
      const result = await request<{ revision: number }>("integrations", "POST", {
        provider,
        purpose,
        secretReference: reference,
        expectedRevision: existing?.revision ?? 0,
        requestKey: requestKey.current,
        currentPassword: integrationPassword
      });
      if (!Number.isInteger(result.revision)) throw new PlatformApiError(500, "UNCONFIRMED");
      const ok = await reload(undefined, { provider, purpose, revision: result.revision });
      if (!ok) {
        setUnknown(true);
        setIntegrationEdit(false);
        setFeedback({
          type: "verification-required",
          badge: "VERIFICATION REQUIRED",
          title: "Verification Required",
          message: "Reference was saved but its current revision could not be verified by the server. Do not submit the change again until confirmed.",
          nextStep: "Check the previous change before retrying.",
          primaryActionLabel: "Check Previous Change",
          onPrimaryAction: () => {
            setFeedback(null);
            void checkOutcome();
          },
          secondaryActionLabel: "Close",
          onSecondaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else {
        requestKey.current = "";
        setFormReference("");
        setIntegrationPassword("");
        setShowIntegrationSecret(false);
        setShowIntegrationPassword(false);
        setIntegrationEdit(false);
        setIntegrationReview(false);
        setFeedback({
          type: "success",
          badge: "SUCCESS",
          title: "Changes Saved Successfully",
          message: `Secured reference for "${label(provider)} — ${label(purpose)}" saved successfully. Provider verification has not been performed.`,
          nextStep: "Use the Check button on the provider card to test connectivity when ready.",
          primaryActionLabel: "Done",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      }
    } catch (e) {
      if (e instanceof PlatformApiError && (e.status === 401 || e.status === 403)) {
        setFeedback({
          type: "error",
          badge: "ERROR",
          title: "Authentication Failed",
          message: "The password you entered is incorrect. Please try again.",
          nextStep: "Verify your sign-in password and enter it carefully before retrying.",
          primaryActionLabel: "Try Again",
          focusTargetOnClose: "integration-current-password",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else if (e instanceof PlatformApiError && (e.code === "UNCONFIRMED" || e.status >= 500)) {
        setUnknown(true);
        setIntegrationEdit(false);
        setFeedback({
          type: "verification-required",
          badge: "VERIFICATION REQUIRED",
          title: "Verification Required",
          message: "The outcome could not be confirmed. Do not submit the same change again until confirmed.",
          nextStep: "Check the previous change before retrying.",
          primaryActionLabel: "Check Previous Change",
          onPrimaryAction: () => {
            setFeedback(null);
            void checkOutcome();
          },
          secondaryActionLabel: "Close",
          onSecondaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else if (e instanceof PlatformApiError && e.status === 409) {
        setFeedback({
          type: "error",
          badge: "ACTION REQUIRED",
          title: "Configuration Conflict",
          message: "This integration reference changed elsewhere. Refresh before saving.",
          nextStep: "Refresh the verified settings to load the latest state.",
          primaryActionLabel: "Refresh Settings",
          onPrimaryAction: () => {
            setFeedback(null);
            cancelIntegration();
            void reload();
          },
          secondaryActionLabel: "Close",
          onSecondaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else {
        const msg = message(e);
        setFeedback({
          type: "error",
          badge: "ERROR",
          title: "Operation Failed",
          message: msg,
          nextStep: "Please review the values and try again.",
          primaryActionLabel: "Try Again",
          focusTargetOnClose: "integration-current-password",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      }
    } finally { setBusy(false); }
  }

  async function checkIntegration(provider: string, purpose: string) {
    if (busy || unknown) return;
    setChecking(provider + "/" + purpose);
    try {
      const result = await request<{ status: string; verified: boolean }>(
        "integrations/" + encodeURIComponent(provider) + "/" + encodeURIComponent(purpose) + "/check", "POST");
      if (result.verified) {
        setFeedback({
          type: "success",
          badge: "SUCCESS",
          title: "Provider Verified",
          message: `The integration "${label(provider)} — ${label(purpose)}" was independently verified.`,
          nextStep: "This provider is active and ready for platform communication.",
          primaryActionLabel: "Done",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      } else {
        setFeedback({
          type: "warning",
          badge: "ACTION REQUIRED",
          title: "Verification Incomplete",
          message: result.status === "NOT_CONFIGURED"
            ? "No integration reference exists."
            : "Verification is unavailable. No provider connection was claimed.",
          nextStep: "Verify that the secret reference exists in your secure vault before rechecking.",
          primaryActionLabel: "Understood",
          onPrimaryAction: () => setFeedback(null),
          onClose: () => setFeedback(null)
        });
      }
      void reload();
    } catch (e) {
      setFeedback({
        type: "error",
        badge: "ERROR",
        title: "Verification Check Failed",
        message: "Could not complete provider verification. Check network connection and retry.",
        primaryActionLabel: "Dismiss",
        onPrimaryAction: () => setFeedback(null),
        onClose: () => setFeedback(null)
      });
    } finally { setChecking(""); }
  }

  return (
    <div className="cg-gs-container">
      {/* Page Header */}
      <header className="cg-gs-header">
        <div className="cg-gs-header-left">
          <div className="cg-gs-title-row">
            <h1 className="cg-gs-title">General Settings</h1>
            <span className="cg-gs-verified-badge" title="Verified Foundation Control Panel">
              <CheckIcon size={12} />
            </span>
          </div>
          <p className="cg-gs-subtitle">System Settings &amp; Governance · Foundation operations</p>
        </div>
        <div className="cg-gs-header-actions">
          <button
            type="button"
            className="cg-gs-btn-refresh"
            disabled={loading || busy || unknown || edit || integrationEdit}
            onClick={() => void reload()}
          >
            <RefreshCwIcon size={14} className={loading ? "cg-gs-spin" : ""} />
            <span>Refresh verified settings</span>
          </button>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="cg-gs-tabs-nav" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "parameters"}
          className={`cg-gs-tab-btn ${activeTab === "parameters" ? "is-active" : ""}`}
          onClick={() => handleTabClick("parameters")}
        >
          <SlidersIcon size={16} />
          <span>System Parameters</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`cg-gs-tab-btn ${activeTab === "history" ? "is-active" : ""}`}
          onClick={() => handleTabClick("history")}
        >
          <HistoryIcon size={16} />
          <span>Revision History</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "integrations"}
          className={`cg-gs-tab-btn ${activeTab === "integrations" ? "is-active" : ""}`}
          onClick={() => handleTabClick("integrations")}
        >
          <PlugIcon size={16} />
          <span>API &amp; Integrations</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "errors"}
          className={`cg-gs-tab-btn ${activeTab === "errors" ? "is-active" : ""}`}
          onClick={() => handleTabClick("errors")}
        >
          <MessageSquareIcon size={16} />
          <span>Error Messages</span>
        </button>
      </nav>

      {/* Global Status Notices */}
      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          className={`cg-gs-banner cg-gs-banner-${notice.kind}`}
        >
          <span className="cg-gs-banner-icon">
            {notice.kind === "success" && <CheckCircle2Icon size={18} />}
            {notice.kind === "error" && <AlertCircleIcon size={18} />}
            {notice.kind === "uncertain" && <AlertTriangleIcon size={18} />}
          </span>
          <div className="cg-gs-banner-content">
            <p>{notice.message}</p>
          </div>
        </div>
      )}

      {/* Recovery Banner for Uncertain State */}
      {unknown && (
        <section className="cg-gs-recovery-banner" role="alert" aria-live="polite">
          <div className="cg-gs-recovery-text">
            <strong>Previous change needs verification</strong>
            <p>Do not submit the same change again until its outcome is confirmed by the server.</p>
          </div>
          <button
            type="button"
            className="cg-gs-btn-check-recovery"
            disabled={busy}
            onClick={() => void checkOutcome()}
            aria-busy={busy}
          >
            {busy ? <RefreshCwIcon size={16} className="cg-gs-spin" /> : <RefreshCwIcon size={16} />}
            <span>{busy ? "Checking previous change…" : "Check previous change"}</span>
          </button>
        </section>
      )}

      {/* Main Content Area */}
      {loading ? (
        <p className="cg-module-loading" role="status">Verifying Foundation configuration…</p>
      ) : setting && (
        <>
          {/* Combined Section: Configuration Settings */}
          <section
            className="cg-gs-card"
            id="configuration-settings-section"
            aria-labelledby="configuration-settings-heading"
          >
            <div className="cg-gs-card-header">
              <div className="cg-gs-card-header-left">
                <span className="cg-gs-card-icon-wrap">
                  <SlidersIcon size={18} />
                </span>
                <div className="cg-gs-card-title-group">
                  <h2 id="configuration-settings-heading">Configuration Settings</h2>
                  <p>Operational defaults and immutable audit trail managed by the Foundation</p>
                </div>
              </div>
            </div>

            <div className="cg-gs-card-body">
              {/* System Parameters Area */}
              <div id="system-parameters-section" className="cg-gs-param-item-box">
                <div className="cg-gs-param-left">
                  <span className="cg-gs-param-icon-badge">
                    <LayersIcon size={22} />
                  </span>
                  <div className="cg-gs-param-meta">
                    <h3 className="cg-gs-param-name">Audit Default Page Size</h3>
                    <code className="cg-gs-param-key">{setting.key}</code>
                  </div>
                </div>

                <div className="cg-gs-param-center">
                  <span className="cg-gs-param-label">Current effective value</span>
                  <div className="cg-gs-param-value-row">
                    <span className="cg-gs-param-value-text">{setting.value} records per page</span>
                    <span className="cg-gs-pill-revision">Revision {setting.revision}</span>
                  </div>
                  <p className="cg-gs-param-subtext">
                    {setting.revision === 0
                      ? "Default value (no saved override exists) · Server safety limit: 100 records per request"
                      : `Updated: ${setting.updatedAt ? new Date(setting.updatedAt).toLocaleString() : "Recently"} · Server safety limit: 100 records per request`}
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    className="cg-gs-btn-edit"
                    disabled={busy || unknown || integrationEdit}
                    onClick={begin}
                    title="Edit Audit Default Page Size"
                  >
                    <PencilIcon size={14} />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {/* Revision History Divider & Header */}
              <hr className="cg-gs-config-divider" />

              <div id="setting-history-section" className="cg-gs-config-subhead">
                <div className="cg-gs-config-subhead-left">
                  <span className="cg-gs-config-subhead-icon">
                    <HistoryIcon size={16} />
                  </span>
                  <div className="cg-gs-config-subhead-title">
                    <h3 id="setting-history-heading">Setting Change History</h3>
                    <p>Immutable audit trail of versioned configuration changes</p>
                  </div>
                </div>
              </div>

              {!history.length ? (
                <p className="cg-module-empty" role="status">
                  No saved changes yet. The secure default is in effect.
                </p>
              ) : (
                <>
                  {/* Desktop / Tablet Table */}
                  <div className="cg-gs-table-wrap cg-gs-history-table-wrap">
                    <table className="cg-gs-table" aria-label="Setting change history">
                      <thead>
                        <tr>
                          <th scope="col">Revision</th>
                          <th scope="col">Setting Key</th>
                          <th scope="col">Previous Value</th>
                          <th scope="col">New Value</th>
                          <th scope="col">Changed By</th>
                          <th scope="col">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h, index) => {
                          const prevItem = history.find((p) => p.revision === h.revision - 1);
                          const prevValueText =
                            h.revision === 1
                              ? "25 records per page"
                              : prevItem
                                ? `${prevItem.value} records per page`
                                : "—";
                          const isLatest = index === 0;
                          return (
                            <tr key={h.revision}>
                              <td>
                                <span className={`cg-gs-table-rev-pill ${isLatest ? "is-latest" : "is-muted"}`}>
                                  Revision {h.revision}
                                </span>
                              </td>
                              <td>
                                <code className="cg-gs-table-key-code">
                                  {setting?.key ?? "audit.default_page_size"}
                                </code>
                              </td>
                              <td>
                                <span className="cg-gs-table-prev-value">{prevValueText}</span>
                              </td>
                              <td>
                                <span className="cg-gs-table-new-value">{h.value} records per page</span>
                              </td>
                              <td>{h.changedBy}</td>
                              <td>
                                <span className="cg-gs-table-timestamp">
                                  {new Date(h.changedAt).toLocaleString()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards List */}
                  <div className="cg-gs-history-cards-list" aria-label="Setting change history mobile view">
                    {history.map((h, index) => {
                      const prevItem = history.find((p) => p.revision === h.revision - 1);
                      const prevValueText =
                        h.revision === 1
                          ? "25 records per page"
                          : prevItem
                            ? `${prevItem.value} records per page`
                            : "Default (25)";
                      const isLatest = index === 0;
                      return (
                        <div key={h.revision} className="cg-gs-history-card-item">
                          <div className="cg-gs-history-card-header">
                            <span className={`cg-gs-table-rev-pill ${isLatest ? "is-latest" : "is-muted"}`}>
                              Revision {h.revision}
                            </span>
                            <span className="cg-gs-history-card-time">
                              {new Date(h.changedAt).toLocaleDateString()} {new Date(h.changedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="cg-gs-history-card-key">
                            <code>{setting?.key ?? "audit.default_page_size"}</code>
                          </div>
                          <div className="cg-gs-history-card-values">
                            <span className="cg-gs-history-val-prev">{prevValueText}</span>
                            <span className="cg-gs-history-val-arrow">→</span>
                            <span className="cg-gs-history-val-new">{h.value} records per page</span>
                          </div>
                          <div className="cg-gs-history-card-actor">
                            <span>Changed by: <strong>{h.changedBy}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Section 2: API & Integrations */}
          <section className="cg-gs-card" id="api-integrations-section" aria-label="API & Integrations">
            <div className="cg-gs-card-header">
              <div className="cg-gs-card-header-left">
                <div className="cg-gs-card-icon-wrap">
                  <PlugIcon size={18} />
                </div>
                <div className="cg-gs-card-title-group">
                  <h2>API &amp; Integrations</h2>
                  <p>Secured references and verified provider readiness</p>
                </div>
              </div>
              <button
                type="button"
                className="cg-gs-btn-primary"
                style={{ height: "2.125rem", fontSize: "0.8125rem", padding: "0 0.875rem" }}
                disabled={busy || unknown || edit || integrationEdit || !canEdit}
                onClick={() => startIntegration()}
              >
                + Add reference
              </button>
            </div>
            <div className="cg-gs-card-body">
              {!connections.length ? (
                <div className="cg-gs-empty-state" role="status">
                  <PlugIcon size={32} className="cg-gs-empty-icon" />
                  <p className="cg-gs-empty-title">No integration references configured</p>
                  <p className="cg-gs-empty-desc">
                    Optional providers remain unavailable until a secured reference is configured.
                  </p>
                </div>
              ) : (
                <div className="cg-gs-providers-grid">
                  {connections.map(c => {
                    const statusText =
                      c.status === "CONFIGURED_NOT_VERIFIED"
                        ? "Not Configured"
                        : c.status === "VERIFIED"
                          ? "Verified"
                          : c.status === "FAILED"
                            ? "Failed"
                            : "Unavailable";
                    const statusClass =
                      c.status === "CONFIGURED_NOT_VERIFIED"
                        ? "is-not-verified"
                        : c.status === "VERIFIED"
                          ? "is-verified"
                          : c.status === "FAILED"
                            ? "is-failed"
                            : "is-unavailable";
                    const statusDetail =
                      c.status === "CONFIGURED_NOT_VERIFIED"
                        ? "Configured, not verified"
                        : c.status === "VERIFIED"
                          ? "Verified at last check"
                          : c.status === "FAILED"
                            ? "Verification failed"
                            : "Verification unavailable";
                    const isCheckingThis = checking === c.provider + "/" + c.purpose;

                    return (
                      <div className="cg-gs-provider-card" key={c.provider + "/" + c.purpose}>
                        <div className="cg-gs-provider-top">
                          <div className="cg-gs-provider-left">
                            <div className="cg-gs-provider-icon-wrap">
                              <MessageSquareIcon size={18} />
                            </div>
                            <div className="cg-gs-provider-title-group">
                              <h3>{label(c.provider)} — {label(c.purpose)}</h3>
                              <p>{statusDetail}</p>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
                            <span className="cg-gs-pill-revision">Rev {c.credentialRevision}</span>
                            <span className={`cg-gs-status-badge ${statusClass}`}>{statusText}</span>
                          </div>
                        </div>

                        <div className="cg-gs-provider-meta">
                          {c.lastCheckedAt
                            ? `Last checked: ${new Date(c.lastCheckedAt).toLocaleDateString()} ${new Date(c.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Last checked: Not checked yet"}
                        </div>

                        <div className="cg-gs-provider-actions">
                          <button
                            type="button"
                            className="cg-gs-provider-btn"
                            disabled={busy || unknown || edit || integrationEdit || !canEdit}
                            onClick={() => startIntegration(c)}
                          >
                            <PencilIcon size={13} />
                            <span>Rotate</span>
                          </button>
                          <button
                            type="button"
                            className="cg-gs-provider-btn"
                            disabled={busy || unknown || Boolean(checking)}
                            onClick={() => void checkIntegration(c.provider, c.purpose)}
                          >
                            {isCheckingThis ? (
                              <>
                                <RefreshCwIcon size={13} className="cg-gs-spin" />
                                <span>Checking…</span>
                              </>
                            ) : (
                              <>
                                <RefreshCwIcon size={13} />
                                <span>Check</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Slide-out Right Drawer: Update Audit Page Size */}
      <AnimatePresence>
        {edit && (
          <motion.div
            className="cg-gs-drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) cancelEdit();
            }}
          >
            <motion.section
              ref={auditDrawerRef}
              className="cg-gs-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="audit-page-size-drawer-title"
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <header className="cg-gs-drawer-header">
                <div className="cg-gs-drawer-header-left">
                  <div className="cg-gs-drawer-icon-wrap">
                    <SlidersIcon size={18} />
                  </div>
                  <div className="cg-gs-drawer-title-wrap">
                    <h2 id="audit-page-size-drawer-title" className="cg-gs-drawer-title">
                      Update Audit Page Size
                    </h2>
                    <p className="cg-gs-drawer-desc">
                      Manage default page size for platform audit queries
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-gs-drawer-close-btn"
                  disabled={busy}
                  onClick={cancelEdit}
                  aria-label="Close audit page size drawer"
                  title="Close"
                >
                  <XIcon size={18} />
                </button>
              </header>

              <form className="cg-gs-drawer-form" onSubmit={e => void save(e)} noValidate>
                <div className="cg-gs-drawer-content">
                  {auditDrawerNotice && (
                    <div className="cg-gs-drawer-notice error" role="alert">
                      <AlertCircleIcon size={16} />
                      <div>{auditDrawerNotice}</div>
                    </div>
                  )}

                  <div className="cg-gs-form-group">
                        <div className="cg-gs-form-label-row">
                          <label className="cg-gs-label" htmlFor="audit-page-size-input">
                            New page size (10 - 100) *
                          </label>
                          <span className="cg-gs-badge-subtle">System Limit</span>
                        </div>
                        <div className="cg-gs-input-wrap">
                          <input
                            id="audit-page-size-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={pageSize}
                            disabled={busy}
                            onChange={e => handlePageSizeChange(e.target.value)}
                            aria-invalid={Boolean(pageSizeError)}
                            aria-describedby={pageSizeError ? "audit-page-size-error" : "audit-page-size-help"}
                            className="cg-gs-input"
                          />
                        </div>
                        {pageSizeError ? (
                          <p id="audit-page-size-error" role="alert" className="cg-gs-field-error">
                            {pageSizeError}
                          </p>
                        ) : (
                          <p id="audit-page-size-help" className="cg-gs-helper-text">
                            Enter a whole number between 10 and 100. Default is 25 records.
                          </p>
                        )}
                      </div>

                      <div className="cg-gs-form-group">
                        <label className="cg-gs-label" htmlFor="current-password-input">
                          Current password *
                        </label>
                        <div className="cg-gs-input-wrap">
                          <input
                            id="current-password-input"
                            required
                            type={showAuditPassword ? "text" : "password"}
                            minLength={8}
                            maxLength={1024}
                            autoComplete="current-password"
                            value={currentPassword}
                            disabled={busy}
                            onChange={e => setCurrentPassword(e.target.value)}
                            placeholder="Enter your current password"
                            className="cg-gs-input cg-gs-input-with-toggle"
                          />
                          <button
                            type="button"
                            className="cg-gs-btn-toggle-password"
                            onClick={() => setShowAuditPassword(!showAuditPassword)}
                            aria-label={showAuditPassword ? "Hide password" : "Show password"}
                            title={showAuditPassword ? "Hide password" : "Show password"}
                          >
                            {showAuditPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                          </button>
                        </div>
                        <p className="cg-gs-helper-text">
                          Required for privileged Foundation configuration changes.
                        </p>
                      </div>
                    </div>

                    <footer className="cg-gs-drawer-footer">
                      <button
                        type="button"
                        className="cg-gs-btn-cancel"
                        disabled={busy}
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="cg-gs-btn-primary"
                        disabled={busy || unknown || Boolean(pageSizeError) || !pageSize.trim() || currentPassword.length < 8}
                      >
                        {busy ? <RefreshCwIcon size={16} className="cg-gs-spin" /> : <CheckIcon size={16} />}
                        <span>{busy ? "Saving…" : "Save Changes"}</span>
                      </button>
                    </footer>
                  </form>
                </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-out Drawer: Secured Integration Reference */}
      <AnimatePresence>
        {integrationEdit && (
          <motion.div
            className="cg-gs-drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={e => {
              if (e.target === e.currentTarget && !busy) cancelIntegration();
            }}
          >
            <motion.section
              ref={integrationDrawerRef}
              className="cg-gs-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="integration-title"
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: "tween", duration: 0.25, ease: "easeOut" }}
            >
              <header className="cg-gs-drawer-header">
                <div className="cg-gs-drawer-header-left">
                  <div className="cg-gs-drawer-icon-wrap">
                    <KeyIcon size={18} />
                  </div>
                  <div className="cg-gs-drawer-title-wrap">
                    <h2 id="integration-title" className="cg-gs-drawer-title">
                      Secured Integration Reference
                    </h2>
                    <p className="cg-gs-drawer-desc">
                      Store only a reference held in a secure vault
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-gs-drawer-close-btn"
                  disabled={busy}
                  onClick={cancelIntegration}
                  aria-label="Close integration drawer"
                  title="Close"
                >
                  <XIcon size={18} />
                </button>
              </header>

              <form className="cg-gs-drawer-form" onSubmit={e => void saveIntegration(e)} noValidate>
                <div className="cg-gs-drawer-content">
                  {/* Security Policy Card */}
                  <div className="cg-gs-info-card">
                    <div className="cg-gs-info-card-icon">
                      <InfoIcon size={18} />
                    </div>
                    <div className="cg-gs-info-card-body">
                      <h4 className="cg-gs-info-card-title">Secured Reference Policy</h4>
                      <p className="cg-gs-info-card-text">
                        Store only a reference to a credential held in a separate secured store.
                        No provider verification or payment/message action occurs when you save.
                      </p>
                    </div>
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-provider" className="cg-gs-label">
                      Provider label *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-provider"
                        required
                        maxLength={63}
                        pattern="[a-z][a-z0-9_-]{1,62}"
                        value={formProvider}
                        placeholder="e.g. test-sms-provider"
                        className="cg-gs-input"
                        aria-invalid={Boolean(providerFormatError)}
                        aria-describedby={providerFormatError ? "integration-provider-error" : undefined}
                        onChange={e => {
                          setFormProvider(e.target.value);
                          setIntegrationReview(false);
                          setIntegrationDrawerNotice(null);
                          if (providerFormatError) setProviderFormatError(null);
                        }}
                      />
                    </div>
                    {providerFormatError ? (
                      <p id="integration-provider-error" role="alert" className="cg-gs-field-error">
                        {providerFormatError}
                      </p>
                    ) : (
                      <p className="cg-gs-helper-text">
                        Lowercase alphanumeric with dashes/underscores (1–63 chars).
                      </p>
                    )}
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-purpose" className="cg-gs-label">
                      Purpose label *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-purpose"
                        required
                        maxLength={63}
                        pattern="[a-z][a-z0-9_-]{1,62}"
                        value={formPurpose}
                        placeholder="e.g. transactional-sms"
                        className="cg-gs-input"
                        aria-invalid={Boolean(purposeFormatError)}
                        aria-describedby={purposeFormatError ? "integration-purpose-error" : undefined}
                        onChange={e => {
                          setFormPurpose(e.target.value);
                          setIntegrationReview(false);
                          setIntegrationDrawerNotice(null);
                          if (purposeFormatError) setPurposeFormatError(null);
                        }}
                      />
                    </div>
                    {purposeFormatError ? (
                      <p id="integration-purpose-error" role="alert" className="cg-gs-field-error">
                        {purposeFormatError}
                      </p>
                    ) : (
                      <p className="cg-gs-helper-text">
                        Functional purpose for this integration (1–63 chars).
                      </p>
                    )}
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-reference" className="cg-gs-label">
                      Secret-manager reference *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-reference"
                        required
                        autoComplete="off"
                        maxLength={240}
                        type={showIntegrationSecret ? "text" : "password"}
                        placeholder="secretref:vault/careganga/sms-key"
                        value={formReference}
                        className="cg-gs-input cg-gs-input-with-toggle"
                        aria-invalid={Boolean(refFormatError)}
                        aria-describedby={refFormatError ? "integration-reference-error" : "integration-reference-help"}
                        onChange={e => {
                          const val = e.target.value;
                          setFormReference(val);
                          setIntegrationReview(false);
                          setIntegrationDrawerNotice(null);
                          const trimmed = val.trim();
                          if (trimmed.startsWith("sk_") || trimmed.startsWith("key_") || trimmed.startsWith("token_") || trimmed.includes("=")) {
                            setRefFormatError("Raw API keys or secrets are strictly forbidden. Format must be 'secretref:path' without '=' or spaces.");
                          } else if (trimmed && !referencePattern.test(trimmed)) {
                            setRefFormatError("Format must be 'secretref:path' (e.g. secretref:vault/careganga/sms-key) with 10–230 path characters.");
                          } else {
                            setRefFormatError(null);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="cg-gs-btn-toggle-password"
                        onClick={() => setShowIntegrationSecret(!showIntegrationSecret)}
                        aria-label={showIntegrationSecret ? "Hide secret reference" : "Show secret reference"}
                        title={showIntegrationSecret ? "Hide secret reference" : "Show secret reference"}
                      >
                        {showIntegrationSecret ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    {refFormatError ? (
                      <p id="integration-reference-error" role="alert" className="cg-gs-field-error">
                        {refFormatError}
                      </p>
                    ) : (
                      <p id="integration-reference-help" className="cg-gs-helper-text">
                        Format: <code>secretref:path</code> (e.g. <code>secretref:vault/careganga/sms-key</code>). Raw API keys or secrets are strictly forbidden.
                      </p>
                    )}
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="integration-current-password" className="cg-gs-label">
                      Current password *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="integration-current-password"
                        required
                        maxLength={1024}
                        type={showIntegrationPassword ? "text" : "password"}
                        minLength={8}
                        autoComplete="current-password"
                        value={integrationPassword}
                        placeholder="Enter your current password"
                        className="cg-gs-input cg-gs-input-with-toggle"
                        onChange={e => {
                          setIntegrationPassword(e.target.value);
                          setIntegrationReview(false);
                        }}
                      />
                      <button
                        type="button"
                        className="cg-gs-btn-toggle-password"
                        onClick={() => setShowIntegrationPassword(!showIntegrationPassword)}
                        aria-label={showIntegrationPassword ? "Hide password" : "Show password"}
                        title={showIntegrationPassword ? "Hide password" : "Show password"}
                      >
                        {showIntegrationPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    <p className="cg-gs-helper-text">
                      Required for privileged Foundation configuration changes.
                    </p>
                  </div>

                  {integrationReview && (
                    <div className="cg-gs-notice-banner warning">
                      <AlertTriangleIcon size={16} />
                      <div>
                        <strong>Confirm reference update:</strong> Existing verification status will be invalidated, and no secret value is displayed after saving.
                      </div>
                    </div>
                  )}
                </div>

                <footer className="cg-gs-drawer-footer">
                  <button
                    type="button"
                    className="cg-gs-btn-cancel"
                    disabled={busy}
                    onClick={cancelIntegration}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cg-gs-btn-primary"
                    disabled={
                      busy ||
                      unknown ||
                      !formProvider.trim() ||
                      !formPurpose.trim() ||
                      !formReference.trim() ||
                      integrationPassword.length < 8
                    }
                  >
                    {busy ? (
                      <>
                        <RefreshCwIcon size={16} className="cg-gs-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={16} />
                        <span>{integrationReview ? "Confirm reference" : "Review reference"}</span>
                      </>
                    )}
                  </button>
                </footer>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reusable Centered Feedback Modal */}
      <GeneralSettingsFeedbackModal
        feedback={feedback}
        onDismiss={() => setFeedback(null)}
      />
    </div>
  );
}
