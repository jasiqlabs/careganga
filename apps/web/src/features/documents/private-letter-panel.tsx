"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileBadge,
  ShieldCheck,
  Eye,
  EyeOff,
  Printer,
  Download,
  RefreshCw,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Info,
  FileText,
  Layers,
  FileUp,
  XCircle,
  HelpCircle,
} from "lucide-react";

type Template = {
  configured: boolean;
  version: number;
  title?: string;
  body?: string;
  status: string;
};

type Letter = {
  documentRef: string;
  state: string;
  issueRevision: number;
  templateVersion: number;
  issuedAt: string | null;
  canDownload: boolean;
  canReconcile: boolean;
};

type LetterListResponse = {
  letters: Letter[];
  caseNumber: string;
};

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object): Promise<T> {
  let response: globalThis.Response;
  try {
    response = await fetch("/api/documents/letters/" + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Error("UNKNOWN");
  }
  if (response.status === 401 || response.status === 403) throw Error("DENIED");
  if (response.status === 409) throw Error("CONFLICT");
  if (response.status === 400) throw Error("INVALID");
  if (!response.ok) throw Error("UNKNOWN");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

type Notice = { kind: "error" | "success" | "info"; text: string };

function message(e: unknown) {
  const code = e instanceof Error ? e.message : "UNKNOWN";
  return code === "DENIED"
    ? "Your protected letter permission is no longer verified."
    : code === "CONFLICT"
    ? "The original letter changed. Refresh before continuing."
    : code === "INVALID"
    ? "Check the template and current password."
    : "The letter action outcome could not be confirmed. Check the same request before retrying.";
}

function label(s: string) {
  return (
    ({
      PENDING: "Request recorded, PDF not yet issued",
      VERIFYING: "Verifying private PDF",
      ISSUED: "Private PDF issued and verified",
      UNKNOWN: "Outcome unconfirmed — reconcile before retry",
      FAILED: "Private PDF not issued",
      REVOKED: "Revoked — download blocked",
    } as Record<string, string>)[s] ?? "Private document unverified"
  );
}

function badgeClass(s: string) {
  switch (s) {
    case "ISSUED":
      return "cg19-badge cg19-badge-success";
    case "PENDING":
      return "cg19-badge cg19-badge-warning";
    case "VERIFYING":
      return "cg19-badge cg19-badge-info";
    case "REVOKED":
    case "FAILED":
      return "cg19-badge cg19-badge-danger";
    case "UNKNOWN":
      return "cg19-badge cg19-badge-warning";
    default:
      return "cg19-badge cg19-badge-neutral";
  }
}

export function PrivateLetterPanel({
  caseRef,
  sourceRevision,
  canIssue,
  canRevoke,
}: {
  caseRef: string;
  sourceRevision: number;
  canIssue: boolean;
  canRevoke: boolean;
}) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [caseNumber, setCaseNumber] = useState("");
  const [title, setTitle] = useState("Protected access confirmation");
  const [body, setBody] = useState(
    "This letter confirms that the specified CareGanga Foundation access change was approved and applied. Access remains subject to current permissions and may be revoked."
  );
  const [templatePassword, setTemplatePassword] = useState("");
  const [issuePassword, setIssuePassword] = useState("");
  const [revokePassword, setRevokePassword] = useState("");
  const [review, setReview] = useState<"TEMPLATE" | "ISSUE" | "REVOKE" | null>(null);
  const [revokeRef, setRevokeRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unknown, setUnknown] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const templateKey = useRef("");
  const issueKey = useRef("");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true);
    try {
      const [t, l] = await Promise.all([
        request<Template>("template"),
        request<LetterListResponse>("case/" + encodeURIComponent(caseRef)),
      ]);
      if (!t || !Number.isInteger(t.version) || !Array.isArray(l.letters) || l.letters.length > 20)
        throw Error("UNKNOWN");
      if (seq !== generation.current) return;
      setTemplate(t);
      setLetters(l.letters);
      if (typeof l.caseNumber === "string" && l.caseNumber) setCaseNumber(l.caseNumber);
      if (t.configured && t.title && t.body) {
        setTitle(t.title);
        setBody(t.body);
      }
    } catch (e) {
      if (seq !== generation.current) return;
      setTemplate(null);
      setLetters([]);
      setNotice({ kind: "error", text: message(e) });
    } finally {
      if (seq === generation.current) setLoading(false);
    }
  }, [caseRef]);

  useEffect(() => {
    setUnknown(false);
    setNotice(null);
    issueKey.current = "";
    templateKey.current = "";
    setReview(null);
    setRevokeRef("");
    void refresh();
    return () => {
      ++generation.current;
    };
  }, [refresh, sourceRevision]);

  async function approveTemplate() {
    if (busy || unknown || !canIssue) return;
    if (templatePassword.length < 8 || templatePassword.length > 1024) {
      setNotice({ kind: "error", text: "Enter a current password (minimum 8 characters)." });
      return;
    }
    if (review !== "TEMPLATE") {
      setReview("TEMPLATE");
      return;
    }
    setBusy(true);
    setNotice(null);
    if (!templateKey.current) templateKey.current = crypto.randomUUID();
    try {
      const result = await request<{ version: number; status: string }>("template/approve", "POST", {
        title,
        body,
        expectedVersion: template?.version ?? 0,
        requestKey: templateKey.current,
        currentPassword: templatePassword,
      });
      if (!Number.isInteger(result.version)) throw Error("UNKNOWN");
      templateKey.current = "";
      setReview(null);
      setTemplatePassword("");
      setNotice({
        kind: "success",
        text: "A new private letter template version was successfully approved.",
      });
      await refresh();
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUnknown(true);
      setNotice({ kind: "error", text: message(e) });
    } finally {
      setBusy(false);
    }
  }

  async function issue() {
    if (busy || unknown || !canIssue) return;
    if (issuePassword.length < 8 || issuePassword.length > 1024) {
      setNotice({ kind: "error", text: "Enter a current password (minimum 8 characters)." });
      return;
    }
    if (review !== "ISSUE") {
      setReview("ISSUE");
      return;
    }
    setBusy(true);
    setNotice(null);
    if (!issueKey.current) issueKey.current = crypto.randomUUID();
    try {
      const result = await request<Letter>("issue", "POST", {
        caseRef,
        sourceRevision,
        requestKey: issueKey.current,
        currentPassword: issuePassword,
      });
      if (!result || typeof result.state !== "string" || typeof result.documentRef !== "string")
        throw Error("UNKNOWN");
      issueKey.current = "";
      setIssuePassword("");
      setReview(null);
      setNotice({
        kind: result.state === "ISSUED" ? "success" : "info",
        text:
          result.state === "ISSUED"
            ? "Private PDF issued and verified successfully."
            : "Request recorded, but PDF is not confirmed: " + label(result.state),
      });
      await refresh();
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUnknown(true);
      setNotice({ kind: "error", text: message(e) });
    } finally {
      setBusy(false);
    }
  }

  async function findOriginal() {
    if (!issueKey.current || busy) return;
    setBusy(true);
    try {
      const result = await request<{ status: string; letter: Letter | null }>(
        "requests/" + encodeURIComponent(issueKey.current)
      );
      setUnknown(result.status !== "CONFIRMED");
      setNotice({
        kind: result.status === "CONFIRMED" ? "info" : "error",
        text:
          result.status === "CONFIRMED"
            ? "Original request located: " + label(result.letter?.state ?? "UNKNOWN")
            : "No verified original request is visible. Contact Foundation operations before retrying.",
      });
      await refresh();
    } catch (e) {
      setNotice({ kind: "error", text: message(e) });
    } finally {
      setBusy(false);
    }
  }

  async function reconcile(ref: string) {
    if (busy || unknown) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await request<Letter>(encodeURIComponent(ref) + "/reconcile", "POST");
      setNotice({
        kind: result.state === "ISSUED" ? "success" : "info",
        text: label(result.state),
      });
      await refresh();
    } catch (e) {
      setNotice({ kind: "error", text: message(e) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!canRevoke || busy || unknown || !revokeRef) return;
    if (revokePassword.length < 8 || revokePassword.length > 1024) {
      setNotice({ kind: "error", text: "Enter a current password (minimum 8 characters)." });
      return;
    }
    if (review !== "REVOKE") {
      setReview("REVOKE");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await request<Letter>(encodeURIComponent(revokeRef) + "/revoke", "POST", {
        currentPassword: revokePassword,
      });
      setReview(null);
      setRevokeRef("");
      setRevokePassword("");
      setNotice({
        kind: result.state === "REVOKED" ? "success" : "info",
        text:
          result.state === "REVOKED"
            ? "The private letter is revoked and cannot be downloaded."
            : "The letter status requires verification.",
      });
      await refresh();
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUnknown(true);
      setNotice({ kind: "error", text: message(e) });
    } finally {
      setBusy(false);
    }
  }

  const latestIssued = letters.find((l) => l.state === "ISSUED");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Header & Toolbar Card */}
      <div
        className="cg19-table-card"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "1rem 1.25rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "#eff6ff",
              border: "1px solid #dbeafe",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#1d4ed8",
            }}
          >
            <FileBadge size={18} strokeWidth={2} style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <h2
              className="font-slab"
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Approved Access Letters
            </h2>
            <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.78rem", color: "#64748b" }}>
              Verifiable PDF generation and cryptographically approved letterhead
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            className="cg19-btn-reset"
            aria-pressed={showPreview}
            onClick={() => setShowPreview((p) => !p)}
            style={{
              fontSize: "0.78rem",
              padding: "0.4rem 0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
            }}
          >
            {showPreview ? (
              <>
                <EyeOff size={14} strokeWidth={2} style={{ width: "14px", height: "14px" }} />
                <span>Hide Letterhead Preview</span>
              </>
            ) : (
              <>
                <Eye size={14} strokeWidth={2} style={{ width: "14px", height: "14px" }} />
                <span>Show Letterhead Preview</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="cg19-btn-reset"
            disabled={busy || loading}
            onClick={() => void refresh()}
            style={{
              fontSize: "0.78rem",
              padding: "0.4rem 0.75rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw
              size={13}
              strokeWidth={2}
              className={loading ? "cg-spin" : ""}
              style={{ width: "13px", height: "13px" }}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            background:
              notice.kind === "success" ? "#f0fdf4" : notice.kind === "info" ? "#eff6ff" : "#fef2f2",
            color:
              notice.kind === "success" ? "#15803d" : notice.kind === "info" ? "#1e40af" : "#b91c1c",
            border: `1px solid ${
              notice.kind === "success" ? "#bbf7d0" : notice.kind === "info" ? "#bfdbfe" : "#fecaca"
            }`,
          }}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 size={16} strokeWidth={2} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          ) : notice.kind === "info" ? (
            <Info size={16} strokeWidth={2} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          ) : (
            <AlertCircle size={16} strokeWidth={2} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          )}
          <span style={{ flex: 1 }}>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              padding: "0.2rem",
            }}
          >
            <XCircle size={14} strokeWidth={2} style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      )}

      {/* Uncertain Outcome Alert */}
      {unknown && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "10px",
            padding: "1rem 1.25rem",
            color: "#92400e",
            fontSize: "0.85rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, marginBottom: "0.35rem" }}>
            <AlertCircle size={16} strokeWidth={2} style={{ width: "16px", height: "16px" }} />
            <span>Previous write outcome is unconfirmed</span>
          </div>
          <p style={{ margin: "0 0 0.65rem 0", lineHeight: 1.5, color: "#78350f" }}>
            Do not issue another letter or approve another template until the original status is verified.
          </p>
          <button
            type="button"
            className="cg19-btn-apply"
            disabled={busy || !issueKey.current}
            onClick={() => void findOriginal()}
            style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}
          >
            Check Original Issue Request
          </button>
        </div>
      )}

      {loading ? (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "3rem 1.5rem",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <RefreshCw
            size={24}
            strokeWidth={2}
            className="cg-spin"
            style={{ width: "24px", height: "24px", margin: "0 auto 0.75rem auto", color: "#3b82f6" }}
          />
          <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 500 }}>
            Verifying approved letter history and template status…
          </p>
        </div>
      ) : (
        <>
          {/* Official A4 Letterhead Preview Sheet */}
          {showPreview && (
            <div
              className="cg19-table-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              {/* Toolbar above Preview */}
              <div
                style={{
                  padding: "0.75rem 1.25rem",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                  <FileText size={15} strokeWidth={2} style={{ width: "15px", height: "15px", color: "#0A1F44" }} />
                  <span>Official A4 Document Sheet</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="cg19-btn-reset"
                    onClick={() => window.print()}
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.3rem 0.65rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      cursor: "pointer",
                    }}
                  >
                    <Printer size={13} strokeWidth={2} style={{ width: "13px", height: "13px" }} />
                    <span>Print Letter</span>
                  </button>
                  {latestIssued?.canDownload && (
                    <a
                      href={"/api/documents/letters/" + encodeURIComponent(latestIssued.documentRef) + "/download"}
                      className="cg19-btn-apply"
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.3rem 0.65rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        textDecoration: "none",
                      }}
                    >
                      <Download size={13} strokeWidth={2} style={{ width: "13px", height: "13px" }} />
                      <span>Download PDF</span>
                    </a>
                  )}
                </div>
              </div>

              {/* The Rendered Letter Sheet */}
              <div style={{ padding: "1.25rem", background: "#f1f5f9" }}>
                <article
                  className="cg19-letter-sheet"
                  aria-label="Live Official Letterhead Preview"
                  style={{
                    background: "#ffffff",
                    color: "#1e293b",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    maxWidth: "650px",
                    margin: "0 auto",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.06)",
                    fontFamily: "Georgia, serif",
                  }}
                >
                  <div className="cg19-letter-top-stripe" style={{ height: "8px", background: "#0A1F44" }} />
                  
                  <header
                    className="cg19-letter-header"
                    style={{
                      padding: "1.25rem 1.75rem 0.85rem 1.75rem",
                      borderBottom: "2px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h3
                        className="cg19-letter-brand font-slab"
                        style={{
                          fontSize: "1.35rem",
                          fontWeight: 700,
                          color: "#0A1F44",
                          margin: 0,
                          letterSpacing: "0.02em",
                        }}
                      >
                        CareGanga Foundation
                      </h3>
                      <p
                        className="cg19-letter-sub"
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          margin: "0.2rem 0 0 0",
                          fontFamily: "system-ui, sans-serif",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontWeight: 600,
                        }}
                      >
                        Official Protected Access Confirmation
                      </p>
                    </div>

                    <div
                      style={{
                        padding: "0.25rem 0.55rem",
                        borderRadius: "6px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        fontSize: "0.7rem",
                        fontFamily: "system-ui, sans-serif",
                        color: "#475569",
                        textAlign: "right",
                      }}
                    >
                      <span style={{ display: "block", fontWeight: 700, color: "#0f172a" }}>CareGanga Trust</span>
                      <span>Verified System Letter</span>
                    </div>
                  </header>

                  <div
                    className="cg19-letter-meta-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: "0.5rem 1.25rem",
                      padding: "0.85rem 1.75rem",
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      fontFamily: "system-ui, sans-serif",
                      fontSize: "0.8rem",
                    }}
                  >
                    <div className="cg19-letter-meta-item">
                      <strong style={{ color: "#475569", fontSize: "0.7rem", textTransform: "uppercase", display: "block" }}>
                        Application Reference
                      </strong>
                      <span className="font-slab" style={{ color: "#0f172a", fontWeight: 600 }}>
                        {caseNumber || caseRef.slice(0, 8)}
                      </span>
                    </div>
                    <div className="cg19-letter-meta-item">
                      <strong style={{ color: "#475569", fontSize: "0.7rem", textTransform: "uppercase", display: "block" }}>
                        Approved Revision
                      </strong>
                      <span style={{ color: "#0f172a", fontWeight: 600 }}>Revision {sourceRevision}</span>
                    </div>
                    <div className="cg19-letter-meta-item">
                      <strong style={{ color: "#475569", fontSize: "0.7rem", textTransform: "uppercase", display: "block" }}>
                        Template Status
                      </strong>
                      <span style={{ color: "#0f172a", fontWeight: 600 }}>
                        {template?.configured && template.status === "APPROVED"
                          ? `Approved v${template.version}`
                          : "Template Draft"}
                      </span>
                    </div>
                    <div className="cg19-letter-meta-item">
                      <strong style={{ color: "#475569", fontSize: "0.7rem", textTransform: "uppercase", display: "block" }}>
                        Latest Document Status
                      </strong>
                      <span className={latestIssued ? badgeClass(latestIssued.state) : "cg19-badge cg19-badge-neutral"}>
                        {latestIssued ? label(latestIssued.state) : "Not yet issued"}
                      </span>
                    </div>
                  </div>

                  <div className="cg19-letter-content" style={{ padding: "1.75rem", minHeight: "200px" }}>
                    <h4
                      className="cg19-letter-title"
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        color: "#0A1F44",
                        margin: "0 0 1rem 0",
                        lineHeight: 1.4,
                      }}
                    >
                      {title || "Official Access Notice"}
                    </h4>

                    <div
                      className="cg19-letter-body"
                      style={{
                        fontSize: "0.92rem",
                        lineHeight: 1.7,
                        color: "#334155",
                        whiteSpace: "pre-wrap",
                        marginBottom: "1.5rem",
                      }}
                    >
                      {body || "Letter body content preview."}
                    </div>

                    <aside
                      className="cg19-letter-terms"
                      style={{
                        background: "#f8fafc",
                        borderLeft: "3px solid #0A1F44",
                        padding: "0.65rem 0.85rem",
                        margin: "1.25rem 0",
                        fontSize: "0.75rem",
                        color: "#475569",
                        fontFamily: "system-ui, sans-serif",
                        lineHeight: 1.5,
                        borderRadius: "0 4px 4px 0",
                      }}
                    >
                      <strong>Terms &amp; Conditions:</strong> Access remains subject to current role grants and
                      security policy. This confirmation is cryptographically issued and may be revoked at any time
                      by authorized Foundation leadership.
                    </aside>

                    <div
                      className="cg19-letter-sign-block"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-end",
                        padding: "1.25rem 0 0.25rem 0",
                        borderTop: "1px dashed #cbd5e1",
                        fontFamily: "system-ui, sans-serif",
                      }}
                    >
                      <div
                        className="cg19-letter-seal"
                        aria-hidden="true"
                        style={{
                          width: "85px",
                          height: "85px",
                          border: "2px dashed #94a3b8",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          color: "#64748b",
                          textTransform: "uppercase",
                          padding: "0.2rem",
                          letterSpacing: "0.03em",
                          background: "#fafafa",
                        }}
                      >
                        Official
                        <br />
                        CareGanga
                        <br />
                        Seal
                      </div>

                      <div className="cg19-letter-signatory" style={{ textAlign: "right", fontSize: "0.8rem", color: "#475569" }}>
                        <strong style={{ display: "block", color: "#0f172a", fontSize: "0.88rem" }}>
                          Super Admin / Operations
                        </strong>
                        <span>CareGanga Foundation</span>
                        <small style={{ display: "block", color: "#16a34a", fontWeight: 600, marginTop: "0.2rem" }}>
                          ✓ Cryptographically Verified
                        </small>
                      </div>
                    </div>
                  </div>

                  <footer
                    className="cg19-letter-footer"
                    style={{
                      padding: "0.65rem 1.75rem",
                      background: "#f8fafc",
                      borderTop: "1px solid #e2e8f0",
                      fontSize: "0.72rem",
                      color: "#64748b",
                      textAlign: "center",
                      fontFamily: "system-ui, sans-serif",
                    }}
                  >
                    Private document. Verify current access status in CareGanga Foundation system.
                  </footer>
                </article>
              </div>
            </div>
          )}

          {/* Template Approval Card */}
          <div
            className="cg19-table-card"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileBadge size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#2563eb" }} />
                <h3 className="font-slab" style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  Approved Letter Template
                </h3>
              </div>
              <span
                className={
                  template?.configured && template.status === "APPROVED"
                    ? "cg19-badge cg19-badge-success"
                    : "cg19-badge cg19-badge-warning"
                }
              >
                {template?.configured && template.status === "APPROVED"
                  ? `Version ${template.version} Approved`
                  : "Template Not Approved"}
              </span>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
                {template?.configured && template.status === "APPROVED"
                  ? `Version ${template.version} is active and approved for private PDF issuance. Updating creates a new auditable revision.`
                  : "No active approved template. Configure and approve a template version before issuing access letters."}
              </p>

              {canIssue && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.35rem",
                      }}
                    >
                      Letter Heading
                    </label>
                    <input
                      value={title}
                      maxLength={100}
                      disabled={busy || unknown}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setReview(null);
                        templateKey.current = "";
                      }}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.85rem",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        color: "#0f172a",
                      }}
                      placeholder="e.g. Protected Access Confirmation"
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.35rem",
                      }}
                    >
                      Approved Letter Wording
                    </label>
                    <textarea
                      rows={3}
                      value={body}
                      maxLength={1200}
                      disabled={busy || unknown}
                      onChange={(e) => {
                        setBody(e.target.value);
                        setReview(null);
                        templateKey.current = "";
                      }}
                      style={{
                        width: "100%",
                        padding: "0.55rem 0.85rem",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        color: "#0f172a",
                        resize: "vertical",
                        lineHeight: 1.5,
                      }}
                      placeholder="Enter the official wording to appear in the letter..."
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.35rem",
                      }}
                    >
                      Confirm Super Admin Password for Template Approval
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="password"
                        autoComplete="current-password"
                        minLength={8}
                        maxLength={1024}
                        value={templatePassword}
                        disabled={busy || unknown}
                        onChange={(e) => {
                          setTemplatePassword(e.target.value);
                          setReview(null);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.85rem 0.55rem 2.2rem",
                          fontSize: "0.85rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          outline: "none",
                          color: "#0f172a",
                        }}
                        placeholder="Enter Super Admin password (CareGanga@123)"
                      />
                      <Lock
                        size={14}
                        strokeWidth={2}
                        style={{
                          position: "absolute",
                          left: "0.75rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#94a3b8",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>

                  {review === "TEMPLATE" && (
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "8px",
                        fontSize: "0.82rem",
                        color: "#92400e",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span>
                        Please confirm: Approving creates a new immutable template version. Previous letters remain
                        private under their original version.
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <button
                      type="button"
                      className="cg19-btn-apply"
                      disabled={busy || unknown}
                      onClick={() => void approveTemplate()}
                      style={{
                        fontSize: "0.82rem",
                        padding: "0.5rem 1rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <CheckCircle2 size={14} strokeWidth={2} style={{ width: "14px", height: "14px" }} />
                      <span>{review === "TEMPLATE" ? "Confirm Template Approval" : "Review Template Approval"}</span>
                    </button>
                    {review === "TEMPLATE" && (
                      <button
                        type="button"
                        className="cg19-btn-reset"
                        disabled={busy}
                        onClick={() => setReview(null)}
                        style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Issue Verified Access Letter Card */}
          {canIssue && (
            <div
              className="cg19-table-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <ShieldCheck size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#16a34a" }} />
                <h3 className="font-slab" style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  Issue Verified Access Letter
                </h3>
              </div>

              <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
                  Only a completed Foundation approved-role grant can be confirmed. Issuance requires the current
                  frozen application revision and a verified password.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        color: "#334155",
                        marginBottom: "0.35rem",
                      }}
                    >
                      Confirm Super Admin Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="password"
                        autoComplete="current-password"
                        minLength={8}
                        maxLength={1024}
                        value={issuePassword}
                        disabled={busy || unknown}
                        onChange={(e) => {
                          setIssuePassword(e.target.value);
                          setReview(null);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.85rem 0.55rem 2.2rem",
                          fontSize: "0.85rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          outline: "none",
                          color: "#0f172a",
                        }}
                        placeholder="Enter Super Admin password (CareGanga@123)"
                      />
                      <Lock
                        size={14}
                        strokeWidth={2}
                        style={{
                          position: "absolute",
                          left: "0.75rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "#94a3b8",
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>

                  {review === "ISSUE" && (
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        background: "#fffbeb",
                        border: "1px solid #fde68a",
                        borderRadius: "8px",
                        fontSize: "0.82rem",
                        color: "#92400e",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                      <span>
                        Review confirmed-grant issue request: Private storage and PDF validation must succeed before
                        status changes to Issued.
                      </span>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <button
                      type="button"
                      className="cg19-btn-apply"
                      disabled={busy || unknown || !template?.configured || template.status !== "APPROVED"}
                      onClick={() => void issue()}
                      style={{
                        fontSize: "0.82rem",
                        padding: "0.5rem 1rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <FileUp size={14} strokeWidth={2} style={{ width: "14px", height: "14px" }} />
                      <span>{review === "ISSUE" ? "Confirm Letter Issue" : "Review & Issue Letter"}</span>
                    </button>
                    {review === "ISSUE" && (
                      <button
                        type="button"
                        className="cg19-btn-reset"
                        disabled={busy}
                        onClick={() => setReview(null)}
                        style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Issued Letters History Table Card */}
          <div
            className="cg19-table-card"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Layers size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#64748b" }} />
                <h3 className="font-slab" style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
                  Verified Letter Revisions
                </h3>
              </div>
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>
                {letters.length} {letters.length === 1 ? "record" : "records"}
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "0.65rem 1rem", fontWeight: 600, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Issue Revision
                    </th>
                    <th style={{ padding: "0.65rem 1rem", fontWeight: 600, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Template
                    </th>
                    <th style={{ padding: "0.65rem 1rem", fontWeight: 600, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Status
                    </th>
                    <th style={{ padding: "0.65rem 1rem", fontWeight: 600, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Issued At
                    </th>
                    <th style={{ padding: "0.65rem 1rem", fontWeight: 600, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {letters.length > 0 ? (
                    letters.map((item) => (
                      <tr
                        key={item.documentRef}
                        style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s ease" }}
                      >
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#0f172a" }}>
                          Revision {item.issueRevision}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          Version {item.templateVersion}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span className={badgeClass(item.state)}>{label(item.state)}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#64748b", fontSize: "0.78rem" }}>
                          {item.issuedAt ? new Date(item.issuedAt).toLocaleString() : "Not issued"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                            {item.canDownload && (
                              <a
                                href={"/api/documents/letters/" + encodeURIComponent(item.documentRef) + "/download"}
                                className="cg19-btn-reset"
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.3rem 0.55rem",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                }}
                              >
                                <Download size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                <span>Download</span>
                              </a>
                            )}
                            {item.state === "ISSUED" && (
                              <button
                                type="button"
                                className="cg19-btn-reset"
                                onClick={() => window.print()}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.3rem 0.55rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  cursor: "pointer",
                                }}
                              >
                                <Printer size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                <span>Print</span>
                              </button>
                            )}
                            {item.canReconcile && canIssue && (
                              <button
                                type="button"
                                className="cg19-btn-reset"
                                disabled={busy || unknown}
                                onClick={() => void reconcile(item.documentRef)}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.3rem 0.55rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  cursor: "pointer",
                                }}
                              >
                                <RefreshCw size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                <span>Check</span>
                              </button>
                            )}
                            {item.state === "ISSUED" && canRevoke && (
                              <button
                                type="button"
                                className="cg19-btn-reset"
                                disabled={busy || unknown}
                                onClick={() => {
                                  setRevokeRef(item.documentRef);
                                  setReview(null);
                                }}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "0.3rem 0.55rem",
                                  color: "#b91c1c",
                                  borderColor: "#fecaca",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  cursor: "pointer",
                                }}
                              >
                                <Trash2 size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                <span>Revoke</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "2rem 1rem",
                          textAlign: "center",
                          color: "#94a3b8",
                          fontSize: "0.85rem",
                        }}
                      >
                        No verified private letters issued for this application.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revocation Card */}
          {revokeRef && canRevoke && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Trash2 size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#b91c1c" }} />
                <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#991b1b" }}>
                  Revoke Issued Private Letter
                </h4>
              </div>

              <p style={{ margin: 0, fontSize: "0.82rem", color: "#7f1d1d", lineHeight: 1.5 }}>
                Revoking permanently prevents future downloads. The audit log and original issued revision remain
                immutable for security.
              </p>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "#991b1b",
                    marginBottom: "0.35rem",
                  }}
                >
                  Confirm Super Admin Password for Revocation
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    maxLength={1024}
                    value={revokePassword}
                    disabled={busy || unknown}
                    onChange={(e) => {
                      setRevokePassword(e.target.value);
                      setReview(null);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.85rem 0.55rem 2.2rem",
                      fontSize: "0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #fca5a5",
                      outline: "none",
                      color: "#7f1d1d",
                      background: "#ffffff",
                    }}
                    placeholder="Enter Super Admin password (CareGanga@123)"
                  />
                  <Lock
                    size={14}
                    strokeWidth={2}
                    style={{
                      position: "absolute",
                      left: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#f87171",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>

              {review === "REVOKE" && (
                <div
                  style={{
                    padding: "0.65rem 0.85rem",
                    background: "#fee2e2",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    color: "#991b1b",
                  }}
                >
                  Confirm permanent revocation for this issued revision. Reissuing will generate a new auditable
                  revision.
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  disabled={busy || unknown}
                  onClick={() => void revoke()}
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0.5rem 1rem",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {review === "REVOKE" ? "Confirm Permanent Revocation" : "Review Revocation"}
                </button>
                <button
                  type="button"
                  className="cg19-btn-reset"
                  disabled={busy}
                  onClick={() => {
                    setRevokeRef("");
                    setRevokePassword("");
                    setReview(null);
                  }}
                  style={{ fontSize: "0.82rem", padding: "0.5rem 0.85rem" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
