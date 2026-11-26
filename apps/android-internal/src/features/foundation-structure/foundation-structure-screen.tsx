import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
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
import { identityRequest } from "../identity-access/http-client";
import {
  IconArrowLeft,
  IconCheckCircle,
  IconXCircle,
  IconClock,
  IconBuilding,
  IconUsers,
  IconSearch,
  IconRefresh,
  IconPlusCircle,
  IconCalendar,
  IconFileText,
  IconShieldCheck,
  IconClose,
  IconLayers,
  IconPhone,
  IconPencil,
  IconDownload,
  IconMapPin
} from "../dashboard/dashboard-icons";
import { NativeCustomDropdown, NativeDropdownOption } from "../../shared/native-custom-dropdown";

export interface FoundationStructureScreenProps {
  token: string;
  roleActions: string[];
  onExit: () => void;
  onExpired: () => void;
}

type TabMode = "PROFILE" | "GEOGRAPHY" | "DEPARTMENTS";

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

type HistoryEvent = {
  action: string;
  version: number;
  recordedAt: string;
};

const levels = ["STATE", "DISTRICT", "SUBDIVISION", "BLOCK"];
const parentLevels: Record<string, string[]> = {
  STATE: [],
  DISTRICT: ["STATE"],
  SUBDIVISION: ["DISTRICT"],
  BLOCK: ["DISTRICT", "SUBDIVISION"]
};

