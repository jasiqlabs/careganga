import {SafeAreaView} from "react-native-safe-area-context";
import {useRef,useState} from "react";
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "./http-client";
import {careGangaTheme} from "../../../../../packages/design-tokens/src/index";

export function RecoveryScreen({onExit}:{onExit:()=>void}){
  const [step,setStep]=useState<"request"|"confirm">("request");
  const [identifier,setIdentifier]=useState("");
  const [channel,setChannel]=useState<"sms"|"email">("sms");
  const [code,setCode]=useState("");
  const [newPassword,setNewPassword]=useState("");
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
        body:JSON.stringify(step==="request"?
          {identifier:identifier.trim(),channel,requestKey:key.current}:
          {identifier:identifier.trim(),otp:code,newPassword})
      });
      if(!response.ok){
        setMessage(response.status===429?"Too many attempts. Try again later.":
          response.status===400?"Check OTP and password.":"Recovery is temporarily unavailable.");
        if(step==="confirm"&&response.status>=500)setUnknown(true);
        return;
      }
      if(step==="request"){
        setStep("confirm");
        setMessage("If this account exists, an OTP will be sent to the registered contact when delivery is available.");
      }else{
        setComplete(true);setCode("");setNewPassword("");
        setMessage("Password changed. Return to sign in.");
      }
    }catch{
      setMessage("We could not confirm the outcome. Check before submitting again.");
      if(step==="confirm")setUnknown(true);
    }finally{setBusy(false);}
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.page}
    behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Forgot Password</Text>
      <View style={styles.formCard}>
        <Text style={styles.label}>Registered mobile number or email</Text>
        <TextInput accessibilityLabel="Registered mobile number or email"
          autoComplete="username" autoCapitalize="none" value={identifier}
          editable={!complete&&step==="request"} onChangeText={x=>{setIdentifier(x);setChannel(x.includes("@")?"email":"sms");}} style={styles.input}/>
        {step==="request"&&<View style={styles.group}>
          <Text style={styles.label}>Receive OTP via</Text>
          <View style={{flexDirection:"row",gap:12}}>
            {(["sms","email"] as const).map(value=><Pressable key={value}
              accessibilityRole="radio" accessibilityState={{checked:channel===value}}
              onPress={()=>setChannel(value)}
              style={[styles.button,channel===value&&styles.primaryButton]}>
              <Text style={channel===value?styles.primaryButtonText:styles.label}>
                {value==="sms"?"SMS":"Email"}</Text>
            </Pressable>)}
          </View>
        </View>}
        {step==="confirm"&&!complete&&<View style={styles.group}>
          <Text style={styles.label}>Six-digit password reset OTP</Text>
          <TextInput accessibilityLabel="Password reset OTP" keyboardType="number-pad"
            autoComplete="one-time-code" maxLength={6} value={code}
            onChangeText={v=>setCode(v.replace(/\D/g,"").slice(0,6))} style={styles.input}/>
          <Text style={styles.label}>New password (8 or more characters)</Text>
          <TextInput accessibilityLabel="New password" secureTextEntry
            autoComplete="new-password" value={newPassword}
            onChangeText={setNewPassword} style={styles.input}/>
        </View>}
        {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
        {!complete&&!unknown&&<Pressable accessibilityRole="button"
          disabled={busy||!identifier.trim()||
            (step==="confirm"&&(code.length!==6||newPassword.length<8))}
          onPress={()=>void submit()} style={[styles.button,styles.primaryButton]}>
          <Text style={styles.primaryButtonText}>{busy?"Checking…":
            step==="request"?"Send reset OTP":"Reset password"}</Text>
        </Pressable>}
        {unknown&&<Text>Check whether your password changed before retrying. Contact support if needed.</Text>}
        {step==="confirm"&&!complete&&<Pressable accessibilityRole="button"
          style={styles.button} disabled={busy}
          onPress={()=>{setStep("request");setCode("");setNewPassword("");
            key.current="";setMessage("Request a new OTP after the resend cooldown.");}}>
          <Text>Request another OTP</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" style={styles.button} onPress={onExit}>
          <Text>Return to sign in</Text>
        </Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:careGangaTheme.background},
  content:{minHeight:"100%",padding:24,gap:14,justifyContent:"center",width:"100%",maxWidth:680,alignSelf:"center"},
  title:{fontSize:25,fontWeight:"700",color:careGangaTheme.text},
  formCard:{padding:20,backgroundColor:careGangaTheme.surface,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:12,gap:12},
  group:{gap:8},
  label:{fontWeight:"600",color:careGangaTheme.text},
  input:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:7,paddingHorizontal:12,backgroundColor:careGangaTheme.surface,color:careGangaTheme.text},
  button:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,borderRadius:7,alignItems:"center",justifyContent:"center",padding:12},
  primaryButton:{backgroundColor:careGangaTheme.primary,borderColor:careGangaTheme.primary},
  primaryButtonText:{color:careGangaTheme.primaryText,fontWeight:"700"},
  message:{borderWidth:1,borderColor:careGangaTheme.border,padding:12,color:careGangaTheme.text,backgroundColor:careGangaTheme.surface}
});
