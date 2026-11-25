import React, { useCallback, useEffect, useState } from "react";
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
  IconClose,
  IconHelpCircle,
  IconSearch,
  IconSend,
  IconUser
} from "../dashboard/dashboard-icons";

type CaseView = {
  caseRef: string;
  ticketNumber: string;
  subject: string;
  name: string;
  contact: string;
  status: string;
  revision: number;
  assignedAccountRef: string | null;
  unread: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

type Detail = CaseView & {
  message: string;
  replies: Array<{
    replyRef: string;
    body: string;
    authorAccountRef: string;
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
  unread: number;
  open: number;
  replied: number;
  closed: number;
  archived: number;
  received_today: number;
};

type Option = { value: string; label: string };

type Props = {
  token: string;
  mayView: boolean;
  mayManage: boolean;
  mayReply?: boolean;
  mayFaq?: boolean;
  mayChooseAccounts?: boolean;
  onExit: () => void;
  onExpired: () => void;
};

async function api<T>(
  token: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  payload?: object
): Promise<T> {
  let result: Response;
  try {
    result = await identityRequest("/api/support/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(payload ? { "Content-Type": "application/json" } : {})
      },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });
  } catch {
    throw Error("UNKNOWN");
  }
  if (result.status === 401) throw Error("EXPIRED");
  if (result.status === 403) throw Error("DENIED");
  if (result.status === 409) throw Error("CONFLICT");
  if (result.status === 400) throw Error("INVALID");
  if (!result.ok) throw Error("UNKNOWN");
  try {
    return (await result.json()) as T;
  } catch {
    throw Error("UNKNOWN");
  }
}

const friendly = (error: unknown) => {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  return code === "EXPIRED"
    ? "Current staff session expired."
    : code === "DENIED"
    ? "Current role does not permit this support action."
    : code === "CONFLICT"
    ? "Another operator changed this case. Refresh before retrying."
    : code === "INVALID"
    ? "Check the entered information."
    : "The result could not be confirmed. Check the original case before retrying.";
};

