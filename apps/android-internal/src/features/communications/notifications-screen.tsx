import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { identityRequest } from "../identity-access/http-client";
import {
  IconBell,
  IconClose,
  IconMail,
  IconShieldCheck,
  IconSend
} from "../dashboard/dashboard-icons";

type Notification = {
  notificationRef: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  receivedAt: string;
  read: boolean;
};

type Preference = {
  channel: "SMS" | "EMAIL";
  purpose: "TRANSACTIONAL" | "PROMOTIONAL";
  opted_in: boolean;
  revision: number;
};

type Preferences = {
  available: { sms: boolean; email: boolean };
  preferences: Preference[];
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

async function mobile<T>(
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: object
): Promise<T> {
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
  if (response.status === 409) throw Error("STALE");
  if (!response.ok) throw Error(method === "POST" ? "UNKNOWN" : "OFFLINE");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

function explain(e: unknown) {
  const code = e instanceof Error ? e.message : "UNKNOWN";
  return code === "EXPIRED"
    ? "Session expired. Please sign in again."
    : code === "DENIED"
    ? "Your current role does not allow this notice."
    : code === "STALE"
    ? "The preference changed. Refresh before saving."
    : "The notification result could not be confirmed. Refresh its original state.";
}

export function NotificationsScreen({ token, onExit, onExpired }: Props) {
  const [activeTab, setActiveTab] = useState<"INBOX" | "PREFERENCES">("INBOX");
  const [rows, setRows] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [mobileProof, setMobileProof] = useState<MobileProof | null>(null);
  const [mobileCode, setMobileCode] = useState("");
  const [mobileBusy, setMobileBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [messages, settings] = await Promise.all([
        api<{ items: Notification[] }>(token, "inbox?limit=30"),
        api<Preferences>(token, "preferences")
      ]);
      if (
        !Array.isArray(messages.items) ||
        messages.items.length > 30 ||
        !settings ||
        !Array.isArray(settings.preferences)
      )
        throw Error("OFFLINE");
      setRows(messages.items);
      setPrefs(settings);

      try {
        const proof = await mobile<MobileProof>(token, "status");
        if (
          typeof proof.verified !== "boolean" ||
          typeof proof.hasNumber !== "boolean" ||
          typeof proof.providerConfigured !== "boolean"
        )
          throw Error("OFFLINE");
        setMobileProof(proof);
      } catch (e) {
        setMobileProof(null);
        if (e instanceof Error && e.message === "EXPIRED") onExpired();
      }
    } catch (e) {
      setRows([]);
      setPrefs(null);
      setNotice(explain(e));
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
    } finally {
      setLoading(false);
    }
  }, [token, onExpired]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function markAsRead(id: string) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await api(token, "inbox/" + encodeURIComponent(id) + "/read", "POST");
      await refresh();
    } catch (e) {
      setNotice(explain(e));
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
    } finally {
      setBusy(false);
    }
  }

  async function togglePreference(
    channel: "EMAIL" | "SMS",
    purpose: "TRANSACTIONAL" | "PROMOTIONAL"
  ) {
    if (!prefs || busy) return;
    const eligible = channel === "EMAIL" ? prefs.available.email : prefs.available.sms;
    const current = prefs.preferences.find(
      (x) => x.channel === channel && x.purpose === purpose
    );
    if (!eligible || !current) return;
    setBusy(true);
    setNotice("");
    try {
      await api(token, "preferences", "POST", {
        channel,
        purpose,
        optedIn: !current.opted_in,
        expectedRevision: current.revision
      });
      await refresh();
    } catch (e) {
      setNotice(explain(e));
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
    } finally {
      setBusy(false);
    }
  }

  async function startMobileProof() {
    if (mobileBusy || !mobileProof?.providerConfigured) return;
    setMobileBusy(true);
    setNotice("");
    try {
      await mobile(token, "start", "POST");
      setNotice("SMS verification code requested to recorded phone.");
    } catch (e) {
      setNotice(explain(e));
    } finally {
      setMobileBusy(false);
    }
  }

  async function confirmMobileProof() {
    if (mobileBusy || !/^\d{4,10}$/.test(mobileCode)) return;
    setMobileBusy(true);
    setNotice("");
    try {
      await mobile(token, "confirm", "POST", { code: mobileCode });
      setMobileCode("");
      await refresh();
    } catch (e) {
      setNotice(explain(e));
    } finally {
      setMobileBusy(false);
    }
  }

  const unreadCount = rows.filter((r) => !r.read).length;

  return (
    <SafeAreaView style={styles.page} edges={["left", "right"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onExit}
            disabled={busy}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <View style={styles.headerInfo}>
            <View style={styles.titleIconRow}>
              <View style={styles.titleIconBox}>
                <IconBell size={18} color="#D97706" />
              </View>
              <Text style={styles.headerTitle}>Notices & Notifications</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Foundation alerts, system notices & recipient inbox
            </Text>
          </View>
        </View>

        {/* Live KPI Counters */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{rows.length}</Text>
            <Text style={styles.kpiLabel}>Total Received</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: unreadCount > 0 ? "#DC2626" : "#16A34A" }]}>
              {unreadCount}
            </Text>
            <Text style={styles.kpiLabel}>Unread Updates</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text
              style={[
                styles.kpiValue,
                { color: mobileProof?.verified ? "#16A34A" : "#64748B", fontSize: 14 }
              ]}
            >
              {mobileProof?.verified ? "Verified" : "Pending"}
            </Text>
            <Text style={styles.kpiLabel}>Mobile Proof</Text>
          </View>
        </View>

        {/* Segmented Tab Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveTab("INBOX")}
            style={[styles.tabButton, activeTab === "INBOX" && styles.tabButtonActive]}
          >
            <Text
              style={[styles.tabButtonText, activeTab === "INBOX" && styles.tabButtonTextActive]}
            >
              📥 My Inbox ({rows.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveTab("PREFERENCES")}
            style={[styles.tabButton, activeTab === "PREFERENCES" && styles.tabButtonActive]}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "PREFERENCES" && styles.tabButtonTextActive
              ]}
            >
              📱 Mobile & Preferences
            </Text>
          </Pressable>
        </View>

        {/* Alert Notification Message */}
        {!!notice && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>{notice}</Text>
          </View>
        )}

        {/* TAB 1: INBOX NOTIFICATIONS */}
        {activeTab === "INBOX" && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>My Notifications ({rows.length})</Text>
              <Pressable
                accessibilityRole="button"
                style={styles.refreshBtn}
                disabled={loading}
                onPress={() => void refresh()}
              >
                <Text style={styles.refreshBtnText}>↻ Refresh</Text>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#1D4ED8" style={{ paddingVertical: 24 }} />
            ) : !rows.length ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <IconBell size={32} color="#CBD5E1" />
                </View>
                <Text style={styles.emptyTitle}>No notifications</Text>
                <Text style={styles.emptyText}>Your personal Foundation inbox is completely up to date.</Text>
              </View>
            ) : (
              rows.map((item) => (
                <View
                  key={item.notificationRef}
                  style={[
                    styles.notificationCard,
                    !item.read ? styles.notificationUnread : styles.notificationRead
                  ]}
                >
                  <View style={styles.notificationTopRow}>
                    <View
                      style={[
                        styles.channelIconBox,
                        !item.read ? styles.channelIconUnread : styles.channelIconRead
                      ]}
                    >
                      <IconBell size={16} color={!item.read ? "#15803D" : "#64748B"} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.notificationTitle}>{item.title}</Text>
                      <Text style={styles.notificationMeta}>
                        {new Date(item.receivedAt).toLocaleDateString()} at{" "}
                        {new Date(item.receivedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </Text>
                    </View>

                    <View style={styles.channelBadgePill}>
                      <Text style={styles.channelBadgeText}>{item.channel}</Text>
                    </View>

                    {!item.read && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.notificationBody}>{item.body}</Text>

                  {!item.read && (
                    <View style={styles.notificationActions}>
                      <Pressable
                        accessibilityRole="button"
                        style={styles.markReadBtn}
                        disabled={busy}
                        onPress={() => void markAsRead(item.notificationRef)}
                      >
                        <Text style={styles.markReadBtnText}>✓ Mark as read</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: MOBILE PROOF & DELIVERY PREFERENCES */}
        {activeTab === "PREFERENCES" && (
          <>
            {/* Mobile Contact Verification Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeading}>Verified Mobile Contact</Text>
                <View
                  style={[
                    styles.statusPill,
                    mobileProof?.verified ? styles.statusPillGreen : styles.statusPillAmber
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      mobileProof?.verified ? styles.statusTextGreen : styles.statusTextAmber
                    ]}
                  >
                    {mobileProof?.verified ? "✓ Verified" : "Unverified"}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardDesc}>
                Emergency alerts and operational notices are delivered to your verified CareGanga phone number.
              </Text>

              {!mobileProof ? (
                <Text style={styles.noteText}>Contact verification service is currently unavailable.</Text>
              ) : mobileProof.verified ? (
                <View style={styles.verifiedPhoneBox}>
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
              ) : !mobileProof.hasNumber ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    No mobile number is recorded for your staff account. Contact an administrator to add your phone.
                  </Text>
                </View>
              ) : (
                <View style={styles.verifyActionBox}>
                  <Text style={styles.phoneLabel}>
                    Recorded contact: <Text style={{ fontWeight: "800" }}>{mobileProof.maskedContact}</Text>
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    style={styles.requestSmsBtn}
                    disabled={busy || mobileBusy || !mobileProof.providerConfigured}
                    onPress={() => void startMobileProof()}
                  >
                    <Text style={styles.requestSmsBtnText}>
                      {mobileProof.providerConfigured
                        ? "Request SMS Verification Code"
                        : "SMS Verification Simulated"}
                    </Text>
                  </Pressable>

                  <TextInput
                    style={styles.codeInput}
                    value={mobileCode}
                    onChangeText={(x) => setMobileCode(x.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="Enter code from SMS..."
                    placeholderTextColor="#94A3B8"
                  />

                  <Pressable
                    accessibilityRole="button"
                    style={[
                      styles.confirmCodeBtn,
                      (!/^\d{4,10}$/.test(mobileCode) || mobileBusy) && styles.btnDisabled
                    ]}
                    disabled={busy || mobileBusy || !/^\d{4,10}$/.test(mobileCode)}
                    onPress={() => void confirmMobileProof()}
                  >
                    <Text style={styles.confirmCodeBtnText}>Verify Mobile Contact</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Delivery Channel Preferences Card */}
            <View style={styles.card}>
              <Text style={styles.cardHeading}>Delivery Channel Preferences</Text>
              <Text style={styles.cardDesc}>
                In-app notices are always delivered. Configure whether you wish to receive off-channel SMS and Email alerts.
              </Text>

              {prefs &&
                (["EMAIL", "SMS"] as const).map((channel) =>
                  (["TRANSACTIONAL", "PROMOTIONAL"] as const).map((purpose) => {
                    const available =
                      channel === "EMAIL" ? prefs.available.email : prefs.available.sms;
                    const current = prefs.preferences.find(
                      (x) => x.channel === channel && x.purpose === purpose
                    );
                    const isOptedIn = !!current?.opted_in;

                    return (
                      <Pressable
                        key={channel + purpose}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isOptedIn, disabled: !available || busy }}
                        disabled={!available || busy}
                        onPress={() => void togglePreference(channel, purpose)}
                        style={[
                          styles.prefOptionRow,
                          !available && styles.prefOptionDisabled,
                          isOptedIn && styles.prefOptionActive
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prefOptionTitle}>
                            {channel} • {purpose.charAt(0) + purpose.slice(1).toLowerCase()} Alerts
                          </Text>
                          <Text style={styles.prefOptionSub}>
                            {!available
                              ? "Contact channel not verified on account"
                              : isOptedIn
                              ? "Currently opted in to receive broadcasts"
                              : "Tap to enable alerts on this channel"}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.checkboxBox,
                            isOptedIn && styles.checkboxBoxActive,
                            !available && styles.checkboxBoxDisabled
                          ]}
                        >
                          {isOptedIn && <Text style={styles.checkboxCheckmark}>✓</Text>}
                        </View>
                      </Pressable>
                    );
                  })
                )}
            </View>
          </>
        )}
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
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
  kpiRow: {
    flexDirection: "row",
    gap: 8
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A"
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
    textAlign: "center"
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
  cardDesc: {
    fontSize: 12.5,
    color: "#64748B",
    lineHeight: 17
  },
  refreshBtn: {
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
    paddingVertical: 32,
    alignItems: "center",
    gap: 8
  },
  emptyIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B"
  },
  emptyText: {
    fontSize: 12.5,
    color: "#94A3B8",
    textAlign: "center"
  },
  notificationCard: {
    borderRadius: 12,
    padding: 14,
    gap: 8
  },
  notificationUnread: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  notificationRead: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  notificationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  channelIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  channelIconUnread: {
    backgroundColor: "#DCFCE7"
  },
  channelIconRead: {
    backgroundColor: "#F1F5F9"
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A"
  },
  notificationMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  channelBadgePill: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5
  },
  channelBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4338CA"
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A"
  },
  notificationBody: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18
  },
  notificationActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2
  },
  markReadBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 8
  },
  markReadBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#16A34A"
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  statusPillGreen: { backgroundColor: "#DCFCE7" },
  statusPillAmber: { backgroundColor: "#FEF3C7" },
  statusPillText: { fontSize: 10.5, fontWeight: "800" },
  statusTextGreen: { color: "#166534" },
  statusTextAmber: { color: "#B45309" },
  verifiedPhoneBox: {
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
  warningBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 12
  },
  warningText: {
    fontSize: 12,
    color: "#92400E"
  },
  verifyActionBox: {
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
  codeInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A"
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
  btnDisabled: {
    opacity: 0.5
  },
  noteText: {
    fontSize: 12,
    color: "#64748B"
  },
  prefOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 10
  },
  prefOptionActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE"
  },
  prefOptionDisabled: {
    opacity: 0.5
  },
  prefOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  prefOptionSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxBoxActive: {
    backgroundColor: "#4338CA",
    borderColor: "#4338CA"
  },
  checkboxBoxDisabled: {
    backgroundColor: "#E2E8F0"
  },
  checkboxCheckmark: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: -2
  }
});
