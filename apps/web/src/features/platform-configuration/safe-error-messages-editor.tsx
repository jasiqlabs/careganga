"use client";
import "./general-settings.css";
import { FormEvent, useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  MessageSquareIcon,
  RefreshCwIcon,
  PencilIcon,
  CheckIcon,
  AlertCircleIcon,
  AlertTriangleIcon,
  EyeIcon,
  EyeOffIcon,
  XIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  ShieldCheckIcon,
  UserIcon,
  LockIcon,
  SlidersIcon,
  CreditCardIcon,
  HeartPulseIcon,
  FileTextIcon,
  HelpCircleIcon
} from "./general-settings-icons";

export type ErrorCopy = {
  key: string;
  defaultMessage: string;
  effectiveMessage: string;
  revision: number;
  customized: boolean;
};

export type Notice = { kind: "success" | "error" | "uncertain"; message: string };

export type ErrorCategory =
  | "auth"
  | "account"
  | "policy"
  | "platform"
  | "finance"
  | "health"
  | "documents"
  | "support"
  | "other";

export interface CategoryMeta {
  id: ErrorCategory;
  name: string;
  icon: (props: { size?: number; className?: string }) => React.JSX.Element;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: "auth", name: "Authentication & Verification", icon: ShieldCheckIcon },
  { id: "account", name: "Account & Access Management", icon: UserIcon },
  { id: "policy", name: "Security Policy", icon: LockIcon },
  { id: "platform", name: "Platform & System Settings", icon: SlidersIcon },
  { id: "finance", name: "Finance, Vouchers & Ledgers", icon: CreditCardIcon },
  { id: "health", name: "Healthcare Network & Appointments", icon: HeartPulseIcon },
  { id: "documents", name: "Documents & CMS Content", icon: FileTextIcon },
  { id: "support", name: "Communications & Support", icon: HelpCircleIcon },
  { id: "other", name: "Other & Operational Guidance", icon: MessageSquareIcon }
];

export function getErrorCategory(key: string): ErrorCategory {
  const k = key.toUpperCase();
  if (
    k.startsWith("IDENTITY_") ||
    k.startsWith("AUTH_") ||
    k.includes("PASSWORD") ||
    k.includes("SESSION") ||
    k.includes("OTP")
  ) {
    return "auth";
  }
  if (
    k.startsWith("ROLE_") ||
    k.startsWith("ACCOUNT_") ||
    k.includes("DUPLICATE_ROLE") ||
    k.includes("DUPLICATE_ACCOUNT") ||
    k.includes("STALE_ROLE") ||
    k.includes("STALE_ACCOUNT") ||
    k.startsWith("CG01_PUBLIC")
  ) {
    return "account";
  }
  if (k.startsWith("POLICY_")) {
    return "policy";
  }
  if (k.startsWith("PLATFORM_") || k.startsWith("REPLAY_CONFLICT")) {
    return "platform";
  }
  if (k.startsWith("FINANCE_") || k.startsWith("VOUCHER_") || k.startsWith("JOURNAL_")) {
    return "finance";
  }
  if (
    k.startsWith("HEALTH_") ||
    k.startsWith("CG14_") ||
    k.startsWith("CG15_") ||
    k.includes("PATIENT") ||
    k.includes("APPOINTMENT") ||
    k.includes("DOCTOR") ||
    k.includes("CONSULTATION")
  ) {
    return "health";
  }
  if (
    k.startsWith("DOCUMENTS_") ||
    k.startsWith("FILE_") ||
    k.includes("_FILE_") ||
    k.startsWith("CMS_")
  ) {
    return "documents";
  }
  if (
    k.startsWith("SUPPORT_") ||
    k.startsWith("COMMUNICATIONS_") ||
    k.startsWith("CG19_") ||
    k.startsWith("CENTER_SUPPORT") ||
    k.includes("NOTIFICATION") ||
    k.includes("NOTICE")
  ) {
    return "support";
  }
  return "other";
}

