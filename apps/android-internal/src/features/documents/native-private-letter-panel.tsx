import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as Crypto from "expo-crypto";
import { identityRequest } from "../identity-access/http-client";
import { IconFileText, IconLock, IconShieldCheck, IconClose } from "../dashboard/dashboard-icons";

type Template = {
  configured: boolean;
  version: number;
  title?: string;
  body?: string;
  status: string;
};

type Letter = {
  documentRef: string;
  state: string;
  issueRevision: number;
  templateVersion: number;
  issuedAt: string | null;
  canDownload: boolean;
  canReconcile: boolean;
};

type Props = {
  token: string;
  caseRef: string;
  sourceRevision: number;
  canIssue: boolean;
  canRevoke: boolean;
  onExpired: () => void;
  onPreview: (documentRef: string) => Promise<void>;
};

type Review = "TEMPLATE" | "ISSUE" | "REVOKE" | null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const status = (v: string) =>
  ({
    PENDING: "Request recorded, PDF not yet issued",
    VERIFYING: "Verifying original private PDF",
    ISSUED: "Private PDF issued and verified",
    UNKNOWN: "Issue uncertain; check the original request",
    FAILED: "Private PDF not issued (Local Mode)",
    REVOKED: "Revoked; private download blocked"
  }[v] ?? "Private document unverified");

