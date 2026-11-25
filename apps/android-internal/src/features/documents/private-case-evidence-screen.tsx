import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type {
  CG03CaseView,
  CG19UploadStart,
  CG19UploadStatus
} from "@careganga/api-contracts";
import { identityRequest } from "../identity-access/http-client";
import { NativePrivateLetterPanel } from "./native-private-letter-panel";
import { NativeCustomDropdown } from "../../shared/native-custom-dropdown";
import {
  IconFileText,
  IconChevronRight,
  IconShieldCheck,
  IconArrowLeft,
  IconFolder
} from "../dashboard/dashboard-icons";

type Props = {
  token: string;
  onExit: () => void;
  onExpired: () => void;
  canViewLetters?: boolean;
  canRevokeLetters?: boolean;
};

const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
type Selected = { uri: string; name: string; size: number; mime: string };
type Media = {
  fileRef: string;
  revision: number;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  revoked: boolean;
};

async function api<T>(token: string, path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await identityRequest(path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error(method === "POST" ? "UNCERTAIN" : "OFFLINE");
  }
  if (response.status === 401) throw Error("EXPIRED");
  if (response.status === 403) throw Error("DENIED");
  if (response.status === 409) throw Error("CHANGED");
  if (response.status === 400) throw Error("INVALID");
  if (!response.ok) throw Error(method === "POST" ? "UNCERTAIN" : "OFFLINE");
  try {
    return (await response.json()) as T;
  } catch {
    throw Error(method === "POST" ? "UNCERTAIN" : "OFFLINE");
  }
}

function explain(error: unknown): string {
  const code = error instanceof Error ? error.message : "UNCERTAIN";
  return code === "EXPIRED"
    ? "Session expired. Sign in again."
    : code === "DENIED"
    ? "Your current access does not permit this private file."
    : code === "CHANGED"
    ? "The original application changed. Refresh to continue."
    : code === "INVALID"
    ? "Check the file selection, type and size."
    : "The file action was not confirmed. Check the same original request before retrying.";
}

const statusLabel = (code: string) =>
  ({
    VALIDATED: "File and malware scan verified",
    INITIATED: "Awaiting verified upload",
    UPLOAD_READY: "Upload permission ready, not yet verified",
    UNKNOWN: "File verification uncertain",
    STORAGE_UNAVAILABLE: "Secure storage unavailable (Local Development Mode)",
    VERIFICATION_UNAVAILABLE: "Malware scan not verified",
    REJECTED: "File rejected",
    EXPIRED: "Upload permission expired"
  }[code] ?? "Private file not confirmed");

