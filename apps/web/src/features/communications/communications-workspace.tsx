"use client";
import { useCallback, useEffect, useState, useMemo } from "react";
import {
  Bell,
  Send,
  Radio,
  Megaphone,
  Users,
  Mail,
  FileText,
  Calendar,
  SlidersHorizontal,
  Search,
  RefreshCw,
  PlusCircle,
  CheckCircle,
  XCircle,
  Activity,
  Check,
  AlertCircle,
  Eye,
  Archive,
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  Smartphone,
  Inbox,
  Filter,
  CheckCircle2,
  Bookmark,
  Share2,
  Layers,
  BarChart2,
  ExternalLink,
  MessageSquare,
  Lock,
} from "lucide-react";
import { CustomDropdown, DropdownOption } from "../../shared/custom-dropdown";

type Option = { value: string; label: string };
type Channel = "IN_APP" | "EMAIL" | "SMS";
type Notice = {
  noticeRef: string;
  title: string;
  body: string;
  priority: string;
  state: string;
  purpose: string;
  revision: number;
  audienceCount: number;
  audienceKind: string;
  channels: Channel[];
  targetHref: string | null;
  scheduledAt: string | null;
  expiresAt: string;
  createdAt: string;
};
type InboxItem = {
  notificationRef: string;
  title: string;
  body: string;
  status: string;
  channel: Channel;
  receivedAt: string;
  read: boolean;
};
type Providers = { channels: Array<{ channel: string; state: string; configured: boolean }> };
type NoticeCounts = { counts: Array<{ channel: Channel; status: string; count: number }> };
type PhoneProof = {
  hasNumber: boolean;
  verified: boolean;
  maskedContact: string | null;
  verifiedAt: string | null;
  providerConfigured: boolean;
};
type Alert = { kind: "error" | "success" | "info"; message: string };
type ClientEmailReference = {
  code: string;
  title: string;
  owner: string;
  trigger: string;
  recipient: string;
  subject: string;
  body: string;
  attachmentRule: string;
  placeholders: string[];
  state: string;
  deliveryEnabled: false;
};

