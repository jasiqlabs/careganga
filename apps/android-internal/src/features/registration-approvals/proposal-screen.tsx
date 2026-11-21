import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  BackHandler,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import type {
  CG03CaseView,
  CG03CaseDetail,
  CG03Lookup,
  CG03Option,
  CG03ProcessView,
  CG03OwnerOutcome
} from "@careganga/api-contracts";
import { identityRequest } from "../identity-access/http-client";

// Modular Registration & Approval components
import {
  friendlyStatus,
  getStatusChipTheme,
  type HomeTab,
  type DecisionAction,
  type ApprovalFilters,
  type FeedbackModalState
} from "./registration-approvals-types";
import {
  IconRefreshCw,
  IconPlus,
  IconFileText
} from "./registration-approvals-icons";
import {
  ApprovalStatsSkeleton,
  ApprovalListSkeleton
} from "./registration-approvals-skeletons";
import { ApprovalStatsCards } from "./approval-stats-cards";
import { ApprovalSearchFilter } from "./approval-search-filter";
import { ApprovalCardItem } from "./approval-card-item";
import { ApprovalPagination } from "./approval-pagination";
import { CreateApplicationView } from "./create-application-view";
import { ApplicationDetailView } from "./application-detail-view";
import { ReviewDecisionView } from "./review-decision-view";
import { ReviewConfirmationModal } from "./review-confirmation-modal";
import { FeedbackModals } from "./feedback-modals";
import { VersionProcessView, VersionProcessForm } from "./version-process-view";
import { RegistrationBottomSheet } from "./registration-bottom-sheet";
import { SegmentedCategoryControl } from "./segmented-category-control";

export interface ProposalScreenProps {
  token: string;
  canConfigure: boolean;
  canPropose: boolean;
  canReview: boolean;
  onExit: () => void;
  onExpired: () => void;
}

type ActiveBottomSheet = "NONE" | "OVERVIEW" | "DECISION" | "PROCESS_CONFIG";

