import {useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Year={yearRef:string;name:string;status:string;startOn:string;endOn:string};
type Pending={key:string;body:Record<string,unknown>};
type Result={confirmed:boolean;status:string;reversalRef?:string};
export function FinanceNativeManualReversal({token,journalRef,years,onDone,onExit,onExpired}:{
 token:string;journalRef:string;years:Year[];onDone:()=>void;onExit:()=>void;onExpired:()=>void
}){
 const [year,setYear]=useState("");
 const [date,setDate]=useState("");
 const [reason,setReason]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [knownAbsent,setKnownAbsent]=useState(false);
 const request=async(path:string,method:"GET"|"POST",body?:object)=>{
  const r=await identityRequest(path,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Session expired. Sign in again.");}
  if(!r.ok){
   const raw:unknown=await r.json().catch(()=>null);
   const x=raw&&typeof raw==="object"&&!Array.isArray(raw)?
    raw as Record<string,unknown>:{};
   throw Error(typeof x.message==="string"&&x.message.length<240?x.message:
    r.status===403?"Only an authorized independent reviewer may correct this journal.":
    r.status===409?"This original journal was already corrected or the period closed.":
    "The original correction state is uncertain. Check status before retrying.");
  }
  return await r.json() as Result;
 };
 async function submit(cmd:Pending){
  if(busy)return;
  setBusy(true);setNotice("");setPending(cmd);setKnownAbsent(false);
  try{
   const result=await request("/api/finance-accounting/manual-journals/"+
    journalRef+"/reverse","POST",{...cmd.body,requestKey:cmd.key});
   if(!result.confirmed||result.status!=="REVERSED")throw Error("Correction not confirmed.");
   setPending(null);setPassword("");setNotice("Original offsetting journal posted.");
   onDone();
  }catch(e){setNotice(e instanceof Error?e.message:"Correction unconfirmed.");}
  finally{setBusy(false);}
 }
 async function check(){
  if(!pending||busy)return;
  setBusy(true);setNotice("");
  try{
   const r=await request("/api/finance-accounting/manual-journals/reversal-commands/"+
    pending.key,"GET");
   if(r.confirmed&&r.status==="REVERSED"){
    setPending(null);setPassword("");onDone();
   }else{setKnownAbsent(true);setNotice(
    "No confirmed correction exists. Retry this SAME original request only.");}
  }catch(e){setNotice(e instanceof Error?e.message:"Original request unavailable.");}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.page} edges={["top","bottom"]}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" onPress={onExit}
    disabled={busy||!!pending}><Text style={s.link}>‹ Back</Text></Pressable>
   <Text accessibilityRole="header" style={s.title}>Protected journal correction</Text>
  </View>
  <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
   <Text style={s.info}>Only an independent current-password reviewer may reverse an
    original manually posted journal. The original debit/credit lines are immutable.
    This action never reverses an invoice or proves a payment.</Text>
   <Text style={s.label}>Open financial year</Text>
   {years.filter(y=>y.status==="OPEN").map(y=>
    <Pressable key={y.yearRef} accessibilityRole="radio"
     accessibilityState={{checked:year===y.yearRef}}
     style={[s.choice,year===y.yearRef&&s.selected]} onPress={()=>setYear(y.yearRef)}>
     <Text style={s.info}>{y.name} · {y.startOn} – {y.endOn}</Text>
    </Pressable>)}
   <Text style={s.label}>Correction date (YYYY-MM-DD)</Text>
   <TextInput style={s.input} value={date} onChangeText={setDate}
    autoCapitalize="none" placeholder="YYYY-MM-DD" placeholderTextColor={t.mutedText}/>
   <Text style={s.label}>Reason for correction (12–300 characters)</Text>
   <TextInput style={[s.input,{minHeight:88}]} multiline
    maxLength={300} value={reason} onChangeText={setReason}
    placeholderTextColor={t.mutedText} placeholder="State what was entered incorrectly"/>
   <Text style={s.label}>Current reviewer password</Text>
   <TextInput style={s.input} secureTextEntry value={password}
    onChangeText={setPassword} placeholder="Current password" placeholderTextColor={t.mutedText}/>
   {!!notice&&<Text accessibilityRole="alert" style={s.info}>{notice}</Text>}
   {!!pending?<View style={s.card}>
    <Text style={s.info}>Correction outcome unknown. Check original source first.</Text>
    <Pressable accessibilityRole="button" disabled={busy} style={s.choice}
     onPress={()=>void check()}><Text style={s.link}>Check original request</Text></Pressable>
    {knownAbsent&&<Pressable accessibilityRole="button" disabled={busy}
     style={s.choice} onPress={()=>void submit(pending)}>
     <Text style={s.link}>Retry same correction reference</Text></Pressable>}
   </View>:
   <Pressable accessibilityRole="button" style={s.primary}
    disabled={busy||!year||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
     reason.trim().length<12||password.length<8}
    onPress={()=>void submit({key:Crypto.randomUUID(),body:{
     financialYearRef:year,postingDate:date,reason,currentPassword:password}})}>
    <Text style={s.primaryText}>Post protected exact reversal</Text></Pressable>}
   {busy&&<ActivityIndicator color={t.primary}/>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},
 header:{flexDirection:"row",alignItems:"center",gap:15,padding:16,
  borderBottomWidth:1,borderBottomColor:t.border},
 title:{fontSize:18,fontWeight:"700",color:t.text},
 link:{color:t.primary,fontSize:14,fontWeight:"600"},
 body:{padding:16,gap:12},
 info:{color:t.text,fontSize:13,lineHeight:19},
 label:{color:t.text,fontSize:13,fontWeight:"600"},
 input:{borderWidth:1,borderColor:t.border,backgroundColor:t.surface,
  color:t.text,padding:12,borderRadius:8,fontSize:14,minHeight:48},
 choice:{borderWidth:1,borderColor:t.border,padding:12,borderRadius:8,
  backgroundColor:t.surface,minHeight:48,justifyContent:"center"},
 selected:{borderColor:t.primary,borderWidth:2},
 card:{padding:12,gap:10,borderWidth:1,borderColor:t.border,borderRadius:8},
 primary:{backgroundColor:t.primary,borderRadius:8,padding:15,minHeight:48,
  justifyContent:"center",alignItems:"center"},
 primaryText:{color:t.primaryText,fontWeight:"700"}
});
