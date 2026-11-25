"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { CG03CaseView, CG19UploadStart, CG19UploadStatus } from "@careganga/api-contracts";
import { PrivateLetterPanel } from "./private-letter-panel";
import { CustomDropdown, DropdownOption } from "../../shared/custom-dropdown";
import {
  Files,
  FolderArchive,
  ShieldCheck,
  FileBadge,
  Lock,
  HardDrive,
  UploadCloud,
  FileUp,
  X,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  Info,
  Clock,
  Layers,
} from "lucide-react";

const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
type Notice = { kind: "error" | "info" | "success"; text: string };
type MediaRecord = {
  fileRef: string;
  revision: number;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  revoked: boolean;
};

async function json<T>(url: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Error(method === "POST" ? "UNCERTAIN" : "OFFLINE");
  }
  if (response.status === 401) throw Error("EXPIRED");
  if (response.status === 403) throw Error("DENIED");
  if (response.status === 409) throw Error("CHANGED");
  if (response.status === 400) throw Error("INVALID");
  if (!response.ok) throw Error(method === "POST" ? "UNCERTAIN" : "OFFLINE");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error(method === "POST" ? "UNCERTAIN" : "OFFLINE");
  }
}

function safeMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "UNCERTAIN";
  return code === "EXPIRED"
    ? "Your session expired. Sign in again."
    : code === "DENIED"
    ? "Your current access does not permit this private file."
    : code === "CHANGED"
    ? "The application or original file changed. Refresh before continuing."
    : code === "INVALID"
    ? "Select a supported file smaller than 10 MB."
    : "The file operation is unconfirmed. Check its original status before retrying.";
}

function label(status: string) {
  return (
    ({
      UPLOAD_READY: "Upload permission ready (not yet uploaded)",
      INITIATED: "Waiting for private upload",
      VERIFYING: "Verifying file and malware scan",
      VALIDATED: "Verified private evidence",
      UNKNOWN: "Upload or scan outcome unconfirmed",
      STORAGE_UNAVAILABLE: "Private storage is unavailable",
      VERIFICATION_UNAVAILABLE: "File or malware scan could not be verified",
      EXPIRED: "Upload permission expired",
      REJECTED: "File rejected",
      EXPIRED_OR_REJECTED: "Upload expired or rejected",
    } as Record<string, string>)[status] ?? "Unverified private file"
  );
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "VALIDATED":
      return "cg19-badge cg19-badge-success";
    case "VERIFYING":
      return "cg19-badge cg19-badge-info";
    case "INITIATED":
    case "UPLOAD_READY":
    case "UNKNOWN":
      return "cg19-badge cg19-badge-warning";
    case "REJECTED":
    case "EXPIRED":
    case "STORAGE_UNAVAILABLE":
    case "VERIFICATION_UNAVAILABLE":
    case "EXPIRED_OR_REJECTED":
      return "cg19-badge cg19-badge-danger";
    default:
      return "cg19-badge cg19-badge-neutral";
  }
}

