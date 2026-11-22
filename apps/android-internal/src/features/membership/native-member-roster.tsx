import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import type {CG04RosterPage,CG04RosterExport} from "@careganga/api-contracts";
import {identityRequest} from "../identity-access/http-client";

type Filter={q:string;status:string;category:string;branch:string};
const empty=():Filter=>({q:"",status:"ALL",category:"ALL",branch:""});
const statuses=[["ALL","All"],["ACTIVE","Active"],["EXPIRED","Expired"],["SUSPENDED","Suspended"],["CANCELLED","Cancelled"]];
const categories=[["ALL","All tiers"],["ANNUAL","Annual"],["LIFETIME","Lifetime"],["HONORARY","Honorary"],["STUDENT","Student"],["OTHER","Other"]];
export function NativeMemberRoster({token,canExport,onExpired}:{token:string;canExport:boolean;onExpired:()=>void}){
 const [draft,setDraft]=useState<Filter>(empty),[filter,setFilter]=useState<Filter>(empty),[cursor,setCursor]=useState(""),[history,setHistory]=useState<string[]>([]);
 const [page,setPage]=useState<CG04RosterPage|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[epoch,setEpoch]=useState(0);
 const seq=useRef(0),exporting=useRef(false),foreground=useRef(true);
 async function request<T>(url:string):Promise<T>{
  const response=await identityRequest(url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(response.status===401){onExpired();throw Error("Sign in again.");}
  if(!response.ok)throw Error(response.status===403?"Your role or branch cannot view these membership records.":response.status===400?"Check the selected membership filters.":response.status===429?"Too many requests. Try again shortly.":"Member records could not be confirmed. Refresh and retry.");
  return await response.json() as T;
 }
 useEffect(()=>{const sub=AppState.addEventListener("change",s=>{
  foreground.current=s==="active";
  if(s!=="active"){seq.current++;setPage(null);setLoading(true);}
  else setEpoch(x=>x+1);
 });return()=>sub.remove();},[]);
 useEffect(()=>{
  const n=++seq.current;setPage(null);setLoading(true);setError("");
  const params=new URLSearchParams({...filter,cursor});
  void request<CG04RosterPage>("/api/v1/membership/members?"+params.toString()).then(result=>{
   if(n===seq.current&&foreground.current)setPage(result);
  }).catch(e=>{if(n===seq.current&&foreground.current)setError(e instanceof Error?e.message:"Membership records unavailable.");})
  .finally(()=>{if(n===seq.current&&foreground.current)setLoading(false);});
  return()=>{seq.current++;};
 },[token,filter,cursor,epoch]);
 const apply=()=>{setHistory([]);setCursor("");setFilter({...draft,q:draft.q.trim()});};
 const reset=()=>{setDraft(empty());setFilter(empty());setCursor("");setHistory([]);};
 const chip=(label:string,onPress:()=>void,selected=false,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[styles.chip,selected&&styles.chipSelected,disabled&&styles.disabled]}><Text style={[styles.chipText,selected&&styles.chipTextSelected]}>{label}</Text></Pressable>
 );
 async function shareCsv(){
  if(exporting.current)return;exporting.current=true;setBusy(true);setError("");setNotice("");
  let file:File|null=null;
  try{
   const params=new URLSearchParams(filter);
   const data=await request<CG04RosterExport>("/api/v1/membership/members/export?"+params.toString());
   if(typeof data.csv!=="string"||!Number.isSafeInteger(data.rows)||data.rows<0||data.rows>500)throw Error("Member export could not be verified.");
   if(!await Sharing.isAvailableAsync())throw Error("Private file sharing is unavailable on this device.");
   file=new File(Paths.cache,"careganga-member-roster-"+Crypto.randomUUID()+".csv");
   file.create();file.write(data.csv);
   await Sharing.shareAsync(file.uri,{mimeType:"text/csv",dialogTitle:"Share permitted member roster"});
   setNotice(data.rows+" approved member records prepared. Handle this private roster securely.");
  }catch(e){setError(e instanceof Error?e.message:"Roster export unavailable.");}
  finally{try{file?.delete();}catch{}exporting.current=false;setBusy(false);}
 }
 const disabled=busy||loading;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
  <Text style={styles.heading}>Membership Program</Text>
  <Text style={styles.muted}>Approved member directory. Only current permitted Foundation records are shown.</Text>
  <View style={styles.buttons}>{chip("Refresh",()=>setEpoch(x=>x+1),false,busy)}{canExport&&chip(busy?"Preparing…":"Export roster",()=>void shareCsv(),false,disabled||!page)}</View>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="text" style={styles.muted}>{notice}</Text>}
  <View style={styles.card}>
   <Text style={styles.title}>Find members</Text>
   <TextInput accessibilityLabel="Member name, number or contact" placeholder="Search member number, name or contact" value={draft.q} maxLength={100} onChangeText={v=>setDraft(x=>({...x,q:v}))} style={styles.input}/>
   <Text style={styles.label}>Membership status</Text>
   <View style={styles.buttons}>{statuses.map(([v,l])=><React.Fragment key={v}>{chip(l,()=>setDraft(x=>({...x,status:v})),draft.status===v,disabled)}</React.Fragment>)}</View>
   <Text style={styles.label}>Membership type</Text>
   <View style={styles.buttons}>{categories.map(([v,l])=><React.Fragment key={v}>{chip(l,()=>setDraft(x=>({...x,category:v})),draft.category===v,disabled)}</React.Fragment>)}</View>
   <Text style={styles.label}>Foundation branch</Text>
   <View style={styles.buttons}>{chip("All permitted",()=>setDraft(x=>({...x,branch:""})),!draft.branch,disabled)}
    {page?.branchOptions.map(b=><React.Fragment key={b.value}>{chip(b.label,()=>setDraft(x=>({...x,branch:b.value})),draft.branch===b.value,disabled)}</React.Fragment>)}</View>
   <View style={styles.buttons}>{chip("Search",apply,false,disabled)}{chip("Reset",reset,false,disabled)}</View>
  </View>
  {loading&&<ActivityIndicator accessibilityLabel="Loading permitted members"/>}
  {page&&!loading&&<>
   <Text style={styles.muted}>Showing {page.items.length} approved member records on this page.</Text>
   {!page.items.length&&<Text style={styles.muted}>No approved members match these filters.</Text>}
   {page.items.map(m=><View key={m.ref} style={styles.card}>
    <Text style={styles.title}>{m.name}</Text><Text style={styles.muted}>{m.memberNumber} · {m.status}</Text>
    <Text>Plan: {m.plan} ({m.category})</Text>
    <Text>Joined: {m.joinedOn} · Valid until: {m.expiresOn??"Lifetime"}</Text>
    <Text>Location: {m.city}, {m.district} · {m.branch??"Foundation"}</Text>
    <Text>Contact: {m.mobile}{m.email?" · "+m.email:""}</Text>
   </View>)}
   <View style={styles.buttons}>{chip("Previous page",()=>{setCursor(history.at(-1)??"");setHistory(x=>x.slice(0,-1));},false,disabled||!history.length)}
    {chip("Next page",()=>{setHistory(x=>[...x,cursor]);setCursor(page.nextCursor??"");},false,disabled||!page.nextCursor)}</View>
  </>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{padding:16,paddingBottom:110,gap:12,backgroundColor:"#F8FAFC"},
 heading:{fontSize:23,fontWeight:"800",color:"#0F172A"},
 title:{fontSize:16,fontWeight:"700",color:"#0F172A"},
 muted:{fontSize:13,color:"#475569",lineHeight:19},
 label:{fontSize:13,fontWeight:"600",color:"#334155"},
 error:{color:"#B91C1C",fontSize:13},
 card:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#E2E8F0",borderRadius:12,padding:14,gap:9},
 input:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:9,padding:11,color:"#0F172A"},
 buttons:{flexDirection:"row",flexWrap:"wrap",gap:8},
 chip:{borderWidth:1,borderColor:"#BFDBFE",backgroundColor:"#EFF6FF",borderRadius:9,paddingVertical:9,paddingHorizontal:12},
 chipSelected:{backgroundColor:"#0369A1",borderColor:"#0369A1"},
 chipText:{color:"#0F4C81",fontWeight:"600",fontSize:13},
 chipTextSelected:{color:"#FFFFFF"},
 disabled:{opacity:0.45}
});
