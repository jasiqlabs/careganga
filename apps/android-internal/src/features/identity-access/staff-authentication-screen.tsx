import { SafeAreaView } from "react-native-safe-area-context";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import { useCallback, useEffect, useState } from "react";
import { RolesScreen } from "./roles-screen";
import { SecurityPolicyScreen } from "./security-policy-screen";
import { AccountsScreen } from "./accounts-screen";
import { InvitationActivationScreen } from "./invitation-activation-screen";
import { RecoveryScreen } from "./recovery-screen";
import { ProposalScreen } from "../registration-approvals/proposal-screen";
import { PrivateCaseEvidenceScreen } from "../documents/private-case-evidence-screen";
import { BranchRegistrationScreen } from "../foundation-structure/branch-registration-screen";
import { identityRequest } from "./http-client";
import { ActivityIndicator, AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CG01SessionCreated,CG01SessionView,CG01SignInRequest } from "@careganga/api-contracts";

const STORE_KEY="cg_internal_root_session";
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
     !data.actions.every((a:unknown)=>Boolean(a)&&typeof a==="object"&&
       "key" in a&&typeof a.key==="string"))
    throw new Error("Permissions cannot be verified right now.");
  return data.actions.map((a:{key:string})=>a.key);
}
export function StaffAuthenticationScreen(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [token,setToken]=useState<string|null>(null);
  const [actor,setActor]=useState<CG01SessionView|null>(null);
  const [state,setState]=useState<"checking"|"idle"|"busy">("checking");
  const [message,setMessage]=useState("");
  const [recover,setRecover]=useState(false);
  const [activate,setActivate]=useState(false);
  const [accountsOpen,setAccountsOpen]=useState(false);
  const [rolesOpen,setRolesOpen]=useState(false);
  const [policyOpen,setPolicyOpen]=useState(false);
  const [approvalsOpen,setApprovalsOpen]=useState(false);
  const [documentsOpen,setDocumentsOpen]=useState(false);
  const [branchesOpen,setBranchesOpen]=useState(false);
  const [roleActions,setRoleActions]=useState<string[]>([]);
  const closeRoles=useCallback(()=>setRolesOpen(false),[]);
  const closePolicy=useCallback(()=>setPolicyOpen(false),[]);
  const closeAccounts=useCallback(()=>setAccountsOpen(false),[]);
  const expireSession=useCallback(()=>{
    setActor(null);setToken(null);setRoleActions([]);setRolesOpen(false);setAccountsOpen(false);setPolicyOpen(false);setApprovalsOpen(false);setDocumentsOpen(false);setBranchesOpen(false);
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
    setState("busy");setMessage("");
    const request:CG01SignInRequest={email,password,totp,deviceLabel:"Internal Android"};
    let issuedToken:string|null=null;
    try{
      const response=await identityRequest("/api/identity/login",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)
      });
      if(!response.ok){
        setMessage(response.status===429?"Too many attempts. Please try later.":response.status===401?"Account or verification code could not be confirmed.":"Sign-in unavailable. Please try again.");
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
      setRoleActions(actions);setToken(issuedToken);setActor(verified);setPassword("");setTotp("");
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
      setActor(null);setToken(null);setRoleActions([]);setRolesOpen(false);setAccountsOpen(false);setPolicyOpen(false);setApprovalsOpen(false);setDocumentsOpen(false);setBranchesOpen(false);
      try{
        await SecureStore.deleteItemAsync(STORE_KEY);
      }catch{
        setMessage("Signed out. Local session cleanup could not be confirmed and will be retried.");
      }
    }catch{setMessage("Sign-out could not be confirmed. Please retry.");}
    finally{setState("idle");}
  }
  if(recover) return <RecoveryScreen onExit={()=>setRecover(false)}/>;
  if(activate) return <InvitationActivationScreen onExit={()=>setActivate(false)}/>;
  if(accountsOpen&&token&&actor)return <AccountsScreen token={token} onExit={closeAccounts} onExpired={expireSession}
    inviteOnly={!roleActions.includes("accounts.view")}/>;
  if(rolesOpen&&token&&actor)return <RolesScreen token={token} onExit={closeRoles} onExpired={expireSession}/>;
  if(approvalsOpen&&token&&actor&&(roleActions.includes("approvals.view")||roleActions.includes("approvals.propose")))
    return <ProposalScreen token={token} canConfigure={roleActions.includes("approvals.process.manage")}
      canPropose={roleActions.includes("approvals.propose")}
      onExit={()=>setApprovalsOpen(false)} onExpired={expireSession}/>;
  if(documentsOpen&&token&&actor&&
    roleActions.includes("documents.files.view")&&roleActions.includes("documents.files.manage")&&
    (roleActions.includes("approvals.view")||roleActions.includes("approvals.propose")))
    return <PrivateCaseEvidenceScreen token={token}
      canViewLetters={roleActions.includes("documents.letters.issue")}
      onExit={()=>setDocumentsOpen(false)} onExpired={expireSession}/>;
  if(branchesOpen&&token&&actor&&roleActions.includes("foundation.branches.view"))
    return <BranchRegistrationScreen token={token} canManage={roleActions.includes("foundation.branches.manage")}
      onExit={()=>setBranchesOpen(false)} onExpired={expireSession}/>;
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
            {(roleActions.includes("accounts.view")||(roleActions.includes("accounts.invite")&&roleActions.includes("roles.assign")))&&<Pressable accessibilityRole="button"
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
            {roleActions.includes("documents.files.view")&&
              roleActions.includes("documents.files.manage")&&
              (roleActions.includes("approvals.view")||roleActions.includes("approvals.propose"))&&
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>setDocumentsOpen(true)}>
                <Text style={styles.buttonText}>Private Case Documents</Text>
              </Pressable>}
            {roleActions.includes("foundation.branches.view")&&<Pressable accessibilityRole="button"
              style={styles.button} onPress={()=>setBranchesOpen(true)}>
              <Text style={styles.buttonText}>Branches & registration</Text>
            </Pressable>}
            <Pressable accessibilityRole="button" disabled={state==="busy"} onPress={()=>void signOut()} style={styles.button}>
              <Text style={styles.buttonText}>Sign out</Text>
            </Pressable>
          </View>:
          <View style={styles.formCard}>
            <Text style={styles.helper}>Use your work account and current authenticator code.</Text>
            <Text style={styles.label}>Work email</Text>
            <TextInput accessibilityLabel="Work email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input}/>
            <Text style={styles.label}>Password</Text>
            <TextInput accessibilityLabel="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} style={styles.input}/>
            <Text style={styles.label}>Authenticator code</Text>
            <TextInput accessibilityLabel="Authenticator code" inputMode="numeric" maxLength={6} value={totp} onChangeText={x=>setTotp(x.replace(/\D/g,""))} style={styles.input}/>
            <Pressable accessibilityRole="button" disabled={state==="busy"||!email||!password||totp.length!==6} onPress={()=>void signIn()} style={[styles.button,styles.primaryButton]}>
              <Text style={styles.primaryButtonText}>{state==="busy"?"Verifying…":"Sign in"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>setRecover(true)} style={styles.button}>
              <Text style={styles.buttonText}>Recover account</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>setActivate(true)} style={styles.button}>
              <Text style={styles.buttonText}>Accept staff invitation</Text>
            </Pressable>
          </View>}
        {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
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
