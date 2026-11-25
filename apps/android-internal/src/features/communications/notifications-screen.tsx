import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { NativeCustomDropdown } from "../../shared/native-custom-dropdown";
import {
  IconBell,
  IconClose,
  IconFileText,
  IconMail,
  IconSearch,
  IconSend,
  IconShieldCheck,
  IconSliders,
  IconMegaphone,
  IconCalendar,
  IconRefresh,
  IconInbox,
  IconPlusCircle,
  IconCheckCircle,
  IconXCircle,
  IconBarChart2,
  IconCheck,
  IconUsers,
  IconArrowLeft
} from "../dashboard/dashboard-icons";

type Channel = "IN_APP" | "EMAIL" | "SMS";
type Option = { value: string; label: string };

type Notice = {
  noticeRef: string;
  title: string;
  body: string;
  state: string;
  revision: number;
  audienceCount: number;
  priority: string;
  purpose: string;
  channels: Channel[];
  audienceKind: string;
  targetHref: string | null;
  expiresAt: string;
  scheduledAt: string | null;
  createdAt: string;
};

type InboxItem = {
  notificationRef: string;
  title: string;
  body: string;
  channel: Channel;
  status: string;
  receivedAt: string;
  read: boolean;
};

type Provider = { channel: string; state: string; configured: boolean };

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

type MobileProof = {
  hasNumber: boolean;
  verified: boolean;
  maskedContact: string | null;
  verifiedAt: string | null;
  providerConfigured: boolean;
};

type Props = {
  token: string;
  onExit: () => void;
  onExpired: () => void;
};

