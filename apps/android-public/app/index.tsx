import {useCallback,useEffect,useState} from "react";
import {
  ActivityIndicator,AppState,Image,KeyboardAvoidingView,Platform,
  Pressable,ScrollView,StyleSheet,Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import {careGangaTheme as theme} from "../../../packages/design-tokens/src/index";
import {RecipientNotifications} from "../../../packages/native-communications/src/recipient-notifications";
import {FoundationContactScreen} from "../src/features/support/foundation-contact-screen";

const KEY="cg_public_own_notice_session";
const base=process.env.EXPO_PUBLIC_API_URL;
async function nativeRequest(_token:string,path:string,opts:RequestInit={}){
  if(!base||!/^https?:\/\//.test(base)||
    (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
    throw Error("UNAVAILABLE");
  const timeout=AbortSignal.timeout(10000);
  return fetch(new URL(path,base).toString(),{...opts,signal:timeout});
}
const withToken=(token:string,path:string,opts:RequestInit={})=>
  nativeRequest(token,path,{...opts,headers:{
    Authorization:"Bearer "+token,...(opts.headers as Record<string,string>|undefined)
  }});
async function validate(token:string):Promise<string|null>{
  const [me,access]=await Promise.all([
    withToken(token,"/api/identity/me"),
    withToken(token,"/api/access/effective")
  ]);
  if(me.status===401||access.status===401)return null;
  if(!me.ok||!access.ok)throw Error("UNAVAILABLE");
  const profile:unknown=await me.json(),rights:unknown=await access.json();
  if(!profile||typeof profile!=="object"||
    !("displayName" in profile)||typeof profile.displayName!=="string"||
    !("scope" in profile)||profile.scope!=="Foundation"||
    !rights||typeof rights!=="object"||
    !("actions" in rights)||!Array.isArray(rights.actions)||
    !rights.actions.some(x=>x&&typeof x==="object"&&"key" in x&&
      x.key==="communications.notifications.view"))throw Error("DENIED");
  return profile.displayName;
}
export default function PublicHome(){
  const [token,setToken]=useState<string|null>(null);
  const [person,setPerson]=useState<string|null>(null);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
  const [message,setMessage]=useState("");
  const [noticeOpen,setNoticeOpen]=useState(false);
  const [contactOpen,setContactOpen]=useState(false);
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
      }catch{if(active)setMessage("Saved notice access cannot be verified right now.");}
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
        }catch{
          if(active){setPerson(null);
            setMessage("Current notice permission could not be verified.");}
        }finally{if(active)setChecking(false);}
      })();
    });
    return()=>{active=false;sub.remove()};
  },[token,revoke]);
  async function signIn(){
    if(busy||!email||!password||!/^[0-9]{6}$/.test(totp))return;
    setBusy(true);setMessage("");
    let issued:string|null=null;
    try{
      const response=await nativeRequest("","/api/identity/login",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email,password,totp,deviceLabel:"Public Android own notices"})
      });
      if(!response.ok)throw Error("DENIED");
      const result:unknown=await response.json();
      if(!result||typeof result!=="object"||
        !("sessionToken" in result)||typeof result.sessionToken!=="string"||
        !("expiresAt" in result)||typeof result.expiresAt!=="string"||
        Date.parse(result.expiresAt)<=Date.now())throw Error("UNAVAILABLE");
      issued=result.sessionToken;
      const name=await validate(issued);
      if(!name)throw Error("DENIED");
      await SecureStore.setItemAsync(KEY,issued);
      setPerson(name);setToken(issued);
      setPassword("");setTotp("");setNoticeOpen(true);
    }catch{
      if(issued){
        try{await withToken(issued,"/api/identity/logout",{method:"POST"});}catch{}
      }
      setMessage("Sign-in or permission could not be verified.");
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
  if(contactOpen)return <FoundationContactScreen onExit={()=>setContactOpen(false)}/>;
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.page}
      behavior={Platform.OS==="ios"?"padding":undefined}>
      {token&&person&&noticeOpen&&!checking?
        <RecipientNotifications token={token} makeRequest={withToken}
          onExit={()=>setNoticeOpen(false)} onExpired={revoke}/>:
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}>
          <View style={styles.brandRow}>
            <Image source={require("../assets/careganga-mark.png")}
              accessibilityLabel="CareGanga Foundation" style={styles.brandImage}/>
            <Text accessibilityRole="header" style={styles.title}>CareGanga Foundation</Text>
          </View>
          <Text>Foundation operations and healthcare assistance.</Text>
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
          {checking?<ActivityIndicator accessibilityLabel="Verifying access"/>:
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
              <Text style={styles.label}>Account email</Text>
              <TextInput accessibilityLabel="Account email"
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none"
                autoComplete="email" style={styles.input}/>
              <Text style={styles.label}>Password</Text>
              <TextInput accessibilityLabel="Password"
                secureTextEntry value={password} onChangeText={setPassword}
                autoComplete="current-password" style={styles.input}/>
              <Text style={styles.label}>Authenticator code</Text>
              <TextInput accessibilityLabel="Authenticator code"
                value={totp} onChangeText={x=>setTotp(x.replace(/\D/g,""))}
                maxLength={6} keyboardType="number-pad" style={styles.input}/>
              <Pressable accessibilityRole="button" style={styles.primary}
                disabled={busy||!email||!password||totp.length!==6}
                onPress={()=>void signIn()}>
                <Text style={styles.primaryText}>
                  {busy?"Verifying…":"Sign in to my notices"}</Text>
              </Pressable>
            </View>}
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
 card:{borderRadius:12,backgroundColor:theme.surface,padding:16,gap:12,
   borderWidth:1,borderColor:theme.border},
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