export function FoundationSupportScreen({
  token,
  mayView,
  mayManage,
  onExit,
  onExpired
}: Props) {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [cases, setCases] = useState<CaseView[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [agents, setAgents] = useState<Option[]>([]);
  const [assignee, setAssignee] = useState("");
  const [nextStatus, setNextStatus] = useState("OPEN");
  const [statusNote, setStatusNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [res, agentRes] = await Promise.all([
        mayView
          ? api<{ items: CaseView[]; counts: Counts; nextCursor: string | null }>(
              token,
              "cases/search",
              "POST",
              {
                status: filter === "ALL" ? undefined : filter,
                search: appliedSearch.trim() || undefined,
                limit: 25
              }
            )
          : null,
        api<{ accounts: Option[] }>(token, "operators").catch(() => ({ accounts: [] }))
      ]);

      if (res) {
        setCases(res.items);
        setCounts(res.counts);
      }
      setAgents(agentRes.accounts ?? []);
    } catch (e) {
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
      else setMessage(friendly(e));
    } finally {
      setLoading(false);
    }
  }, [token, mayView, filter, appliedSearch, onExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTicketDetail = async (caseRef: string) => {
    setBusy(true);
    setMessage("");
    try {
      const detail = await api<Detail>(token, `cases/${encodeURIComponent(caseRef)}`);
      setSelected(detail);
      setAssignee(detail.assignedAccountRef ?? "");
      setNextStatus(detail.status);
      setStatusNote("");
      setReply("");
    } catch (e) {
      setMessage(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const sendTicketReply = async () => {
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await api(token, `cases/${encodeURIComponent(selected.caseRef)}/reply`, "POST", {
        body: reply.trim(),
        expectedRevision: selected.revision,
        requestKey: Crypto.randomUUID()
      });
      setReply("");
      await openTicketDetail(selected.caseRef);
      void load();
    } catch (e) {
      setMessage(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const updateTicketStatus = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await api(token, `cases/${encodeURIComponent(selected.caseRef)}/status`, "POST", {
        status: nextStatus,
        summary: statusNote.trim() || "Status updated by operator",
        expectedRevision: selected.revision,
        requestKey: Crypto.randomUUID()
      });
      setStatusNote("");
      await openTicketDetail(selected.caseRef);
      void load();
    } catch (e) {
      setMessage(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const assignTicketOperator = async (operatorRef: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await api(token, `cases/${encodeURIComponent(selected.caseRef)}/assign`, "POST", {
        assignedAccountRef: operatorRef || null,
        expectedRevision: selected.revision,
        requestKey: Crypto.randomUUID()
      });
      setAssignee(operatorRef);
      await openTicketDetail(selected.caseRef);
      void load();
    } catch (e) {
      setMessage(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const operatorOptions = [
    { value: "", label: "Unassigned / General Pool", subtitle: "Available for any support agent" },
    ...agents.map((a) => ({
      value: a.value,
      label: a.label,
      subtitle: "Verified Support Staff"
    }))
  ];

  const statusOptions = [
    { value: "OPEN", label: "Open / In Progress", badge: "Active", badgeColor: "#1D4ED8" },
    { value: "REPLIED", label: "Replied to Citizen", badge: "Replied", badgeColor: "#D97706" },
    { value: "CLOSED", label: "Resolved & Closed", badge: "Closed", badgeColor: "#16A34A" }
  ];

  return (
    <SafeAreaView style={styles.page} edges={["left", "right"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {/* Top Header */}
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={onExit} disabled={busy} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>

          <View style={styles.headerInfo}>
            <View style={styles.titleIconRow}>
              <View style={styles.titleIconBox}>
                <IconHelpCircle size={18} color="#2563EB" />
              </View>
              <Text style={styles.headerTitle}>Contact Messages & Help</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Public inquiries, complaints and citizen support operations
            </Text>
          </View>
        </View>

        {/* Live KPI Stat Cards */}
        {counts && (
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{counts.total}</Text>
              <Text style={styles.kpiLabel}>Total Tickets</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#2563EB" }]}>{counts.open}</Text>
              <Text style={styles.kpiLabel}>Open Inquiries</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#D97706" }]}>{counts.replied}</Text>
              <Text style={styles.kpiLabel}>Replied</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#16A34A" }]}>{counts.closed}</Text>
              <Text style={styles.kpiLabel}>Resolved</Text>
            </View>
          </View>
        )}

        {/* Alert notification message */}
        {!!message && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>{message}</Text>
          </View>
        )}

        {/* Search & Filter Bar */}
        <View style={styles.filterCard}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <IconSearch size={16} color="#94A3B8" />
              <TextInput
                placeholder="Search ticket, name, contact..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={() => setAppliedSearch(search)}
                style={styles.searchInput}
              />
              {!!search && (
                <Pressable
                  onPress={() => {
                    setSearch("");
                    setAppliedSearch("");
                  }}
                  style={styles.clearSearchBtn}
                >
                  <IconClose size={14} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            <Pressable style={styles.searchSubmitBtn} onPress={() => setAppliedSearch(search)}>
              <Text style={styles.searchSubmitText}>Search</Text>
            </Pressable>
          </View>

          {/* Status Filter Pills */}
          <View style={styles.filterPillsRow}>
            {["ALL", "OPEN", "REPLIED", "CLOSED"].map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterPill, filter === f && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>
                  {f === "ALL" ? "All Inquiries" : f.charAt(0) + f.slice(1).toLowerCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Tickets List */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeading}>Support Tickets & Inquiries</Text>
            <Pressable style={styles.refreshBtn} disabled={loading} onPress={() => void load()}>
              <Text style={styles.refreshBtnText}>↻ Refresh</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#1D4ED8" style={{ paddingVertical: 24 }} />
          ) : !cases.length ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No support tickets match your filter criteria.</Text>
            </View>
          ) : (
            cases.map((c) => (
              <Pressable
                key={c.caseRef}
                onPress={() => void openTicketDetail(c.caseRef)}
                style={styles.ticketCard}
              >
                <View style={styles.ticketTopRow}>
                  <View style={styles.ticketBadgeWrap}>
                    <Text style={styles.ticketNumberText}>{c.ticketNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ticketNameText}>{c.name}</Text>
                    <Text style={styles.ticketContactText}>{c.contact}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      c.status === "OPEN"
                        ? styles.statusPillBlue
                        : c.status === "REPLIED"
                        ? styles.statusPillAmber
                        : styles.statusPillGreen
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        c.status === "OPEN"
                          ? styles.statusTextBlue
                          : c.status === "REPLIED"
                          ? styles.statusTextAmber
                          : styles.statusTextGreen
                      ]}
                    >
                      {c.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ticketSubject} numberOfLines={1}>
                  {c.subject}
                </Text>

                <View style={styles.ticketBottomRow}>
                  <Text style={styles.ticketDate}>
                    {new Date(c.createdAt).toLocaleDateString()} at{" "}
                    {new Date(c.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>
                  <Text style={styles.viewDetailLink}>View Discussion →</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* TICKET DETAIL DRAWER / MODAL */}
        <Modal
          visible={!!selected}
          transparent
          animationType="slide"
          onRequestClose={() => setSelected(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
            <Pressable style={[styles.modalCard, { maxHeight: "90%" }]} onPress={(e) => e.stopPropagation()}>
              {selected && (
                <ScrollView keyboardShouldPersistTaps="handled">
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>{selected.ticketNumber}</Text>
                      <Text style={styles.modalSub}>
                        From {selected.name} • {selected.contact}
                      </Text>
                    </View>
                    <Pressable onPress={() => setSelected(null)} style={styles.closeBtn}>
                      <IconClose size={18} color="#64748B" />
                    </Pressable>
                  </View>

                  {/* Original Inquiry Box */}
                  <View style={styles.inquiryBox}>
                    <Text style={styles.inquirySubject}>{selected.subject}</Text>
                    <Text style={styles.inquiryMessage}>{selected.message}</Text>
                    <Text style={styles.inquiryDate}>
                      Submitted: {new Date(selected.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  {/* Activity Audit Timeline */}
                  <View style={styles.sectionDivider} />
                  <Text style={styles.sectionHeading}>Activity Audit History</Text>
                  <View style={styles.timelineList}>
                    {selected.history.map((h, i) => (
                      <View key={i} style={styles.timelineRow}>
                        <View style={styles.timelineDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.timelineKind}>{h.kind.replace(/_/g, " ")}</Text>
                          <Text style={styles.timelineDate}>{new Date(h.at).toLocaleString()}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Previous Replies */}
                  {selected.replies && selected.replies.length > 0 && (
                    <>
                      <View style={styles.sectionDivider} />
                      <Text style={styles.sectionHeading}>Replies & Discussion</Text>
                      {selected.replies.map((r) => (
                        <View key={r.replyRef} style={styles.replyBox}>
                          <Text style={styles.replyAuthor}>Support Agent</Text>
                          <Text style={styles.replyBody}>{r.body}</Text>
                          <Text style={styles.replyDate}>{new Date(r.createdAt).toLocaleString()}</Text>
                        </View>
                      ))}
                    </>
                  )}

                  {/* Operator Assignment Dropdown */}
                  {mayManage && (
                    <>
                      <View style={styles.sectionDivider} />
                      <NativeCustomDropdown
                        label="Assign Support Operator"
                        options={operatorOptions}
                        value={assignee}
                        onChange={(val) => void assignTicketOperator(val)}
                      />
                    </>
                  )}

                  {/* Status Transition Dropdown & Notes */}
                  {mayManage && (
                    <View style={{ marginTop: 8 }}>
                      <NativeCustomDropdown
                        label="Update Ticket Status"
                        options={statusOptions}
                        value={nextStatus}
                        onChange={(val) => setNextStatus(val)}
                      />

                      <Text style={styles.fieldLabel}>Resolution Note (Optional)</Text>
                      <TextInput
                        value={statusNote}
                        onChangeText={setStatusNote}
                        placeholder="Add resolution explanation..."
                        placeholderTextColor="#94A3B8"
                        style={styles.inputBox}
                      />

                      <Pressable
                        style={styles.btnStatusUpdate}
                        disabled={busy}
                        onPress={() => void updateTicketStatus()}
                      >
                        <Text style={styles.btnStatusUpdateText}>Apply Status Change</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Compose Reply Section */}
                  <View style={styles.sectionDivider} />
                  <Text style={styles.sectionHeading}>Send Reply to Citizen</Text>
                  <TextInput
                    value={reply}
                    onChangeText={setReply}
                    placeholder="Type your official reply..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={4}
                    style={[styles.inputBox, { height: 85, textAlignVertical: "top" }]}
                  />

                  {/* Quick Reply Prefills */}
                  <View style={styles.quickRepliesRow}>
                    <Pressable
                      style={styles.quickReplyBtn}
                      onPress={() =>
                        setReply(
                          "Thank you for contacting CareGanga Foundation. We have received your inquiry and our support team is reviewing it."
                        )
                      }
                    >
                      <Text style={styles.quickReplyText}>+ Received</Text>
                    </Pressable>
                    <Pressable
                      style={styles.quickReplyBtn}
                      onPress={() =>
                        setReply(
                          "Your request has been addressed and verified. Please visit your nearest CareGanga Foundation center for further assistance."
                        )
                      }
                    >
                      <Text style={styles.quickReplyText}>+ Visit Center</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={[styles.btnSendReply, (!reply.trim() || busy) && styles.btnDisabled]}
                    disabled={!reply.trim() || busy}
                    onPress={() => void sendTicketReply()}
                  >
                    {busy ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.btnSendReplyText}>Send Official Reply</Text>
                    )}
                  </Pressable>
                </ScrollView>
              )}
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
    backgroundColor: "#EFF6FF",
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
    backgroundColor: "#2563EB",
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
  filterPillsRow: {
    flexDirection: "row",
    gap: 6
  },
  filterPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    alignItems: "center"
  },
  filterPillActive: {
    backgroundColor: "#2563EB"
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748B"
  },
  filterPillTextActive: {
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
    paddingVertical: 24,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  ticketCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    gap: 6
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  ticketBadgeWrap: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6
  },
  ticketNumberText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#4338CA"
  },
  ticketNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  ticketContactText: {
    fontSize: 11,
    color: "#64748B"
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  statusPillBlue: { backgroundColor: "#EFF6FF" },
  statusPillAmber: { backgroundColor: "#FEF3C7" },
  statusPillGreen: { backgroundColor: "#DCFCE7" },
  statusPillText: { fontSize: 10.5, fontWeight: "800" },
  statusTextBlue: { color: "#1D4ED8" },
  statusTextAmber: { color: "#B45309" },
  statusTextGreen: { color: "#166534" },
  ticketSubject: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155"
  },
  ticketBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9"
  },
  ticketDate: {
    fontSize: 11,
    color: "#94A3B8"
  },
  viewDetailLink: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2563EB"
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A"
  },
  modalSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1
  },
  closeBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#F8FAFC"
  },
  inquiryBox: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 10,
    padding: 12,
    gap: 6
  },
  inquirySubject: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E40AF"
  },
  inquiryMessage: {
    fontSize: 12.5,
    color: "#1E3A8A",
    lineHeight: 18
  },
  inquiryDate: {
    fontSize: 11,
    color: "#60A5FA",
    marginTop: 2
  },
  sectionDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8
  },
  timelineList: {
    gap: 6
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB"
  },
  timelineKind: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155"
  },
  timelineDate: {
    fontSize: 10.5,
    color: "#94A3B8"
  },
  replyBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    marginBottom: 6
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB"
  },
  replyBody: {
    fontSize: 12,
    color: "#1E293B",
    lineHeight: 16
  },
  replyDate: {
    fontSize: 10.5,
    color: "#94A3B8"
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 6
  },
  inputBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A"
  },
  btnStatusUpdate: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8
  },
  btnStatusUpdateText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#334155"
  },
  quickRepliesRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6
  },
  quickReplyBtn: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  quickReplyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2563EB"
  },
  btnSendReply: {
    backgroundColor: "#2563EB",
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10
  },
  btnSendReplyText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.5
  }
});