async function req<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  let response: Response;
  try {
    response = await fetch("/api/communications/" + path, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Error("UNKNOWN");
  }
  if (response.status === 401) throw Error("LOGIN");
  if (response.status === 403) throw Error("DENIED");
  if (response.status === 409) throw Error("CONFLICT");
  if (response.status === 400) throw Error("INVALID");
  if (!response.ok) throw Error("UNKNOWN");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

async function mobile<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const options: RequestInit = {
    method,
    credentials: "same-origin",
    cache: "no-store",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  };
  let res: Response;
  try {
    res = await fetch("/api/mobile-verification/" + path, options);
  } catch {
    throw Error("UNKNOWN");
  }
  if (!res.ok) throw Error(res.status === 401 ? "LOGIN" : res.status === 403 ? "DENIED" : "UNKNOWN");
  try {
    return (await res.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

const explain = (e: unknown) => {
  const code = e instanceof Error ? e.message : "UNKNOWN";
  return code === "DENIED"
    ? "Your current role does not permit this action."
    : code === "LOGIN"
    ? "Your session expired. Sign in again."
    : code === "CONFLICT"
    ? "The notice was changed. Refresh before continuing."
    : code === "INVALID"
    ? "Check the audience, message and schedule."
    : "This action could not be confirmed. Check the original status before retrying.";
};

function stateBadgeClass(state: string) {
  switch (state) {
    case "ACTIVE":
      return "cg19-status-pill open";
    case "SCHEDULED":
      return "cg19-status-pill in_progress";
    case "DRAFT":
      return "cg19-status-pill waiting";
    case "EXPIRED":
      return "cg19-status-pill escalated";
    case "CANCELLED":
      return "cg19-status-pill closed";
    default:
      return "cg19-status-pill waiting";
  }
}

function priorityBadgeClass(priority: string) {
  return priority === "IMPORTANT"
    ? "cg19-badge cg19-badge-danger"
    : "cg19-badge cg19-badge-info";
}

function channelBadgeClass(channel: string) {
  switch (channel) {
    case "IN_APP":
      return "cg19-badge cg19-badge-neutral";
    case "EMAIL":
      return "cg19-badge cg19-badge-teal";
    case "SMS":
      return "cg19-badge cg19-badge-purple";
    default:
      return "cg19-badge cg19-badge-neutral";
  }
}

export function CommunicationsWorkspace({
  mayManage,
  mayApprove,
  mayProcess,
  mayRead,
  mayViewDelivery,
  mayChooseAccounts,
  mayChooseRoles,
}: {
  mayManage: boolean;
  mayApprove: boolean;
  mayProcess: boolean;
  mayRead: boolean;
  mayViewDelivery: boolean;
  mayChooseAccounts: boolean;
  mayChooseRoles: boolean;
}) {
  const [tab, setTab] = useState<"NOTICES" | "INBOX" | "EMAIL_TEMPLATES">(mayManage ? "NOTICES" : "INBOX");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [phoneProof, setPhoneProof] = useState<PhoneProof | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  
  // Filter States
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");

  // Composer Form States
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [purpose, setPurpose] = useState("TRANSACTIONAL");
  const [audienceKind, setAudienceKind] = useState("ALL_ACTIVE");
  const [audienceRef, setAudienceRef] = useState("");
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [expiry, setExpiry] = useState("");
  const [href, setHref] = useState("");

  // Review & Security States
  const [currentPassword, setCurrentPassword] = useState("");
  const [review, setReview] = useState<{
    id: string;
    action: "APPROVE" | "CANCEL";
    revision: number;
  } | null>(null);
  const [pendingKey, setPendingKey] = useState("");
  const [reviewKey, setReviewKey] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<Alert | null>(null);

  // Delivery Counts Dialog
  const [delivery, setDelivery] = useState<NoticeCounts | null>(null);
  const [deliveryRef, setDeliveryRef] = useState("");

  // Client Email References
  const [emailReferences, setEmailReferences] = useState<ClientEmailReference[]>([]);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await Promise.all([
        mayManage ? req<{ notices: Notice[] }>("notices?limit=30") : Promise.resolve({ notices: [] }),
        mayRead ? req<{ items: InboxItem[] }>("inbox?limit=30") : Promise.resolve({ items: [] }),
        mayViewDelivery ? req<Providers>("providers/status") : Promise.resolve(null),
        mayRead ? mobile<PhoneProof>("status") : Promise.resolve(null),
      ]);
      if (result[0].notices.length > 30 || result[1].items.length > 30) throw Error("UNKNOWN");
      setNotices(result[0].notices);
      setInbox(result[1].items);
      setProviders(result[2]);
      setPhoneProof(result[3]);
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setLoading(false);
    }
  }, [mayManage, mayRead, mayViewDelivery]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setOptions([]);
    setAudienceRef("");
    if (audienceKind === "ALL_ACTIVE" || !mayManage) return;
    const controller = new AbortController();
    const path = audienceKind === "ROLE" ? "roles" : "accounts";
    if ((path === "roles" && !mayChooseRoles) || (path === "accounts" && !mayChooseAccounts)) return;
    void (async () => {
      try {
        const res = await fetch("/api/access/" + path + "/options?search=", {
          credentials: "same-origin",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) throw Error();
        const data = (await res.json()) as { options?: Option[] };
        if (!controller.signal.aborted && Array.isArray(data.options) && data.options.length <= 30) {
          setOptions(data.options);
        }
      } catch {
        if (!controller.signal.aborted) {
          setAlert({ kind: "error", message: "Authorized audience options unavailable." });
        }
      }
    })();
    return () => controller.abort();
  }, [audienceKind, mayManage, mayChooseAccounts, mayChooseRoles]);

  async function create() {
    if (!mayManage || busy || unknown) return;
    setBusy(true);
    setAlert(null);
    const key = pendingKey || crypto.randomUUID();
    setPendingKey(key);
    try {
      if (!expiry) throw Error("INVALID");
      const data = await req<Notice & { result: string }>("notices", "POST", {
        title,
        body,
        priority,
        purpose,
        channels: ["IN_APP", ...(email ? ["EMAIL"] : []), ...(sms ? ["SMS"] : [])],
        audienceKind,
        audienceRef: audienceKind === "ALL_ACTIVE" ? null : audienceRef,
        scheduledAt: schedule ? new Date(schedule).toISOString() : null,
        expiresAt: new Date(expiry).toISOString(),
        requestKey: key,
        targetHref: href || null,
      });
      if (!data.noticeRef || !Number.isInteger(data.revision)) throw Error("UNKNOWN");
      setPendingKey("");
      setUnknown(false);
      setAlert({
        kind: "success",
        message: "Notice draft saved with its frozen permitted audience. It has not been sent.",
      });
      setTitle("");
      setBody("");
      setSchedule("");
      setHref("");
      setComposerOpen(false);
      await reload();
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUnknown(true);
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function findOriginal() {
    if (!pendingKey || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      const x = await req<{ status: string; notice: Notice | null }>(
        "notices/requests/" + encodeURIComponent(pendingKey)
      );
      setUnknown(x.status !== "CONFIRMED");
      setAlert({
        kind: x.status === "CONFIRMED" ? "success" : "info",
        message:
          x.status === "CONFIRMED"
            ? "Original draft located: " + x.notice?.title
            : "No confirmed draft found. Keep the original request key and contact Foundation operations.",
      });
      if (x.status === "CONFIRMED") {
        setPendingKey("");
        await reload();
      }
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function decide() {
    if (!review || !mayApprove || busy || unknown) return;
    if (currentPassword.length < 8 || currentPassword.length > 1024) {
      setAlert({ kind: "error", message: "Enter a fresh current password." });
      return;
    }
    setBusy(true);
    setAlert(null);
    const requestKey = reviewKey || crypto.randomUUID();
    setReviewKey(requestKey);
    try {
      const result = await req<{ status: string; revision: number }>(
        "notices/" + encodeURIComponent(review.id) + "/decision",
        "POST",
        {
          action: review.action,
          expectedRevision: review.revision,
          requestKey,
          currentPassword,
        }
      );
      if (!Number.isInteger(result.revision)) throw Error("UNKNOWN");
      setReview(null);
      setReviewKey("");
      setCurrentPassword("");
      setAlert({ kind: "success", message: "Notice status confirmed: " + result.status });
      await reload();
    } catch (e) {
      if (e instanceof Error && e.message === "UNKNOWN") setUnknown(true);
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function checkOriginalDecision() {
    if (!review || !reviewKey || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      const state = await req<{ status: string; action: string | null; revision: number | null }>(
        "notices/" + encodeURIComponent(review.id) + "/requests/" + encodeURIComponent(reviewKey)
      );
      if (state.status !== "CONFIRMED" || !Number.isInteger(state.revision)) {
        setAlert({
          kind: "error",
          message: "The original approval is not confirmed. Keep the request key; contact Foundation operations.",
        });
        return;
      }
      setUnknown(false);
      setReview(null);
      setReviewKey("");
      setCurrentPassword("");
      setAlert({ kind: "success", message: "Original notice command confirmed: " + state.action });
      await reload();
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function startPhoneProof() {
    if (busy || !mayRead || !phoneProof?.hasNumber) return;
    setBusy(true);
    setAlert(null);
    try {
      const result = await mobile<{ status: string }>("verify/start", "POST");
      setAlert({
        kind: result.status === "CODE_REQUESTED_UNCONFIRMED_DELIVERY" ? "info" : "error",
        message:
          result.status === "CODE_REQUESTED_UNCONFIRMED_DELIVERY"
            ? "Verification code was requested for your recorded mobile number. Delivery is not guaranteed."
            : "Original code request: " + result.status.replaceAll("_", " "),
      });
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmPhoneProof() {
    if (busy || !mayRead || !/^\d{4,10}$/.test(phoneCode)) return;
    setBusy(true);
    setAlert(null);
    try {
      const result = await mobile<{ status: string }>("verify/confirm", "POST", { code: phoneCode });
      if (result.status === "VERIFIED") {
        setPhoneCode("");
        await reload();
      }
      setAlert({
        kind: result.status === "VERIFIED" ? "success" : "error",
        message:
          result.status === "VERIFIED"
            ? "Your mobile contact was verified by its original proof provider."
            : "Code has not been verified: " + result.status.replaceAll("_", " "),
      });
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function counts(id: string) {
    setDeliveryRef(id);
    setDelivery(null);
    try {
      const result = await req<NoticeCounts>("notices/" + encodeURIComponent(id) + "/counts");
      setDelivery(result);
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    }
  }

  async function markRead(ref: string) {
    if (busy) return;
    setBusy(true);
    try {
      await req("inbox/" + encodeURIComponent(ref) + "/read", "POST");
      await reload();
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function runRecovery(kind: "recover-decisions" | "process-due") {
    if (!mayProcess || busy) return;
    setBusy(true);
    setAlert(null);
    try {
      await req(kind, "POST");
      setAlert({
        kind: "info",
        message: "The bounded original-source recovery was requested. Refresh for verified status.",
      });
      await reload();
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function loadEmailReferences() {
    if (!mayManage) return;
    setEmailLoading(true);
    try {
      const data = await req<{ templates: ClientEmailReference[]; total: number; deliveryEnabled: false }>(
        "client-email-templates"
      );
      if (!Array.isArray(data.templates) || data.total !== 52 || data.deliveryEnabled !== false) {
        throw Error("UNKNOWN");
      }
      setEmailReferences(data.templates);
    } catch (e) {
      setAlert({ kind: "error", message: explain(e) });
    } finally {
      setEmailLoading(false);
    }
  }

  async function importClientDrafts() {
    if (!mayManage || busy) return;
    setBusy(true);
    try {
      const result = await req<{ imported: number; alreadyPresent: number; deliveryEnabled: false }>(
        "client-email-templates/import-drafts",
        "POST"
      );
      if (result.deliveryEnabled !== false) throw Error("UNKNOWN");
      setAlert({
        kind: "success",
        message:
          `${result.imported} email references imported as disabled drafts. ` +
          `${result.alreadyPresent} already existed. No messages were sent.`,
      });
      await loadEmailReferences();
    } catch (e) {
      setAlert({
        kind: "error",
        message:
          e instanceof Error && e.message === "CONFLICT"
            ? "A saved client email reference differs from this source version. " +
              "Review the original template before importing again; no emails were sent."
            : explain(e),
      });
    } finally {
      setBusy(false);
    }
  }

  // Real Counts calculated from actual DB state
  const activeCount = notices.filter((x) => x.state === "ACTIVE").length;
  const scheduledCount = notices.filter((x) => x.state === "SCHEDULED").length;
  const draftCount = notices.filter((x) => x.state === "DRAFT").length;
  const expiredCount = notices.filter((x) => x.state === "EXPIRED").length;
  const cancelledCount = notices.filter((x) => x.state === "CANCELLED").length;
  const unreadInboxCount = inbox.filter((x) => !x.read).length;
  const totalNoticesCount = notices.length;
  const totalAudienceReached = useMemo(() => {
    return notices.reduce((acc, n) => acc + (n.audienceCount || 0), 0);
  }, [notices]);

  // Dropdown Options for Filters
  const statusOptions: DropdownOption[] = [
    { value: "ALL", label: "All Statuses" },
    { value: "ACTIVE", label: "Active Notices" },
    { value: "SCHEDULED", label: "Scheduled" },
    { value: "DRAFT", label: "Drafts" },
    { value: "EXPIRED", label: "Expired" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  const priorityOptions: DropdownOption[] = [
    { value: "ALL", label: "All Priorities" },
    { value: "IMPORTANT", label: "Important" },
    { value: "NORMAL", label: "General (Normal)" },
  ];

  const purposeOptions: DropdownOption[] = [
    { value: "ALL", label: "All Purposes" },
    { value: "TRANSACTIONAL", label: "Service (Transactional)" },
    { value: "PROMOTIONAL", label: "Campaign (Promotional)" },
  ];

  const audienceOptions: DropdownOption[] = [
    { value: "ALL", label: "All User Types / Audiences" },
    { value: "ALL_ACTIVE", label: "All Active Accounts" },
    { value: "ROLE", label: "Specific Role" },
    { value: "INDIVIDUAL", label: "Individual Account" },
  ];

  // Composer Priority & Purpose Options
  const composerPriorityOptions: DropdownOption[] = [
    { value: "NORMAL", label: "General (Normal)" },
    { value: "IMPORTANT", label: "Important" },
  ];

  const composerPurposeOptions: DropdownOption[] = [
    { value: "TRANSACTIONAL", label: "Service notice (Transactional)" },
    { value: "PROMOTIONAL", label: "Optional campaign (Consent required)" },
  ];

  const composerAudienceKindOptions: DropdownOption[] = [
    { value: "ALL_ACTIVE", label: "All active Foundation accounts" },
    ...(mayChooseRoles ? [{ value: "ROLE", label: "One current role" }] : []),
    ...(mayChooseAccounts ? [{ value: "INDIVIDUAL", label: "One active person" }] : []),
  ];

  const composerRecipientOptions: DropdownOption[] = [
    { value: "", label: "Choose actual recipient" },
    ...options.map((o) => ({ value: o.value, label: o.label })),
  ];

  const handleApplyFilter = () => {
    setAppliedSearch(search.trim());
  };

  const handleResetFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setPurposeFilter("ALL");
    setAudienceFilter("ALL");
  };

  const shown = notices.filter(
    (x) =>
      (statusFilter === "ALL" || x.state === statusFilter) &&
      (priorityFilter === "ALL" || x.priority === priorityFilter) &&
      (purposeFilter === "ALL" || x.purpose === purposeFilter) &&
      (audienceFilter === "ALL" || x.audienceKind === audienceFilter) &&
      (x.title + " " + x.state + " " + x.priority + " " + x.body)
        .toLowerCase()
        .includes(appliedSearch.toLowerCase())
  );

  const selectedNotice = notices.find((n) => n.noticeRef === deliveryRef);

  return (
    <section className="cg19-support-container" aria-label="Notifications and Communications Command Center">
      {/* Top Header Toolbar */}
      <header className="topbar" style={{ marginBottom: "0.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <h1 className="font-slab" style={{ fontSize: "1.65rem", fontWeight: 800, margin: 0 }}>
              Notifications
            </h1>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#dbeafe",
                color: "#2563eb",
              }}
              title="Verified Foundation System"
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          </div>
          <p style={{ margin: "0.2rem 0 0 0", color: "#64748b", fontSize: "0.825rem" }}>
            Complete Command Center &amp; Control Panel
          </p>
        </div>

        <div className="toolbar" style={{ gap: "0.6rem" }}>
          {mayManage && (
            <button
              type="button"
              className="cg19-btn-apply"
              style={{ padding: "0.55rem 1rem", fontSize: "0.85rem" }}
              onClick={() => setComposerOpen((p) => !p)}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{composerOpen ? "Close Composer" : "Draft New Notice"}</span>
            </button>
          )}

          <button
            type="button"
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
            }}
            onClick={() => void reload()}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Top 6 KPI Metric Cards matching Client Screenshot 2 */}
      <div className="cg19-kpi-row" aria-label="Notifications status overview">
        {/* 1. Total Notifications */}
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap blue">
            <Send className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="cg19-kpi-label">Total Notifications</p>
            <h3 className="cg19-kpi-val">{totalNoticesCount}</h3>
            <span className="cg19-kpi-sub">All time</span>
          </div>
        </article>

        {/* 2. Active Notices */}
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap green">
            <Megaphone className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="cg19-kpi-label">Active Notices</p>
            <h3 className="cg19-kpi-val">{activeCount}</h3>
            <span className="cg19-kpi-sub">Currently live</span>
          </div>
        </article>

        {/* 3. Recipients Reached */}
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap orange">
            <Users className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="cg19-kpi-label">Recipients Reached</p>
            <h3 className="cg19-kpi-val">{totalAudienceReached}</h3>
            <span className="cg19-kpi-sub">Across channels</span>
          </div>
        </article>

        {/* 4. In-App Delivered */}
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap purple">
            <Mail className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="cg19-kpi-label">In-App Delivered</p>
            <h3 className="cg19-kpi-val">{inbox.length}</h3>
            <span className="cg19-kpi-sub">Personal inbox</span>
          </div>
        </article>

        {/* 5. Pinned / Drafts */}
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap red">
            <FileText className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="cg19-kpi-label">Draft Notices</p>
            <h3 className="cg19-kpi-val">{draftCount}</h3>
            <span className="cg19-kpi-sub">Pending review</span>
          </div>
        </article>

        {/* 6. Scheduled */}
        <article className="cg19-kpi-card">
          <div className="cg19-kpi-icon-wrap teal">
            <Calendar className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="cg19-kpi-label">Scheduled</p>
            <h3 className="cg19-kpi-val">{scheduledCount}</h3>
            <span className="cg19-kpi-sub">Queued to go out</span>
          </div>
        </article>
      </div>

      {alert && (
        <div
          role="status"
          style={{
            background: alert.kind === "success" ? "#f0fdf4" : alert.kind === "error" ? "#fef2f2" : "#eff6ff",
            border:
              "1px solid " +
              (alert.kind === "success" ? "#bbf7d0" : alert.kind === "error" ? "#fecaca" : "#bfdbfe"),
            color: alert.kind === "success" ? "#166534" : alert.kind === "error" ? "#991b1b" : "#1e40af",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{alert.message}</span>
        </div>
      )}

      {/* Main Workspace Navigation Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {mayManage && (
          <button
            type="button"
            className="cg19-tab-pill"
            style={{
              padding: "0.45rem 0.95rem",
              borderRadius: "8px",
              border: tab === "NOTICES" ? "1px solid #4f46e5" : "1px solid #cbd5e1",
              background: tab === "NOTICES" ? "#4f46e5" : "#ffffff",
              color: tab === "NOTICES" ? "#ffffff" : "#475569",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
            onClick={() => setTab("NOTICES")}
          >
            Notices &amp; Broadcasts
          </button>
        )}

        {mayRead && (
          <button
            type="button"
            className="cg19-tab-pill"
            style={{
              padding: "0.45rem 0.95rem",
              borderRadius: "8px",
              border: tab === "INBOX" ? "1px solid #4f46e5" : "1px solid #cbd5e1",
              background: tab === "INBOX" ? "#4f46e5" : "#ffffff",
              color: tab === "INBOX" ? "#ffffff" : "#475569",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
            onClick={() => setTab("INBOX")}
          >
            My Notifications ({unreadInboxCount})
          </button>
        )}

        {mayManage && (
          <button
            type="button"
            className="cg19-tab-pill"
            style={{
              padding: "0.45rem 0.95rem",
              borderRadius: "8px",
              border: tab === "EMAIL_TEMPLATES" ? "1px solid #4f46e5" : "1px solid #cbd5e1",
              background: tab === "EMAIL_TEMPLATES" ? "#4f46e5" : "#ffffff",
              color: tab === "EMAIL_TEMPLATES" ? "#ffffff" : "#475569",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
            onClick={() => {
              setTab("EMAIL_TEMPLATES");
              void loadEmailReferences();
            }}
          >
            Email Reference Templates (52)
          </button>
        )}

        {mayProcess && (
          <button
            type="button"
            className="cg19-btn-reset"
            style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
            onClick={() => void runRecovery("recover-decisions")}
            disabled={busy}
          >
            Recover committed approvals
          </button>
        )}

        {mayProcess && (
          <button
            type="button"
            className="cg19-btn-reset"
            style={{ fontSize: "0.8rem", padding: "0.45rem 0.85rem" }}
            onClick={() => void runRecovery("process-due")}
            disabled={busy}
          >
            Process due messages
          </button>
        )}
      </div>

      {/* External Channel Readiness Banner */}
      {mayViewDelivery && providers && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "0.85rem 1.15rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>
              External Channel Readiness:
            </span>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {providers.channels.map((c) => (
                <span
                  key={c.channel}
                  className={`cg19-status-pill ${c.configured ? "open" : "waiting"}`}
                  style={{ textTransform: "none", fontSize: "0.75rem" }}
                >
                  <strong>{c.channel}:</strong> {c.state.replaceAll("_", " ")}
                  {c.configured ? " (Configured)" : " (Unavailable)"}
                </span>
              ))}
            </div>
          </div>
          <small style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
            In-app notifications deliver independently of external SMS or Email provider availability.
          </small>
        </div>
      )}

      {/* TAB 1: NOTICES & BROADCASTS */}
      {tab === "NOTICES" && mayManage && (
        <>
          {/* Draft New Notice Form / Composer Modal */}
          {composerOpen && (
            <div
              className="cg19-filter-panel"
              style={{
                border: "1px solid #c7d2fe",
                background: "#fdfefe",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "1rem",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <h3 className="font-slab" style={{ margin: 0, fontSize: "1.15rem", color: "#1e293b" }}>
                    Draft New Notice
                  </h3>
                  <p style={{ margin: "0.2rem 0 0 0", color: "#64748b", fontSize: "0.8rem" }}>
                    A draft freezes its real Foundation audience. A protected approver confirms password to activate.
                  </p>
                </div>
                <button
                  type="button"
                  className="cg19-btn-reset"
                  style={{ padding: "0.35rem 0.65rem" }}
                  onClick={() => setComposerOpen(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Row 1: Title */}
                <div className="cg19-input-group">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor="notice-title">Notice Title</label>
                    <span style={{ fontSize: "0.75rem", color: title.length >= 120 ? "#ef4444" : "#94a3b8" }}>
                      {title.length} / 120
                    </span>
                  </div>
                  <input
                    id="notice-title"
                    className="cg19-input"
                    value={title}
                    maxLength={120}
                    disabled={busy || unknown}
                    placeholder="Notice headline (min 5 characters)"
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Row 2: Message Body */}
                <div className="cg19-input-group">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label htmlFor="notice-body">Message Content</label>
                    <span style={{ fontSize: "0.75rem", color: body.length >= 480 ? "#ef4444" : "#94a3b8" }}>
                      {body.length} / 480
                    </span>
                  </div>
                  <textarea
                    id="notice-body"
                    className="cg19-input"
                    rows={4}
                    value={body}
                    maxLength={480}
                    placeholder="Announcement message content (min 10 characters)"
                    disabled={busy || unknown}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </div>

                {/* Row 3: Priority & Purpose with CustomDropdown */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="cg19-input-group">
                    <label>Priority</label>
                    <CustomDropdown
                      options={composerPriorityOptions}
                      value={priority}
                      onChange={(val) => setPriority(val)}
                      disabled={busy || unknown}
                    />
                  </div>
                  <div className="cg19-input-group">
                    <label>Purpose</label>
                    <CustomDropdown
                      options={composerPurposeOptions}
                      value={purpose}
                      onChange={(val) => setPurpose(val)}
                      disabled={busy || unknown}
                    />
                  </div>
                </div>

                {/* Row 4: Audience with CustomDropdown */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: audienceKind !== "ALL_ACTIVE" ? "1fr 1fr" : "1fr",
                    gap: "1rem",
                  }}
                >
                  <div className="cg19-input-group">
                    <label>Audience Scope</label>
                    <CustomDropdown
                      options={composerAudienceKindOptions}
                      value={audienceKind}
                      onChange={(val) => setAudienceKind(val)}
                      disabled={busy || unknown}
                    />
                  </div>

                  {audienceKind !== "ALL_ACTIVE" && (
                    <div className="cg19-input-group">
                      <label>{audienceKind === "ROLE" ? "Select Role" : "Select Account"}</label>
                      <CustomDropdown
                        options={composerRecipientOptions}
                        value={audienceRef}
                        onChange={(val) => setAudienceRef(val)}
                        placeholder="Choose actual recipient..."
                        disabled={busy || unknown}
                      />
                    </div>
                  )}
                </div>

                {/* Row 5: Delivery Channels */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "0.85rem",
                  }}
                >
                  <strong style={{ fontSize: "0.825rem", color: "#334155", display: "block", marginBottom: "0.5rem" }}>
                    Delivery Channels
                  </strong>
                  <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input type="checkbox" checked readOnly style={{ accentColor: "#4f46e5" }} />
                      <span>In-app (always delivered)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={email}
                        disabled={busy || unknown}
                        onChange={(e) => setEmail(e.target.checked)}
                        style={{ accentColor: "#4f46e5" }}
                      />
                      <span>Email (verified &amp; opted-in)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.825rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={sms}
                        disabled={busy || unknown}
                        onChange={(e) => setSms(e.target.checked)}
                        style={{ accentColor: "#4f46e5" }}
                      />
                      <span>SMS (verified &amp; opted-in)</span>
                    </label>
                  </div>
                </div>

                {/* Row 6: Schedule & Expiry */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="cg19-input-group">
                    <label htmlFor="notice-schedule">Schedule (optional)</label>
                    <input
                      id="notice-schedule"
                      type="datetime-local"
                      className="cg19-input"
                      value={schedule}
                      disabled={busy || unknown}
                      onChange={(e) => setSchedule(e.target.value)}
                    />
                  </div>
                  <div className="cg19-input-group">
                    <label htmlFor="notice-expiry">Expires (required)</label>
                    <input
                      id="notice-expiry"
                      type="datetime-local"
                      className="cg19-input"
                      value={expiry}
                      disabled={busy || unknown}
                      onChange={(e) => setExpiry(e.target.value)}
                    />
                  </div>
                </div>

                {/* Row 7: Internal Action Link */}
                <div className="cg19-input-group">
                  <label htmlFor="notice-href">CareGanga Internal Action Link (optional)</label>
                  <input
                    id="notice-href"
                    className="cg19-input"
                    value={href}
                    placeholder="/admin/approvals"
                    maxLength={180}
                    disabled={busy || unknown}
                    onChange={(e) => setHref(e.target.value)}
                  />
                </div>

                {unknown && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      padding: "0.85rem",
                      color: "#991b1b",
                    }}
                  >
                    <strong style={{ fontSize: "0.85rem" }}>Draft outcome unconfirmed</strong>
                    <p style={{ margin: "0.25rem 0 0.5rem 0", fontSize: "0.8rem" }}>
                      Do not create another notice until the original request is checked.
                    </p>
                    <button
                      type="button"
                      className="cg19-btn-reset"
                      disabled={busy}
                      onClick={() => void findOriginal()}
                    >
                      Check original draft request
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="cg19-btn-apply"
                    disabled={
                      busy ||
                      unknown ||
                      !expiry ||
                      !title ||
                      !body ||
                      (audienceKind !== "ALL_ACTIVE" && !audienceRef)
                    }
                    onClick={() => void create()}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{busy ? "Saving..." : "Save Frozen Audience Draft"}</span>
                  </button>
                  <button
                    type="button"
                    className="cg19-btn-reset"
                    disabled={busy}
                    onClick={() => setComposerOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main 2-Column Content Layout (Matching Screenshot 2) */}
          <div className="cg19-content-grid">
            {/* Left Main Column: Filters & Table Card */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Advanced Filters Panel */}
              <div className="cg19-filter-panel" aria-label="Advanced Notice Filters">
                <div
                  className="cg19-filter-header"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.85rem",
                  }}
                >
                  <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                  <span className="font-slab" style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                    Advanced Filters
                  </span>
                </div>

                {/* Top Filter Row: Search & CustomDropdowns */}
                <div className="cg19-filter-grid-top">
                  {/* Search */}
                  <div className="cg19-input-group">
                    <label htmlFor="notice-search">Search</label>
                    <div style={{ position: "relative" }}>
                      <Search
                        className="w-3.5 h-3.5 text-slate-400"
                        style={{
                          position: "absolute",
                          left: "0.85rem",
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        id="notice-search"
                        className="cg19-input"
                        style={{ paddingLeft: "2.4rem" }}
                        placeholder="Search title, message, status..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleApplyFilter();
                        }}
                      />
                    </div>
                  </div>

                  {/* Notice Status */}
                  <div className="cg19-input-group">
                    <label>Status</label>
                    <CustomDropdown
                      options={statusOptions}
                      value={statusFilter}
                      onChange={(val) => setStatusFilter(val)}
                    />
                  </div>

                  {/* Priority */}
                  <div className="cg19-input-group">
                    <label>Priority</label>
                    <CustomDropdown
                      options={priorityOptions}
                      value={priorityFilter}
                      onChange={(val) => setPriorityFilter(val)}
                    />
                  </div>

                  {/* Purpose */}
                  <div className="cg19-input-group">
                    <label>Purpose</label>
                    <CustomDropdown
                      options={purposeOptions}
                      value={purposeFilter}
                      onChange={(val) => setPurposeFilter(val)}
                    />
                  </div>

                  {/* Audience */}
                  <div className="cg19-input-group">
                    <label>Target Audience</label>
                    <CustomDropdown
                      options={audienceOptions}
                      value={audienceFilter}
                      onChange={(val) => setAudienceFilter(val)}
                    />
                  </div>
                </div>

                {/* Bottom Filter Row: Action Buttons */}
                <div className="cg19-filter-row-bottom">
                  <button type="button" className="cg19-btn-reset" onClick={handleResetFilters}>
                    Reset
                  </button>
                  <button type="button" className="cg19-btn-apply" disabled={busy} onClick={handleApplyFilter}>
                    Apply Filters
                  </button>
                </div>
              </div>

              {/* Table Card */}
              <div className="cg19-table-card">
                {/* Status Tabs Header matching Screenshot 2 */}
                <div
                  className="cg19-tab-header"
                  style={{
                    padding: "0.6rem 1rem",
                    background: "#ffffff",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                    {(
                      [
                        { key: "ALL", label: "All Notifications", count: notices.length },
                        { key: "ACTIVE", label: "Active Notices", count: activeCount },
                        { key: "SCHEDULED", label: "Scheduled", count: scheduledCount },
                        { key: "DRAFT", label: "Drafts", count: draftCount },
                        { key: "EXPIRED", label: "Expired", count: expiredCount },
                        { key: "CANCELLED", label: "Cancelled", count: cancelledCount },
                      ] as const
                    ).map((tabItem) => (
                      <button
                        key={tabItem.key}
                        type="button"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.45rem 0.85rem",
                          borderRadius: "8px",
                          border: statusFilter === tabItem.key ? "1px solid #c7d2fe" : "1px solid transparent",
                          background: statusFilter === tabItem.key ? "#eef2ff" : "#ffffff",
                          color: statusFilter === tabItem.key ? "#4f46e5" : "#64748b",
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onClick={() => setStatusFilter(tabItem.key)}
                      >
                        <span>{tabItem.label}</span>
                        <span
                          style={{
                            background: statusFilter === tabItem.key ? "#c7d2fe" : "#f1f5f9",
                            color: statusFilter === tabItem.key ? "#3730a3" : "#64748b",
                            padding: "0.1rem 0.45rem",
                            borderRadius: "999px",
                            fontSize: "0.725rem",
                            fontWeight: 700,
                          }}
                        >
                          {tabItem.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {mayManage && (
                    <button
                      type="button"
                      className="cg19-btn-apply"
                      style={{ padding: "0.45rem 0.95rem", fontSize: "0.825rem" }}
                      onClick={() => setComposerOpen(true)}
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Send Notification</span>
                    </button>
                  )}
                </div>

                {loading ? (
                  <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <p style={{ margin: 0, fontSize: "0.875rem" }}>Verifying notices from database...</p>
                  </div>
                ) : !shown.length ? (
                  <div style={{ padding: "3.5rem 1rem", textAlign: "center", color: "#64748b" }}>
                    <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <strong style={{ display: "block", fontSize: "0.95rem", color: "#334155" }}>
                      No notices match the current filters.
                    </strong>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.825rem", color: "#94a3b8" }}>
                      Try adjusting your search criteria or create a new notice.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="cg19-desk-table">
                      <thead>
                        <tr>
                          <th>Notice</th>
                          <th>Audience</th>
                          <th>Channels</th>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((x) => (
                          <tr key={x.noticeRef}>
                            <td style={{ maxWidth: "260px" }}>
                              <strong style={{ color: "#1e293b", fontSize: "0.875rem", display: "block" }}>
                                {x.title}
                              </strong>
                              <p
                                style={{
                                  margin: "0.2rem 0 0 0",
                                  color: "#64748b",
                                  fontSize: "0.825rem",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {x.body}
                              </p>
                              <small style={{ color: "#94a3b8", display: "block", marginTop: "0.3rem", fontSize: "0.72rem" }}>
                                {x.scheduledAt ? `Scheduled: ${new Date(x.scheduledAt).toLocaleString()} · ` : ""}
                                Expires: {new Date(x.expiresAt).toLocaleDateString()}
                              </small>
                            </td>

                            <td>
                              <strong style={{ color: "#1e293b", fontSize: "0.85rem" }}>
                                {x.audienceCount} recipients
                              </strong>
                              <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                                {x.audienceKind.replaceAll("_", " ")}
                              </p>
                            </td>

                            <td>
                              <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                                {x.channels.map((c) => (
                                  <span key={c} className={channelBadgeClass(c)}>
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td>
                              <span className={priorityBadgeClass(x.priority)}>{x.priority}</span>
                            </td>

                            <td>
                              <span className={stateBadgeClass(x.state)}>
                                {x.state.replaceAll("_", " ")}
                              </span>
                            </td>

                            <td>
                              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                                {mayApprove && x.state === "DRAFT" && (
                                  <button
                                    type="button"
                                    className="cg19-btn-faq-publish"
                                    disabled={busy || unknown}
                                    title="Review & Approve Notice"
                                    onClick={() =>
                                      setReview({
                                        id: x.noticeRef,
                                        action: "APPROVE",
                                        revision: x.revision,
                                      })
                                    }
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>Approve</span>
                                  </button>
                                )}

                                {mayApprove && !["EXPIRED", "CANCELLED"].includes(x.state) && (
                                  <button
                                    type="button"
                                    className="cg19-btn-faq-withdraw"
                                    disabled={busy || unknown}
                                    title="Cancel Notice"
                                    onClick={() =>
                                      setReview({
                                        id: x.noticeRef,
                                        action: "CANCEL",
                                        revision: x.revision,
                                      })
                                    }
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Cancel</span>
                                  </button>
                                )}

                                {mayViewDelivery && (
                                  <button
                                    type="button"
                                    className="cg19-btn-faq-edit"
                                    title="View Delivery Breakdown"
                                    onClick={() => void counts(x.noticeRef)}
                                  >
                                    <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Delivery</span>
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
              </div>

              {/* Delivery Counts Breakdown Dialog / Region */}
              {delivery && (
                <div
                  className="cg19-drawer-card"
                  style={{
                    border: "1px solid #c7d2fe",
                    background: "#fdfefe",
                    marginTop: "0.5rem",
                  }}
                  role="region"
                  aria-label="Delivery Counts Breakdown"
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.85rem",
                      paddingBottom: "0.5rem",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <h3 className="font-slab" style={{ margin: 0, fontSize: "1.05rem", color: "#1e293b" }}>
                        Delivery Evidence: {selectedNotice?.title || deliveryRef}
                      </h3>
                      <p style={{ margin: "0.15rem 0 0 0", color: "#64748b", fontSize: "0.78rem" }}>
                        Real-time transmission breakdown per communication channel
                      </p>
                    </div>
                    <button
                      type="button"
                      className="cg19-btn-reset"
                      style={{ padding: "0.3rem 0.6rem" }}
                      onClick={() => setDelivery(null)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {delivery.counts.length ? (
                    <div className="cg19-kpi-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                      {delivery.counts.map((c) => (
                        <article key={c.channel + c.status} className="cg19-kpi-card" style={{ padding: "0.65rem 0.85rem" }}>
                          <div>
                            <p className="cg19-kpi-label">{c.channel}</p>
                            <h3 className="cg19-kpi-val" style={{ fontSize: "1.2rem" }}>
                              {c.count}
                            </h3>
                            <span className="cg19-kpi-sub">
                              <span className={stateBadgeClass(c.status)} style={{ fontSize: "0.68rem" }}>
                                {c.status.replaceAll("_", " ")}
                              </span>
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                      No delivery attempts recorded for this notice yet.
                    </p>
                  )}
                </div>
              )}

              {/* Approval / Cancellation Confirmation Modal */}
              {review && (
                <div
                  className="cg19-drawer-card"
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    marginTop: "0.5rem",
                  }}
                  role="alert"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <ShieldCheck className="w-5 h-5 text-red-600" />
                    <strong style={{ fontSize: "0.95rem", color: "#991b1b" }}>
                      {review.action === "APPROVE" ? "Confirm Activation of Notice" : "Confirm Notice Cancellation"}
                    </strong>
                  </div>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.825rem", color: "#7f1d1d" }}>
                    This action requires Foundation Super Admin password confirmation for audit and data integrity.
                  </p>

                  {unknown && reviewKey && (
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #fca5a5",
                        borderRadius: "8px",
                        padding: "0.65rem",
                        marginBottom: "0.75rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      <p style={{ margin: "0 0 0.5rem 0", color: "#b91c1c" }}>
                        Previous notice approval result uncertain. Do not repeat as a new request. Check original command first.
                      </p>
                      <button
                        type="button"
                        className="cg19-btn-reset"
                        disabled={busy}
                        onClick={() => void checkOriginalDecision()}
                      >
                        Check original notice command
                      </button>
                    </div>
                  )}

                  <div className="cg19-input-group" style={{ maxWidth: "340px", marginBottom: "0.85rem" }}>
                    <label htmlFor="confirm-pass" style={{ color: "#7f1d1d" }}>
                      Current Password
                    </label>
                    <input
                      id="confirm-pass"
                      type="password"
                      className="cg19-input"
                      minLength={8}
                      maxLength={1024}
                      autoComplete="current-password"
                      value={currentPassword}
                      placeholder="Enter administrator password..."
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="cg19-btn-faq-publish"
                      style={{
                        background: review.action === "APPROVE" ? "#10b981" : "#dc2626",
                        borderColor: review.action === "APPROVE" ? "#059669" : "#b91c1c",
                      }}
                      disabled={busy || unknown || currentPassword.length < 8}
                      onClick={() => void decide()}
                    >
                      Confirm {review.action.toLowerCase()}
                    </button>
                    <button
                      type="button"
                      className="cg19-btn-reset"
                      disabled={busy || unknown}
                      onClick={() => {
                        setReview(null);
                        setReviewKey("");
                        setCurrentPassword("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side Column: Quick Actions & Delivery Summary (Matching Screenshot 2) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Quick Actions Card */}
              <div className="cg19-recent-card" style={{ padding: "1.1rem" }}>
                <h4
                  className="font-slab"
                  style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.85rem 0", color: "#1e293b" }}
                >
                  Quick Actions
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.65rem",
                  }}
                >
                  {/* 1. Create Notice */}
                  <button
                    type="button"
                    className="cg19-qa-btn"
                    onClick={() => setComposerOpen(true)}
                  >
                    <div className="cg19-qa-icon" style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
                      <PlusCircle className="w-4 h-4" />
                    </div>
                    <span className="cg19-qa-label">Create Notice</span>
                  </button>

                  {/* 2. Send Notice */}
                  <button
                    type="button"
                    className="cg19-qa-btn"
                    onClick={() => setComposerOpen(true)}
                  >
                    <div className="cg19-qa-icon" style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                      <Send className="w-4 h-4" />
                    </div>
                    <span className="cg19-qa-label">Send Notice</span>
                  </button>

                  {/* 3. Schedule Notice */}
                  <button
                    type="button"
                    className="cg19-qa-btn"
                    onClick={() => setComposerOpen(true)}
                  >
                    <div className="cg19-qa-icon" style={{ background: "#f0fdfa", color: "#0d9488", border: "1px solid #99f6e4" }}>
                      <Calendar className="w-4 h-4" />
                    </div>
                    <span className="cg19-qa-label">Schedule</span>
                  </button>

                  {/* 4. Templates */}
                  <button
                    type="button"
                    className="cg19-qa-btn"
                    onClick={() => {
                      setTab("EMAIL_TEMPLATES");
                      void loadEmailReferences();
                    }}
                  >
                    <div className="cg19-qa-icon" style={{ background: "#faf5ff", color: "#9333ea", border: "1px solid #e9d5ff" }}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="cg19-qa-label">Templates</span>
                  </button>

                  {/* 5. Live Broadcasts */}
                  <button
                    type="button"
                    className="cg19-qa-btn"
                    onClick={() => setStatusFilter("ACTIVE")}
                  >
                    <div className="cg19-qa-icon" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <span className="cg19-qa-label">Live Notices</span>
                  </button>

                  {/* 6. Sync Data */}
                  <button
                    type="button"
                    className="cg19-qa-btn"
                    onClick={() => void reload()}
                  >
                    <div className="cg19-qa-icon" style={{ background: "#fefce8", color: "#ca8a04", border: "1px solid #fef08a" }}>
                      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </div>
                    <span className="cg19-qa-label">Sync Data</span>
                  </button>
                </div>
              </div>

              {/* Delivery Summary Card */}
              <div className="cg19-recent-card">
                <h4
                  className="font-slab"
                  style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#1e293b" }}
                >
                  Delivery Summary
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#64748b" }}>In-App Delivery:</span>
                    <strong style={{ color: "#16a34a" }}>Operational</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#64748b" }}>Email Channel:</span>
                    <span style={{ color: providers?.channels.find((c) => c.channel === "EMAIL")?.configured ? "#16a34a" : "#ea580c", fontSize: "0.75rem", fontWeight: 600 }}>
                      {providers?.channels.find((c) => c.channel === "EMAIL")?.configured ? "Configured" : "Simulated / Off"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                    <span style={{ color: "#64748b" }}>SMS Channel:</span>
                    <span style={{ color: providers?.channels.find((c) => c.channel === "SMS")?.configured ? "#16a34a" : "#ea580c", fontSize: "0.75rem", fontWeight: 600 }}>
                      {providers?.channels.find((c) => c.channel === "SMS")?.configured ? "Configured" : "Simulated / Off"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: MY NOTIFICATIONS (INBOX) */}
      {tab === "INBOX" && mayRead && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Verified Phone Section */}
          <div className="cg19-filter-panel">
            <h3 className="font-slab" style={{ margin: "0 0 0.75rem 0", fontSize: "1.1rem", color: "#1e293b" }}>
              My Verified Mobile Contact
            </h3>
            {!phoneProof ? (
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                Mobile verification status unavailable.
              </p>
            ) : phoneProof.verified ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="cg19-status-pill open">
                  Verified Mobile: {phoneProof.maskedContact}
                </span>
                <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                  SMS delivery still requires purpose-specific consent.
                </small>
              </div>
            ) : !phoneProof.hasNumber ? (
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>
                No mobile number is recorded in your Foundation account. The account owner must record it first.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ margin: 0, color: "#475569", fontSize: "0.85rem" }}>
                  Recorded mobile: <strong>{phoneProof.maskedContact}</strong> (not verified).
                </p>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="cg19-btn-reset"
                    disabled={busy || !phoneProof.providerConfigured}
                    onClick={() => void startPhoneProof()}
                  >
                    Request SMS Verification Code
                  </button>
                  <input
                    className="cg19-input"
                    style={{ width: "160px" }}
                    placeholder="Enter code..."
                    value={phoneCode}
                    inputMode="numeric"
                    maxLength={10}
                    disabled={busy}
                    onChange={(e) => setPhoneCode(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                  <button
                    type="button"
                    className="cg19-btn-apply"
                    disabled={busy || phoneCode.length < 4}
                    onClick={() => void confirmPhoneProof()}
                  >
                    Verify Code
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inbox Notifications Table Card */}
          <div className="cg19-table-card">
            <div className="cg19-tab-header">
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b" }}>
                My Notifications ({inbox.length})
              </span>
            </div>

            {!inbox.length ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#64748b" }}>
                <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p style={{ margin: 0, fontSize: "0.875rem" }}>No notifications for your current account.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem" }}>
                {inbox.map((item) => (
                  <article
                    key={item.notificationRef}
                    style={{
                      background: item.read ? "#ffffff" : "#f0fdf4",
                      border: item.read ? "1px solid #e2e8f0" : "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "0.85rem 1rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#1e293b" }}>{item.title}</h4>
                        {!item.read && <span className="cg19-status-pill open">New</span>}
                      </div>
                      <p style={{ margin: "0.3rem 0 0.5rem 0", color: "#475569", fontSize: "0.85rem", lineHeight: 1.5 }}>
                        {item.body}
                      </p>
                      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.75rem", color: "#94a3b8" }}>
                        <span className={channelBadgeClass(item.channel)}>{item.channel}</span>
                        <span>{item.status.replaceAll("_", " ")}</span>
                        <span>{new Date(item.receivedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {!item.read && (
                      <button
                        type="button"
                        className="cg19-btn-reset"
                        style={{ fontSize: "0.78rem", padding: "0.3rem 0.65rem", flexShrink: 0 }}
                        disabled={busy}
                        onClick={() => void markRead(item.notificationRef)}
                      >
                        Mark as read
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CLIENT EMAIL REFERENCE TEMPLATES (52) */}
      {tab === "EMAIL_TEMPLATES" && mayManage && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="cg19-filter-panel">
            <h3 className="font-slab" style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem", color: "#1e293b" }}>
              Client Transactional Email Templates (52)
            </h3>
            <p style={{ margin: "0 0 1rem 0", color: "#64748b", fontSize: "0.825rem", lineHeight: 1.5 }}>
              These are the client-approved reference words and attachment requirements. Importing creates{" "}
              <strong>disabled source drafts only</strong>. They do not send email or create unverified records.
            </p>

            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              <button
                type="button"
                className="cg19-btn-apply"
                disabled={busy || emailLoading}
                onClick={() => void importClientDrafts()}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Import Missing References as Disabled Drafts</span>
              </button>
              <button
                type="button"
                className="cg19-btn-reset"
                disabled={busy || emailLoading}
                onClick={() => void loadEmailReferences()}
              >
                <RefreshCw className={`w-4 h-4 ${emailLoading ? "animate-spin" : ""}`} />
                <span>Refresh References</span>
              </button>
            </div>

            <div className="cg19-input-group" style={{ maxWidth: "480px" }}>
              <label htmlFor="email-search">Find a Template</label>
              <div style={{ position: "relative" }}>
                <Search
                  className="w-4 h-4 text-slate-400"
                  style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  id="email-search"
                  className="cg19-input"
                  style={{ paddingLeft: "2.25rem" }}
                  value={emailSearch}
                  maxLength={80}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  placeholder="Template ID, name or module (e.g. CG-MEM, CG-DON, CG-SUP)"
                />
              </div>
            </div>
          </div>

          <div className="cg19-table-card" style={{ padding: "1rem" }}>
            {emailLoading && (
              <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <p style={{ margin: 0, fontSize: "0.85rem" }}>Checking current template catalog...</p>
              </div>
            )}

            {!emailLoading && emailReferences.length === 0 && (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#64748b" }}>
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p style={{ margin: 0, fontSize: "0.85rem" }}>
                  Select &quot;Refresh References&quot; or &quot;Import&quot; to view the 52 client email templates.
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {emailReferences
                .filter((t) =>
                  (t.code + " " + t.title + " " + t.owner).toLowerCase().includes(emailSearch.trim().toLowerCase())
                )
                .map((t) => (
                  <details
                    key={t.code}
                    className="cg19-template-card"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <summary
                      style={{
                        padding: "0.85rem 1.15rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        listStyle: "none",
                        background: "#ffffff",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: "#eef2ff",
                            color: "#4f46e5",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "6px",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            border: "1px solid #c7d2fe",
                          }}
                        >
                          {t.code}
                        </span>
                        <strong style={{ fontSize: "0.9rem", color: "#1e293b" }}>{t.title}</strong>
                        <span
                          className={`cg19-status-pill ${t.state === "PUBLISHED" ? "open" : "waiting"}`}
                          style={{ fontSize: "0.7rem", padding: "0.15rem 0.5rem" }}
                        >
                          {t.state.replaceAll("_", " ")}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </summary>

                    <div
                      style={{
                        padding: "1.15rem",
                        borderTop: "1px solid #f1f5f9",
                        background: "#fafbfc",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.85rem",
                        fontSize: "0.825rem",
                      }}
                    >
                      {/* Meta Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "0.75rem",
                        }}
                      >
                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: "0.2rem" }}>
                            Source Trigger
                          </span>
                          <span style={{ color: "#1e293b", fontWeight: 500 }}>{t.trigger}</span>
                        </div>

                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: "0.2rem" }}>
                            Intended Recipient
                          </span>
                          <span style={{ color: "#1e293b", fontWeight: 500 }}>{t.recipient || "Verify from source"}</span>
                        </div>

                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: "0.2rem" }}>
                            Attachment Policy
                          </span>
                          <span style={{ color: "#1e293b", fontWeight: 500 }}>{t.attachmentRule}</span>
                        </div>

                        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
                          <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: "0.2rem" }}>
                            Required Dynamic Fields
                          </span>
                          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", marginTop: "0.15rem" }}>
                            {t.placeholders.length ? (
                              t.placeholders.map((p) => (
                                <span
                                  key={p}
                                  style={{
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    padding: "0.1rem 0.35rem",
                                    borderRadius: "4px",
                                    fontSize: "0.7rem",
                                    fontFamily: "monospace",
                                  }}
                                >
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "#94a3b8" }}>None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Subject Preview */}
                      <div>
                        <strong style={{ display: "block", color: "#334155", marginBottom: "0.35rem", fontSize: "0.8rem" }}>
                          Subject Preview (Placeholders Only):
                        </strong>
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "0.6rem 0.85rem",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            color: "#1e293b",
                          }}
                        >
                          {t.subject}
                        </div>
                      </div>

                      {/* Body Preview */}
                      <div>
                        <strong style={{ display: "block", color: "#334155", marginBottom: "0.35rem", fontSize: "0.8rem" }}>
                          Email Body Preview (Placeholders Only):
                        </strong>
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            padding: "0.85rem",
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                            lineHeight: 1.6,
                            color: "#1e293b",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {t.body}
                        </div>
                      </div>

                      <small style={{ color: "#94a3b8", fontSize: "0.75rem", fontStyle: "italic" }}>
                        Delivery unavailable until the source event, permission and every required approved document are verified.
                      </small>
                    </div>
                  </details>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