async function api<T>(token: string, path: string, method: "GET" | "POST" = "GET", body?: object) {
  let response: Response;
  try {
    response = await identityRequest("/api/communications/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error(method === "POST" ? "UNKNOWN" : "OFFLINE");
  }
  if (response.status === 401) throw Error("EXPIRED");
  if (response.status === 403) throw Error("DENIED");
  if (response.status === 409) throw Error("CONFLICT");
  if (response.status === 400) throw Error("INVALID");
  if (!response.ok) throw Error(method === "POST" ? "UNKNOWN" : "OFFLINE");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

async function mobile<T>(token: string, path: string, method: "GET" | "POST" = "GET", body?: object): Promise<T> {
  let r: Response;
  try {
    r = await identityRequest("/api/identity/mobile/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error("OFFLINE");
  }
  if (r.status === 401) throw Error("EXPIRED");
  if (r.status === 403) throw Error("DENIED");
  if (!r.ok) throw Error("OFFLINE");
  try {
    return (await r.json()) as T;
  } catch {
    throw Error("OFFLINE");
  }
}

function explain(e: unknown) {
  const code = e instanceof Error ? e.message : "UNKNOWN";
  return code === "EXPIRED"
    ? "The Foundation session expired."
    : code === "DENIED"
    ? "Your current role does not permit this operation."
    : code === "CONFLICT"
    ? "This record changed. Refresh first."
    : code === "INVALID"
    ? "Check entered information."
    : "Action not confirmed. Check the original request before retry.";
}

export function NotificationsScreen({ token, onExit, onExpired }: Props) {
  // Navigation Tabs: NOTICES vs INBOX vs EMAIL_TEMPLATES
  const [activeTab, setActiveTab] = useState<"NOTICES" | "INBOX" | "EMAIL_TEMPLATES">("NOTICES");

  // Core Data State
  const [notices, setNotices] = useState<Notice[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [emailReferences, setEmailReferences] = useState<ClientEmailReference[]>([]);
  const [mobileProof, setMobileProof] = useState<MobileProof | null>(null);

  // Loading & Alerts
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  // Search & Filter State for Notices
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [audienceFilter, setAudienceFilter] = useState("ALL");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sub-status Filter Pill
  const [subStatusPill, setSubStatusPill] = useState("ALL");

  // Compose Modal State
  const [composeOpen, setComposeOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newPriority, setNewPriority] = useState("NORMAL");
  const [newPurpose, setNewPurpose] = useState("TRANSACTIONAL");
  const [newAudienceKind, setNewAudienceKind] = useState<"ALL_ACTIVE" | "ROLE" | "INDIVIDUAL">("ALL_ACTIVE");
  const [newEmail, setNewEmail] = useState(false);
  const [newSms, setNewSms] = useState(false);
  const [newExpiry, setNewExpiry] = useState("");

  // Password Authorization Modal (for Approve, Cancel, Dispatch)
  const [reviewAction, setReviewAction] = useState<{
    type: "APPROVE" | "CANCEL";
    ref: string;
    revision: number;
    title: string;
  } | null>(null);
  const [adminPassword, setAdminPassword] = useState("");

  // Delivery Telemetry Modal
  const [telemetryRef, setTelemetryRef] = useState<string | null>(null);
  const [telemetryCounts, setTelemetryCounts] = useState<Array<{ channel: string; status: string; count: number }>>([]);

  // Email Templates Search
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ClientEmailReference | null>(null);

  // Mobile Proof Code
  const [mobileCode, setMobileCode] = useState("");
  const [mobileBusy, setMobileBusy] = useState(false);

  // Reload all data
  const loadData = useCallback(async () => {
    setLoading(true);
    setAlertMsg("");
    try {
      const [noticesRes, inboxRes, providersRes] = await Promise.all([
        api<{ notices: Notice[] }>(token, "notices?limit=30").catch(() => ({ notices: [] })),
        api<{ items: InboxItem[] }>(token, "inbox?limit=30").catch(() => ({ items: [] })),
        api<{ providers: Provider[] }>(token, "providers").catch(() => ({ providers: [] }))
      ]);

      setNotices(noticesRes.notices ?? []);
      setInbox(inboxRes.items ?? []);
      setProviders(providersRes.providers ?? []);

      try {
        const proof = await mobile<MobileProof>(token, "status");
        setMobileProof(proof);
      } catch {
        setMobileProof(null);
      }
    } catch (e) {
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
      else setAlertMsg(explain(e));
    } finally {
      setLoading(false);
    }
  }, [token, onExpired]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadTemplates = async () => {
    try {
      const d = await api<{ templates: ClientEmailReference[] }>(token, "templates/client-references");
      setEmailReferences(d.templates ?? []);
    } catch {
      setEmailReferences([]);
    }
  };

  const loadTelemetry = async (ref: string) => {
    setTelemetryRef(ref);
    try {
      const d = await api<{ counts: Array<{ channel: string; status: string; count: number }> }>(
        token,
        `notices/${encodeURIComponent(ref)}/deliveries`
      );
      setTelemetryCounts(d.counts ?? []);
    } catch {
      setTelemetryCounts([]);
    }
  };

  const markInboxRead = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(token, "inbox/" + encodeURIComponent(id) + "/read", "POST");
      await loadData();
    } catch (e) {
      setAlertMsg(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const submitNoticeDraft = async () => {
    if (!newTitle.trim() || !newBody.trim() || busy) return;
    setBusy(true);
    setAlertMsg("");
    try {
      const channels: Channel[] = ["IN_APP"];
      if (newEmail) channels.push("EMAIL");
      if (newSms) channels.push("SMS");

      const expiry =
        newExpiry.trim() ||
        new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0];

      await api(token, "notices", "POST", {
        title: newTitle.trim(),
        body: newBody.trim(),
        priority: newPriority,
        purpose: newPurpose,
        channels,
        audienceKind: newAudienceKind,
        expiresAt: expiry,
        requestKey: Crypto.randomUUID()
      });

      setComposeOpen(false);
      setNewTitle("");
      setNewBody("");
      setNewExpiry("");
      await loadData();
    } catch (e) {
      setAlertMsg(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const executeReviewDecision = async () => {
    if (!reviewAction || !adminPassword.trim() || busy) return;
    setBusy(true);
    setAlertMsg("");
    try {
      await api(
        token,
        `notices/${encodeURIComponent(reviewAction.ref)}/decision`,
        "POST",
        {
          action: reviewAction.type,
          expectedRevision: reviewAction.revision,
          currentPassword: adminPassword.trim(),
          requestKey: Crypto.randomUUID()
        }
      );

      setReviewAction(null);
      setAdminPassword("");
      await loadData();
    } catch (e) {
      setAlertMsg(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const startPhoneProof = async () => {
    if (busy || mobileBusy) return;
    setMobileBusy(true);
    setAlertMsg("");
    try {
      await mobile(token, "verify/start", "POST");
      setAlertMsg("Verification code requested for recorded contact.");
    } catch (e) {
      setAlertMsg(explain(e));
    } finally {
      setMobileBusy(false);
    }
  };

  const confirmPhoneProof = async () => {
    if (busy || mobileBusy || !/^\d{4,10}$/.test(mobileCode)) return;
    setMobileBusy(true);
    setAlertMsg("");
    try {
      await mobile(token, "verify/confirm", "POST", { code: mobileCode });
      setMobileCode("");
      await loadData();
      setAlertMsg("Mobile contact successfully verified.");
    } catch (e) {
      setAlertMsg(explain(e));
    } finally {
      setMobileBusy(false);
    }
  };

  // Real KPI calculations matching Web
  const totalNotifications = notices.length;
  const activeNotices = notices.filter((n) => n.state === "APPROVED" || n.state === "ACTIVE").length;
  const scheduledNotices = notices.filter((n) => n.state === "SCHEDULED").length;
  const draftNotices = notices.filter((n) => n.state === "DRAFT").length;
  const expiredNotices = notices.filter((n) => n.state === "EXPIRED").length;
  const cancelledNotices = notices.filter((n) => n.state === "CANCELLED").length;
  const inAppDelivered = inbox.length;
  const unreadInboxCount = inbox.filter((i) => !i.read).length;
  const recipientsReached = useMemo(() => {
    return notices.reduce((acc, n) => acc + (n.audienceCount || 0), 0);
  }, [notices]);

  // Notice Filtering Logic
  const filteredNotices = notices.filter((n) => {
    if (subStatusPill === "ACTIVE" && n.state !== "APPROVED" && n.state !== "ACTIVE") return false;
    if (subStatusPill === "DRAFT" && n.state !== "DRAFT") return false;
    if (subStatusPill === "SCHEDULED" && n.state !== "SCHEDULED") return false;
    if (subStatusPill === "EXPIRED" && n.state !== "EXPIRED") return false;
    if (subStatusPill === "CANCELLED" && n.state !== "CANCELLED") return false;

    if (statusFilter !== "ALL" && n.state !== statusFilter) return false;
    if (priorityFilter !== "ALL" && n.priority !== priorityFilter) return false;
    if (purposeFilter !== "ALL" && n.purpose !== purposeFilter) return false;
    if (audienceFilter !== "ALL" && n.audienceKind !== audienceFilter) return false;

    if (appliedKeyword.trim()) {
      const q = appliedKeyword.toLowerCase();
      const match =
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.state.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Top Header Row with Actions */}
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={onExit} style={styles.backBtn} accessibilityLabel="Back">
            <IconArrowLeft size={18} color="#334155" />
          </Pressable>

          <View style={styles.headerInfo}>
            <View style={styles.titleIconRow}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <View style={styles.verifiedCheckBadge}>
                <IconCheck size={12} color="#2563EB" />
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              Complete Command Center & Control Panel
            </Text>
          </View>

          <View style={styles.headerActionsRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.headerBtnPrimary}
              onPress={() => setComposeOpen(true)}
            >
              <IconPlusCircle size={14} color="#FFFFFF" />
              <Text style={styles.headerBtnPrimaryText}>Draft Notice</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.headerBtnSecondary}
              disabled={loading}
              onPress={() => void loadData()}
            >
              <IconRefresh size={14} color="#334155" />
              <Text style={styles.headerBtnSecondaryText}>Refresh</Text>
            </Pressable>
          </View>
        </View>

        {/* 6 KPI Metric Cards matching Web - 2 columns, Top Row with Icon & Value, 100% full visible labels, NO ELLIPSIS */}
        <View style={styles.kpiGrid}>
          {/* 1. Total Notifications */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#DBEAFE" }]}>
                <IconSend size={18} color="#2563EB" />
              </View>
              <Text style={styles.kpiValue}>{totalNotifications}</Text>
            </View>
            <Text style={styles.kpiLabel}>Total Notifications</Text>
            <Text style={styles.kpiSub}>All time</Text>
          </View>

          {/* 2. Active Notices */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#DCFCE7" }]}>
                <IconMegaphone size={18} color="#16A34A" />
              </View>
              <Text style={[styles.kpiValue, { color: "#16A34A" }]}>{activeNotices}</Text>
            </View>
            <Text style={styles.kpiLabel}>Active Notices</Text>
            <Text style={styles.kpiSub}>Currently live</Text>
          </View>

          {/* 3. Recipients Reached */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#FEF3C7" }]}>
                <IconUsers size={18} color="#D97706" />
              </View>
              <Text style={[styles.kpiValue, { color: "#D97706" }]}>{recipientsReached}</Text>
            </View>
            <Text style={styles.kpiLabel}>Recipients Reached</Text>
            <Text style={styles.kpiSub}>Across channels</Text>
          </View>

          {/* 4. In-App Delivered */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#F3E8FF" }]}>
                <IconMail size={18} color="#9333EA" />
              </View>
              <Text style={[styles.kpiValue, { color: "#9333EA" }]}>{inAppDelivered}</Text>
            </View>
            <Text style={styles.kpiLabel}>In-App Delivered</Text>
            <Text style={styles.kpiSub}>Personal inbox</Text>
          </View>

          {/* 5. Draft Notices */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#FEE2E2" }]}>
                <IconFileText size={18} color="#DC2626" />
              </View>
              <Text style={[styles.kpiValue, { color: "#DC2626" }]}>{draftNotices}</Text>
            </View>
            <Text style={styles.kpiLabel}>Draft Notices</Text>
            <Text style={styles.kpiSub}>Pending review</Text>
          </View>

          {/* 6. Scheduled */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiTopRow}>
              <View style={[styles.kpiIconWrap, { backgroundColor: "#CCFBF1" }]}>
                <IconCalendar size={18} color="#0D9488" />
              </View>
              <Text style={[styles.kpiValue, { color: "#0D9488" }]}>{scheduledNotices}</Text>
            </View>
            <Text style={styles.kpiLabel}>Scheduled Notices</Text>
            <Text style={styles.kpiSub}>Queued to go out</Text>
          </View>
        </View>

        {/* Main Workspace Navigation Tabs - Smooth Horizontal Scroll, Full Labels Visible, Zero Truncation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarScroll}
          contentContainerStyle={styles.tabScrollContainer}
        >
          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveTab("NOTICES")}
            style={[styles.tabButton, activeTab === "NOTICES" && styles.tabButtonActive]}
          >
            <IconMegaphone size={16} color={activeTab === "NOTICES" ? "#4F46E5" : "#64748B"} />
            <Text style={[styles.tabButtonText, activeTab === "NOTICES" && styles.tabButtonTextActive]}>
              Notices & Broadcasts
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveTab("INBOX")}
            style={[styles.tabButton, activeTab === "INBOX" && styles.tabButtonActive]}
          >
            <IconInbox size={16} color={activeTab === "INBOX" ? "#4F46E5" : "#64748B"} />
            <Text style={[styles.tabButtonText, activeTab === "INBOX" && styles.tabButtonTextActive]}>
              My Notifications ({unreadInboxCount > 0 ? unreadInboxCount : inbox.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => {
              setActiveTab("EMAIL_TEMPLATES");
              void loadTemplates();
            }}
            style={[styles.tabButton, activeTab === "EMAIL_TEMPLATES" && styles.tabButtonActive]}
          >
            <IconMail size={16} color={activeTab === "EMAIL_TEMPLATES" ? "#4F46E5" : "#64748B"} />
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "EMAIL_TEMPLATES" && styles.tabButtonTextActive
              ]}
            >
              Email Templates (52)
            </Text>
          </Pressable>
        </ScrollView>

        {/* External Channel Readiness Banner */}
        <View style={styles.readinessBanner}>
          <View style={styles.readinessTitleRow}>
            <Text style={styles.readinessLabel}>External Channel Readiness:</Text>
            <View style={styles.readinessPillRow}>
              <View style={styles.readinessPill}>
                <Text style={styles.readinessPillText}>EMAIL: SIMULATED / OFF</Text>
              </View>
              <View style={styles.readinessPill}>
                <Text style={styles.readinessPillText}>SMS: SIMULATED / OFF</Text>
              </View>
            </View>
          </View>
          <Text style={styles.readinessNote}>
            In-app notifications deliver independently of external SMS or Email provider availability.
          </Text>
        </View>

        {/* Alert Banner */}
        {!!alertMsg && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>{alertMsg}</Text>
          </View>
        )}

        {/* ============================================================== */}
        {/* TAB 1: NOTICES & BROADCASTS                                    */}
        {/* ============================================================== */}
        {activeTab === "NOTICES" && (
          <>
            {/* Advanced Filters Card matching Web */}
            <View style={styles.filterCard}>
              <View style={styles.filterCardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <IconSliders size={16} color="#4F46E5" />
                  <Text style={styles.filterCardTitle}>Advanced Filters</Text>
                </View>

                <Pressable
                  style={[styles.filterToggleBtn, showAdvancedFilters && styles.filterToggleActive]}
                  onPress={() => setShowAdvancedFilters((v) => !v)}
                >
                  <Text style={styles.filterToggleText}>
                    {showAdvancedFilters ? "Hide Dropdowns" : "Show Dropdowns"}
                  </Text>
                </Pressable>
              </View>

              {/* Search Row */}
              <View style={styles.searchRow}>
                <View style={styles.searchInputContainer}>
                  <IconSearch size={15} color="#94A3B8" />
                  <TextInput
                    placeholder="Search title, message, status..."
                    placeholderTextColor="#94A3B8"
                    value={searchKeyword}
                    onChangeText={setSearchKeyword}
                    onSubmitEditing={() => setAppliedKeyword(searchKeyword)}
                    style={styles.searchInput}
                  />
                  {!!searchKeyword && (
                    <Pressable
                      onPress={() => {
                        setSearchKeyword("");
                        setAppliedKeyword("");
                      }}
                      style={styles.clearSearchBtn}
                    >
                      <IconClose size={14} color="#94A3B8" />
                    </Pressable>
                  )}
                </View>

                <Pressable
                  style={styles.searchSubmitBtn}
                  onPress={() => setAppliedKeyword(searchKeyword)}
                >
                  <Text style={styles.searchSubmitText}>Apply Filters</Text>
                </Pressable>
              </View>

              {/* Collapsible Dropdown Filters */}
              {showAdvancedFilters && (
                <View style={styles.advancedFiltersArea}>
                  <NativeCustomDropdown
                    label="Status"
                    options={[
                      { value: "ALL", label: "All Statuses" },
                      { value: "APPROVED", label: "Active Notices", badge: "Live", badgeColor: "#16A34A" },
                      { value: "SCHEDULED", label: "Scheduled", badge: "Queued", badgeColor: "#0D9488" },
                      { value: "DRAFT", label: "Drafts Only", badge: "Review", badgeColor: "#D97706" },
                      { value: "EXPIRED", label: "Expired", badge: "Done", badgeColor: "#64748B" },
                      { value: "CANCELLED", label: "Cancelled", badge: "Archived", badgeColor: "#DC2626" }
                    ]}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />

                  <NativeCustomDropdown
                    label="Priority"
                    options={[
                      { value: "ALL", label: "All Priorities" },
                      { value: "NORMAL", label: "General (Normal)" },
                      { value: "IMPORTANT", label: "Important", badge: "High", badgeColor: "#DC2626" }
                    ]}
                    value={priorityFilter}
                    onChange={setPriorityFilter}
                  />

                  <NativeCustomDropdown
                    label="Purpose"
                    options={[
                      { value: "ALL", label: "All Purposes" },
                      { value: "TRANSACTIONAL", label: "Service (Transactional)" },
                      { value: "PROMOTIONAL", label: "Campaign (Promotional)" }
                    ]}
                    value={purposeFilter}
                    onChange={setPurposeFilter}
                  />

                  <NativeCustomDropdown
                    label="Target Audience"
                    options={[
                      { value: "ALL", label: "All User Types / Audiences" },
                      { value: "ALL_ACTIVE", label: "All Active Accounts" },
                      { value: "ROLE", label: "Specific Role" },
                      { value: "INDIVIDUAL", label: "Individual Account" }
                    ]}
                    value={audienceFilter}
                    onChange={setAudienceFilter}
                  />

                  <Pressable
                    style={styles.resetFiltersBtn}
                    onPress={() => {
                      setSearchKeyword("");
                      setAppliedKeyword("");
                      setStatusFilter("ALL");
                      setPriorityFilter("ALL");
                      setPurposeFilter("ALL");
                      setAudienceFilter("ALL");
                      setSubStatusPill("ALL");
                    }}
                  >
                    <Text style={styles.resetFiltersText}>Reset</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Quick Actions 6-Grid Card matching Web Screenshot 1 */}
            <View style={styles.quickActionsCard}>
              <Text style={styles.quickActionsTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                {/* 1. Create Notice */}
                <Pressable
                  style={styles.qaBtn}
                  onPress={() => setComposeOpen(true)}
                >
                  <View style={[styles.qaIconWrap, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}>
                    <IconPlusCircle size={16} color="#4F46E5" />
                  </View>
                  <Text style={styles.qaLabel}>Create Notice</Text>
                </Pressable>

                {/* 2. Send Notice */}
                <Pressable
                  style={styles.qaBtn}
                  onPress={() => setComposeOpen(true)}
                >
                  <View style={[styles.qaIconWrap, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                    <IconSend size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.qaLabel}>Send Notice</Text>
                </Pressable>

                {/* 3. Schedule */}
                <Pressable
                  style={styles.qaBtn}
                  onPress={() => setComposeOpen(true)}
                >
                  <View style={[styles.qaIconWrap, { backgroundColor: "#F0FDFA", borderColor: "#99F6E4" }]}>
                    <IconCalendar size={16} color="#0D9488" />
                  </View>
                  <Text style={styles.qaLabel}>Schedule</Text>
                </Pressable>

                {/* 4. Templates */}
                <Pressable
                  style={styles.qaBtn}
                  onPress={() => {
                    setActiveTab("EMAIL_TEMPLATES");
                    void loadTemplates();
                  }}
                >
                  <View style={[styles.qaIconWrap, { backgroundColor: "#FAF5FF", borderColor: "#E9D5FF" }]}>
                    <IconFileText size={16} color="#9333EA" />
                  </View>
                  <Text style={styles.qaLabel}>Templates</Text>
                </Pressable>

                {/* 5. Live Notices */}
                <Pressable
                  style={styles.qaBtn}
                  onPress={() => setSubStatusPill("ACTIVE")}
                >
                  <View style={[styles.qaIconWrap, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                    <IconMegaphone size={16} color="#16A34A" />
                  </View>
                  <Text style={styles.qaLabel}>Live Notices</Text>
                </Pressable>

                {/* 6. Sync Data */}
                <Pressable
                  style={styles.qaBtn}
                  onPress={() => void loadData()}
                >
                  <View style={[styles.qaIconWrap, { backgroundColor: "#FEFCE8", borderColor: "#FEF08A" }]}>
                    <IconRefresh size={16} color="#CA8A04" />
                  </View>
                  <Text style={styles.qaLabel}>Sync Data</Text>
                </Pressable>
              </View>
            </View>

            {/* Sub-status Filter Pills Header matching Web Screenshot 1 & 2 */}
            <View style={styles.subFilterBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subPillScroll}>
                {[
                  { key: "ALL", label: "All Notifications", count: totalNotifications },
                  { key: "ACTIVE", label: "Active Notices", count: activeNotices },
                  { key: "SCHEDULED", label: "Scheduled", count: scheduledNotices },
                  { key: "DRAFT", label: "Drafts", count: draftNotices },
                  { key: "EXPIRED", label: "Expired", count: expiredNotices },
                  { key: "CANCELLED", label: "Cancelled", count: cancelledNotices }
                ].map((item) => (
                  <Pressable
                    key={item.key}
                    onPress={() => setSubStatusPill(item.key)}
                    style={[styles.subPill, subStatusPill === item.key && styles.subPillActive]}
                  >
                    <Text
                      style={[
                        styles.subPillText,
                        subStatusPill === item.key && styles.subPillTextActive
                      ]}
                    >
                      {item.label}
                    </Text>
                    <View
                      style={[
                        styles.subPillBadge,
                        subStatusPill === item.key && styles.subPillBadgeActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.subPillBadgeText,
                          subStatusPill === item.key && styles.subPillBadgeTextActive
                        ]}
                      >
                        {item.count}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                accessibilityRole="button"
                style={styles.btnCreateNotice}
                onPress={() => setComposeOpen(true)}
              >
                <IconPlusCircle size={14} color="#FFFFFF" />
                <Text style={styles.btnCreateNoticeText}>Send Notification</Text>
              </Pressable>
            </View>

            {/* Broadcast Notices List / Standalone Elevated Cards */}
            <View style={styles.noticeListHeaderRow}>
              <Text style={styles.noticeListHeading}>Notice Broadcasts ({filteredNotices.length})</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.refreshBtn}
                disabled={loading}
                onPress={() => void loadData()}
              >
                <IconRefresh size={12} color="#475569" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#4F46E5" style={{ paddingVertical: 24 }} />
            ) : !filteredNotices.length ? (
              <View style={[styles.noticeCard, styles.emptyContainer]}>
                <IconBell size={32} color="#CBD5E1" />
                <Text style={styles.emptyText}>No broadcast notices match the current filters.</Text>
              </View>
            ) : (
              filteredNotices.map((n) => (
                <View key={n.noticeRef} style={styles.noticeCard}>
                  {/* Top Row: Title & Badges */}
                  <View style={styles.noticeTableTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noticeTableTitle}>{n.title}</Text>
                      <Text style={styles.noticeTableExpiry}>
                        Expires: {n.expiresAt ? new Date(n.expiresAt).toLocaleDateString() : "No Expiry"}
                      </Text>
                    </View>

                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.priorityBadge,
                          n.priority === "URGENT" || n.priority === "IMPORTANT"
                            ? styles.priorityUrgent
                            : styles.priorityNormal
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityBadgeText,
                            n.priority === "URGENT" || n.priority === "IMPORTANT"
                              ? styles.priorityTextUrgent
                              : styles.priorityTextNormal
                          ]}
                        >
                          {n.priority}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          n.state === "APPROVED" || n.state === "ACTIVE"
                            ? styles.statusBadgeGreen
                            : n.state === "DRAFT"
                            ? styles.statusBadgeAmber
                            : n.state === "SCHEDULED"
                            ? styles.statusBadgeBlue
                            : styles.statusBadgeGray
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            n.state === "APPROVED" || n.state === "ACTIVE"
                              ? styles.statusTextGreen
                              : n.state === "DRAFT"
                              ? styles.statusTextAmber
                              : n.state === "SCHEDULED"
                              ? styles.statusTextBlue
                              : styles.statusTextGray
                          ]}
                        >
                          {n.state === "APPROVED" ? "ACTIVE" : n.state}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Notice Body */}
                  <Text style={styles.noticeTableBody}>
                    {n.body}
                  </Text>

                  {/* Audience & Channels Details Bar */}
                  <View style={styles.audienceChannelsBar}>
                    <View style={styles.audienceInfo}>
                      <Text style={styles.audienceCountText}>{n.audienceCount} recipients</Text>
                      <Text style={styles.audienceKindText}>{n.audienceKind.replace(/_/g, " ")}</Text>
                    </View>

                    <View style={styles.channelsList}>
                      {n.channels.map((ch) => (
                        <View
                          key={ch}
                          style={[
                            styles.chPill,
                            ch === "EMAIL" && { backgroundColor: "#CCFBF1" },
                            ch === "SMS" && { backgroundColor: "#F3E8FF" }
                          ]}
                        >
                          <Text
                            style={[
                              styles.chPillText,
                              ch === "EMAIL" && { color: "#0F766E" },
                              ch === "SMS" && { color: "#7E22CE" }
                            ]}
                          >
                            {ch}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Action Buttons Row matching Web Screenshot 2 */}
                  <View style={styles.noticeActionRow}>
                    {n.state === "DRAFT" && (
                      <Pressable
                        style={styles.actionBtnApprove}
                        onPress={() =>
                          setReviewAction({
                            type: "APPROVE",
                            ref: n.noticeRef,
                            revision: n.revision,
                            title: n.title
                          })
                        }
                      >
                        <IconCheckCircle size={14} color="#FFFFFF" />
                        <Text style={styles.actionBtnApproveText}>Approve</Text>
                      </Pressable>
                    )}

                    {n.state !== "CANCELLED" && (
                      <Pressable
                        style={styles.actionBtnCancel}
                        onPress={() =>
                          setReviewAction({
                            type: "CANCEL",
                            ref: n.noticeRef,
                            revision: n.revision,
                            title: n.title
                          })
                        }
                      >
                        <IconXCircle size={14} color="#DC2626" />
                        <Text style={styles.actionBtnCancelText}>Cancel</Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={styles.actionBtnOutline}
                      onPress={() => void loadTelemetry(n.noticeRef)}
                    >
                      <IconBarChart2 size={14} color="#64748B" />
                      <Text style={styles.actionBtnOutlineText}>Delivery</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {/* Delivery Summary Card matching Web Screenshot 2 */}
            <View style={styles.deliverySummaryCard}>
              <Text style={styles.deliverySummaryTitle}>Delivery Summary</Text>
              <View style={styles.deliverySummaryRows}>
                <View style={styles.deliverySummaryRow}>
                  <Text style={styles.deliverySummaryLabel}>In-App Delivery:</Text>
                  <Text style={styles.deliverySummaryValGreen}>Operational</Text>
                </View>
                <View style={styles.deliverySummaryRow}>
                  <Text style={styles.deliverySummaryLabel}>Email Channel:</Text>
                  <Text style={styles.deliverySummaryValOrange}>Simulated / Off</Text>
                </View>
                <View style={styles.deliverySummaryRow}>
                  <Text style={styles.deliverySummaryLabel}>SMS Channel:</Text>
                  <Text style={styles.deliverySummaryValOrange}>Simulated / Off</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ============================================================== */}
        {/* TAB 2: MY NOTIFICATIONS / INBOX                                */}
        {/* ============================================================== */}
        {activeTab === "INBOX" && (
          <>
            {/* Mobile Contact Verification Box */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeading}>My Verified Mobile Contact</Text>
                <View
                  style={[
                    styles.statusBadge,
                    mobileProof?.verified ? styles.statusBadgeGreen : styles.statusBadgeAmber
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      mobileProof?.verified ? styles.statusTextGreen : styles.statusTextAmber
                    ]}
                  >
                    {mobileProof?.verified ? "Verified" : "Pending Proof"}
                  </Text>
                </View>
              </View>

              {!mobileProof ? (
                <Text style={styles.noteText}>Contact verification unavailable.</Text>
              ) : mobileProof.verified ? (
                <View style={styles.verifiedPhoneRow}>
                  <IconShieldCheck size={20} color="#16A34A" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verifiedPhoneTitle}>
                      Verified Contact: {mobileProof.maskedContact}
                    </Text>
                    <Text style={styles.verifiedPhoneSub}>
                      Protected cryptographic binding to your Foundation account
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.verifyPhoneBox}>
                  <Text style={styles.phoneLabel}>
                    Recorded Contact: <Text style={{ fontWeight: "800" }}>{mobileProof.maskedContact}</Text>
                  </Text>

                  <Pressable
                    style={styles.requestSmsBtn}
                    disabled={busy || mobileBusy || !mobileProof.providerConfigured}
                    onPress={() => void startPhoneProof()}
                  >
                    <Text style={styles.requestSmsBtnText}>
                      {mobileProof.providerConfigured
                        ? "Request SMS Verification Code"
                        : "Verification Provider Simulated"}
                    </Text>
                  </Pressable>

                  <TextInput
                    style={styles.inputBox}
                    value={mobileCode}
                    onChangeText={(x) => setMobileCode(x.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="Enter code from SMS..."
                    placeholderTextColor="#94A3B8"
                  />

                  <Pressable
                    style={[
                      styles.confirmCodeBtn,
                      (!/^\d{4,10}$/.test(mobileCode) || mobileBusy) && styles.btnDisabled
                    ]}
                    disabled={busy || mobileBusy || !/^\d{4,10}$/.test(mobileCode)}
                    onPress={() => void confirmPhoneProof()}
                  >
                    <Text style={styles.confirmCodeBtnText}>Verify Mobile Contact</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* My Notifications List / Standalone Cards */}
            <View style={styles.noticeListHeaderRow}>
              <Text style={styles.noticeListHeading}>My Notifications ({inbox.length})</Text>
              <Pressable style={styles.refreshBtn} disabled={loading} onPress={() => void loadData()}>
                <IconRefresh size={12} color="#475569" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#4F46E5" style={{ paddingVertical: 24 }} />
            ) : !inbox.length ? (
              <View style={[styles.noticeCard, styles.emptyContainer]}>
                <IconInbox size={32} color="#CBD5E1" />
                <Text style={styles.emptyText}>No notifications for your current account.</Text>
              </View>
            ) : (
              inbox.map((item) => (
                <View
                  key={item.notificationRef}
                  style={[
                    styles.inboxStandaloneCard,
                    !item.read ? styles.inboxCardUnread : styles.inboxCardRead
                  ]}
                >
                  <View style={styles.inboxTopRow}>
                    <View
                      style={[
                        styles.inboxIconBox,
                        !item.read ? styles.inboxIconUnread : styles.inboxIconRead
                      ]}
                    >
                      <IconBell size={16} color={!item.read ? "#15803D" : "#64748B"} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.inboxTitle}>{item.title}</Text>
                      <Text style={styles.inboxDate}>
                        {new Date(item.receivedAt).toLocaleDateString()} at{" "}
                        {new Date(item.receivedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </Text>
                    </View>

                    <View style={styles.chPill}>
                      <Text style={styles.chPillText}>{item.channel}</Text>
                    </View>

                    {!item.read && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.inboxBody}>{item.body}</Text>

                  {!item.read && (
                    <View style={styles.inboxActionRow}>
                      <Pressable
                        style={styles.btnMarkRead}
                        disabled={busy}
                        onPress={() => void markInboxRead(item.notificationRef)}
                      >
                        <IconCheck size={14} color="#16A34A" />
                        <Text style={styles.btnMarkReadText}>Mark as read</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* TAB 3: 52 MASTER EMAIL TEMPLATES REFERENCE                     */}
        {/* ============================================================== */}
        {activeTab === "EMAIL_TEMPLATES" && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>52 Client Master Email Templates</Text>
              <Pressable style={styles.refreshBtn} disabled={loading} onPress={() => void loadTemplates()}>
                <IconRefresh size={12} color="#475569" />
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            </View>

            <Text style={styles.cardDesc}>
              Authoritative transactional email designs from CareGanga Master Specifications.
            </Text>

            {/* Template Search */}
            <View style={styles.searchInputContainer}>
              <IconSearch size={15} color="#94A3B8" />
              <TextInput
                placeholder="Search templates by code, subject, title..."
                placeholderTextColor="#94A3B8"
                value={templateSearch}
                onChangeText={setTemplateSearch}
                style={styles.searchInput}
              />
            </View>

            {/* Templates List */}
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              {emailReferences
                .filter(
                  (t) =>
                    !templateSearch.trim() ||
                    t.code.toLowerCase().includes(templateSearch.toLowerCase()) ||
                    t.title.toLowerCase().includes(templateSearch.toLowerCase()) ||
                    t.subject.toLowerCase().includes(templateSearch.toLowerCase())
                )
                .map((t) => (
                  <Pressable
                    key={t.code}
                    onPress={() => setSelectedTemplate(t)}
                    style={[
                      styles.templateRowCard,
                      selectedTemplate?.code === t.code && styles.templateRowCardActive
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.templateRowCode}>{t.code} — {t.title}</Text>
                      <Text style={styles.templateRowSubject}>{t.subject}</Text>
                      <Text style={styles.templateRowOwner}>Owner: {t.owner}</Text>
                    </View>
                    <View style={styles.pillBadge}>
                      <Text style={styles.pillBadgeText}>VIEW</Text>
                    </View>
                  </Pressable>
                ))}
            </ScrollView>

            {/* Selected Template Viewer */}
            {selectedTemplate && (
              <View style={styles.templatePreviewBox}>
                <Text style={styles.previewTitle}>Template Details: {selectedTemplate.code}</Text>
                <Text style={styles.previewSubject}>Subject: {selectedTemplate.subject}</Text>
                <Text style={styles.previewBody}>{selectedTemplate.body}</Text>
                <Text style={styles.previewAttachment}>Rule: {selectedTemplate.attachmentRule}</Text>
              </View>
            )}
          </View>
        )}

        {/* ============================================================== */}
        {/* MODAL 1: COMPOSE / SEND NOTIFICATION                            */}
        {/* ============================================================== */}
        <Modal
          visible={composeOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setComposeOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setComposeOpen(false)}>
            <Pressable style={[styles.modalCard, { maxHeight: "90%" }]} onPress={(e) => e.stopPropagation()}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Compose Foundation Broadcast</Text>
                  <Pressable onPress={() => setComposeOpen(false)} style={styles.closeBtn}>
                    <IconClose size={18} color="#64748B" />
                  </Pressable>
                </View>

                {/* Target Audience Dropdown */}
                <NativeCustomDropdown
                  label="Select Target Audience"
                  options={[
                    { value: "ALL_ACTIVE", label: "All Active Accounts", subtitle: "All registered staff & users" },
                    { value: "ROLE", label: "Specific Staff Role", subtitle: "Branch Managers, Reviewers, etc." },
                    { value: "INDIVIDUAL", label: "Single Individual User", subtitle: "Direct targeted broadcast" }
                  ]}
                  value={newAudienceKind}
                  onChange={(val) => setNewAudienceKind(val as "ALL_ACTIVE" | "ROLE" | "INDIVIDUAL")}
                />

                {/* Title */}
                <Text style={styles.inputLabel}>Notice Title</Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Healthcare Camp Multi-Channel Notice"
                  placeholderTextColor="#94A3B8"
                  style={styles.inputBox}
                />

                {/* Content Body */}
                <Text style={styles.inputLabel}>Notice Message Body</Text>
                <TextInput
                  value={newBody}
                  onChangeText={setNewBody}
                  placeholder="Write announcement details..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={4}
                  style={[styles.inputBox, { height: 90, textAlignVertical: "top" }]}
                />

                {/* Priority Selection Pills */}
                <Text style={styles.inputLabel}>Priority Level</Text>
                <View style={styles.pillsRow}>
                  {["NORMAL", "IMPORTANT"].map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setNewPriority(p)}
                      style={[styles.selectPill, newPriority === p && styles.selectPillActive]}
                    >
                      <Text
                        style={[
                          styles.selectPillText,
                          newPriority === p && styles.selectPillTextActive
                        ]}
                      >
                        {p}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Multi-channel Checkboxes */}
                <Text style={styles.inputLabel}>Dispatch Channels</Text>
                <View style={styles.channelsChoiceRow}>
                  <View style={[styles.channelChoicePill, styles.channelChoiceActive]}>
                    <Text style={styles.channelChoiceTextActive}>In-App Inbox (Mandatory)</Text>
                  </View>

                  <Pressable
                    onPress={() => setNewEmail((v) => !v)}
                    style={[styles.channelChoicePill, newEmail && styles.channelChoiceActive]}
                  >
                    <Text style={newEmail ? styles.channelChoiceTextActive : styles.channelChoiceText}>
                      {newEmail ? "Email Dispatch (Active)" : "Email Dispatch"}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setNewSms((v) => !v)}
                    style={[styles.channelChoicePill, newSms && styles.channelChoiceActive]}
                  >
                    <Text style={newSms ? styles.channelChoiceTextActive : styles.channelChoiceText}>
                      {newSms ? "SMS Alert (Active)" : "SMS Alert"}
                    </Text>
                  </Pressable>
                </View>

                {/* Actions */}
                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.modalCancelBtn} onPress={() => setComposeOpen(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalSubmitBtn, (!newTitle.trim() || !newBody.trim() || busy) && styles.btnDisabled]}
                    disabled={!newTitle.trim() || !newBody.trim() || busy}
                    onPress={() => void submitNoticeDraft()}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalSubmitText}>Broadcast Notice</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ============================================================== */}
        {/* MODAL 2: PASSWORD AUTHORIZATION MODAL (APPROVE / CANCEL)       */}
        {/* ============================================================== */}
        <Modal
          visible={!!reviewAction}
          transparent
          animationType="fade"
          onRequestClose={() => setReviewAction(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setReviewAction(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {reviewAction?.type === "APPROVE" ? "Authorize Notice Dispatch" : "Cancel Notice"}
                </Text>
                <Pressable onPress={() => setReviewAction(null)} style={styles.closeBtn}>
                  <IconClose size={18} color="#64748B" />
                </Pressable>
              </View>

              <Text style={styles.modalDesc}>
                Notice: <Text style={{ fontWeight: "800", color: "#0F172A" }}>{reviewAction?.title}</Text>
              </Text>
              <Text style={styles.modalDesc}>
                Enter your administrator password (e.g. CareGanga@123) to confirm this operation.
              </Text>

              <Text style={styles.inputLabel}>Admin Password</Text>
              <TextInput
                value={adminPassword}
                onChangeText={setAdminPassword}
                placeholder="Enter password..."
                placeholderTextColor="#94A3B8"
                secureTextEntry
                style={styles.inputBox}
              />

              <View style={styles.modalBtnRow}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setReviewAction(null)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalSubmitBtn, (!adminPassword.trim() || busy) && styles.btnDisabled]}
                  disabled={!adminPassword.trim() || busy}
                  onPress={() => void executeReviewDecision()}
                >
                  <Text style={styles.modalSubmitText}>
                    {reviewAction?.type === "APPROVE" ? "Confirm & Broadcast" : "Confirm Cancel"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ============================================================== */}
        {/* MODAL 3: DELIVERY TELEMETRY                                    */}
        {/* ============================================================== */}
        <Modal
          visible={!!telemetryRef}
          transparent
          animationType="fade"
          onRequestClose={() => setTelemetryRef(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setTelemetryRef(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notice Delivery Telemetry</Text>
                <Pressable onPress={() => setTelemetryRef(null)} style={styles.closeBtn}>
                  <IconClose size={18} color="#64748B" />
                </Pressable>
              </View>

              {!telemetryCounts.length ? (
                <Text style={styles.emptyText}>No delivery receipts recorded yet.</Text>
              ) : (
                telemetryCounts.map((c, i) => (
                  <View key={i} style={styles.telemetryRow}>
                    <Text style={styles.telemetryChannel}>{c.channel}</Text>
                    <View style={styles.telemetryRight}>
                      <Text style={styles.telemetryCount}>{c.count} recipients</Text>
                      <Text style={styles.telemetryStatus}>({c.status})</Text>
                    </View>
                  </View>
                ))
              )}

              <Pressable style={styles.modalCloseBtn} onPress={() => setTelemetryRef(null)}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
    gap: 14
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap"
  },
  backBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  headerInfo: {
    flex: 1,
    minWidth: 160
  },
  titleIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  verifiedCheckBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  headerActionsRow: {
    flexDirection: "row",
    gap: 6
  },
  headerBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4F46E5",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  headerBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700"
  },
  headerBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  headerBtnSecondaryText: {
    color: "#334155",
    fontSize: 12.5,
    fontWeight: "600"
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  kpiTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  kpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5
  },
  kpiLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#334155",
    lineHeight: 17
  },
  kpiSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  tabBarScroll: {
    flexGrow: 0,
    width: "100%",
    marginBottom: 8
  },
  tabScrollContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    gap: 6
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9,
    gap: 7,
    flexShrink: 0
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B"
  },
  tabButtonTextActive: {
    color: "#4F46E5",
    fontWeight: "800"
  },
  noticeListHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginTop: 6,
    marginBottom: 2
  },
  noticeListHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  noticeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  inboxStandaloneCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  readinessBanner: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  readinessTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6
  },
  readinessLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B"
  },
  readinessPillRow: {
    flexDirection: "row",
    gap: 6
  },
  readinessPill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  readinessPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309"
  },
  readinessNote: {
    fontSize: 11,
    color: "#94A3B8"
  },
  alertBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12
  },
  alertText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600"
  },
  filterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10
  },
  filterCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  filterCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B"
  },
  filterToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F1F5F9"
  },
  filterToggleActive: {
    backgroundColor: "#EEF2FF"
  },
  filterToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4F46E5"
  },
  searchRow: {
    flexDirection: "row",
    gap: 8
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    padding: 0
  },
  clearSearchBtn: {
    padding: 2
  },
  searchSubmitBtn: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  searchSubmitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  advancedFiltersArea: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8
  },
  resetFiltersBtn: {
    paddingVertical: 6,
    alignItems: "center"
  },
  resetFiltersText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5"
  },
  quickActionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B"
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  qaBtn: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  qaIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  qaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155"
  },
  subFilterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  subPillScroll: {
    flexDirection: "row",
    gap: 6
  },
  subPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  subPillActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE"
  },
  subPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  subPillTextActive: {
    color: "#4F46E5",
    fontWeight: "700"
  },
  subPillBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10
  },
  subPillBadgeActive: {
    backgroundColor: "#C7D2FE"
  },
  subPillBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B"
  },
  subPillBadgeTextActive: {
    color: "#3730A3"
  },
  btnCreateNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#4F46E5",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  btnCreateNoticeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  cardDesc: {
    fontSize: 12.5,
    color: "#64748B",
    lineHeight: 17
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F1F5F9"
  },
  refreshBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#475569"
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 8
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  noticeTableCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    gap: 8
  },
  noticeTableTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  noticeTableTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A"
  },
  noticeTableExpiry: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6
  },
  priorityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  priorityNormal: { backgroundColor: "#EFF6FF" },
  priorityUrgent: { backgroundColor: "#FEE2E2" },
  priorityBadgeText: { fontSize: 10, fontWeight: "800" },
  priorityTextNormal: { color: "#1D4ED8" },
  priorityTextUrgent: { color: "#DC2626" },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  statusBadgeGreen: { backgroundColor: "#DCFCE7" },
  statusBadgeAmber: { backgroundColor: "#FEF3C7" },
  statusBadgeBlue: { backgroundColor: "#DBEAFE" },
  statusBadgeGray: { backgroundColor: "#F1F5F9" },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  statusTextGreen: { color: "#166534" },
  statusTextAmber: { color: "#B45309" },
  statusTextBlue: { color: "#1D4ED8" },
  statusTextGray: { color: "#475569" },
  noticeTableBody: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 17
  },
  audienceChannelsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  audienceInfo: {
    gap: 1
  },
  audienceCountText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A"
  },
  audienceKindText: {
    fontSize: 10,
    color: "#64748B"
  },
  channelsList: {
    flexDirection: "row",
    gap: 4
  },
  chPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  chPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#475569"
  },
  noticeActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 2
  },
  actionBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6
  },
  actionBtnOutlineText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#334155"
  },
  actionBtnApprove: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#16A34A",
    borderRadius: 6
  },
  actionBtnApproveText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  actionBtnCancel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6
  },
  actionBtnCancelText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#DC2626"
  },
  deliverySummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 8
  },
  deliverySummaryTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E293B"
  },
  deliverySummaryRows: {
    gap: 5
  },
  deliverySummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  deliverySummaryLabel: {
    fontSize: 12,
    color: "#64748B"
  },
  deliverySummaryValGreen: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A"
  },
  deliverySummaryValOrange: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EA580C"
  },
  inboxCard: {
    borderRadius: 12,
    padding: 14,
    gap: 8
  },
  inboxCardUnread: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  inboxCardRead: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  inboxTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  inboxIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  inboxIconUnread: { backgroundColor: "#DCFCE7" },
  inboxIconRead: { backgroundColor: "#F1F5F9" },
  inboxTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A"
  },
  inboxDate: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A"
  },
  inboxBody: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18
  },
  inboxActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  btnMarkRead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 8
  },
  btnMarkReadText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A"
  },
  verifiedPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 10,
    padding: 12
  },
  verifiedPhoneTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#166534"
  },
  verifiedPhoneSub: {
    fontSize: 11,
    color: "#15803D",
    marginTop: 1
  },
  verifyPhoneBox: {
    gap: 8,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 10
  },
  phoneLabel: {
    fontSize: 12,
    color: "#334155"
  },
  requestSmsBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center"
  },
  requestSmsBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#334155"
  },
  confirmCodeBtn: {
    backgroundColor: "#1D4ED8",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center"
  },
  confirmCodeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  templateRowCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  templateRowCardActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE"
  },
  templateRowCode: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A"
  },
  templateRowSubject: {
    fontSize: 11.5,
    color: "#475569",
    marginTop: 2
  },
  templateRowOwner: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4F46E5",
    marginTop: 1
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  pillBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#4F46E5"
  },
  templatePreviewBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 6,
    marginTop: 6
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A"
  },
  previewSubject: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B"
  },
  previewBody: {
    fontSize: 11.5,
    color: "#334155",
    lineHeight: 16
  },
  previewAttachment: {
    fontSize: 10.5,
    color: "#64748B",
    marginTop: 2
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A"
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#F8FAFC"
  },
  modalDesc: {
    fontSize: 12.5,
    color: "#64748B",
    lineHeight: 17
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 4
  },
  inputBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0F172A"
  },
  pillsRow: {
    flexDirection: "row",
    gap: 8
  },
  selectPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center"
  },
  selectPillActive: {
    backgroundColor: "#4F46E5"
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  selectPillTextActive: {
    color: "#FFFFFF"
  },
  channelsChoiceRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  channelChoicePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  channelChoiceActive: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE"
  },
  channelChoiceText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B"
  },
  channelChoiceTextActive: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#4338CA"
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignItems: "center"
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569"
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#4F46E5",
    borderRadius: 8,
    alignItems: "center"
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  telemetryChannel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B"
  },
  telemetryRight: {
    flexDirection: "row",
    gap: 6
  },
  telemetryCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5"
  },
  telemetryStatus: {
    fontSize: 12,
    color: "#64748B"
  },
  modalCloseBtn: {
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  btnDisabled: {
    opacity: 0.5
  },
  noteText: {
    fontSize: 12,
    color: "#64748B"
  }
});
