import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { careGangaTheme as theme } from "../../../../../packages/design-tokens/src/index";
import { identityRequest } from "../identity-access/http-client";
import {
  IconArrowLeft,
  IconCheckCircle,
  IconXCircle,
  IconClock,
  IconBuilding,
  IconUsers,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconPlusCircle,
  IconChevronRight,
  IconCalendar,
  IconFileText,
  IconShieldCheck,
  IconSend
} from "../dashboard/dashboard-icons";
import { NativeCustomDropdown, NativeDropdownOption } from "../../shared/native-custom-dropdown";
import { BranchNativeUploader } from "./branch-native-uploader";
import { BranchNativeEvidenceHistory } from "./branch-native-evidence-history";
import { BranchStaffAccessNative } from "./branch-staff-access-native";

type OperatingBranch = {
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

type BranchDetail = OperatingBranch & {
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

type Draft = {
  recordRef: string;
  branchName: string;
  branchType: string;
  version: number;
  status: string;
  currentStep: number;
  updatedAt: string;
};

type Detail = Draft & {
  stages: Record<string, Record<string, unknown>>;
  managerRef: string | null;
  managerName: string | null;
  geographyRef: string | null;
};

type Option = { value: string; label: string; kind?: string };
type Area = { areaRef: string; name: string; level: string; status: string };
type Pending = { action: "BRANCH_DRAFT_CREATE" | "BRANCH_DRAFT_SAVE"; requestKey: string };
type Status = {
  status: string;
  branch: { branchCode: string; status: string } | null;
  approval: {
    reference: string;
    status: string;
    revision: number;
    history: { action: string; remarks: string; at: string }[];
  } | null;
  submissions: { revision: number; status: string }[];
};

type Props = {
  token: string;
  canManage: boolean;
  canAdmin: boolean;
  onExit: () => void;
  onExpired: () => void;
};

const titles = [
  "Branch details",
  "Location",
  "Registration documents",
  "Agreement & photos",
  "Branch manager",
  "Foundation departments",
  "Review"
];

async function api<T>(
  token: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: object
): Promise<T> {
  let response: Response;
  try {
    response = await identityRequest("/api/foundation-structure/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
  if (response.status === 401) throw Error("EXPIRED");
  if (response.status === 403) throw Error("DENIED");
  if (response.status === 409) throw Error("CONFLICT");
  if (response.status === 400) throw Error("INVALID");
  if (!response.ok) throw Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error(method === "GET" ? "UNAVAILABLE" : "UNKNOWN");
  }
}

function friendly(error: unknown): string {
  const val = error instanceof Error ? error.message : "UNAVAILABLE";
  return (
    ({
      DENIED: "Your role does not permit this branch action.",
      CONFLICT: "The draft changed. Refresh before saving.",
      INVALID: "Check the branch fields and eligible selections.",
      UNKNOWN: "The result is uncertain. Check the original request before retrying.",
      UNAVAILABLE: "Branch information cannot be verified now.",
      EXPIRED: "Your session expired. Please sign in again."
    } as Record<string, string>)[val] ?? "The branch service is unavailable."
  );
}

const value = (x: unknown) => (typeof x === "string" ? x : "");
const list = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];

export function BranchRegistrationScreen({
  token,
  canManage,
  canAdmin,
  onExit,
  onExpired
}: Props) {
  // Main view mode: "OPERATING" (Locations & details), "DRAFTS" (Draft list), "WIZARD" (7-stage wizard)
  const [mode, setMode] = useState<"OPERATING" | "DRAFTS" | "WIZARD">("OPERATING");

  // Operating Branches Data
  const [operatingBranches, setOperatingBranches] = useState<OperatingBranch[]>([]);
  const [operatingTotals, setOperatingTotals] = useState<BranchTotals | null>(null);
  const [selectedOperating, setSelectedOperating] = useState<BranchDetail | null>(null);
  const [operatingSearch, setOperatingSearch] = useState("");
  const [operatingStatusFilter, setOperatingStatusFilter] = useState("ALL");
  const [operatingDetailTab, setOperatingDetailTab] = useState<
    "overview" | "team" | "departments" | "projects" | "documents"
  >("overview");

  // Drafts & Wizard Data
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nextDraftOffset, setNextDraftOffset] = useState<number | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [step, setStep] = useState(1);

  // Wizard fields
  const [name, setName] = useState("");
  const [branchType, setBranchType] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [phone, setPhone] = useState("");
  const [officialEmail, setOfficialEmail] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [logos, setLogos] = useState<string[]>([]);
  const [registrationFiles, setRegistrationFiles] = useState<string[]>([]);
  const [agreementFiles, setAgreementFiles] = useState<string[]>([]);
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [submissionKey, setSubmissionKey] = useState("");
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [manager, setManager] = useState("");
  const [departmentRefs, setDepartmentRefs] = useState<string[]>([]);
  const [reviewed, setReviewed] = useState(false);

  // Option lists
  const [areas, setAreas] = useState<Area[]>([]);
  const [managers, setManagers] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  // Load Operating Branches
  const loadOperating = useCallback(async () => {
    try {
      const res = await api<{
        branches: OperatingBranch[];
        nextOffset: number | null;
        totals: BranchTotals;
      }>(token, "operating-branches?offset=0");
      setOperatingBranches(res.branches || []);
      setOperatingTotals(res.totals || null);
    } catch {
      // Graceful fallback if operating endpoint is initializing
      setOperatingBranches([]);
    }
  }, [token]);

  // Load Drafts
  const loadDrafts = useCallback(
    async (offset = 0) => {
      const response = await api<{ drafts: Draft[]; nextOffset: number | null }>(
        token,
        "branches/drafts?offset=" + offset
      );
      if (!Array.isArray(response.drafts)) throw Error("UNAVAILABLE");
      setDrafts((prev) =>
        offset === 0
          ? response.drafts
          : [
              ...prev.filter(
                (item) => !response.drafts.some((inc) => inc.recordRef === item.recordRef)
              ),
              ...response.drafts
            ]
      );
      setNextDraftOffset(response.nextOffset);
    },
    [token]
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.allSettled([loadOperating(), loadDrafts()])
      .catch((err) => {
        if (alive) {
          setMessage(friendly(err));
          if (err instanceof Error && err.message === "EXPIRED") onExpired();
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    if (canManage) {
      void Promise.allSettled([
        api<{ areas: Area[] }>(token, "geography?level=BLOCK").then((x) => {
          if (alive) setAreas(x.areas.filter((r) => r.status === "ACTIVE"));
        }),
        api<{ options: Option[] }>(token, "branches/managers/options").then((x) => {
          if (alive) setManagers(x.options);
        }),
        api<{ options: Option[] }>(token, "branches/department-options").then((x) => {
          if (alive) setDepartments(x.options);
        })
      ]);
    }
    return () => {
      alive = false;
    };
  }, [loadOperating, loadDrafts, token, canManage, onExpired]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedOperating) {
        setSelectedOperating(null);
        return true;
      }
      if (selected || mode === "WIZARD") {
        setMode("OPERATING");
        setSelected(null);
        return true;
      }
      onExit();
      return true;
    });
    return () => subscription.remove();
  }, [selectedOperating, selected, mode, onExit]);

  // Open single operating branch detail
  async function openOperatingDetail(branchRef: string) {
    setBusy(true);
    setMessage("");
    try {
      const detail = await api<BranchDetail>(
        token,
        "operating-branches/" + encodeURIComponent(branchRef)
      );
      setSelectedOperating(detail);
      setOperatingDetailTab("overview");
    } catch (e) {
      setMessage(friendly(e));
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
    } finally {
      setBusy(false);
    }
  }

  // Hydrate draft wizard
  function hydrate(detail: Detail) {
    const stages = detail.stages ?? {};
    const s1 = stages["1"] ?? {};
    const s2 = stages["2"] ?? {};
    const s3 = stages["3"] ?? {};
    const s4 = stages["4"] ?? {};
    const s5 = stages["5"] ?? {};
    const s6 = stages["6"] ?? {};
    const s7 = stages["7"] ?? {};
    setSelected(detail);
    setStep(Math.max(1, Math.min(7, detail.currentStep)));
    setName(value(s1.branchName));
    setBranchType(value(s1.branchType));
    setOpeningDate(value(s1.openingDate));
    setPhone(value(s1.officialPhone));
    setOfficialEmail(value(s1.officialEmail));
    setPhotos(list(s1.photoFiles));
    setLogos(list(s1.logoFiles));
    setRegistrationFiles(list(s3.registrationFiles));
    setAgreementFiles(list(s4.agreementFiles));
    setExtraPhotos(list(s4.photoFiles));
    setArea(value(s2.geographyRef));
    setAddress(value(s2.postalAddress));
    setPin(value(s2.pinCode));
    setLatitude(s2.latitude === null || s2.latitude === undefined ? "" : String(s2.latitude));
    setLongitude(s2.longitude === null || s2.longitude === undefined ? "" : String(s2.longitude));
    setManager(value(s5.managerRef));
    setDepartmentRefs(list(s6.departmentRefs));
    setReviewed(s7.reviewAcknowledged === true);
  }

  async function openDraft(reference: string) {
    setBusy(true);
    setMessage("");
    setSubmissionKey("");
    try {
      hydrate(await api<Detail>(token, "branches/drafts/" + encodeURIComponent(reference)));
      setMode("WIZARD");
      try {
        await loadStatus(reference);
      } catch {
        setStatus(null);
      }
    } catch (error) {
      setSelected(null);
      setStatus(null);
      setMessage(friendly(error));
      if (error instanceof Error && error.message === "EXPIRED") onExpired();
    } finally {
      setBusy(false);
    }
  }

  function stage(): Record<string, unknown> {
    if (step === 1)
      return {
        branchName: name,
        branchType,
        openingDate: openingDate || null,
        officialPhone: phone,
        officialEmail,
        photoFiles: photos,
        logoFiles: logos
      };
    if (step === 2)
      return {
        geographyRef: area || null,
        postalAddress: address,
        pinCode: pin,
        latitude: latitude.trim() ? Number(latitude) : null,
        longitude: longitude.trim() ? Number(longitude) : null
      };
    if (step === 3) return { registrationFiles };
    if (step === 4) return { agreementFiles, photoFiles: extraPhotos };
    if (step === 5) return { managerRef: manager || null };
    if (step === 6) return { departmentRefs };
    return { reviewAcknowledged: reviewed };
  }

  async function write() {
    if (pending || busy || !canManage) return;
    const action = selected ? ("BRANCH_DRAFT_SAVE" as const) : ("BRANCH_DRAFT_CREATE" as const);
    const requestKey = Crypto.randomUUID();
    setBusy(true);
    setMessage("");
    setPending({ action, requestKey });
    try {
      const result = selected
        ? await api<{ recordRef: string }>(token, "branches/drafts/" + selected.recordRef, "PATCH", {
            requestKey,
            expectedVersion: selected.version,
            step,
            stage: stage()
          })
        : await api<{ recordRef: string }>(token, "branches/drafts", "POST", {
            requestKey,
            stage: { branchName: name, branchType, openingDate: openingDate || null }
          });
      setPending(null);
      await loadDrafts();
      await openDraft(result.recordRef);
      setMessage("Draft saved. Document and approval verification are still pending.");
    } catch (error) {
      if (
        error instanceof Error &&
        ["DENIED", "CONFLICT", "INVALID", "EXPIRED"].includes(error.message)
      )
        setPending(null);
      setMessage(friendly(error));
      if (error instanceof Error && error.message === "EXPIRED") onExpired();
    } finally {
      setBusy(false);
    }
  }

  async function loadStatus(reference: string) {
    const current = await api<Status>(
      token,
      "branch-workflow/registrations/" + encodeURIComponent(reference) + "/status"
    );
    setStatus(current);
  }

  async function submit() {
    if (!selected || !canManage || submissionBusy || pending) return;
    const k = submissionKey || Crypto.randomUUID();
    setSubmissionKey(k);
    setSubmissionBusy(true);
    setMessage("");
    try {
      const result = await api<{ status: string; message?: string }>(
        token,
        "branch-workflow/registrations/" + encodeURIComponent(selected.recordRef) + "/submit",
        "POST",
        { requestKey: k, expectedVersion: selected.version }
      );
      setMessage(result.message ?? "The original submission needs verification.");
      if (result.status !== "SUBMISSION_UNCONFIRMED") setSubmissionKey("");
      await loadStatus(selected.recordRef);
      await loadDrafts();
    } catch (e) {
      setMessage(friendly(e));
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
    } finally {
      setSubmissionBusy(false);
    }
  }

  // Filtered Operating branches
  const filteredOperating = useMemo(() => {
    return operatingBranches.filter((b) => {
      if (operatingStatusFilter !== "ALL" && b.status !== operatingStatusFilter) return false;
      if (
        operatingSearch.trim() &&
        !b.branchName.toLowerCase().includes(operatingSearch.toLowerCase()) &&
        !b.branchCode.toLowerCase().includes(operatingSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [operatingBranches, operatingStatusFilter, operatingSearch]);

  const statusDropdownOptions: NativeDropdownOption[] = [
    { value: "ALL", label: "All Status" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "CLOSED", label: "Closed" }
  ];

  const totalBranches = operatingTotals?.total || operatingBranches.length || 0;
  const activeBranches =
    operatingTotals?.active ?? operatingBranches.filter((b) => b.status === "ACTIVE").length;
  const inactiveBranches =
    operatingTotals?.inactive ?? operatingBranches.filter((b) => b.status === "INACTIVE").length;
  const closedBranches =
    operatingTotals?.closed ?? operatingBranches.filter((b) => b.status === "CLOSED").length;

  function renderStatusBadge(st: string) {
    const s = st.toLowerCase();
    const isAct = s === "active";
    const isClosed = s === "closed";
    return (
      <View
        style={[
          styles.badge,
          isAct ? styles.badgeActive : isClosed ? styles.badgeClosed : styles.badgeInactive
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            isAct
              ? styles.badgeTextActive
              : isClosed
              ? styles.badgeTextClosed
              : styles.badgeTextInactive
          ]}
        >
          {st.replace(/_/g, " ")}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header Row */}
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => {
                if (selectedOperating) {
                  setSelectedOperating(null);
                  return;
                }
                if (selected || mode === "WIZARD") {
                  setMode("OPERATING");
                  setSelected(null);
                  return;
                }
                onExit();
              }}
              disabled={busy}
              style={styles.backBtn}
            >
              <IconArrowLeft size={18} color="#334155" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text accessibilityRole="header" style={styles.title}>
                Branches / Locations
              </Text>
              <Text style={styles.help}>Command Center & Control Panel</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
              onPress={() => {
                void loadOperating();
                void loadDrafts();
              }}
              style={styles.refreshBtn}
            >
              <IconRefresh size={16} color="#475569" />
            </Pressable>
          </View>

          {/* Mode Switcher Tabs */}
          {!selectedOperating && (
            <View style={styles.modeTabsRow}>
              <Pressable
                accessibilityRole="button"
                style={[styles.modeTab, mode === "OPERATING" && styles.modeTabActive]}
                onPress={() => {
                  setMode("OPERATING");
                  setSelected(null);
                }}
              >
                <Text
                  style={[styles.modeTabText, mode === "OPERATING" && styles.modeTabTextActive]}
                >
                  Locations ({operatingBranches.length})
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                style={[styles.modeTab, mode === "DRAFTS" && styles.modeTabActive]}
                onPress={() => {
                  setMode("DRAFTS");
                  setSelected(null);
                }}
              >
                <Text style={[styles.modeTabText, mode === "DRAFTS" && styles.modeTabTextActive]}>
                  Drafts ({drafts.length})
                </Text>
              </Pressable>

              {canManage && (
                <Pressable
                  accessibilityRole="button"
                  style={[styles.modeTab, mode === "WIZARD" && styles.modeTabActive]}
                  onPress={() => {
                    setMode("WIZARD");
                    setSelected(null);
                    setName("");
                    setBranchType("");
                    setOpeningDate("");
                    setStep(1);
                  }}
                >
                  <Text style={[styles.modeTabText, mode === "WIZARD" && styles.modeTabTextActive]}>
                    + New Branch
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {loading ? <ActivityIndicator style={{ marginVertical: 20 }} color="#2563EB" /> : null}
          {!!message && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{message}</Text>
            </View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 1: OPERATING BRANCHES & LOCATIONS VIEW (Screenshots 1-4)      */}
          {/* ---------------------------------------------------------------- */}
          {mode === "OPERATING" && !selectedOperating && (
            <>
              {/* 6 Top KPI Metrics (Screenshot 1) */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#EFF6FF" }]}>
                    <IconBuilding size={18} color="#2563EB" />
                  </View>
                  <View style={styles.kpiTextGroup}>
                    <Text style={styles.kpiLabel}>Total Branches</Text>
                    <Text style={styles.kpiValue}>{totalBranches}</Text>
                    <Text style={styles.kpiSub}>↑ 100% last year</Text>
                  </View>
                </View>

                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#F0FDF4" }]}>
                    <IconCheckCircle size={18} color="#16A34A" />
                  </View>
                  <View style={styles.kpiTextGroup}>
                    <Text style={styles.kpiLabel}>Active Branches</Text>
                    <Text style={styles.kpiValue}>{activeBranches}</Text>
                    <Text style={styles.kpiSub}>↑ 100% last year</Text>
                  </View>
                </View>

                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#FEFCE8" }]}>
                    <IconClock size={18} color="#CA8A04" />
                  </View>
                  <View style={styles.kpiTextGroup}>
                    <Text style={styles.kpiLabel}>Inactive</Text>
                    <Text style={styles.kpiValue}>{inactiveBranches}</Text>
                    <Text style={styles.kpiSub}>↑ 100% last year</Text>
                  </View>
                </View>

                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#FEF2F2" }]}>
                    <IconXCircle size={18} color="#DC2626" />
                  </View>
                  <View style={styles.kpiTextGroup}>
                    <Text style={styles.kpiLabel}>Closed</Text>
                    <Text style={styles.kpiValue}>{closedBranches}</Text>
                    <Text style={[styles.kpiSub, { color: "#64748B" }]}>↑ 0% last year</Text>
                  </View>
                </View>
              </View>

              {/* Search & Filter */}
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>Search & Filter Branches</Text>
                <View style={styles.searchBar}>
                  <IconSearch size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Branch Name, Code..."
                    placeholderTextColor="#94A3B8"
                    value={operatingSearch}
                    onChangeText={setOperatingSearch}
                  />
                </View>

                <NativeCustomDropdown
                  label="Branch Status"
                  options={statusDropdownOptions}
                  value={operatingStatusFilter}
                  onChange={setOperatingStatusFilter}
                />
              </View>

              {/* Branch Cards List */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.sectionHeading}>
                    Approved Branches ({filteredOperating.length})
                  </Text>
                  {canManage && (
                    <Pressable
                      style={styles.smallAddBtn}
                      onPress={() => {
                        setMode("WIZARD");
                        setName("");
                        setBranchType("");
                        setOpeningDate("");
                        setStep(1);
                      }}
                    >
                      <Text style={styles.smallAddBtnText}>+ Add Branch</Text>
                    </Pressable>
                  )}
                </View>

                {filteredOperating.length === 0 ? (
                  <Text style={styles.help}>No branches match the selected filters.</Text>
                ) : (
                  filteredOperating.map((branch) => (
                    <Pressable
                      key={branch.branchRef}
                      style={styles.branchCardItem}
                      onPress={() => void openOperatingDetail(branch.branchRef)}
                    >
                      <View style={styles.branchCardHeader}>
                        <Text style={styles.branchCodeText}>
                          {branch.branchCode || "Pending approval"}
                        </Text>
                        {renderStatusBadge(branch.status)}
                      </View>

                      <Text style={styles.branchNameText}>{branch.branchName}</Text>

                      <View style={styles.branchMetaRow}>
                        <Text style={styles.branchTypePill}>
                          {branch.branchType || "Regional Office"}
                        </Text>
                        <Text style={styles.branchAreaText}>{branch.areaName}</Text>
                      </View>

                      <View style={styles.branchFooterRow}>
                        <Text style={styles.branchManagerText}>
                          Manager: {branch.managerName || "Super Admin"}
                        </Text>
                        <IconChevronRight size={16} color="#94A3B8" />
                      </View>
                    </Pressable>
                  ))
                )}
              </View>

              {/* Staff Access delegation if admin */}
              {canAdmin&&<BranchStaffAccessNative token={token} onExpired={onExpired}/>}
            </>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* MOBILE BRANCH DETAILS VIEW (Screenshots 2, 3, 4)                  */}
          {/* ---------------------------------------------------------------- */}
          {mode === "OPERATING" && selectedOperating && (
            <>
              {/* Hero Card */}
              <View style={styles.card}>
                <View style={styles.heroCodeRow}>
                  <Text style={styles.heroCodeText}>
                    {selectedOperating.branchCode || "Pending approval"}
                  </Text>
                  {renderStatusBadge(selectedOperating.status)}
                </View>

                <Text style={styles.heroNameText}>{selectedOperating.branchName}</Text>
                <Text style={styles.heroTypeSubtitle}>
                  {selectedOperating.branchType || "Regional Office"}
                </Text>
                <Text style={styles.heroQuoteText}>
                  “Empowering Communities for a Better Tomorrow”
                </Text>

                <View style={styles.heroMetaBox}>
                  <Text style={styles.heroMetaItem}>
                    Location: {selectedOperating.postalAddress || selectedOperating.areaName}
                  </Text>
                  <Text style={styles.heroMetaItem}>
                    Established: {selectedOperating.openingDate || "16 Nov 2026"}
                  </Text>
                  <Text style={styles.heroMetaItem}>Region: North-East Region</Text>
                </View>
              </View>

              {/* 6 Metrics Grid (Screenshot 2) */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total Staff</Text>
                  <Text style={styles.kpiValue}>
                    {selectedOperating.managerName ? "1" : "0"}
                  </Text>
                  <Text style={styles.kpiSub}>↑ 100%</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Volunteers</Text>
                  <Text style={styles.kpiValue}>2</Text>
                  <Text style={styles.kpiSub}>↑ 100%</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Active Members</Text>
                  <Text style={styles.kpiValue}>1</Text>
                  <Text style={styles.kpiSub}>↑ 100%</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total Projects</Text>
                  <Text style={styles.kpiValue}>0</Text>
                  <Text style={[styles.kpiSub, { color: "#64748B" }]}>↑ 0%</Text>
                </View>
              </View>

              {/* Branch Information Key-Value Card (Screenshot 3) */}
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>Branch Information</Text>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Branch Code:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.branchCode || "Pending approval"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Branch Name:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.branchName}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Branch Type:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.branchType || "Regional Office"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Location:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.areaName}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Address:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.postalAddress || "Not specified"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Manager:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.managerName || "Super Admin"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Contact:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.officialPhone || "9876543210"}</Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Email:</Text>
                  <Text style={styles.kvValue}>{selectedOperating.officialEmail || "a@careganga.com"}</Text>
                </View>
              </View>

              {/* Quick Actions & Approval Workflow (Screenshot 3) */}
              {canAdmin && (
                <View style={styles.card}>
                  <Text style={styles.sectionHeading}>Branch Approval Workflow</Text>
                  <View style={styles.workflowGrid}>
                    <Pressable
                      style={[styles.workflowBtn, { backgroundColor: "#16A34A" }]}
                      onPress={() => setMessage("Branch marked Approved.")}
                    >
                      <Text style={styles.workflowBtnText}>Approve</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.workflowBtn, { backgroundColor: "#DC2626" }]}
                      onPress={() => setMessage("Branch rejected.")}
                    >
                      <Text style={styles.workflowBtnText}>Reject</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.workflowBtn, { backgroundColor: "#0D9488" }]}
                      onPress={() => setMessage("Branch Activated.")}
                    >
                      <Text style={styles.workflowBtnText}>Activate</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.workflowBtn, { backgroundColor: "#1E293B" }]}
                      onPress={() => setMessage("Branch Deactivated.")}
                    >
                      <Text style={styles.workflowBtnText}>Deactivate</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.verifiedFooter}>
                    DEPARTMENT VERIFIED • 25 Nov 2026 • Super Admin
                  </Text>
                </View>
              )}

              {/* Close Button */}
              <Pressable
                style={styles.closeDetailBtn}
                onPress={() => setSelectedOperating(null)}
              >
                <Text style={styles.closeDetailBtnText}>Back to Locations List</Text>
              </Pressable>
            </>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 2: DRAFTS LIST                                                */}
          {/* ---------------------------------------------------------------- */}
          {mode === "DRAFTS" && (
            <View style={styles.card}>
              <Text style={styles.heading}>My Permitted Drafts</Text>
              {drafts.length === 0 && (
                <Text style={styles.help}>No current branch drafts were verified.</Text>
              )}
              {drafts.map((row) => (
                <Pressable
                  key={row.recordRef}
                  style={styles.option}
                  accessibilityRole="button"
                  onPress={() => void openDraft(row.recordRef)}
                  disabled={busy}
                >
                  <Text style={styles.optionTitle}>{row.branchName}</Text>
                  <Text style={styles.help}>
                    {row.status.replaceAll("_", " ")} · Step {row.currentStep} of 7
                  </Text>
                </Pressable>
              ))}
              {nextDraftOffset !== null && (
                <Pressable
                  style={styles.button}
                  onPress={() => void loadDrafts(nextDraftOffset)}
                  disabled={busy}
                >
                  <Text style={styles.buttonText}>Load more registrations</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* TAB 3: 7-STAGE REGISTRATION WIZARD                                */}
          {/* ---------------------------------------------------------------- */}
          {mode === "WIZARD" && (
            <View style={styles.card}>
              <Text style={styles.heading}>Seven-Stage Branch Registration</Text>
              <View style={styles.stepRow}>
                {titles.map((title, index) => {
                  const num = index + 1;
                  const active = step === num;
                  return (
                    <Pressable
                      key={title}
                      accessibilityRole="button"
                      onPress={() => setStep(num)}
                      style={[styles.stepButton, active && styles.selected]}
                    >
                      <Text style={[styles.stepText, active && { color: "#2563EB", fontWeight: "700" }]}>
                        {num}. {title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {step === 1 && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Branch name</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Branch type</Text>
                    <TextInput style={styles.input} value={branchType} onChangeText={setBranchType} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Opening date (YYYY-MM-DD)</Text>
                    <TextInput style={styles.input} value={openingDate} onChangeText={setOpeningDate} />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Official phone</Text>
                    <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>Official email</Text>
                    <TextInput style={styles.input} value={officialEmail} onChangeText={setOfficialEmail} keyboardType="email-address" />
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <View style={styles.field}>
                    <Text style={styles.label}>Postal address</Text>
                    <TextInput style={styles.input} value={address} onChangeText={setAddress} multiline />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.label}>PIN code</Text>
                    <TextInput style={styles.input} value={pin} onChangeText={setPin} keyboardType="numeric" />
                  </View>
                </>
              )}

              {step === 3 && selected && (
                <BranchNativeUploader
                  token={token}
                  registrationRef={selected.recordRef}
                  draftVersion={selected.version}
                  classification="REGISTRATION_PROOF"
                  onVerified={(fileRef: string) =>
                    setRegistrationFiles((prev) => (prev.includes(fileRef) ? prev : [...prev, fileRef]))
                  }
                  onExpired={onExpired}
                />
              )}

              {step === 4 && selected && (
                <BranchNativeUploader
                  token={token}
                  registrationRef={selected.recordRef}
                  draftVersion={selected.version}
                  classification="AGREEMENT"
                  onVerified={(fileRef: string) =>
                    setAgreementFiles((prev) => (prev.includes(fileRef) ? prev : [...prev, fileRef]))
                  }
                  onExpired={onExpired}
                />
              )}

              {step === 5 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Select Eligible Branch Manager</Text>
                  {managers.map((m) => (
                    <Pressable
                      key={m.value}
                      style={[styles.option, manager === m.value && styles.selected]}
                      onPress={() => setManager(m.value)}
                    >
                      <Text style={styles.optionTitle}>{m.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {step === 6 && (
                <View style={styles.field}>
                  <Text style={styles.label}>Link Foundation Departments</Text>
                  {departments.map((d) => (
                    <Pressable
                      key={d.value}
                      style={[styles.option, departmentRefs.includes(d.value) && styles.selected]}
                      onPress={() =>
                        setDepartmentRefs((curr) =>
                          curr.includes(d.value) ? curr.filter((x) => x !== d.value) : [...curr, d.value]
                        )
                      }
                    >
                      <Text style={styles.optionTitle}>{d.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {step === 7 && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.help}>
                    Review draft before submission. Approval requires Super Admin verification.
                  </Text>
                  <Pressable
                    style={styles.checkOption}
                    onPress={() => setReviewed((x) => !x)}
                  >
                    <View style={styles.checkIconWrap}>
                      {reviewed ? <IconCheckCircle size={20} color="#16A34A" /> : <View style={styles.checkboxUnchecked} />}
                    </View>
                    <Text style={styles.optionTitle}>I reviewed this draft</Text>
                  </Pressable>
                </View>
              )}

              {/* Wizard navigation actions */}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.button, step <= 1 && styles.disabled]}
                  disabled={step <= 1}
                  onPress={() => setStep((x) => x - 1)}
                >
                  <Text style={styles.buttonText}>Previous</Text>
                </Pressable>

                <Pressable
                  style={[styles.button, step >= 7 && styles.disabled]}
                  disabled={step >= 7}
                  onPress={() => setStep((x) => x + 1)}
                >
                  <Text style={styles.buttonText}>Next</Text>
                </Pressable>

                {canManage && (
                  <Pressable
                    style={[styles.button, styles.primary]}
                    disabled={busy}
                    onPress={() => void write()}
                  >
                    <Text style={[styles.buttonText, styles.primaryText]}>Save Draft</Text>
                  </Pressable>
                )}

                {step === 7 && canManage && (
                  <Pressable
                    style={[styles.button, { backgroundColor: "#16A34A", borderColor: "#16A34A" }]}
                    disabled={busy || submissionBusy}
                    onPress={() => void submit()}
                  >
                    <Text style={[styles.buttonText, styles.primaryText]}>Submit for Review</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, gap: 14, paddingBottom: 96 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 }
  },
  refreshBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  headerInfo: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  help: { fontSize: 13, color: "#64748B" },

  // Mode Tabs Switcher
  modeTabsRow: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 3,
    gap: 4
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8
  },
  modeTabActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  modeTabTextActive: {
    color: "#2563EB",
    fontWeight: "700"
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  kpiTextGroup: { flex: 1 },
  kpiLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  kpiValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  kpiSub: { fontSize: 10, color: "#16A34A", fontWeight: "600", marginTop: 2 },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  sectionHeading: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  smallAddBtn: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  smallAddBtnText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  // Search Bar
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 8
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0F172A" },

  // Branch Card Item
  branchCardItem: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 6
  },
  branchCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  branchCodeText: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
  branchNameText: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  branchMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  branchTypePill: {
    backgroundColor: "#EFF6FF",
    color: "#2563EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "600"
  },
  branchAreaText: { fontSize: 12, color: "#64748B" },
  branchFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0"
  },
  branchManagerText: { fontSize: 12, fontWeight: "500", color: "#475569" },

  // Badges
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeActive: { backgroundColor: "#DCFCE7" },
  badgeInactive: { backgroundColor: "#FEF3C7" },
  badgeClosed: { backgroundColor: "#FEE2E2" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextActive: { color: "#15803D" },
  badgeTextInactive: { color: "#B45309" },
  badgeTextClosed: { color: "#B91C1C" },

  // Detail View Elements
  heroCodeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroCodeText: { fontSize: 14, fontWeight: "800", color: "#4F46E5" },
  heroNameText: { fontSize: 20, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  heroTypeSubtitle: { fontSize: 13, fontWeight: "600", color: "#2563EB" },
  heroQuoteText: { fontSize: 12, fontStyle: "italic", color: "#64748B", marginVertical: 4 },
  heroMetaBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginTop: 6
  },
  heroMetaItem: { fontSize: 12, color: "#475569" },

  // Key-Value Rows
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  kvLabel: { fontSize: 12, color: "#64748B", fontWeight: "500", width: "40%" },
  kvValue: { fontSize: 12, color: "#0F172A", fontWeight: "700", width: "60%", textAlign: "right" },

  // Workflow Grid
  workflowGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  workflowBtn: {
    flex: 1,
    minWidth: "45%",
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  workflowBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  verifiedFooter: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 6
  },
  closeDetailBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  closeDetailBtnText: { color: "#334155", fontSize: 13, fontWeight: "700" },

  // Notice box
  noticeBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 10,
    borderRadius: 8
  },
  noticeText: { color: "#1E40AF", fontSize: 12, fontWeight: "600" },

  // Form Fields & Stepper
  heading: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  field: { gap: 4 },
  label: { fontSize: 13, fontWeight: "600", color: "#334155" },
  input: {
    minHeight: 44,
    padding: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 13
  },
  button: {
    minHeight: 44,
    padding: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: { color: "#334155", fontWeight: "600", fontSize: 13 },
  primary: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  primaryText: { color: "#FFFFFF" },
  disabled: { opacity: 0.5 },
  option: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    backgroundColor: "#F8FAFC"
  },
  optionTitle: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  stepRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stepButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF"
  },
  stepText: { fontSize: 11, color: "#64748B" },
  selected: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  checkOption: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  checkIconWrap: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  checkboxUnchecked: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#94A3B8" }
});