/** CG-21: edits safe wording only, not auth/validation rules or internal error codes. */
export function SafeErrorMessagesEditor({ canEdit }: { canEdit: boolean }) {
  const [items, setItems] = useState<ErrorCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<ErrorCopy | null>(null);
  const [wording, setWording] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [unknown, setUnknown] = useState<{ key: string; wording: string; revision: number } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({ auth: true });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/error-messages", { cache: "no-store" });
      if (!res.ok) {
        throw Error(
          res.status === 401
            ? "Sign in again to review error messages."
            : res.status === 403
              ? "Your role cannot view message settings."
              : "Message settings cannot be loaded. Check your connection and retry."
        );
      }
      const data = (await res.json()) as { messages?: ErrorCopy[] };
      if (!Array.isArray(data.messages)) throw Error("Message settings could not be confirmed.");
      setItems(data.messages);
      return data.messages;
    } catch (e) {
      setNotice({
        kind: "error",
        message: e instanceof Error ? e.message : "Message settings cannot be loaded. Please retry."
      });
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  // Global keyboard shortcuts (Ctrl+K to focus search, Escape to close drawer)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && active && !busy) {
        cancelEditor();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, busy]);

  function begin(message: ErrorCopy) {
    if (!canEdit || busy || unknown) return;
    setActive(message);
    setWording(message.effectiveMessage);
    setPassword("");
    setShowPassword(false);
    setCopied(false);
    setNotice(null);
  }

  function cancelEditor() {
    if (busy || Boolean(unknown)) return;
    setActive(null);
    setPassword("");
    setShowPassword(false);
    setCopied(false);
    setNotice(null);
  }

  function handleCopyKey(key: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleAccordion(catId: string) {
    setOpenAccordions(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  }

  function resetFilters() {
    setSearchQuery("");
    setSelectedCategory("all");
    setSelectedStatus("all");
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || !canEdit || busy || unknown) return;
    setNotice(null);
    const value = wording.trim();
    if (
      value.length < 16 ||
      value.length > 220 ||
      /[<>\r\n\x00-\x1f]/.test(value) ||
      !/[.!?]$/.test(value)
    ) {
      setNotice({
        kind: "error",
        message:
          "Write a clear sentence of 16–220 characters that tells the person what to do next. Use plain text and ending punctuation."
      });
      return;
    }
    if (value === active.effectiveMessage) {
      setNotice({
        kind: "error",
        message: "This wording is already in use. Change the message before saving."
      });
      return;
    }
    if (password.length < 8) {
      setNotice({
        kind: "error",
        message: "Enter your current sign-in password to authorize this change."
      });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/platform/error-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: active.key,
          message: value,
          expectedRevision: active.revision,
          currentPassword: password,
          requestKey: crypto.randomUUID()
        })
      });
      if (!res.ok) {
        if (res.status >= 500) throw Error("UNCONFIRMED");
        const safe: unknown = await res.json().catch(() => null);
        const exact =
          safe &&
          typeof safe === "object" &&
          !Array.isArray(safe) &&
          "message" in safe &&
          typeof safe.message === "string" &&
          safe.message.length <= 220
            ? safe.message
            : null;
        setNotice({
          kind: "error",
          message:
            exact ??
            (res.status === 409
              ? "This wording changed while you edited it. Refresh the list before trying again."
              : res.status === 401 || res.status === 403
                ? "Your session or permission cannot authorize this change. Sign in and ask the Foundation Administrator."
                : "Review the replacement sentence and current password, then try again.")
        });
        return;
      }
      const updated = (await res.json()) as { revision?: number };
      if (!Number.isInteger(updated.revision)) throw Error("UNCONFIRMED");
      const latest = await reload();
      if (
        !latest ||
        !latest.some(
          item =>
            item.key === active.key &&
            item.effectiveMessage === value &&
            item.revision >= Number(updated.revision)
        )
      ) {
        throw Error("UNCONFIRMED");
      }
      setActive(null);
      setPassword("");
      setShowPassword(false);
      setNotice({
        kind: "success",
        message:
          "The updated wording was saved. New matching errors will use it after a short cache refresh (up to one minute)."
      });
    } catch {
      setUnknown({ key: active.key, wording: value, revision: active.revision });
      setNotice({
        kind: "uncertain",
        message:
          "The save result could not be confirmed. Check the current published wording before making another change."
      });
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!unknown || busy) return;
    const latest = await reload();
    if (!latest) return;
    const found = latest.find(item => item.key === unknown.key);
    if (found && found.effectiveMessage === unknown.wording && found.revision > unknown.revision) {
      setUnknown(null);
      setActive(null);
      setPassword("");
      setShowPassword(false);
      setNotice({ kind: "success", message: "The original message update was confirmed." });
    } else {
      setNotice({
        kind: "uncertain",
        message:
          "The original change is not confirmed. Do not resubmit blindly; contact your Foundation Administrator if this persists."
      });
    }
  }

  // Live validation calculations for replacement wording
  const trimmedWording = wording.trim();
  const isWordingTouched = wording.length > 0;
  const isWordingLengthValid = trimmedWording.length >= 16 && trimmedWording.length <= 220;
  const hasValidChars = !/[<>\r\n\x00-\x1f]/.test(trimmedWording);
  const hasEndingPunctuation = /[.!?]$/.test(trimmedWording);
  const isWordingValid = isWordingLengthValid && hasValidChars && hasEndingPunctuation;

  const wordingValidationMsg = useMemo(() => {
    if (!isWordingTouched) return null;
    if (trimmedWording.length < 16) {
      return `Must contain at least 16 characters (${16 - trimmedWording.length} more needed).`;
    }
    if (trimmedWording.length > 220) {
      return `Exceeds maximum limit of 220 characters (${trimmedWording.length - 220} over).`;
    }
    if (!hasValidChars) {
      return "HTML angle brackets and line breaks are not permitted.";
    }
    if (!hasEndingPunctuation) {
      return "Sentence must end with punctuation (. or ! or ?).";
    }
    return null;
  }, [trimmedWording, isWordingTouched, hasValidChars, hasEndingPunctuation]);

  // Summary Metrics (Derived from actual items data)
  const totalCount = items.length;
  const customizedCount = items.filter(x => x.customized).length;
  const defaultCount = items.filter(x => !x.customized).length;

  // Filtered Items
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      // Category filter
      if (selectedCategory !== "all") {
        const cat = getErrorCategory(item.key);
        if (cat !== selectedCategory) return false;
      }
      // Status filter
      if (selectedStatus === "customized" && !item.customized) return false;
      if (selectedStatus === "default" && item.customized) return false;
      // Search query filter
      if (query) {
        const matchKey = item.key.toLowerCase().includes(query);
        const matchEffective = item.effectiveMessage.toLowerCase().includes(query);
        const matchDefault = item.defaultMessage.toLowerCase().includes(query);
        if (!matchKey && !matchEffective && !matchDefault) return false;
      }
      return true;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const map = new Map<ErrorCategory, ErrorCopy[]>();
    for (const cat of CATEGORIES) {
      map.set(cat.id, []);
    }
    for (const item of filteredItems) {
      const cat = getErrorCategory(item.key);
      const list = map.get(cat);
      if (list) {
        list.push(item);
      } else {
        map.get("other")?.push(item);
      }
    }
    return map;
  }, [filteredItems]);

  return (
    <section className="cg-gs-card" id="error-messages-section" aria-label="User-facing error wording">
      <div className="cg-gs-card-header">
        <div className="cg-gs-card-header-left">
          <div className="cg-gs-card-icon-wrap">
            <MessageSquareIcon size={18} />
          </div>
          <div className="cg-gs-card-title-group">
            <h2>User-facing Error Messages</h2>
            <p>Customize clear guidance without changing validation, security or accounting rules.</p>
          </div>
        </div>
        <button
          type="button"
          className="cg-gs-btn-refresh"
          disabled={loading || busy}
          onClick={() => void reload()}
          aria-label="Refresh error messages"
        >
          <RefreshCwIcon size={15} className={loading ? "cg-gs-spin" : undefined} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="cg-gs-card-body">
        {/* Notice banners */}
        {!active && notice && (
          <div className={`cg-gs-notice-banner ${notice.kind}`} role={notice.kind === "success" ? "status" : "alert"}>
            <AlertTriangleIcon size={16} />
            <div>{notice.message}</div>
          </div>
        )}

        {!active && unknown && (
          <div className="cg-gs-notice-banner warning" style={{ marginBottom: "1rem" }}>
            <AlertTriangleIcon size={16} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "1rem" }}>
              <span>A prior message change needs confirmation.</span>
              <button
                type="button"
                className="cg-gs-btn-cancel"
                style={{ height: "1.875rem", fontSize: "0.775rem", padding: "0 0.625rem" }}
                onClick={() => void check()}
                disabled={busy}
              >
                Check original change
              </button>
            </div>
          </div>
        )}

        {/* 3 Summary Metric Cards (Data-derived, never hardcoded) */}
        <div className="cg-gs-metrics-row">
          <div className="cg-gs-metric-card">
            <div className="cg-gs-metric-icon cg-gs-metric-icon-total">
              <MessageSquareIcon size={20} />
            </div>
            <div className="cg-gs-metric-info">
              <span className="cg-gs-metric-val">{loading ? "…" : totalCount > 100 ? `${totalCount}+` : totalCount}</span>
              <span className="cg-gs-metric-label">Total messages</span>
            </div>
          </div>

          <div className="cg-gs-metric-card">
            <div className="cg-gs-metric-icon cg-gs-metric-icon-custom">
              <PencilIcon size={20} />
            </div>
            <div className="cg-gs-metric-info">
              <span className="cg-gs-metric-val">{loading ? "…" : customizedCount}</span>
              <span className="cg-gs-metric-label">Customized</span>
            </div>
          </div>

          <div className="cg-gs-metric-card">
            <div className="cg-gs-metric-icon cg-gs-metric-icon-default">
              <CheckIcon size={20} />
            </div>
            <div className="cg-gs-metric-info">
              <span className="cg-gs-metric-val">{loading ? "…" : defaultCount}</span>
              <span className="cg-gs-metric-label">Default</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search input + Category select + Status select */}
        <div className="cg-gs-toolbar">
          <div className="cg-gs-search-wrap">
            <SearchIcon size={16} className="cg-gs-search-icon-pos" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by message, ID or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="cg-gs-search-input"
              aria-label="Search error messages"
            />
            <kbd className="cg-gs-kbd-badge">Ctrl K</kbd>
          </div>

          <select
            className="cg-gs-select"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            className="cg-gs-select"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="customized">Customized</option>
            <option value="default">Default</option>
          </select>
        </div>

        {/* Loading skeleton / state */}
        {loading ? (
          <div className="cg-gs-empty-state" role="status">
            <RefreshCwIcon size={28} className="cg-gs-empty-icon cg-gs-spin" />
            <p className="cg-gs-empty-title">Loading approved message wording…</p>
            <p className="cg-gs-empty-desc">Connecting to the Foundation platform configuration store.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          /* Empty / No Results State */
          <div className="cg-gs-empty-state" role="status">
            <SearchIcon size={32} className="cg-gs-empty-icon" />
            <p className="cg-gs-empty-title">No messages found</p>
            <p className="cg-gs-empty-desc">
              No error messages match your current search and filter criteria. Try adjusting your query or resetting filters.
            </p>
            <button
              type="button"
              className="cg-gs-btn-cancel cg-gs-empty-action"
              onClick={resetFilters}
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Category Accordions List */
          <div className="cg-gs-accordion-list">
            {CATEGORIES.map(cat => {
              const catItems = itemsByCategory.get(cat.id) ?? [];
              if (catItems.length === 0) return null;
              const isOpen = Boolean(openAccordions[cat.id]);
              const IconComp = cat.icon;

              return (
                <div key={cat.id} className={`cg-gs-accordion ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="cg-gs-accordion-header"
                    onClick={() => toggleAccordion(cat.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="cg-gs-accordion-left">
                      <span className="cg-gs-cat-icon">
                        <IconComp size={18} />
                      </span>
                      <h3 className="cg-gs-accordion-title">{cat.name}</h3>
                    </div>
                    <div className="cg-gs-accordion-right">
                      <span className="cg-gs-cat-count-badge">{catItems.length}</span>
                      {isOpen ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="cg-gs-accordion-body">
                      <div className="cg-gs-table-wrap">
                        <table className="cg-gs-msg-table">
                          <thead>
                            <tr>
                              <th style={{ width: "65%" }}>Message (ID)</th>
                              <th style={{ width: "20%" }}>Wording Status</th>
                              <th style={{ width: "15%", textAlign: "right" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catItems.map(item => (
                              <tr key={item.key}>
                                <td>
                                  <div className="cg-gs-msg-text">{item.effectiveMessage}</div>
                                  <div className="cg-gs-msg-key-code">({item.key})</div>
                                </td>
                                <td>
                                  <span
                                    className={`cg-gs-msg-custom-badge ${
                                      item.customized ? "is-customized" : "is-default"
                                    }`}
                                  >
                                    {item.customized ? "Customized" : "Default"}
                                  </span>
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {canEdit ? (
                                    <button
                                      type="button"
                                      className="cg-gs-btn-edit-sm"
                                      disabled={busy || Boolean(unknown)}
                                      onClick={() => begin(item)}
                                    >
                                      <PencilIcon size={13} />
                                      <span>Edit</span>
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: "0.775rem", color: "var(--cg-gs-muted)" }}>
                                      View only
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Slide-out Drawer: Edit User-facing Message */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="cg-gs-drawer-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={e => {
              if (e.target === e.currentTarget && !busy) cancelEditor();
            }}
          >
            <motion.section
              className="cg-gs-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cg-error-editor-title"
              initial={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              animate={{ x: 0 }}
              exit={prefersReducedMotion ? { x: 0 } : { x: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.25, ease: "easeOut" }
              }
            >
              <header className="cg-gs-drawer-header">
                <div className="cg-gs-drawer-header-left">
                  <div className="cg-gs-drawer-icon-wrap">
                    <PencilIcon size={18} />
                  </div>
                  <div className="cg-gs-drawer-title-wrap">
                    <h2 id="cg-error-editor-title" className="cg-gs-drawer-title">
                      Edit User-facing Message
                    </h2>
                    <p className="cg-gs-drawer-desc">
                      Customize user guidance without changing validation rules
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cg-gs-btn-close-drawer"
                  disabled={busy || Boolean(unknown)}
                  onClick={cancelEditor}
                  aria-label="Close editor"
                  title="Close editor (Esc)"
                >
                  <XIcon size={18} />
                </button>
              </header>

              <form className="cg-gs-drawer-form" onSubmit={save} noValidate>
                <div className="cg-gs-drawer-content">
                  {notice && (
                    <div
                      className={`cg-gs-notice-banner ${notice.kind}`}
                      role={notice.kind === "success" ? "status" : "alert"}
                    >
                      <AlertTriangleIcon size={16} />
                      <div>{notice.message}</div>
                    </div>
                  )}

                  {unknown && (
                    <div className="cg-gs-notice-banner warning">
                      <AlertTriangleIcon size={16} />
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          gap: "1rem"
                        }}
                      >
                        <span>A prior message change needs confirmation.</span>
                        <button
                          type="button"
                          className="cg-gs-btn-cancel"
                          style={{ height: "1.875rem", fontSize: "0.775rem", padding: "0 0.625rem" }}
                          onClick={() => void check()}
                          disabled={busy}
                        >
                          Check original change
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="cg-gs-form-group">
                    <div className="cg-gs-form-label-row">
                      <label className="cg-gs-label">Message ID</label>
                      <span className="cg-gs-badge-subtle">System Key</span>
                    </div>
                    <div className="cg-gs-id-badge-wrap">
                      <code>{active.key}</code>
                      <button
                        type="button"
                        className={`cg-gs-copy-btn ${copied ? "is-copied" : ""}`}
                        onClick={() => handleCopyKey(active.key)}
                        aria-label="Copy Message ID"
                        title="Copy ID to clipboard"
                      >
                        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                        <span>{copied ? "Copied!" : "Copy ID"}</span>
                      </button>
                    </div>
                    <p className="cg-gs-helper-text">
                      Immutable identifier referenced across API contracts and audit events.
                    </p>
                  </div>

                  <div className="cg-gs-form-group">
                    <div className="cg-gs-form-label-row">
                      <label className="cg-gs-label">Original message (read-only)</label>
                      <span className="cg-gs-badge-subtle">Default Wording</span>
                    </div>
                    <div className="cg-gs-readonly-box">{active.defaultMessage}</div>
                    <p className="cg-gs-helper-text">
                      Original baseline guidance presented before any custom configuration.
                    </p>
                  </div>

                  <div className="cg-gs-form-group">
                    <div className="cg-gs-form-label-row">
                      <label htmlFor="cg-replacement-wording" className="cg-gs-label">
                        Replacement wording *
                      </label>
                      <span
                        className={`cg-gs-char-counter ${
                          isWordingValid ? "is-valid" : isWordingTouched ? "is-invalid" : ""
                        }`}
                      >
                        {wording.length} / 220
                      </span>
                    </div>
                    <textarea
                      id="cg-replacement-wording"
                      maxLength={220}
                      minLength={16}
                      required
                      rows={4}
                      value={wording}
                      onChange={e => setWording(e.target.value)}
                      className="cg-gs-textarea"
                      placeholder="Write a clear sentence of 16–220 characters that tells the person what to do next."
                      aria-invalid={wordingValidationMsg !== null}
                      aria-describedby="cg-wording-helper"
                    />
                    {wordingValidationMsg && (
                      <div className="cg-gs-field-validation-msg" role="alert">
                        <AlertCircleIcon size={14} />
                        <span>{wordingValidationMsg}</span>
                      </div>
                    )}
                    <p id="cg-wording-helper" className="cg-gs-helper-text">
                      Make the message specific and helpful. Do not include account identifiers, internal
                      codes, or sensitive information. Editing never changes what the system validates.
                    </p>
                  </div>

                  <div className="cg-gs-form-group">
                    <label htmlFor="cg-error-current-password" className="cg-gs-label">
                      Current password *
                    </label>
                    <div className="cg-gs-input-wrap">
                      <input
                        id="cg-error-current-password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        maxLength={1024}
                        autoComplete="current-password"
                        value={password}
                        placeholder="Enter your current password"
                        className="cg-gs-input cg-gs-input-with-toggle"
                        onChange={e => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="cg-gs-btn-toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </button>
                    </div>
                    <p className="cg-gs-helper-text">
                      Enter your sign-in password to confirm and authorize this wording change.
                    </p>
                  </div>
                </div>

                <footer className="cg-gs-drawer-footer">
                  <button
                    type="button"
                    className="cg-gs-btn-cancel"
                    disabled={busy || Boolean(unknown)}
                    onClick={cancelEditor}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cg-gs-btn-primary"
                    disabled={
                      busy ||
                      Boolean(unknown) ||
                      !isWordingValid ||
                      password.length < 8
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
                        <span>Save wording</span>
                      </>
                    )}
                  </button>
                </footer>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
