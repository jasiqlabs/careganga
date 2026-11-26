"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./foundation-structure.css";
import {
  Building2,
  MapPin,
  Network,
  RefreshCw,
  Search,
  Download,
  Plus,
  Pencil,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Phone,
  FileText,
  X,
  Users,
  Layers,
  AlertCircle,
  HelpCircle,
  UserCheck,
} from "lucide-react";
import { CustomDropdown } from "../../shared/custom-dropdown";

type Profile = {
  legalName: string;
  officialContact: string;
  postalAddress: string;
  registrationRef: string | null;
  registrationAuthority: string | null;
  registrationDate: string | null;
  version: number;
  updatedAt: string;
};

type Area = {
  areaRef: string;
  level: string;
  name: string;
  parentRef: string | null;
  code: string | null;
  status: string;
  version: number;
};

type Dept = {
  departmentRef: string;
  name: string;
  kind: string;
  description: string;
  active: boolean;
  version: number;
  scope: string;
  openingDate: string | null;
  parentRef: string | null;
  geographyRef: string | null;
  headAccountRef: string | null;
  headDisplayName: string | null;
};

type DeptSummary = {
  total: number;
  active: number;
  inactive: number;
  committees: number;
};

type Officeholder = {
  value: string;
  label: string;
};

type Participant = {
  participationRef: string;
  accountRef: string;
  displayName: string | null;
  officeRole: string;
  activeUntil: string | null;
};

type Pending = {
  method: "PATCH" | "POST";
  url: string;
  action: string;
  body: Record<string, unknown>;
  requestKey: string;
};

type Tab = "profile" | "geography" | "departments";

const endpoint = "/api/foundation";

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint + path, { cache: "no-store", ...options });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (raw && typeof raw === "object" && "message" in raw && typeof raw.message === "string")
      throw Object.assign(new Error(raw.message), { status: response.status });
    throw Object.assign(new Error("The Foundation service is unavailable."), { status: response.status });
  }
  return raw as T;
}

const requestKey = () => crypto.randomUUID();

const initialProfile = {
  legalName: "",
  officialContact: "",
  postalAddress: "",
  registrationRef: "",
  registrationAuthority: "",
  registrationDate: "",
};

const levels = ["STATE", "DISTRICT", "SUBDIVISION", "BLOCK"];
const parentLevels: Record<string, string[]> = {
  STATE: [],
  DISTRICT: ["STATE"],
  SUBDIVISION: ["DISTRICT"],
  BLOCK: ["DISTRICT", "SUBDIVISION"],
};

