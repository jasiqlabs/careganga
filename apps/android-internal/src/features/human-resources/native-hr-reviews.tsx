import React,{useCallback,useEffect,useState} from "react";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Case={caseRef:string;reference:string;name:string;status:string;revision:number;canReview:boolean};
type Detail={caseRef:string;reference:string;name:string;status:string;
 designation:string;employmentType:string;revision:number;canDecide:boolean;
 evidence:{classification:string;verified:boolean}[]};
type Decision="APPROVE"|"RETURN"|"REJECT";
async function api<T>(token:string,path:string,method="GET",body?:object):Promise<T>{
 const response=await identityRequest("/api/hr/reviews"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
  ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Session expired. Sign in again.":
  response.status===403?"Current role cannot review this protected HR case.":
  response.status===409?"Original review state changed. Refresh before deciding.":
  "Independent enrollment decision cannot be verified. Check the original case."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,v=>v.toUpperCase());
export function NativeHrReviews({token,onExpired}:{
 token:string;onExpired:()=>void;
}){
 const [cases,setCases]=useState<Case[]>([]);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [action,setAction]=useState<Decision>("APPROVE");
 const [password,setPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [key,setKey]=useState<string|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Original reviewer access cannot be confirmed.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const response=await api<{items:Case[]}>(token,"?offset=0");
   if(!response||!Array.isArray(response.items))
    throw Error("The Foundation employee review inbox cannot be verified.");
   setCases(response.items);
  }catch(e){setCases([]);failure(e);}
  finally{setLoading(false);}
 },[token,failure]);
 useEffect(()=>{void refresh();},[refresh]);
 const open=async(ref:string)=>{
  setBusy(true);setError("");setNotice("");setPassword("");setKey(null);
  try{
   const result=await api<Detail>(token,"/"+encodeURIComponent(ref));
   if(!result?.caseRef||!result.status)
    throw Error("Original employee review details are unavailable.");
   setSelected(result);
  }catch(e){setSelected(null);failure(e);}
  finally{setBusy(false);}
 };
 const decide=async()=>{
  if(!selected?.canDecide||!password||busy)return;
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
   setSelected(null);setPassword("");setRemarks("");setKey(null);
   await refresh();
  }catch(e){setPassword("");failure(e);}
  finally{setBusy(false);}
 };
 const preview=async(kind:string)=>{
  if(!selected||busy)return;
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
  {button(loading?"Loading…":"Refresh original inbox",()=>void refresh(),loading||busy)}
  {cases.length===0&&!loading&&<Text style={styles.hint}>No original review cases.</Text>}
  {cases.map(item=><View key={item.caseRef} style={styles.item}>
   <Text style={styles.label}>{item.name}</Text>
   <Text style={styles.hint}>{item.reference} · {label(item.status)}</Text>
   {button("View original review",()=>void open(item.caseRef),busy)}
  </View>)}
  {selected&&<View style={styles.detail}>
   <Text style={styles.heading}>{selected.name} — {selected.designation}</Text>
   <Text style={styles.hint}>{selected.reference} · {label(selected.status)}</Text>
   <Text style={styles.label}>Scanner-verified source evidence</Text>
   {selected.evidence.map((e,i)=><View key={i} style={{gap:5}}>
    <Text style={styles.hint}>
     {label(e.classification)} · {e.verified?"Verified":"Not verified"}</Text>
    {e.verified&&button("View original protected proof",
      ()=>void preview(e.classification),busy)}
   </View>)}
   {selected.canDecide&&<>
    <Text style={styles.label}>Your decision</Text>
    <View style={styles.choices}>
     {(["APPROVE","RETURN","REJECT"] as Decision[]).map(a=>
      <Pressable key={a} accessibilityRole="button"
       accessibilityState={{selected:action===a}}
       style={[styles.chip,action===a&&styles.chipActive]}
       onPress={()=>{setAction(a);setKey(null);setPassword("");}}>
       <Text style={action===a?styles.chipActiveText:styles.chipText}>{label(a)}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>Remarks (optional)</Text>
    <TextInput value={remarks} onChangeText={v=>{setRemarks(v);setKey(null);}}
     accessibilityLabel="Reviewer remarks" maxLength={500}
     style={[styles.input,{minHeight:80}]} multiline
     placeholder="Reason for decision"/>
    <Text style={styles.label}>Current Foundation password</Text>
    <TextInput value={password} onChangeText={v=>{setPassword(v);setKey(null);}}
     accessibilityLabel="Current password to confirm independent review"
     secureTextEntry autoCapitalize="none" autoCorrect={false}
     placeholder="Enter password" style={styles.input}/>
    {button(busy?"Verifying decision…":"Confirm independent decision",()=>void decide(),
     busy||!password,true)}
   </>}
   {button("Close review",()=>{setSelected(null);setPassword("");setKey(null);},busy)}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:14,borderRadius:14,borderWidth:1,borderColor:"#E2E8F0",
  backgroundColor:"#fff",gap:9},
 heading:{fontSize:16,fontWeight:"700",color:"#0F172A"},
 label:{fontWeight:"600",fontSize:13,color:"#334155"},
 hint:{fontSize:13,lineHeight:19,color:"#64748B"},
 item:{paddingVertical:9,borderTopWidth:1,borderColor:"#E2E8F0",gap:7},
 detail:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:10,padding:12,gap:9},
 button:{padding:10,backgroundColor:"#F1F5F9",borderRadius:9,alignSelf:"flex-start"},
 buttonText:{fontSize:13,color:"#0F172A",fontWeight:"600"},
 primary:{backgroundColor:"#087F8C"},primaryText:{color:"#fff"},
 input:{minHeight:46,borderColor:"#CBD5E1",borderWidth:1,borderRadius:9,
  padding:10,color:"#0F172A",fontSize:14},
 choices:{flexDirection:"row",flexWrap:"wrap",gap:7},
 chip:{paddingVertical:9,paddingHorizontal:12,borderRadius:9,
  borderWidth:1,borderColor:"#CBD5E1"},
 chipActive:{backgroundColor:"#0369A1",borderColor:"#0369A1"},
 chipText:{color:"#334155"},chipActiveText:{color:"#fff",fontWeight:"700"},
 error:{color:"#991B1B",backgroundColor:"#FEF2F2",padding:9},
 success:{color:"#166534",backgroundColor:"#ECFDF5",padding:9}
});
