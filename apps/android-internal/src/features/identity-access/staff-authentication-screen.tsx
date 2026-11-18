import { SafeAreaView } from "react-native-safe-area-context";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import { useCallback, useEffect, useState } from "react";
import { RolesScreen } from "./roles-screen";
import { SecurityPolicyScreen } from "./security-policy-screen";
import { AccountsScreen } from "./accounts-screen";
import { ChangePasswordScreen } from "./change-password-screen";
import { RecoveryScreen } from "./recovery-screen";
import { ProposalScreen } from "../registration-approvals/proposal-screen";
import { HealthcareNativeReview } from "../registration-approvals/healthcare-native-review";
import { PrivateCaseEvidenceScreen } from "../documents/private-case-evidence-screen";
import { RecipientNotifications } from "../../../../../packages/native-communications/src/recipient-notifications";
import { NotificationsScreen } from "../communications/notifications-screen";
import { FoundationNoticeAdminScreen } from "../communications/foundation-notice-admin-screen";
import { FoundationSupportScreen } from "../support/foundation-support-screen";
import { BranchRegistrationScreen } from "../foundation-structure/branch-registration-screen";
import { FinanceAccountsScreen } from "../finance-accounting/finance-accounts-screen";
import { FinanceVoucherOnlyScreen } from "../finance-accounting/finance-voucher-only-screen";
import { FinanceVoucherNativeReviewer } from "../finance-accounting/finance-voucher-native-reviewer";
import { FinanceExpenseClaimsScreen } from "../finance-accounting/finance-expense-claims-screen";
import { FinanceClaimNativeReviewer } from "../finance-accounting/finance-claim-native-reviewer";
import { FinanceNativeInvoices } from "../finance-accounting/finance-native-invoices";
import { FinanceNativeBudgets } from "../finance-accounting/finance-native-budgets";
import { FinanceNativeReports } from "../finance-accounting/finance-native-reports";
import { FinanceNativeProtectedReview } from "../finance-accounting/finance-native-protected-review";
import { identityRequest } from "./http-client";
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CG01SessionCreated,CG01SessionView,CG01SignInRequest } from "@careganga/api-contracts";

const STORE_KEY="cg_internal_root_session";
const communicationRequest=(token:string,path:string,opts:RequestInit={})=>
  identityRequest(path,{...opts,headers:{
    Authorization:"Bearer "+token,...(opts.headers as Record<string,string>|undefined)
  }});
