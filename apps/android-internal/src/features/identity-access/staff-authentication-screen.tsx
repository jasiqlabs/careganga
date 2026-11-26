import React, { Component, Suspense, lazy, useCallback, useEffect, useState, useRef, useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import { identityRequest } from "./http-client";
import { ActivityIndicator, AppState, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Animated, BackHandler } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CG01SessionCreated, CG01SessionView, CG01SignInRequest } from "@careganga/api-contracts";
import { AuthAmbientBackground } from "./auth-ambient-background";
import { LoginBranding } from "./login-branding";
import { LoginHeroSection } from "./login-hero-section";
import { LoginInput } from "./login-input";
import { LoginSubmitButton } from "./login-submit-button";
import { SecureAccessFooter } from "./secure-access-footer";
import { IconPadlockShieldLarge, IconAlertCircle } from "./auth-icons";
import { InternalDashboardScreen } from "../dashboard/internal-dashboard-screen";
import type { ModuleActionHandlers } from "../dashboard/dashboard-modules";
import { AuthenticatedAppShell } from "../dashboard/authenticated-app-shell";

import { RecoveryScreen } from "./recovery-screen";
import { AuthToast, useAuthToast } from "./auth-toast";
import { AccessDeniedScreen } from "./access-denied-screen";

const RolesScreen = lazy(() => import("./roles-screen").then(m => ({ default: m.RolesScreen })));
const SecurityPolicyScreen = lazy(() => import("./security-policy-screen").then(m => ({ default: m.SecurityPolicyScreen })));
const AccountsScreen = lazy(() => import("./accounts-screen").then(m => ({ default: m.AccountsScreen })));
const ChangePasswordScreen = lazy(() => import("./change-password-screen").then(m => ({ default: m.ChangePasswordScreen })));
const MyAccountScreen = lazy(() => import("./my-account-screen").then(m => ({ default: m.MyAccountScreen })));
const ProposalScreen = lazy(() => import("../registration-approvals/proposal-screen").then(m => ({ default: m.ProposalScreen })));
const NativeOwnCenterPortal = lazy(() => import("../health-network/native-own-center-portal").then(m => ({ default: m.NativeOwnCenterPortal })));
const NativePlatformConfiguration = lazy(() => import("../platform-configuration/native-platform-configuration").then(m => ({ default: m.NativePlatformConfiguration })));
const NativeCmsEditorial = lazy(() => import("../cms/native-cms-editorial").then(m => ({ default: m.NativeCmsEditorial })));
const NativeDoctorManagement = lazy(() => import("../health-network/native-doctor-management").then(m => ({ default: m.NativeDoctorManagement })));
const NativeCenterContentPublisher = lazy(() => import("../health-network/native-center-content-publisher").then(m => ({ default: m.NativeCenterContentPublisher })));
const NativeProviderManagement = lazy(() => import("../health-network/native-provider-management").then(m => ({ default: m.NativeProviderManagement })));
const HealthcareNativeReview = lazy(() => import("../registration-approvals/healthcare-native-review").then(m => ({ default: m.HealthcareNativeReview })));
const DoctorLeaveNativeReview = lazy(() => import("../registration-approvals/doctor-leave-native-review").then(m => ({ default: m.DoctorLeaveNativeReview })));
const NativeFoundationPatientAdmin = lazy(() => import("../appointments/native-foundation-patient-admin").then(m => ({ default: m.NativeFoundationPatientAdmin })));
const NativeCenterVisitQueue = lazy(() => import("../appointments/native-center-visit-queue").then(m => ({ default: m.NativeCenterVisitQueue })));
const NativeMyClinicianActivity = lazy(() => import("../appointments/native-my-clinician-activity").then(m => ({ default: m.NativeMyClinicianActivity })));
const NativeCenterAssistedBooking = lazy(() => import("../appointments/native-center-assisted-booking").then(m => ({ default: m.NativeCenterAssistedBooking })));
const NativeClinicalLabScreen = lazy(() => import("../diagnostics/native-clinical-lab-screen").then(m => ({ default: m.NativeClinicalLabScreen })));
const NativeLabEquipmentScreen = lazy(() => import("../diagnostics/native-lab-equipment-screen").then(m => ({ default: m.NativeLabEquipmentScreen })));
const NativeHealthcarePolicyScreen = lazy(() => import("../healthcare-assistance/native-healthcare-policy-screen").then(m => ({ default: m.NativeHealthcarePolicyScreen })));
const NativeCenterMerchantScreen = lazy(() => import("../healthcare-assistance/native-center-merchant-screen").then(m => ({ default: m.NativeCenterMerchantScreen })));
const NativeCompletedConsultationLiabilities = lazy(() => import("../healthcare-assistance/native-completed-consultation-liabilities").then(m => ({ default: m.NativeCompletedConsultationLiabilities })));
const NativeMonthlyProviderSettlement = lazy(() => import("../healthcare-assistance/native-monthly-provider-settlement").then(m => ({ default: m.NativeMonthlyProviderSettlement })));
const NativePartnerSettlementSummary = lazy(() => import("../healthcare-assistance/native-partner-settlement-summary").then(m => ({ default: m.NativePartnerSettlementSummary })));
const NativeLabTestMasterScreen = lazy(() => import("../diagnostics/native-lab-test-master-screen").then(m => ({ default: m.NativeLabTestMasterScreen })));
const NativeMyLabPricingScreen = lazy(() => import("../diagnostics/native-my-lab-pricing-screen").then(m => ({ default: m.NativeMyLabPricingScreen })));
import { PrivateCaseEvidenceScreen } from "../documents/private-case-evidence-screen";
import { NotificationsScreen } from "../communications/notifications-screen";
import { FoundationNoticeAdminScreen } from "../communications/foundation-notice-admin-screen";
import { FoundationSupportScreen } from "../support/foundation-support-screen";
const BranchRegistrationScreen = lazy(() => import("../foundation-structure/branch-registration-screen").then(m => ({ default: m.BranchRegistrationScreen })));
const FoundationStructureScreen = lazy(() => import("../foundation-structure/foundation-structure-screen").then(m => ({ default: m.FoundationStructureScreen })));
const RecipientNotifications = lazy(() => import("../../../../../packages/native-communications/src/recipient-notifications").then(m => ({ default: m.RecipientNotifications })));

const FinanceAccountsScreen = lazy(() => import("../finance-accounting/finance-accounts-screen").then(m => ({ default: m.FinanceAccountsScreen })));
const FinanceVoucherOnlyScreen = lazy(() => import("../finance-accounting/finance-voucher-only-screen").then(m => ({ default: m.FinanceVoucherOnlyScreen })));
const FinanceVoucherNativeReviewer = lazy(() => import("../finance-accounting/finance-voucher-native-reviewer").then(m => ({ default: m.FinanceVoucherNativeReviewer })));
const FinanceExpenseClaimsScreen = lazy(() => import("../finance-accounting/finance-expense-claims-screen").then(m => ({ default: m.FinanceExpenseClaimsScreen })));
const FinanceClaimNativeReviewer = lazy(() => import("../finance-accounting/finance-claim-native-reviewer").then(m => ({ default: m.FinanceClaimNativeReviewer })));
const FinanceNativeInvoices = lazy(() => import("../finance-accounting/finance-native-invoices").then(m => ({ default: m.FinanceNativeInvoices })));
const FinanceNativeBudgets = lazy(() => import("../finance-accounting/finance-native-budgets").then(m => ({ default: m.FinanceNativeBudgets })));
const FinanceNativeReports = lazy(() => import("../finance-accounting/finance-native-reports").then(m => ({ default: m.FinanceNativeReports })));
const NativeMisWorkspaceScreen = lazy(() => import("../mis-reporting/native-mis-workspace-screen").then(m => ({default:m.NativeMisWorkspaceScreen})));
const NativeOperationsSummary = lazy(() => import("../projects/native-operations-summary").then(m=>({default:m.NativeOperationsSummary})));
const NativeFieldVisitsWorkspace = lazy(() => import("../projects/native-field-visits-workspace").then(m=>({default:m.NativeFieldVisitsWorkspace})));
const NativeActivitiesWorkspace = lazy(() => import("../projects/native-activities-workspace").then(m=>({default:m.NativeActivitiesWorkspace})));
const NativeTasksWorkspace = lazy(() => import("../projects/native-tasks-workspace").then(m=>({default:m.NativeTasksWorkspace})));
const NativeCsrPartners = lazy(() => import("../csr/native-csr-partners").then(m=>({default:m.NativeCsrPartners})));
const NativeCsrFunding = lazy(() => import("../csr/native-csr-funding").then(m=>({default:m.NativeCsrFunding})));
const NativeCsrReviews = lazy(() => import("../csr/native-csr-review-panel").then(m=>({default:m.NativeCsrReviews})));
const NativeCsrFundingReviews = lazy(() => import("../csr/native-csr-funding-review-panel").then(m=>({default:m.NativeCsrFundingReviews})));
const NativeCsrFundingReports = lazy(() => import("../csr/native-csr-funding-reports-panel").then(m=>({default:m.NativeCsrFundingReportsPanel})));
const NativeProjectsWorkspace = lazy(() => import("../projects/native-projects-workspace").then(m=>({default:m.NativeProjectsWorkspace})));
const NativeBeneficiariesWorkspace = lazy(() => import("../beneficiaries/native-beneficiaries-workspace").then(m=>({default:m.NativeBeneficiariesWorkspace})));
const NativeCampaignDrafts = lazy(() => import("../campaigns/native-campaign-drafts").then(m=>({default:m.NativeCampaignDrafts})));
const NativeCampaignReviews = lazy(() => import("../campaigns/native-campaign-reviews").then(m=>({default:m.NativeCampaignReviews})));
const NativeInventoryCatalog = lazy(() => import("../inventory/native-inventory-catalog").then(m=>({default:m.NativeInventoryCatalog})));
const NativeRewardCatalogue = lazy(() => import("../referrals/native-reward-catalogue").then(m=>({default:m.NativeRewardCatalogue})));
const NativeMembershipDesk = lazy(() => import("../membership/native-membership-desk").then(m=>({default:m.NativeMembershipDesk})));
const NativeVolunteerStaff = lazy(() => import("../volunteers/native-volunteer-staff").then(m=>({default:m.NativeVolunteerStaff})));
const NativePayroll = lazy(() => import("../payroll/native-payroll").then(m=>({default:m.NativePayroll})));
const NativeHrEnrollment = lazy(() => import("../human-resources/native-hr-enrollment").then(m => ({default:m.NativeHrEnrollment})));
const FinanceNativeProtectedReview = lazy(() => import("../finance-accounting/finance-native-protected-review").then(m => ({ default: m.FinanceNativeProtectedReview })));

class ScreenErrorBoundary extends Component<
  { onExit: () => void; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cannot find native module") || msg.includes("ExpoCrypto")) {
      return { error: "This app needs an update to complete startup. Please contact support." };
    }
    return { error: "Something went wrong. Please try again." };
  }
  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.dashboardPage}>
          <View style={styles.dashboardContent}>
            <Text accessibilityRole="alert" style={styles.message}>{this.state.error}</Text>
            <Pressable accessibilityRole="button" style={[styles.button, styles.primaryButton]} onPress={() => {
              this.setState({ error: null });
              this.props.onExit();
            }}>
              <Text style={styles.primaryButtonText}>Back to staff access</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const STORE_KEY = "cg_internal_root_session";
