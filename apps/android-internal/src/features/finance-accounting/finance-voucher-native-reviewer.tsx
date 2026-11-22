import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Case={caseRef:string;reference:string;voucherNumber:string;status:string;revision:number};
type Detail=Case&{voucherRef:string;sourceVersion:number;proofFileRef:string;proofRevision:number};
type Voucher={header:{type:string;projectLabel?:string|null;payeeName:string;postingDate:string;purpose:string};
 lines:{description:string;quantity:number;unitRateMinor:string;lineTotalMinor:string}[];
 grossMinor:string;taxMinor:string;chargesMinor:string;totalMinor:string};
type Pending={key:string;body:Record<string,unknown>;caseRef:string};
type Props={token:string;onExit:()=>void;onExpired:()=>void};
function money(v:string){
 try{const x=BigInt(v),n=x<0n?-x:x;
 return (x<0n?"−":"")+"₹"+(n/100n).toLocaleString("en-IN")+
  "."+(n%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}
}
async function request<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 let r:Response;
 try{r=await identityRequest(path,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});}
 catch{throw Error("UNKNOWN");}
 if(r.status===401)throw Error("EXPIRED");
 if(!r.ok){
  const details:unknown=await r.json().catch(()=>null);
  const data=details&&typeof details==="object"&&!Array.isArray(details)?
    details as Record<string,unknown>:{};
  if(typeof data.code==="string"&&data.code.startsWith("FINANCE_")&&
    typeof data.message==="string"&&data.message.length<=220)
    throw Error("USER:"+data.message);
  if(r.status===403)throw Error("DENIED");
  if(r.status===409)throw Error("CHANGED");
  if(r.status===400)throw Error("INVALID");
  throw Error(method==="POST"?"UNKNOWN":"OFFLINE");
 }
 try{return await r.json() as T;}catch{throw Error("UNKNOWN");}
}
const msg=(e:unknown)=>{
 const x=e instanceof Error?e.message:"UNKNOWN";
 if(x.startsWith("USER:"))return x.slice(5);
 return x==="EXPIRED"?"Session expired. Sign in again.":
 x==="DENIED"?"Current protected Foundation reviewer and document access is required.":
 x==="CHANGED"?"Original review version changed. Refresh before deciding.":
 x==="INVALID"?"Check the review action and your current password.":
 x==="OFFLINE"?"Reviewer source cannot be reached. Check the connection and retry.":
 "The original reviewer decision result is uncertain. Check that case before retrying.";
};
export function FinanceVoucherNativeReviewer({token,onExit,onExpired}:Props){
 const [cases,setCases]=useState<Case[]>([]);
 const [offset,setOffset]=useState(0);
 const [nextOffset,setNextOffset]=useState<number|null>(null);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [selected,setSelected]=useState<Detail|null>(null);
 const [original,setOriginal]=useState<Voucher|null>(null);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [remarks,setRemarks]=useState("");
 const [password,setPassword]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const r=await request<{cases:Case[];nextOffset:number|null}>(token,
    "/api/registration-approvals/finance-vouchers?offset="+offset);
   if(!Array.isArray(r.cases)||!(r.nextOffset===null||Number.isSafeInteger(r.nextOffset)))
    throw Error("OFFLINE");
   setCases(r.cases);setNextOffset(r.nextOffset);
  }catch(e){setCases([]);setNextOffset(null);setError(msg(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setLoading(false);}
 },[token,offset,onExpired]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{
  const listener=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(busy||pending)return true;
   if(selected){setSelected(null);setOriginal(null);setPassword("");}
   else onExit();
   return true;
  });
  return()=>listener.remove();
 },[busy,pending,selected,onExit]);
 async function openCase(row:Case){
  if(busy)return;
  setBusy(true);setError("");setInfo("");
  try{
   const detail=await request<Detail>(token,
     "/api/registration-approvals/finance-vouchers/"+row.caseRef);
   if(!detail.voucherRef||!detail.proofFileRef||!Number.isSafeInteger(detail.sourceVersion))
    throw Error("OFFLINE");
   const data=await request<Voucher>(token,
    "/api/finance-accounting/vouchers/drafts/"+detail.voucherRef+
     "/revisions/"+detail.sourceVersion);
   if(!data.header||!Array.isArray(data.lines))throw Error("OFFLINE");
   setSelected(detail);setOriginal(data);setAction("APPROVE");
   setRemarks("");setPassword("");setPending(null);
  }catch(e){setError(msg(e));setSelected(null);setOriginal(null);
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function proof(){
  if(!selected||busy)return;
  setBusy(true);setError("");
  let tmp:File|null=null;
  try{
   const r=await identityRequest(
    "/api/documents/finance-voucher-evidence/files/"+selected.proofFileRef+"/download",
    {headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(r.status===401){onExpired();return;}
   if(!r.ok)throw Error(r.status===403?"DENIED":"OFFLINE");
   const type=r.headers.get("content-type")?.split(";")[0]??"";
   if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(type))
    throw Error("OFFLINE");
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760)throw Error("OFFLINE");
   const extension=type==="application/pdf"?".pdf":type==="image/png"?".png":
    type==="image/jpeg"?".jpg":".webp";
   tmp=new File(Paths.cache,"cg-private-finance-"+Crypto.randomUUID()+extension);
   tmp.create();await tmp.write(bytes);
   await tmp.preview({title:"Protected voucher evidence"});
  }catch(e){setError(msg(e));}
  finally{try{tmp?.delete();}catch{}setBusy(false);}
 }
 async function send(review:Pending){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const result=await request<{status:string;revision:number}>(token,
     "/api/registration-approvals/finance-vouchers/"+review.caseRef+"/decisions",
     "POST",{...review.body,requestKey:review.key});
   if(!result.status)throw Error("UNKNOWN");
   setPending(null);setSelected(null);setOriginal(null);setPassword("");
   setInfo("Reviewer decision confirmed: "+result.status+
    ". No money is marked paid.");
   await load();
  }catch(e){setPending(review);setError(msg(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 function decide(){
  if(!selected||!original||busy||pending)return;
  if(password.length<8){setError("Enter the current password to verify your decision.");return;}
  void send({key:Crypto.randomUUID(),caseRef:selected.caseRef,
   body:{action,expectedRevision:selected.revision,remarks,currentPassword:password}});
 }
 async function check(){
  if(!pending||busy)return;
  setBusy(true);setError("");
  try{
   const detail=await request<Detail>(token,
    "/api/registration-approvals/finance-vouchers/"+pending.caseRef);
   if(detail.revision>Number(pending.body.expectedRevision)){
    setInfo("The original case has advanced to "+detail.status+
     ". Review the current state before further action.");
    setPending(null);setSelected(null);setOriginal(null);setPassword("");
    await load();
   }else setError("No newer decision was found. Retry only the original request.");
  }catch(e){setError(msg(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.page} edges={["left","right"]}>
  <View style={s.header}>
   <Pressable style={s.button} disabled={busy||!!pending}
    onPress={()=>{if(selected){setSelected(null);setOriginal(null);}
      else onExit();}}><Text style={s.link}>‹ Back</Text></Pressable>
   <View style={s.heading}><Text style={s.eyebrow}>CAREGANGA / FINANCE</Text>
    <Text style={s.title}>Voucher Reviews</Text></View>
   <Pressable style={s.button} onPress={()=>void load()} disabled={busy||loading}>
    <Text style={s.link}>Refresh</Text></Pressable>
  </View>
  <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
   <Text style={s.hint}>Only original, frozen submissions are reviewed. Approval is not a payment.</Text>
   {loading&&<ActivityIndicator color={t.primary}/>}
   {!!error&&<View style={s.notice} accessibilityRole="alert"><Text style={s.noticeText}>{error}</Text></View>}
   {!!info&&<View style={s.card}><Text style={s.hint}>{info}</Text></View>}
   {!selected&&<>
    {!loading&&!cases.length&&<Text style={s.hint}>No protected Finance reviews found.</Text>}
    {cases.map(c=><Pressable accessibilityRole="button" key={c.caseRef} style={s.card}
     disabled={busy} onPress={()=>void openCase(c)}>
     <Text style={s.bold}>{c.reference} · {c.voucherNumber}</Text>
     <Text style={s.hint}>{c.status.replaceAll("_"," ")} · Open original review</Text>
    </Pressable>)}
    <View style={s.actions}>
     <Pressable style={s.button} disabled={offset===0||loading}
      onPress={()=>setOffset(v=>Math.max(0,v-50))}><Text style={s.link}>Previous</Text></Pressable>
     <Pressable style={s.button} disabled={nextOffset===null||loading}
      onPress={()=>setOffset(nextOffset??0)}><Text style={s.link}>Next</Text></Pressable>
    </View>
   </>}
   {selected&&original&&<>
    <Text style={s.bold}>{selected.reference} · {selected.voucherNumber}</Text>
    <Text style={s.hint}>Original submitted voucher version: {selected.sourceVersion}</Text>
    <View style={s.card}>
     <Text style={s.bold}>{original.header.type} · {original.header.payeeName}</Text>
     <Text style={s.hint}>Posting date: {original.header.postingDate}</Text>
     <Text style={s.hint}>Purpose: {original.header.purpose}</Text><Text style={s.hint}>Project: {original.header.projectLabel??"Not linked"}</Text>
     {original.lines.map((l,i)=><View key={i} style={s.item}>
      <Text style={s.hint}>{l.description} · Qty {l.quantity}</Text>
      <Text style={s.bold}>{money(l.lineTotalMinor)}</Text>
     </View>)}
     <Text style={s.hint}>Gross {money(original.grossMinor)} · Tax {money(original.taxMinor)}</Text>
     <Text style={s.hint}>Charges {money(original.chargesMinor)}</Text>
     <Text style={s.bold}>Total {money(original.totalMinor)}</Text>
    </View>
    <Pressable accessibilityRole="button" style={s.button} disabled={busy}
     onPress={()=>void proof()}><Text style={s.link}>View verified private evidence</Text></Pressable>
    {["SUBMITTED","IN_REVIEW"].includes(selected.status)&&<>
     <View style={s.actions}>{(["APPROVE","RETURN","REJECT"] as const).map(k=>
      <Pressable key={k} accessibilityRole="radio"
       accessibilityState={{checked:action===k}} style={[s.button,action===k&&s.selected]}
       onPress={()=>setAction(k)}><Text style={s.link}>{k.charAt(0)+k.slice(1).toLowerCase()}</Text></Pressable>)}</View>
     <Text style={s.hint}>Reviewer remarks (optional)</Text>
     <TextInput style={s.input} maxLength={500} multiline numberOfLines={3}
      value={remarks} onChangeText={setRemarks} accessibilityLabel="Reviewer remarks"/>
     <Text style={s.hint}>Confirm your current password *</Text>
     <TextInput style={s.input} secureTextEntry autoCapitalize="none"
      value={password} onChangeText={setPassword} accessibilityLabel="Current password"/>
     {!!pending&&<>
      <Text style={s.hint}>A decision outcome is uncertain. Check the original case before retrying.</Text>
      <Pressable style={s.button} disabled={busy} onPress={()=>void check()}>
       <Text style={s.link}>Check original decision</Text></Pressable>
      <Pressable style={s.button} disabled={busy} onPress={()=>void send(pending)}>
       <Text style={s.link}>Retry same decision</Text></Pressable></>}
     <Pressable accessibilityRole="button" disabled={busy||!!pending||password.length<8}
      style={[s.button,s.primary]} onPress={decide}>
      <Text style={s.primaryText}>Confirm {action.toLowerCase()}</Text></Pressable>
    </>}
   </>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 header:{flexDirection:"row",alignItems:"center",gap:10,padding:12,
  borderBottomWidth:1,borderBottomColor:t.border,backgroundColor:t.surface},
 heading:{flex:1},eyebrow:{fontSize:10,color:t.mutedText},
 title:{fontSize:18,fontWeight:"700",color:t.text},
 body:{padding:14,paddingBottom:96,gap:12},
 hint:{fontSize:13,lineHeight:20,color:t.mutedText},
 bold:{fontSize:15,fontWeight:"700",color:t.text},
 card:{padding:13,gap:7,borderWidth:1,borderColor:t.border,
  borderRadius:14,backgroundColor:t.surface,
    shadowColor:t.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
 item:{flexDirection:"row",justifyContent:"space-between",gap:9},
 notice:{padding:13,borderRadius:9,backgroundColor:t.surface,
  borderWidth:1,borderColor:t.border},
 noticeText:{color:t.error,fontSize:14},
 actions:{flexDirection:"row",flexWrap:"wrap",gap:9,justifyContent:"space-between"},
 button:{minHeight:48,borderWidth:1,borderColor:t.border,
  borderRadius:12,paddingHorizontal:12,justifyContent:"center"},
 link:{fontWeight:"600",color:t.primary},
 selected:{borderColor:t.primary,backgroundColor:t.selectedSurface},
 primary:{backgroundColor:t.primary,borderColor:t.primary},
 primaryText:{fontWeight:"700",color:t.primaryText},
 input:{borderWidth:1,borderColor:t.border,borderRadius:10,
  minHeight:48,padding:11,color:t.text,backgroundColor:t.surface}
});