export function PrivateCaseEvidencePanel({
  canIssue = false,
  canRevoke = false,
}: {
  canIssue?: boolean;
  canRevoke?: boolean;
}) {
  const [cases, setCases] = useState<CG03CaseView[]>([]);
  const [selected, setSelected] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<CG19UploadStatus | CG19UploadStart | null>(null);
  const [media, setMedia] = useState<MediaRecord[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [revokeReview, setRevokeReview] = useState<MediaRecord | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaRecord | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [requestKey, setRequestKey] = useState("");
  const [uploadRef, setUploadRef] = useState("");
  const generation = useRef(0);
  const mediaGeneration = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    try {
      const result = await json<{ cases: CG03CaseView[] }>("/api/approvals/cases?limit=30");
      if (
        !Array.isArray(result.cases) ||
        result.cases.length > 30 ||
        result.cases.some(
          (c) =>
            typeof c.caseRef !== "string" ||
            typeof c.reference !== "string" ||
            !Number.isInteger(c.proposalRevision)
        )
      )
        throw Error("OFFLINE");
      if (gen === generation.current) {
        setCases(result.cases);
        setSelected((old) => (result.cases.some((c) => c.caseRef === old) ? old : ""));
      }
    } catch (e) {
      if (gen === generation.current) {
        setCases([]);
        setSelected("");
        setNotice({
          kind: "error",
          text: safeMessage(e),
        });
      }
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      ++generation.current;
    };
  }, [refresh]);

  const loadMedia = useCallback(async () => {
    const request = ++mediaGeneration.current;
    if (!selected) {
      setMedia([]);
      return;
    }
    setMediaLoading(true);
    try {
      const result = await json<{ files: MediaRecord[] }>(
        "/api/documents/files/case/" + encodeURIComponent(selected)
      );
      if (
        !Array.isArray(result.files) ||
        result.files.length > 30 ||
        result.files.some(
          (file) =>
            typeof file.fileRef !== "string" ||
            !Number.isSafeInteger(file.revision) ||
            typeof file.revoked !== "boolean"
        )
      )
        throw Error("OFFLINE");
      if (request === mediaGeneration.current) setMedia(result.files);
    } catch (e) {
      if (request === mediaGeneration.current) {
        setMedia([]);
        setNotice({ kind: "error", text: safeMessage(e) });
      }
    } finally {
      if (request === mediaGeneration.current) setMediaLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void loadMedia();
    return () => {
      ++mediaGeneration.current;
    };
  }, [loadMedia]);

  async function revokeMedia(item: MediaRecord) {
    if (busy || uncertain || item.revoked) return;
    if (revokeReview?.fileRef !== item.fileRef) {
      setRevokeReview(item);
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await json<{ revoked: boolean; revision: number }>(
        "/api/documents/files/" + encodeURIComponent(item.fileRef) + "/revoke",
        "POST",
        { expectedRevision: item.revision }
      );
      if (!result.revoked) throw Error("UNCERTAIN");
      setRevokeReview(null);
      setNotice({
        kind: "success",
        text: "The private file was revoked. Previous document history is retained.",
      });
      await loadMedia();
    } catch (e) {
      setNotice({ kind: "error", text: safeMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  function chooseFile(f: File | null) {
    if (busy || uncertain) return;
    setFile(f);
    setRequestKey("");
    setUploadRef("");
    setStatus(null);
    setNotice(null);
  }

  function chooseCase(caseRef: string) {
    if (busy || uncertain) return;
    setSelected(caseRef);
    setFile(null);
    setRequestKey("");
    setUploadRef("");
    setStatus(null);
    setNotice(null);
  }

  async function checkStatus() {
    if (!uploadRef || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const saved = await json<CG19UploadStatus>(
        "/api/documents/files/intents/" + encodeURIComponent(uploadRef)
      );
      if (typeof saved.status !== "string" || typeof saved.cleanVerified !== "boolean")
        throw Error("OFFLINE");
      setStatus(saved);
      setUncertain(false);
      setNotice({
        kind: saved.cleanVerified ? "success" : "info",
        text: saved.cleanVerified
          ? "This file passed the storage and malware checks. It remains private."
          : "Original upload found: " +
            label(saved.status) +
            ". A new attempt must not be assumed successful.",
      });
    } catch (e) {
      setUncertain(true);
      setNotice({ kind: "error", text: safeMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (busy || uncertain || !file || !selected) return;
    const caseItem = cases.find((c) => c.caseRef === selected);
    if (!caseItem) {
      setNotice({ kind: "error", text: "Choose an available application." });
      return;
    }
    if (!MIME.has(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      setNotice({ kind: "error", text: "Choose a PDF, JPG, PNG or WebP file under 10 MB." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    try {
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const created = await json<CG19UploadStart>("/api/documents/files/initiate", "POST", {
        caseRef: caseItem.caseRef,
        sourceRevision: caseItem.proposalRevision,
        requestKey: key,
        mime: file.type,
        sizeBytes: file.size,
        sha256: hash,
      });
      if (typeof created.uploadRef !== "string" || typeof created.status !== "string")
        throw Error("UNCERTAIN");
      setUploadRef(created.uploadRef);
      setStatus(created);
      if (created.status === "STORAGE_UNAVAILABLE" || !created.uploadUrl) {
        setNotice({
          kind: "info",
          text: "Private storage is not configured or available. No file was accepted.",
        });
        return;
      }
      const destination = new URL(created.uploadUrl);
      if (
        destination.protocol !== "https:" ||
        !created.uploadHeaders ||
        created.uploadHeaders["Content-Type"] !== file.type
      )
        throw Error("UNCERTAIN");
      let placed: Response;
      try {
        placed = await fetch(created.uploadUrl, {
          method: "PUT",
          headers: created.uploadHeaders,
          body: file,
          mode: "cors",
          cache: "no-store",
          credentials: "omit",
        });
      } catch {
        throw Error("UNCERTAIN");
      }
      if (!placed.ok) throw Error("UNCERTAIN");
      const confirmed = await json<CG19UploadStatus>(
        "/api/documents/files/intents/" + encodeURIComponent(created.uploadRef) + "/confirm",
        "POST"
      );
      if (typeof confirmed.cleanVerified !== "boolean") throw Error("UNCERTAIN");
      setStatus(confirmed);
      setNotice({
        kind: confirmed.cleanVerified ? "success" : "info",
        text: confirmed.cleanVerified
          ? "Your private evidence is verified and stored for this application."
          : "Upload complete, but the original verification remains unconfirmed. Check status.",
      });
      setUncertain(!confirmed.cleanVerified);
      await loadMedia();
    } catch (e) {
      setUncertain(true);
      setNotice({ kind: "error", text: safeMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    if (busy || uncertain) return;
    setFile(null);
    setRequestKey("");
    setUploadRef("");
    setStatus(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const selectedCase = cases.find((c) => c.caseRef === selected);
  const validated = status && "cleanVerified" in status && status.cleanVerified;

  // Dropdown options for authorized applications
  const caseDropdownOptions: DropdownOption[] = useMemo(() => {
    return [
      { value: "", label: "Choose an application..." },
      ...cases.map((c) => ({
        value: c.caseRef,
        label: `${c.reference} · ${c.accountName} (${c.status.replaceAll("_", " ")})`,
      })),
    ];
  }, [cases]);

  return (
    <div style={{ padding: "1.25rem 1.5rem", maxWidth: "1600px", margin: "0 auto" }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
        <span>Dashboard</span>
        <span>›</span>
        <span>Documents &amp; Media</span>
        <span>›</span>
        <span style={{ color: "#1e293b", fontWeight: 600 }}>Case Evidence &amp; Official Letters</span>
      </div>

      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 className="font-slab" style={{ fontSize: "1.65rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.25rem 0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>Private Case Documents</span>
            <span style={{ fontSize: "0.75rem", background: "#e0e7ff", color: "#4338ca", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: 600 }}>
              Encrypted Vault
            </span>
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>
            Protected application evidence, cryptographic verification, and official letterhead documents
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy || loading}
          style={{
            borderRadius: "8px",
            padding: "0.55rem 0.95rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#334155",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.85rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <RefreshCw size={13} strokeWidth={2} style={{ width: "13px", height: "13px" }} />
          <span>Refresh Applications</span>
        </button>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <div
        className="cg19-kpi-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.85rem",
          marginBottom: "1.5rem",
        }}
      >
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap" style={{ background: "#e0f2fe", color: "#0284c7" }}>
            <Files size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
          </div>
          <div>
            <h3 className="cg19-kpi-val font-slab">{loading ? "—" : cases.length}</h3>
            <p className="cg19-kpi-label">Available Cases</p>
            <span className="cg19-kpi-sub">Permitted by role</span>
          </div>
        </article>

        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
            <FolderArchive size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
          </div>
          <div>
            <h3 className="cg19-kpi-val font-slab">{selected ? media.length : "—"}</h3>
            <p className="cg19-kpi-label">Attached Media</p>
            <span className="cg19-kpi-sub">{selected ? "Selected application" : "Select a case"}</span>
          </div>
        </article>

        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap" style={{ background: "#ecfdf5", color: "#059669" }}>
            <ShieldCheck size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
          </div>
          <div>
            <h3 className="cg19-kpi-val font-slab" style={{ fontSize: "1.1rem" }}>
              {validated ? "Verified" : status ? "Pending" : "Ready"}
            </h3>
            <p className="cg19-kpi-label">File Verification</p>
            <span className="cg19-kpi-sub">Storage &amp; scan</span>
          </div>
        </article>

        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap" style={{ background: "#fef3c7", color: "#d97706" }}>
            <FileBadge size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
          </div>
          <div>
            <h3 className="cg19-kpi-val font-slab" style={{ fontSize: "1.1rem" }}>Letterhead</h3>
            <p className="cg19-kpi-label">Official Template</p>
            <span className="cg19-kpi-sub">A4 Seal &amp; PDF</span>
          </div>
        </article>

        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap" style={{ background: "#ffe4e6", color: "#e11d48" }}>
            <Lock size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
          </div>
          <div>
            <h3 className="cg19-kpi-val font-slab" style={{ fontSize: "1.1rem" }}>Restricted</h3>
            <p className="cg19-kpi-label">Private Sharing</p>
            <span className="cg19-kpi-sub">Non-public vault</span>
          </div>
        </article>

        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap" style={{ background: "#ecfeff", color: "#0891b2" }}>
            <HardDrive size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
          </div>
          <div>
            <h3 className="cg19-kpi-val font-slab" style={{ fontSize: "1.1rem" }}>SHA-256</h3>
            <p className="cg19-kpi-label">Integrity Guard</p>
            <span className="cg19-kpi-sub">Hash verified</span>
          </div>
        </article>
      </div>

      {/* Notice Alert Banner */}
      {notice && (
        <div
          role={notice.kind === "success" ? "status" : "alert"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.55rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            marginBottom: "1.25rem",
            fontSize: "0.85rem",
            fontWeight: 500,
            background: notice.kind === "success" ? "#ecfdf5" : notice.kind === "error" ? "#fef2f2" : "#f0fdfa",
            color: notice.kind === "success" ? "#065f46" : notice.kind === "error" ? "#991b1b" : "#115e59",
            border: `1px solid ${notice.kind === "success" ? "#a7f3d0" : notice.kind === "error" ? "#fecaca" : "#99f6e4"}`,
          }}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 size={16} strokeWidth={2} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          ) : notice.kind === "error" ? (
            <AlertCircle size={16} strokeWidth={2} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          ) : (
            <Info size={16} strokeWidth={2} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Main 2-Column Responsive Workspace Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: selected ? "minmax(0, 1.05fr) minmax(0, 1fr)" : "1fr",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Application Selector & Case Evidence Vault */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Card 1: Select Application */}
          <div
            className="cg19-filter-panel"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Layers size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#4f46e5" }} />
                <h3 className="font-slab" style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b", fontWeight: 700 }}>
                  Select Authorized Application
                </h3>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                {cases.length} case{cases.length === 1 ? "" : "s"} loaded
              </span>
            </div>

            <p style={{ margin: "0 0 0.85rem 0", color: "#64748b", fontSize: "0.825rem", lineHeight: 1.5 }}>
              Choose a real protected application to attach case evidence or view official confirmation letters.
            </p>

            <CustomDropdown
              options={caseDropdownOptions}
              value={selected}
              onChange={(val) => chooseCase(val)}
              disabled={loading || busy || uncertain}
              placeholder="Choose an authorized case..."
            />

            {selectedCase && (
              <div
                style={{
                  marginTop: "0.85rem",
                  padding: "0.75rem 0.85rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <strong>Application: </strong>
                  <span style={{ color: "#1e293b", fontWeight: 600 }}>{selectedCase.reference}</span>
                  <span style={{ margin: "0 0.4rem", color: "#cbd5e1" }}>•</span>
                  <span>Revision {selectedCase.proposalRevision}</span>
                </div>
                <span
                  style={{
                    background: "#e0e7ff",
                    color: "#4338ca",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                    fontSize: "0.725rem",
                    fontWeight: 600,
                  }}
                >
                  {selectedCase.status.replaceAll("_", " ")}
                </span>
              </div>
            )}
          </div>

          {/* Card 2: Attach Case Evidence */}
          <div
            className="cg19-filter-panel"
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "1.25rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileUp size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#4f46e5" }} />
                <h3 className="font-slab" style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b", fontWeight: 700 }}>
                  Attach Case Evidence
                </h3>
              </div>
              <span style={{ fontSize: "0.725rem", color: "#64748b", background: "#f1f5f9", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                Max 10 MB
              </span>
            </div>

            <p style={{ margin: "0 0 1rem 0", color: "#64748b", fontSize: "0.825rem", lineHeight: 1.5 }}>
              Only documents for a verified protected application may be attached. Files attached after final approval are archival only.
            </p>

            {/* Drag & Drop Styled File Dropzone */}
            <div
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "1.5rem 1rem",
                textAlign: "center",
                background: !selected ? "#f8fafc" : "#fafafa",
                cursor: !selected || busy || uncertain ? "not-allowed" : "pointer",
                transition: "border-color 0.15s ease",
                opacity: !selected ? 0.65 : 1,
              }}
              onClick={() => {
                if (selected && !busy && !uncertain && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                disabled={!selected || busy || uncertain}
                onChange={(e) => chooseFile(e.currentTarget.files?.[0] ?? null)}
                style={{ display: "none" }}
              />

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#eef2ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UploadCloud size={20} strokeWidth={2} style={{ width: "20px", height: "20px" }} />
                </div>
                <div>
                  <strong style={{ fontSize: "0.875rem", color: "#1e293b", display: "block" }}>
                    {!selected ? "Select an application first" : file ? "File Selected" : "Click to browse or drop document here"}
                  </strong>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Accepted formats: PDF, JPEG, PNG, or WebP (up to 10 MB)
                  </span>
                </div>
              </div>
            </div>

            {/* Selected File Card */}
            {file && (
              <div
                style={{
                  marginTop: "0.85rem",
                  padding: "0.65rem 0.85rem",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FileText size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#16a34a" }} />
                  <div>
                    <strong style={{ fontSize: "0.825rem", color: "#14532d", display: "block" }}>{file.name}</strong>
                    <span style={{ fontSize: "0.725rem", color: "#15803d" }}>{(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || "binary"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  disabled={busy || uncertain}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#dc2626",
                    cursor: "pointer",
                    padding: "0.2rem",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Remove selected file"
                >
                  <X size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
                </button>
              </div>
            )}

            {/* File Verification Status Feedback */}
            {status && (
              <div style={{ marginTop: "0.85rem", fontSize: "0.825rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ color: "#64748b" }}>Status:</span>
                <span className={statusBadgeClass(status.status)}>{label(status.status)}</span>
              </div>
            )}

            {validated && "fileRef" in status && status.fileRef && (
              <div style={{ marginTop: "0.6rem" }}>
                <a
                  href={"/api/documents/files/" + encodeURIComponent(status.fileRef) + "/download"}
                  style={{ color: "#4f46e5", fontWeight: 600, fontSize: "0.825rem", display: "inline-flex", alignItems: "center", gap: "0.3rem", textDecoration: "none" }}
                >
                  <Download size={13} strokeWidth={2} style={{ width: "13px", height: "13px" }} />
                  <span>Download verified private evidence</span>
                </a>
              </div>
            )}

            {/* Uncertain status banner */}
            {uncertain && (
              <div
                style={{
                  marginTop: "0.85rem",
                  padding: "0.85rem",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                  color: "#92400e",
                  fontSize: "0.825rem",
                }}
              >
                <strong style={{ display: "block", marginBottom: "0.2rem" }}>Previous write outcome uncertain</strong>
                <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.78rem" }}>
                  Do not upload again. Check the original request before any retry.
                </p>
                <button
                  type="button"
                  className="cg19-btn-reset"
                  onClick={() => void checkStatus()}
                  disabled={busy || !uploadRef}
                  style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}
                >
                  Check original upload status
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="cg19-btn-apply"
                disabled={!file || !selected || busy || uncertain}
                onClick={() => void submit()}
                style={{
                  padding: "0.55rem 1.15rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: !file || !selected || busy || uncertain ? "not-allowed" : "pointer",
                }}
              >
                <FileUp size={14} strokeWidth={2} style={{ width: "14px", height: "14px" }} />
                <span>{busy ? "Verifying…" : "Upload & Verify File"}</span>
              </button>

              <button
                type="button"
                className="cg19-btn-reset"
                disabled={busy || uncertain || !file}
                onClick={reset}
                style={{ padding: "0.55rem 0.95rem", fontSize: "0.85rem", fontWeight: 500 }}
              >
                Clear
              </button>

              {uploadRef && !uncertain && (
                <button
                  type="button"
                  className="cg19-btn-reset"
                  disabled={busy}
                  onClick={() => void checkStatus()}
                  style={{ padding: "0.55rem 0.95rem", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <RefreshCw size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                  <span>Refresh status</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 3: Verified Case Media Table (When Case Selected) */}
          {selected && (
            <div
              className="cg19-table-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "1.25rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <FolderArchive size={16} strokeWidth={2} style={{ width: "16px", height: "16px", color: "#4f46e5" }} />
                  <h3 className="font-slab" style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b", fontWeight: 700 }}>
                    Verified Case Media &amp; Files
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={busy || mediaLoading}
                  onClick={() => void loadMedia()}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#4f46e5",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <RefreshCw size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                  <span>Refresh Media</span>
                </button>
              </div>

              {mediaLoading ? (
                <p role="status" className="cg-module-loading" style={{ fontSize: "0.825rem", color: "#64748b", padding: "1rem 0" }}>
                  Verifying private case files…
                </p>
              ) : !media.length ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "2rem 1rem",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    color: "#64748b",
                    fontSize: "0.825rem",
                  }}
                >
                  <FileText size={24} strokeWidth={1.5} style={{ width: "24px", height: "24px", margin: "0 auto 0.5rem auto", color: "#cbd5e1" }} />
                  <strong>No verified media files</strong>
                  <p style={{ margin: "0.2rem 0 0 0", color: "#94a3b8", fontSize: "0.75rem" }}>
                    Upload supporting documents above to attach verified evidence.
                  </p>
                </div>
              ) : (
                <div className="role-table-wrap" style={{ overflowX: "auto" }}>
                  <table className="cg19-data-table" style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                        <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "#475569", fontWeight: 600 }}>Date</th>
                        <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "#475569", fontWeight: 600 }}>Type</th>
                        <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "#475569", fontWeight: 600 }}>Size</th>
                        <th style={{ textAlign: "left", padding: "0.6rem 0.75rem", color: "#475569", fontWeight: 600 }}>Status</th>
                        <th style={{ textAlign: "right", padding: "0.6rem 0.75rem", color: "#475569", fontWeight: 600 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {media.map((item) => (
                        <tr key={item.fileRef} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.65rem 0.75rem", color: "#334155" }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem" }}>
                            <code style={{ fontSize: "0.725rem", background: "#f1f5f9", padding: "0.15rem 0.35rem", borderRadius: "4px" }}>
                              {item.mime}
                            </code>
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", color: "#64748b" }}>
                            {(item.sizeBytes / 1024).toFixed(0)} KB
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem" }}>
                            <span className={item.revoked ? "cg19-badge cg19-badge-danger" : "cg19-badge cg19-badge-success"}>
                              {item.revoked ? "Revoked" : "Verified private"}
                            </span>
                          </td>
                          <td style={{ padding: "0.65rem 0.75rem", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
                              {!item.revoked && item.mime.startsWith("image/") && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMedia(item)}
                                  className="cg19-btn-reset"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                                >
                                  <Eye size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                  <span>Preview</span>
                                </button>
                              )}
                              {!item.revoked && (
                                <a
                                  href={"/api/documents/files/" + encodeURIComponent(item.fileRef) + "/download"}
                                  className="cg19-btn-reset"
                                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem", textDecoration: "none", color: "#4f46e5" }}
                                >
                                  <Download size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                  <span>Download</span>
                                </a>
                              )}
                              {!item.revoked && (
                                <button
                                  type="button"
                                  disabled={busy || uncertain}
                                  onClick={() => void revokeMedia(item)}
                                  className="cg19-btn-reset"
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    fontSize: "0.75rem",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    color: "#dc2626",
                                    borderColor: "#fecaca",
                                    background: "#fef2f2",
                                  }}
                                >
                                  <Trash2 size={12} strokeWidth={2} style={{ width: "12px", height: "12px" }} />
                                  <span>{revokeReview?.fileRef === item.fileRef ? "Confirm revoke" : "Revoke"}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Revoke confirmation banner */}
              {revokeReview && (
                <div
                  role="alert"
                  style={{
                    marginTop: "1rem",
                    padding: "0.85rem",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    color: "#991b1b",
                    fontSize: "0.825rem",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "0.2rem" }}>Confirm Permanent Revocation</strong>
                  <p style={{ margin: "0 0 0.65rem 0", fontSize: "0.78rem" }}>
                    Revoking permanently blocks further authorized downloads of this evidence file. Audit trail and case history remain immutable.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="cg19-btn-apply"
                      disabled={busy || uncertain}
                      onClick={() => void revokeMedia(revokeReview)}
                      style={{ background: "#dc2626", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                    >
                      Confirm Permanent Revoke
                    </button>
                    <button
                      type="button"
                      className="cg19-btn-reset"
                      disabled={busy}
                      onClick={() => setRevokeReview(null)}
                      style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Official Foundation Letterhead (B38 Parity) */}
        <div>
          {selectedCase ? (
            <PrivateLetterPanel
              key={selectedCase.caseRef}
              caseRef={selectedCase.caseRef}
              sourceRevision={selectedCase.proposalRevision}
              canIssue={canIssue}
              canRevoke={canRevoke}
            />
          ) : (
            <div
              className="cg19-table-card"
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "2.5rem 1.5rem",
                textAlign: "center",
                color: "#64748b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}
            >
              <FileBadge size={36} strokeWidth={1.5} style={{ width: "36px", height: "36px", margin: "0 auto 0.75rem auto", color: "#cbd5e1" }} />
              <h3 className="font-slab" style={{ margin: "0 0 0.35rem 0", fontSize: "1.15rem", color: "#1e293b" }}>
                Official Access Letters &amp; Letterhead
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8", maxWidth: "340px", marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                Choose an authorized application from the left panel to preview its official letterhead and manage verified confirmation documents.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewMedia && (
        <div
          className="cg19-preview-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="cg19-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Private evidence preview"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "680px", borderRadius: "12px", overflow: "hidden" }}
          >
            <div
              className="cg19-preview-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #e2e8f0",
                background: "#ffffff",
              }}
            >
              <div>
                <strong style={{ fontSize: "0.95rem", color: "#0f172a", display: "block" }}>
                  Private Evidence Preview
                </strong>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{previewMedia.mime}</span>
              </div>
              <button
                type="button"
                className="cg19-btn-reset"
                onClick={() => setPreviewMedia(null)}
                style={{ padding: "0.3rem 0.55rem" }}
              >
                <X size={15} strokeWidth={2} style={{ width: "15px", height: "15px" }} />
              </button>
            </div>

            <div
              className="cg19-preview-body"
              style={{ padding: "1.25rem", background: "#f8fafc", textAlign: "center", maxHeight: "65vh", overflowY: "auto" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={"/api/documents/files/" + encodeURIComponent(previewMedia.fileRef) + "/download"}
                alt="Private Case Evidence Preview"
                style={{ maxWidth: "100%", maxHeight: "55vh", objectFit: "contain", borderRadius: "6px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
              />
            </div>

            <div
              style={{
                padding: "0.85rem 1.25rem",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <a
                href={"/api/documents/files/" + encodeURIComponent(previewMedia.fileRef) + "/download"}
                className="cg19-btn-apply"
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Download size={13} strokeWidth={2} style={{ width: "13px", height: "13px" }} />
                <span>Download Full Resolution</span>
              </a>
              <button
                type="button"
                className="cg19-btn-reset"
                onClick={() => setPreviewMedia(null)}
                style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
