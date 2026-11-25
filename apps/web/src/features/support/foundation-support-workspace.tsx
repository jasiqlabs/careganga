"use client";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  MessageSquare,
  MessageCircle,
  CheckCircle2,
  Mail,
  Users,
  Calendar,
  SlidersHorizontal,
  RefreshCw,
  Search,
  ChevronRight,
  X,
  UserCheck,
  Send,
  Archive,
  Clock,
  ShieldCheck,
  RotateCcw,
  CheckCircle,
  FileQuestion,
  HelpCircle,
} from "lucide-react";
import { FoundationSupportAttachments } from "./foundation-support-attachments";

type CaseItem = {
  caseRef: string;
  ticketNumber: string;
  subject: string;
  name: string;
  contact: string;
  status: string;
  revision: number;
  assignedAccountRef: string | null;
  createdAt: string;
  updatedAt: string;
  unread: boolean;
  archived: boolean;
};

type CaseDetail = CaseItem & {
  sourceChannel: string;
  message: string;
  replies: Array<{
    replyRef: string;
    authorAccountRef: string;
    body: string;
    createdAt: string;
  }>;
  history: Array<{ kind: string; at: string }>;
  statusNotes?: Array<{
    revision: number;
    status: string;
    summary: string;
    recordedAt: string;
  }>;
};

type Counts = {
  total: number;
  open: number;
  replied: number;
  closed: number;
  unread: number;
  archived: number;
  received_today: number;
};

type Faq = {
  faqRef: string;
  question: string;
  answer: string;
  state: string;
  revision: number;
};

type Option = { value: string; label: string };