async function sessionView(token:string):Promise<CG01SessionView|null>{
  const response=await identityRequest("/api/identity/me",{headers:{Authorization:"Bearer "+token}});
  if(response.status===401)return null;
  if(!response.ok)throw new Error("The session cannot be verified right now.");
  const data:unknown=await response.json();
  if(!data || typeof data!=="object" || !("displayName" in data)
    || !("roleName" in data) || !("scope" in data)
    || typeof data.displayName!=="string"||typeof data.roleName!=="string"||data.scope!=="Foundation")
    throw new Error("Session details could not be verified.");
  return data as CG01SessionView;
}
async function currentRoleActions(token:string):Promise<string[]>{
  const response=await identityRequest("/api/access/effective",{
    headers:{Authorization:"Bearer "+token}
  });
  if(response.status===401)throw new Error("SESSION_EXPIRED");
  if(!response.ok)throw new Error("Permissions cannot be verified right now.");
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||!("actions" in data)||
     !Array.isArray(data.actions)||
     !data.actions.every((a:unknown)=>a!==null&&typeof a==="object"&&
       "key" in a&&typeof (a as {key:unknown}).key==="string"))
    throw new Error("Permissions cannot be verified right now.");
  return data.actions.map((a:{key:string})=>a.key);
}
export function StaffAuthenticationScreen(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [token,setToken]=useState<string|null>(null);
  const [actor,setActor]=useState<CG01SessionView|null>(null);
  const [state,setState]=useState<"checking"|"idle"|"busy">("checking");
  const [message,setMessage]=useState("");
  const [loginFieldError,setLoginFieldError]=useState<"identifier"|"password"|null>(null);
  const [recover,setRecover]=useState(false);
  const [changePasswordOpen,setChangePasswordOpen]=useState(false);
  const [accountsOpen,setAccountsOpen]=useState(false);
  const [rolesOpen,setRolesOpen]=useState(false);
  const [policyOpen,setPolicyOpen]=useState(false);
  const [approvalsOpen,setApprovalsOpen]=useState(false);
  const [healthReviewsOpen,setHealthReviewsOpen]=useState(false);
  const [documentsOpen,setDocumentsOpen]=useState(false);
  const [branchesOpen,setBranchesOpen]=useState(false);
  const [financeOpen,setFinanceOpen]=useState(false);
  const [voucherOnlyOpen,setVoucherOnlyOpen]=useState(false);
  const [financeReviewOpen,setFinanceReviewOpen]=useState(false);
  const [financeClaimsOpen,setFinanceClaimsOpen]=useState(false);
  const [financeClaimReviewsOpen,setFinanceClaimReviewsOpen]=useState(false);
  const [invoiceOpen,setInvoiceOpen]=useState(false);
  const [invoiceReviewOpen,setInvoiceReviewOpen]=useState(false);
  const [budgetOpen,setBudgetOpen]=useState(false);
  const [budgetReviewOpen,setBudgetReviewOpen]=useState(false);
  const [reportsOpen,setReportsOpen]=useState(false);
  const [communicationsOpen,setCommunicationsOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [supportOpen,setSupportOpen]=useState(false);
  const [noticeAdminOpen,setNoticeAdminOpen]=useState(false);
  const [roleActions,setRoleActions]=useState<string[]>([]);
  const closeRoles=useCallback(()=>setRolesOpen(false),[]);
  const closeHealthReviews=useCallback(()=>setHealthReviewsOpen(false),[]);
  const closePolicy=useCallback(()=>setPolicyOpen(false),[]);
  const closeAccounts=useCallback(()=>setAccountsOpen(false),[]);
  const closeFinance=useCallback(()=>setFinanceOpen(false),[]);
  const closeVouchers=useCallback(()=>setVoucherOnlyOpen(false),[]);
  const closeFinanceReview=useCallback(()=>setFinanceReviewOpen(false),[]);
  const closeFinanceClaims=useCallback(()=>setFinanceClaimsOpen(false),[]);
  const closeFinanceClaimReviews=useCallback(()=>setFinanceClaimReviewsOpen(false),[]);
  const closeInvoices=useCallback(()=>setInvoiceOpen(false),[]);
  const closeInvoiceReviews=useCallback(()=>setInvoiceReviewOpen(false),[]);
  const closeBudgets=useCallback(()=>setBudgetOpen(false),[]);
  const closeBudgetReviews=useCallback(()=>setBudgetReviewOpen(false),[]);
  const closeReports=useCallback(()=>setReportsOpen(false),[]);
  const expireSession=useCallback(()=>{
    setActor(null);setToken(null);setRoleActions([]);setRolesOpen(false);setAccountsOpen(false);setPolicyOpen(false);setApprovalsOpen(false);setHealthReviewsOpen(false);setDocumentsOpen(false);setCommunicationsOpen(false);setNotificationsOpen(false);setSupportOpen(false);setNoticeAdminOpen(false);setBranchesOpen(false);setFinanceOpen(false);setVoucherOnlyOpen(false);setFinanceReviewOpen(false);setFinanceClaimsOpen(false);setFinanceClaimReviewsOpen(false);setInvoiceOpen(false);setInvoiceReviewOpen(false);
    setBudgetOpen(false);setBudgetReviewOpen(false);setReportsOpen(false);
    void SecureStore.deleteItemAsync(STORE_KEY).catch(()=>undefined);
  },[]);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try {
        const stored=await SecureStore.getItemAsync(STORE_KEY);
        if(!stored){if(active)setState("idle");return;}
        const verified=await sessionView(stored);
        if(!active)return;
        if(!verified){await SecureStore.deleteItemAsync(STORE_KEY);setActor(null);setToken(null);}
        else {
          const actions=await currentRoleActions(stored);
          if(active){setRoleActions(actions);setToken(stored);setActor(verified);}
        }
      } catch {
        if(active)setMessage("Access cannot be verified right now. Protected information remains hidden.");
      }finally{if(active)setState("idle");}
    })();
    return()=>{active=false;};
  },[]);

  // Event-driven authorization check on resume, without background polling.
  useEffect(()=>{
    if(!token)return;
    let active=true;
    const subscription=AppState.addEventListener("change",state=>{
      if(state!=="active")return;
      setState("checking");setActor(null);setRoleActions([]);
      void (async()=>{
        try{
          const fresh=await sessionView(token);
          if(!active)return;
          if(!fresh){expireSession();}
          else {const actions=await currentRoleActions(token);if(active){setRoleActions(actions);setActor(fresh);}}
        }catch{
          if(active){setActor(null);setMessage("Access cannot be verified. Protected information remains hidden.");}
        }finally{
          if(active)setState("idle");
        }
      })();
    });
    return()=>{active=false;subscription.remove();};
  },[token,expireSession]);
  async function signIn(){
    if(state==="busy")return;
    setState("busy");setMessage("");setLoginFieldError(null);
    const request:CG01SignInRequest={identifier:email.trim(),password,deviceLabel:"Internal Android"};
    let issuedToken:string|null=null;
    try{
      const response=await identityRequest("/api/identity/login",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)
      });
      if(!response.ok){
        const payload:unknown=[400,401].includes(response.status)?
          await response.json().catch(()=>null):null;
        const data=payload&&typeof payload==="object"&&!Array.isArray(payload)?
          payload as Record<string,unknown>:{};
        const codes=new Set(["IDENTITY_IDENTIFIER_REQUIRED","IDENTITY_IDENTIFIER_INVALID",
          "IDENTITY_PASSWORD_REQUIRED","IDENTITY_PASSWORD_TOO_LONG"]);
        const isSafe=(response.status===400&&typeof data.code==="string"&&codes.has(data.code))||
          (response.status===401&&data.code==="IDENTITY_LOGIN_INVALID");
        const field=isSafe&&(data.field==="identifier"||data.field==="password")?data.field:null;
        setLoginFieldError(field);
        setMessage(isSafe&&typeof data.message==="string"&&data.message.length>=16&&
          data.message.length<=220?
          data.message:response.status===429?"Too many login attempts. Please try later.":
          response.status===401?"Mobile number/email or password is incorrect.":
          response.status===400?"Check your mobile/email and password details.":
          "Sign-in could not be confirmed. Check your connection and retry.");
        return;
      }
      const data:CG01SessionCreated=await response.json();
      if(typeof data.sessionToken!=="string"||typeof data.expiresAt!=="string"||
        !Number.isFinite(new Date(data.expiresAt).getTime())||
        new Date(data.expiresAt).getTime()<=Date.now())throw new Error("Sign-in confirmation is unavailable.");
      issuedToken=data.sessionToken;
      const verified=await sessionView(issuedToken);
      if(!verified)throw new Error("The new session could not be confirmed.");
      // Don't persist or show a session until BOTH identity and effective access
      // are verified, so offline/invalid permission reads cannot look like success.
      const actions=await currentRoleActions(issuedToken);
      await SecureStore.setItemAsync(STORE_KEY,issuedToken);
      setRoleActions(actions);setToken(issuedToken);setActor(verified);setPassword("");
    }catch{
      setRoleActions([]);setActor(null);setToken(null);
      // If a session was issued but later bootstrap steps failed, avoid leaving a
      // needless server-side session alive. This is best effort, not a claimed logout.
      if(issuedToken){
        try{await identityRequest("/api/identity/logout",{
          method:"POST",headers:{Authorization:"Bearer "+issuedToken}
        });}catch{/* eventual server expiry still applies */}
        try{await SecureStore.deleteItemAsync(STORE_KEY);}catch{/* no sign-in displayed */}
      }
      setMessage("Could not confirm sign-in. Check your connection and try again.");
    }finally{setState("idle");}
  }
  async function signOut(){
    if(state==="busy"||!token)return;
    setState("busy");setMessage("");
    try{
      const response=await identityRequest("/api/identity/logout",{
        method:"POST",headers:{Authorization:"Bearer "+token}
      });
      if(!response.ok)throw new Error("Server revocation not confirmed");
      // Backend revocation is authoritative. The UI must not continue showing an
      // authenticated actor if on-device deletion fails afterward.
      setActor(null);setToken(null);setRoleActions([]);setRolesOpen(false);setAccountsOpen(false);setPolicyOpen(false);setApprovalsOpen(false);setHealthReviewsOpen(false);setDocumentsOpen(false);setCommunicationsOpen(false);setNotificationsOpen(false);setSupportOpen(false);setNoticeAdminOpen(false);setBranchesOpen(false);setFinanceOpen(false);setVoucherOnlyOpen(false);
      try{
        await SecureStore.deleteItemAsync(STORE_KEY);
      }catch{
        setMessage("Signed out. Local session cleanup could not be confirmed and will be retried.");
      }
    }catch{setMessage("Sign-out could not be confirmed. Please retry.");}
    finally{setState("idle");}
  }
  if(recover) return <RecoveryScreen onExit={()=>setRecover(false)}/>;
  if(changePasswordOpen&&token&&actor)return <ChangePasswordScreen token={token}
    onExit={()=>setChangePasswordOpen(false)} onExpired={expireSession}
    onChanged={()=>{expireSession();setChangePasswordOpen(false);
      setMessage("Password changed. Sign in again.");}}/>;
  if(accountsOpen&&token&&actor)return <AccountsScreen token={token} onExit={closeAccounts} onExpired={expireSession}
    createOnly={!roleActions.includes("accounts.view")}/>;
  if(rolesOpen&&token&&actor)return <RolesScreen token={token} onExit={closeRoles} onExpired={expireSession}/>;
  if(approvalsOpen&&token&&actor&&(roleActions.includes("approvals.view")||roleActions.includes("approvals.propose")))
    return <ProposalScreen token={token} canConfigure={roleActions.includes("approvals.process.manage")}
      canPropose={roleActions.includes("approvals.propose")}
      canReview={roleActions.includes("approvals.review")}
      onExit={()=>setApprovalsOpen(false)} onExpired={expireSession}/>;
  if(healthReviewsOpen&&token&&actor&&roleActions.includes("approvals.review")&&
    (roleActions.includes("health.doctors.verify")||
      roleActions.includes("health.providers.verify")))
    return <HealthcareNativeReview token={token}
      canDoctors={roleActions.includes("health.doctors.verify")}
      canProviders={roleActions.includes("health.providers.verify")}
      canManageDoctors={roleActions.includes("health.doctors.manage")}
      canManageProviders={roleActions.includes("health.providers.manage")}
      onExit={closeHealthReviews} onExpired={expireSession}/>;
  if(notificationsOpen&&token&&actor&&
    roleActions.includes("communications.notifications.view"))
    return <NotificationsScreen token={token}
      onExit={()=>setNotificationsOpen(false)} onExpired={expireSession}/>;
  if(documentsOpen&&token&&actor&&
    roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")&&
    (roleActions.includes("approvals.view")||roleActions.includes("approvals.propose")))
    return <PrivateCaseEvidenceScreen token={token}
      canViewLetters={roleActions.includes("documents.letters.issue")}
      onExit={()=>setDocumentsOpen(false)} onExpired={expireSession}/>;
  if(invoiceReviewOpen&&token&&actor&&
    roleActions.includes("approvals.review")&&roleActions.includes("finance.invoices.review"))
    return <FinanceNativeProtectedReview token={token} kind="INVOICE"
      canConfigure={roleActions.includes("approvals.process.manage")}
      onExit={closeInvoiceReviews} onExpired={expireSession}/>;
  if(budgetReviewOpen&&token&&actor&&
    roleActions.includes("approvals.review")&&roleActions.includes("finance.budgets.review"))
    return <FinanceNativeProtectedReview token={token} kind="BUDGET"
      canConfigure={roleActions.includes("approvals.process.manage")}
      onExit={closeBudgetReviews} onExpired={expireSession}/>;
  if(invoiceOpen&&token&&actor&&
    roleActions.includes("finance.invoices.view"))
    return <FinanceNativeInvoices token={token}
      canManage={roleActions.includes("finance.invoices.manage")}
      canIssue={roleActions.includes("finance.invoices.issue")}
      canPost={roleActions.includes("finance.journals.post")}
      canCancel={roleActions.includes("finance.invoices.review")&&
       roleActions.includes("finance.journals.post")&&roleActions.includes("approvals.review")}
      onExit={closeInvoices} onExpired={expireSession}/>;
  if(budgetOpen&&token&&actor&&
    roleActions.includes("finance.budgets.view"))
    return <FinanceNativeBudgets token={token}
      canManage={roleActions.includes("finance.budgets.manage")}
      onExit={closeBudgets} onExpired={expireSession}/>;
  if(reportsOpen&&token&&actor&&roleActions.includes("finance.reports.view"))
    return <FinanceNativeReports token={token}
      canReconcile={roleActions.includes("finance.reconciliation.manage")&&roleActions.includes("documents.files.manage")}
      canUploadStatement={roleActions.includes("finance.reconciliation.manage")&&
        roleActions.includes("documents.files.manage")}
      canReview={roleActions.includes("finance.reconciliation.review")&&
        roleActions.includes("approvals.review")&&
        roleActions.includes("documents.files.view")}
      onExit={closeReports} onExpired={expireSession}/>;
  if(financeClaimReviewsOpen&&token&&actor&&
    ["finance.claims.review","approvals.review","documents.files.view"]
      .every(x=>roleActions.includes(x)))
    return <FinanceClaimNativeReviewer token={token}
      onExit={closeFinanceClaimReviews} onExpired={expireSession}/>;
  if(financeClaimsOpen&&token&&actor&&
    (roleActions.includes("finance.claims.view")||roleActions.includes("finance.claims.create")))
    return <FinanceExpenseClaimsScreen token={token}
      canView={roleActions.includes("finance.claims.view")}
      canCreate={roleActions.includes("finance.claims.create")}
      canUploadBill={roleActions.includes("finance.claims.create")&&roleActions.includes("documents.files.manage")&&roleActions.includes("documents.files.view")}
      onExit={closeFinanceClaims} onExpired={expireSession}/>;
  if(financeReviewOpen&&token&&actor&&roleActions.includes("approvals.review")&&
    roleActions.includes("finance.vouchers.view")&&roleActions.includes("documents.files.view"))
    return <FinanceVoucherNativeReviewer token={token}
      onExit={closeFinanceReview} onExpired={expireSession}/>;
  if(voucherOnlyOpen&&token&&actor&&roleActions.includes("finance.vouchers.view"))
    return <FinanceVoucherOnlyScreen token={token}
      canManage={roleActions.includes("finance.vouchers.manage")}
      canViewEvidence={roleActions.includes("documents.files.view")}
      canUploadEvidence={roleActions.includes("documents.files.manage")&&roleActions.includes("documents.files.view")}
      canPost={roleActions.includes("finance.journals.post")}
      canVerifyPayment={roleActions.includes("approvals.review")&&roleActions.includes("documents.files.view")}
      onExit={closeVouchers} onExpired={expireSession}/>;
  if(financeOpen&&token&&actor&&roleActions.includes("finance.accounts.view"))
    return <FinanceAccountsScreen token={token} canManage={roleActions.includes("finance.accounts.manage")} canPost={roleActions.includes("finance.journals.post")} canReverse={roleActions.includes("finance.journals.post")&&roleActions.includes("approvals.review")} canViewVouchers={roleActions.includes("finance.vouchers.view")} canManageVouchers={roleActions.includes("finance.vouchers.manage")} canViewEvidence={roleActions.includes("documents.files.view")} canUploadEvidence={roleActions.includes("documents.files.manage")&&roleActions.includes("documents.files.view")} canVerifyPayment={roleActions.includes("approvals.review")&&roleActions.includes("documents.files.view")} onExit={closeFinance} onExpired={expireSession}/>;
  if(branchesOpen&&token&&actor&&roleActions.includes("foundation.branches.view"))
    return <BranchRegistrationScreen token={token}
      canManage={roleActions.includes("foundation.branches.manage")}
      onExit={()=>setBranchesOpen(false)} onExpired={expireSession}/>;
  if(communicationsOpen&&token&&actor&&
    roleActions.includes("communications.notifications.view"))
    return <SafeAreaView style={{flex:1,backgroundColor:careGangaTheme.background}}>
      <RecipientNotifications token={token} makeRequest={communicationRequest}
        onExit={()=>setCommunicationsOpen(false)} onExpired={expireSession}/>
    </SafeAreaView>;
  if(noticeAdminOpen&&token&&actor&&
    (roleActions.includes("communications.notices.manage")||
      roleActions.includes("communications.delivery.process")))
    return <FoundationNoticeAdminScreen token={token}
      mayManage={roleActions.includes("communications.notices.manage")}
      mayApprove={roleActions.includes("communications.notices.approve")}
      mayProcess={roleActions.includes("communications.delivery.process")}
      mayViewDelivery={roleActions.includes("communications.delivery.view")}
      maySelectAccounts={roleActions.includes("accounts.select")}
      maySelectRoles={roleActions.includes("roles.select")}
      onExit={()=>setNoticeAdminOpen(false)} onExpired={expireSession}/>;
  if(supportOpen&&token&&actor&&
    (roleActions.includes("support.cases.view")||
      roleActions.includes("support.faq.manage")))
    return <FoundationSupportScreen token={token}
      mayView={roleActions.includes("support.cases.view")}
      mayManage={roleActions.includes("support.cases.manage")}
      mayReply={roleActions.includes("support.cases.reply")}
      mayFaq={roleActions.includes("support.faq.manage")}
      mayChooseAccounts={roleActions.includes("accounts.select")}
      onExit={()=>setSupportOpen(false)} onExpired={expireSession}/>;
  if(policyOpen&&token&&actor&&roleActions.includes("identity.security-policy.manage"))
    return <SecurityPolicyScreen token={token} onExit={closePolicy} onExpired={expireSession}/>;
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.page}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.brandBar}><Image source={require("../../../assets/careganga-mark.png")} accessibilityLabel="CareGanga Foundation" style={styles.brandImage}/><View><Text style={styles.brand}>CAREGANGA</Text><Text style={styles.brandSub}>FOUNDATION</Text></View></View>
        <Text accessibilityRole="header" style={styles.title}>Foundation staff access</Text>
        {state==="checking"?<ActivityIndicator accessibilityLabel="Verifying saved session"/>:actor?
          <View style={styles.formCard}>
            <Text accessibilityRole="header" style={styles.cardTitle}>Signed in: {actor.displayName}</Text>
            <Text>Role: {actor.roleName}</Text>
            <Text>Access: {actor.scope}</Text>
            {(roleActions.includes("accounts.view")||(roleActions.includes("accounts.create")&&roleActions.includes("roles.assign")))&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setAccountsOpen(true)}>
              <Text style={styles.buttonText}>Users Management</Text>
            </Pressable>}
            {roleActions.includes("roles.view")&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setRolesOpen(true)}><Text style={styles.buttonText}>Roles & permissions</Text></Pressable>}
            {roleActions.includes("identity.security-policy.manage")&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setPolicyOpen(true)}>
              <Text style={styles.buttonText}>Security Policy</Text>
            </Pressable>}
            {(roleActions.includes("approvals.view")||roleActions.includes("approvals.propose"))&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setApprovalsOpen(true)}>
                <Text style={styles.buttonText}>Registration & Approval</Text>
              </Pressable>}
            {roleActions.includes("approvals.review")&&
              (roleActions.includes("health.doctors.verify")||
               roleActions.includes("health.providers.verify"))&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setHealthReviewsOpen(true)}>
                <Text style={styles.buttonText}>Healthcare Verification Reviews</Text>
              </Pressable>}
            {roleActions.includes("documents.files.view")&&
              roleActions.includes("documents.files.manage")&&
              (roleActions.includes("approvals.view")||roleActions.includes("approvals.propose"))&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setDocumentsOpen(true)}>
                <Text style={styles.buttonText}>Private Case Documents</Text>
              </Pressable>}
            {roleActions.includes("communications.notifications.view")&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setNotificationsOpen(true)}>
                <Text style={styles.buttonText}>My Notices & Notifications</Text>
              </Pressable>}
            {roleActions.includes("communications.notifications.view")&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setCommunicationsOpen(true)}>
                <Text style={styles.buttonText}>My Foundation notices</Text>
              </Pressable>}
            {(roleActions.includes("communications.notices.manage")||
              roleActions.includes("communications.delivery.process"))&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setNoticeAdminOpen(true)}>
                <Text style={styles.buttonText}>Manage Foundation notices</Text>
              </Pressable>}
            {(roleActions.includes("support.cases.view")||
              roleActions.includes("support.faq.manage"))&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setSupportOpen(true)}>
                <Text style={styles.buttonText}>Contact Messages & Help</Text>
              </Pressable>}
            {roleActions.includes("approvals.review")&&
               roleActions.includes("finance.vouchers.view")&&roleActions.includes("documents.files.view")&&
               <Pressable accessibilityRole="button" style={styles.button}
                 onPress={()=>setFinanceReviewOpen(true)}>
                 <Text style={styles.buttonText}>Finance Voucher Reviews</Text>
               </Pressable>}
            {roleActions.includes("finance.vouchers.view")&&
               !roleActions.includes("finance.accounts.view")&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setVoucherOnlyOpen(true)}>
              <Text style={styles.buttonText}>Finance Voucher Drafts</Text>
            </Pressable>}
            {["finance.claims.review","approvals.review","documents.files.view"]
               .every(x=>roleActions.includes(x))&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setFinanceClaimReviewsOpen(true)}>
               <Text style={styles.buttonText}>Expense Claim Reviews</Text>
              </Pressable>}
            {(roleActions.includes("finance.claims.view")||
               roleActions.includes("finance.claims.create"))&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setFinanceClaimsOpen(true)}>
               <Text style={styles.buttonText}>Expense Claims</Text>
              </Pressable>}
            {roleActions.includes("finance.invoices.view")&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setInvoiceOpen(true)}>
               <Text style={styles.buttonText}>Invoices & Receipts</Text></Pressable>}
            {roleActions.includes("finance.invoices.review")&&roleActions.includes("approvals.review")&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setInvoiceReviewOpen(true)}>
               <Text style={styles.buttonText}>Protected Invoice Reviews</Text></Pressable>}
            {roleActions.includes("finance.budgets.view")&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setBudgetOpen(true)}>
               <Text style={styles.buttonText}>Foundation Budgets</Text></Pressable>}
            {roleActions.includes("finance.budgets.review")&&roleActions.includes("approvals.review")&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setBudgetReviewOpen(true)}>
               <Text style={styles.buttonText}>Protected Budget Reviews</Text></Pressable>}
            {roleActions.includes("finance.reports.view")&&
              <Pressable accessibilityRole="button" style={styles.button}
               onPress={()=>setReportsOpen(true)}>
               <Text style={styles.buttonText}>Finance Ledger & Reports</Text></Pressable>}
            {roleActions.includes("finance.accounts.view")&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setFinanceOpen(true)}>
              <Text style={styles.buttonText}>Finance Accounts & Years</Text>
            </Pressable>}
            {roleActions.includes("foundation.branches.view")&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setBranchesOpen(true)}>
              <Text style={styles.buttonText}>Branches & registration</Text>
            </Pressable>}
            <Pressable accessibilityRole="button" style={styles.button}
              onPress={()=>setChangePasswordOpen(true)}>
              <Text style={styles.buttonText}>Change password</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={state==="busy"} onPress={()=>void signOut()} style={styles.button}>
              <Text style={styles.buttonText}>Sign out</Text>
            </Pressable>
          </View>:
          <View style={styles.formCard}>
            <Text style={styles.helper}>Sign in with your registered mobile number or email.</Text>
            <Text style={styles.label}>Mobile number or email</Text>
            <TextInput accessibilityLabel="Mobile number or email" autoCapitalize="none" autoComplete="username" keyboardType="default" value={email} onChangeText={v=>{setEmail(v);if(loginFieldError==="identifier"){setLoginFieldError(null);setMessage("");}}} style={[styles.input,loginFieldError==="identifier"&&styles.invalidInput]}/>
            {loginFieldError==="identifier"&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
            <Text style={styles.label}>Password</Text>
            <TextInput accessibilityLabel="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={v=>{setPassword(v);if(loginFieldError==="password"){setLoginFieldError(null);setMessage("");}}} style={[styles.input,loginFieldError==="password"&&styles.invalidInput]}/>
            {loginFieldError==="password"&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
            <Pressable accessibilityRole="button" disabled={state==="busy"||!email.trim()||!password} onPress={()=>void signIn()} style={[styles.button,styles.primaryButton]}>
              <Text style={styles.primaryButtonText}>{state==="busy"?"Verifying…":"Sign in"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>setRecover(true)} style={styles.button}>
              <Text style={styles.buttonText}>Recover account</Text>
            </Pressable>
          </View>}
        {!!message&&!loginFieldError&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  invalidInput:{borderColor:careGangaTheme.error},
  page:{flex:1,backgroundColor:careGangaTheme.background},
  content:{minHeight:"100%",padding:24,gap:14,justifyContent:"center",width:"100%",maxWidth:680,alignSelf:"center"},
  brandBar:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:8},
  brandImage:{width:48,height:48,borderRadius:24},
  brandMark:{width:46,height:46,borderRadius:23,backgroundColor:careGangaTheme.sidebar,alignItems:"center",justifyContent:"center"},
  brandLetter:{color:careGangaTheme.sidebarText,fontWeight:"800",fontSize:16},
  brand:{fontWeight:"800",fontSize:18,letterSpacing:.8,color:careGangaTheme.sidebar},
  brandSub:{fontWeight:"700",fontSize:10,letterSpacing:2,color:careGangaTheme.mutedText},
  title:{fontSize:25,fontWeight:"700",marginBottom:8,color:careGangaTheme.text},
  formCard:{gap:12,padding:20,backgroundColor:careGangaTheme.surface,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:12},
  cardTitle:{fontSize:18,fontWeight:"700",color:careGangaTheme.text},
  helper:{fontSize:14,color:careGangaTheme.mutedText},
  label:{fontWeight:"600",color:careGangaTheme.text},
  input:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:7,paddingHorizontal:12,backgroundColor:careGangaTheme.surface,color:careGangaTheme.text},
  button:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:7,justifyContent:"center",alignItems:"center",padding:12},
  buttonText:{fontWeight:"600",color:careGangaTheme.text},
  primaryButton:{backgroundColor:careGangaTheme.primary,borderColor:careGangaTheme.primary},
  primaryButtonText:{color:careGangaTheme.primaryText,fontWeight:"700"},
  message:{marginTop:10,padding:10,borderWidth:1,borderColor:careGangaTheme.border,backgroundColor:careGangaTheme.surface,color:careGangaTheme.error}
});