const communicationRequest = (token: string, path: string, opts: RequestInit = {}) =>
  identityRequest(path, {
    ...opts, headers: {
      Authorization: "Bearer " + token, ...(opts.headers as Record<string, string> | undefined)
    }
  });
async function sessionView(token: string): Promise<CG01SessionView | null> {
  const response = await identityRequest("/api/identity/me", { headers: { Authorization: "Bearer " + token } });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("The session cannot be verified right now.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("displayName" in data)
    || !("roleName" in data) || !("scope" in data)
    || typeof data.displayName !== "string" || typeof data.roleName !== "string" || data.scope !== "Foundation")
    throw new Error("Session details could not be verified.");
  return data as CG01SessionView;
}
async function currentRoleActions(token: string): Promise<string[]> {
  const response = await identityRequest("/api/access/effective", {
    headers: { Authorization: "Bearer " + token }
  });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error("Permissions cannot be verified right now.");
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("actions" in data) ||
    !Array.isArray(data.actions) ||
    !data.actions.every((a: unknown) => a !== null && typeof a === "object" &&
      "key" in a && typeof (a as { key: unknown }).key === "string"))
    throw new Error("Permissions cannot be verified right now.");
  return (data.actions as { key: string }[]).map(a => a.key);
}
export function StaffAuthenticationScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [actor, setActor] = useState<CG01SessionView | null>(null);
  const [state, setState] = useState<"checking" | "idle" | "busy">("checking");
  const [message, setMessage] = useState("");
  const [loginFieldError, setLoginFieldError] = useState<"identifier" | "password" | "all" | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [recover, setRecover] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [ownCenterOpen, setOwnCenterOpen] = useState(false);
  const [websiteCmsOpen, setWebsiteCmsOpen] = useState(false);
  const [platformConfigOpen,setPlatformConfigOpen] = useState(false);
  const [healthDoctorOpen, setHealthDoctorOpen] = useState(false);
  const [centerPublisherOpen, setCenterPublisherOpen] = useState(false);
  const [healthProviderOpen, setHealthProviderOpen] = useState(false);
  const [healthReviewsOpen, setHealthReviewsOpen] = useState(false);
  const [doctorLeaveReviewsOpen, setDoctorLeaveReviewsOpen] = useState(false);
  const [patientAdminOpen, setPatientAdminOpen] = useState(false);
  const [patientQueueOpen, setPatientQueueOpen] = useState(false);
  const [clinicianActivityOpen, setClinicianActivityOpen] = useState(false);
  const [labOrdersOpen, setLabOrdersOpen] = useState(false);
  const [labEquipmentOpen, setLabEquipmentOpen] = useState(false);
  const [healthcarePoliciesOpen, setHealthcarePoliciesOpen] = useState(false);
  const [centerMerchantOpen, setCenterMerchantOpen] = useState(false);
  const [foundationLiabilitiesOpen, setFoundationLiabilitiesOpen] = useState(false);
  const [monthlyProviderSettlementsOpen, setMonthlyProviderSettlementsOpen] = useState(false);
  const [partnerSettlementsOpen, setPartnerSettlementsOpen] = useState(false);
  const [labTestMasterOpen, setLabTestMasterOpen] = useState(false);
  const [myLabPricingOpen, setMyLabPricingOpen] = useState(false);
  const [patientBookingOpen, setPatientBookingOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [foundationOpen, setFoundationOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [voucherOnlyOpen, setVoucherOnlyOpen] = useState(false);
  const [financeReviewOpen, setFinanceReviewOpen] = useState(false);
  const [financeClaimsOpen, setFinanceClaimsOpen] = useState(false);
  const [financeClaimReviewsOpen, setFinanceClaimReviewsOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceReviewOpen, setInvoiceReviewOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetReviewOpen, setBudgetReviewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [misOpen, setMisOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const [payrollOpen,setPayrollOpen]=useState(false);
  const [fieldVisitsOpen,setFieldVisitsOpen]=useState(false);
  const [operationsSummaryOpen,setOperationsSummaryOpen]=useState(false);
  const [activitiesOpen,setActivitiesOpen]=useState(false);
  const [tasksOpen,setTasksOpen]=useState(false);
  const [projectsOpen,setProjectsOpen]=useState(false);
  const [beneficiariesOpen,setBeneficiariesOpen]=useState(false);
  const [campaignsOpen,setCampaignsOpen]=useState(false);
  const [csrOpen,setCsrOpen]=useState(false);
  const [csrTab,setCsrTab]=useState<"DRAFTS"|"REVIEWS"|"FUNDING"|"FUNDING_REVIEWS"|"REPORTS">("DRAFTS");
  const [campaignsTab,setCampaignsTab]=useState<"DRAFTS"|"REVIEWS">("DRAFTS");
  const [inventoryOpen,setInventoryOpen]=useState(false);
  const [rewardsOpen,setRewardsOpen]=useState(false);
  const [membershipOpen,setMembershipOpen]=useState(false);
  const [volunteersOpen,setVolunteersOpen]=useState(false);
  const [communicationsOpen, setCommunicationsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [noticeAdminOpen, setNoticeAdminOpen] = useState(false);
  const [roleActions, setRoleActions] = useState<string[]>([]);
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const closeRoles = useCallback(() => setRolesOpen(false), []);
  const closeOwnCenter = useCallback(() => setOwnCenterOpen(false), []);
  const closeWebsiteCms = useCallback(() => setWebsiteCmsOpen(false), []);
  const closePlatformConfig = useCallback(() => setPlatformConfigOpen(false), []);
  const closeHealthDoctor = useCallback(() => setHealthDoctorOpen(false), []);
  const closeCenterPublisher = useCallback(() => setCenterPublisherOpen(false), []);
  const closeHealthProvider = useCallback(() => setHealthProviderOpen(false), []);
  const closeHealthReviews = useCallback(() => setHealthReviewsOpen(false), []);
  const closeDoctorLeaveReviews = useCallback(() => setDoctorLeaveReviewsOpen(false), []);
  const closePatientAdmin = useCallback(() => setPatientAdminOpen(false), []);
  const closePatientQueue = useCallback(() => setPatientQueueOpen(false), []);
  const closeClinicianActivity = useCallback(() => setClinicianActivityOpen(false), []);
  const closeLabOrders = useCallback(() => setLabOrdersOpen(false), []);
  const closeLabEquipment = useCallback(() => setLabEquipmentOpen(false), []);
  const closeHealthcarePolicies = useCallback(() => setHealthcarePoliciesOpen(false), []);
  const closeCenterMerchant = useCallback(() => setCenterMerchantOpen(false), []);
  const closeFoundationLiabilities = useCallback(() => setFoundationLiabilitiesOpen(false), []);
  const closeMonthlyProviderSettlements = useCallback(() => setMonthlyProviderSettlementsOpen(false), []);
  const closePartnerSettlements = useCallback(() => setPartnerSettlementsOpen(false), []);
  const closeLabTestMaster = useCallback(() => setLabTestMasterOpen(false), []);
  const closeMyLabPricing = useCallback(() => setMyLabPricingOpen(false), []);
  const closePatientBooking = useCallback(() => setPatientBookingOpen(false), []);
  const closePolicy = useCallback(() => setPolicyOpen(false), []);
  const closeAccounts = useCallback(() => setAccountsOpen(false), []);
  const closeFinance = useCallback(() => setFinanceOpen(false), []);
  const closeVouchers = useCallback(() => setVoucherOnlyOpen(false), []);
  const closeFinanceReview = useCallback(() => setFinanceReviewOpen(false), []);
  const closeFinanceClaims = useCallback(() => setFinanceClaimsOpen(false), []);
  const closeFinanceClaimReviews = useCallback(() => setFinanceClaimReviewsOpen(false), []);
  const closeInvoices = useCallback(() => setInvoiceOpen(false), []);
  const closeInvoiceReviews = useCallback(() => setInvoiceReviewOpen(false), []);
  const closeBudgets = useCallback(() => setBudgetOpen(false), []);
  const closeBudgetReviews = useCallback(() => setBudgetReviewOpen(false), []);
  const closeReports = useCallback(() => setReportsOpen(false), []);
  const closeMis = useCallback(() => setMisOpen(false), []);
  const { toast, showToast, hideToast } = useAuthToast();
  const expireSession = useCallback(() => {
    hideToast();
    setMessage("");
    setActor(null); setToken(null); setRoleActions([]); setAccountOpen(false); setRolesOpen(false); setAccountsOpen(false); setPolicyOpen(false); setApprovalsOpen(false); setOwnCenterOpen(false); setWebsiteCmsOpen(false); setPlatformConfigOpen(false); setHealthDoctorOpen(false); setCenterPublisherOpen(false); setHealthProviderOpen(false); setHealthReviewsOpen(false); setDoctorLeaveReviewsOpen(false); setPatientAdminOpen(false); setPatientQueueOpen(false); setLabOrdersOpen(false); setLabEquipmentOpen(false); setHealthcarePoliciesOpen(false); setCenterMerchantOpen(false); setFoundationLiabilitiesOpen(false); setMonthlyProviderSettlementsOpen(false); setPartnerSettlementsOpen(false); setLabTestMasterOpen(false); setMyLabPricingOpen(false); setPatientBookingOpen(false); setDocumentsOpen(false); setCommunicationsOpen(false); setNotificationsOpen(false); setSupportOpen(false); setNoticeAdminOpen(false); setBranchesOpen(false); setFinanceOpen(false); setVoucherOnlyOpen(false); setFinanceReviewOpen(false); setFinanceClaimsOpen(false); setFinanceClaimReviewsOpen(false); setInvoiceOpen(false); setInvoiceReviewOpen(false);
    setBudgetOpen(false); setBudgetReviewOpen(false); setReportsOpen(false); setMisOpen(false); setHrOpen(false); setPayrollOpen(false); setInventoryOpen(false); setRewardsOpen(false); setMembershipOpen(false); setVolunteersOpen(false); setProjectsOpen(false); setBeneficiariesOpen(false); setCampaignsOpen(false); setCsrOpen(false); setTasksOpen(false); setActivitiesOpen(false); setFieldVisitsOpen(false); setOperationsSummaryOpen(false);
    void SecureStore.deleteItemAsync(STORE_KEY).catch(() => undefined);
  }, [hideToast]);

  // Hardware Back button closes open sub-screens and returns to dashboard
  useEffect(() => {
    const isAnySubScreenOpen =
      accountOpen ||
      accountsOpen ||
      rolesOpen ||
      policyOpen ||
      approvalsOpen ||
      ownCenterOpen ||
      websiteCmsOpen ||
      platformConfigOpen ||
      healthDoctorOpen ||
      centerPublisherOpen ||
      healthProviderOpen ||
      healthReviewsOpen ||
      doctorLeaveReviewsOpen ||
      patientAdminOpen ||
      patientQueueOpen ||
      labOrdersOpen ||
      labEquipmentOpen ||
      healthcarePoliciesOpen ||
      centerMerchantOpen ||
      foundationLiabilitiesOpen ||
      monthlyProviderSettlementsOpen ||
      labTestMasterOpen ||
      myLabPricingOpen ||
      patientBookingOpen ||
      documentsOpen ||
      notificationsOpen ||
      communicationsOpen ||
      noticeAdminOpen ||
      supportOpen ||
      financeReviewOpen ||
      voucherOnlyOpen ||
      financeClaimReviewsOpen ||
      financeClaimsOpen ||
      invoiceOpen ||
      invoiceReviewOpen ||
      budgetOpen ||
      budgetReviewOpen ||
      reportsOpen ||
      misOpen ||
      operationsSummaryOpen || fieldVisitsOpen || activitiesOpen || tasksOpen || projectsOpen || beneficiariesOpen || campaignsOpen ||
      inventoryOpen || rewardsOpen || membershipOpen || volunteersOpen ||
      hrOpen || payrollOpen ||
      financeOpen ||
      branchesOpen ||
      foundationOpen ||
      changePasswordOpen;

    if (!isAnySubScreenOpen) return;

    const onBackPress = () => {
      setAccountOpen(false);
      setAccountsOpen(false);
      setRolesOpen(false);
      setPolicyOpen(false);
      setApprovalsOpen(false);
      setOwnCenterOpen(false); setWebsiteCmsOpen(false); setPlatformConfigOpen(false); setHealthDoctorOpen(false); setCenterPublisherOpen(false); setHealthProviderOpen(false); setHealthReviewsOpen(false);
      setDoctorLeaveReviewsOpen(false);
      setPatientAdminOpen(false); setPatientQueueOpen(false); setLabOrdersOpen(false); setLabEquipmentOpen(false); setHealthcarePoliciesOpen(false); setCenterMerchantOpen(false); setFoundationLiabilitiesOpen(false); setMonthlyProviderSettlementsOpen(false); setLabTestMasterOpen(false); setMyLabPricingOpen(false);
      setPatientBookingOpen(false);
      setDocumentsOpen(false);
      setNotificationsOpen(false);
      setCommunicationsOpen(false);
      setNoticeAdminOpen(false);
      setSupportOpen(false);
      setFinanceReviewOpen(false);
      setVoucherOnlyOpen(false);
      setFinanceClaimReviewsOpen(false);
      setFinanceClaimsOpen(false);
      setInvoiceOpen(false);
      setInvoiceReviewOpen(false);
      setBudgetOpen(false);
      setBudgetReviewOpen(false);
      setReportsOpen(false); setMisOpen(false); setHrOpen(false); setPayrollOpen(false); setInventoryOpen(false); setRewardsOpen(false); setMembershipOpen(false); setProjectsOpen(false); setBeneficiariesOpen(false); setCampaignsOpen(false); setTasksOpen(false); setActivitiesOpen(false); setFieldVisitsOpen(false); setOperationsSummaryOpen(false);
      setFinanceOpen(false);
      setBranchesOpen(false);
      setFoundationOpen(false);
      setChangePasswordOpen(false);
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [
    accountOpen,
    accountsOpen,
    rolesOpen,
    policyOpen,
    approvalsOpen,
    ownCenterOpen,
    websiteCmsOpen,
    platformConfigOpen,
    healthDoctorOpen,
    centerPublisherOpen,
    healthProviderOpen,
    healthReviewsOpen,
    doctorLeaveReviewsOpen,
    patientAdminOpen,
    patientQueueOpen,
    labOrdersOpen,
    labEquipmentOpen,
    healthcarePoliciesOpen,
    centerMerchantOpen,
    foundationLiabilitiesOpen,
    monthlyProviderSettlementsOpen,
    labTestMasterOpen,
    myLabPricingOpen,
    patientBookingOpen,
    documentsOpen,
    notificationsOpen,
    communicationsOpen,
    noticeAdminOpen,
    supportOpen,
    financeReviewOpen,
    voucherOnlyOpen,
    financeClaimReviewsOpen,
    financeClaimsOpen,
    invoiceOpen,
    invoiceReviewOpen,
    budgetOpen,
    budgetReviewOpen,
    reportsOpen,
    misOpen,
    operationsSummaryOpen, fieldVisitsOpen, activitiesOpen, tasksOpen, projectsOpen, beneficiariesOpen, campaignsOpen,
    inventoryOpen,
    rewardsOpen,
    membershipOpen,
    volunteersOpen,
    hrOpen, payrollOpen,
    financeOpen,
    branchesOpen,
    changePasswordOpen
  ]);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORE_KEY);
        if (!stored) { if (active) setState("idle"); return; }
        const verified = await sessionView(stored);
        if (!active) return;
        if (!verified) { await SecureStore.deleteItemAsync(STORE_KEY); setActor(null); setToken(null); }
        else {
          const actions = await currentRoleActions(stored);
          if (active) { setRoleActions(actions); setToken(stored); setActor(verified); }
        }
      } catch {
        if (active) setMessage("Access cannot be verified right now. Protected information remains hidden.");
      } finally { if (active) setState("idle"); }
    })();
    return () => { active = false; };
  }, []);

  // Event-driven authorization check on resume, without background polling.
  useEffect(() => {
    if (!token) return;
    let active = true;
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") return;
      setState("checking"); setActor(null); setRoleActions([]);
      void (async () => {
        try {
          const fresh = await sessionView(token);
          if (!active) return;
          if (!fresh) { expireSession(); }
          else { const actions = await currentRoleActions(token); if (active) { setRoleActions(actions); setActor(fresh); } }
        } catch {
          if (active) { setActor(null); setMessage("Access cannot be verified. Protected information remains hidden."); }
        } finally {
          if (active) setState("idle");
        }
      })();
    });
    return () => { active = false; subscription.remove(); };
  }, [token, expireSession]);

  const cardAnim = useRef(new Animated.Value(24)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const focusedFieldRef = useRef<"identifier" | "password" | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      (e) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        if (focusedFieldRef.current) {
          const targetY = focusedFieldRef.current === "identifier" ? 210 : 280;
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      () => {
        setKeyboardHeight(0);
        focusedFieldRef.current = null;
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onFieldFocus = useCallback((field: "identifier" | "password") => {
    focusedFieldRef.current = field;
    const targetY = field === "identifier" ? 210 : 280;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, []);

  useEffect(() => {
    if (!actor && !recover) {
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 550,
          delay: 150,
          useNativeDriver: true
        }),
        Animated.timing(cardAnim, {
          toValue: 0,
          duration: 550,
          delay: 150,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [actor, recover, cardAnim, cardOpacity]);

  async function signIn() {
    if (state === "busy") return;
    setState("busy"); setMessage(""); setLoginFieldError(null);
    const trimmedId = email.trim();
    if (!trimmedId || !password) {
      const field = !trimmedId && !password ? "all" : !trimmedId ? "identifier" : "password";
      setLoginFieldError(field);
      const emptyMsg = !trimmedId && !password
        ? "Please enter both your identifier and password to continue."
        : !trimmedId
          ? "Please enter your mobile number or email to continue."
          : "Please enter your password to continue.";
      setMessage(emptyMsg);
      showToast({
        type: "error",
        title: "Required Fields Missing",
        message: emptyMsg
      });
      setState("idle");
      return;
    }
    const request: CG01SignInRequest = { identifier: trimmedId, password, deviceLabel: "Internal Android" };
    let issuedToken: string | null = null;
    try {
      let response: Response;
      try {
        response = await identityRequest("/api/identity/login", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request)
        });
      } catch (err: unknown) {
        if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("aborted") || err.message?.includes("timeout"))) {
          const timeoutMsg = "The request is taking too long. Please try again.";
          setMessage(timeoutMsg);
          showToast({ type: "error", title: "Request Timeout", message: timeoutMsg });
          return;
        }
        if (err instanceof Error && (err.message.includes("API configuration error") || err.message === "Authentication service unavailable")) {
          const svcMsg = "Authentication service is currently unavailable. Please check settings.";
          setMessage(svcMsg);
          showToast({ type: "error", title: "Service Unavailable", message: svcMsg });
          return;
        }
        const netMsg = "We’re unable to connect right now. Please check your network and try again.";
        setMessage(netMsg);
        showToast({ type: "error", title: "Connection Failed", message: netMsg });
        return;
      }
      if (!response.ok) {
        const payload: unknown = [400, 401].includes(response.status) ?
          await response.json().catch(() => null) : null;
        const data = payload && typeof payload === "object" && !Array.isArray(payload) ?
          payload as Record<string, unknown> : {};
        const codes = new Set(["IDENTITY_IDENTIFIER_REQUIRED", "IDENTITY_IDENTIFIER_INVALID",
          "IDENTITY_PASSWORD_REQUIRED", "IDENTITY_PASSWORD_TOO_LONG"]);
        const isSafe = (response.status === 400 && typeof data.code === "string" && codes.has(data.code)) ||
          (response.status === 401 && data.code==="IDENTITY_LOGIN_INVALID");
        const isInvalidCreds = response.status === 401;
        const field: "identifier" | "password" | "all" | null = isSafe && (data.field === "identifier" || data.field === "password")
          ? data.field
          : isInvalidCreds
            ? "all"
            : null;
        setLoginFieldError(field);
        const errMsg = isSafe && typeof data.message === "string" && data.message.length >= 16 && data.message.length <= 220
          ? data.message
          : response.status === 429 ? "Too many login attempts. Please try later."
            : response.status === 401 ? "The mobile number, email, or password you entered is incorrect. Please check and try again."
              : response.status === 400 ? "Check your mobile/email and password details."
                : response.status === 403 ? "Access is not authorized. Please contact an administrator."
                  : response.status === 404 ? "Authentication service is currently unavailable. Please try again shortly."
                    : response.status >= 500 ? "We’re unable to connect right now. Please try again shortly."
                      : "Sign-in could not be confirmed. Check your details and retry.";
        setMessage(errMsg);
        showToast({
          type: "error",
          title: response.status === 401 ? "Invalid Credentials" : "Sign In Failed",
          message: errMsg
        });
        return;
      }
      const data: CG01SessionCreated = await response.json();
      if (typeof data.sessionToken !== "string" || typeof data.expiresAt !== "string" ||
        !Number.isFinite(new Date(data.expiresAt).getTime()) ||
        new Date(data.expiresAt).getTime() <= Date.now()) {
        setMessage("Something went wrong. Please try again.");
        showToast({ type: "error", title: "Sign In Error", message: "Something went wrong. Please try again." });
        return;
      }
      issuedToken = data.sessionToken;
      const verified = await sessionView(issuedToken);
      if (!verified) {
        setMessage("Your session has expired. Please sign in again.");
        showToast({ type: "error", title: "Session Expired", message: "Your session has expired. Please sign in again." });
        return;
      }
      // Don't persist or show a session until BOTH identity and effective access
      // are verified, so offline/invalid permission reads cannot look like success.
      const actions = await currentRoleActions(issuedToken);
      await SecureStore.setItemAsync(STORE_KEY, issuedToken);
      setRoleActions(actions); setToken(issuedToken); setActor(verified); setPassword("");
      hideToast();
    } catch (err: unknown) {
      setRoleActions([]); setActor(null); setToken(null);
      // If a session was issued but later bootstrap steps failed, avoid leaving a
      // needless server-side session alive. This is best effort, not a claimed logout.
      if (issuedToken) {
        try {
          await identityRequest("/api/identity/logout", {
            method: "POST", headers: { Authorization: "Bearer " + issuedToken }
          });
        } catch {/* eventual server expiry still applies */ }
        try { await SecureStore.deleteItemAsync(STORE_KEY); } catch {/* no sign-in displayed */ }
      }
      const failMsg = err instanceof Error && err.name === "AbortError"
        ? "The request is taking too long. Please try again."
        : err instanceof Error && (err.message.includes("Cannot find native module") || err.message.includes("ExpoCrypto"))
          ? "This app needs an update to complete startup. Please contact support."
          : "We’re unable to connect right now. Please try again shortly.";
      setMessage(failMsg);
      showToast({ type: "error", title: "Connection Failed", message: failMsg });
    } finally { setState("idle"); }
  }
  async function signOut() {
    if (state === "busy" || !token) return;
    setState("busy");
    setMessage("");
    hideToast();
    try {
      const response = await identityRequest("/api/identity/logout", {
        method: "POST", headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) throw new Error("Server revocation not confirmed");
      hideToast();
      setMessage("");
      // Backend revocation is authoritative. The UI must not continue showing an
      // authenticated actor if on-device deletion fails afterward.
      setActor(null); setToken(null); setRoleActions([]); setRolesOpen(false); setAccountsOpen(false); setPolicyOpen(false); setApprovalsOpen(false); setOwnCenterOpen(false); setWebsiteCmsOpen(false); setPlatformConfigOpen(false); setHealthDoctorOpen(false); setCenterPublisherOpen(false); setHealthProviderOpen(false); setHealthReviewsOpen(false); setDoctorLeaveReviewsOpen(false); setPatientAdminOpen(false); setPatientQueueOpen(false); setLabOrdersOpen(false); setLabEquipmentOpen(false); setHealthcarePoliciesOpen(false); setCenterMerchantOpen(false); setFoundationLiabilitiesOpen(false); setMonthlyProviderSettlementsOpen(false); setLabTestMasterOpen(false); setMyLabPricingOpen(false); setPatientBookingOpen(false); setDocumentsOpen(false); setCommunicationsOpen(false); setNotificationsOpen(false); setSupportOpen(false); setNoticeAdminOpen(false); setBranchesOpen(false); setFinanceOpen(false); setVoucherOnlyOpen(false);
      setFinanceReviewOpen(false); setFinanceClaimsOpen(false); setFinanceClaimReviewsOpen(false); setInvoiceOpen(false); setInvoiceReviewOpen(false); setBudgetOpen(false); setBudgetReviewOpen(false); setReportsOpen(false); setMisOpen(false); setHrOpen(false); setPayrollOpen(false); setInventoryOpen(false); setRewardsOpen(false); setMembershipOpen(false); setProjectsOpen(false); setBeneficiariesOpen(false); setCampaignsOpen(false); setTasksOpen(false); setActivitiesOpen(false); setFieldVisitsOpen(false); setOperationsSummaryOpen(false);
      try {
        await SecureStore.deleteItemAsync(STORE_KEY);
      } catch {
        setMessage("Signed out. Local session cleanup could not be confirmed and will be retried.");
      }
    } catch { setMessage("Sign-out could not be confirmed. Please retry."); }
    finally {
      hideToast();
      setState("idle");
    }
  }
  // One active business screen ensures CG-01 drawer navigation really changes modules.
  const closeModuleViews = useCallback(() => {
        setAccountOpen(false);
        setAccountsOpen(false);
        setRolesOpen(false);
        setPolicyOpen(false);
        setApprovalsOpen(false);
        setOwnCenterOpen(false); setWebsiteCmsOpen(false); setPlatformConfigOpen(false); setHealthDoctorOpen(false); setCenterPublisherOpen(false); setHealthProviderOpen(false); setHealthReviewsOpen(false);
        setDoctorLeaveReviewsOpen(false);
        setPatientAdminOpen(false); setPatientQueueOpen(false); setClinicianActivityOpen(false); setLabOrdersOpen(false); setLabEquipmentOpen(false); setHealthcarePoliciesOpen(false); setCenterMerchantOpen(false); setFoundationLiabilitiesOpen(false); setMonthlyProviderSettlementsOpen(false); setLabTestMasterOpen(false); setMyLabPricingOpen(false);
        setPatientBookingOpen(false);
        setDocumentsOpen(false);
        setNotificationsOpen(false);
        setCommunicationsOpen(false);
        setNoticeAdminOpen(false);
        setSupportOpen(false);
        setFinanceReviewOpen(false);
        setVoucherOnlyOpen(false);
        setFinanceClaimReviewsOpen(false);
        setFinanceClaimsOpen(false);
        setInvoiceOpen(false);
        setInvoiceReviewOpen(false);
        setBudgetOpen(false);
        setBudgetReviewOpen(false);
        setReportsOpen(false); setMisOpen(false); setHrOpen(false); setPayrollOpen(false); setInventoryOpen(false); setMembershipOpen(false); setVolunteersOpen(false); setProjectsOpen(false); setBeneficiariesOpen(false); setCampaignsOpen(false); setTasksOpen(false); setActivitiesOpen(false); setFieldVisitsOpen(false); setOperationsSummaryOpen(false);
        setFinanceOpen(false);
        setBranchesOpen(false);
        setFoundationOpen(false);
        setChangePasswordOpen(false);
  }, []);
  const openOnly = useCallback((show: (value: boolean) => void) => {
    closeModuleViews();
    show(true);
  }, [closeModuleViews]);
  const handlers: ModuleActionHandlers = useMemo(
    () => ({
      openDashboard: closeModuleViews,
      openAccount: () => openOnly(setAccountOpen),
      openAccounts: () => openOnly(setAccountsOpen),
      openRoles: () => openOnly(setRolesOpen),
      openPolicy: () => openOnly(setPolicyOpen),
      openApprovals: () => openOnly(setApprovalsOpen),
      openPatientAdmin: () => openOnly(setPatientAdminOpen),
      openPatientQueue: () => openOnly(setPatientQueueOpen),
      openClinicianActivity: () => openOnly(setClinicianActivityOpen),
      openLabOrders: () => openOnly(setLabOrdersOpen),
      openLabEquipment: () => openOnly(setLabEquipmentOpen),
      openHealthcarePolicies: () => openOnly(setHealthcarePoliciesOpen),
      openCenterMerchant: () => openOnly(setCenterMerchantOpen),
      openFoundationLiabilities: () => openOnly(setFoundationLiabilitiesOpen),
      openMonthlyProviderSettlements: () => openOnly(setMonthlyProviderSettlementsOpen),
      openPartnerSettlements: () => openOnly(setPartnerSettlementsOpen),
      openLabTestMaster: () => openOnly(setLabTestMasterOpen),
      openMyLabPricing: () => openOnly(setMyLabPricingOpen),
      openPatientBooking: () => openOnly(setPatientBookingOpen),
      openDoctorLeaveReviews: () => openOnly(setDoctorLeaveReviewsOpen),
      openOwnCenterPortal: () => openOnly(setOwnCenterOpen),
      openWebsiteCms: () => openOnly(setWebsiteCmsOpen),
      openPlatformConfiguration: () => openOnly(setPlatformConfigOpen),
      openHealthDoctorManagement: () => openOnly(setHealthDoctorOpen),
      openCenterContentPublisher: () => openOnly(setCenterPublisherOpen),
      openHealthProviderManagement: () => openOnly(setHealthProviderOpen),
      openHealthReviews: () => openOnly(setHealthReviewsOpen),
      openDocuments: () => openOnly(setDocumentsOpen),
      openNotifications: () => openOnly(setNotificationsOpen),
      openCommunications: () => openOnly(setCommunicationsOpen),
      openNoticeAdmin: () => openOnly(setNoticeAdminOpen),
      openSupport: () => openOnly(setSupportOpen),
      openFinanceReview: () => openOnly(setFinanceReviewOpen),
      openVoucherOnly: () => openOnly(setVoucherOnlyOpen),
      openFinanceClaimReviews: () => openOnly(setFinanceClaimReviewsOpen),
      openFinanceClaims: () => openOnly(setFinanceClaimsOpen),
      openInvoice: () => openOnly(setInvoiceOpen),
      openInvoiceReview: () => openOnly(setInvoiceReviewOpen),
      openBudget: () => openOnly(setBudgetOpen),
      openBudgetReview: () => openOnly(setBudgetReviewOpen),
      openReports: () => openOnly(setReportsOpen),
      openMis: () => openOnly(setMisOpen),
      openHr: () => openOnly(setHrOpen),
      openPayroll: () => openOnly(setPayrollOpen),
      openProjects: () => openOnly(setProjectsOpen),
      openBeneficiaries: () => openOnly(setBeneficiariesOpen),
      openCampaigns: () => openOnly(setCampaignsOpen),
      openCsr: () => openOnly(setCsrOpen),
      openActivities: () => openOnly(setActivitiesOpen),
      openFieldVisits: () => openOnly(setFieldVisitsOpen),
      openOperationsSummary: () => openOnly(setOperationsSummaryOpen),
      openTasks: () => openOnly(setTasksOpen),
      openInventory: () => openOnly(setInventoryOpen),
      openRewards: () => openOnly(setRewardsOpen),
      openMembership: () => openOnly(setMembershipOpen),
      openVolunteers: () => openOnly(setVolunteersOpen),
      openFinance: () => openOnly(setFinanceOpen),
      openBranches: () => openOnly(setBranchesOpen),
      openFoundation: () => openOnly(setFoundationOpen),
      openChangePassword: () => openOnly(setChangePasswordOpen)
    }),
    [closeModuleViews, openOnly]
  );

  // Reuse the latest CG-01 shell for source-integrated business screens.
  // Existing form logic, permissions and screen-specific back actions remain in place.
  const renderInShell = (
    screen: React.ReactElement, activeTabId: string, onClose: () => void
  ): React.ReactElement => (
    <AuthenticatedAppShell
      actor={actor!}
      roleActions={roleActions}
      handlers={handlers}
      onSignOut={() => void signOut()}
      activeTabId={activeTabId}
      onOpenDashboard={onClose}
      hideWelcome={true}
    >
      <View style={{ flex: 1, paddingBottom: 100 }}>{screen}</View>
    </AuthenticatedAppShell>
  );

  if(operationsSummaryOpen&&token&&actor){
    if(!roleActions.includes("projects.operations.view"))return <AccessDeniedScreen reason="You cannot view the operational summary." onMyAccount={()=>setOperationsSummaryOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setOperationsSummaryOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeOperationsSummary key={token} token={token} canExport={roleActions.includes("projects.operations.export")} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"operationsSummary",()=>setOperationsSummaryOpen(false));
  }
  if(fieldVisitsOpen&&token&&actor){
    if(!roleActions.includes("projects.visits.view"))return <AccessDeniedScreen reason="You cannot view field visits." onMyAccount={()=>setFieldVisitsOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setFieldVisitsOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeFieldVisitsWorkspace canConfigureReview={roleActions.includes("approvals.process.manage")} key={token} token={token} canManage={roleActions.includes("projects.visits.manage")} canExport={roleActions.includes("projects.visits.export")} canReadEvidence={roleActions.includes("documents.files.view")} canUploadEvidence={roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"fieldVisits",()=>setFieldVisitsOpen(false));
  }
  if(activitiesOpen&&token&&actor){
    if(!roleActions.includes("projects.activities.view"))return <AccessDeniedScreen reason="You cannot view activities." onMyAccount={()=>setActivitiesOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setActivitiesOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeActivitiesWorkspace key={token} token={token} canManage={roleActions.includes("projects.activities.manage")} canExport={roleActions.includes("projects.activities.export")} canReadEvidence={roleActions.includes("documents.files.view")} canUploadEvidence={roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"activities",()=>setActivitiesOpen(false));
  }
  if(tasksOpen&&token&&actor){
    if(!roleActions.includes("projects.tasks.view"))return <AccessDeniedScreen reason="You cannot view tasks." onMyAccount={()=>setTasksOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setTasksOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeTasksWorkspace key={token} token={token} canManage={roleActions.includes("projects.tasks.manage")} canExport={roleActions.includes("projects.tasks.export")} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"tasks",()=>setTasksOpen(false));
  }
  if(csrOpen&&token&&actor){
    const canDrafts=roleActions.includes("csr.partners.view");
    const canReviews=roleActions.includes("csr.partners.review")&&roleActions.includes("approvals.review");
    const canReports=canDrafts&&roleActions.includes("finance.reports.view");
    if(!canDrafts&&!canReviews)return <AccessDeniedScreen reason="Your current role cannot access CSR partners." onMyAccount={()=>setCsrOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setCsrOpen(false)}>
     <View style={{flex:1}}>
      <View style={{flexDirection:"row",gap:9,padding:9,flexWrap:"wrap"}}>
       {canDrafts&&<Pressable accessibilityRole="button" onPress={()=>setCsrTab("DRAFTS")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}><Text>CSR partners</Text></Pressable>}
       {canDrafts&&<Pressable accessibilityRole="button" onPress={()=>setCsrTab("FUNDING")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}><Text>Funding requests</Text></Pressable>}
       {canReports&&<Pressable accessibilityRole="button" onPress={()=>setCsrTab("REPORTS")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}><Text>Funding reports</Text></Pressable>}
       {canReviews&&<Pressable accessibilityRole="button" onPress={()=>setCsrTab("REVIEWS")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}><Text>Independent reviews</Text></Pressable>}
       {canReviews&&<Pressable accessibilityRole="button" onPress={()=>setCsrTab("FUNDING_REVIEWS")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}><Text>Funding approvals</Text></Pressable>}
      </View>
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
       {canReports&&csrTab==="REPORTS"?
        <NativeCsrFundingReports key={token} token={token} onExpired={expireSession}/>:
        canDrafts&&csrTab==="FUNDING"?
        <NativeCsrFunding key={token} token={token}
         canManage={roleActions.includes("csr.partners.manage")}
         canReadAgreement={roleActions.includes("documents.files.view")}
         canUploadAgreement={roleActions.includes("documents.files.manage")&&roleActions.includes("documents.files.view")}
         canReadFinance={roleActions.includes("finance.reports.view")}
         canLinkFinance={roleActions.includes("finance.reconciliation.manage")}
         canBudgetManage={roleActions.includes("finance.budgets.manage")}
         onExpired={expireSession}/>:
        canDrafts&&(!canReviews||csrTab==="DRAFTS")?
        <NativeCsrPartners key={token} token={token} canManage={roleActions.includes("csr.partners.manage")}
         canReadAgreement={roleActions.includes("documents.files.view")}
         canUploadAgreement={roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")}
         canManagePublic={roleActions.includes("csr.partners.manage")&&roleActions.includes("cms.content.manage")&&roleActions.includes("documents.files.view")}
         onExpired={expireSession}/>:
        canReviews&&csrTab==="FUNDING_REVIEWS"?
        <NativeCsrFundingReviews key={token} token={token}
         canConfigure={roleActions.includes("approvals.process.manage")} onExpired={expireSession}/>:
        <NativeCsrReviews key={token} token={token}
         canConfigure={roleActions.includes("approvals.process.manage")} onExpired={expireSession}/>}
      </Suspense>
     </View>
    </ScreenErrorBoundary>,"csr",()=>setCsrOpen(false));
  }
  if(campaignsOpen&&token&&actor){
    const canDrafts=roleActions.includes("campaigns.view");
    const canReviews=roleActions.includes("campaigns.review")&&roleActions.includes("approvals.review");
    if(!canDrafts&&!canReviews)return <AccessDeniedScreen reason="Your current role cannot access Foundation campaigns." onMyAccount={()=>setCampaignsOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setCampaignsOpen(false)}>
     <View style={{flex:1}}>
      {canDrafts&&canReviews&&<View style={{flexDirection:"row",gap:10,padding:9}}>
        <Pressable accessibilityRole="button" onPress={()=>setCampaignsTab("DRAFTS")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}>
         <Text>Campaign drafts</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={()=>setCampaignsTab("REVIEWS")} style={{padding:12,borderWidth:1,borderRadius:9,borderColor:"#B9C7E8"}}>
         <Text>Independent reviews</Text></Pressable>
      </View>}
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
       {canDrafts&&(!canReviews||campaignsTab==="DRAFTS")?
        <NativeCampaignDrafts key={token} token={token} canManage={roleActions.includes("campaigns.manage")} onExpired={expireSession}/>:
        <NativeCampaignReviews key={token} token={token} canConfigure={roleActions.includes("approvals.process.manage")} onExpired={expireSession}/>}
      </Suspense>
     </View>
    </ScreenErrorBoundary>,"campaigns",()=>setCampaignsOpen(false));
  }
  if(beneficiariesOpen&&token&&actor){
    if(!roleActions.includes("beneficiaries.view"))
      return <AccessDeniedScreen reason="You cannot view private beneficiaries." onMyAccount={()=>setBeneficiariesOpen(false)}/>;
    return renderInShell(
      <ScreenErrorBoundary onExit={()=>setBeneficiariesOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
          <NativeBeneficiariesWorkspace key={token} token={token} onExpired={expireSession} canReadEvidence={roleActions.includes("documents.files.view")} canUploadEvidence={roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")}
            canManage={roleActions.includes("beneficiaries.manage")}
            canLinkProjects={roleActions.includes("beneficiaries.projects.manage")&&roleActions.includes("projects.view")}
            canManageLifecycle={roleActions.includes("beneficiaries.lifecycle.manage")}
            canRevoke={roleActions.includes("beneficiaries.consent.revoke")}
            canViewAssistance={roleActions.includes("beneficiaries.assistance.view")}
            canManageAssistance={roleActions.includes("beneficiaries.assistance.manage")}
            canReviewAssistance={roleActions.includes("beneficiaries.assistance.review")&&roleActions.includes("approvals.review")}
            canDeliverAssistance={roleActions.includes("beneficiaries.assistance.deliver")}
            canIssueStock={roleActions.includes("inventory.stock.issue")&&roleActions.includes("inventory.stock.view")}
            canPreparePayment={roleActions.includes("finance.vouchers.manage")&&roleActions.includes("finance.vouchers.view")}
            canExportReports={roleActions.includes("beneficiaries.reports.export")}
            canSubmitVerification={roleActions.includes("beneficiaries.manage")}
            canReviewVerification={roleActions.includes("beneficiaries.verification.review")&&roleActions.includes("approvals.review")}/>
        </Suspense>
      </ScreenErrorBoundary>,"beneficiaries",()=>setBeneficiariesOpen(false));
  }
  if(projectsOpen&&token&&actor){
    if(!roleActions.includes("projects.view"))return <AccessDeniedScreen reason="You cannot view projects." onMyAccount={()=>setProjectsOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setProjectsOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeProjectsWorkspace token={token} canManage={roleActions.includes("projects.manage")} canExport={roleActions.includes("projects.export")} canReadCover={roleActions.includes("documents.files.view")} canUploadCover={roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"projects",()=>setProjectsOpen(false));
  }
  if(rewardsOpen&&token&&actor){
    if(!roleActions.includes("rewards.catalog.view"))
     return <AccessDeniedScreen reason="This role cannot view the reward catalogue."
      onMyAccount={()=>setRewardsOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setRewardsOpen(false)}>
     <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
      <NativeRewardCatalogue token={token} canViewStock={roleActions.includes("inventory.catalog.view")}
       canIssueStock={roleActions.includes("inventory.stock.issue")&&
        roleActions.includes("inventory.stock.view")&&roleActions.includes("inventory.catalog.view")}
       canViewMembers={roleActions.includes("membership.members.view")}
       canViewVolunteers={roleActions.includes("volunteers.view")}
       onExpired={expireSession}/>
     </Suspense>
    </ScreenErrorBoundary>,"rewards",()=>setRewardsOpen(false));
  }
  if(inventoryOpen&&token&&actor){
    if(!roleActions.includes("inventory.catalog.view"))return <AccessDeniedScreen reason="You cannot view inventory." onMyAccount={()=>setInventoryOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setInventoryOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeInventoryCatalog token={token} canRequests={roleActions.includes("inventory.requests.view")||roleActions.includes("inventory.requests.review")} canRequestManage={roleActions.includes("inventory.requests.manage")} canReview={roleActions.includes("inventory.requests.review")&&roleActions.includes("approvals.review")} canConfigure={roleActions.includes("approvals.process.manage")} canIssue={roleActions.includes("inventory.stock.issue")} canTransfer={roleActions.includes("inventory.stock.transfer")} canAdjust={roleActions.includes("inventory.stock.adjust")} canAdjustReview={roleActions.includes("inventory.stock.adjust.review")&&roleActions.includes("approvals.review")} canStock={roleActions.includes("inventory.stock.view")} canReceive={roleActions.includes("inventory.stock.receive")} canReverse={roleActions.includes("inventory.stock.reverse")} canReadProof={roleActions.includes("documents.files.view")} canUploadProof={roleActions.includes("documents.files.manage")&&roleActions.includes("documents.files.view")} canManage={roleActions.includes("inventory.catalog.manage")} canPrivate={roleActions.includes("inventory.supplier.private.manage")} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"inventory",()=>setInventoryOpen(false));
  }
  if(volunteersOpen&&token&&actor){
    const canRoster=roleActions.includes("volunteers.view");
    const canReview=roleActions.includes("approvals.review")&&roleActions.includes("volunteers.applications.review")&&roleActions.includes("documents.files.view");
    if(!canRoster&&!canReview)return <AccessDeniedScreen reason="Your role cannot access volunteer applications or the approved directory." onMyAccount={()=>setVolunteersOpen(false)}/>;
    return renderInShell(
      <ScreenErrorBoundary onExit={()=>setVolunteersOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
          <NativeVolunteerStaff key={token} token={token} canReview={canReview} canRoster={canRoster}
            canExport={canRoster&&roleActions.includes("volunteers.export")}
            canConfigure={canReview&&roleActions.includes("approvals.process.manage")}
            canIssueCards={canRoster&&roleActions.includes("volunteers.documents.issue")}
            canReimburse={canRoster&&["finance.claims.create","finance.claims.view","documents.files.manage","documents.files.view"].every(k=>roleActions.includes(k))}
            canImport={canRoster&&canReview}
            onExpired={expireSession}/>
        </Suspense>
      </ScreenErrorBoundary>,"volunteers",()=>setVolunteersOpen(false));
  }
    if(membershipOpen&&token&&actor){
    const canMembers=roleActions.includes("membership.members.view");
    const canIssueDocs=roleActions.includes("membership.documents.issue");
    const canReview=roleActions.includes("approvals.review")&&roleActions.includes("membership.applications.review")&&roleActions.includes("documents.files.view");
    if(!canMembers&&!canReview&&!canIssueDocs)return <AccessDeniedScreen reason="You cannot view membership records." onMyAccount={()=>setMembershipOpen(false)}/>;
    return renderInShell(<ScreenErrorBoundary onExit={()=>setMembershipOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativeMembershipDesk key={token} token={token} canViewMembers={canMembers} canExportMembers={canMembers&&roleActions.includes("membership.members.export")} canReview={canReview} canConfigure={canReview&&roleActions.includes("approvals.process.manage")} canIssueDocs={canIssueDocs} onExpired={expireSession}/></Suspense></ScreenErrorBoundary>,"membership",()=>setMembershipOpen(false));
  }
  if(payrollOpen&&token&&actor){
    return renderInShell(<ScreenErrorBoundary onExit={()=>setPayrollOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}><NativePayroll key={token} token={token} onExpired={expireSession} canReview={roleActions.includes("payroll.sensitive.approve")&&roleActions.includes("approvals.review")}/></Suspense></ScreenErrorBoundary>,"payroll",()=>setPayrollOpen(false));
  }
  if (hrOpen && token && actor) {
    // Same actor self profile is open to every signed-in Foundation employee.
    // Application list/create remain behind per-action server HR permissions.
    return renderInShell(<ScreenErrorBoundary onExit={() => setHrOpen(false)}>
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
        <NativeHrEnrollment token={token} canViewAllowances={roleActions.includes("finance.claims.view")} canRequestAllowances={roleActions.includes("finance.claims.create")} canUploadAllowanceBill={roleActions.includes("documents.files.manage")&&roleActions.includes("documents.files.view")} canView={roleActions.includes("hr.applications.view")}
          canManage={roleActions.includes("hr.applications.manage")}
          canSelectAccounts={roleActions.includes("accounts.select")}
          canSelectRoles={roleActions.includes("roles.select")}
          canViewPrivate={roleActions.includes("hr.employees.private.view")}
          canManagePrivate={roleActions.includes("hr.employees.private.manage")}
          canViewEmployees={roleActions.includes("hr.employees.view")}
          canConfigureReviews={roleActions.includes("approvals.process.manage")}
          canManageDocuments={roleActions.includes("hr.documents.manage")} canManageAppraisals={roleActions.includes("hr.appraisals.manage")} canApproveTemplates={roleActions.includes("hr.documents.review")} canReviewDocuments={roleActions.includes("hr.documents.review")&&roleActions.includes("approvals.review")} canIssueDocuments={roleActions.includes("documents.letters.issue")} canRevokeDocuments={roleActions.includes("documents.letters.revoke")} canManageChanges={roleActions.includes("hr.changes.manage")} canReviewChanges={roleActions.includes("hr.changes.review")&&roleActions.includes("approvals.review")} canViewStaff={roleActions.includes("hr.attendance.view")} canCorrect={roleActions.includes("hr.attendance.correct")} canReviewCorrection={roleActions.includes("hr.attendance.review")&&roleActions.includes("approvals.review")}
          canReviewLeave={roleActions.includes("hr.leave.view")}
          canManageLeave={roleActions.includes("hr.leave.policies.manage")}
          canConfigureAttendance={roleActions.includes("hr.shifts.manage")&&
            roleActions.includes("hr.attendance.view")&&roleActions.includes("hr.employees.view")}
          canReview={roleActions.includes("approvals.review")&&
            roleActions.includes("hr.employees.review")}
          onExit={() => setHrOpen(false)} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>,"hr",()=>setHrOpen(false));
  }
  if (recover)
    return (
      <ScreenErrorBoundary onExit={() => setRecover(false)}>
        <RecoveryScreen onExit={() => setRecover(false)} />
      </ScreenErrorBoundary>
    );
  if (accountOpen && token && actor)
    return (
      <ScreenErrorBoundary onExit={closeAccount}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <MyAccountScreen
            actor={actor}
            token={token}
            roleActions={roleActions}
            onExit={closeAccount}
            onOpenChangePassword={() => {
              setAccountOpen(false);
              setChangePasswordOpen(true);
            }}
            onSignOut={() => void signOut()}
            onExpired={expireSession}
          />
        </Suspense>
      </ScreenErrorBoundary>
    );
  if (changePasswordOpen && token && actor)
    return (
      <ScreenErrorBoundary onExit={() => setChangePasswordOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <ChangePasswordScreen token={token}
            onExit={() => setChangePasswordOpen(false)} onExpired={expireSession}
            onChanged={() => {
              expireSession(); setChangePasswordOpen(false);
              setMessage("Password changed. Sign in again.");
            }} />
        </Suspense>
      </ScreenErrorBoundary>
    );
  if (accountsOpen && token && actor) {
    if (!roleActions.includes("accounts.view") && !roleActions.includes("accounts.create"))
      return (
        <AccessDeniedScreen
          reason="You cannot view staff accounts."
          onMyAccount={closeAccounts}
        />
      );
    return (
      <ScreenErrorBoundary onExit={closeAccounts}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <AccountsScreen
            token={token}
            actor={actor}
            roleActions={roleActions}
            handlers={handlers}
            onSignOut={() => void signOut()}
            onExit={closeAccounts}
            onExpired={expireSession}
            createOnly={!roleActions.includes("accounts.view")}
          />
        </Suspense>
      </ScreenErrorBoundary>
    );
  }
  if (rolesOpen && token && actor) {
    if (!roleActions.includes("roles.view"))
      return (
        <AccessDeniedScreen
          reason="Your current account does not have permission to view roles."
          onMyAccount={closeRoles}
        />
      );
    return (
      <ScreenErrorBoundary onExit={closeRoles}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <RolesScreen token={token} actor={actor} roleActions={roleActions}
            handlers={handlers} onSignOut={() => void signOut()}
            onExit={closeRoles} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>
    );
  }
  if (approvalsOpen && token && actor) {
    if (!roleActions.includes("approvals.view") && !roleActions.includes("approvals.propose"))
      return (
        <AccessDeniedScreen
          reason="Protected approval records require permission."
          onMyAccount={() => setApprovalsOpen(false)}
        />
      );
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setApprovalsOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <ProposalScreen token={token} canConfigure={roleActions.includes("approvals.process.manage")}
            canPropose={roleActions.includes("approvals.propose")}
            canReview={roleActions.includes("approvals.review")}
            onExit={() => setApprovalsOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "approvals", () => setApprovalsOpen(false))
    );
  }

  // CG-16 H09 source and actual assigned-center pricing share Web's
  // original diagnostics API. Sensitive decisions remain independently
  // authorized by the backend and a fresh password.
  if (labTestMasterOpen && token && actor &&
      roleActions.includes("diagnostics.catalog.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeLabTestMaster}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeLabTestMasterScreen token={token}
          canManage={roleActions.includes("diagnostics.catalog.manage")}
          canViewPricing={roleActions.includes("diagnostics.pricing.view")}
          canManagePricing={roleActions.includes("diagnostics.pricing.manage")}
          canApprovePricing={roleActions.includes("diagnostics.pricing.approve") &&
            roleActions.includes("approvals.review")}
          onExit={closeLabTestMaster} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthLabTestMaster", closeLabTestMaster);
  if (myLabPricingOpen && token && actor &&
      roleActions.includes("diagnostics.pricing.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeMyLabPricing}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeMyLabPricingScreen token={token}
          canManage={roleActions.includes("diagnostics.pricing.manage")}
          onExit={closeMyLabPricing} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthMyLabPricing", closeMyLabPricing);

  // CG17 US001 policy configuration is Foundation staff only; it creates
  // neither a patient booking nor paid/settled state.
  if (healthcarePoliciesOpen && token && actor &&
      (roleActions.includes("healthcare.assistance.policies.view")||
       (roleActions.includes("healthcare.assistance.policies.review")&&
        roleActions.includes("approvals.review"))))
    return renderInShell(<ScreenErrorBoundary onExit={closeHealthcarePolicies}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeHealthcarePolicyScreen token={token}
          canView={roleActions.includes("healthcare.assistance.policies.view")}
          canManage={roleActions.includes("healthcare.assistance.policies.manage")}
          canReview={roleActions.includes("healthcare.assistance.policies.review")&&
            roleActions.includes("approvals.review")}
          onExit={closeHealthcarePolicies} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthAssistancePolicies", closeHealthcarePolicies);

  // Original CG17 US003 staff-owned center merchant verification only.
  if (centerMerchantOpen && token && actor &&
      (roleActions.includes("healthcare.assistance.merchant.manage") ||
       roleActions.includes("healthcare.assistance.merchant.verify")))
    return renderInShell(<ScreenErrorBoundary onExit={closeCenterMerchant}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeCenterMerchantScreen token={token}
          canPropose={roleActions.includes("healthcare.assistance.merchant.manage")}
          canVerify={roleActions.includes("healthcare.assistance.merchant.verify")}
          onExit={closeCenterMerchant} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthCenterMerchant", closeCenterMerchant);

  // Existing CG17 US005 private Foundation-only obligation workflow.
  if (foundationLiabilitiesOpen && token && actor &&
      roleActions.includes("healthcare.assistance.liabilities.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeFoundationLiabilities}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeCompletedConsultationLiabilities token={token}
          canManage={roleActions.includes("healthcare.assistance.liabilities.manage")}
          canPost={roleActions.includes("healthcare.assistance.liabilities.manage")&&
            roleActions.includes("finance.journals.post")&&
            roleActions.includes("finance.accounts.view")}
          onExit={closeFoundationLiabilities} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthcareFoundationLiabilities", closeFoundationLiabilities);

  // CG17 US006 monthly original Foundation claim; no provider bank payout
  // or center-collected patient cash is implied by this screen.
  if (monthlyProviderSettlementsOpen && token && actor &&
      roleActions.includes("healthcare.assistance.settlements.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeMonthlyProviderSettlements}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeMonthlyProviderSettlement token={token}
          canPropose={roleActions.includes("healthcare.assistance.settlements.manage")&&
           roleActions.includes("health.providers.finance.view")}
          canReview={roleActions.includes("healthcare.assistance.settlements.review")&&
           roleActions.includes("approvals.review")&&
           roleActions.includes("health.providers.finance.view")}
          canPay={roleActions.includes("healthcare.assistance.settlements.pay")&&
           roleActions.includes("health.providers.finance.view")&&
           roleActions.includes("finance.reconciliation.manage")}
          onExit={closeMonthlyProviderSettlements} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthcareProviderSettlements", closeMonthlyProviderSettlements);

  // CG16 H08/H10 US005 instrument/quality workflow, no patient data.
  if (labEquipmentOpen && token && actor &&
      roleActions.includes("lab.equipment.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeLabEquipment}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeLabEquipmentScreen token={token}
          canManage={roleActions.includes("lab.equipment.manage")}
          canUpload={roleActions.includes("lab.quality.record")}
          onExit={closeLabEquipment} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthLabEquipment", closeLabEquipment);

  // CG-16 original H10 clinical operations; the backend re-verifies center/role
  // and consent for every action. Public Android receives no private controls.
  if (labOrdersOpen && token && actor &&
      (roleActions.includes("lab.orders.view") || roleActions.includes("lab.orders.create")))
    return renderInShell(<ScreenErrorBoundary onExit={closeLabOrders}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeClinicalLabScreen token={token}
          canView={roleActions.includes("lab.orders.view")}
          canCreate={roleActions.includes("lab.orders.create")}
          canManageSamples={roleActions.includes("lab.orders.view") && roleActions.includes("lab.samples.manage")}
          canRecordResults={roleActions.includes("lab.orders.view") && roleActions.includes("lab.results.record")}
          canReview={roleActions.includes("lab.orders.view") && roleActions.includes("lab.report.review")}
          canRelease={roleActions.includes("lab.orders.view") && roleActions.includes("lab.report.release")}
          onExit={closeLabOrders} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthLabOrders", closeLabOrders);

  // Preserve CG-14 and CG-15 flows within the new native dashboard navigation.
  if (clinicianActivityOpen && token && actor &&
    roleActions.includes("health.visits.clinical.manage"))
    return renderInShell(<ScreenErrorBoundary onExit={closeClinicianActivity}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeMyClinicianActivity token={token}
          onExit={closeClinicianActivity} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthClinicianActivity", closeClinicianActivity);
  if (partnerSettlementsOpen && token && actor &&
      roleActions.includes("healthcare.assistance.settlements.view") &&
      roleActions.includes("health.centers.draft.edit"))
    return renderInShell(<ScreenErrorBoundary onExit={closePartnerSettlements}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativePartnerSettlementSummary token={token}
          onExit={closePartnerSettlements} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthcarePartnerSettlements", closePartnerSettlements);
  if (ownCenterOpen && token && actor &&
      roleActions.includes("health.centers.draft.edit"))
    return renderInShell(<ScreenErrorBoundary onExit={closeOwnCenter}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeOwnCenterPortal token={token}
          canViewSettlements={roleActions.includes("healthcare.assistance.settlements.view")}
          onExit={closeOwnCenter} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthOwnCenterPortal", closeOwnCenter);
  if (platformConfigOpen && token && actor &&
      ["platform.settings.view","platform.integrations.view","platform.audit.view","platform.recovery.view"].some(a=>roleActions.includes(a)))
    return renderInShell(<ScreenErrorBoundary onExit={closePlatformConfig}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop:40 }}/>}>
        <NativePlatformConfiguration token={token} roleActions={roleActions}
          onExit={closePlatformConfig} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>,"platformConfiguration",closePlatformConfig);
  if (websiteCmsOpen && token && actor &&
      roleActions.includes("cms.content.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeWebsiteCms}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeCmsEditorial token={token}
          canManage={roleActions.includes("cms.content.manage")}
          canPublish={roleActions.includes("cms.content.publish")}
          canReview={roleActions.includes("approvals.review")}
          onExit={closeWebsiteCms} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "foundationWebsiteCms", closeWebsiteCms);
  if (healthDoctorOpen && token && actor &&
      roleActions.includes("health.doctors.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeHealthDoctor}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeDoctorManagement token={token}
          canManage={roleActions.includes("health.doctors.manage")}
          canVerify={roleActions.includes("health.doctors.verify")}
          onExit={closeHealthDoctor} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthDoctorManagement", closeHealthDoctor);
  if (centerPublisherOpen && token && actor &&
      roleActions.includes("health.centers.publish"))
    return renderInShell(<ScreenErrorBoundary onExit={closeCenterPublisher}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <ScrollView contentContainerStyle={{padding: 16, paddingBottom: 96}}>
          <NativeCenterContentPublisher token={token} onExpired={expireSession}/>
        </ScrollView>
      </Suspense>
    </ScreenErrorBoundary>, "centerContentPublisher", closeCenterPublisher);
  if (healthProviderOpen && token && actor &&
      roleActions.includes("health.providers.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeHealthProvider}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeProviderManagement token={token}
          canManage={roleActions.includes("health.providers.manage")}
          canVerify={roleActions.includes("health.providers.verify")}
          canActivate={roleActions.includes("health.centers.activate")}
          canPublish={roleActions.includes("health.centers.publish")}
          canViewFinance={roleActions.includes("health.providers.finance.view")}
          canManageFinance={roleActions.includes("health.providers.finance.manage")}
          onExit={closeHealthProvider} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthProviderManagement", closeHealthProvider);
  if (patientAdminOpen && token && actor &&
    roleActions.includes("health.patients.admin.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closePatientAdmin}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeFoundationPatientAdmin token={token}
          canOverride={roleActions.includes("health.appointments.override")}
          onExit={closePatientAdmin} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthPatientAdmin", closePatientAdmin);
  if (patientQueueOpen && token && actor && roleActions.includes("health.visits.manage"))
    return renderInShell(<ScreenErrorBoundary onExit={closePatientQueue}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeCenterVisitQueue token={token}
          canCancel={roleActions.includes("health.appointments.cancel")}
          canClinicalManage={roleActions.includes("health.visits.clinical.manage")}
          onExit={closePatientQueue} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthVisitQueue", closePatientQueue);
  if (patientBookingOpen && token && actor && roleActions.includes("health.patients.intake"))
    return renderInShell(<ScreenErrorBoundary onExit={closePatientBooking}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <NativeCenterAssistedBooking token={token} onExit={closePatientBooking}
          canViewCharge={roleActions.includes("healthcare.assistance.charges.view")}
          canAcceptCharge={roleActions.includes("healthcare.assistance.charges.accept")}
          canViewCollections={roleActions.includes("healthcare.assistance.collections.view")}
          canRecordCollections={roleActions.includes("healthcare.assistance.collections.record")}
          canRefundCollections={roleActions.includes("healthcare.assistance.collections.refund")}
          onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthPatientBooking", closePatientBooking);
  if (doctorLeaveReviewsOpen && token && actor &&
    roleActions.includes("approvals.review") && roleActions.includes("health.schedules.view"))
    return renderInShell(<ScreenErrorBoundary onExit={closeDoctorLeaveReviews}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <DoctorLeaveNativeReview token={token}
          onExit={closeDoctorLeaveReviews} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthDoctorLeave", closeDoctorLeaveReviews);
  if (healthReviewsOpen && token && actor && roleActions.includes("approvals.review") &&
    (roleActions.includes("health.doctors.verify") || roleActions.includes("health.providers.verify")))
    return renderInShell(<ScreenErrorBoundary onExit={closeHealthReviews}>
      <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
        <HealthcareNativeReview token={token}
          canDoctors={roleActions.includes("health.doctors.verify")}
          canProviders={roleActions.includes("health.providers.verify")}
          canManageDoctors={roleActions.includes("health.doctors.manage")}
          canManageProviders={roleActions.includes("health.providers.manage")}
          onExit={closeHealthReviews} onExpired={expireSession}/>
      </Suspense>
    </ScreenErrorBoundary>, "healthReviews", closeHealthReviews);

  if (notificationsOpen && token && actor) {
    if (!roleActions.includes("communications.notifications.view"))
      return (
        <AccessDeniedScreen
          reason="Notices are restricted to your current Foundation role."
          onMyAccount={() => setNotificationsOpen(false)}
        />
      );
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setNotificationsOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <NotificationsScreen token={token}
            onExit={() => setNotificationsOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "notifications", () => setNotificationsOpen(false))
    );
  }
  if (documentsOpen && token && actor) {
    if (!roleActions.includes("documents.files.view") || !roleActions.includes("documents.files.manage") ||
      (!roleActions.includes("approvals.view") && !roleActions.includes("approvals.propose")))
      return (
        <AccessDeniedScreen
          reason="Private files require current case and document permission."
          onMyAccount={() => setDocumentsOpen(false)}
        />
      );
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setDocumentsOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <PrivateCaseEvidenceScreen token={token}
            canViewLetters={roleActions.includes("documents.letters.issue")}
            canRevokeLetters={roleActions.includes("documents.letters.revoke")}
            onExit={() => setDocumentsOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "documents", () => setDocumentsOpen(false))
    );
  }
  if (invoiceReviewOpen && token && actor &&
    roleActions.includes("approvals.review") && roleActions.includes("finance.invoices.review"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeInvoiceReviews}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceNativeProtectedReview token={token} kind="INVOICE"
            canConfigure={roleActions.includes("approvals.process.manage")}
            onExit={closeInvoiceReviews} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeInvoiceReviews", closeInvoiceReviews)
    );
  if (budgetReviewOpen && token && actor &&
    roleActions.includes("approvals.review") && roleActions.includes("finance.budgets.review"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeBudgetReviews}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceNativeProtectedReview token={token} kind="BUDGET"
            canConfigure={roleActions.includes("approvals.process.manage")}
            onExit={closeBudgetReviews} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeBudgetReviews", closeBudgetReviews)
    );
  if (invoiceOpen && token && actor &&
    roleActions.includes("finance.invoices.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeInvoices}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceNativeInvoices token={token}
            canManage={roleActions.includes("finance.invoices.manage")}
            canIssue={roleActions.includes("finance.invoices.issue")}
            canPost={roleActions.includes("finance.journals.post")}
            canCancel={roleActions.includes("finance.invoices.review") &&
              roleActions.includes("finance.journals.post") && roleActions.includes("approvals.review")}
            onExit={closeInvoices} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeInvoices", closeInvoices)
    );
  if (budgetOpen && token && actor &&
    roleActions.includes("finance.budgets.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeBudgets}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceNativeBudgets token={token}
            canManage={roleActions.includes("finance.budgets.manage")}
            onExit={closeBudgets} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeBudgets", closeBudgets)
    );
  if (misOpen && token && actor &&
      (roleActions.includes("mis.dashboard.view") || roleActions.includes("mis.reports.view")))
    return renderInShell(
      <ScreenErrorBoundary onExit={closeMis}>
        <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
          <NativeMisWorkspaceScreen token={token} onExpired={expireSession}
            onExit={closeMis}
            canDashboard={roleActions.includes("mis.dashboard.view")}
            canReports={roleActions.includes("mis.reports.view")}
            onOpenFinance={roleActions.includes("finance.reports.view")?
              handlers.openReports:undefined}
            onOpenPatientAdmin={roleActions.includes("health.patients.admin.view")&&
              roleActions.includes("foundation.branches.admin")?
              handlers.openPatientAdmin:undefined}/>
        </Suspense>
      </ScreenErrorBoundary>,"mis",closeMis);
  if (reportsOpen && token && actor && roleActions.includes("finance.reports.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeReports}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceNativeReports token={token}
            canReconcile={roleActions.includes("finance.reconciliation.manage") && roleActions.includes("documents.files.manage")}
            canUploadStatement={roleActions.includes("finance.reconciliation.manage") &&
              roleActions.includes("documents.files.manage")}
            canReview={roleActions.includes("finance.reconciliation.review") &&
              roleActions.includes("approvals.review") &&
              roleActions.includes("documents.files.view")}
            onExit={closeReports} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeReports", closeReports)
    );
  if (financeClaimReviewsOpen && token && actor &&
    ["finance.claims.review", "approvals.review", "documents.files.view"]
      .every(x => roleActions.includes(x)))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeFinanceClaimReviews}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceClaimNativeReviewer token={token}
            onExit={closeFinanceClaimReviews} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeClaimReviews", closeFinanceClaimReviews)
    );
  if (financeClaimsOpen && token && actor &&
    (roleActions.includes("finance.claims.view") || roleActions.includes("finance.claims.create")))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeFinanceClaims}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceExpenseClaimsScreen token={token}
            canView={roleActions.includes("finance.claims.view")}
            canCreate={roleActions.includes("finance.claims.create")}
            canUploadBill={roleActions.includes("finance.claims.create") && roleActions.includes("documents.files.manage") && roleActions.includes("documents.files.view")}
            onExit={closeFinanceClaims} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeClaims", closeFinanceClaims)
    );
  if (financeReviewOpen && token && actor && roleActions.includes("approvals.review") &&
    roleActions.includes("finance.vouchers.view") && roleActions.includes("documents.files.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeFinanceReview}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceVoucherNativeReviewer token={token}
            onExit={closeFinanceReview} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeReviews", closeFinanceReview)
    );
  if (voucherOnlyOpen && token && actor && roleActions.includes("finance.vouchers.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeVouchers}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceVoucherOnlyScreen token={token}
            canManage={roleActions.includes("finance.vouchers.manage")}
            canViewEvidence={roleActions.includes("documents.files.view")}
            canUploadEvidence={roleActions.includes("documents.files.manage") && roleActions.includes("documents.files.view")}
            canPost={roleActions.includes("finance.journals.post")}
            canVerifyPayment={roleActions.includes("approvals.review") && roleActions.includes("documents.files.view")}
            onExit={closeVouchers} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "financeVouchers", closeVouchers)
    );
  if (financeOpen && token && actor && roleActions.includes("finance.accounts.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={closeFinance}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FinanceAccountsScreen token={token} canManage={roleActions.includes("finance.accounts.manage")} canPost={roleActions.includes("finance.journals.post")} canReverse={roleActions.includes("finance.journals.post") && roleActions.includes("approvals.review")} canViewVouchers={roleActions.includes("finance.vouchers.view")} canManageVouchers={roleActions.includes("finance.vouchers.manage")} canViewEvidence={roleActions.includes("documents.files.view")} canUploadEvidence={roleActions.includes("documents.files.manage") && roleActions.includes("documents.files.view")} canVerifyPayment={roleActions.includes("approvals.review") && roleActions.includes("documents.files.view")} onExit={closeFinance} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "finance", closeFinance)
    );
  if (branchesOpen && token && actor) {
    if (!roleActions.includes("foundation.branches.view"))
      return (
        <AccessDeniedScreen
          reason="Branch management is restricted to your Foundation role."
          onMyAccount={() => setBranchesOpen(false)}
        />
      );
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setBranchesOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <BranchRegistrationScreen token={token}
            canManage={roleActions.includes("foundation.branches.manage")}
            canAdmin={roleActions.includes("foundation.branches.admin")}
            onExit={() => setBranchesOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "branches", () => setBranchesOpen(false))
    );
  }
  if (foundationOpen && token && actor) {
    if (!["foundation.profile.view", "foundation.geography.view", "foundation.departments.view"].some(k => roleActions.includes(k)))
      return (
        <AccessDeniedScreen
          reason="Foundation structure is restricted to your authorized Foundation role."
          onMyAccount={() => setFoundationOpen(false)}
        />
      );
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setFoundationOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FoundationStructureScreen token={token}
            roleActions={roleActions}
            onExit={() => setFoundationOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "foundation", () => setFoundationOpen(false))
    );
  }
  if (communicationsOpen && token && actor &&
    roleActions.includes("communications.notifications.view"))
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setCommunicationsOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <SafeAreaView style={{ flex: 1, backgroundColor: careGangaTheme.background }}>
            <RecipientNotifications token={token} makeRequest={communicationRequest}
              onExit={() => setCommunicationsOpen(false)} onExpired={expireSession} />
          </SafeAreaView>
        </Suspense>
      </ScreenErrorBoundary>, "communications", () => setCommunicationsOpen(false))
    );
  if (noticeAdminOpen && token && actor &&
    (roleActions.includes("communications.notices.manage") ||
      roleActions.includes("communications.delivery.process")))
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setNoticeAdminOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FoundationNoticeAdminScreen token={token}
            mayManage={roleActions.includes("communications.notices.manage")}
            mayApprove={roleActions.includes("communications.notices.approve")}
            mayProcess={roleActions.includes("communications.delivery.process")}
            mayViewDelivery={roleActions.includes("communications.delivery.view")}
            maySelectAccounts={roleActions.includes("accounts.select")}
            maySelectRoles={roleActions.includes("roles.select")}
            onExit={() => setNoticeAdminOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "noticeAdmin", () => setNoticeAdminOpen(false))
    );
  if (supportOpen && token && actor) {
    if (!roleActions.includes("support.cases.view") && !roleActions.includes("support.faq.manage"))
      return (
        <AccessDeniedScreen
          reason="Your role does not permit Foundation support."
          onMyAccount={() => setSupportOpen(false)}
        />
      );
    return (
      renderInShell(<ScreenErrorBoundary onExit={() => setSupportOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <FoundationSupportScreen token={token}
            mayView={roleActions.includes("support.cases.view")}
            mayManage={roleActions.includes("support.cases.manage")}
            mayReply={roleActions.includes("support.cases.reply")}
            mayFaq={roleActions.includes("support.faq.manage")}
            mayChooseAccounts={roleActions.includes("accounts.select")}
            onExit={() => setSupportOpen(false)} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>, "support", () => setSupportOpen(false))
    );
  }
  if (policyOpen && token && actor) {
    if (!roleActions.includes("identity.security-policy.manage"))
      return (
        <AccessDeniedScreen
          reason="Security Policy is restricted to the Foundation Super Admin."
          onMyAccount={closePolicy}
        />
      );
    return (
      <ScreenErrorBoundary onExit={closePolicy}>
        <Suspense fallback={<ActivityIndicator style={{ marginTop: 40 }} />}>
          <SecurityPolicyScreen token={token} actor={actor} roleActions={roleActions}
            handlers={handlers} onSignOut={() => void signOut()}
            onExit={closePolicy} onExpired={expireSession} />
        </Suspense>
      </ScreenErrorBoundary>
    );
  }

  if (state === "checking") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AuthAmbientBackground />
        <View style={styles.checkingCenter}>
          <LoginBranding />
          <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 24 }} accessibilityLabel="Verifying saved session" />
        </View>
      </SafeAreaView>
    );
  }

  if (actor && token) {

    return (
      <InternalDashboardScreen
        actor={actor}
        token={token}
        roleActions={roleActions}
        handlers={handlers}
        onSignOut={() => void signOut()}
        onExpired={expireSession}
        message={message}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Deep Navy Glowing Background with Ambient Waves */}
      <AuthAmbientBackground />

      {/* Top-Right Scoped Auth Toast Notification */}
      <AuthToast toast={toast} onDismiss={hideToast} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
        style={styles.keyboardContainer}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={[
            styles.scrollContent,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + 36 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding */}
          <LoginBranding />

          {/* Healthcare Hero Section with Frosted Glass 3-Service Pill Bar */}
          <LoginHeroSection />

          {/* White Login Card */}
          <Animated.View
            style={[
              styles.loginCard,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardAnim }]
              }
            ]}
          >
            {/* Top Centered Lock Badge */}
            <View style={styles.cardLockBadgeWrap}>
              <IconPadlockShieldLarge size={52} />
            </View>

            {/* Heading & Subtitle */}
            <Text accessibilityRole="header" style={styles.cardHeading}>
              Sign in to your Account
            </Text>
            <Text style={styles.cardSubheading}>
              Access your CareGanga account to manage services, records and more.
            </Text>

            {/* Field 1: Mobile Number or Email */}
            <LoginInput
              label="Mobile Number or Email"
              iconType="user"
              placeholder="Enter mobile number or email"
              autoCapitalize="none"
              autoComplete="username"
              keyboardType="default"
              value={email}
              error={loginFieldError === "identifier" || loginFieldError === "all" ? message : null}
              onFocus={() => onFieldFocus("identifier")}
              onChangeText={v => {
                setEmail(v);
                if (loginFieldError) {
                  setLoginFieldError(null);
                  setMessage("");
                }
              }}
            />

            {/* Field 2: Password */}
            <LoginInput
              label="Password"
              iconType="lock"
              isPassword
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              error={loginFieldError === "password" || loginFieldError === "all" ? (loginFieldError === "all" ? true : message) : null}
              hideErrorMessage={loginFieldError === "all"}
              onFocus={() => onFieldFocus("password")}
              onChangeText={v => {
                setPassword(v);
                if (loginFieldError) {
                  setLoginFieldError(null);
                  setMessage("");
                }
              }}
            />

            {/* Options Row: Remember Me & Forgot Password */}
            <View style={styles.optionsRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                accessibilityLabel="Remember me"
                onPress={() => setRememberMe(v => !v)}
                style={styles.rememberBox}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot Password"
                onPress={() => setRecover(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
              </Pressable>
            </View>

            {/* Global Error Banner */}
            {!!message && !loginFieldError && (
              <View style={styles.globalErrorBanner} accessibilityRole="alert">
                <IconAlertCircle size={16} color="#DC2626" />
                <Text style={styles.globalErrorText}>{message}</Text>
              </View>
            )}

            {/* Primary Action Button: Blue-to-Green Gradient CTA */}
            <LoginSubmitButton
              label="Sign In"
              loadingLabel="Signing in..."
              loading={state === "busy"}
              disabled={state === "busy" || !email.trim() || !password}
              onPress={() => void signIn()}
              style={{ marginTop: 6 }}
            />

            {/* Secure Access Footer with Contact Support Link */}
            <SecureAccessFooter
              onContactSupport={() => {
                setMessage("For support, please contact your CareGanga Foundation administrator or email support@careganga.org.");
              }}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#03132B"
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    alignItems: "center"
  },
  checkingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  loginCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8
  },
  cardLockBadgeWrap: {
    alignSelf: "center",
    marginBottom: 8
  },
  cardHeading: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.2
  },
  cardSubheading: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 10
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 16
  },
  rememberBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxChecked: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A"
  },
  checkboxCheckmark: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    marginTop: -1
  },
  rememberText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1E293B"
  },
  forgotPasswordLink: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  globalErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    gap: 8
  },
  globalErrorText: {
    flex: 1,
    fontSize: 12.5,
    color: "#DC2626",
    fontWeight: "600"
  },
  dashboardPage: {
    flex: 1,
    backgroundColor: careGangaTheme.background
  },
  dashboardContent: {
    minHeight: "100%",
    padding: 24,
    gap: 14,
    justifyContent: "center",
    width: "100%",
    maxWidth: 680,
    alignSelf: "center"
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8
  },
  brandImage: {
    width: 48,
    height: 48,
    borderRadius: 24
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: careGangaTheme.sidebar,
    alignItems: "center",
    justifyContent: "center"
  },
  brandLetter: {
    color: careGangaTheme.sidebarText,
    fontWeight: "800",
    fontSize: 16
  },
  brand: {
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.8,
    color: careGangaTheme.sidebar
  },
  brandSub: {
    fontWeight: "700",
    fontSize: 10,
    letterSpacing: 2,
    color: careGangaTheme.mutedText
  },
  title: {
    fontSize: 25,
    fontWeight: "700",
    marginBottom: 8,
    color: careGangaTheme.text
  },
  formCard: {
    gap: 12,
    padding: 20,
    backgroundColor: careGangaTheme.surface,
    borderWidth: 1,
    borderColor: careGangaTheme.border,
    borderRadius: 12
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: careGangaTheme.text
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: careGangaTheme.border,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    padding: 12
  },
  buttonText: {
    fontWeight: "600",
    color: careGangaTheme.text
  },
  primaryButton: {
    backgroundColor: careGangaTheme.primary,
    borderColor: careGangaTheme.primary
  },
  primaryButtonText: {
    color: careGangaTheme.primaryText,
    fontWeight: "700"
  },
  message: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: careGangaTheme.border,
    backgroundColor: careGangaTheme.surface,
    color: careGangaTheme.error
  }
});
