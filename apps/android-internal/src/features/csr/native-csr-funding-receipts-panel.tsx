import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
type Summary={sourceVersion:number;csrCommittedMinor:string;foundationCommittedMinor:string;
 csrReceivedMinor:string;foundationReceivedMinor:string;
 csrNeedsRevalidationMinor:string;foundationNeedsRevalidationMinor:string};
type Candidate={reconciliationRef:string;verifiedDate:string;amountMinor:string;
 bankName:string;bankItemMasked:string};
type Command={requestKey:string;expectedVersion:number;partyKind:"CSR"|"FOUNDATION";reconciliationRef:string;remitterConfirmed:true};
const money=(minor:string)=>{try{const n=BigInt(minor);return "₹"+(n/100n).toLocaleString("en-IN")+
 "."+(n%100n).toString().padStart(2,"0");}catch{return "Amount unavailable";}};
export function NativeCsrFundingReceiptsPanel({token,proposalRef,version,canLink,onExpired}:{
 token:string;proposalRef:string;version:number;canLink:boolean;onExpired:()=>void}){
 const [summary,setSummary]=useState<Summary|null>(null);
 const [options,setOptions]=useState<Candidate[]>([]);
 const [chosen,setChosen]=useState(""),[party,setParty]=useState<"CSR"|"FOUNDATION">("CSR");
 const [remitterConfirmed,setRemitterConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState<Command|null>(null),[epoch,setEpoch]=useState(0);
 const sequence=useRef(0),lock=useRef(false);
 const api=async<T,>(suffix:string,command?:Command):Promise<T>=>{
  const r=await identityRequest("/api/v1/csr/funding-proposals/"+proposalRef+
   "/finance"+suffix,{cache:"no-store",headers:{
    Authorization:"Bearer "+token,...(command?{"Content-Type":"application/json"}:{})},
    ...(command?{method:"POST",body:JSON.stringify(command)}:{})});
  if(r.status===401){onExpired();throw Object.assign(Error("Sign in again."),{status:401});}
  const value:unknown=await r.json().catch(()=>null);
  if(!r.ok||value===null)throw Object.assign(Error(
   r.status===403?"Original branch or finance permission is unavailable.":
   r.status===409?"Original CG09 money or proposal changed. Refresh.":
   "Bank verification result uncertain."),{status:r.status||503});
  return value as T;
 };
 useEffect(()=>{
  let live=true;const n=++sequence.current;setLoading(true);setError("");
  void Promise.all([api<Summary>(""),
   api<{items:Candidate[]}>("/eligible-receipts")]).then(([v,candidates])=>{
   if(!live||sequence.current!==n)return;
   if(v.sourceVersion!==version)throw Error("Funding version changed; refresh.");
   setSummary(v);setOptions(candidates.items);setChosen("");setRemitterConfirmed(false);
   setParty(BigInt(v.csrCommittedMinor)>0n?"CSR":"FOUNDATION");
  }).catch(e=>{if(live&&sequence.current===n){setSummary(null);setOptions([]);
   setError(e instanceof Error?e.message:"Finance verification unavailable.");}})
   .finally(()=>{if(live&&sequence.current===n)setLoading(false);});
  return()=>{live=false;sequence.current++;};
 },[token,proposalRef,version,epoch]);
 const link=async()=>{
  if(lock.current||!canLink||loading||!summary||!chosen&&!pending||!remitterConfirmed&&!pending)return;
  if(!pending&&!options.some(v=>v.reconciliationRef===chosen))return;
  const input=pending??{requestKey:Crypto.randomUUID(),expectedVersion:version,
   partyKind:party,reconciliationRef:chosen,remitterConfirmed:true as const};
  lock.current=true;setBusy(true);setPending(input);setError("");setNotice("");
  try{
   await api("/receipts",input);
   setPending(null);setChosen("");setRemitterConfirmed(false);
   setNotice("Original CG09 verified bank receipt linked. Not allocated.");
   setEpoch(x=>x+1);
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status>0&&status<500)setPending(null);
   setError(status>=500||status===0?
    "Bank link result uncertain. Retry the EXACT request or check original CG09.":
    e instanceof Error?e.message:"Receipt linking rejected.");
  }finally{lock.current=false;setBusy(false);}
 };
 const button=(name:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button"
  accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy}
  onPress={fn} style={[styles.button,(disabled||busy)&&{opacity:.5}]}>
  <Text style={styles.buttonText}>{name}</Text></Pressable>;
 return <View style={styles.panel}>
  <Text style={styles.title}>Verified CG09 bank receipts</Text>
  <Text style={styles.note}>Only an independently reconciled original bank deposit
   counts as received. It is NOT a CG09 budget allocation or expense.</Text>
  {loading?<ActivityIndicator/>:summary&&<>
   <Text>CSR committed {money(summary.csrCommittedMinor)}</Text>
   <Text>CSR bank received {money(summary.csrReceivedMinor)}</Text>
   <Text>Foundation committed {money(summary.foundationCommittedMinor)}</Text>
   <Text>Foundation bank received {money(summary.foundationReceivedMinor)}</Text>
   <Text style={styles.note}>Allocation: not yet linked to CG09 approved budget.</Text>
   {(BigInt(summary.csrNeedsRevalidationMinor)>0n||
    BigInt(summary.foundationNeedsRevalidationMinor)>0n)&&
    <Text accessibilityRole="alert" style={styles.error}>Linked statement was revoked or
     journal reversed. Do not allocate this money until checked.</Text>}
   {canLink&&<View style={styles.panel}>
    <Text style={styles.note}>First post a real General journal and complete independent
     bank-statement reconciliation in Finance.</Text>
    {options.map((o,i)=><Pressable key={o.reconciliationRef}
     disabled={busy||!!pending} accessibilityRole="radio"
     accessibilityState={{checked:chosen===o.reconciliationRef}}
     style={[styles.option,chosen===o.reconciliationRef&&styles.chosen]}
     onPress={()=>setChosen(o.reconciliationRef)}>
     <Text style={styles.note}>{i+1}. {o.verifiedDate} · {o.bankName} {o.bankItemMasked} · {money(o.amountMinor)}</Text>
    </Pressable>)}
    {BigInt(summary.csrCommittedMinor)>0n&&button(
     (party==="CSR"?"● ":"○ ")+"CSR partner share",()=>setParty("CSR"),!!pending)}
    {BigInt(summary.foundationCommittedMinor)>0n&&button(
     (party==="FOUNDATION"?"● ":"○ ")+"Foundation share",()=>setParty("FOUNDATION"),!!pending)}
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:remitterConfirmed}}
     disabled={busy||!!pending} onPress={()=>setRemitterConfirmed(v=>!v)}
     style={styles.option}>
     <Text style={styles.note}>{remitterConfirmed?"☑":"☐"} I checked the actual
      CG09 bank statement and confirmed the remitter belongs to this selected
      CSR partner or Foundation share. Bank reconciliation alone does not prove
      the payer.</Text>
    </Pressable>
    {button(pending?"Retry exact bank receipt link":"Link verified original bank receipt",
      ()=>void link(),!pending&&(!chosen||!remitterConfirmed))}
   </View>}
  </>}
  {button("Refresh original CG09 verification",()=>setEpoch(x=>x+1))}
  {!!notice&&<Text style={styles.success}>{notice}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:13,backgroundColor:"#fff",borderWidth:1,borderColor:"#CBD5E1",borderRadius:12,gap:10},
 title:{color:"#0F172A",fontWeight:"700",fontSize:16},note:{color:"#526477",fontSize:13},
 option:{padding:11,borderRadius:8,borderWidth:1,borderColor:"#CBD5E1"},
 chosen:{borderColor:"#1D4ED8",backgroundColor:"#EFF6FF"},
 button:{padding:11,borderRadius:8,borderWidth:1,borderColor:"#CBD5E1"},
 buttonText:{fontSize:13,fontWeight:"600",color:"#1D4ED8"},
 error:{color:"#B91C1C",fontSize:13},success:{color:"#166534",fontSize:13}
});
