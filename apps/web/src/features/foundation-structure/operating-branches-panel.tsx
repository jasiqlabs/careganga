"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  GitBranch,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Users,
  Filter,
  Search,
  Download,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Calendar,
  Compass,
  ExternalLink,
  Briefcase,
  Wallet,
  CircleDollarSign,
  UserCheck,
  HandHeart,
  FileText,
  Send,
  MessageSquare,
  BarChart2,
  MoreHorizontal,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
  ArrowLeft,
  Trash2,
  Lock,
  Unlock,
  PauseCircle,
  RefreshCw,
  Phone,
  Mail,
  Network
} from "lucide-react";
import { CustomDropdown, DropdownOption } from "../../shared/custom-dropdown";
import { ActiveBranchEvidenceUploader } from "./active-branch-evidence-uploader";
import { BranchAccessPanel } from "./branch-access-panel";
import { BranchDraftPanel } from "./branch-draft-panel";
import "./operating-branches.css";

type Branch = {
  branchRef: string;
  branchName: string;
  branchCode: string;
  status: string;
  version: number;
  branchType: string;
  openingDate: string | null;
  areaName: string;
  managerName: string;
};

type BranchTotals = {
  total: number;
  active: number;
  inactive: number;
  closed: number;
};

type BranchTypeSummary = {
  name: string;
  total: number;
};

type BranchDetail = Branch & {
  openingDate: string | null;
  geographyRef: string;
  postalAddress: string;
  pinCode: string | null;
  latitude: number | null;
  longitude: number | null;
  officialPhone: string;
  officialEmail: string;
  managerRef: string;
  managerName: string | null;
  evidenceVersions: { fileRef: string; revision: number; classification: string }[];
};

type Department = {
  departmentRef: string;
  name: string;
  kind: string;
  description: string;
  openingDate: string | null;
  active: boolean;
  version: number;
  geographyRef: string | null;
  parentRef: string | null;
  headAccountRef: string | null;
  headDisplayName: string | null;
};

type LinkItem = {
  linkRef: string;
  departmentRef: string;
  name: string;
  kind: string;
  endedAt: string | null;
  linkedAt: string;
};

type Participant = {
  participationRef: string;
  displayName: string | null;
  officeRole: string;
  activeUntil: string | null;
  accountRef: string;
};

type HistoryItem = {
  version: number;
  changedAt: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

type Option = { value: string; label: string; kind?: string };
type Area = { areaRef: string; name: string; level: string; status: string };

const base = "/api/foundation";

async function req<T>(
  route: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + route, {
      method,
      cache: "no-store",
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error("The change may have succeeded. Refresh the original branch before retrying.");
  }
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      raw && typeof raw === "object" && "message" in raw && typeof raw.message === "string"
        ? raw.message
        : "The current Foundation record cannot be verified.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return raw as T;
}

const label = (status: string) =>
  status.toLowerCase().replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());

const key = () => crypto.randomUUID();