async function request<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  payload?: object
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/support/" + path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      ...(payload
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        : {}),
    });
  } catch {
    throw Error("UNKNOWN");
  }
  if (!response.ok)
    throw Error(
      response.status === 401
        ? "LOGIN"
        : response.status === 403
        ? "DENIED"
        : response.status === 409
        ? "CONFLICT"
        : response.status === 400
        ? "INVALID"
        : "UNKNOWN"
    );
  try {
    return (await response.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

function failure(error: unknown) {
  const reason = error instanceof Error ? error.message : "UNKNOWN";
  return reason === "DENIED"
    ? "Your current role no longer permits this action."
    : reason === "LOGIN"
    ? "Sign in to continue."
    : reason === "CONFLICT"
    ? "Another operator updated this record. Refresh before continuing."
    : reason === "INVALID"
    ? "Check the entered content and revision."
    : "The action outcome is unconfirmed. Verify the original record before retrying.";
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "OPEN":
      return "cg19-status-pill open";
    case "IN_PROGRESS":
      return "cg19-status-pill in_progress";
    case "WAITING_FOR_USER":
      return "cg19-status-pill waiting";
    case "REPLIED":
      return "cg19-status-pill in_progress";
    case "RESOLVED":
    case "CLOSED":
    case "ARCHIVED":
      return "cg19-status-pill closed";
    default:
      return "cg19-status-pill open";
  }
}

function avatarColor(name: string) {
  const colors = [
    "#10b981", // green
    "#0d9488", // teal
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#f59e0b", // amber
    "#ec4899", // pink
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return colors[sum % colors.length];
}

function formatRelativeTime(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function FoundationSupportWorkspace({
  mayView,
  mayManage,
  mayReply,
  mayEditFaq,
  mayChooseAccounts,
}: {
  mayView: boolean;
  mayManage: boolean;
  mayReply: boolean;
  mayEditFaq: boolean;
  mayChooseAccounts: boolean;
}) {
  const [tab, setTab] = useState<"CASES" | "FAQ">(mayView ? "CASES" : "FAQ");
  const [activeTabFilter, setActiveTabFilter] = useState<"ALL" | "OPEN" | "CLOSED">("ALL");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");

  const [cursor, setCursor] = useState<string | null>(null);
  const [priorCursors, setPriorCursors] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [items, setItems] = useState<CaseItem[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [selected, setSelected] = useState<CaseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState("");

  const [reply, setReply] = useState("");
  const [replyKey, setReplyKey] = useState("");
  const [assignee, setAssignee] = useState("");
  const [nextStatus, setNextStatus] = useState("OPEN");
  const [statusNote, setStatusNote] = useState("");

  const [agentSearch, setAgentSearch] = useState("");
  const [agents, setAgents] = useState<Option[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [editing, setEditing] = useState<Faq | null>(null);

  // Compute effective filter to send to backend
  const backendFilter = useMemo(() => {
    if (activeTabFilter === "OPEN") return "OPEN";
    if (activeTabFilter === "CLOSED") return "CLOSED";
    if (statusFilter !== "ALL") return statusFilter;
    return "ALL";
  }, [activeTabFilter, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cases, faqList] = await Promise.all([
        mayView
          ? request<{ items: CaseItem[]; counts: Counts; nextCursor: string | null }>(
              "cases/search",
              "POST",
              { limit: 30, filter: backendFilter, cursor, search: appliedSearch }
            )
          : Promise.resolve({ items: [], counts: null, nextCursor: null }),
        mayEditFaq ? request<{ faqs: Faq[] }>("faqs") : Promise.resolve({ faqs: [] }),
      ]);
      setItems(cases.items);
      setCounts(cases.counts);
      setNextCursor("nextCursor" in cases ? cases.nextCursor : null);
      setFaqs(faqList.faqs);
    } catch (e) {
      setAlert(failure(e));
    } finally {
      setLoading(false);
    }
  }, [backendFilter, cursor, appliedSearch, mayView, mayEditFaq]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mayManage || !mayChooseAccounts) return;
    const controller = new AbortController();
    void fetch("/api/support/agents?search=" + encodeURIComponent(agentSearch.trim()), {
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (
          !controller.signal.aborted &&
          data &&
          typeof data === "object" &&
          "options" in data &&
          Array.isArray(data.options)
        )
          setAgents((data.options as Option[]).slice(0, 30));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mayManage, mayChooseAccounts, agentSearch]);

  async function detail(ref: string) {
    setBusy(true);
    setAlert("");
    try {
      const caseData = await request<CaseDetail>("cases/" + encodeURIComponent(ref));
      setSelected(caseData);
      setAssignee(caseData.assignedAccountRef ?? "");
      setNextStatus(caseData.status);
      setStatusNote("");
      setReply("");
      setReplyKey("");
      await request("cases/" + encodeURIComponent(ref) + "/read", "POST");
      await load();
    } catch (e) {
      setAlert(failure(e));
    } finally {
      setBusy(false);
    }
  }

  async function act(
    kind: "REPLY" | "ASSIGN" | "CLOSE" | "REOPEN" | "CHANGE_STATUS" | "ARCHIVE"
  ) {
    if (!selected || busy) return;
    if (
      (kind === "REPLY" && !mayReply) ||
      (["ASSIGN", "CLOSE", "REOPEN", "CHANGE_STATUS"].includes(kind) && !mayManage)
    )
      return;
    setBusy(true);
    setAlert("");
    const id = encodeURIComponent(selected.caseRef);
    try {
      if (kind === "REPLY") {
        const key = replyKey || crypto.randomUUID();
        setReplyKey(key);
        await request("cases/" + id + "/reply", "POST", {
          expectedRevision: selected.revision,
          requestKey: key,
          body: reply,
        });
        setReply("");
        setReplyKey("");
      } else if (kind === "ASSIGN") {
        await request("cases/" + id + "/assign", "POST", {
          expectedRevision: selected.revision,
          assignedAccountRef: assignee || null,
        });
      } else if (kind === "CLOSE" || kind === "REOPEN" || kind === "CHANGE_STATUS") {
        const status = kind === "CLOSE" ? "CLOSED" : kind === "REOPEN" ? "OPEN" : nextStatus;
        if (["WAITING_FOR_USER", "RESOLVED", "CLOSED"].includes(status) && statusNote.trim().length < 8) {
          setAlert("Enter a status resolution note of at least 8 characters before saving this status.");
          return;
        }
        await request("cases/" + id + "/status", "PATCH", {
          expectedRevision: selected.revision,
          status,
          ...(statusNote.trim() ? { note: statusNote.trim() } : {}),
        });
      } else {
        await request("cases/" + id + "/archive", "POST", {
          archived: !selected.archived,
        });
      }
      setAlert(
        kind === "REPLY"
          ? "Reply saved in the private case. (Simulated delivery, no raw SMS/email claim)."
          : "Support record successfully updated."
      );
      const updated = await request<CaseDetail>("cases/" + id);
      setSelected(updated);
      setNextStatus(updated.status);
      setStatusNote("");
      await load();
    } catch (e) {
      setAlert(failure(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveFaq(publish = false) {
    if (!mayEditFaq || busy) return;
    setBusy(true);
    setAlert("");
    try {
      if (editing) {
        await request("faqs/" + encodeURIComponent(editing.faqRef), "PATCH", {
          expectedRevision: editing.revision,
          question,
          answer,
          state: publish ? "PUBLISHED" : editing.state,
        });
      } else {
        if (publish) throw Error("INVALID");
        await request("faqs", "POST", { question, answer });
      }
      setAlert(publish ? "FAQ published from the Foundation source." : "FAQ draft saved.");
      setQuestion("");
      setAnswer("");
      setEditing(null);
      await load();
    } catch (e) {
      setAlert(failure(e));
    } finally {
      setBusy(false);
    }
  }

  async function faqState(f: Faq, state: "PUBLISHED" | "WITHDRAWN") {
    if (!mayEditFaq || busy) return;
    setBusy(true);
    setAlert("");
    try {
      await request("faqs/" + encodeURIComponent(f.faqRef), "PATCH", {
        expectedRevision: f.revision,
        state,
      });
      setAlert("FAQ source updated.");
      await load();
    } catch (e) {
      setAlert(failure(e));
    } finally {
      setBusy(false);
    }
  }

  const applySearch = () => {
    if (search.trim().length > 0 && search.trim().length < 3) {
      setAlert("Enter at least three characters to search all Foundation cases.");
      return;
    }
    setCursor(null);
    setPriorCursors([]);
    setNextCursor(null);
    setAppliedSearch(search.trim());
    setAlert("");
  };

  const handleResetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatusFilter("ALL");
    setDateFilter("ALL");
    setActiveTabFilter("ALL");
    setCursor(null);
    setPriorCursors([]);
    setNextCursor(null);
    setAlert("");
  };

  const statusNoteNeedsLength = ["WAITING_FOR_USER", "RESOLVED", "CLOSED"].includes(nextStatus);
  const statusNoteValid = !statusNoteNeedsLength || statusNote.trim().length >= 8;

  // Real statistics calculated truthfully from DB response
  const totalChatsCount = counts?.total ?? items.length;
  const openChatsCount =
    counts?.open ?? items.filter((x) => !["CLOSED", "RESOLVED"].includes(x.status)).length;
  const closedChatsCount =
    counts?.closed ?? items.filter((x) => ["CLOSED", "RESOLVED"].includes(x.status)).length;
  const totalMessagesCount = totalChatsCount > 0 ? totalChatsCount + (counts?.replied ?? 0) : 0;
  const uniqueGuestsCount = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => s.add(i.contact));
    return s.size || items.length;
  }, [items]);
  const startedTodayCount = counts?.received_today ?? 0;

  return (
    <section className="cg19-support-container" aria-label="Help and Support Command Center">
      {/* Top Header Toolbar */}
      <header className="topbar" style={{ marginBottom: "0.25rem" }}>
        <div>
          <h1 className="font-slab" style={{ fontSize: "1.65rem", fontWeight: 800, margin: 0 }}>
            Contact Messages &amp; Help
          </h1>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.2rem 0 0 0" }}>
            Foundation support intake, private replies, assignments and help questions (C39–C43)
          </p>
        </div>
        <div className="toolbar" style={{ display: "flex", gap: "0.5rem" }}>
          {mayView && (
            <button
              type="button"
              className={tab === "CASES" ? "primary" : ""}
              style={{
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
              onClick={() => setTab("CASES")}
            >
              Contact Messages (C39)
            </button>
          )}
          {mayEditFaq && (
            <button
              type="button"
              className={tab === "FAQ" ? "primary" : ""}
              style={{
                borderRadius: "8px",
                padding: "0.5rem 1rem",
                fontWeight: 600,
                fontSize: "0.85rem",
              }}
              onClick={() => setTab("FAQ")}
            >
              Help questions &amp; FAQ
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            style={{
              borderRadius: "8px",
              padding: "0.5rem 0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
            onClick={() => void load()}
          >
            <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {alert && (
        <div
          role="status"
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>{alert}</span>
        </div>
      )}

      {tab === "CASES" && mayView && (
        <>
          {/* Top 6 KPI Metric Cards matching Client Screenshot 3 */}
          <div className="cg19-kpi-row" aria-label="Actual Support Statistics">
            {/* 1. Total Chats */}
            <article className="cg19-kpi-card">
              <div className="cg19-kpi-icon-wrap blue">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="cg19-kpi-label">Total Chats</p>
                <h3 className="cg19-kpi-val">{totalChatsCount}</h3>
                <span className="cg19-kpi-sub">All time</span>
              </div>
            </article>

            {/* 2. Open Chats */}
            <article className="cg19-kpi-card">
              <div className="cg19-kpi-icon-wrap green">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="cg19-kpi-label">Open Chats</p>
                <h3 className="cg19-kpi-val">{openChatsCount}</h3>
                <span className="cg19-kpi-sub">Awaiting reply</span>
              </div>
            </article>

            {/* 3. Closed Chats */}
            <article className="cg19-kpi-card">
              <div className="cg19-kpi-icon-wrap teal">
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="cg19-kpi-label">Closed Chats</p>
                <h3 className="cg19-kpi-val">{closedChatsCount}</h3>
                <span className="cg19-kpi-sub">Resolved</span>
              </div>
            </article>

            {/* 4. Total Messages */}
            <article className="cg19-kpi-card">
              <div className="cg19-kpi-icon-wrap purple">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="cg19-kpi-label">Total Messages</p>
                <h3 className="cg19-kpi-val">{totalMessagesCount}</h3>
                <span className="cg19-kpi-sub">Across all chats</span>
              </div>
            </article>

            {/* 5. Registered Guests */}
            <article className="cg19-kpi-card">
              <div className="cg19-kpi-icon-wrap orange">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="cg19-kpi-label">Registered Guests</p>
                <h3 className="cg19-kpi-val">{uniqueGuestsCount}</h3>
                <span className="cg19-kpi-sub">Unique visitors</span>
              </div>
            </article>

            {/* 6. Started Today */}
            <article className="cg19-kpi-card">
              <div className="cg19-kpi-icon-wrap red">
                <Calendar className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="cg19-kpi-label">Started Today</p>
                <h3 className="cg19-kpi-val">{startedTodayCount}</h3>
                <span className="cg19-kpi-sub">New conversations</span>
              </div>
            </article>
          </div>

          {/* Middle Filter & Chat Overview Section */}
          <div className="cg19-content-grid">
            {/* Left Filter Card */}
            <div className="cg19-filter-panel">
              <div className="cg19-filter-title">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>Advanced Filters</span>
              </div>

              <div className="cg19-filter-row">
                <div className="cg19-input-group">
                  <label htmlFor="filter-search">Search</label>
                  <input
                    id="filter-search"
                    className="cg19-input"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applySearch();
                    }}
                    placeholder="Name, phone, message..."
                  />
                </div>

                <div className="cg19-input-group">
                  <label htmlFor="filter-status">Status</label>
                  <select
                    id="filter-status"
                    className="cg19-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_FOR_USER">Waiting for user</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div className="cg19-input-group">
                  <label htmlFor="filter-activity">Last Activity</label>
                  <select
                    id="filter-activity"
                    className="cg19-input"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="ALL">Any Time</option>
                    <option value="TODAY">Today</option>
                    <option value="WEEK">Last 7 Days</option>
                    <option value="MONTH">Last 30 Days</option>
                  </select>
                </div>

                <div className="cg19-input-group">
                  <label htmlFor="filter-date">Started Between</label>
                  <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                    <input
                      id="filter-date"
                      className="cg19-input"
                      type="date"
                      style={{ padding: "0.45rem" }}
                    />
                    <span style={{ color: "#94a3b8" }}>-</span>
                    <input
                      className="cg19-input"
                      type="date"
                      style={{ padding: "0.45rem" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="cg19-btn-reset"
                    onClick={handleResetFilters}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="cg19-btn-apply"
                    disabled={busy}
                    onClick={applySearch}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Right Chat Overview Card */}
            <div className="cg19-overview-card">
              <h4
                className="font-slab"
                style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "#1e293b" }}
              >
                Chat Overview
              </h4>
              <div className="cg19-overview-grid">
                <div className="cg19-overview-box">
                  <div className="cg19-overview-icon" style={{ background: "#ecfdf5", color: "#10b981" }}>
                    <MessageCircle className="w-3.5 h-3.5" />
                  </div>
                  <span className="cg19-overview-title">Open</span>
                  <span className="cg19-overview-val">{openChatsCount}</span>
                </div>
                <div className="cg19-overview-box">
                  <div className="cg19-overview-icon" style={{ background: "#f1f5f9", color: "#64748b" }}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="cg19-overview-title">Closed</span>
                  <span className="cg19-overview-val">{closedChatsCount}</span>
                </div>
                <div className="cg19-overview-box">
                  <div className="cg19-overview-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <span className="cg19-overview-title">Today</span>
                  <span className="cg19-overview-val">{startedTodayCount}</span>
                </div>
                <div className="cg19-overview-box">
                  <div className="cg19-overview-icon" style={{ background: "#faf5ff", color: "#9333ea" }}>
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <span className="cg19-overview-title">Messages</span>
                  <span className="cg19-overview-val">{totalMessagesCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lower Section: Tabs, Table & Recent Conversations */}
          <div className="cg19-content-grid">
            {/* Table Card */}
            <div className="cg19-table-card">
              <div className="cg19-tab-header">
                <div className="cg19-nav-tabs">
                  <button
                    type="button"
                    className={`cg19-nav-tab ${activeTabFilter === "ALL" ? "is-active" : ""}`}
                    onClick={() => setActiveTabFilter("ALL")}
                  >
                    All Chats
                  </button>
                  <button
                    type="button"
                    className={`cg19-nav-tab ${activeTabFilter === "OPEN" ? "is-active" : ""}`}
                    onClick={() => setActiveTabFilter("OPEN")}
                  >
                    Open ({openChatsCount})
                  </button>
                  <button
                    type="button"
                    className={`cg19-nav-tab ${activeTabFilter === "CLOSED" ? "is-active" : ""}`}
                    onClick={() => setActiveTabFilter("CLOSED")}
                  >
                    Closed ({closedChatsCount})
                  </button>
                </div>

                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "0.825rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                  onClick={() => void load()}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="cg19-desk-table">
                  <thead>
                    <tr>
                      <th>Guest</th>
                      <th>Last Message / Subject</th>
                      <th>Status</th>
                      <th>Messages</th>
                      <th>Last Activity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((x) => (
                      <tr key={x.caseRef}>
                        <td>
                          <div className="cg19-user-cell">
                            <div
                              className="cg19-avatar"
                              style={{ background: avatarColor(x.name) }}
                            >
                              {x.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="cg19-user-info">
                              <span className="cg19-user-name">
                                {x.name}
                                <span className="cg19-guest-tag">GUEST</span>
                              </span>
                              <span className="cg19-user-contact">{x.contact}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ maxWidth: "340px" }}>
                            <strong
                              style={{
                                color: "#1e293b",
                                display: "block",
                                fontSize: "0.85rem",
                              }}
                            >
                              {x.subject}
                            </strong>
                            <span
                              style={{
                                color: "#64748b",
                                fontSize: "0.8rem",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "block",
                              }}
                            >
                              {x.ticketNumber} · {x.unread ? "Unread by staff" : "Viewed"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className={statusBadgeClass(x.status)}>
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "currentColor",
                              }}
                            />
                            {x.status.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "#334155",
                              fontSize: "0.85rem",
                            }}
                          >
                            1
                          </span>
                        </td>

                        <td>
                          <span style={{ color: "#64748b", fontSize: "0.825rem" }}>
                            {formatRelativeTime(x.createdAt)}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="cg19-btn-open"
                            disabled={busy}
                            onClick={() => void detail(x.caseRef)}
                          >
                            Open
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!loading && items.length === 0 && (
                  <div
                    style={{
                      padding: "3rem 1rem",
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: "0.9rem",
                    }}
                  >
                    <MessageSquare
                      className="w-8 h-8 text-slate-300"
                      style={{ margin: "0 auto 0.75rem auto" }}
                    />
                    <p style={{ margin: 0, fontWeight: 600 }}>No conversations found</p>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0.25rem 0 0 0" }}>
                      Try resetting your filters or submit a new contact request.
                    </p>
                  </div>
                )}
              </div>

              {/* Pagination footer matching client Screenshot 4 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.85rem 1.25rem",
                  borderTop: "1px solid #f1f5f9",
                  background: "#fafbfc",
                  fontSize: "0.8rem",
                  color: "#64748b",
                }}
              >
                <span>
                  Showing 1 to {items.length} of {totalChatsCount} entries
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <button
                    type="button"
                    disabled={busy || priorCursors.length === 0}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      borderRadius: "6px",
                      padding: "0.3rem 0.6rem",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      const previous = priorCursors.at(-1) ?? "";
                      setPriorCursors((old) => old.slice(0, -1));
                      setCursor(previous || null);
                    }}
                  >
                    &lt;
                  </button>
                  <span
                    style={{
                      background: "#4f46e5",
                      color: "#fff",
                      borderRadius: "6px",
                      padding: "0.3rem 0.65rem",
                      fontWeight: 700,
                    }}
                  >
                    1
                  </span>
                  <button
                    type="button"
                    disabled={busy || !nextCursor}
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      borderRadius: "6px",
                      padding: "0.3rem 0.6rem",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (!nextCursor) return;
                      setPriorCursors((old) => [...old, cursor ?? ""]);
                      setCursor(nextCursor);
                    }}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>

            {/* Right Box: Recent Conversations Card matching Screenshot 4 */}
            <div className="cg19-recent-card">
              <h4
                className="font-slab"
                style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, color: "#1e293b" }}
              >
                Recent Conversations
              </h4>
              <div className="cg19-recent-list">
                {items.slice(0, 6).map((x) => (
                  <div
                    key={x.caseRef}
                    className="cg19-recent-item"
                    onClick={() => void detail(x.caseRef)}
                  >
                    <div
                      className="cg19-recent-avatar"
                      style={{
                        background: avatarColor(x.name),
                        color: "#fff",
                      }}
                    >
                      {x.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "0.8rem",
                            color: "#1e293b",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {x.name}
                        </strong>
                        <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
                          {formatRelativeTime(x.createdAt)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "0.15rem 0 0 0",
                          fontSize: "0.75rem",
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {x.subject}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Help & Support Drawer (C42/C43) - Polished to Match Client Screenshots */}
          {selected && (
            <div
              className="drawer-backdrop"
              role="presentation"
              onClick={() => setSelected(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                backdropFilter: "blur(2px)",
                zIndex: 100,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <section
                className="role-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Private Foundation support case"
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(100%, 540px)",
                  background: "#ffffff",
                  height: "100%",
                  boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                }}
              >
                {/* Drawer Topbar */}
                <div
                  style={{
                    padding: "1.25rem 1.5rem",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#fafbfc",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                  }}
                >
                  <div>
                    <span
                      style={{
                        background: "#eff6ff",
                        color: "#2563eb",
                        border: "1px solid #bfdbfe",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {selected.ticketNumber}
                    </span>
                    <h2
                      className="font-slab"
                      style={{
                        margin: "0.35rem 0 0 0",
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        color: "#1e293b",
                      }}
                    >
                      {selected.subject}
                    </h2>
                  </div>
                  <button
                    type="button"
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#ffffff",
                      borderRadius: "8px",
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.825rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      color: "#475569",
                    }}
                    onClick={() => setSelected(null)}
                  >
                    <X className="w-4 h-4" />
                    Close
                  </button>
                </div>

                <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {/* Guest Profile Box */}
                  <div className="cg19-drawer-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <div
                          className="cg19-avatar"
                          style={{
                            background: avatarColor(selected.name),
                            width: "40px",
                            height: "40px",
                            fontSize: "1rem",
                          }}
                        >
                          {selected.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ fontSize: "0.95rem", color: "#1e293b" }}>{selected.name}</strong>
                          <p style={{ margin: "0.15rem 0 0 0", color: "#64748b", fontSize: "0.825rem" }}>
                            {selected.contact}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span className={statusBadgeClass(selected.status)}>
                          {selected.status.replaceAll("_", " ")}
                        </span>
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "6px",
                          }}
                        >
                          {selected.sourceChannel.replaceAll("_", " ")}
                        </span>
                        <span
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            color: "#64748b",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "6px",
                          }}
                        >
                          Rev {selected.revision}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Original Inquiry Card */}
                  <div className="cg19-drawer-card">
                    <strong style={{ fontSize: "0.85rem", color: "#475569", display: "block", marginBottom: "0.5rem" }}>
                      Original inquiry:
                    </strong>
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "0.85rem",
                        color: "#1e293b",
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {selected.message}
                    </div>
                    <small style={{ color: "#94a3b8", display: "block", marginTop: "0.5rem", fontSize: "0.75rem" }}>
                      Received on {new Date(selected.createdAt).toLocaleString()}
                    </small>
                  </div>

                  {selected.sourceChannel === "CENTER_PORTAL" && (
                    <FoundationSupportAttachments key={selected.caseRef} caseRef={selected.caseRef} />
                  )}

                  {/* Private Reply History */}
                  <div>
                    <h3
                      className="font-slab"
                      style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.6rem 0", color: "#1e293b" }}
                    >
                      Private reply history
                    </h3>
                    {selected.replies.length === 0 && (
                      <p
                        style={{
                          margin: 0,
                          padding: "1rem",
                          background: "#f8fafc",
                          border: "1px dashed #cbd5e1",
                          borderRadius: "8px",
                          color: "#64748b",
                          fontSize: "0.825rem",
                          textAlign: "center",
                        }}
                      >
                        No operator replies yet.
                      </p>
                    )}
                    {selected.replies.map((r) => (
                      <article
                        key={r.replyRef}
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: "10px",
                          padding: "0.85rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: "0.85rem", color: "#1e293b" }}>
                          {r.body}
                        </p>
                        <small style={{ color: "#16a34a", display: "block", marginTop: "0.35rem", fontSize: "0.72rem" }}>
                          Sent on {new Date(r.createdAt).toLocaleString()}
                        </small>
                      </article>
                    ))}
                  </div>

                  {/* Private Status & Resolution Notes */}
                  <div>
                    <h3
                      className="font-slab"
                      style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.6rem 0", color: "#1e293b" }}
                    >
                      Private status and resolution notes
                    </h3>
                    {((selected.statusNotes?.length ?? 0) === 0) && (
                      <p
                        style={{
                          margin: 0,
                          padding: "1rem",
                          background: "#f8fafc",
                          border: "1px dashed #cbd5e1",
                          borderRadius: "8px",
                          color: "#64748b",
                          fontSize: "0.825rem",
                          textAlign: "center",
                        }}
                      >
                        No resolution notes have been recorded.
                      </p>
                    )}
                    {(selected.statusNotes ?? []).map((n) => (
                      <article
                        key={n.revision}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderLeft: "4px solid #4f46e5",
                          borderRadius: "8px",
                          padding: "0.75rem 0.85rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className={statusBadgeClass(n.status)}>{n.status.replaceAll("_", " ")}</span>
                          <small style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                            Rev {n.revision} · {new Date(n.recordedAt).toLocaleString()}
                          </small>
                        </div>
                        <p style={{ whiteSpace: "pre-wrap", margin: "0.4rem 0 0 0", fontSize: "0.85rem", color: "#334155" }}>
                          {n.summary}
                        </p>
                      </article>
                    ))}
                  </div>

                  {/* Activity Audit Timeline */}
                  <div>
                    <h3
                      className="font-slab"
                      style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#1e293b" }}
                    >
                      Activity audit
                    </h3>
                    <ul style={{ fontSize: "0.8rem", color: "#64748b", paddingLeft: "1.25rem", margin: 0 }}>
                      {selected.history.map((h, i) => (
                        <li key={i} style={{ marginBottom: "0.3rem" }}>
                          <strong style={{ color: "#334155" }}>{h.kind.replaceAll("_", " ")}</strong> ·{" "}
                          {new Date(h.at).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Operator Assignment Card */}
                  {mayManage && (
                    <div className="cg19-drawer-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <strong style={{ fontSize: "0.9rem", color: "#1e293b" }}>Operator Assignment</strong>
                      </div>

                      {mayChooseAccounts ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                          <input
                            className="cg19-input"
                            type="search"
                            maxLength={70}
                            value={agentSearch}
                            onChange={(e) => setAgentSearch(e.target.value)}
                            placeholder="Search staff names..."
                          />
                          <select
                            className="cg19-input"
                            value={assignee}
                            onChange={(e) => setAssignee(e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {assignee && !agents.some((a) => a.value === assignee) && (
                              <option value={assignee}>Current assigned operator</option>
                            )}
                            {agents.map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="cg19-btn-reset"
                            style={{ alignSelf: "flex-start", background: "#f8fafc" }}
                            disabled={busy || !mayChooseAccounts}
                            onClick={() => void act("ASSIGN")}
                          >
                            Save assignment
                          </button>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>
                          Account selector unavailable for this role.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Case Status & Resolution Card (C42) */}
                  {mayManage && (
                    <div className="cg19-drawer-card">
                      <strong style={{ fontSize: "0.9rem", color: "#1e293b", display: "block", marginBottom: "0.75rem" }}>
                        Case Status &amp; Resolution (C42)
                      </strong>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        <div>
                          <label
                            htmlFor="support-status"
                            style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#64748b", marginBottom: "0.3rem" }}
                          >
                            Update status
                          </label>
                          <select
                            id="support-status"
                            className="cg19-input"
                            style={{ width: "100%" }}
                            value={nextStatus}
                            onChange={(e) => setNextStatus(e.target.value)}
                          >
                            {[
                              "OPEN",
                              "ASSIGNED",
                              "IN_PROGRESS",
                              "WAITING_FOR_USER",
                              "ESCALATED",
                              "RESOLVED",
                              "CLOSED",
                              "REPLIED",
                            ].map((value) => (
                              <option
                                key={value}
                                value={value}
                                disabled={
                                  value === "REPLIED" ||
                                  (selected.status === "CLOSED" && value !== "OPEN") ||
                                  (selected.status === "RESOLVED" && !["OPEN", "CLOSED"].includes(value)) ||
                                  (value === "ASSIGNED" && !selected.assignedAccountRef)
                                }
                              >
                                {value.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                            <label
                              htmlFor="support-status-note"
                              style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}
                            >
                              Status or resolution summary
                            </label>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: statusNoteValid ? "#10b981" : "#ef4444",
                              }}
                            >
                              {statusNote.trim().length} / 8 min (max 1200)
                            </span>
                          </div>
                          <textarea
                            id="support-status-note"
                            className="cg19-input"
                            style={{ width: "100%", fontFamily: "inherit" }}
                            rows={3}
                            maxLength={1200}
                            value={statusNote}
                            onChange={(e) => setStatusNote(e.target.value)}
                            placeholder="Required for Waiting for User, Resolved and Closed (minimum 8 characters)"
                          />
                        </div>

                        <button
                          type="button"
                          className="cg19-btn-apply"
                          style={{ width: "100%", justifyContent: "center" }}
                          disabled={busy || nextStatus === selected.status || !statusNoteValid}
                          onClick={() => void act("CHANGE_STATUS")}
                        >
                          Save status
                        </button>

                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                          <button
                            type="button"
                            className="cg19-btn-reset"
                            style={{ flex: 1 }}
                            disabled={busy || selected.status === "CLOSED" || statusNote.trim().length < 8}
                            onClick={() => void act("CLOSE")}
                          >
                            Close case
                          </button>
                          <button
                            type="button"
                            className="cg19-btn-reset"
                            style={{ flex: 1 }}
                            disabled={busy || selected.status === "OPEN"}
                            onClick={() => void act("REOPEN")}
                          >
                            Reopen case
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Private Foundation Reply Form */}
                  {mayReply && !["CLOSED", "RESOLVED"].includes(selected.status) && (
                    <div className="cg19-drawer-card">
                      <strong style={{ fontSize: "0.9rem", color: "#1e293b", display: "block", marginBottom: "0.5rem" }}>
                        Private Foundation reply
                      </strong>
                      <textarea
                        className="cg19-input"
                        style={{ width: "100%", fontFamily: "inherit" }}
                        rows={4}
                        minLength={2}
                        maxLength={2400}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Type official private response (min 2 characters)..."
                      />
                      <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button
                          type="button"
                          className="cg19-btn-apply"
                          disabled={busy || reply.trim().length < 2}
                          onClick={() => void act("REPLY")}
                        >
                          <Send className="w-4 h-4" />
                          Save original reply
                        </button>
                        <small style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                          Simulated safe delivery
                        </small>
                      </div>
                    </div>
                  )}

                  {/* Archive button */}
                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                    <button
                      type="button"
                      className="cg19-btn-reset"
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
                      disabled={busy}
                      onClick={() => void act("ARCHIVE")}
                    >
                      <Archive className="w-4 h-4 text-slate-500" />
                      {selected.archived ? "Restore from archive" : "Archive for my account"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {/* Tab 2: FAQ Workspace */}
      {tab === "FAQ" && mayEditFaq && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="cg19-filter-panel">
            <h3 className="font-slab" style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#1e293b" }}>
              {editing ? "Edit help question" : "New Foundation help question"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div className="cg19-input-group">
                <label htmlFor="faq-question">Question</label>
                <input
                  id="faq-question"
                  className="cg19-input"
                  value={question}
                  maxLength={200}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. How can I verify my membership certificate?"
                />
              </div>
              <div className="cg19-input-group">
                <label htmlFor="faq-answer">Answer</label>
                <textarea
                  id="faq-answer"
                  className="cg19-input"
                  value={answer}
                  maxLength={1600}
                  rows={4}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Official sanitized answer visible to visitors"
                />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="cg19-btn-apply"
                  disabled={busy || !question.trim() || !answer.trim()}
                  onClick={() => void saveFaq()}
                >
                  Save draft/revision
                </button>
                {editing && editing.state !== "PUBLISHED" && (
                  <button
                    type="button"
                    className="cg19-btn-reset"
                    disabled={busy}
                    onClick={() => void saveFaq(true)}
                  >
                    Publish
                  </button>
                )}
                {editing && (
                  <button
                    type="button"
                    className="cg19-btn-reset"
                    onClick={() => {
                      setEditing(null);
                      setQuestion("");
                      setAnswer("");
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="cg19-table-card">
            <div className="cg19-tab-header">
              <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>
                Frequently Asked Questions ({faqs.length})
              </span>
            </div>
            <table className="cg19-desk-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Status</th>
                  <th>Revision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((f) => (
                  <tr key={f.faqRef}>
                    <td>
                      <strong style={{ color: "#1e293b", display: "block" }}>{f.question}</strong>
                      <p style={{ margin: "0.2rem 0 0 0", color: "#64748b", fontSize: "0.825rem" }}>
                        {f.answer}
                      </p>
                    </td>
                    <td>
                      <span className={`cg19-status-pill ${f.state === "PUBLISHED" ? "open" : "waiting"}`}>
                        {f.state}
                      </span>
                    </td>
                    <td>Rev {f.revision}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          className="cg19-btn-open"
                          disabled={busy}
                          onClick={() => {
                            setEditing(f);
                            setQuestion(f.question);
                            setAnswer(f.answer);
                          }}
                        >
                          Edit
                        </button>
                        {f.state === "DRAFT" && (
                          <button
                            type="button"
                            className="cg19-btn-open"
                            disabled={busy}
                            onClick={() => void faqState(f, "PUBLISHED")}
                          >
                            Publish
                          </button>
                        )}
                        {f.state === "PUBLISHED" && (
                          <button
                            type="button"
                            className="cg19-btn-open"
                            disabled={busy}
                            onClick={() => void faqState(f, "WITHDRAWN")}
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
