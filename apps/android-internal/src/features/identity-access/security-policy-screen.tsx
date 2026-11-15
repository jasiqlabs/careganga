import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,BackHandler,KeyboardAvoidingView,Platform,
  Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as cg} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "./http-client";

type Policy={maxSessionAgeSeconds:number;idleTimeoutSeconds:number;
  failedAttemptWindowSeconds:number;maxFailedAttempts:number;
  rootMfaRequired:true;revision:number;updatedAt:string|null};
type Form={maximum:string;idle:string;window:string;attempts:string};
const fields:{key:keyof Form;name:string;hint:string;min:number;max:number}[]=[
  {key:"maximum",name:"Maximum session age",hint:"Minutes · 15–480",min:15,max:480},
  {key:"idle",name:"Idle session timeout",hint:"Minutes · 5–60",min:5,max:60},
  {key:"window",name:"Failed-attempt window",hint:"Minutes · 5–60",min:5,max:60},
  {key:"attempts",name:"Allowed failed attempts",hint:"Attempts · 3–10",min:3,max:10}
];
function form(p:Policy):Form{return{
  maximum:String(p.maxSessionAgeSeconds/60),idle:String(p.idleTimeoutSeconds/60),
  window:String(p.failedAttemptWindowSeconds/60),attempts:String(p.maxFailedAttempts)
};}
function validPolicy(x:unknown):x is Policy{
  if(!x||typeof x!=="object")return false;
  const p=x as Record<string,unknown>;
  return p.rootMfaRequired===true&&Number.isInteger(p.revision)&&Number(p.revision)>=0&&
    Number.isInteger(Number(p.maxSessionAgeSeconds)/60)&&
    Number.isInteger(Number(p.idleTimeoutSeconds)/60)&&
    Number.isInteger(Number(p.failedAttemptWindowSeconds)/60)&&
    typeof p.maxFailedAttempts==="number"&&Number.isInteger(p.maxFailedAttempts);
}
export function SecurityPolicyScreen({token,onExit,onExpired}:{
  token:string;onExit:()=>void;onExpired:()=>void
}){
  const [current,setCurrent]=useState<Policy|null>(null);
  const [values,setValues]=useState<Form|null>(null);
  const [editing,setEditing]=useState(false);
  const [review,setReview]=useState(false);
  const [totp,setTotp]=useState("");
  const [busy,setBusy]=useState(false);
  const [checkingOutcome,setCheckingOutcome]=useState(false);
  const [loading,setLoading]=useState(true);
  const [unknown,setUnknown]=useState(false);
  const [message,setMessage]=useState("");
  const requestKey=useRef("");
  const generation=useRef(0);
  const saving=useRef(false);
  const read=useCallback(async(expectedRevision?:number):Promise<boolean>=>{
    const seq=++generation.current;setLoading(true);
    try{
      const result=await identityRequest("/api/identity/security-policy",{
        headers:{Authorization:"Bearer "+token}});
      if(result.status===401){if(seq===generation.current)onExpired();return false;}
      if(result.status===403){if(seq===generation.current){setCurrent(null);onExit();}return false;}
      if(!result.ok)throw Error("Current security policy unavailable");
      const payload:unknown=await result.json();
      if(!validPolicy(payload))throw Error("Policy response could not be verified");
      if(seq!==generation.current)return false;
      const matched=expectedRevision===undefined||payload.revision>=expectedRevision;
      setCurrent(payload);setValues(form(payload));setEditing(false);setReview(false);
      setTotp("");
      // Preserve the exact request reference until the saved revision is confirmed.
      if(matched){setUnknown(false);setMessage("");requestKey.current="";}
      else{setUnknown(true);setMessage(
        "The saved revision is not visible yet. Check the previous change before retrying.");}
      return matched;
    }catch{
      if(seq!==generation.current)return false;
      setCurrent(null);setValues(null);setEditing(false);
      setMessage("Protected policy could not be verified. Check your connection.");
      return false;
    }finally{if(seq===generation.current)setLoading(false);}
  },[token,onExit,onExpired]);
  useEffect(()=>{void read();return()=>{++generation.current;};},[read]);
  useEffect(()=>{
    const back=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(saving.current)return true;
      if(editing){setEditing(false);setReview(false);setTotp("");return true;}
      onExit();return true;
    });
    return()=>back.remove();
  },[editing,onExit]);
  useEffect(()=>{
    const sub=AppState.addEventListener("change",state=>{
      if(state==="active"&&!editing&&!unknown)void read();
      else if(state!=="active"){setCurrent(null);setValues(null);setEditing(false);
        setReview(false);setTotp("");}
    });
    return()=>sub.remove();
  },[read,editing,unknown]);
  async function checkOutcome(){
    if(!unknown||!requestKey.current||checkingOutcome)return;
    setCheckingOutcome(true);
    try{
      const result=await identityRequest("/api/identity/security-policy/changes/"+
        encodeURIComponent(requestKey.current),{
          headers:{Authorization:"Bearer "+token}
        });
      if(result.status===401){onExpired();return;}
      if(result.status===403){setCurrent(null);onExit();return;}
      if(!result.ok)throw Error("Unavailable");
      const body=await result.json() as {status?:string;revision?:number|null};
      if(body.status==="CONFIRMED"&&Number.isInteger(body.revision)){
        const verified=await read(Number(body.revision));
        setUnknown(!verified);
        setMessage(verified?"The earlier change is confirmed and the effective policy reloaded.":
          "The change was recorded, but its effective policy cannot yet be confirmed.");
      }else setMessage("No committed outcome is visible yet. Check again before retrying.");
    }catch{
      setMessage("The previous change cannot yet be confirmed. Check again before trying another edit.");
    }finally{setCheckingOutcome(false);}
  }
  function begin(){
    if(!current)return;
    requestKey.current=Crypto.randomUUID();setValues(form(current));setEditing(true);
    setReview(false);setTotp("");setUnknown(false);setMessage("");
  }
  function change(key:keyof Form,text:string){
    setValues(old=>old?{...old,[key]:text.replace(/[^0-9]/g,"")}:old);
    setReview(false);
  }
  function validate(v:Form):boolean{
    if(!fields.every(f=>v[f.key].length>0&&Number.isInteger(Number(v[f.key]))&&
      Number(v[f.key])>=f.min&&Number(v[f.key])<=f.max))return false;
    return Number(v.idle)<=Number(v.maximum);
  }
  async function save(){
    if(!values||!current||busy||unknown)return;
    if(!validate(values)){
      setMessage("Check permitted limits. Idle timeout cannot exceed session age.");return;
    }
    if(!review){setReview(true);setMessage("");return;}
    if(!/^[0-9]{6}$/.test(totp)){setMessage("Enter a fresh six-digit authenticator code.");return;}
    saving.current=true;setBusy(true);setMessage("");
    const body={maxSessionAgeSeconds:Number(values.maximum)*60,
      idleTimeoutSeconds:Number(values.idle)*60,
      failedAttemptWindowSeconds:Number(values.window)*60,
      maxFailedAttempts:Number(values.attempts),rootMfaRequired:true,
      expectedRevision:current.revision,idempotencyKey:requestKey.current,totp};
    try{
      const result=await identityRequest("/api/identity/security-policy",{
        method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      if(result.status===401){setCurrent(null);onExpired();return;}
      if(result.status===403){setCurrent(null);setEditing(false);
        setMessage("Your Super Admin access could not be verified.");return;}
      if(result.status===409){setReview(false);
        setMessage("The policy changed elsewhere. Keep these values and refresh before saving.");return;}
      if(result.status===429){setReview(false);
        setMessage("Too many authenticator attempts. Try again later.");return;}
      if(!result.ok){
        if(result.status>=500){setUnknown(true);
          setMessage("The change may be saved. Refresh the effective policy before attempting another change.");}
        else {setReview(false);setMessage("Policy was not accepted. Review limits and enter a fresh code.");}
        return;
      }
      const ack:unknown=await result.json();
      if(!ack||typeof ack!=="object"||!("revision" in ack)||
        !Number.isInteger(ack.revision))throw Error("Unconfirmed");
      const verified=await read(Number(ack.revision));
      // A committed write may be followed by a failed or stale read.
      // Retain the request key for an authenticated status lookup.
      if(!verified)setUnknown(true);
      setMessage(verified?"Security policy saved and verified. Existing sessions follow these limits.":
        "Save was acknowledged, but the effective revision could not be verified. Check the previous change before editing.");
    }catch{
      setUnknown(true);
      setMessage("The outcome cannot be confirmed. Refresh the policy before trying again.");
    }finally{saving.current=false;setBusy(false);}
  }
  return <SafeAreaView style={styles.root}><KeyboardAvoidingView
    behavior={Platform.OS==="ios"?"padding":undefined} style={styles.root}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.row}><Text accessibilityRole="header" style={styles.title}>Security Policy</Text>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>editing?setEditing(false):onExit()} disabled={busy}>
          <Text style={styles.buttonText}>{editing?"Cancel":"Back"}</Text>
        </Pressable></View>
      <Text style={styles.helper}>Foundation Super Admin · Authentication and session security</Text>
      {!!message&&<Text accessibilityRole="alert" style={styles.notice}>{message}</Text>}
      {loading?<ActivityIndicator accessibilityLabel="Verifying current policy"/>:
        current&&!editing?<View style={styles.card}>
          {fields.map(f=><View key={f.key} style={styles.field}>
            <Text style={styles.helper}>{f.name}</Text>
            <Text style={styles.value}>{form(current)[f.key]} {f.key==="attempts"?"attempts":"minutes"}</Text>
          </View>)}
          <Text style={styles.value}>Super Admin MFA: Required</Text>
          <Text style={styles.helper}>This requirement cannot be disabled.</Text>
          <Text style={styles.helper}>Last updated: {current.updatedAt?
            new Date(current.updatedAt).toLocaleString():"Secure Foundation defaults"}</Text>
          <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
            onPress={begin}><Text style={styles.primaryText}>Edit policy</Text></Pressable>
        </View>:null}
      {editing&&values&&<View style={styles.card}>
        {fields.map(f=><View key={f.key} style={styles.field}>
          <Text style={styles.label}>{f.name}</Text>
          <TextInput accessibilityLabel={f.name} keyboardType="number-pad"
            value={values[f.key]} onChangeText={t=>change(f.key,t)}
            style={styles.input}/>
          <Text style={styles.helper}>{f.hint}</Text>
        </View>)}
        <Text style={styles.label}>Super Admin MFA: Required (not editable)</Text>
        <Text style={styles.label}>Fresh authenticator code</Text>
        <TextInput accessibilityLabel="Fresh authenticator code" value={totp}
          onChangeText={t=>{setTotp(t.replace(/[^0-9]/g,""));setReview(false);}}
          keyboardType="number-pad" maxLength={6} style={styles.input}/>
        {review&&<View style={styles.field}><Text style={styles.label}>Confirm policy change</Text>
          <Text>Shorter limits may immediately expire existing staff sessions. This update is audited.</Text>
        </View>}
        <Pressable accessibilityRole="button" disabled={busy||unknown||totp.length!==6}
          style={[styles.button,styles.primary]} onPress={()=>void save()}>
          <Text style={styles.primaryText}>{busy?"Saving…":review?"Confirm and save":"Review change"}</Text>
        </Pressable>
      </View>}
      <Pressable accessibilityRole="button" style={styles.button}
        disabled={busy||loading||unknown} onPress={()=>void read()}>
        <Text style={styles.buttonText}>Refresh effective policy</Text>
      </Pressable>
      {unknown&&<View style={styles.field}>
        <Text style={styles.helper}>Do not repeat an unconfirmed change before checking its result.</Text>
        <Pressable accessibilityRole="button" disabled={checkingOutcome}
          style={styles.button} onPress={()=>void checkOutcome()}>
          <Text style={styles.buttonText}>{checkingOutcome?"Checking…":"Check previous change"}</Text>
        </Pressable>
      </View>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:cg.background},
  content:{padding:20,gap:14,width:"100%",maxWidth:760,alignSelf:"center"},
  row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:12},
  title:{fontSize:23,fontWeight:"700",color:cg.text,flexShrink:1},
  card:{backgroundColor:cg.surface,padding:18,borderWidth:1,borderColor:cg.border,borderRadius:12,gap:12},
  field:{gap:6,paddingBottom:8},
  label:{fontSize:15,fontWeight:"600",color:cg.text},
  value:{fontSize:18,fontWeight:"700",color:cg.text},
  helper:{fontSize:14,color:cg.mutedText},
  input:{borderWidth:1,borderColor:cg.border,borderRadius:8,backgroundColor:cg.surface,
    color:cg.text,paddingHorizontal:12,minHeight:48},
  button:{borderWidth:1,borderColor:cg.border,borderRadius:8,minHeight:48,
    paddingHorizontal:14,alignItems:"center",justifyContent:"center"},
  buttonText:{fontWeight:"600",color:cg.text},
  primary:{backgroundColor:cg.primary,borderColor:cg.primary},
  primaryText:{fontWeight:"700",color:cg.primaryText},
  notice:{backgroundColor:cg.surface,color:cg.text,borderLeftWidth:3,
    borderLeftColor:cg.error,padding:12}
});
