import { useRef,useState } from "react";
import { KeyboardAvoidingView,Platform,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,TextInput,View } from "react-native";
import * as Crypto from "expo-crypto";
import { identityRequest } from "./http-client";

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
        setStep("confirm");
        setMessage("If eligible, your recovery request is being processed. Delivery cannot be confirmed here.");
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
    <Text accessibilityRole="header" style={styles.title}>Recover staff access</Text>
    <Text>Work email</Text><TextInput accessibilityLabel="Work email" autoComplete="email"
      keyboardType="email-address" autoCapitalize="none" value={email}
      editable={!complete} onChangeText={setEmail} style={styles.input}/>
    {step==="confirm"&&!complete&&<View style={styles.group}>
      <Text>Recovery code received by email</Text>
      <TextInput accessibilityLabel="Recovery code" autoCapitalize="none" value={code}
        onChangeText={setCode} style={styles.input}/>
      <Text>Authenticator code</Text>
      <TextInput accessibilityLabel="Authenticator code" keyboardType="number-pad" maxLength={6}
        value={totp} onChangeText={v=>setTotp(v.replace(/\D/g,""))} style={styles.input}/>
      <Text>New password (14 or more characters)</Text>
      <TextInput accessibilityLabel="New password" secureTextEntry autoComplete="new-password"
        value={password} onChangeText={setPassword} style={styles.input}/>
    </View>}
    {!!message&&<Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    {!complete&&!unknown&&<Pressable accessibilityRole="button" disabled={busy||!email||
      (step==="confirm"&&(code.length<40||totp.length!==6||password.length<14))}
      onPress={()=>void submit()} style={styles.button}>
      <Text>{busy?"Checking…":step==="request"?"Request recovery":"Confirm recovery"}</Text>
    </Pressable>}
    {unknown&&<Text>Try signing in with the new password or contact support before another reset.</Text>}
    <Pressable accessibilityRole="button" style={styles.button} onPress={onExit}>
      <Text>Return to sign in</Text>
    </Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1},content:{minHeight:"100%",padding:24,gap:14,justifyContent:"center"},
  title:{fontSize:24,fontWeight:"700"},group:{gap:8},
  input:{minHeight:48,borderWidth:1,borderRadius:7,paddingHorizontal:12},
  button:{minHeight:48,borderWidth:1,borderRadius:7,alignItems:"center",justifyContent:"center",padding:12},
  message:{borderWidth:1,padding:12}
});
