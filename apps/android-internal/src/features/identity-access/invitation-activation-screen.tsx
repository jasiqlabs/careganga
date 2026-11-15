import { useState } from "react";
import { KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,
  StyleSheet,Text,TextInput,View } from "react-native";
import * as Crypto from "expo-crypto";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import { identityRequest } from "./http-client";

export function InvitationActivationScreen({onExit}:{onExit:()=>void}){
  const [step,setStep]=useState<"proof"|"setup"|"done">("proof");
  const [email,setEmail]=useState("");
  const [token,setToken]=useState("");
  const [enrollmentSecret,setEnrollmentSecret]=useState("");
  const [password,setPassword]=useState("");
  const [totp,setTotp]=useState("");
  const [busy,setBusy]=useState(false);
  const [uncertain,setUncertain]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(){
    if(busy||uncertain)return;
    setBusy(true);setMessage("");
    try{
      const result=await identityRequest("/api/identity/invitation/"+(step==="proof"?"enroll":"confirm"),{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(step==="proof"?{email,token}:{email,token,password,totp})
      });
      if(!result.ok){
        setMessage(result.status===429?"Too many attempts. Try again later.":result.status===400?
          "Invitation or verification could not be confirmed.":"Account activation is unavailable.");
        if(step==="setup"&&result.status>=500)setUncertain(true);
        return;
      }
      if(step==="proof"){
        const data:unknown=await result.json();
        if(!data||typeof data!=="object"||!("enrollmentSecret" in data)||
          typeof data.enrollmentSecret!=="string")throw new Error("UNCONFIRMED");
        setEnrollmentSecret(data.enrollmentSecret);
        setStep("setup");
        setMessage("Add this key to your authenticator app before confirming.");
      }else{
        setStep("done");setToken("");setPassword("");setTotp("");setEnrollmentSecret("");
        setMessage("Account activated. Sign in using a fresh authenticator code.");
      }
    }catch{
      setMessage("The result could not be confirmed. Check before trying again.");
      if(step==="setup")setUncertain(true);
    }finally{setBusy(false);}
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.page}
    behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.brand}>CAREGANGA FOUNDATION</Text>
      <Text accessibilityRole="header" style={styles.title}>Activate staff access</Text>
      <View style={styles.card}>
        {step!=="done"&&<>
          <Text style={styles.label}>Invited work email</Text>
          <TextInput accessibilityLabel="Invited work email" editable={step==="proof"}
            autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input}
            value={email} onChangeText={setEmail}/>
          <Text style={styles.label}>Invitation code</Text>
          <TextInput accessibilityLabel="Invitation code" editable={step==="proof"}
            autoCapitalize="none" style={styles.input} value={token} onChangeText={setToken}/>
        </>}
        {step==="setup"&&<>
          <Text style={styles.titleSmall}>Set up your authenticator</Text>
          <Text style={styles.note}>In your authenticator app, add an account manually using this private key. Do not share it.</Text>
          <Text selectable style={styles.secret} accessibilityLabel="Authenticator setup key">{enrollmentSecret}</Text>
          <Text style={styles.label}>New password (14 characters minimum)</Text>
          <TextInput style={styles.input} accessibilityLabel="New password" secureTextEntry
            autoComplete="new-password" value={password} onChangeText={setPassword}/>
          <Text style={styles.label}>Current authenticator code</Text>
          <TextInput style={styles.input} accessibilityLabel="Current authenticator code"
            inputMode="numeric" maxLength={6} value={totp}
            onChangeText={v=>setTotp(v.replace(/\D/g,""))}/>
        </>}
        {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
        {!uncertain&&step!=="done"&&<Pressable accessibilityRole="button"
          disabled={busy||!email||token.length<40||step==="setup"&&(password.length<14||totp.length!==6)}
          onPress={()=>void submit()} style={[styles.button,styles.primary]}>
          <Text style={styles.primaryText}>{busy?"Verifying…":step==="proof"?"Verify invitation":"Activate staff account"}</Text>
        </Pressable>}
        {uncertain&&<Text>Try signing in with a fresh authenticator code before requesting another activation attempt.</Text>}
        <Pressable accessibilityRole="button" style={styles.button} onPress={onExit}>
          <Text style={styles.buttonText}>Return to staff sign in</Text>
        </Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:careGangaTheme.background},
  content:{minHeight:"100%",padding:24,gap:14,maxWidth:680,width:"100%",alignSelf:"center",justifyContent:"center"},
  brand:{fontWeight:"800",letterSpacing:1.5,color:careGangaTheme.sidebar},
  title:{fontSize:24,fontWeight:"700",color:careGangaTheme.text},
  titleSmall:{fontSize:18,fontWeight:"700",color:careGangaTheme.text},
  label:{fontWeight:"600",color:careGangaTheme.text},
  card:{padding:20,gap:12,backgroundColor:careGangaTheme.surface,borderRadius:12,
    borderWidth:1,borderColor:careGangaTheme.border},
  input:{minHeight:48,paddingHorizontal:12,borderWidth:1,borderRadius:7,
    borderColor:careGangaTheme.border,color:careGangaTheme.text},
  note:{fontSize:14,color:careGangaTheme.mutedText},
  secret:{padding:14,backgroundColor:careGangaTheme.background,overflow:"hidden",
    color:careGangaTheme.text,fontFamily:"monospace",borderRadius:6},
  button:{minHeight:48,padding:12,alignItems:"center",justifyContent:"center",borderWidth:1,
    borderColor:careGangaTheme.border,borderRadius:7},
  primary:{backgroundColor:careGangaTheme.primary,borderColor:careGangaTheme.primary},
  primaryText:{fontWeight:"700",color:careGangaTheme.primaryText},
  buttonText:{fontWeight:"600",color:careGangaTheme.text}
});
