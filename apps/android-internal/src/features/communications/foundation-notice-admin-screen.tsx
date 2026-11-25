import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  IconSearch,
  IconSend,
  IconShieldCheck,
  IconMegaphone,
  IconFileText,
  IconRefresh,
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
type Review = { ref: string; revision: number; action: "APPROVE" | "CANCEL" };
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

type Props = {
  token: string;
  mayManage: boolean;
  mayApprove: boolean;
  mayProcess?: boolean;
  mayViewDelivery?: boolean;
  maySelectAccounts?: boolean;
  maySelectRoles?: boolean;
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
    throw Error("UNKNOWN");
  }
  if (response.status === 401) throw Error("EXPIRED");
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

function explain(e: unknown) {
  const reason = e instanceof Error ? e.message : "UNKNOWN";
  return reason === "EXPIRED"
    ? "The Foundation session expired."
    : reason === "DENIED"
    ? "Your current role does not permit this operation."
    : reason === "CONFLICT"
    ? "This notice changed. Refresh the original record."
    : reason === "INVALID"
    ? "Check the audience, message and expiry."
    : "Result not confirmed. Check the original request before any retry.";
}

export function FoundationNoticeAdminScreen({
  token,
  mayManage,
  mayApprove,
  onExit,
  onExpired
}: Props) {
  const [activeTab, setActiveTab] = useState<"HISTORY" | "COMPOSE">("HISTORY");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [counts, setCounts] = useState<Array<{ channel: string; status: string; count: number }>>([]);
  const [countRef, setCountRef] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [purpose, setPurpose] = useState("TRANSACTIONAL");
  const [audienceKind, setAudienceKind] = useState<"ALL_ACTIVE" | "ROLE" | "INDIVIDUAL">("ALL_ACTIVE");
  const [audienceRef, setAudienceRef] = useState("");
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [targetHref, setTargetHref] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailReferences, setEmailReferences] = useState<ClientEmailReference[]>([]);
  const [emailSearch, setEmailSearch] = useState("");
  const [emailSelected, setEmailSelected] = useState<ClientEmailReference | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [n, p] = await Promise.all([
        api<{ notices: Notice[] }>(token, "notices?limit=30"),
        api<{ providers: Provider[] }>(token, "providers")
      ]);
      setNotices(n.notices);
      setProviders(p.providers);
    } catch (e) {
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
      else setNotice(explain(e));
    } finally {
      setLoading(false);
    }
  }, [token, onExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDeliveryCounts = async (ref: string) => {
    setCountRef(ref);
    try {
      const d = await api<{ counts: Array<{ channel: string; status: string; count: number }> }>(
        token,
        `notices/${encodeURIComponent(ref)}/deliveries`
      );
      setCounts(d.counts);
    } catch {
      setCounts([]);
    }
  };

  const loadEmailTemplates = async () => {
    setEmailLoading(true);
    try {
      const d = await api<{ templates: ClientEmailReference[] }>(
        token,
        "templates/client-references"
      );
      setEmailReferences(d.templates);
    } catch {
      setEmailReferences([]);
    } finally {
      setEmailLoading(false);
    }
  };

  const submitDraft = async () => {
    if (!title.trim() || !body.trim() || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const channels: Channel[] = ["IN_APP"];
      if (email) channels.push("EMAIL");
      if (sms) channels.push("SMS");

      const expiry =
        expiresAt.trim() ||
        new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split("T")[0];

      await api(token, "notices", "POST", {
        title: title.trim(),
        body: body.trim(),
        priority,
        purpose,
        channels,
        audienceKind,
        audienceRef: audienceRef ? audienceRef : undefined,
        targetHref: targetHref.trim() || undefined,
        expiresAt: expiry,
        requestKey: Crypto.randomUUID()
      });

      setTitle("");
      setBody("");
      setTargetHref("");
      setActiveTab("HISTORY");
      void load();
    } catch (e) {
      setNotice(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const executeReview = async () => {
    if (!review || !currentPassword.trim() || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const path = review.action === "APPROVE" ? "approve" : "cancel";
      await api(token, `notices/${encodeURIComponent(review.ref)}/${path}`, "POST", {
        expectedRevision: review.revision,
        currentPassword: currentPassword.trim(),
        requestKey: Crypto.randomUUID()
      });
      setReview(null);
      setCurrentPassword("");
      void load();
    } catch (e) {
      setNotice(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const audienceOptions = [
    { value: "ALL_ACTIVE", label: "All Active Foundation Accounts", subtitle: "Broadcast to all active staff & users" },
    { value: "ROLE", label: "Target Specific Role", subtitle: "Super Admin, Branch Managers, or Staff" },
    { value: "INDIVIDUAL", label: "Single Specific User", subtitle: "Send targeted direct notice" }
  ];

  return (
    <SafeAreaView style={styles.page} edges={["left", "right"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onExit}
            disabled={busy}
            style={styles.backBtn}
          >
            <IconArrowLeft size={18} color="#334155" />
          </Pressable>

          <View style={styles.headerInfo}>
            <View style={styles.titleIconRow}>
              <View style={styles.titleIconBox}>
                <IconBell size={18} color="#D97706" />
              </View>
              <Text style={styles.headerTitle}>Notices & Broadcasts</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Multi-channel broadcast control for Foundation staff & members
            </Text>
          </View>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveTab("HISTORY")}
            style={[styles.tabButton, activeTab === "HISTORY" && styles.tabButtonActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
          >
            <IconMegaphone size={15} color={activeTab === "HISTORY" ? "#4F46E5" : "#64748B"} />
            <Text
              style={[styles.tabButtonText, activeTab === "HISTORY" && styles.tabButtonTextActive]}
            >
              Notice Library ({notices.length})
            </Text>
          </Pressable>

          {mayManage && (
            <Pressable
              accessibilityRole="tab"
              onPress={() => setActiveTab("COMPOSE")}
              style={[styles.tabButton, activeTab === "COMPOSE" && styles.tabButtonActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
            >
              <IconFileText size={15} color={activeTab === "COMPOSE" ? "#4F46E5" : "#64748B"} />
              <Text
                style={[styles.tabButtonText, activeTab === "COMPOSE" && styles.tabButtonTextActive]}
              >
                Compose Broadcast
              </Text>
            </Pressable>
          )}
        </View>

        {/* Alert notification message */}
        {!!notice && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>{notice}</Text>
          </View>
        )}

        {/* TAB 1: HISTORY */}
        {activeTab === "HISTORY" && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>Broadcast History & Live Notices</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={styles.pillActionBtn}
                  onPress={() => {
                    setEmailOpen(true);
                    void loadEmailTemplates();
                  }}
                >
                  <Text style={styles.pillActionText}>52 Templates</Text>
                </Pressable>
                <Pressable
                  style={[styles.pillActionBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}
                  disabled={loading}
                  onPress={() => void load()}
                >
                  <IconRefresh size={12} color="#475569" />
                  <Text style={styles.pillActionText}>Refresh</Text>
                </Pressable>
              </View>
            </View>

            {loading ? (
              <ActivityIndicator color="#1D4ED8" style={{ paddingVertical: 20 }} />
            ) : !notices.length ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No broadcast notices recorded yet.</Text>
              </View>
            ) : (
              notices.map((n) => (
                <View key={n.noticeRef} style={styles.noticeCard}>
                  <View style={styles.noticeTopRow}>
                    <View style={styles.noticeIconWrap}>
                      <IconBell size={16} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noticeTitle}>{n.title}</Text>
                      <Text style={styles.noticeMeta}>
                        {new Date(n.createdAt).toLocaleDateString()} • Audience:{" "}
                        {n.audienceCount} reached • Priority: {n.priority}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.badgePill,
                        n.state === "APPROVED"
                          ? styles.badgeGreen
                          : n.state === "DRAFT"
                          ? styles.badgeAmber
                          : styles.badgeSlate
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          n.state === "APPROVED"
                            ? styles.badgeTextGreen
                            : n.state === "DRAFT"
                            ? styles.badgeTextAmber
                            : styles.badgeTextSlate
                        ]}
                      >
                        {n.state}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.noticeBodySnippet} numberOfLines={2}>
                    {n.body}
                  </Text>

                  {/* Channels Row */}
                  <View style={styles.channelsRow}>
                    {n.channels.map((ch) => (
                      <View key={ch} style={styles.channelTag}>
                        <Text style={styles.channelTagText}>{ch}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Actions */}
                  <View style={styles.noticeActions}>
                    <Pressable
                      style={styles.btnSmOutline}
                      onPress={() => void loadDeliveryCounts(n.noticeRef)}
                    >
                      <Text style={styles.btnSmOutlineText}>Delivery Stats</Text>
                    </Pressable>

                    {mayApprove && n.state === "DRAFT" && (
                      <Pressable
                        style={styles.btnSmPrimary}
                        onPress={() =>
                          setReview({ ref: n.noticeRef, revision: n.revision, action: "APPROVE" })
                        }
                      >
                        <Text style={styles.btnSmPrimaryText}>Approve Notice</Text>
                      </Pressable>
                    )}

                    {mayApprove && n.state !== "CANCELLED" && (
                      <Pressable
                        style={styles.btnSmDestructive}
                        onPress={() =>
                          setReview({ ref: n.noticeRef, revision: n.revision, action: "CANCEL" })
                        }
                      >
                        <Text style={styles.btnSmDestructiveText}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: COMPOSE */}
        {activeTab === "COMPOSE" && mayManage && (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Compose Foundation Notice</Text>

            {/* Target Audience Dropdown */}
            <NativeCustomDropdown
              label="Select Target Audience"
              options={audienceOptions}
              value={audienceKind}
              onChange={(val) => setAudienceKind(val as "ALL_ACTIVE" | "ROLE" | "INDIVIDUAL")}
            />

            {/* Title Input */}
            <Text style={styles.fieldLabel}>Notice Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. System Maintenance or Foundation Announcement"
              placeholderTextColor="#94A3B8"
              style={styles.inputBox}
            />

            {/* Message Body Input */}
            <Text style={styles.fieldLabel}>Notice Content Message</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write the detailed announcement..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              style={[styles.inputBox, { height: 95, textAlignVertical: "top" }]}
            />

            {/* Priority Selector */}
            <Text style={styles.fieldLabel}>Priority Level</Text>
            <View style={styles.pillsRow}>
              {["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.pillSelect, priority === p && styles.pillSelectActive]}
                >
                  <Text
                    style={[styles.pillSelectText, priority === p && styles.pillSelectTextActive]}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Delivery Channels */}
            <Text style={styles.fieldLabel}>Dispatch Channels</Text>
            <View style={styles.channelsSelectRow}>
              <View style={[styles.channelSelectPill, styles.channelSelectPillActive]}>
                <Text style={styles.channelSelectTextActive}>In-App Inbox (Required)</Text>
              </View>

              <Pressable
                onPress={() => setEmail((v) => !v)}
                style={[styles.channelSelectPill, email && styles.channelSelectPillActive]}
              >
                <Text style={email ? styles.channelSelectTextActive : styles.channelSelectText}>
                  {email ? "Email Dispatch (Active)" : "Email Dispatch"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSms((v) => !v)}
                style={[styles.channelSelectPill, sms && styles.channelSelectPillActive]}
              >
                <Text style={sms ? styles.channelSelectTextActive : styles.channelSelectText}>
                  {sms ? "SMS Dispatch (Active)" : "SMS Dispatch"}
                </Text>
              </Pressable>
            </View>

            {/* Action Row */}
            <View style={styles.actionBtnRow}>
              <Pressable
                style={[styles.primaryActionBtn, (!title.trim() || !body.trim() || busy) && styles.btnDisabled]}
                disabled={!title.trim() || !body.trim() || busy}
                onPress={() => void submitDraft()}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Create Broadcast Notice</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* DELIVERY STATS MODAL */}
        <Modal
          visible={!!countRef}
          transparent
          animationType="fade"
          onRequestClose={() => setCountRef("")}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setCountRef("")}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notice Delivery Telemetry</Text>
                <Pressable onPress={() => setCountRef("")} style={styles.closeBtn}>
                  <IconClose size={18} color="#64748B" />
                </Pressable>
              </View>

              {!counts.length ? (
                <Text style={styles.emptyText}>No delivery receipts recorded yet.</Text>
              ) : (
                counts.map((c, i) => (
                  <View key={i} style={styles.telemetryRow}>
                    <Text style={styles.telemetryChannel}>{c.channel}</Text>
                    <View style={styles.telemetryRight}>
                      <Text style={styles.telemetryCount}>{c.count} recipients</Text>
                      <Text style={styles.telemetryStatus}>({c.status})</Text>
                    </View>
                  </View>
                ))
              )}

              <Pressable style={styles.modalCloseFullBtn} onPress={() => setCountRef("")}>
                <Text style={styles.modalCloseFullBtnText}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* APPROVE / CANCEL PASSWORD MODAL */}
        <Modal
          visible={!!review}
          transparent
          animationType="fade"
          onRequestClose={() => setReview(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setReview(null)}>
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {review?.action === "APPROVE" ? "Authorize Notice Dispatch" : "Cancel Notice"}
                </Text>
                <Pressable onPress={() => setReview(null)} style={styles.closeBtn}>
                  <IconClose size={18} color="#64748B" />
                </Pressable>
              </View>

              <Text style={styles.modalDesc}>
                Enter your administrative password (e.g. CareGanga@123) to confirm this broadcast.
              </Text>

              <Text style={styles.fieldLabel}>Admin Password</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter password"
                secureTextEntry
                style={styles.inputBox}
              />

              <View style={styles.modalBtnRow}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setReview(null)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSubmitBtn, (!currentPassword.trim() || busy) && styles.btnDisabled]}
                  disabled={!currentPassword.trim() || busy}
                  onPress={() => void executeReview()}
                >
                  <Text style={styles.modalSubmitText}>
                    {review?.action === "APPROVE" ? "Confirm & Broadcast" : "Confirm Cancel"}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* 52 TEMPLATES REFERENCE MODAL */}
        <Modal
          visible={emailOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setEmailOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setEmailOpen(false)}>
            <Pressable style={[styles.modalCard, { maxHeight: "85%" }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>52 Client Master Email Templates</Text>
                <Pressable onPress={() => setEmailOpen(false)} style={styles.closeBtn}>
                  <IconClose size={18} color="#64748B" />
                </Pressable>
              </View>

              {emailLoading ? (
                <ActivityIndicator color="#1D4ED8" style={{ paddingVertical: 20 }} />
              ) : (
                <ScrollView style={{ maxHeight: 420 }}>
                  {emailReferences.map((t) => (
                    <Pressable
                      key={t.code}
                      onPress={() => setEmailSelected(t)}
                      style={[
                        styles.templateItem,
                        emailSelected?.code === t.code && styles.templateItemActive
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.templateCode}>{t.code} — {t.title}</Text>
                        <Text style={styles.templateSub}>{t.subject}</Text>
                      </View>
                      <Text style={styles.templateOwner}>{t.owner}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {emailSelected && (
                <View style={styles.templateDetailBox}>
                  <Text style={styles.templateDetailSubject}>Subject: {emailSelected.subject}</Text>
                  <Text style={styles.templateDetailBody} numberOfLines={4}>
                    {emailSelected.body}
                  </Text>
                </View>
              )}

              <Pressable style={styles.modalCloseFullBtn} onPress={() => setEmailOpen(false)}>
                <Text style={styles.modalCloseFullBtnText}>Done</Text>
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
    gap: 12
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
    flex: 1
  },
  titleIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  titleIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 3,
    gap: 4
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center"
  },
  tabButtonActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B"
  },
  tabButtonTextActive: {
    color: "#D97706",
    fontWeight: "800"
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
  pillActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 6
  },
  pillActionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#475569"
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  noticeCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  noticeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  noticeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center"
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A"
  },
  noticeMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  noticeBodySnippet: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 17
  },
  channelsRow: {
    flexDirection: "row",
    gap: 6
  },
  channelTag: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  channelTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4338CA"
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10
  },
  badgeGreen: { backgroundColor: "#DCFCE7" },
  badgeAmber: { backgroundColor: "#FEF3C7" },
  badgeSlate: { backgroundColor: "#F1F5F9" },
  badgeText: { fontSize: 10.5, fontWeight: "800" },
  badgeTextGreen: { color: "#166534" },
  badgeTextAmber: { color: "#B45309" },
  badgeTextSlate: { color: "#475569" },
  noticeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4
  },
  btnSmOutline: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  btnSmOutlineText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#334155"
  },
  btnSmPrimary: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#1D4ED8"
  },
  btnSmPrimaryText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  btnSmDestructive: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  btnSmDestructiveText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#DC2626"
  },
  fieldLabel: {
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
  pillSelect: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center"
  },
  pillSelectActive: {
    backgroundColor: "#D97706"
  },
  pillSelectText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  pillSelectTextActive: {
    color: "#FFFFFF"
  },
  channelsSelectRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap"
  },
  channelSelectPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#F1F5F9"
  },
  channelSelectPillActive: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE"
  },
  channelSelectText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  channelSelectTextActive: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4338CA"
  },
  actionBtnRow: {
    marginTop: 8
  },
  primaryActionBtn: {
    backgroundColor: "#1D4ED8",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.5
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
    maxWidth: 420,
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
    backgroundColor: "#1D4ED8",
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
    color: "#1D4ED8"
  },
  telemetryStatus: {
    fontSize: 12,
    color: "#64748B"
  },
  modalCloseFullBtn: {
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4
  },
  modalCloseFullBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  templateItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: "#F8FAFC"
  },
  templateItemActive: {
    backgroundColor: "#EEF2FF"
  },
  templateCode: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A"
  },
  templateSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  templateOwner: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4338CA"
  },
  templateDetailBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
    gap: 4
  },
  templateDetailSubject: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A"
  },
  templateDetailBody: {
    fontSize: 11.5,
    color: "#475569",
    lineHeight: 16
  }
});
