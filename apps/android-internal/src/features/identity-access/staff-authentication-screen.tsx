import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CG01SessionCreated,CG01SessionView,CG01SignInRequest } from "@careganga/api-contracts";

const STORE_KEY="cg_internal_root_session";
const apiBase=process.env.EXPO_PUBLIC_API_URL;

async function apiRequest(path:string, options:RequestInit):Promise<Response>{
  if(!apiBase || !/^https?:\/\//.test(apiBase) || (process.env.NODE_ENV==="production"&&!apiBase.startsWith("https://")))
    throw new Error("The sign-in service is not configured securely.");
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),10000);
  try {return await fetch(new URL(path,apiBase).toString(),{...options,signal:abort.signal});}
  finally {clearTimeout(timeout);}
}
async function sessionView(token:string):Promise<CG01SessionView|null>{
  const response=await apiRequest("/api/identity/me",{headers:{Authorization:"Bearer "+token}});
  if(response.status===401)return null;
  if(!response.ok)throw new Error("The session cannot be verified right now.");
  const data:unknown=await response.json();
  if(!data || typeof data!=="object" || !("displayName" in data)
    || !("roleName" in data) || !("scope" in data)
    || typeof data.displayName!=="string"||typeof data.roleName!=="string"||data.scope!=="Foundation")
    throw new Error("Session details could not be verified.");
  return data as CG01SessionView;
}
export function StaffAuthenticationScreen(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [token,setToken]=useState<string|null>(null);
  const [actor,setActor]=useState<CG01SessionView|null>(null);
  const [state,setState]=useState<"checking"|"idle"|"busy">("checking");
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try {
        const stored=await SecureStore.getItemAsync(STORE_KEY);
        if(!stored){if(active)setState("idle");return;}
        const verified=await sessionView(stored);
        if(!active)return;
        if(!verified){await SecureStore.deleteItemAsync(STORE_KEY);setActor(null);setToken(null);}
        else {setToken(stored);setActor(verified);}
      } catch {
        if(active)setMessage("Access cannot be verified right now. Protected information remains hidden.");
      }finally{if(active)setState("idle");}
    })();
    return()=>{active=false;};
  },[]);
  async function signIn(){
    if(state==="busy")return;
    setState("busy");setMessage("");
    const request:CG01SignInRequest={email,password,totp,deviceLabel:"Internal Android"};
    try{
      const response=await apiRequest("/api/identity/login",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)
      });
      if(!response.ok){
        setMessage(response.status===429?"Too many attempts. Please try later.":response.status===401?"Account or verification code could not be confirmed.":"Sign-in unavailable. Please try again.");
        return;
      }
      const data:CG01SessionCreated=await response.json();
      if(typeof data.sessionToken!=="string"||typeof data.expiresAt!=="string")throw new Error("Sign-in confirmation is unavailable.");
      const verified=await sessionView(data.sessionToken);
      if(!verified)throw new Error("The new session could not be confirmed.");
      await SecureStore.setItemAsync(STORE_KEY,data.sessionToken);
      setToken(data.sessionToken);setActor(verified);setPassword("");setTotp("");
    }catch{setMessage("Could not confirm sign-in. Check your connection and try again.");}
    finally{setState("idle");}
  }
  async function signOut(){
    if(state==="busy"||!token)return;
    setState("busy");setMessage("");
    try{
      const response=await apiRequest("/api/identity/logout",{
        method:"POST",headers:{Authorization:"Bearer "+token}
      });
      if(!response.ok)throw new Error("Server revocation not confirmed");
      await SecureStore.deleteItemAsync(STORE_KEY);
      setActor(null);setToken(null);
    }catch{setMessage("Sign-out could not be confirmed. Please retry.");}
    finally{setState("idle");}
  }
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.page}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.brand}>CareGanga Foundation</Text>
        <Text accessibilityRole="header" style={styles.title}>Internal staff access</Text>
        {state==="checking"?<ActivityIndicator accessibilityLabel="Verifying saved session"/>:actor?
          <View style={styles.form}>
            <Text accessibilityRole="header">Signed in: {actor.displayName}</Text>
            <Text>Role: {actor.roleName}</Text>
            <Text>Access: {actor.scope}</Text>
            <Pressable accessibilityRole="button" disabled={state==="busy"} onPress={()=>void signOut()} style={styles.button}>
              <Text>Sign out</Text>
            </Pressable>
          </View>:
          <View style={styles.form}>
            <Text>Use your work account and current authenticator code.</Text>
            <Text>Work email</Text>
            <TextInput accessibilityLabel="Work email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input}/>
            <Text>Password</Text>
            <TextInput accessibilityLabel="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} style={styles.input}/>
            <Text>Authenticator code</Text>
            <TextInput accessibilityLabel="Authenticator code" inputMode="numeric" maxLength={6} value={totp} onChangeText={x=>setTotp(x.replace(/\D/g,""))} style={styles.input}/>
            <Pressable accessibilityRole="button" disabled={state==="busy"||!email||!password||totp.length!==6} onPress={()=>void signIn()} style={styles.button}>
              <Text>{state==="busy"?"Verifying…":"Sign in"}</Text>
            </Pressable>
            <Text>Account recovery requires Foundation support until a verified delivery channel is configured.</Text>
          </View>}
        {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1},content:{minHeight:"100%",padding:24,gap:14,justifyContent:"center"},
  brand:{fontWeight:"700",fontSize:18},title:{fontSize:26,fontWeight:"700",marginBottom:12},
  form:{gap:12},input:{minHeight:48,borderWidth:1,borderRadius:7,paddingHorizontal:12},
  button:{minHeight:48,borderWidth:1,borderRadius:7,justifyContent:"center",alignItems:"center",padding:12},
  message:{marginTop:10,padding:10,borderWidth:1}
});
