import { SafeAreaView } from "react-native-safe-area-context";
import { useRef,useState } from "react";
import { KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View } from "react-native";
import * as Crypto from "expo-crypto";
import { identityRequest } from "./http-client";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";

export function RecoveryScreen({onExit}:{onExit:()=>void}){
  const [step,setStep]=useState<"request"|"confirm">("request");
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [totp,setTotp]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [unknown,setUnknown]=useState(false);
  const [complete,setComplete]=useState(false);
  const key=useRef("");
  async function submit(){
    if(busy||unknown)return;
    setBusy(true);setMessage("");
    if(step==="request"&&!key.current)key.current=Crypto.randomUUID();
    try{
      const response=await identityRequest("/api/identity/recovery/"+step,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(step==="request"?{email,requestKey:key.current}:{email,token:code,password,totp})
      });
      if(!response.ok){
        setMessage(response.status===429?"Too many attempts. Try again later.":
          response.status===400?"Details could not be confirmed.":"Recovery is temporarily unavailable.");
        if(step==="confirm"&&response.status>=500)setUnknown(true);
        return;
      }
      if(step==="request"){
        const result:unknown=await response.json();
        const ref=result&&typeof result==="object"&&"supportReference" in result
          &&typeof result.supportReference==="string"&&/^CG-[A-Z0-9-]{8,25}$/.test(result.supportReference)
          ? result.supportReference : undefined;
        setStep("confirm");
        setMessage("If eligible, your recovery request is being processed. Delivery cannot be confirmed here."+
          (ref?" Support reference: "+ref:""));
      }else{
        setComplete(true);setPassword("");setCode("");setTotp("");
        setMessage("Password updated. Return to sign in.");
      }
    }catch{
      setMessage("We could not confirm the outcome. Check before submitting again.");
      if(step==="confirm")setUnknown(true);
    }finally{setBusy(false);}
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.page}
     behavior={Platform.OS==="ios"?"padding":undefined}><ScrollView
     keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Recover Foundation staff access</Text>
    <Text style={styles.label}>Work email</Text><TextInput accessibilityLabel="Work email" autoComplete="email"
      keyboardType="email-address" autoCapitalize="none" value={email}
      editable={!complete} onChangeText={setEmail} style={styles.input}/>
    {step==="confirm"&&!complete&&<View style={styles.group}>
      <Text style={styles.label}>Recovery code received by email</Text>
      <TextInput accessibilityLabel="Recovery code" autoCapitalize="none" value={code}
        onChangeText={setCode} style={styles.input}/>
      <Text style={styles.label}>Authenticator code</Text>
      <TextInput accessibilityLabel="Authenticator code" keyboardType="number-pad" maxLength={6}
        value={totp} onChangeText={v=>setTotp(v.replace(/\D/g,""))} style={styles.input}/>
      <Text style={styles.label}>New password (14 or more characters)</Text>
      <TextInput accessibilityLabel="New password" secureTextEntry autoComplete="new-password"
        value={password} onChangeText={setPassword} style={styles.input}/>
    </View>}
    {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    {!complete&&!unknown&&<Pressable accessibilityRole="button" disabled={busy||!email||
      (step==="confirm"&&(code.length<40||totp.length!==6||password.length<14))}
      onPress={()=>void submit()} style={[styles.button,styles.primaryButton]}>
      <Text style={styles.primaryButtonText}>{busy?"Checking…":step==="request"?"Request recovery":"Confirm recovery"}</Text>
    </Pressable>}
    {unknown&&<Text>Try signing in with the new password or contact support before another reset.</Text>}
    <Pressable accessibilityRole="button" style={styles.button} onPress={onExit}>
      <Text>Return to sign in</Text>
    </Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:careGangaTheme.background},
  content:{minHeight:"100%",padding:24,gap:14,justifyContent:"center",width:"100%",maxWidth:680,alignSelf:"center"},
  title:{fontSize:25,fontWeight:"700",color:careGangaTheme.text},
  group:{gap:8},
  label:{fontWeight:"600",color:careGangaTheme.text},
  input:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:7,paddingHorizontal:12,backgroundColor:careGangaTheme.surface,color:careGangaTheme.text},
  button:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:7,alignItems:"center",justifyContent:"center",padding:12},
  primaryButton:{backgroundColor:careGangaTheme.primary,borderColor:careGangaTheme.primary},
  primaryButtonText:{color:careGangaTheme.primaryText,fontWeight:"700"},
  message:{borderWidth:1,borderColor:careGangaTheme.border,padding:12,color:careGangaTheme.text,backgroundColor:careGangaTheme.surface}
});
