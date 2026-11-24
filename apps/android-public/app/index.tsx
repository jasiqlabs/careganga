import React, { Component, Suspense, lazy, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, AppState, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { careGangaPublicTheme as theme } from "../../../packages/design-tokens/src/index";
import { PublicCmsContent } from "../src/features/cms/public-cms-screen";
import {NativePublicDonation} from "../src/features/cms/native-public-donation";
import {PublicPartnerApplication} from "../src/features/health-network/public-partner-application";

const RecipientNotifications = lazy(() => import("../../../packages/native-communications/src/recipient-notifications").then(m => ({ default: m.RecipientNotifications })));
const FoundationContactScreen = lazy(() => import("../src/features/support/foundation-contact-screen").then(m => ({ default: m.FoundationContactScreen })));
const PublicHealthcareDirectory = lazy(() => import("../src/features/health-network/public-healthcare-directory").then(m => ({ default: m.PublicHealthcareDirectory })));
const PatientProfileNative = lazy(() => import("../src/features/patients/patient-profile-native").then(m => ({ default: m.PatientProfileNative })));
const NativeMemberSelf = lazy(() => import("../src/features/membership/native-member-self").then(m => ({ default: m.NativeMemberSelf })));
const NativeVolunteerSelf = lazy(() => import("../src/features/volunteers/native-volunteer-self").then(m => ({ default: m.NativeVolunteerSelf })));

class PublicScreenErrorBoundary extends Component<
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
        <SafeAreaView style={styles.page}>
          <View style={styles.content}>
            <Text accessibilityRole="alert" style={styles.alert}>{this.state.error}</Text>
            <Pressable accessibilityRole="button" style={styles.button} onPress={() => {
              this.setState({ error: null });
              this.props.onExit();
            }}>
              <Text>Back to CareGanga Foundation</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const KEY = "cg_public_own_notice_session";
const base = process.env.EXPO_PUBLIC_API_URL;

function resolvePublicEndpoint(path: string): string {
  if (!base) throw new Error("UNAVAILABLE");
  let resolvedBase = base;
  if (Platform.OS === "android" && (resolvedBase.startsWith("http://localhost:") || resolvedBase.startsWith("http://127.0.0.1:"))) {
    resolvedBase = resolvedBase.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
  }
  return new URL(path, resolvedBase).toString();
}

async function nativeRequest(_token: string, path: string, opts: RequestInit = {}): Promise<Response> {
  if (!base || !/^https?:\/\//.test(base) ||
    (process.env.NODE_ENV === "production" && !base.startsWith("https://")))
    throw new Error("UNAVAILABLE");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(resolvePublicEndpoint(path), {
      ...opts,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

const withToken = (token: string, path: string, opts: RequestInit = {}) =>
  nativeRequest(token, path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + token,
      ...(opts.headers as Record<string, string> | undefined)
    }
  });

async function validate(token: string): Promise<string | null> {
  let me: Response, access: Response;
  try {
    [me, access] = await Promise.all([
      withToken(token, "/api/identity/me"),
      withToken(token, "/api/access/effective")
    ]);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("TIMEOUT");
    }
    throw new Error("NETWORK_ERROR");
  }
  if (me.status === 401 || access.status === 401) return null;
  if (!me.ok || !access.ok) throw new Error("BACKEND_UNAVAILABLE");
  const profile: unknown = await me.json(), rights: unknown = await access.json();
  if (!profile || typeof profile !== "object" ||
    !("displayName" in profile) || typeof profile.displayName !== "string" ||
    !("scope" in profile) || profile.scope !== "Foundation" ||
    !rights || typeof rights !== "object" ||
    !("actions" in rights) || !Array.isArray(rights.actions) ||
    !rights.actions.some(x => x && typeof x === "object" && "key" in x &&
      x.key === "communications.notifications.view")) {
    throw new Error("PERMISSION_DENIED");
  }
  return profile.displayName;
}

export default function PublicHome(){
  const [token,setToken]=useState<string|null>(null);
  const [person,setPerson]=useState<string|null>(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
  const [message,setMessage]=useState("");
  const [noticeOpen,setNoticeOpen]=useState(false);
  const [contactOpen,setContactOpen]=useState(false);
  const [directoryOpen,setDirectoryOpen]=useState(false);
  const [patientOpen,setPatientOpen]=useState(false);
  const [membershipPlan,setMembershipPlan]=useState<string|null>(null);
  const [partnerOpen,setPartnerOpen]=useState(false);
  const [volunteerOpen,setVolunteerOpen]=useState(false);
  const [publicLoginVisible,setPublicLoginVisible]=useState(false);
  const revoke=useCallback(()=>{
    setToken(null);setPerson(null);setNoticeOpen(false);
    void SecureStore.deleteItemAsync(KEY).catch(()=>undefined);
  },[]);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        const stored=await SecureStore.getItemAsync(KEY);
        if(!stored)return;
        const name=await validate(stored);
        if(!active)return;
        if(name){setToken(stored);setPerson(name);}
        else revoke();
      }catch(err: unknown){
        if(active){
          if(err instanceof Error && err.message === "PERMISSION_DENIED"){
            revoke();
            setMessage("You don't have permission to access this section.");
          } else {
            setMessage("We’re unable to connect right now. Please try again shortly.");
          }
        }
      }
      finally{if(active)setChecking(false);}
    })();
    return()=>{active=false};
  },[revoke]);
  useEffect(()=>{
    if(!token)return;
    let active=true;
    const sub=AppState.addEventListener("change",state=>{
      if(state!=="active")return;
      setChecking(true);setNoticeOpen(false);
      void (async()=>{
        try{
          const name=await validate(token);
          if(!active)return;
          if(!name)revoke();else setPerson(name);
        }catch(err: unknown){
          if(active){
            if(err instanceof Error && err.message === "PERMISSION_DENIED"){
              revoke();
              setMessage("You don't have permission to access this section.");
            } else {
              setPerson(null);
              setMessage("We’re unable to connect right now. Please try again shortly.");
            }
          }
        }finally{if(active)setChecking(false);}
      })();
    });
    return()=>{active=false;sub.remove()};
  },[token,revoke]);
  async function signIn(){
    if(busy||!email.trim()||!password)return;
    setBusy(true);setMessage("");
    let issued:string|null=null;
    try{
      let response: Response;
      try {
        response=await nativeRequest("","/api/identity/login",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({identifier:email.trim(),password,deviceLabel:"Public Android own notices"})
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessage("The request is taking too long. Please try again.");
          return;
        }
        setMessage("Internet connection unavailable. Please check your connection and try again.");
        return;
      }
      if(response.status === 401){
        setMessage("Incorrect mobile number/email or password.");
        return;
      }
      if(response.status === 429){
        setMessage("Too many attempts. Please try again shortly.");
        return;
      }
      if(response.status >= 500){
        setMessage("We’re unable to connect right now. Please try again shortly.");
        return;
      }
      if(!response.ok){
        setMessage("Sign-in unavailable. Please try again shortly.");
        return;
      }
      const result:unknown=await response.json();
      if(!result||typeof result!=="object"||
        !("sessionToken" in result)||typeof result.sessionToken!=="string"||
        !("expiresAt" in result)||typeof result.expiresAt!=="string"||
        Date.parse(result.expiresAt)<=Date.now()){
        setMessage("Something went wrong. Please try again.");
        return;
      }
      issued=result.sessionToken;
      let name: string | null = null;
      try {
        name=await validate(issued);
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "PERMISSION_DENIED") {
          setMessage("You don't have permission to access this section.");
          return;
        }
        if (err instanceof Error && (err.message === "TIMEOUT" || err.name === "AbortError")) {
          setMessage("The request is taking too long. Please try again.");
          return;
        }
        setMessage("We’re unable to connect right now. Please try again shortly.");
        return;
      }
      if(!name){
        setMessage("Your session has expired. Please sign in again.");
        return;
      }
      await SecureStore.setItemAsync(KEY,issued);
      setPerson(name);setToken(issued);
      setPassword("");setNoticeOpen(true);
    }catch(err: unknown){
      if(issued){
        try{await withToken(issued,"/api/identity/logout",{method:"POST"});}catch{}
      }
      setMessage("Something went wrong. Please try again.");
    }finally{setBusy(false);}
  }
  async function signOut(){
    if(!token||busy)return;
    setBusy(true);setMessage("");
    try{
      const response=await withToken(token,"/api/identity/logout",{method:"POST"});
      if(!response.ok)throw Error("UNCONFIRMED");
      revoke();
      setMessage("Signed out from private notifications.");
    }catch{setMessage("Sign-out not confirmed. Retry before using another account.");}
    finally{setBusy(false);}
  }
  if(contactOpen)
    return (
      <PublicScreenErrorBoundary onExit={()=>setContactOpen(false)}>
        <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
          <FoundationContactScreen onExit={()=>setContactOpen(false)}/>
        </Suspense>
      </PublicScreenErrorBoundary>
    );
  if(directoryOpen)
    return <PublicScreenErrorBoundary onExit={()=>setDirectoryOpen(false)}>
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
        <PublicHealthcareDirectory onExit={()=>{setPatientOpen(false);setDirectoryOpen(false);}} onPatientProfile={()=>setPatientOpen(true)}/>
        <Modal visible={patientOpen} animationType="slide" onRequestClose={()=>setPatientOpen(false)}><PublicScreenErrorBoundary onExit={()=>setPatientOpen(false)}><Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>{patientOpen&&<PatientProfileNative onExit={()=>setPatientOpen(false)}/>}</Suspense></PublicScreenErrorBoundary></Modal>
      </Suspense>
    </PublicScreenErrorBoundary>;
  if(partnerOpen)
    return <PublicScreenErrorBoundary onExit={()=>setPartnerOpen(false)}>
      <PublicPartnerApplication onExit={()=>setPartnerOpen(false)}
       onContact={()=>{setPartnerOpen(false);setContactOpen(true);}}/>
    </PublicScreenErrorBoundary>;
  if(membershipPlan!==null)
    return <PublicScreenErrorBoundary onExit={()=>setMembershipPlan(null)}>
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
        <NativeMemberSelf initialPlan={membershipPlan} onExit={()=>setMembershipPlan(null)}/>
      </Suspense>
    </PublicScreenErrorBoundary>;
  if(volunteerOpen)
    return <PublicScreenErrorBoundary onExit={()=>setVolunteerOpen(false)}>
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
        <NativeVolunteerSelf onExit={()=>setVolunteerOpen(false)}/>
      </Suspense>
    </PublicScreenErrorBoundary>;
  if(patientOpen)
    return <PublicScreenErrorBoundary onExit={()=>setPatientOpen(false)}>
      <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
        <PatientProfileNative onExit={()=>setPatientOpen(false)}/>
      </Suspense>
    </PublicScreenErrorBoundary>;
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.page}
      behavior={Platform.OS==="ios"?"padding":undefined}>
      {token&&person&&noticeOpen&&!checking?
        <PublicScreenErrorBoundary onExit={()=>setNoticeOpen(false)}>
          <Suspense fallback={<ActivityIndicator style={{marginTop:40}}/>}>
            <RecipientNotifications token={token} makeRequest={withToken}
              onExit={()=>setNoticeOpen(false)} onExpired={revoke}/>
          </Suspense>
        </PublicScreenErrorBoundary>:
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          <View style={styles.brandRow}>
            <Image source={require("../assets/careganga-mark.png")}
              accessibilityLabel="CareGanga Foundation" style={styles.brandImage}/>
            <Text accessibilityRole="header" style={styles.title}>CareGanga Foundation</Text>
          </View>
          <PublicCmsContent onContact={()=>setContactOpen(true)}
            onPartnerApplication={()=>setPartnerOpen(true)}
            onVolunteerApply={()=>setVolunteerOpen(true)}
            onMembershipApply={setMembershipPlan}
            onLoginVisibility={setPublicLoginVisible} onHealthcareDirectory={()=>setDirectoryOpen(true)}
            onPatientProfile={()=>setPatientOpen(true)}/>
           <NativePublicDonation/>
          <View style={[styles.card,styles.healthFeatureCard]}>
            <Text style={styles.heading}>Become a CareGanga Volunteer</Text>
            <Text>Four-step enrollment using your verified CareGanga account, protected identity proof and the Foundation's independent review.</Text>
            <Pressable accessibilityRole="button" style={styles.primary}
              onPress={()=>setVolunteerOpen(true)}>
              <Text style={styles.primaryText}>Apply to become a volunteer</Text>
            </Pressable>
          </View>
          <View style={[styles.card,styles.healthFeatureCard]}>
            <Text style={styles.heading}>Healthcare Network</Text>
            <Text>Search current verified CareGanga healthcare centers and doctors.</Text>
            <Pressable accessibilityRole="button" style={styles.primary}
              onPress={()=>setDirectoryOpen(true)}>
              <Text style={styles.primaryText}>Find healthcare centers & doctors</Text>
            </Pressable>
          </View>
          <View style={[styles.card,styles.healthFeatureCard]}>
            <Text style={styles.heading}>My Patient Profile</Text>
            <Text>View your own Virtual Patient ID and manage patient-care consent.</Text>
            <Pressable accessibilityRole="button" style={styles.primary}
              onPress={()=>setPatientOpen(true)}>
              <Text style={styles.primaryText}>Open my patient profile</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Contact & Help</Text>
            <Text>Send a private Foundation request without signing in,
              then check its receipt status.</Text>
            <Pressable accessibilityRole="button" style={styles.button}
              onPress={()=>setContactOpen(true)}>
              <Text>Contact CareGanga Foundation</Text>
            </Pressable>
          </View>
          {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
          {publicLoginVisible&&(checking?<ActivityIndicator accessibilityLabel="Verifying access"/>:
            token&&person?<View style={styles.card}>
              <Text style={styles.heading}>Signed in: {person}</Text>
              <Text>Only your own verified notices are available here.
                Foundation administration remains separate.</Text>
              <Pressable accessibilityRole="button" style={styles.button}
                disabled={busy} onPress={()=>setNoticeOpen(true)}>
                <Text>Open my Foundation notices</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.button}
                disabled={busy} onPress={()=>void signOut()}>
                <Text>Sign out</Text>
              </Pressable>
            </View>:<View style={styles.card}>
              <Text style={styles.heading}>My private notices</Text>
              <Text>This optional view is for a current authorized CareGanga
                account, not a public notification directory.</Text>
              <Text style={styles.label}>Mobile number or email</Text>
              <TextInput accessibilityLabel="Mobile number or email"
                value={email} onChangeText={setEmail}
                keyboardType="default" autoCapitalize="none"
                autoComplete="username" style={styles.input}/>
              <Text style={styles.label}>Password</Text>
              <TextInput accessibilityLabel="Password"
                secureTextEntry value={password} onChangeText={setPassword}
                autoComplete="current-password" style={styles.input}/>
              <Pressable accessibilityRole="button" style={styles.primary}
                disabled={busy||!email.trim()||!password}
                onPress={()=>void signIn()}>
                <Text style={styles.primaryText}>
                  {busy?"Verifying…":"Sign in to my notices"}</Text>
              </Pressable>
            </View>)}
          <Text style={styles.muted}>Public contact does not require a staff account
            and never exposes a private support case to unauthenticated visitors.</Text>
        </ScrollView>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:theme.background},
 content:{padding:24,gap:14,minHeight:"100%",width:"100%",maxWidth:720,alignSelf:"center"},
 brandRow:{flexDirection:"row",alignItems:"center",gap:12},
 brandImage:{width:52,height:52,borderRadius:26},
 title:{fontSize:25,fontWeight:"700",color:theme.sidebar,flexShrink:1},
 heading:{fontSize:18,fontWeight:"700",color:theme.text},
 card:{borderRadius:14,backgroundColor:theme.surface,padding:18,gap:12,
   borderWidth:1,borderColor:theme.border},
 healthFeatureCard:{borderLeftWidth:3,borderLeftColor:theme.primary},
 label:{fontSize:13,color:theme.mutedText},
 muted:{fontSize:13,color:theme.mutedText},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:8,
   padding:12,minHeight:48,color:theme.text},
 button:{borderWidth:1,borderColor:theme.border,borderRadius:8,
   padding:13,minHeight:48,alignItems:"center",justifyContent:"center"},
 primary:{borderRadius:8,backgroundColor:theme.primary,padding:14,
   minHeight:48,alignItems:"center",justifyContent:"center"},
 primaryText:{color:theme.primaryText,fontWeight:"700"},
 alert:{padding:12,color:theme.error,backgroundColor:theme.surface}
});