export function FoundationStructurePanel({ actions }: { actions: string[] }) {
  const can = (permission: string) => actions.includes(permission);
  const available: Tab[] = [
    ...(can("foundation.profile.view") ? ["profile" as const] : []),
    ...(can("foundation.geography.view") ? ["geography" as const] : []),
    ...(can("foundation.departments.view") ? ["departments" as const] : []),
  ];

  const [tab, setTab] = useState<Tab>(available[0] ?? "profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState(initialProfile);
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaNextOffset, setAreaNextOffset] = useState<number | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [departmentNextOffset, setDepartmentNextOffset] = useState<number | null>(null);
  const [departmentSummary, setDepartmentSummary] = useState<DeptSummary | null>(null);
  const [departmentEditorOpen, setDepartmentEditorOpen] = useState(false);
  const departmentDialogRef = useRef<HTMLDialogElement>(null);
  const [officeholders, setOfficeholders] = useState<Officeholder[]>([]);
  const [officeholderSearch, setOfficeholderSearch] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [focusedDept, setFocusedDept] = useState<string | null>(null);

  // Geography form state
  const [areaRef, setAreaRef] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaLevel, setAreaLevel] = useState("STATE");
  const [areaParent, setAreaParent] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [areaStatus, setAreaStatus] = useState("ACTIVE");
  const [areaVersion, setAreaVersion] = useState(0);

  // Department form state
  const [deptRef, setDeptRef] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptKind, setDeptKind] = useState("DEPARTMENT");
  const [deptDescription, setDeptDescription] = useState("");
  const [deptArea, setDeptArea] = useState("");
  const [deptParent, setDeptParent] = useState("");
  const [deptHead, setDeptHead] = useState("");
  const [deptOpening, setDeptOpening] = useState("");
  const [deptActive, setDeptActive] = useState(true);
  const [deptVersion, setDeptVersion] = useState(0);

  // Participant form state
  const [participantAccount, setParticipantAccount] = useState("");
  const [participantRole, setParticipantRole] = useState("");

  // UI state
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  // Escape key handler for modals
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAudit(null);
        setDepartmentEditorOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [audit, setAudit] = useState<{ title: string; events: { action: string; version: number; recordedAt: string }[] } | null>(null);
  const [exportOffset, setExportOffset] = useState<Record<string, number>>({ AREAS: 0, DEPARTMENTS: 0 });
  const [search, setSearch] = useState("");
  const [departmentKindFilter, setDepartmentKindFilter] = useState("ALL");
  const [departmentStatusFilter, setDepartmentStatusFilter] = useState("ALL");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const work: Promise<void>[] = [];
    if (can("foundation.profile.view")) {
      work.push(
        json<{ profile: Profile | null }>("/profile")
          .then((x) => {
            setProfile(x.profile);
            setForm(
              x.profile
                ? {
                    legalName: x.profile.legalName,
                    officialContact: x.profile.officialContact,
                    postalAddress: x.profile.postalAddress,
                    registrationRef: x.profile.registrationRef ?? "",
                    registrationAuthority: x.profile.registrationAuthority ?? "",
                    registrationDate: x.profile.registrationDate ?? "",
                  }
                : initialProfile
            );
          })
          .catch((err) => {
            setProfile(null);
            setForm(initialProfile);
            throw err;
          })
      );
    }
    if (can("foundation.geography.view")) {
      work.push(
        json<{ areas: Area[]; nextOffset: number | null }>("/geography")
          .then((x) => {
            setAreas(x.areas);
            setAreaNextOffset(x.nextOffset);
          })
          .catch((err) => {
            setAreas([]);
            setAreaNextOffset(null);
            throw err;
          })
      );
    }
    if (can("foundation.departments.view")) {
      work.push(
        json<{ departments: Dept[]; summary: DeptSummary; nextOffset: number | null }>("/departments")
          .then((x) => {
            setDepartments(x.departments);
            setDepartmentSummary(x.summary);
            setDepartmentNextOffset(x.nextOffset);
          })
          .catch((err) => {
            setDepartments([]);
            setDepartmentSummary(null);
            setDepartmentNextOffset(null);
            setFocusedDept(null);
            throw err;
          })
      );
    }
    if (can("foundation.departments.assign")) {
      work.push(
        json<{ options: Officeholder[] }>("/officeholders/options")
          .then((x) => setOfficeholders(x.options))
          .catch((err) => {
            setOfficeholders([]);
            throw err;
          })
      );
    }

    const results = await Promise.allSettled(work);
    if (results.some((x) => x.status === "rejected")) {
      setError("Some Foundation information could not be verified. Try refreshing the section.");
    }
    setLoading(false);
  }, [actions.join(",")]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!focusedDept || !can("foundation.departments.view")) {
      setParticipants([]);
      return;
    }
    let active = true;
    void json<{ participants: Participant[] }>("/departments/" + encodeURIComponent(focusedDept) + "/participants")
      .then((result) => {
        if (active) setParticipants(result.participants);
      })
      .catch(() => {
        if (active) {
          setParticipants([]);
          setError("Officeholder history cannot be verified.");
        }
      });
    return () => {
      active = false;
    };
  }, [focusedDept, notice, actions.join(",")]);

  useEffect(() => {
    const dialog = departmentDialogRef.current;
    if (!dialog) return;
    if (departmentEditorOpen && !dialog.open) dialog.showModal();
    if (!departmentEditorOpen && dialog.open) dialog.close();
  }, [departmentEditorOpen]);

  const eligibleParents = useMemo(
    () => areas.filter((x) => parentLevels[areaLevel]?.includes(x.level) && x.status === "ACTIVE" && x.areaRef !== areaRef),
    [areas, areaLevel, areaRef]
  );
  const selectedDept = departments.find((x) => x.departmentRef === focusedDept);
  const visibleAreas = areas.filter((x) => x.name.toLowerCase().includes(search.toLowerCase()));
  const visibleDepartments = departments.filter(
    (x) =>
      x.name.toLowerCase().includes(search.toLowerCase()) &&
      (departmentKindFilter === "ALL" || x.kind === departmentKindFilter) &&
      (departmentStatusFilter === "ALL" || (x.active ? "ACTIVE" : "INACTIVE") === departmentStatusFilter)
  );

  async function send(write: Pending) {
    setBusy(true);
    setNotice("");
    setError("");
    setPending(write);
    try {
      await json<{ status: string }>(write.url, {
        method: write.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(write.body),
      });
      setPending(null);
      setNotice("Change confirmed.");
      if (write.action === "AREA_CREATE" || write.action === "AREA_UPDATE") resetArea();
      if (write.action === "DEPARTMENT_CREATE" || write.action === "DEPARTMENT_UPDATE") resetDepartment();
      if (write.action === "PARTICIPANT_ADD") {
        setParticipantAccount("");
        setParticipantRole("");
      }
      await reload();
    } catch (e) {
      const status = e && typeof e === "object" && "status" in e ? Number(e.status) : 503;
      setError(e instanceof Error ? e.message : "The result cannot be confirmed.");
      if (status !== 503) setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function save(method: "POST" | "PATCH", url: string, action: string, data: Record<string, unknown>) {
    if (pending || busy) return;
    const key = requestKey();
    void send({ method, url, action, requestKey: key, body: { ...data, requestKey: key } });
  }

  async function checkPending() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const x = await json<{ status: string }>(`/changes/${pending.action}/${pending.requestKey}`);
      if (x.status === "CONFIRMED") {
        setPending(null);
        setNotice("Your previous change is confirmed.");
        await reload();
      } else setNotice("Not confirmed. You may retry the same original request.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirmation is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreAreas() {
    if (areaNextOffset === null || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await json<{ areas: Area[]; nextOffset: number | null }>("/geography?offset=" + areaNextOffset);
      setAreas((previous) => {
        const prior = new Set(previous.map((x) => x.areaRef));
        return [...previous, ...next.areas.filter((x) => !prior.has(x.areaRef))];
      });
      setAreaNextOffset(next.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Additional areas could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function findEligibleOfficeholders() {
    if (busy || !can("foundation.departments.assign")) return;
    setBusy(true);
    setError("");
    try {
      const result = await json<{ options: Officeholder[] }>(
        "/officeholders/options?search=" + encodeURIComponent(officeholderSearch.trim())
      );
      setOfficeholders(result.options);
      if (result.options.length === 1) {
        setParticipantAccount(result.options[0].value);
      }
      if (result.options.length === 0) setNotice("No eligible staff account matched. Try another name.");
    } catch (e) {
      setOfficeholders([]);
      setError(e instanceof Error ? e.message : "Eligible staff accounts cannot be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMoreDepartments() {
    if (departmentNextOffset === null || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await json<{ departments: Dept[]; nextOffset: number | null }>(
        "/departments?offset=" + departmentNextOffset
      );
      setDepartments((previous) => {
        const seen = new Set(previous.map((x) => x.departmentRef));
        return [...previous, ...data.departments.filter((x) => !seen.has(x.departmentRef))];
      });
      setDepartmentNextOffset(data.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Additional departments could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function showHistory(kind: "PROFILE" | "AREA" | "DEPARTMENT" | "PARTICIPANT", ref: string, title: string) {
    setError("");
    setAudit(null);
    try {
      const result = await json<{ events: { action: string; version: number; recordedAt: string }[] }>(
        "/history/" + kind + "/" + encodeURIComponent(ref)
      );
      setAudit({ title, events: result.events });
    } catch {
      setError("This Foundation history cannot be verified.");
    }
  }

  async function downloadPage(kind: "AREAS" | "DEPARTMENTS") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await json<{ csv: string; filename: string; count: number; nextOffset: number | null }>(
        "/export?kind=" + kind + "&offset=" + exportOffset[kind]
      );
      const objectUrl = URL.createObjectURL(new Blob([data.csv], { type: "text/csv;charset=utf-8" }));
      const element = document.createElement("a");
      element.href = objectUrl;
      element.download = kind === "AREAS" ? "Foundation-areas.csv" : "Foundation-departments.csv";
      document.body.appendChild(element);
      element.click();
      element.remove();
      URL.revokeObjectURL(objectUrl);
      setExportOffset((old) => ({ ...old, [kind]: data.nextOffset ?? 0 }));
      setNotice(
        data.nextOffset === null
          ? "Exported the final page of source records."
          : "Exported one page. More verified records can be exported in the next page."
      );
    } catch {
      setError("Cannot confirm the Foundation export. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function resetArea() {
    setAreaRef(null);
    setAreaName("");
    setAreaLevel("STATE");
    setAreaParent("");
    setAreaCode("");
    setAreaStatus("ACTIVE");
    setAreaVersion(0);
  }

  function editArea(x: Area) {
    setAreaRef(x.areaRef);
    setAreaName(x.name);
    setAreaLevel(x.level);
    setAreaParent(x.parentRef ?? "");
    setAreaCode(x.code ?? "");
    setAreaStatus(x.status);
    setAreaVersion(x.version);
  }

  function resetDepartment() {
    setDeptRef(null);
    setDeptName("");
    setDeptKind("DEPARTMENT");
    setDeptDescription("");
    setDeptArea("");
    setDeptParent("");
    setDeptHead("");
    setDeptOpening("");
    setDeptActive(true);
    setDeptVersion(0);
    setDepartmentEditorOpen(false);
  }

  function editDepartment(x: Dept) {
    setDeptRef(x.departmentRef);
    setDeptName(x.name);
    setDeptKind(x.kind);
    setDeptDescription(x.description);
    setDeptArea(x.geographyRef ?? "");
    setDeptParent(x.parentRef ?? "");
    setDeptHead(x.headAccountRef ?? "");
    setDeptOpening(x.openingDate ?? "");
    setDeptActive(x.active);
    setDeptVersion(x.version);
    setFocusedDept(x.departmentRef);
    setDepartmentEditorOpen(true);
  }

  const setProfileField = (name: keyof typeof initialProfile, value: string) => {
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <div className="cg-foundation-page role-workspace">
      {/* Header */}
      <header className="cg-foundation-header topbar">
        <div className="cg-foundation-title-group">
          <h1>
            <ShieldCheck size={26} color="#2563EB" />
            Foundation Structure
          </h1>
          <p>Official profile, geography, departments and committees</p>
        </div>
        <button
          type="button"
          className="cg-btn-refresh"
          onClick={() => void reload()}
          disabled={loading || busy}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh actual records
        </button>
      </header>

      {/* Tabs Row */}
      <div className="cg-foundation-tabs toolbar" role="tablist" aria-label="Foundation structure sections">
        {available.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`cg-foundation-tab-btn ${tab === key ? "active" : ""}`}
            onClick={() => {
              setTab(key);
              setError("");
            }}
          >
            {key === "profile" && <Building2 size={16} />}
            {key === "geography" && <MapPin size={16} />}
            {key === "departments" && <Network size={16} />}
            {key === "profile" ? "Foundation Profile" : key === "geography" ? "Geography" : "Departments & Committees"}
          </button>
        ))}
      </div>

      {/* Status & Alerts */}
      {loading && (
        <div className="cg-alert-banner cg-alert-notice cg-module-loading" role="status">
          <RefreshCw size={16} className="animate-spin" />
          <span>Checking current Foundation records…</span>
        </div>
      )}
      {notice && (
        <div className="cg-alert-banner cg-alert-notice notice" role="status">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="cg-alert-banner cg-alert-error error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Pending Replay Notice */}
      {pending && (
        <div className="cg-alert-banner cg-alert-pending notice" role="status">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertCircle size={18} />
            <span>The previous save is not confirmed. Do not submit a different request yet.</span>
          </div>
          <div className="cg-alert-pending-actions">
            <button
              type="button"
              className="cg-action-btn-small primary"
              disabled={busy}
              onClick={() => void checkPending()}
            >
              Check original request
            </button>
            <button
              type="button"
              className="cg-action-btn-small"
              disabled={busy}
              onClick={() => void send(pending)}
            >
              Retry the same request
            </button>
          </div>
        </div>
      )}

      {/* History Modal / Drawer */}
      {audit && (
        <div
          className="cg-modal-backdrop"
          aria-label="Foundation change history"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAudit(null);
          }}
        >
          <div className="cg-modal-card">
            <div className="cg-modal-header">
              <h2>{audit.title} — history</h2>
              <button
                type="button"
                className="cg-modal-close-btn"
                onClick={() => setAudit(null)}
                aria-label="Close history"
              >
                <X size={18} />
              </button>
            </div>
            <div className="cg-modal-body">
              <ol className="cg-history-list">
                {audit.events.map((event, i) => (
                  <li key={event.action + "-" + event.recordedAt + "-" + i} className="cg-history-item">
                    <Clock size={16} color="#64748B" style={{ marginTop: "0.15rem", flexShrink: 0 }} />
                    <div>
                      <strong style={{ textTransform: "capitalize" }}>
                        {event.action.replaceAll("_", " ").toLowerCase()}
                      </strong>{" "}
                      · version {event.version}
                      <div style={{ fontSize: "0.75rem", color: "#64748B", marginTop: "0.15rem" }}>
                        {new Date(event.recordedAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              {audit.events.length === 0 && <p className="cg-empty-state">No recorded changes yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Foundation Profile */}
      {tab === "profile" && can("foundation.profile.view") && (
        <section className="cg-f-card role-pane">
          <div className="cg-f-card-header role-pane-heading">
            <div>
              <h2 className="cg-f-card-title">
                <Building2 size={20} color="#2563EB" />
                Official Foundation profile
              </h2>
              <p className="cg-f-card-subtitle">Private records; publication is controlled separately.</p>
            </div>
          </div>

          <form
            className="form"
            onSubmit={(event) => {
              event.preventDefault();
              save("PATCH", "/profile", "PROFILE_SAVE", {
                ...form,
                registrationRef: form.registrationRef || null,
                registrationAuthority: form.registrationAuthority || null,
                registrationDate: form.registrationDate || null,
                expectedVersion: profile?.version ?? 0,
              });
            }}
          >
            <div className="cg-profile-grid">
              <div className="cg-field-group">
                <label className="cg-field-label field">
                  <Building2 size={14} color="#64748B" />
                  Legal Foundation name
                </label>
                <div className="cg-f-input-wrap">
                  <Building2 size={16} className="cg-f-input-icon" />
                  <input
                    required
                    minLength={2}
                    maxLength={180}
                    className="cg-f-input"
                    disabled={!can("foundation.profile.manage") || busy || Boolean(pending)}
                    value={form.legalName}
                    onChange={(e) => setProfileField("legalName", e.target.value)}
                    placeholder="CareGanga Foundation"
                  />
                </div>
              </div>

              <div className="cg-field-group">
                <label className="cg-field-label field">
                  <Phone size={14} color="#64748B" />
                  Official contact
                </label>
                <div className="cg-f-input-wrap">
                  <Phone size={16} className="cg-f-input-icon" />
                  <input
                    maxLength={180}
                    className="cg-f-input"
                    disabled={!can("foundation.profile.manage") || busy || Boolean(pending)}
                    value={form.officialContact}
                    onChange={(e) => setProfileField("officialContact", e.target.value)}
                    placeholder="Contact number or official email"
                  />
                </div>
              </div>

              <div className="cg-field-group full-width">
                <label className="cg-field-label field">
                  <MapPin size={14} color="#64748B" />
                  Postal address
                </label>
                <div className="cg-f-input-wrap">
                  <MapPin size={16} className="cg-f-input-icon" style={{ top: "0.85rem" }} />
                  <textarea
                    maxLength={700}
                    className="cg-f-textarea"
                    disabled={!can("foundation.profile.manage") || busy || Boolean(pending)}
                    value={form.postalAddress}
                    onChange={(e) => setProfileField("postalAddress", e.target.value)}
                    placeholder="Registered headquarter or official address"
                  />
                </div>
              </div>

              <div className="cg-field-group">
                <label className="cg-field-label field">
                  <FileText size={14} color="#64748B" />
                  Registration reference
                </label>
                <div className="cg-f-input-wrap">
                  <FileText size={16} className="cg-f-input-icon" />
                  <input
                    maxLength={120}
                    className="cg-f-input"
                    disabled={!can("foundation.profile.manage") || busy || Boolean(pending)}
                    value={form.registrationRef}
                    onChange={(e) => setProfileField("registrationRef", e.target.value)}
                    placeholder="Trust / Society / Section 8 reference"
                  />
                </div>
              </div>

              <div className="cg-field-group">
                <label className="cg-field-label field">
                  <ShieldCheck size={14} color="#64748B" />
                  Registration authority
                </label>
                <div className="cg-f-input-wrap">
                  <ShieldCheck size={16} className="cg-f-input-icon" />
                  <input
                    maxLength={180}
                    className="cg-f-input"
                    disabled={!can("foundation.profile.manage") || busy || Boolean(pending)}
                    value={form.registrationAuthority}
                    onChange={(e) => setProfileField("registrationAuthority", e.target.value)}
                    placeholder="Issuing government authority / Registrar"
                  />
                </div>
              </div>

              <div className="cg-field-group">
                <label className="cg-field-label field">
                  <Calendar size={14} color="#64748B" />
                  Registration date
                </label>
                <div className="cg-f-input-wrap">
                  <Calendar size={16} className="cg-f-input-icon" />
                  <input
                    type="date"
                    className="cg-f-input"
                    disabled={!can("foundation.profile.manage") || busy || Boolean(pending)}
                    value={form.registrationDate}
                    onChange={(e) => setProfileField("registrationDate", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="cg-profile-actions">
              <div className="cg-profile-left-meta">
                {profile && (
                  <span>
                    Last verified update: {new Date(profile.updatedAt).toLocaleDateString()}
                  </span>
                )}
                {profile && (
                  <button
                    type="button"
                    className="cg-btn-secondary"
                    onClick={() => void showHistory("PROFILE", "self", "Foundation profile")}
                  >
                    <Clock size={15} />
                    View change history
                  </button>
                )}
              </div>

              {can("foundation.profile.manage") && (
                <button
                  type="submit"
                  className="cg-btn-primary primary"
                  disabled={busy || Boolean(pending)}
                >
                  <ShieldCheck size={16} />
                  Save official profile
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* TAB 2: Geography */}
      {tab === "geography" && can("foundation.geography.view") && (
        <section className="cg-geo-layout role-workspace">
          {/* Left Column: Areas Table */}
          <div className="cg-f-card role-table-wrap">
            <div className="cg-f-card-header role-pane-heading">
              <div>
                <h2 className="cg-f-card-title">
                  <MapPin size={20} color="#2563EB" />
                  State, district and local areas
                </h2>
                <p className="cg-f-card-subtitle">Only real Foundation geography records are listed.</p>
              </div>
            </div>

            {/* Search Input */}
            <div className="cg-filter-search-wrap">
              <Search size={16} className="cg-filter-search-icon" />
              <input
                className="cg-filter-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search areas by name..."
              />
            </div>

            {/* Table */}
            <div className="cg-table-container">
              <table className="cg-data-table role-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Level</th>
                    <th>Parent</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAreas.map((x) => (
                    <tr key={x.areaRef}>
                      <td style={{ fontWeight: 600 }}>{x.name}</td>
                      <td>
                        <span className={`cg-level-pill ${x.level.toLowerCase()}`}>
                          {x.level.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ color: "#64748B" }}>
                        {areas.find((a) => a.areaRef === x.parentRef)?.name ?? "Foundation"}
                      </td>
                      <td>
                        <span className={`cg-status-badge ${x.status.toLowerCase()}`}>
                          {x.status === "ACTIVE" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {x.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {can("foundation.geography.manage") && (
                          <button
                            type="button"
                            className="cg-action-btn-small"
                            onClick={() => editArea(x)}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="cg-action-btn-small"
                          onClick={() => void showHistory("AREA", x.areaRef, x.name)}
                        >
                          <Clock size={12} />
                          History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visibleAreas.length === 0 && (
              <p className="cg-empty-state cg-module-empty" role="status">
                No recorded areas match the loaded filter.
              </p>
            )}

            {/* Pagination & Export Buttons */}
            <div className="toolbar" style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
              {areaNextOffset !== null && (
                <button
                  type="button"
                  className="cg-btn-secondary"
                  disabled={busy}
                  onClick={() => void loadMoreAreas()}
                >
                  Load more verified areas
                </button>
              )}
              <button
                type="button"
                className="cg-btn-secondary"
                disabled={busy}
                onClick={() => void downloadPage("AREAS")}
              >
                <Download size={15} />
                Download verified areas {exportOffset.AREAS ? "(next page)" : ""}
              </button>
            </div>
          </div>

          {/* Right Column: Add / Edit Area Form */}
          {can("foundation.geography.manage") && (
            <form
              className="cg-f-card form role-pane"
              onSubmit={(e) => {
                e.preventDefault();
                const body = {
                  name: areaName,
                  level: areaLevel,
                  parentRef: areaParent || null,
                  code: areaCode || null,
                  ...(areaRef ? { status: areaStatus, expectedVersion: areaVersion } : {}),
                };
                save(
                  areaRef ? "PATCH" : "POST",
                  areaRef ? "/geography/" + areaRef : "/geography",
                  areaRef ? "AREA_UPDATE" : "AREA_CREATE",
                  body
                );
              }}
            >
              <h2 className="cg-f-card-title" style={{ marginBottom: "1.25rem" }}>
                {areaRef ? <Pencil size={18} color="#2563EB" /> : <Plus size={18} color="#2563EB" />}
                {areaRef ? "Edit area" : "Add real geography"}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="cg-field-group">
                  <CustomDropdown
                    label="Level"
                    value={areaLevel}
                    disabled={Boolean(areaRef) || busy || Boolean(pending)}
                    onChange={(val) => {
                      setAreaLevel(val);
                      setAreaParent("");
                    }}
                    options={levels.map((l) => ({
                      value: l,
                      label: l.toLowerCase(),
                    }))}
                  />
                </div>

                <div className="cg-field-group">
                  <label className="cg-field-label field">Area name</label>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    className="cg-f-input no-icon"
                    value={areaName}
                    onChange={(e) => setAreaName(e.target.value)}
                    placeholder="Enter area name"
                    disabled={busy || Boolean(pending)}
                  />
                </div>

                {areaLevel !== "STATE" && (
                  <div className="cg-field-group">
                    <CustomDropdown
                      label="Parent location"
                      value={areaParent}
                      disabled={busy || Boolean(pending)}
                      placeholder="Choose existing parent"
                      onChange={(val) => setAreaParent(val)}
                      options={eligibleParents.map((a) => ({
                        value: a.areaRef,
                        label: `${a.name} · ${a.level.toLowerCase()}`,
                      }))}
                    />
                  </div>
                )}

                <div className="cg-field-group">
                  <label className="cg-field-label field">Local code (optional)</label>
                  <input
                    maxLength={24}
                    className="cg-f-input no-icon"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    placeholder="e.g. DL, UP, BKP"
                    disabled={busy || Boolean(pending)}
                  />
                </div>

                {areaRef && (
                  <div className="cg-field-group">
                    <CustomDropdown
                      label="Status"
                      value={areaStatus}
                      disabled={busy || Boolean(pending)}
                      onChange={(val) => setAreaStatus(val)}
                      options={[
                        { value: "ACTIVE", label: "Active" },
                        { value: "INACTIVE", label: "Inactive" },
                      ]}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }} className="toolbar">
                  <button
                    type="submit"
                    className="cg-btn-primary primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={busy || Boolean(pending)}
                  >
                    {areaRef ? "Save changes" : "Add area"}
                  </button>
                  {areaRef && (
                    <button
                      type="button"
                      className="cg-btn-secondary"
                      onClick={resetArea}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </section>
      )}

      {/* TAB 3: Departments & Committees */}
      {tab === "departments" && can("foundation.departments.view") && (
        <section className="role-workspace" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="cg-f-card role-table-wrap">
            <div className="cg-f-card-header role-pane-heading">
              <div>
                <h2 className="cg-f-card-title">
                  <Network size={20} color="#2563EB" />
                  Foundation departments & committees
                </h2>
                <p className="cg-f-card-subtitle">
                  Foundation-wide records only; branch management belongs to a later stage.
                </p>
              </div>
              {can("foundation.departments.manage") && (
                <button
                  type="button"
                  className="cg-btn-primary"
                  onClick={() => {
                    resetDepartment();
                    setDepartmentEditorOpen(true);
                  }}
                >
                  <Plus size={16} />
                  Add department / committee
                </button>
              )}
            </div>

            {/* 4 KPI Metric Cards */}
            {departmentSummary && (
              <div className="cg-dept-kpi-row kpi-grid foundation-overview" aria-label="Foundation department overview">
                <div className="cg-dept-kpi-card kpi">
                  <div className="cg-dept-kpi-icon blue">
                    <Layers size={22} />
                  </div>
                  <div className="cg-dept-kpi-info">
                    <span className="cg-dept-kpi-label">Total records</span>
                    <strong className="cg-dept-kpi-value">{departmentSummary.total}</strong>
                  </div>
                </div>

                <div className="cg-dept-kpi-card kpi">
                  <div className="cg-dept-kpi-icon green">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="cg-dept-kpi-info">
                    <span className="cg-dept-kpi-label">Active</span>
                    <strong className="cg-dept-kpi-value">{departmentSummary.active}</strong>
                  </div>
                </div>

                <div className="cg-dept-kpi-card kpi">
                  <div className="cg-dept-kpi-icon amber">
                    <XCircle size={22} />
                  </div>
                  <div className="cg-dept-kpi-info">
                    <span className="cg-dept-kpi-label">Inactive</span>
                    <strong className="cg-dept-kpi-value">{departmentSummary.inactive}</strong>
                  </div>
                </div>

                <div className="cg-dept-kpi-card kpi">
                  <div className="cg-dept-kpi-icon purple">
                    <Users size={22} />
                  </div>
                  <div className="cg-dept-kpi-info">
                    <span className="cg-dept-kpi-label">Committees</span>
                    <strong className="cg-dept-kpi-value">{departmentSummary.committees}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Search and Filters Bar */}
            <div className="cg-filter-bar">
              <div className="cg-filter-search-wrap">
                <Search size={16} className="cg-filter-search-icon" />
                <input
                  className="cg-filter-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search loaded departments..."
                />
              </div>

              <div className="cg-filter-dropdown-group">
                <div className="cg-filter-dropdown-wrap">
                  <CustomDropdown
                    value={departmentKindFilter}
                    onChange={(val) => setDepartmentKindFilter(val)}
                    options={[
                      { value: "ALL", label: "All types" },
                      { value: "DEPARTMENT", label: "Departments" },
                      { value: "COMMITTEE", label: "Committees" },
                    ]}
                  />
                </div>

                <div className="cg-filter-dropdown-wrap">
                  <CustomDropdown
                    value={departmentStatusFilter}
                    onChange={(val) => setDepartmentStatusFilter(val)}
                    options={[
                      { value: "ALL", label: "All statuses" },
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="cg-table-container">
              <table className="cg-data-table role-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Head</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDepartments.map((x) => (
                    <tr key={x.departmentRef}>
                      <td style={{ fontWeight: 600 }}>{x.name}</td>
                      <td>
                        <span
                          className={`cg-level-pill ${
                            x.kind === "COMMITTEE" ? "state" : "district"
                          }`}
                        >
                          {x.kind.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ color: "#475569" }}>
                        {x.headDisplayName ??
                          (x.headAccountRef ? "Previously assigned account" : "Unassigned")}
                      </td>
                      <td>
                        <span
                          className={`cg-status-badge ${
                            x.active ? "active" : "inactive"
                          }`}
                        >
                          {x.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                          {x.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="cg-action-btn-small primary"
                          onClick={() => setFocusedDept(x.departmentRef)}
                        >
                          <UserCheck size={12} />
                          Officeholders
                        </button>
                        {can("foundation.departments.manage") && (
                          <button
                            type="button"
                            className="cg-action-btn-small"
                            onClick={() => editDepartment(x)}
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="cg-action-btn-small"
                          onClick={() => void showHistory("DEPARTMENT", x.departmentRef, x.name)}
                        >
                          <Clock size={12} />
                          History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visibleDepartments.length === 0 && (
              <p className="cg-empty-state cg-module-empty" role="status">
                No recorded departments match the loaded filter.
              </p>
            )}

            {/* Pagination & Export Buttons */}
            <div className="toolbar" style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
              {departmentNextOffset !== null && (
                <button
                  type="button"
                  className="cg-btn-secondary"
                  disabled={busy}
                  onClick={() => void loadMoreDepartments()}
                >
                  Load more verified departments
                </button>
              )}
              <button
                type="button"
                className="cg-btn-secondary"
                disabled={busy}
                onClick={() => void downloadPage("DEPARTMENTS")}
              >
                <Download size={15} />
                Download verified departments {exportOffset.DEPARTMENTS ? "(next page)" : ""}
              </button>
            </div>
          </div>

          {/* Department Editor Modal / Dialog */}
          {can("foundation.departments.manage") && (
            <dialog
              ref={departmentDialogRef}
              className="role-drawer foundation-department-dialog"
              aria-labelledby="foundation-department-editor-title"
              onCancel={(e) => {
                if (busy || pending) e.preventDefault();
              }}
              onClose={() => resetDepartment()}
            >
              <form
                className="cg-dialog-inner form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const existing = departments.find((x) => x.departmentRef === deptRef);
                  const body = {
                    name: deptName,
                    kind: deptKind,
                    description: deptDescription,
                    openingDate: deptOpening || null,
                    geographyRef: deptArea || null,
                    parentRef: deptParent || null,
                    headAccountRef: can("foundation.departments.assign")
                      ? deptHead || null
                      : existing?.headAccountRef ?? null,
                    ...(deptRef ? { expectedVersion: deptVersion, active: deptActive } : {}),
                  };
                  save(
                    deptRef ? "PATCH" : "POST",
                    deptRef ? "/departments/" + deptRef : "/departments",
                    deptRef ? "DEPARTMENT_UPDATE" : "DEPARTMENT_CREATE",
                    body
                  );
                }}
              >
                <div className="cg-dialog-header">
                  <h2 id="foundation-department-editor-title">
                    {deptRef ? "Edit Foundation record" : "Add Foundation department / committee"}
                  </h2>
                  <button
                    type="button"
                    className="cg-modal-close-btn"
                    onClick={resetDepartment}
                    disabled={busy || Boolean(pending)}
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="cg-field-group">
                    <CustomDropdown
                      label="Record type"
                      value={deptKind}
                      disabled={busy || Boolean(pending)}
                      onChange={(val) => setDeptKind(val)}
                      options={[
                        { value: "DEPARTMENT", label: "Department" },
                        { value: "COMMITTEE", label: "Committee" },
                      ]}
                    />
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label field">Name</label>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      className="cg-f-input no-icon"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="Department or committee name"
                      disabled={busy || Boolean(pending)}
                    />
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label field">Description</label>
                    <textarea
                      value={deptDescription}
                      maxLength={800}
                      className="cg-f-textarea no-icon"
                      onChange={(e) => setDeptDescription(e.target.value)}
                      placeholder="Brief charter or purpose description"
                      disabled={busy || Boolean(pending)}
                    />
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label field">Opening date</label>
                    <input
                      type="date"
                      className="cg-f-input no-icon"
                      value={deptOpening}
                      onChange={(e) => setDeptOpening(e.target.value)}
                      disabled={busy || Boolean(pending)}
                    />
                  </div>

                  {can("foundation.geography.view") && (
                    <div className="cg-field-group">
                      <CustomDropdown
                        label="Foundation area (optional)"
                        value={deptArea}
                        disabled={busy || Boolean(pending)}
                        placeholder="No specific area"
                        onChange={(val) => setDeptArea(val)}
                        options={[
                          { value: "", label: "No specific area" },
                          ...areas
                            .filter((x) => x.status === "ACTIVE")
                            .map((x) => ({
                              value: x.areaRef,
                              label: `${x.name} · ${x.level.toLowerCase()}`,
                            })),
                        ]}
                      />
                    </div>
                  )}

                  <div className="cg-field-group">
                    <CustomDropdown
                      label="Parent department (optional)"
                      value={deptParent}
                      disabled={busy || Boolean(pending)}
                      placeholder="Foundation top level"
                      onChange={(val) => setDeptParent(val)}
                      options={[
                        { value: "", label: "Foundation top level" },
                        ...departments
                          .filter((x) => x.active && x.departmentRef !== deptRef)
                          .map((x) => ({
                            value: x.departmentRef,
                            label: x.name,
                          })),
                      ]}
                    />
                  </div>

                  {can("foundation.departments.assign") && (
                    <>
                      <div className="cg-field-group">
                        <label className="cg-field-label field">Find eligible staff by name</label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            value={officeholderSearch}
                            maxLength={80}
                            className="cg-f-input no-icon"
                            onChange={(e) => setOfficeholderSearch(e.target.value)}
                            placeholder="Type staff member name"
                            disabled={busy || Boolean(pending)}
                          />
                          <button
                            type="button"
                            className="cg-btn-secondary"
                            disabled={busy || Boolean(pending)}
                            onClick={() => void findEligibleOfficeholders()}
                          >
                            <Search size={14} />
                            Search
                          </button>
                        </div>
                      </div>

                      <div className="cg-field-group">
                        <CustomDropdown
                          label="Head officeholder (optional)"
                          value={deptHead}
                          disabled={busy || Boolean(pending)}
                          placeholder="Unassigned"
                          onChange={(val) => setDeptHead(val)}
                          options={[
                            { value: "", label: "Unassigned" },
                            ...(deptHead && !officeholders.some((x) => x.value === deptHead)
                              ? [
                                  {
                                    value: deptHead,
                                    label:
                                      departments.find((x) => x.departmentRef === deptRef)?.headDisplayName ??
                                      "Previously assigned account",
                                  },
                                ]
                              : []),
                            ...officeholders.map((x) => ({
                              value: x.value,
                              label: x.label,
                            })),
                          ]}
                        />
                      </div>
                    </>
                  )}

                  {deptRef && (
                    <div className="cg-field-group">
                      <CustomDropdown
                        label="Status"
                        value={deptActive ? "ACTIVE" : "INACTIVE"}
                        disabled={busy || Boolean(pending)}
                        onChange={(val) => setDeptActive(val === "ACTIVE")}
                        options={[
                          { value: "ACTIVE", label: "Active" },
                          { value: "INACTIVE", label: "Inactive" },
                        ]}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }} className="toolbar">
                    <button
                      type="submit"
                      className="cg-btn-primary primary"
                      style={{ flex: 1, justifyContent: "center" }}
                      disabled={busy || Boolean(pending)}
                    >
                      {deptRef ? "Save department" : "Add department / committee"}
                    </button>
                    <button
                      type="button"
                      className="cg-btn-secondary"
                      onClick={resetDepartment}
                      disabled={busy || Boolean(pending)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </dialog>
          )}

          {/* Focused Department Officeholders Drawer/Section */}
          {focusedDept && selectedDept && (
            <section className="cg-f-card role-pane">
              <div className="cg-f-card-header">
                <h2 className="cg-f-card-title">
                  <UserCheck size={20} color="#2563EB" />
                  Officeholders — {selectedDept.name}
                </h2>
                <button
                  type="button"
                  className="cg-modal-close-btn"
                  onClick={() => setFocusedDept(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {participants.map((p) => (
                  <div
                    key={p.participationRef}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1E293B" }}>
                        {p.displayName ?? "Previously assigned account"}
                      </strong>{" "}
                      — <span style={{ color: "#475569" }}>{p.officeRole}</span>
                      <span
                        className={`cg-status-badge ${
                          p.activeUntil ? "inactive" : "active"
                        }`}
                        style={{ marginLeft: "0.5rem" }}
                      >
                        {p.activeUntil ? "former" : "active"}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {!p.activeUntil && can("foundation.departments.assign") && (
                        <button
                          type="button"
                          className="cg-action-btn-small"
                          disabled={busy || Boolean(pending)}
                          onClick={() =>
                            save(
                              "POST",
                              "/departments/" + focusedDept + "/participants/" + p.participationRef + "/end",
                              "PARTICIPANT_END",
                              {}
                            )
                          }
                        >
                          End assignment
                        </button>
                      )}
                      <button
                        type="button"
                        className="cg-action-btn-small"
                        onClick={() =>
                          void showHistory("PARTICIPANT", p.participationRef, "Officeholder assignment")
                        }
                      >
                        <Clock size={12} />
                        History
                      </button>
                    </div>
                  </div>
                ))}

                {participants.length === 0 && (
                  <p className="cg-empty-state" style={{ padding: "1rem" }}>
                    No officeholders have been recorded.
                  </p>
                )}
              </div>

              {/* Assign New Officeholder Form */}
              {can("foundation.departments.assign") && selectedDept.active && (
                <form
                  className="form"
                  style={{
                    paddingTop: "1.25rem",
                    borderTop: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!participantAccount) {
                      setError("Please select a staff member from the eligible accounts list.");
                      return;
                    }
                    if (!participantRole.trim()) {
                      setError("Please enter or select a responsibility (e.g. Chairperson, Secretary).");
                      return;
                    }
                    save("POST", "/departments/" + focusedDept + "/participants", "PARTICIPANT_ADD", {
                      accountRef: participantAccount,
                      officeRole: participantRole.trim(),
                    });
                  }}
                >
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "#1E293B" }}>
                    Assign new officeholder
                  </h3>

                  <div className="cg-field-group">
                    <label className="cg-field-label field">Step 1 · Find staff by name</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        maxLength={80}
                        className="cg-f-input no-icon"
                        value={officeholderSearch}
                        onChange={(e) => setOfficeholderSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void findEligibleOfficeholders();
                          }
                        }}
                        placeholder="Type staff name and press Search"
                        disabled={busy || Boolean(pending)}
                      />
                      <button
                        type="button"
                        className="cg-btn-secondary"
                        disabled={busy || Boolean(pending)}
                        onClick={() => void findEligibleOfficeholders()}
                      >
                        <Search size={14} />
                        Search
                      </button>
                    </div>
                  </div>

                  <div className="cg-field-group">
                    <CustomDropdown
                      label="Select staff account"
                      value={participantAccount}
                      placeholder="Choose staff account"
                      onChange={(val) => setParticipantAccount(val)}
                      options={officeholders.map((a) => ({
                        value: a.value,
                        label: a.label,
                      }))}
                    />
                  </div>

                  <div className="cg-field-group">
                    <label className="cg-field-label field">Step 2 · Responsibility / Role</label>
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      className="cg-f-input no-icon"
                      value={participantRole}
                      onChange={(e) => setParticipantRole(e.target.value)}
                      placeholder="e.g. Chairperson, Secretary, Coordinator..."
                    />
                    {/* Quick Role Suggestions */}
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                      {["Chairperson", "Secretary", "Coordinator", "Head", "Member"].map((role) => (
                        <button
                          key={role}
                          type="button"
                          className="cg-action-btn-small"
                          style={{
                            background: participantRole === role ? "#EEF2FF" : "#F8FAFC",
                            borderColor: participantRole === role ? "#4F46E5" : "#CBD5E1",
                            color: participantRole === role ? "#4F46E5" : "#475569",
                            fontWeight: participantRole === role ? 700 : 500,
                          }}
                          onClick={() => setParticipantRole(role)}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="cg-btn-primary primary"
                    style={{ alignSelf: "flex-start" }}
                    disabled={busy || Boolean(pending)}
                  >
                    <UserCheck size={16} />
                    Assign officeholder
                  </button>
                </form>
              )}
            </section>
          )}
        </section>
      )}
    </div>
  );
}
