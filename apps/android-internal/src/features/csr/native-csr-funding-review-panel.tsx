import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import {File,Paths} from "expo-file-system";

import {identityRequest} from "../identity-access/http-client";
type Review={caseRef:string;reference:string;status:string;revision:number;title:string;canDecide:boolean};
type Detail={caseRef:string;reference:string;status:string;revision:number;canDecide:boolean;
 source:{purpose:string;amountMinor:string;csrRequestedMinor:string;
 foundationRequestedMinor:string;csrShareBps:number;foundationShareBps:number;currency:string};
 history:{action:string;remarks:string;actor:string}[]};
type List={items:Review[];hasMore:boolean};
type Policy={configured:boolean};
type Choice="APPROVE"|"RETURN"|"REJECT";
type Decision={requestKey:string;expectedRevision:number;action:Choice;remarks:string;currentPassword:string};
const origin="/api/v1/csr-funding-reviews";
const formatAmount=(minor:string)=>{
 try{const x=BigInt(minor);return "₹"+(x/100n).toLocaleString("en-IN")+
 "."+(x%100n).toString().padStart(2,"0");}
 catch{return "Amount unavailable";}
};
export function NativeCsrFundingReviews({token,canConfigure,onExpired}:{token:string;canConfigure:boolean;onExpired:()=>void}){
 const [rows,setRows]=useState<List>({items:[],hasMore:false}),[policy,setPolicy]=useState<Policy|null>(null);
 const [detail,setDetail]=useState<Detail|null>(null),[query,setQuery]=useState(""),[offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [choice,setChoice]=useState<Choice>("APPROVE"),[remarks,setRemarks]=useState(""),[password,setPassword]=useState("");
 const [pending,setPending]=useState<{ref:string;body:Decision}|null>(null),seq=useRef(0);
 const refresh=()=>setEpoch(n=>n+1);
 const request=async<T,>(path:string,payload?:Record<string,unknown>):Promise<T>=>{
  const r=await identityRequest(origin+path,{cache:"no-store",headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json"}:{})},
   ...(payload?{method:"POST",body:JSON.stringify(payload)}:{})});
  if(r.status===401){onExpired();throw Object.assign(Error("Sign in again."),{status:401});}
  const v:unknown=await r.json().catch(()=>null);
  if(!r.ok||v===null)throw Object.assign(Error(
   r.status===403?"Your current role is not authorized for this protected funding decision.":
   r.status===409?"funding proposal or review changed. Refresh before continuing.":"Protected funding review could not be confirmed."),{status:r.status||503});
  return v as T;
 };
 useEffect(()=>{let live=true;const n=++seq.current;setLoading(true);
  const params=new URLSearchParams({q:query.trim().slice(0,80),offset:String(offset)});
  void Promise.all([request<List>("?"+params),request<Policy>("/policy")]).then(([list,config])=>{
   if(live&&seq.current===n){setRows(list);setPolicy(config);setError("");}
  }).catch(e=>{if(live&&seq.current===n){setRows({items:[],hasMore:false});setError(e instanceof Error?e.message:"Protected funding reviews unavailable.");}})
   .finally(()=>{if(live&&seq.current===n)setLoading(false);});
  return()=>{live=false;};
 },[token,query,offset,epoch]);
 const inspect=async(id:string)=>{
  if(busy||pending)return;const current=++seq.current;setError("");setDetail(null);
  try{const value=await request<Detail>("/"+id);if(seq.current!==current)return;
   setDetail(value);setPassword("");setRemarks("");setChoice("APPROVE");setPending(null);}
  catch(e){setError(e instanceof Error?e.message:"Current funding review unavailable.");}
 };
 const configure=async()=>{
  if(!canConfigure||busy||password.length<8)return;setBusy(true);setError("");
  try{await request("/policy",{currentPassword:password});setPassword("");setNotice("Protected funding review configured.");refresh();}
  catch(e){setError(e instanceof Error?e.message:"Original funding review policy unavailable.");}
  finally{setBusy(false);}
 };
 const decide=async()=>{
  if(!detail||!detail.canDecide||busy)return;
  if(!pending&&(password.length<8||choice!=="APPROVE"&&remarks.trim().length<3))return;
  const body=pending?.body??{requestKey:Crypto.randomUUID(),expectedRevision:detail.revision,action:choice,remarks,currentPassword:password};
  const ref=pending?.ref??detail.caseRef;setPending({ref,body});setBusy(true);setError("");
  try{await request("/"+ref+"/decide",body);setPassword("");setPending(null);setDetail(null);
   setNotice("Original independent funding decision saved.");refresh();
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>0&&status<500){setPassword("");setPending(null);}
   setError(e instanceof Error?e.message:"funding review outcome uncertain. Check original case before retrying.");
  }finally{setBusy(false);}
 };
 const inspectAgreement=async()=>{
  if(!detail||detail.status!=="SUBMITTED"||busy)return;
  let local:File|null=null;
  setBusy(true);setError("");
  try{
   if(!await Sharing.isAvailableAsync())throw Error("Private document viewer is not available on this device.");
   const r=await identityRequest(origin+"/"+detail.caseRef+"/agreement",{
    method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}});
   if(r.status===401){onExpired();throw Error("Sign in again to review the agreement.");}
   if(!r.ok)throw Error(r.status===403?"This protected agreement is no longer permitted.":
     "The verified agreement is unavailable. Refresh the current case.");
   const mime=r.headers.get("content-type")?.split(";")[0]??"";
   const suffix=mime==="application/pdf"?".pdf":mime==="image/jpeg"?".jpg":
    mime==="image/png"?".png":mime==="image/webp"?".webp":"";
   if(!suffix)throw Error("The protected agreement type could not be verified.");
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(!bytes.length||bytes.length>10485760)throw Error("The private document size is invalid.");
   local=new File(Paths.cache,"cg08-review-"+Crypto.randomUUID()+suffix);
   local.create();local.write(bytes);
   await Sharing.shareAsync(local.uri,{mimeType:mime,dialogTitle:"Open protected funding agreement"});
  }catch(e){setError(e instanceof Error?e.message:"The original agreement cannot be viewed.");}
  finally{if(local)try{local.delete();}catch{}setBusy(false);}
 };
 const button=(title:string,click:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled} accessibilityState={{disabled:busy||disabled}}
  style={[styles.button,(busy||disabled)&&{opacity:.5}]} onPress={click}><Text style={styles.buttonText}>{title}</Text></Pressable>;
 return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
  <Text style={styles.title}>Independent Funding Approvals</Text>
  <Text style={styles.muted}>A different Foundation protected reviewer must check signed funding terms. No CG09 cash is posted here.</Text>
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {policy&&!policy.configured&&<View style={styles.card}>
   <Text>Original protected funding review requires configuration.</Text>
   {canConfigure&&<><TextInput style={styles.input} secureTextEntry placeholder="Current password" value={password} onChangeText={setPassword}/>
    {button("Configure protected review",()=>void configure(),password.length<8)}</>}
  </View>}
  <View style={styles.card}>
   <Text>Search funding proposals</Text>
   <TextInput style={styles.input} placeholder="Organization or review reference" value={query} onChangeText={v=>{seq.current++;setDetail(null);setQuery(v);setOffset(0);}}/>
   {button("Refresh list",refresh)}
   {loading?<ActivityIndicator/>:rows.items.length===0?<Text style={styles.muted}>No matching funding reviews.</Text>:
    rows.items.map(x=><View key={x.caseRef} style={styles.item}>
     <Text style={styles.itemTitle}>{x.title}</Text><Text style={styles.muted}>{x.reference} · {x.status.replaceAll("_"," ")}</Text>
     {button("Open protected review",()=>void inspect(x.caseRef))}
    </View>)}
   <View style={styles.row}>{button("Previous",()=>{seq.current++;setDetail(null);setOffset(n=>Math.max(0,n-25));},loading||offset===0)}
    <Text>Page {1+Math.floor(offset/25)}</Text>{button("Next",()=>{seq.current++;setDetail(null);setOffset(n=>n+25);},loading||!rows.hasMore)}</View>
  </View>
  {detail&&<View style={styles.card}>
   <Text style={styles.itemTitle}>{detail.source.purpose} — {detail.reference}</Text>
   <Text>Requested: {formatAmount(detail.source.amountMinor)} (not bank cash)</Text>
   <Text>CSR share: {formatAmount(detail.source.csrRequestedMinor)} ({detail.source.csrShareBps/100}%)</Text>
   <Text>Foundation share: {formatAmount(detail.source.foundationRequestedMinor)} ({detail.source.foundationShareBps/100}%)</Text>
   <Text style={styles.muted}>Status: {detail.status.replaceAll("_"," ")}</Text>
   {detail.status==="SUBMITTED"&&button("Open protected verified agreement",()=>void inspectAgreement())}
   {detail.history.map((h,i)=><Text key={i} style={styles.muted}>{h.actor}: {h.action} {h.remarks}</Text>)}
   {detail.canDecide&&<View style={styles.card}>
    <Text style={styles.itemTitle}>Original independent decision</Text>
    <View style={styles.row}>{(["APPROVE","RETURN","REJECT"] as Choice[]).map(v=><Pressable key={v}
     disabled={busy||!!pending} accessibilityRole="radio" accessibilityState={{checked:choice===v}}
     style={[styles.button,choice===v&&{backgroundColor:"#DBEAFE"}]} onPress={()=>setChoice(v)}><Text>{v}</Text></Pressable>)}</View>
    <TextInput style={styles.input} placeholder="Review remarks" value={remarks} onChangeText={setRemarks} maxLength={500} editable={!pending}/>
    <TextInput style={styles.input} secureTextEntry placeholder="Current password" value={password} onChangeText={setPassword} editable={!pending}/>
    {button(pending?"Retry original decision":"Confirm independent funding decision",()=>void decide(),!pending&&(password.length<8||choice!=="APPROVE"&&remarks.trim().length<3))}
   </View>}
   {button("Close review",()=>{setDetail(null);setPassword("");setPending(null);})}
  </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 body:{padding:16,paddingBottom:110,backgroundColor:"#F8FAFC",gap:12},
 card:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#CBD5E1",borderRadius:12,padding:13,gap:10},
 title:{fontSize:21,fontWeight:"800",color:"#0F172A"},
 itemTitle:{fontSize:15,fontWeight:"700",color:"#0F172A"},
 item:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#E2E8F0",gap:6},
 muted:{fontSize:13,color:"#64748B",lineHeight:19},
 row:{flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},
 input:{padding:11,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,minHeight:44,color:"#0F172A"},
 button:{padding:10,borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,backgroundColor:"#FFFFFF"},
 buttonText:{fontWeight:"600",color:"#1D4ED8",fontSize:13},
 success:{fontSize:13,color:"#166534"},error:{fontSize:13,color:"#B91C1C"}
});
