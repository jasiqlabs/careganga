import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import type {CG19VolunteerCardStatus} from "@careganga/api-contracts";
import {identityRequest} from "../identity-access/http-client";
const endpoint="/api/v1/volunteers/documents";
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
async function req<T>(token:string,path:string,body?:Record<string,unknown>):Promise<T>{
 const r=await identityRequest(endpoint+path,{method:body?"POST":"GET",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 const v:unknown=await r.json().catch(()=>null);
 if(!r.ok||v===null)throw Object.assign(new Error("Original official volunteer card status is uncertain. Refresh before retrying."),{status:r.status});
 return v as T;
}
export function NativeVolunteerCardIssuer({token,volunteerRef,onExpired}:{token:string;volunteerRef:string;onExpired:()=>void}){
 const [card,setCard]=useState<CG19VolunteerCardStatus|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const [password,setPassword]=useState("");
 const seq=useRef(0),pending=useRef<{volunteerRef:string;requestKey:string}|null>(null),files=useRef<File[]>([]);
 const refresh=useCallback(async()=>{
  const id=++seq.current;setLoading(true);
  try{
   const x=await req<{card:CG19VolunteerCardStatus|null}>(token,"/volunteers/"+volunteerRef);
   if(id===seq.current){setCard(x.card);setMessage("");}
  }catch(e){if(id===seq.current){setCard(null);setMessage("Current official volunteer document state could not be confirmed.");
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  }}finally{if(id===seq.current)setLoading(false);}
 },[token,volunteerRef,onExpired]);
 useEffect(()=>{void refresh();return()=>{seq.current++;setPassword("");pending.current=null;};},[refresh]);
 useEffect(()=>{
  const clear=()=>{for(const f of files.current)try{f.delete();}catch{}files.current=[];};
  const sub=AppState.addEventListener("change",state=>{
   if(state!=="active"){seq.current++;setCard(null);setPassword("");pending.current=null;clear();setLoading(true);}
   else void refresh();
  });
  return()=>{sub.remove();clear();};
 },[refresh]);
 const act=async(task:(current:()=>boolean)=>Promise<void>)=>{
  if(busy)return;
  const at=seq.current,current=()=>at===seq.current&&AppState.currentState==="active";
  setBusy(true);setMessage("");
  try{await task(current);}catch(e){if(current())setMessage(e instanceof Error?e.message:"Official volunteer card state is uncertain. Check current status.");}
  finally{setPassword("");setBusy(false);}
 };
 const issue=()=>void act(async current=>{
  if(password.length<8)throw Error("Enter current Foundation password before issuing.");
  if(!pending.current||pending.current.volunteerRef!==volunteerRef)pending.current={volunteerRef,requestKey:Crypto.randomUUID()};
  const x=await req<CG19VolunteerCardStatus>(token,"/volunteers/"+volunteerRef+"/issue",{requestKey:pending.current.requestKey,currentPassword:password});
  if(!current())return;
  pending.current=null;setCard(x);setMessage(x.status==="ISSUED"?"Actual approved volunteer card issued.":"Issuance is pending verification. Check current status.");
 });
 const reconcile=()=>void act(async current=>{if(!card?.canRetry)throw Error("This official card is not retryable.");
  const x=await req<CG19VolunteerCardStatus>(token,"/cards/"+card.cardRef+"/reconcile",{});
  if(!current())return;
  setCard(x);
  setMessage(x.status==="ISSUED"?"Approved volunteer card verified and issued.":"Official card state is still pending.");
 });
 const revoke=()=>void act(async current=>{if(!card||password.length<8)throw Error("Enter current password for revocation.");
  const x=await req<CG19VolunteerCardStatus>(token,"/cards/"+card.cardRef+"/revoke",{currentPassword:password});
  if(!current())return;
  setCard(x);setMessage("Issued volunteer card revoked in CG-19.");
 });
 const download=()=>void act(async current=>{
  if(!card||!card.canDownload)throw Error("No original issued card exists.");
  const r=await identityRequest(endpoint+"/cards/"+card.cardRef+"/download",{headers:{Authorization:"Bearer "+token}});
  if(!r.ok||(r.headers.get("content-type")??"").split(";")[0].trim()!=="application/pdf")throw Error("Original card is unavailable.");
  const buffer=await r.arrayBuffer();
  if(!buffer.byteLength||buffer.byteLength>10485760)throw Error("Private PDF source is invalid.");
  if(!current())return;
  const f=new File(Paths.cache,"careganga-official-volunteer-"+Crypto.randomUUID()+".pdf");
  try{
   await f.write(new Uint8Array(buffer));files.current.push(f);
   if(!(await Sharing.isAvailableAsync()))throw Error("Official document sharing is unavailable on this device.");
   if(!current())return;
   await Sharing.shareAsync(f.uri,{mimeType:"application/pdf",dialogTitle:"Issued Foundation volunteer card"});
  }finally{try{f.delete();}catch{}files.current=files.current.filter(x=>x.uri!==f.uri);}
 });
 const action=(text:string,run:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled} onPress={run} style={[s.button,(busy||disabled)&&{opacity:.45}]}><Text style={s.buttonText}>{text}</Text></Pressable>;
 return <View style={s.card}>
  <Text style={s.heading}>Official CG-19 volunteer card</Text>
  <Text style={s.caption}>Issued only for a current independently approved volunteer with real signed Foundation branding. Never a staff role.</Text>
  {loading?<Text>Checking original official issue…</Text>:card?<Text>Current issue: {label(card.status)} · Revision {card.revision}</Text>:<Text>Original volunteer card not issued.</Text>}
  {card?.status==="ISSUED"&&!card.canDownload&&<Text accessibilityRole="alert">This previously issued card is not currently eligible for download. Review the volunteer and approved Foundation branding, then revoke the old card before reissuing.</Text>}
  {card&&["PENDING","UNKNOWN"].includes(card.status)&&!card.canRetry&&<Text accessibilityRole="alert">Issuance cannot be retried until current volunteer eligibility and approved branding are restored.</Text>}
  {!!message&&<Text accessibilityRole="alert">{message}</Text>}
  {(!card||card.status==="REVOKED"||card.canDownload)&&<TextInput accessibilityLabel="Current Foundation password for official card action"
   placeholder="Current Foundation password" secureTextEntry value={password} onChangeText={setPassword} style={s.input}/>}
  {(!card||card.status==="REVOKED")&&action("Issue original approved card",issue,loading||password.length<8)}
  {card?.canRetry&&action("Reconcile authentic issue",reconcile)}
  {card?.canDownload&&<>{action("Open issued private PDF",download)}{action("Revoke official card",revoke,password.length<8)}</>}
  {action("Refresh original card status",()=>void act(refresh))}
 </View>;
}
const s=StyleSheet.create({card:{padding:12,gap:10,borderWidth:1,borderColor:"#d6e2dd",borderRadius:11,backgroundColor:"white"},
 heading:{fontSize:16,fontWeight:"700",color:"#123e32"},caption:{fontSize:12,color:"#425a65"},
 input:{minHeight:44,borderWidth:1,borderColor:"#b8cfbf",borderRadius:8,padding:10},
 button:{minHeight:44,justifyContent:"center",padding:10,borderWidth:1,borderColor:"#b8cfbf",borderRadius:8},
 buttonText:{fontWeight:"600",color:"#123e32"}});