export function PrivateCaseEvidenceScreen({
  token,
  onExit,
  onExpired,
  canViewLetters = false,
  canRevokeLetters = false
}: Props) {
  const [activeTab, setActiveTab] = useState<"EVIDENCE" | "LETTERS">("EVIDENCE");
  const [list, setList] = useState<CG03CaseView[]>([]);
  const [selected, setSelected] = useState<CG03CaseView | null>(null);
  const [picked, setPicked] = useState<Selected | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [revokeUncertain, setRevokeUncertain] = useState<string | null>(null);
  const mediaRequest = useRef(0);
  const [requestKey, setRequestKey] = useState("");
  const [intentRef, setIntentRef] = useState("");
  const [result, setResult] = useState<CG19UploadStart | CG19UploadStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ cases: CG03CaseView[] }>(
        token,
        "/api/registration-approvals/cases?limit=30"
      );
      if (
        !Array.isArray(data.cases) ||
        data.cases.length > 30 ||
        data.cases.some(
          (c) =>
            typeof c.caseRef !== "string" ||
            typeof c.reference !== "string" ||
            !Number.isInteger(c.proposalRevision)
        )
      )
        throw Error("OFFLINE");
      setList(data.cases);
      setSelected((old) => (old ? data.cases.find((c) => c.caseRef === old.caseRef) ?? null : data.cases[0] ?? null));
    } catch (e) {
      setList([]);
      setSelected(null);
      if (e instanceof Error && e.message === "EXPIRED") onExpired();
      else setMessage(explain(e));
    } finally {
      setLoading(false);
    }
  }, [token, onExpired]);

  useEffect(() => {
    void fetchCases();
  }, [fetchCases]);

  const loadMedia = useCallback(async () => {
    const seq = ++mediaRequest.current;
    if (!selected) {
      setMedia([]);
      return;
    }
    setMediaBusy(true);
    try {
      const files = await api<{ files: Media[] }>(
        token,
        "/api/documents/files/case/" + encodeURIComponent(selected.caseRef)
      );
      if (!Array.isArray(files.files) || files.files.length > 30) throw Error("OFFLINE");
      if (seq !== mediaRequest.current) return;
      setMedia(files.files);
    } catch (e) {
      if (seq !== mediaRequest.current) return;
      setMedia([]);
      setMessage(explain(e));
    } finally {
      if (seq === mediaRequest.current) setMediaBusy(false);
    }
  }, [token, selected]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const clearFile = () => {
    setPicked(null);
    setResult(null);
    setIntentRef("");
    setRequestKey("");
    setUncertain(false);
  };

  const choose = async () => {
    setMessage("");
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const f = res.assets[0];
      const mime = f.mimeType ?? "";
      if (!MIME.has(mime) || !f.size || f.size > 10 * 1024 * 1024) {
        setMessage("Supported types: PDF, JPEG, PNG, WebP up to 10 MB.");
        return;
      }
      setPicked({ uri: f.uri, name: f.name, size: f.size, mime });
      setRequestKey(Crypto.randomUUID());
      setResult(null);
      setIntentRef("");
      setUncertain(false);
    } catch {
      setMessage("Could not choose the file. Try again.");
    }
  };

  const upload = async () => {
    if (!picked || !selected || !requestKey || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const start = await api<CG19UploadStart>(
        token,
        "/api/documents/files/intents",
        "POST",
        {
          caseRef: selected.caseRef,
          sourceRevision: selected.proposalRevision,
          originalName: picked.name,
          mime: picked.mime,
          sizeBytes: picked.size,
          requestKey
        }
      );
      setIntentRef(start.uploadRef);
      setResult(start);
      if (start.status !== "UPLOAD_READY" || !start.uploadUrl) return;

      const fileObj = new File(picked.uri);
      const fileBytes = await fileObj.bytes();
      const putRes = await fetch(start.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": picked.mime },
        body: fileBytes
      });
      if (!putRes.ok) throw Error("UNCERTAIN");

      const confirm = await api<CG19UploadStatus>(
        token,
        "/api/documents/files/intents/" + encodeURIComponent(start.uploadRef) + "/confirm",
        "POST",
        {
          caseRef: selected.caseRef,
          sourceRevision: selected.proposalRevision,
          requestKey: Crypto.randomUUID()
        }
      );
      setResult(confirm);
      if (confirm.status === "VALIDATED") {
        setPicked(null);
        void loadMedia();
      }
    } catch (e) {
      setUncertain(true);
      setMessage(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const checkPrevious = async () => {
    if (!intentRef || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const status = await api<CG19UploadStatus>(
        token,
        "/api/documents/files/intents/" + encodeURIComponent(intentRef)
      );
      setResult(status);
      setUncertain(status.status === "UNKNOWN");
      if (status.status === "VALIDATED") {
        setPicked(null);
        void loadMedia();
      }
    } catch (e) {
      setMessage(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const revokeMedia = async (item: Media) => {
    if (busy || !selected) return;
    setBusy(true);
    setMessage("");
    setRevokeUncertain(null);
    try {
      await api(token, "/api/documents/files/revoke", "POST", {
        caseRef: selected.caseRef,
        sourceRevision: selected.proposalRevision,
        fileRef: item.fileRef,
        requestKey: Crypto.randomUUID()
      });
      void loadMedia();
    } catch {
      setRevokeUncertain(item.fileRef);
      setMessage("Revocation outcome unconfirmed. Check verified list.");
    } finally {
      setBusy(false);
    }
  };

  const previewVerified = async (fileRef: string, kind: "evidence" | "letter" = "evidence") => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    let temporary: File | null = null;
    try {
      const path =
        kind === "letter"
          ? "/api/documents/letters/" + encodeURIComponent(fileRef) + "/preview"
          : "/api/documents/files/" + encodeURIComponent(fileRef) + "/download";
      const response = await identityRequest(path, {
        headers: { Authorization: "Bearer " + token }
      });
      if (response.status === 401) return onExpired();
      if (!response.ok) throw Error("OFFLINE");
      const mime = response.headers.get("content-type") ?? "application/pdf";
      const bytes = new Uint8Array(await response.arrayBuffer());
      const suffix =
        mime === "application/pdf"
          ? ".pdf"
          : mime === "image/jpeg"
          ? ".jpg"
          : mime === "image/png"
          ? ".png"
          : ".webp";
      temporary = new File(Paths.cache, "careganga-private-" + Crypto.randomUUID() + suffix);
      temporary.create();
      await temporary.write(bytes);
      await temporary.preview({ title: "CareGanga Document Preview" });
    } catch (e) {
      setMessage(explain(e));
    } finally {
      try {
        temporary?.delete();
      } catch {}
      setBusy(false);
    }
  };

  // Convert case list to dropdown options
  const caseOptions = list.map((c) => ({
    value: c.caseRef,
    label: `${c.reference} — ${c.accountName}`,
    subtitle: `Revision ${c.proposalRevision} • Status: ${c.status.replace(/_/g, " ")}`,
    badge: c.status.replace(/_/g, " "),
    badgeColor: c.status === "APPROVED" ? "#16A34A" : "#1D4ED8"
  }));

  return (
    <SafeAreaView style={styles.page} edges={["left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.page}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* Top Navigation & Header */}
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={onExit}
              disabled={busy || uncertain}
              style={styles.backButton}
            >
              <IconArrowLeft size={18} color="#334155" />
            </Pressable>

            <View style={styles.headerInfo}>
              <View style={styles.titleIconRow}>
                <View style={styles.titleIconBox}>
                  <IconFileText size={18} color="#1D4ED8" />
                </View>
                <Text style={styles.headerTitle}>Private Case Documents</Text>
              </View>
              <Text style={styles.headerSubtitle}>
                Protected case evidence, malware scans & official letters
              </Text>
            </View>
          </View>

          {/* Segmented Tab Switcher */}
          <View style={styles.tabBar}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "EVIDENCE" }}
              onPress={() => setActiveTab("EVIDENCE")}
              style={[styles.tabButton, activeTab === "EVIDENCE" && styles.tabButtonActive]}
            >
              <IconFolder size={15} color={activeTab === "EVIDENCE" ? "#1D4ED8" : "#64748B"} />
              <Text
                style={[styles.tabButtonText, activeTab === "EVIDENCE" && styles.tabButtonTextActive]}
              >
                Case Evidence Files
              </Text>
            </Pressable>

            {canViewLetters && (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === "LETTERS" }}
                onPress={() => setActiveTab("LETTERS")}
                style={[styles.tabButton, activeTab === "LETTERS" && styles.tabButtonActive]}
              >
                <IconFileText size={15} color={activeTab === "LETTERS" ? "#1D4ED8" : "#64748B"} />
                <Text
                  style={[styles.tabButtonText, activeTab === "LETTERS" && styles.tabButtonTextActive]}
                >
                  Official Letters & Certs
                </Text>
              </Pressable>
            )}
          </View>

          {/* Alert Message Banner */}
          {!!message && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>{message}</Text>
            </View>
          )}

          {/* Case Selector Dropdown */}
          <View style={styles.card}>
            <Text style={styles.cardSectionHeading}>Select Authorized Case</Text>
            {loading ? (
              <ActivityIndicator
                accessibilityLabel="Verifying applications"
                color="#1D4ED8"
                style={{ paddingVertical: 12 }}
              />
            ) : !list.length ? (
              <Text style={styles.emptyNote}>No authorized applications are available.</Text>
            ) : (
              <NativeCustomDropdown
                label="Case / Application Reference"
                options={caseOptions}
                value={selected?.caseRef ?? ""}
                onChange={(val) => {
                  const found = list.find((c) => c.caseRef === val);
                  if (found) {
                    setSelected(found);
                    setRevokeUncertain(null);
                    clearFile();
                  }
                }}
                searchable
                placeholder="Choose an active case..."
              />
            )}
          </View>

          {/* TAB 1: EVIDENCE FILES */}
          {activeTab === "EVIDENCE" && selected && (
            <>
              {/* Upload Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeading}>Upload Verified Evidence</Text>
                  <View style={styles.pillBadge}>
                    <Text style={styles.pillBadgeText}>PDF, JPG, PNG, WebP (Max 10 MB)</Text>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={busy || uncertain}
                  onPress={() => void choose()}
                  style={styles.dropZone}
                >
                  <View style={styles.dropZoneIcon}>
                    <IconFileText size={28} color="#4F46E5" />
                  </View>
                  <Text style={styles.dropZonePrimary}>
                    {picked ? picked.name : "Tap to browse & select evidence file"}
                  </Text>
                  <Text style={styles.dropZoneSecondary}>
                    {picked
                      ? `${(picked.size / (1024 * 1024)).toFixed(2)} MB • ${picked.mime}`
                      : "Direct device selection with automated malware scan"}
                  </Text>
                </Pressable>

                {!!result && (
                  <View style={styles.statusBox}>
                    <Text style={styles.statusBoxLabel}>
                      Status: {statusLabel(result.status)}
                    </Text>
                  </View>
                )}

                {uncertain && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>Previous upload uncertain</Text>
                    <Text style={styles.warningDesc}>
                      Do not repeat the upload. Refresh verification status to reconcile.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      style={styles.secondaryBtn}
                      disabled={!intentRef || busy}
                      onPress={() => void checkPrevious()}
                    >
                      <Text style={styles.secondaryBtnText}>Check original upload status</Text>
                    </Pressable>
                  </View>
                )}

                {!uncertain && (
                  <View style={styles.actionBtnRow}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!picked || busy}
                      style={[styles.primaryBtn, (!picked || busy) && styles.btnDisabled]}
                      onPress={() => void upload()}
                    >
                      {busy ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Upload & Verify Scan</Text>
                      )}
                    </Pressable>

                    {intentRef ? (
                      <Pressable
                        accessibilityRole="button"
                        style={styles.secondaryBtn}
                        disabled={busy}
                        onPress={() => void checkPrevious()}
                      >
                        <Text style={styles.secondaryBtnText}>Check Status</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Verified Files Library */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeading}>Verified Case File Library</Text>
                  <Pressable
                    accessibilityRole="button"
                    style={styles.refreshIconBtn}
                    disabled={busy || mediaBusy}
                    onPress={() => void loadMedia()}
                  >
                    <Text style={styles.refreshIconText}>↻ Refresh</Text>
                  </Pressable>
                </View>

                {mediaBusy ? (
                  <ActivityIndicator color="#1D4ED8" style={{ paddingVertical: 16 }} />
                ) : !media.length ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>
                      No verified private files uploaded for this case yet.
                    </Text>
                  </View>
                ) : (
                  media.map((item) => (
                    <View key={item.fileRef} style={styles.fileCard}>
                      <View style={styles.fileCardInfo}>
                        <View style={styles.fileTypeBadge}>
                          <Text style={styles.fileTypeBadgeText}>
                            {item.mime.split("/")[1]?.toUpperCase() ?? "FILE"}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.fileNameText}>
                            {(item.sizeBytes / 1024).toFixed(1)} KB • {item.mime}
                          </Text>
                          <Text style={styles.fileDateText}>
                            Uploaded: {new Date(item.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.badgePill,
                            item.revoked ? styles.badgePillRevoked : styles.badgePillClean
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgePillText,
                              item.revoked ? styles.badgeTextRevoked : styles.badgeTextClean
                            ]}
                          >
                            {item.revoked ? "Revoked" : "Verified Clean"}
                          </Text>
                        </View>
                      </View>

                      {!item.revoked && (
                        <View style={styles.fileActionRow}>
                          <Pressable
                            accessibilityRole="button"
                            style={styles.previewBtn}
                            disabled={busy}
                            onPress={() => void previewVerified(item.fileRef)}
                          >
                            <Text style={styles.previewBtnText}>Preview File</Text>
                          </Pressable>

                          <Pressable
                            accessibilityRole="button"
                            style={styles.revokeBtn}
                            disabled={busy || uncertain || !!revokeUncertain}
                            onPress={() =>
                              Alert.alert(
                                "Revoke Original Private File",
                                "Future authorized downloads will be blocked. Evidence history stays preserved.",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  {
                                    text: "Revoke",
                                    style: "destructive",
                                    onPress: () => void revokeMedia(item)
                                  }
                                ]
                              )
                            }
                          >
                            <Text style={styles.revokeBtnText}>Revoke</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {/* TAB 2: OFFICIAL LETTERS */}
          {activeTab === "LETTERS" && selected && canViewLetters && (
            <NativePrivateLetterPanel
              key={selected.caseRef + "-" + selected.proposalRevision}
              token={token}
              caseRef={selected.caseRef}
              sourceRevision={selected.proposalRevision}
              canIssue={canViewLetters}
              canRevoke={canRevokeLetters}
              onExpired={onExpired}
              onPreview={async (ref) => {
                await previewVerified(ref, "letter");
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    gap: 12,
    paddingBottom: 4
  },
  backButton: {
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 3,
    gap: 4
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
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
    color: "#1D4ED8",
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardSectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  pillBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  pillBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569"
  },
  dropZone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  dropZoneIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  dropZonePrimary: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center"
  },
  dropZoneSecondary: {
    fontSize: 11.5,
    color: "#64748B",
    textAlign: "center"
  },
  statusBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10
  },
  statusBoxLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155"
  },
  warningBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 12,
    gap: 8
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E"
  },
  warningDesc: {
    fontSize: 12,
    color: "#B45309"
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#1D4ED8",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryBtnText: {
    color: "#1E293B",
    fontSize: 13,
    fontWeight: "700"
  },
  btnDisabled: {
    opacity: 0.5
  },
  refreshIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F1F5F9"
  },
  refreshIconText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  emptyStateContainer: {
    paddingVertical: 20,
    alignItems: "center"
  },
  emptyStateText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  emptyNote: {
    fontSize: 13,
    color: "#94A3B8",
    paddingVertical: 8
  },
  fileCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 8
  },
  fileCardInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  fileTypeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#EEF2FF",
    borderRadius: 5
  },
  fileTypeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4338CA"
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B"
  },
  fileDateText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  badgePillClean: {
    backgroundColor: "#DCFCE7"
  },
  badgePillRevoked: {
    backgroundColor: "#FEE2E2"
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: "700"
  },
  badgeTextClean: {
    color: "#15803D"
  },
  badgeTextRevoked: {
    color: "#B91C1C"
  },
  fileActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4
  },
  previewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1"
  },
  previewBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  revokeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  revokeBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626"
  }
});