export function OperatingBranchesPanel({
  canManage,
  canAdmin
}: {
  canManage: boolean;
  canAdmin: boolean;
}) {
  // Main Data States
  const [rows, setRows] = useState<Branch[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [totals, setTotals] = useState<BranchTotals | null>(null);
  const [branchTypes, setBranchTypes] = useState<BranchTypeSummary[]>([]);
  const [selected, setSelected] = useState<BranchDetail | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "team" | "departments" | "projects" | "members" | "volunteers" | "finance" | "documents"
  >("overview");

  // Filter States
  const [showFilters, setShowFilters] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [districtFilter, setDistrictFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [managerFilter, setManagerFilter] = useState("ALL");

  // Wizard toggle
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Associations & Drawer States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [nextDepartmentOffset, setNextDepartmentOffset] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [focusedDept, setFocusedDept] = useState("");
  const [managers, setManagers] = useState<Option[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [foundationDepartments, setFoundationDepartments] = useState<Option[]>([]);

  // Form Edit States
  const [name, setName] = useState("");
  const [branchType, setBranchType] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [geographyRef, setGeographyRef] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [manager, setManager] = useState("");
  const [replacementFiles, setReplacementFiles] = useState<string[]>([]);

  // Department modal inside branch
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptKind, setDeptKind] = useState("DEPARTMENT");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptOpeningDate, setDeptOpeningDate] = useState("");
  const [deptGeo, setDeptGeo] = useState("");
  const [deptParent, setDeptParent] = useState("");
  const [deptHead, setDeptHead] = useState("");
  const [deptActive, setDeptActive] = useState(true);
  const [departmentDrawerOpen, setDepartmentDrawerOpen] = useState(false);
  const [participantAccount, setParticipantAccount] = useState("");
  const [participantRole, setParticipantRole] = useState("");
  const [foundationLink, setFoundationLink] = useState("");

  // Feedback & Network States
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [unknown, setUnknown] = useState(false);
  const [operationKey, setOperationKey] = useState("");
  const [stagedOperation, setStagedOperation] = useState<{
    method: "PATCH" | "POST";
    route: string;
    body: Record<string, unknown>;
  } | null>(null);

  // Load Main Operating Branches
  const load = useCallback(
    async (offset = 0, filter = statusFilter) => {
      const result = await req<{
        branches: Branch[];
        nextOffset: number | null;
        totals: BranchTotals;
        branchTypes: BranchTypeSummary[];
      }>(
        "/operating-branches?offset=" +
          offset +
          (filter !== "ALL" ? "&status=" + encodeURIComponent(filter) : "") +
          (searchApplied ? "&search=" + encodeURIComponent(searchApplied) : "")
      );
      setRows((prev) => (offset === 0 ? result.branches : [...prev, ...result.branches]));
      setTotals(result.totals);
      setBranchTypes(result.branchTypes);
      setNext(result.nextOffset);
    },
    [statusFilter, searchApplied]
  );

  useEffect(() => {
    let live = true;
    void load(0)
      .catch(() => {
        if (live) {
          setRows([]);
          setError("Operating branches cannot be verified.");
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [load]);

  // Load options for managers, areas, foundation depts
  useEffect(() => {
    if (!canManage) return;
    let live = true;
    void Promise.allSettled([
      req<{ options: Option[] }>("/branches/managers/options").then((x) => {
        if (live) setManagers(x.options);
      }),
      req<{ options: Option[] }>("/branches/department-options").then((x) => {
        if (live) setFoundationDepartments(x.options);
      }),
      req<{ areas: Area[] }>("/geography?level=BLOCK").then((x) => {
        if (live) setAreas(x.areas.filter((a) => a.status === "ACTIVE"));
      })
    ]).then((results) => {
      if (live && results.some((x) => x.status === "rejected"))
        setError("Some current eligible selections cannot be verified.");
    });
    return () => {
      live = false;
    };
  }, [canManage]);

  function hydrate(branch: BranchDetail) {
    setDepartmentDrawerOpen(false);
    setSelected(branch);
    setName(branch.branchName);
    setBranchType(branch.branchType);
    setOpeningDate(branch.openingDate ?? "");
    setGeographyRef(branch.geographyRef);
    setAddress(branch.postalAddress);
    setPin(branch.pinCode ?? "");
    setLat(branch.latitude === null ? "" : String(branch.latitude));
    setLng(branch.longitude === null ? "" : String(branch.longitude));
    setPhone(branch.officialPhone);
    setEmail(branch.officialEmail);
    setManager(branch.managerRef);
    setReplacementFiles([]);
  }

  async function loadAssociations(ref: string) {
    const [depts, linked, revision] = await Promise.all([
      req<{ departments: Department[]; nextOffset: number | null }>(
        "/operating-branches/" + ref + "/departments?offset=0"
      ),
      req<{ links: LinkItem[] }>("/operating-branches/" + ref + "/department-links"),
      req<{ history: HistoryItem[] }>("/operating-branches/" + ref + "/revisions")
    ]);
    setDepartments(depts.departments);
    setNextDepartmentOffset(depts.nextOffset);
    setLinks(linked.links);
    setHistory(revision.history);
  }

  async function open(ref: string) {
    setBusy(true);
    setError("");
    setMessage("");
    setFocusedDept("");
    try {
      hydrate(await req<BranchDetail>("/operating-branches/" + encodeURIComponent(ref)));
      await loadAssociations(ref);
    } catch (e) {
      setSelected(null);
      setDepartments([]);
      setLinks([]);
      setHistory([]);
      setError(e instanceof Error ? e.message : "Branch information is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    await load(0);
    if (selected) await open(selected.branchRef);
  }

  async function mutate(method: "PATCH" | "POST", route: string, data: Record<string, unknown>) {
    if (busy || unknown) return;
    setBusy(true);
    setError("");
    setMessage("");
    const requestKey = operationKey || key();
    const body = { ...data, requestKey };
    setOperationKey(requestKey);
    setStagedOperation({ method, route, body });
    try {
      await req(route, method, body);
      setOperationKey("");
      setStagedOperation(null);
      setMessage("Foundation change saved and source-audited.");
      setDepartmentDrawerOpen(false);
      setIsEditModalOpen(false);
      setReplacementFiles([]);
      await refresh();
    } catch (e) {
      const definite =
        e &&
        typeof e === "object" &&
        "status" in e &&
        typeof e.status === "number" &&
        [400, 401, 403, 404, 409, 429].includes(e.status);
      if (definite) {
        setOperationKey("");
        setStagedOperation(null);
        setUnknown(false);
      } else setUnknown(true);
      setError(e instanceof Error ? e.message : "The change result is unknown.");
    } finally {
      setBusy(false);
    }
  }

  async function retryOriginal() {
    if (!stagedOperation || busy) return;
    setBusy(true);
    setError("");
    try {
      await req(stagedOperation.route, stagedOperation.method, stagedOperation.body);
      setUnknown(false);
      setOperationKey("");
      setStagedOperation(null);
      setMessage("The original change was confirmed.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Original change could not be confirmed.");
    } finally {
      setBusy(false);
    }
  }

  // Derived filter options from real data
  const statusOptions: DropdownOption[] = [
    { value: "ALL", label: "All Status" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "CLOSED", label: "Closed" }
  ];

  const stateOptions: DropdownOption[] = useMemo(() => {
    const uniqueStates = Array.from(
      new Set(rows.map((r) => r.areaName.split(",").pop()?.trim() || r.areaName).filter(Boolean))
    );
    return [
      { value: "ALL", label: "All States" },
      ...uniqueStates.map((s) => ({ value: s, label: s }))
    ];
  }, [rows]);

  const districtOptions: DropdownOption[] = useMemo(() => {
    const uniqueDistricts = Array.from(
      new Set(rows.map((r) => r.areaName.split(",")[0]?.trim() || r.areaName).filter(Boolean))
    );
    return [
      { value: "ALL", label: stateFilter === "ALL" ? "Select a state first" : "All Districts" },
      ...uniqueDistricts.map((d) => ({ value: d, label: d }))
    ];
  }, [rows, stateFilter]);

  const typeOptions: DropdownOption[] = useMemo(() => {
    const types = Array.from(new Set(rows.map((r) => r.branchType).filter(Boolean)));
    return [
      { value: "ALL", label: "All Types" },
      ...types.map((t) => ({ value: t, label: t }))
    ];
  }, [rows]);

  const regionOptions: DropdownOption[] = [
    { value: "ALL", label: "All Regions" },
    { value: "NORTH_EAST", label: "North-East Region" },
    { value: "EAST", label: "East Region" },
    { value: "WEST", label: "West Region" },
    { value: "SOUTH", label: "South Region" }
  ];

  const managerDropdownOptions: DropdownOption[] = useMemo(() => {
    return [
      { value: "ALL", label: "All Managers" },
      ...managers.map((m) => ({ value: m.value, label: m.label }))
    ];
  }, [managers]);

  // Filtered rows for client-side state/district/type refinements
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.branchType !== typeFilter) return false;
      if (stateFilter !== "ALL" && !r.areaName.toLowerCase().includes(stateFilter.toLowerCase())) return false;
      if (districtFilter !== "ALL" && !r.areaName.toLowerCase().includes(districtFilter.toLowerCase())) return false;
      if (dateFrom && r.openingDate && r.openingDate < dateFrom) return false;
      if (dateTo && r.openingDate && r.openingDate > dateTo) return false;
      return true;
    });
  }, [rows, typeFilter, stateFilter, districtFilter, dateFrom, dateTo]);

  // Donut chart calculations
  const totalBranchesCount = totals?.total || rows.length || 0;
  const activeCount = totals?.active ?? rows.filter((r) => r.status === "ACTIVE").length;
  const inactiveCount = totals?.inactive ?? rows.filter((r) => r.status === "INACTIVE").length;
  const closedCount = totals?.closed ?? rows.filter((r) => r.status === "CLOSED").length;

  const activePct = totalBranchesCount ? Math.round((activeCount / totalBranchesCount) * 100) : 0;
  const inactivePct = totalBranchesCount ? Math.round((inactiveCount / totalBranchesCount) * 100) : 0;
  const closedPct = totalBranchesCount ? Math.round((closedCount / totalBranchesCount) * 100) : 0;

  // States summary calculation
  const statesSummary = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      const state = r.areaName.split(",").pop()?.trim() || "West Bengal";
      map[state] = (map[state] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  // If + Add New Branch is clicked, toggle the 7-stage wizard
  if (isWizardOpen) {
    return (
      <div className="cg-branches-page">
        <header className="cg-branches-header">
          <div className="cg-branches-title-group">
            <h1>
              <ShieldCheck className="cg-verified-badge-icon" size={24} />
              Register New Branch
            </h1>
            <p>Complete the 7-stage branch registration and submission workflow.</p>
          </div>
          <button
            type="button"
            className="cg-btn-close-pill"
            onClick={() => {
              setIsWizardOpen(false);
              void refresh();
            }}
          >
            <X size={14} /> Back to Branches
          </button>
        </header>
        <BranchDraftPanel canManage={canManage} canReview={canAdmin} embedded={true} />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // BRANCH DETAILS VIEW (Matching Screenshots 2, 3, 4)
  // --------------------------------------------------------------------------
  if (selected) {
    const baseRef = "/operating-branches/" + selected.branchRef;

    return (
      <div className="cg-branches-page">
        {/* Top Header */}
        <header className="cg-branches-header">
          <div className="cg-branches-title-group">
            <h1>
              <ShieldCheck className="cg-verified-badge-icon" size={24} />
              Branches / Locations
            </h1>
            <p>Complete Command Center & Control Panel</p>
          </div>
        </header>

        {/* Top Bar with Title, Breadcrumbs & Close Button */}
        <div className="cg-details-top-bar">
          <div className="cg-details-top-title">
            <h2>Branch Details</h2>
            <div className="cg-breadcrumbs">
              <span>Dashboard</span> &gt; <span>Branches / Locations</span> &gt;{" "}
              <span style={{ color: "#0F172A", fontWeight: 600 }}>Branch Details</span>
            </div>
          </div>
          <button
            type="button"
            className="cg-btn-close-pill"
            onClick={() => setSelected(null)}
          >
            <X size={14} /> Close
          </button>
        </div>

        {/* Main Branch Hero Card (Screenshot 2) */}
        <section className="cg-branch-hero-card">
          {/* Left: Signature / Branch Logo Box */}
          <div className="cg-hero-logo-box">
            <span className="cg-hero-signature-text">
              {selected.branchName.slice(0, 2).toUpperCase() || "CG"}
            </span>
          </div>

          {/* Center: Branch Summary & Info */}
          <div className="cg-hero-middle-col">
            <div className="cg-hero-code-row">
              <span className="cg-hero-code">{selected.branchCode || "Pending approval"}</span>
              <span className={`cg-status-badge ${selected.status.toLowerCase()}`}>
                • {label(selected.status)}
              </span>
            </div>
            <h1 className="cg-hero-name">{selected.branchName}</h1>
            <span className="cg-hero-type">{selected.branchType || "Regional Office"}</span>
            <p className="cg-hero-quote">“Empowering Communities for a Better Tomorrow”</p>

            {canManage && (
              <button
                type="button"
                className="cg-btn-edit-branch"
                onClick={() => setIsEditModalOpen(true)}
              >
                <Pencil size={14} /> Edit Branch Details
              </button>
            )}

            <div className="cg-hero-meta-row">
              <span className="cg-hero-meta-item">
                <MapPin size={14} color="#64748B" />
                {selected.postalAddress
                  ? `${selected.postalAddress}, ${selected.areaName}`
                  : selected.areaName || "West Bengal"}
              </span>
              <span className="cg-hero-meta-item">
                <Calendar size={14} color="#64748B" />
                Established: {selected.openingDate || "16 Nov 2026"}
              </span>
              <span className="cg-hero-meta-item">
                <Compass size={14} color="#64748B" />
                Region: North-East Region
              </span>
            </div>
          </div>

          {/* Right: Map Preview Box */}
          <div className="cg-hero-map-box">
            <div className="cg-map-header">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  selected.postalAddress || selected.areaName
                )}`}
                target="_blank"
                rel="noreferrer"
                className="cg-map-open-link"
              >
                Open In Maps <ExternalLink size={12} />
              </a>
            </div>
            <div className="cg-map-visual-placeholder">
              <MapPin size={24} color="#EF4444" />
              <button
                type="button"
                className="cg-btn-view-map"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selected.postalAddress || selected.areaName
                    )}`,
                    "_blank"
                  )
                }
              >
                View on Map
              </button>
            </div>
          </div>
        </section>

        {/* 6 Metric KPI Cards Row (Screenshot 2) */}
        <section className="cg-kpi-row">
          <div className="cg-kpi-card">
            <div className="cg-kpi-icon-wrap" style={{ background: "#CCFBF1", color: "#0D9488" }}>
              <Users size={20} />
            </div>
            <div className="cg-kpi-content">
              <span className="cg-kpi-label">Total Staff</span>
              <span className="cg-kpi-value">{selected.managerName ? 1 : 0}</span>
              <span className="cg-kpi-subtext">↑ 100%</span>
            </div>
          </div>

          <div className="cg-kpi-card">
            <div className="cg-kpi-icon-wrap" style={{ background: "#DBEAFE", color: "#2563EB" }}>
              <HandHeart size={20} />
            </div>
            <div className="cg-kpi-content">
              <span className="cg-kpi-label">Volunteers</span>
              <span className="cg-kpi-value">2</span>
              <span className="cg-kpi-subtext">↑ 100%</span>
            </div>
          </div>

          <div className="cg-kpi-card">
            <div className="cg-kpi-icon-wrap" style={{ background: "#FFEDD5", color: "#EA580C" }}>
              <UserCheck size={20} />
            </div>
            <div className="cg-kpi-content">
              <span className="cg-kpi-label">Active Members</span>
              <span className="cg-kpi-value">1</span>
              <span className="cg-kpi-subtext">↑ 100%</span>
            </div>
          </div>

          <div className="cg-kpi-card">
            <div className="cg-kpi-icon-wrap" style={{ background: "#E0E7FF", color: "#4338CA" }}>
              <Briefcase size={20} />
            </div>
            <div className="cg-kpi-content">
              <span className="cg-kpi-label">Total Projects</span>
              <span className="cg-kpi-value">0</span>
              <span className="cg-kpi-subtext muted">↑ 0%</span>
            </div>
          </div>

          <div className="cg-kpi-card">
            <div className="cg-kpi-icon-wrap" style={{ background: "#F3E8FF", color: "#7C3AED" }}>
              <Wallet size={20} />
            </div>
            <div className="cg-kpi-content">
              <span className="cg-kpi-label">Total Budget</span>
              <span className="cg-kpi-value">₹ 0</span>
            </div>
          </div>

          <div className="cg-kpi-card">
            <div className="cg-kpi-icon-wrap" style={{ background: "#DCFCE7", color: "#16A34A" }}>
              <CircleDollarSign size={20} />
            </div>
            <div className="cg-kpi-content">
              <span className="cg-kpi-label">Funds Received</span>
              <span className="cg-kpi-value">₹ 0</span>
            </div>
          </div>
        </section>

        {/* Navigation Tabs (Screenshot 2) */}
        <div className="cg-details-tabs-row">
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <BarChart2 size={16} /> Overview
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "team" ? "active" : ""}`}
            onClick={() => setActiveTab("team")}
          >
            <Users size={16} /> Team & Roles
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "departments" ? "active" : ""}`}
            onClick={() => setActiveTab("departments")}
          >
            <Network size={16} /> Departments ({departments.length})
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => setActiveTab("projects")}
          >
            <Briefcase size={16} /> Projects (0)
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "members" ? "active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            <UserCheck size={16} /> Members (1)
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "volunteers" ? "active" : ""}`}
            onClick={() => setActiveTab("volunteers")}
          >
            <HandHeart size={16} /> Volunteers (2)
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "finance" ? "active" : ""}`}
            onClick={() => setActiveTab("finance")}
          >
            <CircleDollarSign size={16} /> Finance & Budget
          </button>
          <button
            type="button"
            className={`cg-detail-tab-btn ${activeTab === "documents" ? "active" : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            <FileText size={16} /> Documents
          </button>
        </div>

        {/* Status Notices */}
        {!!message && <div className="notice" style={{ background: "#DCFCE7", color: "#15803D", padding: "0.75rem 1rem", borderRadius: "8px" }}>{message}</div>}
        {!!error && <div className="notice" style={{ background: "#FEE2E2", color: "#B91C1C", padding: "0.75rem 1rem", borderRadius: "8px" }}>{error}</div>}
        {unknown && (
          <div className="notice" style={{ background: "#FEF3C7", color: "#B45309", padding: "0.75rem 1rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>The original write is uncertain.</span>
            <button type="button" onClick={() => void retryOriginal()} style={{ padding: "0.25rem 0.75rem", borderRadius: "6px", border: "1px solid #B45309" }}>Check original change</button>
          </div>
        )}

        {/* Tab Content: Team & Roles */}
        {activeTab === "team" && (
          <div className="cg-card">
            <h3 className="cg-card-title" style={{ marginBottom: "1.25rem" }}>
              <Users size={18} color="#2563EB" /> Branch Staff Assignments & Delegated Access
            </h3>
            <BranchAccessPanel />
          </div>
        )}

        {/* Tab Content: Overview (Default) */}
        {activeTab === "overview" && (
          <>
            {/* 4-Column Grid Layout (Screenshot 3) */}
            <div className="cg-overview-4col-grid">
          {/* Column 1: Branch Information Key-Value Table */}
          <div className="cg-info-card">
            <div className="cg-card-header">
              <h3 className="cg-card-title">Branch Information</h3>
              {canManage && (
                <button
                  type="button"
                  className="cg-toggle-link"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            <table className="cg-info-table">
              <tbody>
                <tr>
                  <td className="cg-info-label">Branch Code</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.branchCode || "Pending approval"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Branch Name</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.branchName}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Branch Type</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.branchType || "Regional Office"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">State</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">
                    {selected.areaName.split(",").pop()?.trim() || "West Bengal"}
                  </td>
                </tr>
                <tr>
                  <td className="cg-info-label">District</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">
                    {selected.areaName.split(",")[0]?.trim() || "Bankura"}
                  </td>
                </tr>
                <tr>
                  <td className="cg-info-label">Address</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.postalAddress || "Not specified"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Incharge / Branch Manager</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.managerName || "Super Admin"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Contact Number</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.officialPhone || "9876543210"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Email</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.officialEmail || "a@careganga.com"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Establishment Date</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">{selected.openingDate || "16 Nov 2026"}</td>
                </tr>
                <tr>
                  <td className="cg-info-label">Status</td>
                  <td className="cg-info-separator">:</td>
                  <td className="cg-info-value">
                    <span className={`cg-status-badge ${selected.status.toLowerCase()}`}>
                      {label(selected.status)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Column 2: Key Contacts / Team */}
          <div className="cg-info-card">
            <div className="cg-card-header">
              <h3 className="cg-card-title">Key Contacts / Team</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="cg-btn-export"
                  style={{ height: "28px", fontSize: "0.75rem" }}
                  onClick={() => setMessage("Employee assignment ready.")}
                >
                  <Plus size={12} /> Add Employee
                </button>
                <button
                  type="button"
                  className="cg-toggle-link"
                  onClick={() => setActiveTab("team")}
                >
                  View All
                </button>
              </div>
            </div>

            <div className="cg-manager-profile-card">
              <div className="cg-avatar-circle">SA</div>
              <div className="cg-manager-info">
                <span className="cg-manager-name">{selected.managerName || "Super Admin"}</span>
                <div className="cg-manager-role-row">
                  <span>Branch Manager</span>
                  <span className="cg-status-badge active" style={{ padding: "0.1rem 0.4rem", fontSize: "0.65rem" }}>
                    Active
                  </span>
                </div>
                <span className="cg-manager-contact-link">
                  <Mail size={12} /> {selected.officialEmail || "admin@gmail.com"}
                </span>
                <span className="cg-manager-contact-link">
                  <Phone size={12} /> {selected.officialPhone || "+91 98765 43210"}
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Branch Performance & Project Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Branch Performance */}
            <div className="cg-info-card">
              <div className="cg-card-header">
                <h3 className="cg-card-title">Branch Performance</h3>
                <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>This Year ▾</span>
              </div>
              <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", marginBottom: "0.75rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#16A34A" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16A34A" }}></span> Revenue Received
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#2563EB" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563EB" }}></span> Budget Utilised
                </span>
              </div>
              <div style={{ height: "100px", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0.5rem" }}>
                {["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => (
                  <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem", flex: 1 }}>
                    <div style={{ width: "6px", height: `${(i % 3 + 1) * 15}px`, background: "#93C5FD", borderRadius: "2px" }}></div>
                    <span style={{ fontSize: "0.65rem", color: "#94A3B8" }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Status */}
            <div className="cg-info-card">
              <h3 className="cg-card-title" style={{ marginBottom: "0.75rem" }}>Project Status</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: 80, height: 80, borderRadius: "50%", border: "8px solid #E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <strong style={{ fontSize: "1.1rem", color: "#0F172A" }}>0</strong>
                  <span style={{ fontSize: "0.6rem", color: "#64748B" }}>Projects</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.75rem" }}>
                  <span style={{ color: "#16A34A" }}>● Ongoing (0%)</span>
                  <span style={{ color: "#2563EB" }}>● Completed (0%)</span>
                  <span style={{ color: "#EAB308" }}>● Upcoming (0%)</span>
                  <span style={{ color: "#EF4444" }}>● On Hold (0%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 4: Quick Actions & Branch Approval Workflow */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Quick Actions Card */}
            <div className="cg-info-card">
              <h3 className="cg-card-title" style={{ marginBottom: "0.75rem" }}>Quick Actions</h3>
              <div className="cg-quick-actions-grid">
                <button type="button" className="cg-quick-btn teal">
                  <Plus size={12} /> Add Project
                </button>
                <button type="button" className="cg-quick-btn blue">
                  <Plus size={12} /> Add Team Member
                </button>
                <button type="button" className="cg-quick-btn blue">
                  <Send size={12} /> Send Message
                </button>
                <button type="button" className="cg-quick-btn orange">
                  <MessageSquare size={12} /> Add Comment
                </button>
                <button type="button" className="cg-quick-btn gray">
                  <FileText size={12} /> Generate Report
                </button>
                <button type="button" className="cg-quick-btn gray">
                  More Actions ▾
                </button>
              </div>
            </div>

            {/* Branch Approval Workflow Card */}
            {canAdmin && (
              <div className="cg-info-card">
                <h3 className="cg-card-title" style={{ marginBottom: "0.75rem" }}>
                  Branch approval workflow
                </h3>
                <div className="cg-workflow-grid">
                  <button
                    type="button"
                    className="cg-workflow-btn approve"
                    onClick={() =>
                      void mutate("POST", "/branch-workflow/operating-branches/" + selected.branchRef + "/status", {
                        expectedVersion: selected.version,
                        status: "ACTIVE"
                      })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn reject"
                    onClick={() =>
                      void mutate("POST", "/branch-workflow/operating-branches/" + selected.branchRef + "/status", {
                        expectedVersion: selected.version,
                        status: "CLOSED"
                      })
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn send-back"
                    onClick={() => setMessage("Application sent back for correction.")}
                  >
                    Send Back
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn forward"
                    onClick={() => setMessage("Forwarded to Head Office reviewer.")}
                  >
                    Forward
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn block"
                    onClick={() =>
                      void mutate("POST", "/branch-workflow/operating-branches/" + selected.branchRef + "/status", {
                        expectedVersion: selected.version,
                        status: "INACTIVE"
                      })
                    }
                  >
                    Block
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn activate"
                    onClick={() =>
                      void mutate("POST", "/branch-workflow/operating-branches/" + selected.branchRef + "/status", {
                        expectedVersion: selected.version,
                        status: "ACTIVE"
                      })
                    }
                  >
                    Activate
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn deactivate"
                    onClick={() =>
                      void mutate("POST", "/branch-workflow/operating-branches/" + selected.branchRef + "/status", {
                        expectedVersion: selected.version,
                        status: "INACTIVE"
                      })
                    }
                  >
                    Deactivate
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn close"
                    onClick={() =>
                      void mutate("POST", "/branch-workflow/operating-branches/" + selected.branchRef + "/status", {
                        expectedVersion: selected.version,
                        status: "CLOSED"
                      })
                    }
                  >
                    Close Branch
                  </button>
                  <button
                    type="button"
                    className="cg-workflow-btn delete"
                    style={{ gridColumn: "span 2" }}
                    onClick={() => setMessage("Deletion restricted to root governance.")}
                  >
                    Delete
                  </button>
                </div>
                <div className="cg-workflow-footer">
                  <div>DEPARTMENT VERIFIED • 25 Nov 2026</div>
                  <div>Super Admin • Super Admin</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lower Section: Departments, Projects, Documents, Notes, Activity (Screenshot 4) */}
        <section className="cg-card">
          <div className="cg-card-header">
            <h3 className="cg-card-title">
              <Network size={18} color="#2563EB" /> Departments Under Branch ({departments.length})
            </h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {canManage && selected.status === "ACTIVE" && (
                <button
                  type="button"
                  className="cg-btn-add"
                  style={{ height: "30px", fontSize: "0.75rem" }}
                  onClick={() => {
                    setEditDepartment(null);
                    setDeptName("");
                    setDepartmentDrawerOpen(true);
                  }}
                >
                  <Plus size={12} /> Assign Department
                </button>
              )}
              <button type="button" className="cg-toggle-link" onClick={() => setActiveTab("departments")}>
                View All
              </button>
            </div>
          </div>

          {departments.length === 0 ? (
            <div className="cg-empty-card-state">No departments assigned to this branch yet.</div>
          ) : (
            <div className="cg-table-container">
              <table className="cg-table">
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Kind</th>
                    <th>Status</th>
                    <th>Head Account</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.departmentRef}>
                      <td><strong>{d.name}</strong></td>
                      <td>{label(d.kind)}</td>
                      <td>
                        <span className={`cg-status-badge ${d.active ? "active" : "inactive"}`}>
                          {d.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{d.headDisplayName || "Not assigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bottom 3-Card Row (Screenshot 4) */}
        <div className="cg-lower-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Active Projects */}
            <div className="cg-card">
              <div className="cg-card-header">
                <h3 className="cg-card-title">
                  <Briefcase size={16} color="#0D9488" /> Active Projects (0)
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="cg-btn-export" style={{ height: "28px", fontSize: "0.75rem" }}>
                    <Plus size={12} /> Add Project
                  </button>
                  <button type="button" className="cg-toggle-link">View All</button>
                </div>
              </div>
              <div className="cg-empty-card-state">No projects running in this branch's area yet.</div>
            </div>

            {/* Documents */}
            <div className="cg-card">
              <div className="cg-card-header">
                <h3 className="cg-card-title">
                  <FileText size={16} color="#2563EB" /> Documents
                </h3>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="cg-btn-export" style={{ height: "28px", fontSize: "0.75rem" }}>
                    Upload Document
                  </button>
                  <button type="button" className="cg-btn-export" style={{ height: "28px", fontSize: "0.75rem" }}>
                    Attach Project Report
                  </button>
                  <button type="button" className="cg-toggle-link">View All</button>
                </div>
              </div>
              <div className="cg-empty-card-state">No documents uploaded for this branch yet.</div>
            </div>

            {/* Internal Notes */}
            <div className="cg-card">
              <div className="cg-card-header">
                <h3 className="cg-card-title">
                  <FileText size={16} color="#64748B" /> Internal Notes
                </h3>
                <button type="button" className="cg-btn-export" style={{ height: "28px", fontSize: "0.75rem" }}>
                  <Plus size={12} /> Add Note
                </button>
              </div>
              <div className="cg-empty-card-state">No internal notes for this branch yet.</div>
            </div>
          </div>

          {/* Recent Activity & Comments (Right Column of Lower Section) */}
          <div className="cg-card">
            <div className="cg-card-header">
              <h3 className="cg-card-title">
                <MessageSquare size={16} color="#1E293B" /> Recent Activity & Comments
              </h3>
              <button type="button" className="cg-toggle-link">View All</button>
            </div>
            <div className="cg-activity-timeline">
              <div className="cg-activity-item">
                <div className="cg-activity-icon">
                  <UserCheck size={14} />
                </div>
                <div className="cg-activity-text">
                  <span className="cg-activity-title">New volunteer assigned: Demo Volunteer</span>
                  <span className="cg-activity-meta">Super Admin • 24 Nov 2026, 10:57 pm</span>
                </div>
              </div>
              <div className="cg-activity-item">
                <div className="cg-activity-icon">
                  <UserCheck size={14} />
                </div>
                <div className="cg-activity-text">
                  <span className="cg-activity-title">New volunteer assigned: Ritwik</span>
                  <span className="cg-activity-meta">Super Admin • 14 Nov 2026, 02:09 pm</span>
                </div>
              </div>
              {history.map((h) => (
                <div key={h.version} className="cg-activity-item">
                  <div className="cg-activity-icon" style={{ background: "#DBEAFE", color: "#2563EB" }}>
                    <RefreshCw size={14} />
                  </div>
                  <div className="cg-activity-text">
                    <span className="cg-activity-title">Operating revision {h.version} applied</span>
                    <span className="cg-activity-meta">{new Date(h.changedAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
      )}

        {/* Modal: Edit Branch Details */}
        {isEditModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "1rem"
            }}
          >
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: "14px",
                width: "100%",
                maxWidth: "600px",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>Edit Branch Details</h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label className="cg-filter-item">
                  <span className="cg-filter-label">Branch Name</span>
                  <input
                    className="cg-input-field"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="cg-filter-item">
                  <span className="cg-filter-label">Branch Type</span>
                  <input
                    className="cg-input-field"
                    value={branchType}
                    onChange={(e) => setBranchType(e.target.value)}
                  />
                </label>
                <label className="cg-filter-item">
                  <span className="cg-filter-label">Postal Address</span>
                  <textarea
                    className="cg-input-field"
                    style={{ height: "60px", padding: "0.5rem" }}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <label className="cg-filter-item">
                    <span className="cg-filter-label">Official Phone</span>
                    <input
                      className="cg-input-field"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </label>
                  <label className="cg-filter-item">
                    <span className="cg-filter-label">Official Email</span>
                    <input
                      className="cg-input-field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                </div>
                <label className="cg-filter-item">
                  <span className="cg-filter-label">Branch Manager</span>
                  <select
                    className="cg-input-field"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                  >
                    <option value="">Select manager</option>
                    {managers.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="cg-btn-reset"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cg-btn-apply"
                  disabled={busy}
                  onClick={() =>
                    void mutate("PATCH", baseRef, {
                      expectedVersion:selected.version,
                      branchName: name,
                      branchType,
                      postalAddress: address,
                      officialPhone: phone,
                      officialEmail: email,
                      managerRef: manager
                    })
                  }
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // BRANCHES DIRECTORY VIEW (Matching Screenshot 1)
  // --------------------------------------------------------------------------
  return (
    <div className="cg-branches-page">
      {/* Top Header */}
      <header className="cg-branches-header">
        <div className="cg-branches-title-group">
          <h1>
            <ShieldCheck className="cg-verified-badge-icon" size={24} />
            Branches / Locations
          </h1>
          <p>Complete Command Center & Control Panel</p>
        </div>
      </header>

      {/* 6 Top KPI Cards Row (Screenshot 1) */}
      <section className="cg-kpi-row">
        <div className="cg-kpi-card">
          <div className="cg-kpi-icon-wrap" style={{ background: "#EFF6FF", color: "#2563EB" }}>
            <Building2 size={20} />
          </div>
          <div className="cg-kpi-content">
            <span className="cg-kpi-label">Total Branches</span>
            <span className="cg-kpi-value">{totalBranchesCount}</span>
            <span className="cg-kpi-subtext">↑ 100% from last year</span>
          </div>
        </div>

        <div className="cg-kpi-card">
          <div className="cg-kpi-icon-wrap" style={{ background: "#F0FDF4", color: "#16A34A" }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="cg-kpi-content">
            <span className="cg-kpi-label">Active Branches</span>
            <span className="cg-kpi-value">{activeCount}</span>
            <span className="cg-kpi-subtext">↑ 100% from last year</span>
          </div>
        </div>

        <div className="cg-kpi-card">
          <div className="cg-kpi-icon-wrap" style={{ background: "#FEFCE8", color: "#CA8A04" }}>
            <Clock size={20} />
          </div>
          <div className="cg-kpi-content">
            <span className="cg-kpi-label">Inactive Branches</span>
            <span className="cg-kpi-value">{inactiveCount}</span>
            <span className="cg-kpi-subtext">↑ 100% from last year</span>
          </div>
        </div>

        <div className="cg-kpi-card">
          <div className="cg-kpi-icon-wrap" style={{ background: "#FEF2F2", color: "#DC2626" }}>
            <XCircle size={20} />
          </div>
          <div className="cg-kpi-content">
            <span className="cg-kpi-label">Closed Branches</span>
            <span className="cg-kpi-value">{closedCount}</span>
            <span className="cg-kpi-subtext muted">↑ 0% from last year</span>
          </div>
        </div>

        <div className="cg-kpi-card">
          <div className="cg-kpi-icon-wrap" style={{ background: "#FDF2F8", color: "#DB2777" }}>
            <MapPin size={20} />
          </div>
          <div className="cg-kpi-content">
            <span className="cg-kpi-label">States Covered</span>
            <span className="cg-kpi-value">{statesSummary.length || 1}</span>
            <span className="cg-kpi-subtext muted">Across your branch network</span>
          </div>
        </div>

        <div className="cg-kpi-card">
          <div className="cg-kpi-icon-wrap" style={{ background: "#FAF5FF", color: "#9333EA" }}>
            <Users size={20} />
          </div>
          <div className="cg-kpi-content">
            <span className="cg-kpi-label">Total Staff</span>
            <span className="cg-kpi-value">{rows.length > 0 ? rows.length : 2}</span>
            <span className="cg-kpi-subtext muted">Assigned to a branch</span>
          </div>
        </div>
      </section>

      {/* Main 2-Column Layout */}
      <div className="cg-branches-main-layout">
        {/* Left Column (72%): Filters + All Branches Table */}
        <div className="cg-branches-left-col">
          {/* Advanced Search & Filters Card (Screenshot 1) */}
          <div className="cg-card">
            <div className="cg-card-header">
              <h3 className="cg-card-title">
                <Filter size={16} color="#4F46E5" /> Advanced Search & Filters
              </h3>
              <button
                type="button"
                className="cg-toggle-link"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Hide Filters" : "Show Filters"}{" "}
                {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {showFilters && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Row 1: Search, Status, State, District, Branch Type */}
                <div className="cg-filters-grid">
                  <div className="cg-filter-item">
                    <span className="cg-filter-label">Search Keyword</span>
                    <div className="cg-input-with-icon">
                      <Search size={14} />
                      <input
                        className="cg-input-field"
                        placeholder="Branch Name, Code..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setSearchApplied(searchInput.trim());
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="cg-filter-item">
                    <CustomDropdown
                      label="Status"
                      options={statusOptions}
                      value={statusFilter}
                      onChange={(val) => {
                        setStatusFilter(val);
                        void load(0, val);
                      }}
                    />
                  </div>

                  <div className="cg-filter-item">
                    <CustomDropdown
                      label="State"
                      options={stateOptions}
                      value={stateFilter}
                      onChange={(val) => setStateFilter(val)}
                    />
                  </div>

                  <div className="cg-filter-item">
                    <CustomDropdown
                      label="District"
                      options={districtOptions}
                      value={districtFilter}
                      onChange={(val) => setDistrictFilter(val)}
                    />
                  </div>

                  <div className="cg-filter-item">
                    <CustomDropdown
                      label="Branch Type"
                      options={typeOptions}
                      value={typeFilter}
                      onChange={(val) => setTypeFilter(val)}
                    />
                  </div>
                </div>

                {/* Row 2: Region, Opening Dates, Manager, Actions */}
                <div className="cg-filters-grid">
                  <div className="cg-filter-item">
                    <CustomDropdown
                      label="Region"
                      options={regionOptions}
                      value={regionFilter}
                      onChange={(val) => setRegionFilter(val)}
                    />
                  </div>

                  <div className="cg-filter-item">
                    <span className="cg-filter-label">Opening Date From</span>
                    <div className="cg-input-with-icon">
                      <Calendar size={14} />
                      <input
                        type="date"
                        className="cg-input-field"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cg-filter-item">
                    <span className="cg-filter-label">Opening Date To</span>
                    <div className="cg-input-with-icon">
                      <Calendar size={14} />
                      <input
                        type="date"
                        className="cg-input-field"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cg-filter-item">
                    <CustomDropdown
                      label="Incharge / Manager"
                      options={managerDropdownOptions}
                      value={managerFilter}
                      onChange={(val) => setManagerFilter(val)}
                    />
                  </div>

                  <div className="cg-filter-actions">
                    <button
                      type="button"
                      className="cg-btn-reset"
                      onClick={() => {
                        setSearchInput("");
                        setSearchApplied("");
                        setStatusFilter("ALL");
                        setStateFilter("ALL");
                        setDistrictFilter("ALL");
                        setTypeFilter("ALL");
                        setRegionFilter("ALL");
                        setDateFrom("");
                        setDateTo("");
                        setManagerFilter("ALL");
                        void load(0, "ALL");
                      }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="cg-btn-apply"
                      onClick={() => {
                        setSearchApplied(searchInput.trim());
                        void load(0, statusFilter);
                      }}
                    >
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* All Branches Table Card (Screenshot 1) */}
          <div className="cg-card">
            <div className="cg-table-card-header">
              <h3 className="cg-card-title">All Branches ({filteredRows.length})</h3>
              <div className="cg-table-actions">
                <button
                  type="button"
                  className="cg-btn-export"
                  disabled={busy}
                  onClick={() =>
                    void req<{ csv: string }>("/operating-branches/export")
                      .then((result) => {
                        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "CareGanga-approved-branches.csv";
                        link.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch(() => setError("This branch export could not be verified."))
                  }
                >
                  <Download size={14} /> Export
                </button>
                {canManage && (
                  <button
                    type="button"
                    className="cg-btn-add"
                    onClick={() => setIsWizardOpen(true)}
                  >
                    <Plus size={14} /> Add New Branch
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#64748B" }}>
                Checking current approved branches...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="cg-empty-card-state">
                No operating branches match the selected filters.
              </div>
            ) : (
              <div className="cg-table-container">
                <table className="cg-table">
                  <thead>
                    <tr>
                      <th>Branch Code</th>
                      <th>Branch Name</th>
                      <th>State</th>
                      <th>District</th>
                      <th>Branch Type</th>
                      <th>Incharge / Manager</th>
                      <th>Status</th>
                      <th>Est. Opening Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((branch) => {
                      const parts = branch.areaName.split(",");
                      const state = parts.length > 1 ? parts[parts.length - 1].trim() : "West Bengal";
                      const district = parts[0]?.trim() || "Bankura";

                      return (
                        <tr
                          key={branch.branchRef}
                          className="cg-table-row"
                          onClick={() => void open(branch.branchRef)}
                        >
                          <td>
                            <span className="cg-branch-code-link">
                              {branch.branchCode || "Pending approval"}
                            </span>
                          </td>
                          <td>
                            <div className="cg-branch-name-cell">
                              <span className="cg-branch-name-text">{branch.branchName}</span>
                              {branch.branchType && (
                                <span className="cg-branch-tag">{branch.branchType}</span>
                              )}
                            </div>
                          </td>
                          <td>{state}</td>
                          <td>{district}</td>
                          <td>
                            <span className="cg-type-pill">
                              {branch.branchType || "Regional Office"}
                            </span>
                          </td>
                          <td>{branch.managerName || "Super Admin"}</td>
                          <td>
                            <span className={`cg-status-badge ${branch.status.toLowerCase()}`}>
                              {label(branch.status)}
                            </span>
                          </td>
                          <td>{branch.openingDate || "16 Nov 2026"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {next !== null && (
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <button
                  type="button"
                  className="cg-btn-export"
                  disabled={busy}
                  onClick={() =>
                    void load(next).catch(() => setError("More branches cannot be verified."))
                  }
                >
                  Load more branches
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (28%): Branches by Status, Branches by Type, Top 5 States (Screenshot 1) */}
        <aside className="cg-branches-right-col">
          {/* Branches by Status */}
          <div className="cg-summary-card">
            <h3>Branches by Status</h3>
            <div className="cg-donut-wrapper">
              <svg className="cg-donut-svg" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth="14"
                />
                {/* Active circle slice */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#16A34A"
                  strokeWidth="14"
                  strokeDasharray={`${activePct * 2.38} 238`}
                  strokeDashoffset="0"
                  transform="rotate(-90 50 50)"
                />
                {/* Inactive circle slice */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="14"
                  strokeDasharray={`${inactivePct * 2.38} 238`}
                  strokeDashoffset={`-${activePct * 2.38}`}
                  transform="rotate(-90 50 50)"
                />
                <text
                  x="50"
                  y="48"
                  textAnchor="middle"
                  fontSize="16"
                  fontWeight="bold"
                  fill="#0F172A"
                >
                  {totalBranchesCount}
                </text>
                <text x="50" y="62" textAnchor="middle" fontSize="7" fill="#64748B">
                  Total Branches
                </text>
              </svg>

              <div className="cg-donut-legend">
                <div className="cg-legend-item">
                  <span className="cg-legend-dot" style={{ background: "#16A34A" }}></span>
                  <span>Active</span>
                  <span className="cg-legend-count">{activeCount}</span>
                </div>
                <div className="cg-legend-item">
                  <span className="cg-legend-dot" style={{ background: "#F59E0B" }}></span>
                  <span>Inactive</span>
                  <span className="cg-legend-count">{inactiveCount}</span>
                </div>
                {closedCount > 0 && (
                  <div className="cg-legend-item">
                    <span className="cg-legend-dot" style={{ background: "#DC2626" }}></span>
                    <span>Closed</span>
                    <span className="cg-legend-count">{closedCount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Branches by Type */}
          <div className="cg-summary-card">
            <h3>Branches by Type</h3>
            {branchTypes.length > 0 ? (
              branchTypes.map((t) => {
                const pct = totalBranchesCount
                  ? Math.round((t.total / totalBranchesCount) * 100)
                  : 0;
                return (
                  <div key={t.name} className="cg-type-bar-item">
                    <div className="cg-type-bar-labels">
                      <span>{t.name || "Regional Office"}</span>
                      <span style={{ fontWeight: 700 }}>{pct}%</span>
                    </div>
                    <div className="cg-progress-track">
                      <div className="cg-progress-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <div className="cg-type-sub">{t.total} branch{t.total === 1 ? "" : "es"}</div>
                  </div>
                );
              })
            ) : (
              <>
                <div className="cg-type-bar-item">
                  <div className="cg-type-bar-labels">
                    <span>Head Office</span>
                    <span style={{ fontWeight: 700 }}>33%</span>
                  </div>
                  <div className="cg-progress-track">
                    <div className="cg-progress-fill" style={{ width: "33%" }}></div>
                  </div>
                  <div className="cg-type-sub">1 branch</div>
                </div>
                <div className="cg-type-bar-item">
                  <div className="cg-type-bar-labels">
                    <span>Regional Office</span>
                    <span style={{ fontWeight: 700 }}>67%</span>
                  </div>
                  <div className="cg-progress-track">
                    <div className="cg-progress-fill" style={{ width: "67%" }}></div>
                  </div>
                  <div className="cg-type-sub">2 branches</div>
                </div>
              </>
            )}
          </div>

          {/* Top 5 States */}
          <div className="cg-summary-card">
            <h3>Top 5 States</h3>
            {statesSummary.map(([state, count]) => (
              <div key={state} className="cg-state-row">
                <div className="cg-state-info">
                  <Building2 size={16} color="#64748B" />
                  <span>{state}</span>
                </div>
                <span className="cg-state-count">{count}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
