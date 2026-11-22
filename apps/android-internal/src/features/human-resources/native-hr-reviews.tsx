import {careGangaTheme as hrTheme} from "../../../../../packages/design-tokens/src/index";
import React,{useCallback,useEffect,useRef,useState} from "react";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Case={caseRef:string;reference:string;name:string;status:string;revision:number;canReview:boolean};
type Detail={caseRef:string;reference:string;name:string;status:string;
 designation:string;employmentType:string;revision:number;canDecide:boolean;canReadProof:boolean;
 evidence:{classification:string;verified:boolean}[]};
const originalStatuses=[{key:"ALL",title:"All"},{key:"SUBMITTED",title:"Submitted"},{key:"IN_REVIEW",title:"In review"},{key:"PENDING_OWNER",title:"Approved — activation pending"},{key:"OWNER_COMPLETED",title:"Activated"},{key:"RETURNED",title:"Returned"},{key:"REJECTED",title:"Rejected"}];
const stageLabel=(status:string)=>originalStatuses.find(x=>x.key===status)?.title??"Status unavailable";
type Decision="APPROVE"|"RETURN"|"REJECT";
async function api<T>(token:string,path:string,method="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/hr/reviews"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
  ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){const rejected:unknown=await response.json().catch(()=>null);throw Object.assign(new Error(
  response.status===409&&rejected&&typeof rejected==="object"&&"code" in rejected&&typeof rejected.code==="string"&&["CG10_ENROLLMENT_EVIDENCE_CHANGED","CG10_ENROLLMENT_PRIVATE_CHANGED"].includes(rejected.code)&&"message" in rejected&&typeof rejected.message==="string"?rejected.message:
  response.status===401?"Session expired. Sign in again.":
  response.status===403?"Current role cannot review this protected HR case.":
  response.status===409?"Original review state changed. Refresh before deciding.":
  "Independent enrollment decision cannot be verified. Check the original case."
 ),{status:response.status});}
 return response.json() as Promise<T>;
}
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,v=>v.toUpperCase());
export function NativeHrReviews({token,canConfigure=false,onExpired}:{
 token:string;canConfigure?:boolean;onExpired:()=>void;
}){
 const [cases,setCases]=useState<Case[]>([]);
 const [filter,setFilter]=useState("ALL"),[offset,setOffset]=useState(0),[more,setMore]=useState(false);
 const [uncertain,setUncertain]=useState(false);const read=useRef(0),running=useRef(false);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [action,setAction]=useState<Decision>("APPROVE");
 const [password,setPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [key,setKey]=useState<string|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [setupPassword,setSetupPassword]=useState("");
 const [configuring,setConfiguring]=useState(false);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Original reviewer access cannot be confirmed.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  const seq=++read.current;setLoading(true);setError("");setCases([]);setMore(false);
  try{
   const response=await api<{items:Case[];hasMore:boolean}>(token,"?offset="+offset+"&status="+encodeURIComponent(filter));
   if(!response||!Array.isArray(response.items))
    throw Error("The Foundation employee review inbox cannot be verified.");
   if(seq===read.current){setCases(response.items);setMore(response.hasMore===true);}
  }catch(e){if(seq===read.current)failure(e);}
  finally{if(seq===read.current)setLoading(false);}
 },[token,failure,offset,filter]);
 useEffect(()=>{void refresh();return()=>{read.current++;};},[refresh]);
 const checkProcess=useCallback(async()=>{
  try{
   const result=await api<{configured:boolean}>(token,"/process");
   if(!result||typeof result.configured!=="boolean")
    throw Error("Original employee approval process cannot be verified.");
   setConfigured(result.configured);
  }catch(e){setConfigured(null);failure(e);}
 },[token,failure]);
 useEffect(()=>{void checkProcess();},[checkProcess]);
 const configure=async()=>{
  if(!canConfigure||!setupPassword||configuring)return;
  setConfiguring(true);setError("");
  try{
   const result=await api<{configured:boolean}>(token,"/process","POST",{
    currentPassword:setupPassword});
   if(!result?.configured)throw Error("Protected process setup cannot be verified.");
   setSetupPassword("");setConfigured(true);
   setNotice("Original Foundation employee reviewer process configured.");
  }catch(e){failure(e);}
  finally{setConfiguring(false);}
 };
 const open=async(ref:string)=>{
  if(running.current||uncertain)return;running.current=true;setBusy(true);setSelected(null);setError("");setNotice("");setPassword("");setRemarks("");setAction("APPROVE");setKey(null);
  try{
   const result=await api<Detail>(token,"/"+encodeURIComponent(ref));
   if(!result?.caseRef||!result.status)
    throw Error("Original employee review details are unavailable.");
   setSelected(result);
  }catch(e){setSelected(null);failure(e);}
  finally{running.current=false;setBusy(false);}
 };
 const decide=async()=>{
  if(!selected?.canDecide||!password||busy||running.current)return;running.current=true;
  const id=key??Crypto.randomUUID();setKey(id);setBusy(true);setError("");setNotice("");
  try{
   const result=await api<{status:string}>(token,
    "/"+encodeURIComponent(selected.caseRef)+"/decide","POST",{
     requestKey:id,expectedRevision:selected.revision,action,
     remarks,currentPassword:password});
   if(!result?.status)throw Error("Original employee decision cannot be verified.");
   setNotice(action==="APPROVE"?
    "Independent approval recorded. HR must separately complete activation.":
    action==="RETURN"?"Returned for HR correction.":"Enrollment rejected.");
   setSelected(null);setPassword("");setRemarks("");setKey(null);setUncertain(false);
   await refresh();
  }catch(e){setPassword("");if(!uncertain&&e&&typeof e==="object"&&"status" in e&&[400,401,403,404,409,422].includes(Number(e.status))){setKey(null);setUncertain(false);}else setUncertain(true);failure(e);}
  finally{running.current=false;setBusy(false);}
 };
 const preview=async(kind:string)=>{
  if(!selected?.canReadProof||busy||uncertain)return;
  setBusy(true);setError("");
  let temporary:File|null=null;
  try{
   const res=await identityRequest("/api/hr/reviews/"+
    encodeURIComponent(selected.caseRef)+"/proof/"+encodeURIComponent(kind),{
    method:"GET",cache:"no-store",
    headers:{Authorization:"Bearer "+token}});
   if(res.status===401){onExpired();return;}
   if(!res.ok)throw Error(res.status===403?
    "Current Foundation reviewer cannot read this private document.":
    "The original private proof is not accessible.");
   const mime=res.headers.get("content-type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
    throw Error("Private proof content was not verified.");
   const expected=res.headers.get("content-length");
   const n=expected===null?null:Number(expected);
   if(n!==null&&(!Number.isSafeInteger(n)||n<1||n>10485760))
    throw Error("Private proof size was not verified.");
   const bytes=new Uint8Array(await res.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760||
     (n!==null&&n!==bytes.length))
    throw Error("Private proof content was not verified.");
   const suffix=mime==="application/pdf"?".pdf":
    mime==="image/jpeg"?".jpg":mime==="image/png"?".png":".webp";
   temporary=new File(Paths.cache,"careganga-private-hr-"+Crypto.randomUUID()+suffix);
   temporary.create();
   await temporary.write(bytes);
   await temporary.preview({title:"Original employee review proof"});
  }catch(e){failure(e);}
  finally{try{temporary?.delete();}catch{}setBusy(false);}
 };
 const button=(name:string,fn:()=>void,disabled=false,primary=false)=>(
  <Pressable accessibilityRole="button" disabled={disabled} onPress={fn}
   style={[styles.button,primary&&styles.primary,disabled&&{opacity:.55}]}>
   <Text style={[styles.buttonText,primary&&styles.primaryText]}>{name}</Text>
  </Pressable>
 );
 return <View style={styles.card}>
  <Text style={styles.heading}>Independent employee enrollment reviews</Text>
  <Text style={styles.hint}>Only a different authorized Foundation reviewer can decide
   an original enrollment with scanner-verified identity proof. Password confirmation is required.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {configured===false&&<View style={styles.detail}>
   <Text style={styles.hint}>The original employee approval process requires
    protected Foundation manager configuration before submissions.</Text>
   {canConfigure&&<>
    <Text style={styles.label}>Current password to configure employee reviews</Text>
    <TextInput value={setupPassword} onChangeText={setSetupPassword}
      secureTextEntry autoCapitalize="none" autoCorrect={false}
      accessibilityLabel="Password for protected process setup"
      style={styles.input} placeholder="Current password"/>
    <Pressable accessibilityRole="button" disabled={configuring||!setupPassword}
      style={styles.primary} onPress={()=>void configure()}>
      <Text style={styles.primaryText}>
       {configuring?"Configuring reviews…":"Configure original approval process"}</Text>
    </Pressable>
   </>}
  </View>}
  {button(loading?"Loading…":"Refresh original inbox",()=>void refresh(),loading||busy)}
  <View style={styles.choices}>{originalStatuses.map(x=><Pressable key={x.key} disabled={busy||uncertain} accessibilityRole="button" accessibilityState={{selected:filter===x.key,disabled:busy||uncertain}} style={[styles.chip,filter===x.key&&styles.chipActive]} onPress={()=>{setFilter(x.key);setOffset(0);}}><Text style={filter===x.key?styles.chipActiveText:styles.chipText}>{x.title}</Text></Pressable>)}</View>
  {cases.length===0&&!loading&&<Text style={styles.hint}>No original review cases.</Text>}
  {cases.map(item=><View key={item.caseRef} style={styles.item}>
   <Text style={styles.label}>{item.name}</Text>
   <Text style={styles.hint}>{item.reference} · {stageLabel(item.status)}</Text>
   {button("View original review",()=>void open(item.caseRef),busy||uncertain)}
  </View>)}
  <View style={styles.choices}>{offset>0&&button("Previous",()=>setOffset(v=>Math.max(0,v-25)),busy||uncertain||loading)}{more&&button("Next",()=>setOffset(v=>v+25),busy||uncertain||loading)}</View>
  <Modal visible={!!selected} animationType="slide" onRequestClose={()=>{if(!busy&&!uncertain){setSelected(null);setPassword("");setKey(null);}}}><View style={{flex:1,backgroundColor:hrTheme.surface}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:10}}>{!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{selected&&<View style={styles.detail}>
   <Text style={styles.heading}>{selected.name} — {selected.designation}</Text>
   <Text style={styles.hint}>{selected.reference} · {stageLabel(selected.status)}</Text>
   <Text style={styles.label}>Scanner-verified source evidence</Text>
   {selected.evidence.map((e,i)=><View key={i} style={{gap:5}}>
    <Text style={styles.hint}>
     {label(e.classification)} · {e.verified?"Verified":"Not verified"}</Text>
    {e.verified&&selected.canReadProof&&button("View original protected proof",
      ()=>void preview(e.classification),busy||uncertain)}
   </View>)}
   {selected.canDecide&&<>
    <Text style={styles.label}>Your decision</Text>
    <View style={styles.choices}>
     {(["APPROVE","RETURN","REJECT"] as Decision[]).map(a=>
      <Pressable key={a} accessibilityRole="button"
       disabled={busy||uncertain} accessibilityState={{selected:action===a,disabled:busy||uncertain}}
       style={[styles.chip,action===a&&styles.chipActive]}
       onPress={()=>{setAction(a);setKey(null);setPassword("");}}>
       <Text style={action===a?styles.chipActiveText:styles.chipText}>{label(a)}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>Remarks (optional)</Text>
    <TextInput value={remarks} editable={!busy&&!uncertain} onChangeText={v=>{setRemarks(v);setKey(null);}}
     accessibilityLabel="Reviewer remarks" maxLength={500}
     style={[styles.input,{minHeight:80}]} multiline
     placeholder="Reason for decision"/>
    <Text style={styles.label}>Current Foundation password</Text>
    <TextInput value={password} editable={!busy} onChangeText={setPassword}
     accessibilityLabel="Current password to confirm independent review"
     secureTextEntry autoCapitalize="none" autoCorrect={false}
     placeholder="Enter password" style={styles.input}/>
    {uncertain&&<Text accessibilityRole="alert" style={styles.error}>The previous result is unconfirmed. Re-enter your password and retry the same decision.</Text>}
    {button(busy?"Verifying decision…":"Confirm independent decision",()=>void decide(),
     busy||!password,true)}
   </>}
   {button("Close review",()=>{setSelected(null);setPassword("");setKey(null);},busy||uncertain)}
  </View>}</ScrollView></View></Modal>
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:14,borderRadius:14,borderWidth:1,borderColor:hrTheme.border,
  backgroundColor:hrTheme.surface,gap:9},
 heading:{fontSize:16,fontWeight:"700",color:hrTheme.text},
 label:{fontWeight:"600",fontSize:13,color:hrTheme.text},
 hint:{fontSize:13,lineHeight:19,color:hrTheme.mutedText},
 item:{paddingVertical:9,borderTopWidth:1,borderColor:hrTheme.border,gap:7},
 detail:{borderWidth:1,borderColor:hrTheme.border,borderRadius:10,padding:12,gap:9},
 button:{padding:10,backgroundColor:"#F1F5F9",borderRadius:9,alignSelf:"flex-start"},
 buttonText:{fontSize:13,color:hrTheme.text,fontWeight:"600"},
 primary:{backgroundColor:hrTheme.primary},primaryText:{color:hrTheme.surface},
 input:{minHeight:46,borderColor:hrTheme.border,borderWidth:1,borderRadius:9,
  padding:10,color:hrTheme.text,fontSize:14},
 choices:{flexDirection:"row",flexWrap:"wrap",gap:7},
 chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:9,
  borderWidth:1,borderColor:hrTheme.border},
 chipActive:{backgroundColor:hrTheme.primary,borderColor:hrTheme.primary},
 chipText:{color:hrTheme.text},chipActiveText:{color:hrTheme.surface,fontWeight:"700"},
 error:{color:"#991B1B",backgroundColor:"#FEF2F2",padding:9},
 success:{color:"#166534",backgroundColor:"#ECFDF5",padding:9}
});