async function api<T>(token: string, path: string, body?: object): Promise<T> {
  let response: Response;
  try {
    response = await identityRequest("/api/documents/letters/" + path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Object.assign(new Error("Original letter outcome unconfirmed."), { status: 503 });
  }
  if (!response.ok) {
    const message =
      response.status === 401
        ? "Sign in again to manage private letters."
        : response.status === 403
        ? "Current private letter permission is unavailable."
        : response.status === 409
        ? "Original letter or template changed. Refresh first."
        : response.status === 400
        ? "Check the current password and original revision."
        : "Original private letter outcome unconfirmed.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw Object.assign(new Error("Original letter response unconfirmed."), { status: 503 });
  }
}

export function NativePrivateLetterPanel({
  token,
  caseRef,
  sourceRevision,
  canIssue,
  canRevoke,
  onExpired,
  onPreview
}: Props) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [heading, setHeading] = useState("Protected Access Confirmation");
  const [body, setBody] = useState(
    "This official letter confirms that the specified CareGanga Foundation access change was approved and applied. Access remains subject to current policies and regulations."
  );
  const [password, setPassword] = useState("");
  const [issuePassword, setIssuePassword] = useState("");
  const [revokePassword, setRevokePassword] = useState("");
  const [revokeRef, setRevokeRef] = useState("");
  const [review, setReview] = useState<Review>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const requestVersion = useRef(0);
  const templateKey = useRef("");
  const issueKey = useRef("");

  const handleError = useCallback(
    (error: unknown) => {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        onExpired();
      }
      setMessage(
        error instanceof Error ? error.message : "Original private document could not be verified."
      );
    },
    [onExpired]
  );

  const refresh = useCallback(async () => {
    const v = ++requestVersion.current;
    setLoading(true);
    try {
      const [tpl, list] = await Promise.all([
        api<Template>(token, "template"),
        api<{ letters: Letter[]; caseNumber: string }>(token, "case/" + encodeURIComponent(caseRef))
      ]);
      if (
        !tpl ||
        !Number.isInteger(tpl.version) ||
        !Array.isArray(list.letters) ||
        list.letters.length > 20 ||
        list.letters.some(
          (x) =>
            !UUID.test(x.documentRef) ||
            typeof x.state !== "string" ||
            !Number.isInteger(x.issueRevision)
        )
      )
        throw Error("Private source unavailable.");
      if (v !== requestVersion.current) return;
      setTemplate(tpl);
      setLetters(list.letters);
      if (tpl.configured && tpl.title && tpl.body) {
        setHeading(tpl.title);
        setBody(tpl.body);
      }
    } catch (e) {
      if (v !== requestVersion.current) return;
      setTemplate(null);
      setLetters([]);
      handleError(e);
    } finally {
      if (v === requestVersion.current) setLoading(false);
    }
  }, [token, caseRef, handleError]);

  useEffect(() => {
    setTemplate(null);
    setLetters([]);
    setReview(null);
    setMessage("");
    setPassword("");
    setIssuePassword("");
    setRevokePassword("");
    setRevokeRef("");
    templateKey.current = "";
    issueKey.current = "";
    void refresh();
  }, [refresh]);

  const saveTemplate = async () => {
    if (!password.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      templateKey.current = Crypto.randomUUID();
      await api(token, "template", {
        title: heading,
        body,
        expectedVersion: template?.version ?? 0,
        currentPassword: password,
        requestKey: templateKey.current
      });
      setPassword("");
      setReview(null);
      void refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const issueLetter = async () => {
    if (!issuePassword.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      issueKey.current = Crypto.randomUUID();
      await api(token, "issue", {
        caseRef,
        sourceRevision,
        currentPassword: issuePassword,
        requestKey: issueKey.current
      });
      setIssuePassword("");
      setReview(null);
      void refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  const revokeLetter = async () => {
    if (!revokePassword.trim() || !revokeRef || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await api(token, "revoke", {
        documentRef: revokeRef,
        caseRef,
        sourceRevision,
        currentPassword: revokePassword,
        requestKey: Crypto.randomUUID()
      });
      setRevokePassword("");
      setRevokeRef("");
      setReview(null);
      void refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Alert banner */}
      {!!message && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>{message}</Text>
        </View>
      )}

      {/* Official A4 Letterhead Preview Card */}
      <View style={styles.letterheadCard}>
        {/* Letterhead Top Header */}
        <View style={styles.letterheadHeader}>
          <View style={styles.sealBadge}>
            <Text style={styles.sealBadgeText}>CGF</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.foundationName}>CAREGANGA FOUNDATION</Text>
            <Text style={styles.foundationSub}>Official Document & Legal Certificate</Text>
          </View>
          <View style={styles.watermarkTag}>
            <Text style={styles.watermarkTagText}>CONFIDENTIAL</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Letterhead Content */}
        <View style={styles.letterContent}>
          <Text style={styles.letterHeading}>{heading}</Text>
          <Text style={styles.letterBody}>{body}</Text>
        </View>

        {/* Official Signatory Box */}
        <View style={styles.signatoryRow}>
          <View>
            <Text style={styles.signLabel}>Authorized Officer</Text>
            <Text style={styles.signName}>CareGanga Foundation Command Center</Text>
          </View>
          <View style={styles.officialStampBox}>
            <IconShieldCheck size={20} color="#16A34A" />
            <Text style={styles.officialStampText}>OFFICIALLY SEALED</Text>
          </View>
        </View>

        {/* Action Button Row */}
        <View style={styles.letterActionRow}>
          <Pressable
            accessibilityRole="button"
            style={styles.outlineBtn}
            onPress={() => setReview("TEMPLATE")}
          >
            <Text style={styles.outlineBtnText}>Edit Letterhead Template</Text>
          </Pressable>

          {canIssue && (
            <Pressable
              accessibilityRole="button"
              style={styles.primaryIssueBtn}
              onPress={() => setReview("ISSUE")}
            >
              <Text style={styles.primaryIssueBtnText}>Issue Official Letter</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Issued Letters History Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardHeading}>Issued Official Letters History</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.refreshIconBtn}
            disabled={loading || busy}
            onPress={() => void refresh()}
          >
            <Text style={styles.refreshIconText}>↻ Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color="#1D4ED8" style={{ paddingVertical: 16 }} />
        ) : !letters.length ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No official letters issued for this case yet.</Text>
          </View>
        ) : (
          letters.map((l) => (
            <View key={l.documentRef} style={styles.letterItemCard}>
              <View style={styles.letterItemTop}>
                <View style={styles.pdfBadge}>
                  <Text style={styles.pdfBadgeText}>PDF</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.letterTitleText}>
                    Rev {l.issueRevision} • Template v{l.templateVersion}
                  </Text>
                  <Text style={styles.letterDateText}>
                    {l.issuedAt ? new Date(l.issuedAt).toLocaleString() : "Date recorded"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statePill,
                    l.state === "ISSUED" ? styles.statePillGreen : styles.statePillRed
                  ]}
                >
                  <Text
                    style={[
                      styles.statePillText,
                      l.state === "ISSUED" ? styles.stateTextGreen : styles.stateTextRed
                    ]}
                  >
                    {l.state}
                  </Text>
                </View>
              </View>

              <Text style={styles.statusDescription}>{status(l.state)}</Text>

              <View style={styles.letterItemActions}>
                {l.canDownload && (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.actionPreviewBtn}
                    disabled={busy}
                    onPress={() => void onPreview(l.documentRef)}
                  >
                    <Text style={styles.actionPreviewText}>Download / Preview</Text>
                  </Pressable>
                )}

                {canRevoke && l.state !== "REVOKED" && (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.actionRevokeBtn}
                    disabled={busy}
                    onPress={() => {
                      setRevokeRef(l.documentRef);
                      setReview("REVOKE");
                    }}
                  >
                    <Text style={styles.actionRevokeText}>Revoke Letter</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* MODAL 1: EDIT TEMPLATE */}
      <Modal
        visible={review === "TEMPLATE"}
        transparent
        animationType="fade"
        onRequestClose={() => setReview(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setReview(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Configure Letter Template</Text>
              <Pressable onPress={() => setReview(null)} style={styles.closeBtn}>
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Letter Title / Subject</Text>
            <TextInput
              value={heading}
              onChangeText={setHeading}
              placeholder="e.g. Access Approval Confirmation"
              style={styles.textInput}
            />

            <Text style={styles.inputLabel}>Official Letter Body</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Enter official statement..."
              multiline
              numberOfLines={4}
              style={[styles.textInput, { height: 90, textAlignVertical: "top" }]}
            />

            <Text style={styles.inputLabel}>Administrator Password Verification</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password (e.g. CareGanga@123)"
              secureTextEntry
              style={styles.textInput}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={busy}
                onPress={() => setReview(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, (!password.trim() || busy) && styles.btnDisabled]}
                disabled={!password.trim() || busy}
                onPress={() => void saveTemplate()}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Template</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 2: ISSUE LETTER */}
      <Modal
        visible={review === "ISSUE"}
        transparent
        animationType="fade"
        onRequestClose={() => setReview(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setReview(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Issue Official Letter</Text>
              <Pressable onPress={() => setReview(null)} style={styles.closeBtn}>
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              This will generate an immutable, tamper-evident official PDF on Foundation letterhead.
            </Text>

            <Text style={styles.inputLabel}>Admin Password Authorization</Text>
            <TextInput
              value={issuePassword}
              onChangeText={setIssuePassword}
              placeholder="Enter password to authorize issuance"
              secureTextEntry
              style={styles.textInput}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={busy}
                onPress={() => setReview(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, (!issuePassword.trim() || busy) && styles.btnDisabled]}
                disabled={!issuePassword.trim() || busy}
                onPress={() => void issueLetter()}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Authorize & Issue</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 3: REVOKE LETTER */}
      <Modal
        visible={review === "REVOKE"}
        transparent
        animationType="fade"
        onRequestClose={() => setReview(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setReview(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Revoke Official Letter</Text>
              <Pressable onPress={() => setReview(null)} style={styles.closeBtn}>
                <IconClose size={18} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Future downloads of this letter will be immediately blocked.
            </Text>

            <Text style={styles.inputLabel}>Admin Password Authorization</Text>
            <TextInput
              value={revokePassword}
              onChangeText={setRevokePassword}
              placeholder="Enter password to confirm revocation"
              secureTextEntry
              style={styles.textInput}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                disabled={busy}
                onPress={() => setReview(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDestructiveBtn, (!revokePassword.trim() || busy) && styles.btnDisabled]}
                disabled={!revokePassword.trim() || busy}
                onPress={() => void revokeLetter()}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalDestructiveText}>Confirm Revocation</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14
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
  letterheadCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    gap: 12
  },
  letterheadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sealBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center"
  },
  sealBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1
  },
  foundationName: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5
  },
  foundationSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  watermarkTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4
  },
  watermarkTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B"
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0"
  },
  letterContent: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#1D4ED8"
  },
  letterHeading: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0F172A"
  },
  letterBody: {
    fontSize: 12.5,
    color: "#334155",
    lineHeight: 18
  },
  signatoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6
  },
  signLabel: {
    fontSize: 10.5,
    color: "#64748B",
    fontWeight: "600"
  },
  signName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 1
  },
  officialStampBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  officialStampText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#166534"
  },
  letterActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4
  },
  outlineBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155"
  },
  primaryIssueBtn: {
    flex: 1,
    backgroundColor: "#1D4ED8",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryIssueBtnText: {
    fontSize: 13,
    fontWeight: "700",
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
  emptyState: {
    paddingVertical: 18,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8"
  },
  letterItemCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 6
  },
  letterItemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  pdfBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#FEE2E2",
    borderRadius: 4
  },
  pdfBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DC2626"
  },
  letterTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  letterDateText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  statePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  statePillGreen: {
    backgroundColor: "#DCFCE7"
  },
  statePillRed: {
    backgroundColor: "#FEE2E2"
  },
  statePillText: {
    fontSize: 10.5,
    fontWeight: "800"
  },
  stateTextGreen: {
    color: "#166534"
  },
  stateTextRed: {
    color: "#991B1B"
  },
  statusDescription: {
    fontSize: 11.5,
    color: "#64748B"
  },
  letterItemActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4
  },
  actionPreviewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 6
  },
  actionPreviewText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  actionRevokeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 6
  },
  actionRevokeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626"
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
    gap: 10,
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
    marginBottom: 4
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
    marginBottom: 6
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 2
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A"
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
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
  modalDestructiveBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#DC2626",
    borderRadius: 8,
    alignItems: "center"
  },
  modalDestructiveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  btnDisabled: {
    opacity: 0.5
  }
});