export function FoundationStructureScreen({
  token,
  roleActions,
  onExit,
  onExpired
}: FoundationStructureScreenProps) {
  const can = (permission: string) => roleActions.includes(permission);

  const canViewProfile = can("foundation.profile.view");
  const canManageProfile = can("foundation.profile.manage");
  const canViewGeography = can("foundation.geography.view");
  const canManageGeography = can("foundation.geography.manage");
  const canViewDepartments = can("foundation.departments.view");
  const canManageDepartments = can("foundation.departments.manage");
  const canAssignDepartments = can("foundation.departments.assign");

  const [tab, setTab] = useState<TabMode>(
    canViewProfile ? "PROFILE" : canViewGeography ? "GEOGRAPHY" : "DEPARTMENTS"
  );

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [legalName, setLegalName] = useState("");
  const [officialContact, setOfficialContact] = useState("");
  const [postalAddress, setPostalAddress] = useState("");
  const [registrationRef, setRegistrationRef] = useState("");
  const [registrationAuthority, setRegistrationAuthority] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");

  // Geography state
  const [areas, setAreas] = useState<Area[]>([]);
  const [areaNextOffset, setAreaNextOffset] = useState<number | null>(null);
  const [geoSearch, setGeoSearch] = useState("");
  const [geoMode, setGeoMode] = useState<"LIST" | "FORM">("LIST");
  const [areaRef, setAreaRef] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [areaLevel, setAreaLevel] = useState("STATE");
  const [areaParent, setAreaParent] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [areaStatus, setAreaStatus] = useState("ACTIVE");
  const [areaVersion, setAreaVersion] = useState(0);

  // Departments state
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [deptSummary, setDeptSummary] = useState<DeptSummary | null>(null);
  const [deptNextOffset, setDeptNextOffset] = useState<number | null>(null);
  const [deptSearch, setDeptSearch] = useState("");
  const [deptKindFilter, setDeptKindFilter] = useState("ALL");
  const [deptStatusFilter, setDeptStatusFilter] = useState("ALL");
  const [deptModalOpen, setDeptModalOpen] = useState(false);
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

  // Officeholders state
  const [focusedDeptRef, setFocusedDeptRef] = useState<string | null>(null);
  const [officeholdersModalOpen, setOfficeholdersModalOpen] = useState(false);
  const [officeholders, setOfficeholders] = useState<Officeholder[]>([]);
  const [officeholderSearch, setOfficeholderSearch] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantAccount, setParticipantAccount] = useState("");
  const [participantRole, setParticipantRole] = useState("");

  // History & Audit modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  // Hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (historyModalOpen) {
        setHistoryModalOpen(false);
        return true;
      }
      if (officeholdersModalOpen) {
        setOfficeholdersModalOpen(false);
        return true;
      }
      if (deptModalOpen) {
        setDeptModalOpen(false);
        return true;
      }
      if (geoMode === "FORM") {
        setGeoMode("LIST");
        return true;
      }
      onExit();
      return true;
    });
    return () => handler.remove();
  }, [historyModalOpen, officeholdersModalOpen, deptModalOpen, geoMode, onExit]);

  // API caller helper
  const api = useCallback(
    async <T,>(
      path: string,
      method: "GET" | "POST" | "PATCH" = "GET",
      body?: Record<string, unknown>
    ): Promise<T> => {
      const response = await identityRequest("/api/foundation-structure/" + path, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) {
          onExpired();
          throw new Error("Your session expired. Please sign in again.");
        }
        if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
          throw Object.assign(new Error(data.message), { status: response.status });
        }
        throw Object.assign(new Error("The Foundation service is unavailable."), { status: response.status });
      }
      return data as T;
    },
    [token, onExpired]
  );

  // Reload data
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    const tasks: Promise<void>[] = [];

    if (canViewProfile) {
      tasks.push(
        api<{ profile: Profile | null }>("profile")
          .then((res) => {
            setProfile(res.profile);
            if (res.profile) {
              setLegalName(res.profile.legalName || "");
              setOfficialContact(res.profile.officialContact || "");
              setPostalAddress(res.profile.postalAddress || "");
              setRegistrationRef(res.profile.registrationRef || "");
              setRegistrationAuthority(res.profile.registrationAuthority || "");
              setRegistrationDate(res.profile.registrationDate || "");
            }
          })
          .catch((err) => {
            setProfile(null);
            throw err;
          })
      );
    }

    if (canViewGeography) {
      tasks.push(
        api<{ areas: Area[]; nextOffset: number | null }>("geography")
          .then((res) => {
            setAreas(res.areas);
            setAreaNextOffset(res.nextOffset);
          })
          .catch((err) => {
            setAreas([]);
            setAreaNextOffset(null);
            throw err;
          })
      );
    }

    if (canViewDepartments) {
      tasks.push(
        api<{ departments: Dept[]; summary: DeptSummary; nextOffset: number | null }>("departments")
          .then((res) => {
            setDepartments(res.departments);
            setDeptSummary(res.summary);
            setDeptNextOffset(res.nextOffset);
          })
          .catch((err) => {
            setDepartments([]);
            setDeptSummary(null);
            setDeptNextOffset(null);
            throw err;
          })
      );
    }

    if (canAssignDepartments) {
      tasks.push(
        api<{ options: Officeholder[] }>("officeholders/options")
          .then((res) => setOfficeholders(res.options))
          .catch(() => setOfficeholders([]))
      );
    }

    const results = await Promise.allSettled(tasks);
    if (results.some((r) => r.status === "rejected")) {
      setError("Some Foundation information could not be verified. Tap refresh to retry.");
    }
    setLoading(false);
  }, [api, canViewProfile, canViewGeography, canViewDepartments, canAssignDepartments]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Load participants for focused department
  useEffect(() => {
    if (!focusedDeptRef || !canViewDepartments) {
      setParticipants([]);
      return;
    }
    let alive = true;
    void api<{ participants: Participant[] }>(
      "departments/" + encodeURIComponent(focusedDeptRef) + "/participants"
    )
      .then((res) => {
        if (alive) setParticipants(res.participants);
      })
      .catch(() => {
        if (alive) {
          setParticipants([]);
          setError("Officeholder history cannot be verified.");
        }
      });
    return () => {
      alive = false;
    };
  }, [focusedDeptRef, api, canViewDepartments]);

  // Mutations
  async function send(write: Pending) {
    setBusy(true);
    setNotice("");
    setError("");
    setPending(write);
    try {
      await api<{ status: string }>(write.url, write.method, write.body);
      setPending(null);
      setNotice("Change confirmed successfully.");
      if (write.action === "AREA_CREATE" || write.action === "AREA_UPDATE") {
        resetAreaForm();
        setGeoMode("LIST");
      }
      if (write.action === "DEPARTMENT_CREATE" || write.action === "DEPARTMENT_UPDATE") {
        resetDeptForm();
        setDeptModalOpen(false);
      }
      if (write.action === "PARTICIPANT_ADD") {
        setParticipantAccount("");
        setParticipantRole("");
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The operation cannot be confirmed.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  function save(method: "POST" | "PATCH", url: string, action: string, data: Record<string, unknown>) {
    if (pending || busy) return;
    const requestKey = Crypto.randomUUID();
    void send({ method, url, action, requestKey, body: { ...data, requestKey } });
  }

  // Profile save
  function handleSaveProfile() {
    save("PATCH", "profile", "PROFILE_SAVE", {
      legalName,
      officialContact,
      postalAddress,
      registrationRef: registrationRef || null,
      registrationAuthority: registrationAuthority || null,
      registrationDate: registrationDate || null,
      expectedVersion: profile?.version ?? 0
    });
  }

  // Geography helpers
  const eligibleParents = useMemo(() => {
    return areas.filter(
      (x) => parentLevels[areaLevel]?.includes(x.level) && x.status === "ACTIVE" && x.areaRef !== areaRef
    );
  }, [areas, areaLevel, areaRef]);

  const visibleAreas = useMemo(() => {
    return areas.filter((x) => x.name.toLowerCase().includes(geoSearch.toLowerCase()));
  }, [areas, geoSearch]);

  function resetAreaForm() {
    setAreaRef(null);
    setAreaName("");
    setAreaLevel("STATE");
    setAreaParent("");
    setAreaCode("");
    setAreaStatus("ACTIVE");
    setAreaVersion(0);
  }

  function editArea(item: Area) {
    setAreaRef(item.areaRef);
    setAreaName(item.name);
    setAreaLevel(item.level);
    setAreaParent(item.parentRef ?? "");
    setAreaCode(item.code ?? "");
    setAreaStatus(item.status);
    setAreaVersion(item.version);
    setGeoMode("FORM");
  }

  function handleSaveArea() {
    const body = {
      name: areaName,
      level: areaLevel,
      parentRef: areaParent || null,
      code: areaCode || null,
      ...(areaRef ? { status: areaStatus, expectedVersion: areaVersion } : {})
    };
    save(
      areaRef ? "PATCH" : "POST",
      areaRef ? "geography/" + areaRef : "geography",
      areaRef ? "AREA_UPDATE" : "AREA_CREATE",
      body
    );
  }

  async function loadMoreAreas() {
    if (areaNextOffset === null || busy) return;
    setBusy(true);
    try {
      const next = await api<{ areas: Area[]; nextOffset: number | null }>(
        "geography?offset=" + areaNextOffset
      );
      setAreas((prev) => {
        const prior = new Set(prev.map((x) => x.areaRef));
        return [...prev, ...next.areas.filter((x) => !prior.has(x.areaRef))];
      });
      setAreaNextOffset(next.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Additional areas could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  // Departments helpers
  const visibleDepartments = useMemo(() => {
    return departments.filter(
      (x) =>
        x.name.toLowerCase().includes(deptSearch.toLowerCase()) &&
        (deptKindFilter === "ALL" || x.kind === deptKindFilter) &&
        (deptStatusFilter === "ALL" || (x.active ? "ACTIVE" : "INACTIVE") === deptStatusFilter)
    );
  }, [departments, deptSearch, deptKindFilter, deptStatusFilter]);

  const focusedDept = departments.find((x) => x.departmentRef === focusedDeptRef);

  function resetDeptForm() {
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
  }

  function editDept(x: Dept) {
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
    setDeptModalOpen(true);
  }

  function handleSaveDept() {
    const existing = departments.find((x) => x.departmentRef === deptRef);
    const body = {
      name: deptName,
      kind: deptKind,
      description: deptDescription,
      openingDate: deptOpening || null,
      geographyRef: deptArea || null,
      parentRef: deptParent || null,
      headAccountRef: canAssignDepartments ? deptHead || null : existing?.headAccountRef ?? null,
      ...(deptRef ? { expectedVersion: deptVersion, active: deptActive } : {})
    };
    save(
      deptRef ? "PATCH" : "POST",
      deptRef ? "departments/" + deptRef : "departments",
      deptRef ? "DEPARTMENT_UPDATE" : "DEPARTMENT_CREATE",
      body
    );
  }

  async function loadMoreDepartments() {
    if (deptNextOffset === null || busy) return;
    setBusy(true);
    try {
      const data = await api<{ departments: Dept[]; nextOffset: number | null }>(
        "departments?offset=" + deptNextOffset
      );
      setDepartments((prev) => {
        const seen = new Set(prev.map((x) => x.departmentRef));
        return [...prev, ...data.departments.filter((x) => !seen.has(x.departmentRef))];
      });
      setDeptNextOffset(data.nextOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Additional departments could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  // History helper
  async function showHistory(kind: "PROFILE" | "AREA" | "DEPARTMENT" | "PARTICIPANT", ref: string, title: string) {
    setBusy(true);
    try {
      const res = await api<{ events: HistoryEvent[] }>(
        "history/" + kind + "/" + encodeURIComponent(ref)
      );
      setHistoryTitle(title);
      setHistoryEvents(res.events);
      setHistoryModalOpen(true);
    } catch {
      setError("This Foundation history cannot be verified.");
    } finally {
      setBusy(false);
    }
  }

  // Officeholders search
  async function findEligibleOfficeholders() {
    if (busy || !canAssignDepartments) return;
    setBusy(true);
    try {
      const res = await api<{ options: Officeholder[] }>(
        "officeholders/options?search=" + encodeURIComponent(officeholderSearch.trim())
      );
      setOfficeholders(res.options);
      if (res.options.length === 0) setNotice("No eligible staff account matched. Try another name.");
    } catch (e) {
      setOfficeholders([]);
      setError(e instanceof Error ? e.message : "Eligible staff accounts cannot be verified.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.arrowBackButton}
            onPress={onExit}
          >
            <IconArrowLeft size={22} color="#0F172A" />
          </Pressable>

          <View style={styles.topBarTextWrap}>
            <View style={styles.topBarTitleRow}>
              <IconShieldCheck size={20} color="#2563EB" />
              <Text style={styles.topBarTitle} numberOfLines={1}>
                Foundation Structure
              </Text>
            </View>
            <Text style={styles.topBarSubtitle} numberOfLines={1}>
              Official profile, geography, departments & committees
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh records"
            style={styles.refreshButton}
            onPress={() => void reload()}
            disabled={loading || busy}
          >
            <IconRefresh size={18} color="#475569" />
          </Pressable>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          {canViewProfile && (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "PROFILE" }}
              style={[styles.tabButton, tab === "PROFILE" && styles.tabButtonActive]}
              onPress={() => {
                setTab("PROFILE");
                setError("");
              }}
            >
              <IconBuilding size={16} color={tab === "PROFILE" ? "#FFFFFF" : "#64748B"} />
              <Text style={[styles.tabButtonText, tab === "PROFILE" && styles.tabButtonTextActive]}>
                Profile
              </Text>
            </Pressable>
          )}

          {canViewGeography && (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "GEOGRAPHY" }}
              style={[styles.tabButton, tab === "GEOGRAPHY" && styles.tabButtonActive]}
              onPress={() => {
                setTab("GEOGRAPHY");
                setError("");
              }}
            >
              <IconMapPin size={16} color={tab === "GEOGRAPHY" ? "#FFFFFF" : "#64748B"} />
              <Text style={[styles.tabButtonText, tab === "GEOGRAPHY" && styles.tabButtonTextActive]}>
                Geography
              </Text>
            </Pressable>
          )}

          {canViewDepartments && (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === "DEPARTMENTS" }}
              style={[styles.tabButton, tab === "DEPARTMENTS" && styles.tabButtonActive]}
              onPress={() => {
                setTab("DEPARTMENTS");
                setError("");
              }}
            >
              <IconLayers size={16} color={tab === "DEPARTMENTS" ? "#FFFFFF" : "#64748B"} />
              <Text style={[styles.tabButtonText, tab === "DEPARTMENTS" && styles.tabButtonTextActive]}>
                Departments
              </Text>
            </Pressable>
          )}
        </View>

        {/* Status / Alert Banners */}
        {loading && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Checking Foundation records…</Text>
          </View>
        )}
        {notice !== "" && (
          <View style={styles.noticeBanner}>
            <IconCheckCircle size={16} color="#15803D" />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}
        {error !== "" && (
          <View style={styles.errorBanner}>
            <IconXCircle size={16} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* TAB 1: PROFILE */}
        {tab === "PROFILE" && canViewProfile && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIconWrap}>
                  <IconBuilding size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Official Foundation profile</Text>
                  <Text style={styles.cardSubtitle}>
                    Private records; publication is controlled separately.
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Legal Foundation name</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={legalName}
                    onChangeText={setLegalName}
                    placeholder="CareGanga Health"
                    placeholderTextColor="#94A3B8"
                    editable={canManageProfile && !busy}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Official contact</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={officialContact}
                    onChangeText={setOfficialContact}
                    placeholder="Phone number or official contact"
                    placeholderTextColor="#94A3B8"
                    editable={canManageProfile && !busy}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Postal address</Text>
                <View style={styles.textareaWrap}>
                  <TextInput
                    style={styles.textarea}
                    value={postalAddress}
                    onChangeText={setPostalAddress}
                    placeholder="Registered headquarter or official address"
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    editable={canManageProfile && !busy}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Registration reference</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={registrationRef}
                    onChangeText={setRegistrationRef}
                    placeholder="Trust / Society / Section 8 reference"
                    placeholderTextColor="#94A3B8"
                    editable={canManageProfile && !busy}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Registration authority</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={registrationAuthority}
                    onChangeText={setRegistrationAuthority}
                    placeholder="Registrar of Societies / MCA"
                    placeholderTextColor="#94A3B8"
                    editable={canManageProfile && !busy}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Registration date (YYYY-MM-DD)</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={registrationDate}
                    onChangeText={setRegistrationDate}
                    placeholder="2026-11-18"
                    placeholderTextColor="#94A3B8"
                    editable={canManageProfile && !busy}
                  />
                </View>
              </View>

              {profile && (
                <Text style={styles.metaTimestamp}>
                  Last verified update: {new Date(profile.updatedAt).toLocaleDateString()}
                </Text>
              )}

              <View style={styles.actionRow}>
                {profile && (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => void showHistory("PROFILE", "self", "Foundation Profile")}
                    disabled={busy}
                  >
                    <IconClock size={16} color="#334155" />
                    <Text style={styles.secondaryButtonText}>View history</Text>
                  </Pressable>
                )}

                {canManageProfile && (
                  <Pressable
                    style={[styles.primaryButton, busy && styles.buttonDisabled]}
                    onPress={handleSaveProfile}
                    disabled={busy}
                  >
                    <IconShieldCheck size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Save official profile</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>
        )}

        {/* TAB 2: GEOGRAPHY */}
        {tab === "GEOGRAPHY" && canViewGeography && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Toggle: List vs Add Area */}
            <View style={styles.subModeRow}>
              <Pressable
                style={[styles.subModePill, geoMode === "LIST" && styles.subModePillActive]}
                onPress={() => setGeoMode("LIST")}
              >
                <Text
                  style={[
                    styles.subModePillText,
                    geoMode === "LIST" && styles.subModePillTextActive
                  ]}
                >
                  Areas List ({visibleAreas.length})
                </Text>
              </Pressable>

              {canManageGeography && (
                <Pressable
                  style={[styles.subModePill, geoMode === "FORM" && styles.subModePillActive]}
                  onPress={() => {
                    resetAreaForm();
                    setGeoMode("FORM");
                  }}
                >
                  <IconPlusCircle size={15} color={geoMode === "FORM" ? "#FFFFFF" : "#2563EB"} />
                  <Text
                    style={[
                      styles.subModePillText,
                      geoMode === "FORM" && styles.subModePillTextActive
                    ]}
                  >
                    {areaRef ? "Edit Area" : "+ Add Area"}
                  </Text>
                </Pressable>
              )}
            </View>

            {geoMode === "LIST" ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderIconWrap}>
                    <IconMapPin size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>State, district & local areas</Text>
                    <Text style={styles.cardSubtitle}>
                      Only real Foundation geography records are listed.
                    </Text>
                  </View>
                </View>

                {/* Search Box */}
                <View style={styles.searchBox}>
                  <IconSearch size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    value={geoSearch}
                    onChangeText={setGeoSearch}
                    placeholder="Search areas by name..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                {/* Areas List */}
                <View style={styles.itemsList}>
                  {visibleAreas.map((item) => (
                    <View key={item.areaRef} style={styles.listItemCard}>
                      <View style={styles.listItemTopRow}>
                        <Text style={styles.listItemName}>{item.name}</Text>
                        <View style={[styles.levelBadge, getLevelBadgeStyle(item.level)]}>
                          <Text style={[styles.levelBadgeText, getLevelBadgeTextStyle(item.level)]}>
                            {item.level.toLowerCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.listItemMetaRow}>
                        <Text style={styles.listItemMetaText}>
                          Parent:{" "}
                          <Text style={{ fontWeight: "600", color: "#1E293B" }}>
                            {areas.find((a) => a.areaRef === item.parentRef)?.name ?? "Foundation"}
                          </Text>
                        </Text>

                        <View
                          style={[
                            styles.statusBadge,
                            item.status === "ACTIVE"
                              ? styles.statusBadgeActive
                              : styles.statusBadgeInactive
                          ]}
                        >
                          {item.status === "ACTIVE" ? (
                            <IconCheckCircle size={12} color="#15803D" />
                          ) : (
                            <IconXCircle size={12} color="#64748B" />
                          )}
                          <Text
                            style={[
                              styles.statusBadgeText,
                              item.status === "ACTIVE"
                                ? styles.statusBadgeTextActive
                                : styles.statusBadgeTextInactive
                            ]}
                          >
                            {item.status}
                          </Text>
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={styles.itemActionRow}>
                        {canManageGeography && (
                          <Pressable
                            style={styles.itemSmallButton}
                            onPress={() => editArea(item)}
                          >
                            <IconPencil size={13} color="#334155" />
                            <Text style={styles.itemSmallButtonText}>Edit</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.itemSmallButton}
                          onPress={() => void showHistory("AREA", item.areaRef, item.name)}
                        >
                          <IconClock size={13} color="#334155" />
                          <Text style={styles.itemSmallButtonText}>History</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  {visibleAreas.length === 0 && (
                    <Text style={styles.emptyText}>No recorded areas match the search filter.</Text>
                  )}
                </View>

                {areaNextOffset !== null && (
                  <Pressable
                    style={[styles.secondaryButton, { marginTop: 12 }]}
                    onPress={() => void loadMoreAreas()}
                    disabled={busy}
                  >
                    <Text style={styles.secondaryButtonText}>Load more verified areas</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              /* Add/Edit Geography Form */
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderIconWrap}>
                    <IconMapPin size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {areaRef ? "Edit geography area" : "Add real geography"}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      Configure hierarchical area under Foundation scope
                    </Text>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <NativeCustomDropdown
                    label="Level"
                    value={areaLevel}
                    disabled={Boolean(areaRef) || busy}
                    onChange={(val) => {
                      setAreaLevel(val);
                      setAreaParent("");
                    }}
                    options={levels.map((l) => ({
                      value: l,
                      label: l.toLowerCase()
                    }))}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Area name</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={areaName}
                      onChangeText={setAreaName}
                      placeholder="e.g. Uttar Pradesh, Varanasi, Kashi Vidyapeeth"
                      placeholderTextColor="#94A3B8"
                      editable={!busy}
                    />
                  </View>
                </View>

                {areaLevel !== "STATE" && (
                  <View style={styles.formGroup}>
                    <NativeCustomDropdown
                      label="Parent location"
                      value={areaParent}
                      disabled={busy}
                      placeholder="Choose existing parent"
                      searchable
                      onChange={(val) => setAreaParent(val)}
                      options={eligibleParents.map((a) => ({
                        value: a.areaRef,
                        label: `${a.name} · ${a.level.toLowerCase()}`
                      }))}
                    />
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Local code (optional)</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={areaCode}
                      onChangeText={setAreaCode}
                      placeholder="e.g. UP, VAR, KVP"
                      placeholderTextColor="#94A3B8"
                      editable={!busy}
                    />
                  </View>
                </View>

                {areaRef && (
                  <View style={styles.formGroup}>
                    <NativeCustomDropdown
                      label="Status"
                      value={areaStatus}
                      disabled={busy}
                      onChange={(val) => setAreaStatus(val)}
                      options={[
                        { value: "ACTIVE", label: "Active" },
                        { value: "INACTIVE", label: "Inactive" }
                      ]}
                    />
                  </View>
                )}

                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      resetAreaForm();
                      setGeoMode("LIST");
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.primaryButton, (!areaName.trim() || busy) && styles.buttonDisabled]}
                    onPress={handleSaveArea}
                    disabled={!areaName.trim() || busy}
                  >
                    <Text style={styles.primaryButtonText}>
                      {areaRef ? "Save changes" : "Add area"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* TAB 3: DEPARTMENTS & COMMITTEES */}
        {tab === "DEPARTMENTS" && canViewDepartments && (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 4 Metric KPI Cards (2x2 Grid) */}
            {deptSummary && (
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#EFF6FF" }]}>
                    <IconLayers size={20} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={styles.kpiLabel}>Total records</Text>
                    <Text style={styles.kpiValue}>{deptSummary.total}</Text>
                  </View>
                </View>

                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#DCFCE7" }]}>
                    <IconCheckCircle size={20} color="#16A34A" />
                  </View>
                  <View>
                    <Text style={styles.kpiLabel}>Active</Text>
                    <Text style={styles.kpiValue}>{deptSummary.active}</Text>
                  </View>
                </View>

                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#FEF3C7" }]}>
                    <IconXCircle size={20} color="#D97706" />
                  </View>
                  <View>
                    <Text style={styles.kpiLabel}>Inactive</Text>
                    <Text style={styles.kpiValue}>{deptSummary.inactive}</Text>
                  </View>
                </View>

                <View style={styles.kpiCard}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: "#F3E8FF" }]}>
                    <IconUsers size={20} color="#9333EA" />
                  </View>
                  <View>
                    <Text style={styles.kpiLabel}>Committees</Text>
                    <Text style={styles.kpiValue}>{deptSummary.committees}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Main Departments Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIconWrap}>
                  <IconLayers size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Foundation departments & committees</Text>
                  <Text style={styles.cardSubtitle}>
                    Foundation-wide records only; branch management is separate.
                  </Text>
                </View>
              </View>

              {/* Add Button */}
              {canManageDepartments && (
                <Pressable
                  style={[styles.primaryButton, { alignSelf: "flex-start", marginBottom: 12 }]}
                  onPress={() => {
                    resetDeptForm();
                    setDeptModalOpen(true);
                  }}
                >
                  <IconPlusCircle size={16} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>+ Add department / committee</Text>
                </Pressable>
              )}

              {/* Search and Filters */}
              <View style={styles.searchBox}>
                <IconSearch size={16} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  value={deptSearch}
                  onChangeText={setDeptSearch}
                  placeholder="Search loaded departments..."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <NativeCustomDropdown
                    value={deptKindFilter}
                    onChange={setDeptKindFilter}
                    options={[
                      { value: "ALL", label: "All types" },
                      { value: "DEPARTMENT", label: "Departments" },
                      { value: "COMMITTEE", label: "Committees" }
                    ]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <NativeCustomDropdown
                    value={deptStatusFilter}
                    onChange={setDeptStatusFilter}
                    options={[
                      { value: "ALL", label: "All statuses" },
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" }
                    ]}
                  />
                </View>
              </View>

              {/* Departments List */}
              <View style={styles.itemsList}>
                {visibleDepartments.map((item) => (
                  <View key={item.departmentRef} style={styles.listItemCard}>
                    <View style={styles.listItemTopRow}>
                      <Text style={styles.listItemName}>{item.name}</Text>
                      <View
                        style={[
                          styles.levelBadge,
                          item.kind === "COMMITTEE"
                            ? { backgroundColor: "#F3E8FF" }
                            : { backgroundColor: "#EFF6FF" }
                        ]}
                      >
                        <Text
                          style={[
                            styles.levelBadgeText,
                            item.kind === "COMMITTEE"
                              ? { color: "#7C3AED" }
                              : { color: "#2563EB" }
                          ]}
                        >
                          {item.kind.toLowerCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.listItemMetaRow}>
                      <Text style={styles.listItemMetaText}>
                        Head:{" "}
                        <Text style={{ fontWeight: "600", color: "#1E293B" }}>
                          {item.headDisplayName ??
                            (item.headAccountRef ? "Assigned account" : "Unassigned")}
                        </Text>
                      </Text>

                      <View
                        style={[
                          styles.statusBadge,
                          item.active ? styles.statusBadgeActive : styles.statusBadgeInactive
                        ]}
                      >
                        {item.active ? (
                          <IconCheckCircle size={12} color="#15803D" />
                        ) : (
                          <IconXCircle size={12} color="#64748B" />
                        )}
                        <Text
                          style={[
                            styles.statusBadgeText,
                            item.active ? styles.statusBadgeTextActive : styles.statusBadgeTextInactive
                          ]}
                        >
                          {item.active ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.itemActionRow}>
                      <Pressable
                        style={[styles.itemSmallButton, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                        onPress={() => {
                          setFocusedDeptRef(item.departmentRef);
                          setOfficeholdersModalOpen(true);
                        }}
                      >
                        <IconUsers size={13} color="#2563EB" />
                        <Text style={[styles.itemSmallButtonText, { color: "#2563EB" }]}>
                          Officeholders
                        </Text>
                      </Pressable>

                      {canManageDepartments && (
                        <Pressable
                          style={styles.itemSmallButton}
                          onPress={() => editDept(item)}
                        >
                          <IconPencil size={13} color="#334155" />
                          <Text style={styles.itemSmallButtonText}>Edit</Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={styles.itemSmallButton}
                        onPress={() => void showHistory("DEPARTMENT", item.departmentRef, item.name)}
                      >
                        <IconClock size={13} color="#334155" />
                        <Text style={styles.itemSmallButtonText}>History</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {visibleDepartments.length === 0 && (
                  <Text style={styles.emptyText}>No recorded departments match the filter.</Text>
                )}
              </View>

              {deptNextOffset !== null && (
                <Pressable
                  style={[styles.secondaryButton, { marginTop: 12 }]}
                  onPress={() => void loadMoreDepartments()}
                  disabled={busy}
                >
                  <Text style={styles.secondaryButtonText}>Load more verified departments</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}

        {/* MODAL: Add / Edit Department */}
        <Modal
          visible={deptModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setDeptModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {deptRef ? "Edit Department / Committee" : "Add Department / Committee"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setDeptModalOpen(false)}
                >
                  <IconClose size={20} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 450 }}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.formGroup}>
                  <NativeCustomDropdown
                    label="Record type"
                    value={deptKind}
                    disabled={busy}
                    onChange={setDeptKind}
                    options={[
                      { value: "DEPARTMENT", label: "Department" },
                      { value: "COMMITTEE", label: "Committee" }
                    ]}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Name</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={deptName}
                      onChangeText={setDeptName}
                      placeholder="Department or committee name"
                      placeholderTextColor="#94A3B8"
                      editable={!busy}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Description</Text>
                  <View style={styles.textareaWrap}>
                    <TextInput
                      style={styles.textarea}
                      value={deptDescription}
                      onChangeText={setDeptDescription}
                      placeholder="Brief purpose or charter"
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={3}
                      editable={!busy}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Opening date (YYYY-MM-DD)</Text>
                  <View style={styles.inputWrap}>
                    <TextInput
                      style={styles.input}
                      value={deptOpening}
                      onChangeText={setDeptOpening}
                      placeholder="2026-11-26"
                      placeholderTextColor="#94A3B8"
                      editable={!busy}
                    />
                  </View>
                </View>

                {canViewGeography && (
                  <View style={styles.formGroup}>
                    <NativeCustomDropdown
                      label="Foundation area (optional)"
                      value={deptArea}
                      disabled={busy}
                      placeholder="No specific area"
                      searchable
                      onChange={setDeptArea}
                      options={[
                        { value: "", label: "No specific area" },
                        ...areas
                          .filter((x) => x.status === "ACTIVE")
                          .map((x) => ({
                            value: x.areaRef,
                            label: `${x.name} · ${x.level.toLowerCase()}`
                          }))
                      ]}
                    />
                  </View>
                )}

                <View style={styles.formGroup}>
                  <NativeCustomDropdown
                    label="Parent department (optional)"
                    value={deptParent}
                    disabled={busy}
                    placeholder="Foundation top level"
                    searchable
                    onChange={setDeptParent}
                    options={[
                      { value: "", label: "Foundation top level" },
                      ...departments
                        .filter((x) => x.active && x.departmentRef !== deptRef)
                        .map((x) => ({
                          value: x.departmentRef,
                          label: x.name
                        }))
                    ]}
                  />
                </View>

                {canAssignDepartments && (
                  <View style={styles.formGroup}>
                    <NativeCustomDropdown
                      label="Head officeholder (optional)"
                      value={deptHead}
                      disabled={busy}
                      placeholder="Unassigned"
                      searchable
                      onChange={setDeptHead}
                      options={[
                        { value: "", label: "Unassigned" },
                        ...officeholders.map((x) => ({
                          value: x.value,
                          label: x.label
                        }))
                      ]}
                    />
                  </View>
                )}

                {deptRef && (
                  <View style={styles.formGroup}>
                    <NativeCustomDropdown
                      label="Status"
                      value={deptActive ? "ACTIVE" : "INACTIVE"}
                      disabled={busy}
                      onChange={(val) => setDeptActive(val === "ACTIVE")}
                      options={[
                        { value: "ACTIVE", label: "Active" },
                        { value: "INACTIVE", label: "Inactive" }
                      ]}
                    />
                  </View>
                )}

                <View style={[styles.actionRow, { marginTop: 16 }]}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setDeptModalOpen(false)}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.primaryButton, (!deptName.trim() || busy) && styles.buttonDisabled]}
                    onPress={handleSaveDept}
                    disabled={!deptName.trim() || busy}
                  >
                    <Text style={styles.primaryButtonText}>
                      {deptRef ? "Save department" : "Add department"}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL: Officeholders Sheet */}
        <Modal
          visible={officeholdersModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setOfficeholdersModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Officeholders — {focusedDept?.name ?? "Department"}
                  </Text>
                  <Text style={styles.cardSubtitle}>
                    Active and past assigned Foundation staff
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setOfficeholdersModalOpen(false)}
                >
                  <IconClose size={20} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 450 }}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Participants List */}
                <View style={{ marginBottom: 16 }}>
                  {participants.map((p) => (
                    <View key={p.participationRef} style={styles.participantItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.participantName}>
                          {p.displayName ?? "Assigned staff account"}
                        </Text>
                        <Text style={styles.participantRole}>{p.officeRole}</Text>
                        <View
                          style={[
                            styles.statusBadge,
                            p.activeUntil ? styles.statusBadgeInactive : styles.statusBadgeActive,
                            { alignSelf: "flex-start", marginTop: 4 }
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              p.activeUntil
                                ? styles.statusBadgeTextInactive
                                : styles.statusBadgeTextActive
                            ]}
                          >
                            {p.activeUntil ? "Former" : "Active"}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        {!p.activeUntil && canAssignDepartments && (
                          <Pressable
                            style={styles.itemSmallButton}
                            disabled={busy}
                            onPress={() =>
                              save(
                                "POST",
                                "departments/" +
                                  focusedDeptRef +
                                  "/participants/" +
                                  p.participationRef +
                                  "/end",
                                "PARTICIPANT_END",
                                {}
                              )
                            }
                          >
                            <Text style={styles.itemSmallButtonText}>End</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.itemSmallButton}
                          onPress={() =>
                            void showHistory("PARTICIPANT", p.participationRef, "Officeholder assignment")
                          }
                        >
                          <IconClock size={12} color="#334155" />
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  {participants.length === 0 && (
                    <Text style={styles.emptyText}>No officeholders recorded for this record.</Text>
                  )}
                </View>

                {/* Assign New Officeholder */}
                {canAssignDepartments && focusedDept?.active && (
                  <View style={{ paddingTop: 12, borderTopWidth: 1, borderColor: "#E2E8F0" }}>
                    <Text style={[styles.cardTitle, { fontSize: 14, marginBottom: 8 }]}>
                      Assign new officeholder
                    </Text>

                    <View style={styles.formGroup}>
                      <NativeCustomDropdown
                        label="Eligible staff account"
                        value={participantAccount}
                        placeholder="Choose staff account"
                        searchable
                        onChange={setParticipantAccount}
                        options={officeholders.map((a) => ({
                          value: a.value,
                          label: a.label
                        }))}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Responsibility / Role</Text>
                      <View style={styles.inputWrap}>
                        <TextInput
                          style={styles.input}
                          value={participantRole}
                          onChangeText={setParticipantRole}
                          placeholder="Chairperson, Secretary, Coordinator…"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                    </View>

                    <Pressable
                      style={[
                        styles.primaryButton,
                        (!participantAccount || !participantRole.trim() || busy) &&
                          styles.buttonDisabled
                      ]}
                      disabled={!participantAccount || !participantRole.trim() || busy}
                      onPress={() =>
                        save("POST", "departments/" + focusedDeptRef + "/participants", "PARTICIPANT_ADD", {
                          accountRef: participantAccount,
                          officeRole: participantRole
                        })
                      }
                    >
                      <IconShieldCheck size={16} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Assign officeholder</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL: Audit Trail / History */}
        <Modal
          visible={historyModalOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setHistoryModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {historyTitle} — History
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setHistoryModalOpen(false)}
                >
                  <IconClose size={20} color="#64748B" />
                </Pressable>
              </View>

              <ScrollView
                style={{ maxHeight: 400 }}
                contentContainerStyle={{ padding: 16 }}
              >
                {historyEvents.map((evt, idx) => (
                  <View key={evt.action + "-" + evt.recordedAt + "-" + idx} style={styles.historyItem}>
                    <IconClock size={16} color="#64748B" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyAction}>
                        {evt.action.replaceAll("_", " ").toLowerCase()}
                      </Text>
                      <Text style={styles.historyMeta}>
                        Version {evt.version} · {new Date(evt.recordedAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}

                {historyEvents.length === 0 && (
                  <Text style={styles.emptyText}>No recorded changes found.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getLevelBadgeStyle(level: string) {
  switch (level.toUpperCase()) {
    case "STATE":
      return { backgroundColor: "#F3E8FF" };
    case "DISTRICT":
      return { backgroundColor: "#EFF6FF" };
    case "SUBDIVISION":
      return { backgroundColor: "#CCFBF1" };
    case "BLOCK":
      return { backgroundColor: "#FEF3C7" };
    default:
      return { backgroundColor: "#F1F5F9" };
  }
}

function getLevelBadgeTextStyle(level: string) {
  switch (level.toUpperCase()) {
    case "STATE":
      return { color: "#7C3AED" };
    case "DISTRICT":
      return { color: "#2563EB" };
    case "SUBDIVISION":
      return { color: "#0D9488" };
    case "BLOCK":
      return { color: "#B45309" };
    default:
      return { color: "#475569" };
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  keyboardView: {
    flex: 1
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  arrowBackButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#F1F5F9"
  },
  topBarTextWrap: {
    flex: 1
  },
  topBarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  topBarSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  tabButtonActive: {
    backgroundColor: "#2563EB"
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569"
  },
  tabButtonTextActive: {
    color: "#FFFFFF"
  },
  loadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#EFF6FF"
  },
  loadingText: {
    fontSize: 12,
    color: "#1E40AF"
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#DCFCE7"
  },
  noticeText: {
    fontSize: 12,
    color: "#15803D"
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FEE2E2"
  },
  errorText: {
    fontSize: 12,
    color: "#B91C1C"
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: 16,
    gap: 16
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16
  },
  cardHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B"
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  formGroup: {
    marginBottom: 12
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 4
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF"
  },
  input: {
    height: 42,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#0F172A"
  },
  textareaWrap: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF"
  },
  textarea: {
    minHeight: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top"
  },
  metaTimestamp: {
    fontSize: 11,
    color: "#64748B",
    marginVertical: 8
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: "#2563EB",
    borderRadius: 8,
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600"
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  subModeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4
  },
  subModePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  subModePillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB"
  },
  subModePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155"
  },
  subModePillTextActive: {
    color: "#FFFFFF"
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    padding: 0
  },
  itemsList: {
    gap: 10
  },
  listItemCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12
  },
  listItemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  listItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1
  },
  listItemMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  listItemMetaText: {
    fontSize: 12,
    color: "#64748B"
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999
  },
  statusBadgeActive: {
    backgroundColor: "#DCFCE7"
  },
  statusBadgeInactive: {
    backgroundColor: "#F1F5F9"
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600"
  },
  statusBadgeTextActive: {
    color: "#15803D"
  },
  statusBadgeTextInactive: {
    color: "#64748B"
  },
  itemActionRow: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    justifyContent: "flex-end"
  },
  itemSmallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6
  },
  itemSmallButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155"
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 20,
    color: "#64748B",
    fontSize: 13
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpiCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748B"
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    lineHeight: 22
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 16
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 8
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0"
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    marginBottom: 8
  },
  participantName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  participantRole: {
    fontSize: 12,
    color: "#475569"
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  historyAction: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
    textTransform: "capitalize"
  },
  historyMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  }
});