async function api<T>(
  token: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: object
): Promise<T> {
  let res: Response;
  try {
    res = await identityRequest("/api/registration-approvals/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw Error(method === "POST" ? "UNKNOWN" : "UNAVAILABLE");
  }
  if (res.status === 401) throw Error("SESSION_EXPIRED");
  if (res.status === 403) throw Error("DENIED");
  if (res.status === 409) throw Error("CONFLICT");
  if (res.status === 400) throw Error("INVALID");
  if (!res.ok) throw Error(method === "POST" ? "UNKNOWN" : "UNAVAILABLE");
  try {
    return (await res.json()) as T;
  } catch {
    throw Error(method === "POST" ? "UNKNOWN" : "UNAVAILABLE");
  }
}

export function ProposalScreen({
  token,
  canConfigure,
  canPropose,
  canReview,
  onExit,
  onExpired
}: ProposalScreenProps) {
  // Navigation & Category Tab
  const [homeTab, setHomeTab] = useState<HomeTab>("APPLICATIONS");
  const [isCreating, setIsCreating] = useState(false);

  // Single Reusable Bottom Sheet State
  const [activeSheet, setActiveSheet] = useState<ActiveBottomSheet>("NONE");

  // Core Data
  const [cases, setCases] = useState<CG03CaseView[]>([]);
  const [route, setRoute] = useState<CG03ProcessView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Search & Filtering
  const [filters, setFilters] = useState<ApprovalFilters>({
    search: "",
    status: "ALL",
    role: "ALL"
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Create Application Form State
  const [accounts, setAccounts] = useState<CG03Option[]>([]);
  const [roles, setRoles] = useState<CG03Option[]>([]);
  const [accountQuery, setAccountQuery] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [previousCaseRef, setPreviousCaseRef] = useState<string | null>(null);
  const [caseRequestKey, setCaseRequestKey] = useState("");
  const [pendingKind, setPendingKind] = useState<"CASE" | "PROCESS">("CASE");

  // Application Detail State (Shown in Bottom Sheet)
  const [detail, setDetail] = useState<CG03CaseDetail | null>(null);
  const [ownerOutcome, setOwnerOutcome] = useState<CG03OwnerOutcome | null>(null);
  const [ownerBusy, setOwnerBusy] = useState(false);

  // Review Decision State (Shown in Bottom Sheet)
  const [decisionAction, setDecisionAction] = useState<DecisionAction | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [decisionPassword, setDecisionPassword] = useState("");
  const [decisionKey, setDecisionKey] = useState("");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // Feedback Modals
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>({
    type: null,
    title: "",
    message: ""
  });

  // Process Version Form State (Shown in Bottom Sheet)
  const [firstReviewer, setFirstReviewer] = useState<"NONE" | "ACCESS_MANAGER">("NONE");
  const [currentProcessPassword, setCurrentProcessPassword] = useState("");

  // -------------------------------------------------------------
  // Data Loading
  // -------------------------------------------------------------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, proc] = await Promise.all([
        api<{ cases: CG03CaseView[] }>(token, "cases?limit=30"),
        api<CG03ProcessView>(token, "process")
      ]);
      if (!Array.isArray(list.cases) || !proc || !Number.isInteger(proc.version)) {
        throw Error("UNAVAILABLE");
      }
      setCases(list.cases);
      setRoute(proc);
    } catch (error) {
      setCases([]);
      setRoute(null);
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        onExpired();
      } else {
        setFeedbackModal({
          type: "ERROR",
          title: "Connection Error",
          message:
            error instanceof Error && error.message === "DENIED"
              ? "Current access does not permit this approval list."
              : "Could not verify Foundation applications. Refresh when connected."
        });
      }
    } finally {
      setLoading(false);
    }
  }, [token, onExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  // -------------------------------------------------------------
  // Hardware Back Handler
  // -------------------------------------------------------------
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy) return true;
      if (feedbackModal.type) {
        setFeedbackModal({ type: null, title: "", message: "" });
        return true;
      }
      if (confirmModalVisible) {
        setConfirmModalVisible(false);
        return true;
      }
      // If decision sheet is open, back goes to overview sheet
      if (activeSheet === "DECISION") {
        setActiveSheet("OVERVIEW");
        return true;
      }
      // If any bottom sheet is open, close it
      if (activeSheet !== "NONE") {
        setActiveSheet("NONE");
        return true;
      }
      // If create form is open, close it back to home
      if (isCreating) {
        setIsCreating(false);
        return true;
      }
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [busy, feedbackModal, confirmModalVisible, activeSheet, isCreating, onExit]);

  // -------------------------------------------------------------
  // Search Accounts / Roles
  // -------------------------------------------------------------
  const searchOptions = useCallback(
    async (kind: "account" | "role", text: string) => {
      if (text.length > 70) return;
      try {
        const response = await api<{ options: CG03Option[] }>(
          token,
          "options/" + kind + "?search=" + encodeURIComponent(text)
        );
        if (!Array.isArray(response.options) || response.options.length > 30) throw Error();
        if (kind === "account") setAccounts(response.options);
        else setRoles(response.options);
      } catch {
        if (kind === "account") setAccounts([]);
        else setRoles([]);
        setFeedbackModal({
          type: "ERROR",
          title: "Search Error",
          message: "Matching authorized records could not be retrieved."
        });
      }
    },
    [token]
  );

  // -------------------------------------------------------------
  // Create / Correction Flow
  // -------------------------------------------------------------
  const startCreate = (entry?: CG03CaseView) => {
    if (busy || !canPropose) return;
    setIsCreating(true);
    setSelectedAccount("");
    setSelectedRole("");
    setAccountQuery(entry?.accountName ?? "");
    setRoleQuery("");
    setRequestReason("");
    setPreviousCaseRef(entry?.caseRef ?? null);
    setCaseRequestKey(Crypto.randomUUID());
    setPendingKind("CASE");
    void searchOptions("account", "");
    void searchOptions("role", "");
  };

  const handleCreateSubmit = async () => {
    if (!selectedAccount || !selectedRole || busy) return;
    setBusy(true);
    try {
      const outcome = await api<CG03CaseView>(token, "cases", "POST", {
        targetAccountRef: selectedAccount,
        targetRoleRef: selectedRole,
        requestKey: caseRequestKey,
        ...(previousCaseRef ? { previousCaseRef: previousCaseRef } : {})
      });
      if (typeof outcome.reference !== "string") throw Error("UNKNOWN");
      setIsCreating(false);
      setCaseRequestKey("");
      setPreviousCaseRef(null);
      setFeedbackModal({
        type: "SUCCESS",
        title: "Proposal Submitted",
        message: `${outcome.reference} has been submitted for Super Admin review. No access has changed yet.`,
        caseRef: outcome.reference
      });
      await load();
    } catch (e) {
      if (e instanceof Error && e.message === "SESSION_EXPIRED") {
        onExpired();
      } else if (e instanceof Error && e.message === "UNKNOWN") {
        setFeedbackModal({
          type: "UNCERTAIN",
          title: "Submission Uncertain",
          message:
            "The submission could not be confirmed. Check the previous request status before retrying."
        });
      } else {
        setFeedbackModal({
          type: "ERROR",
          title: "Submission Failed",
          message:
            e instanceof Error && e.message === "DENIED"
              ? "Your permission was removed. This request was not confirmed."
              : e instanceof Error && e.message === "CONFLICT"
              ? "This application changed. Verify its original status before trying again."
              : "The submission could not be confirmed. Check the original request first."
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const checkPreviousRequest = async () => {
    if (busy || !caseRequestKey) return;
    setBusy(true);
    try {
      if (pendingKind === "CASE") {
        const result = await api<CG03Lookup>(token, "cases/requests/" + caseRequestKey);
        if (result.status === "CONFIRMED" && result.case) {
          setIsCreating(false);
          setCaseRequestKey("");
          setPreviousCaseRef(null);
          setFeedbackModal({
            type: "SUCCESS",
            title: "Request Confirmed",
            message: `${result.case.reference} is recorded; access was not granted.`,
            caseRef: result.case.reference
          });
          await load();
        } else {
          setFeedbackModal({
            type: "ERROR",
            title: "No Confirmed Submission",
            message: "No confirmed submission is visible. Ask Foundation support before retrying."
          });
        }
      } else {
        const saved = await api<{ status: string; version: number | null }>(
          token,
          "process/changes/" + caseRequestKey
        );
        if (saved.status === "CONFIRMED" && Number.isInteger(saved.version)) {
          const current = await api<CG03ProcessView>(token, "process");
          if (current.version < Number(saved.version)) throw Error("UNAVAILABLE");
          setRoute(current);
          setCaseRequestKey("");
          setActiveSheet("NONE");
          setFeedbackModal({
            type: "SUCCESS",
            title: "Process Updated",
            message: "Original reviewer process change confirmed."
          });
        } else {
          setFeedbackModal({
            type: "ERROR",
            title: "Process Change Unconfirmed",
            message: "No confirmed process change is visible. Ask Foundation support before retrying."
          });
        }
      }
    } catch {
      setFeedbackModal({
        type: "ERROR",
        title: "Verification Failed",
        message: "The earlier result is still unconfirmed. Contact Foundation support."
      });
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------
  // Application Overview in Bottom Sheet
  // -------------------------------------------------------------
  const handleOpenDetailInSheet = async (entry: CG03CaseView) => {
    setBusy(true);
    setDetail(null);
    setOwnerOutcome(null);
    setDecisionAction(null);
    setDecisionRemarks("");
    setDecisionPassword("");
    setActiveSheet("OVERVIEW");

    try {
      const result = await api<CG03CaseDetail>(token, "cases/" + entry.caseRef);
      if (!Array.isArray(result.history) || !Array.isArray(result.allowedDecisions)) {
        throw Error();
      }
      setDetail(result);
      if (
        ["PENDING_OWNER", "OWNER_COMPLETED", "OWNER_BLOCKED", "OWNER_FAILED_RETRYABLE"].includes(
          result.status
        )
      ) {
        try {
          const outcome = await api<CG03OwnerOutcome>(
            token,
            "cases/" + result.caseRef + "/owner-status"
          );
          if (
            ["PENDING_OWNER", "OWNER_COMPLETED", "OWNER_BLOCKED", "OWNER_FAILED_RETRYABLE"].includes(
              outcome.status
            )
          ) {
            setOwnerOutcome(outcome);
          }
        } catch {
          // Keep detail view intact
        }
      }
    } catch {
      setActiveSheet("NONE");
      setFeedbackModal({
        type: "ERROR",
        title: "Details Unavailable",
        message: "The application details could not be verified."
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRetryOwner = async () => {
    if (!detail || !canReview || !ownerOutcome?.canRetry || busy || ownerBusy) return;
    setOwnerBusy(true);
    try {
      const result = await api<{ status: string }>(
        token,
        "cases/" + detail.caseRef + "/retry-owner",
        "POST"
      );
      const currentDetail = detail;
      setFeedbackModal({
        type: "SUCCESS",
        title: "Owner Effect Rechecked",
        message:
          result.status === "OWNER_COMPLETED"
            ? "Original CG-01 role grant is confirmed. No second grant was made."
            : result.status === "OWNER_BLOCKED"
            ? "Source changed; a new proposal must be reviewed."
            : "Access remains unconfirmed. The same original source key was checked."
      });
      await load();
      await handleOpenDetailInSheet(currentDetail);
    } catch {
      setFeedbackModal({
        type: "ERROR",
        title: "Retry Verification Failed",
        message: "Owner effect could not be verified. Do not repeat the approval."
      });
    } finally {
      setOwnerBusy(false);
    }
  };

  // -------------------------------------------------------------
  // Review Decision in Bottom Sheet
  // -------------------------------------------------------------
  const handleOpenDecisionSheet = () => {
    if (!detail || !canReview || detail.allowedDecisions.length === 0) return;
    setDecisionAction(null);
    setDecisionRemarks("");
    setDecisionPassword("");
    setDecisionKey(Crypto.randomUUID());
    setActiveSheet("DECISION");
  };

  const handleProceedToConfirm = () => {
    if (!detail || !decisionAction) return;
    setConfirmModalVisible(true);
  };

  const handleCommitDecision = async () => {
    if (!detail || !decisionAction || busy) return;
    setBusy(true);
    setConfirmModalVisible(false);

    try {
      const result = await api<{ status: string; revision: number }>(
        token,
        "cases/" + detail.caseRef + "/decisions",
        "POST",
        {
          action: decisionAction,
          remarks: decisionRemarks.trim(),
          currentPassword: decisionPassword,
          expectedRevision: detail.revision,
          requestKey: decisionKey
        }
      );
      if (!Number.isInteger(result.revision)) throw Error("UNKNOWN");
      const currentDetail = detail;
      setDecisionAction(null);
      setDecisionKey("");
      setDecisionPassword("");
      setActiveSheet("NONE");

      setFeedbackModal({
        type: "SUCCESS",
        title: "Decision Submitted Successfully!",
        message: `Application ${currentDetail.reference} decision (${decisionAction}) has been recorded. Account access is confirmed separately.`,
        caseRef: currentDetail.reference
      });
      await load();
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        onExpired();
      } else if (error instanceof Error && error.message === "UNKNOWN") {
        setFeedbackModal({
          type: "UNCERTAIN",
          title: "Decision Status Uncertain",
          message:
            "A previous decision may have been saved. Do not repeat it until verified."
        });
      } else {
        setFeedbackModal({
          type: "ERROR",
          title: "Unable to Submit Decision",
          message:
            error instanceof Error && error.message === "CONFLICT"
              ? "This case changed. Refresh before recording a decision."
              : error instanceof Error && error.message === "DENIED"
              ? "You are not authorized to take this action. Please contact the Foundation Super Admin."
              : "Decision result could not be verified. Check its original request."
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLookupDecision = async () => {
    if (!detail || !decisionKey || busy) return;
    setBusy(true);
    try {
      const result = await api<{ status: string; revision: number | null }>(
        token,
        "cases/" + detail.caseRef + "/decisions/requests/" + decisionKey
      );
      if (result.status === "CONFIRMED" && Number.isInteger(result.revision)) {
        const item = detail;
        setDecisionKey("");
        setDecisionAction(null);
        setActiveSheet("NONE");
        setFeedbackModal({
          type: "SUCCESS",
          title: "Decision Confirmed",
          message: "Original review decision confirmed. No duplicate action was sent."
        });
        await load();
        await handleOpenDetailInSheet(item);
      } else {
        setFeedbackModal({
          type: "ERROR",
          title: "Unconfirmed Decision",
          message: "No confirmed decision is visible. Ask Foundation support before retrying."
        });
      }
    } catch {
      setFeedbackModal({
        type: "ERROR",
        title: "Lookup Failed",
        message: "Previous decision status could not be verified."
      });
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------
  // Version Process Configuration in Bottom Sheet
  // -------------------------------------------------------------
  const handleOpenProcessConfigSheet = () => {
    if (!canConfigure || busy) return;
    setCaseRequestKey(Crypto.randomUUID());
    setFirstReviewer(route?.firstReviewer ? "ACCESS_MANAGER" : "NONE");
    setCurrentProcessPassword("");
    setPendingKind("PROCESS");
    setActiveSheet("PROCESS_CONFIG");
  };

  const handleSaveProcessVersion = async () => {
    if (!canConfigure || busy) return;
    if (currentProcessPassword.length < 8) {
      setFeedbackModal({
        type: "ERROR",
        title: "Invalid Password",
        message: "Please enter your current account password (at least 8 characters)."
      });
      return;
    }
    setBusy(true);
    setPendingKind("PROCESS");
    try {
      const result = await api<{ version: number }>(token, "process/versions", "POST", {
        firstReviewerCapability: firstReviewer === "NONE" ? null : "roles.assign",
        requestKey: caseRequestKey,
        currentPassword: currentProcessPassword
      });
      if (!Number.isInteger(result.version)) throw Error("UNKNOWN");
      setCaseRequestKey("");
      setCurrentProcessPassword("");
      setActiveSheet("NONE");
      setFeedbackModal({
        type: "SUCCESS",
        title: "Process Version Saved",
        message: `New review process version ${result.version} saved. Older applications keep their process.`
      });
      await load();
    } catch (error) {
      if (error instanceof Error && error.message === "SESSION_EXPIRED") {
        onExpired();
      } else if (error instanceof Error && error.message === "UNKNOWN") {
        setFeedbackModal({
          type: "UNCERTAIN",
          title: "Process Result Uncertain",
          message: "The reviewer-process result is uncertain. Check the previous version."
        });
      } else {
        setFeedbackModal({
          type: "ERROR",
          title: "Failed to Update Process",
          message: "Could not save the new process version. Check your password and try again."
        });
      }
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------
  // Filtered & Paginated Applications List
  // -------------------------------------------------------------
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    cases.forEach(c => {
      if (c.roleName) set.add(c.roleName);
    });
    return Array.from(set);
  }, [cases]);

  const filteredCases = useMemo(() => {
    return cases.filter(item => {
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const refMatch = item.reference.toLowerCase().includes(q);
        const nameMatch = item.accountName.toLowerCase().includes(q);
        const roleMatch = item.roleName.toLowerCase().includes(q);
        if (!refMatch && !nameMatch && !roleMatch) return false;
      }
      if (filters.status !== "ALL") {
        if (filters.status === "SUBMITTED" && item.status !== "SUBMITTED") return false;
        if (filters.status === "IN_REVIEW" && item.status !== "IN_REVIEW") return false;
        if (filters.status === "RETURNED" && item.status !== "RETURNED") return false;
        if (
          filters.status === "FINAL_APPROVED" &&
          item.status !== "FINAL_APPROVED" &&
          item.status !== "OWNER_COMPLETED" &&
          item.status !== "PENDING_OWNER"
        )
          return false;
        if (
          filters.status === "REJECTED" &&
          item.status !== "REJECTED" &&
          item.status !== "OWNER_BLOCKED"
        )
          return false;
      }
      if (filters.role !== "ALL" && item.roleName !== filters.role) {
        return false;
      }
      return true;
    });
  }, [cases, filters]);

  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  const handleFiltersChange = (newFilters: ApprovalFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // Status chip for overview bottom sheet header
  const detailChipTheme = detail ? getStatusChipTheme(detail.status) : null;

  return (
    <SafeAreaView style={styles.pageRoot} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={styles.pageRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* CREATE PROPOSAL VIEW */}
        {isCreating ? (
          <CreateApplicationView
            isCorrection={Boolean(previousCaseRef)}
            accounts={accounts}
            roles={roles}
            accountQuery={accountQuery}
            roleQuery={roleQuery}
            selectedAccount={selectedAccount}
            selectedRole={selectedRole}
            requestReason={requestReason}
            busy={busy}
            onSearchAccount={text => {
              setAccountQuery(text);
              void searchOptions("account", text);
            }}
            onSearchRole={text => {
              setRoleQuery(text);
              void searchOptions("role", text);
            }}
            onSelectAccount={val => setSelectedAccount(val)}
            onSelectRole={val => setSelectedRole(val)}
            onChangeReason={text => setRequestReason(text)}
            onSubmit={() => void handleCreateSubmit()}
            onCancel={() => setIsCreating(false)}
          />
        ) : (
          /* MAIN HOME VIEW */
          <ScrollView
            contentContainerStyle={styles.homeContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Top Header Section */}
            <View style={styles.topSection}>
              <View style={styles.titleRow}>
                <View style={styles.titleTextGroup}>
                  <Text accessibilityRole="header" style={styles.pageTitle}>
                    Registration & Approval
                  </Text>
                  <Text style={styles.pageSubtitle}>
                    Protected Foundation access
                  </Text>
                </View>

                {/* Refresh Action Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh applications"
                  disabled={loading || busy}
                  onPress={() => void load()}
                  style={({ pressed }) => [
                    styles.iconActionBtn,
                    pressed && styles.btnPressed
                  ]}
                >
                  <IconRefreshCw size={18} color="#1E53DC" />
                </Pressable>
              </View>

              {/* Segmented Category Pill Control (Applications vs Version Process) */}
              <SegmentedCategoryControl
                activeTab={homeTab}
                applicationsCount={cases.length}
                processVersion={route?.version}
                onTabChange={tab => setHomeTab(tab)}
              />
            </View>

            {/* TAB 1: APPLICATIONS */}
            {homeTab === "APPLICATIONS" && (
              <>
                {/* 5 Summary Cards */}
                {loading ? (
                  <ApprovalStatsSkeleton />
                ) : (
                  <ApprovalStatsCards
                    cases={cases}
                    activeFilter={filters.status}
                    onSelectFilter={statusKey => {
                      setFilters(prev => ({ ...prev, status: statusKey }));
                      setCurrentPage(1);
                    }}
                  />
                )}

                {/* Search & Filters */}
                <ApprovalSearchFilter
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  availableRoles={availableRoles}
                />

                {/* Applications List */}
                {loading ? (
                  <ApprovalListSkeleton />
                ) : filteredCases.length === 0 ? (
                  <View style={styles.emptyListCard}>
                    <IconFileText size={32} color="#94A3B8" />
                    <Text style={styles.emptyListTitle}>No Applications Found</Text>
                    <Text style={styles.emptyListSubtitle}>
                      {filters.search || filters.status !== "ALL" || filters.role !== "ALL"
                        ? "Try clearing filters to see all protected applications."
                        : "No protected Foundation role requests have been created yet."}
                    </Text>
                    {canPropose && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => startCreate()}
                        style={styles.emptyActionBtn}
                      >
                        <IconPlus size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>
                          Request Protected Role Access
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View style={styles.listWrap}>
                    {paginatedCases.map(item => (
                      <ApprovalCardItem
                        key={item.caseRef}
                        item={item}
                        canPropose={canPropose}
                        onPress={entry => void handleOpenDetailInSheet(entry)}
                        onCorrection={entry => startCreate(entry)}
                      />
                    ))}

                    {/* Pagination */}
                    <ApprovalPagination
                      currentPage={currentPage}
                      totalRecords={filteredCases.length}
                      pageSize={pageSize}
                      onPageChange={page => setCurrentPage(page)}
                    />
                  </View>
                )}
              </>
            )}

            {/* TAB 2: VERSION PROCESS */}
            {homeTab === "PROCESS" && (
              <VersionProcessView
                route={route}
                cases={cases}
                loading={loading}
                canConfigure={canConfigure}
                busy={busy}
                onOpenRouteForm={handleOpenProcessConfigSheet}
                onRefresh={() => void load()}
              />
            )}
          </ScrollView>
        )}

        {/* Floating Action Button (FAB) for Create Application */}
        {!isCreating && homeTab === "APPLICATIONS" && canPropose && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Request protected role access"
            onPress={() => startCreate()}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <IconPlus size={24} color="#FFFFFF" />
          </Pressable>
        )}

        {/* -------------------------------------------------------------
            SINGLE REUSABLE ANIMATED BOTTOM SHEET SYSTEM
            ------------------------------------------------------------- */}

        {/* 1. APPLICATION OVERVIEW BOTTOM SHEET */}
        <RegistrationBottomSheet
          visible={activeSheet === "OVERVIEW"}
          onClose={() => setActiveSheet("NONE")}
          title={detail?.reference ?? "Application Overview"}
          subtitle="Protected role request details"
          headerRight={
            detail && detailChipTheme ? (
              <View
                style={[
                  styles.sheetHeaderChip,
                  {
                    backgroundColor: detailChipTheme.bg,
                    borderColor: detailChipTheme.border
                  }
                ]}
              >
                <View
                  style={[
                    styles.sheetHeaderDot,
                    { backgroundColor: detailChipTheme.dot }
                  ]}
                />
                <Text
                  style={[
                    styles.sheetHeaderChipText,
                    { color: detailChipTheme.text }
                  ]}
                >
                  {friendlyStatus(detail.status)}
                </Text>
              </View>
            ) : null
          }
        >
          {detail ? (
            <ApplicationDetailView
              detail={detail}
              ownerOutcome={ownerOutcome}
              ownerBusy={ownerBusy}
              canReview={canReview}
              onBack={() => setActiveSheet("NONE")}
              onOpenDecision={handleOpenDecisionSheet}
              onRetryOwner={() => void handleRetryOwner()}
            />
          ) : null}
        </RegistrationBottomSheet>

        {/* 2. REVIEW DECISION BOTTOM SHEET */}
        <RegistrationBottomSheet
          visible={activeSheet === "DECISION"}
          onClose={() => setActiveSheet("OVERVIEW")}
          title="Review Decision"
          subtitle={detail?.reference}
        >
          {detail ? (
            <ReviewDecisionView
              detail={detail}
              decisionAction={decisionAction}
              decisionRemarks={decisionRemarks}
              decisionPassword={decisionPassword}
              busy={busy}
              onSelectAction={action => setDecisionAction(action)}
              onChangeRemarks={text => setDecisionRemarks(text)}
              onChangePassword={text => setDecisionPassword(text)}
              onProceedToConfirm={handleProceedToConfirm}
              onBack={() => setActiveSheet("OVERVIEW")}
            />
          ) : null}
        </RegistrationBottomSheet>

        {/* 3. VERSION PROCESS CONFIGURATION BOTTOM SHEET */}
        <RegistrationBottomSheet
          visible={activeSheet === "PROCESS_CONFIG"}
          onClose={() => setActiveSheet("NONE")}
          title="New Process Version"
          subtitle="Update reviewer workflow chain"
        >
          <VersionProcessForm
            firstReviewer={firstReviewer}
            currentPassword={currentProcessPassword}
            busy={busy}
            onSelectFirstReviewer={val => setFirstReviewer(val)}
            onChangePassword={pw => setCurrentProcessPassword(pw)}
            onSubmitVersion={() => void handleSaveProcessVersion()}
            onCancel={() => setActiveSheet("NONE")}
          />
        </RegistrationBottomSheet>

        {/* REVIEW CONFIRMATION MODAL POPUP */}
        <ReviewConfirmationModal
          visible={confirmModalVisible}
          detail={detail}
          action={decisionAction}
          remarks={decisionRemarks}
          busy={busy}
          onConfirm={() => void handleCommitDecision()}
          onCancel={() => setConfirmModalVisible(false)}
        />

        {/* REUSABLE FEEDBACK MODALS (SUCCESS, ERROR, UNCERTAIN) */}
        <FeedbackModals
          modalState={feedbackModal}
          busy={busy}
          onDismiss={() =>
            setFeedbackModal({ type: null, title: "", message: "" })
          }
          onRetry={() => {
            setFeedbackModal({ type: null, title: "", message: "" });
            void load();
          }}
          onCheckPrevious={() => void checkPreviousRequest()}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  homeContent: {
    padding: 16,
    gap: 14,
    maxWidth: 750,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 96
  },
  topSection: {
    gap: 12
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  titleTextGroup: {
    flex: 1
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  pageSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center"
  },
  listWrap: {
    gap: 10
  },
  emptyListCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 32,
    alignItems: "center",
    gap: 10,
    marginTop: 8
  },
  emptyListTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A"
  },
  emptyListSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280
  },
  emptyActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16A34A",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 6
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9
  },
  sheetHeaderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1
  },
  sheetHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  sheetHeaderChipText: {
    fontSize: 11,
    fontWeight: "600"
  },
  btnPressed: {
    opacity: 0.75
  }
});
