import {useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import type {CG04Application,CG04ApplicantOptions,CG04PublicTier} from "@careganga/api-contracts";
import {memberInvoke} from "./member-native-api";
import {NativeReferralCodeCheck} from "../referrals/native-referral-code-check";
type Draft={address:string;city:string;pinCode:string;stateRef:string;districtRef:string;branchRef:string;referral:string;consent:boolean};
type Command={path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const blank=():Draft=>({address:"",city:"",pinCode:"",stateRef:"",districtRef:"",branchRef:"",referral:"",consent:false});
const rupees=(minor:string)=>{if(!/^[0-9]{1,15}$/.test(minor))return "Unavailable";const value=BigInt(minor);return "₹"+(value/100n).toString()+(value%100n===0n?"":"."+String(value%100n).padStart(2,"0"));};
export function NativeMemberApplication({token,application,plans,initialPlan,onSaved}:{token:string;application:CG04Application|null;plans:CG04PublicTier[];initialPlan?:string|null;onSaved:()=>Promise<void>}){
 const [draft,setDraft]=useState<Draft>(blank),[offer,setOffer]=useState(""),[options,setOptions]=useState<CG04ApplicantOptions|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const pending=useRef<Command|null>(null);
 useEffect(()=>{setOffer(application?.planCode??initialPlan??plans[0]?.planCode??"");setDraft(application?{address:application.address,city:application.city,pinCode:application.pinCode,stateRef:application.stateRef,districtRef:application.districtRef,branchRef:application.branchRef??"",referral:application.referral,consent:false}:blank());},[application?.ref,application?.version,initialPlan,plans.length]);
 useEffect(()=>{let active=true;void memberInvoke<CG04ApplicantOptions>("/api/v1/membership/applications/options"+(draft.stateRef?"?stateRef="+encodeURIComponent(draft.stateRef):""),"GET",undefined,token).then(v=>{if(active)setOptions(v)}).catch(()=>{if(active)setOptions(null)});return()=>{active=false};},[draft.stateRef,token]);
 const selectedOffer=plans.find(p=>p.planCode===offer);
 const field=(label:string,key:"address"|"city"|"pinCode"|"referral")=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={draft[key]} onChangeText={v=>setDraft(d=>({...d,[key]:v}))} multiline={key==="address"} keyboardType={key==="pinCode"?"numeric":"default"} maxLength={key==="pinCode"?6:key==="address"?1000:key==="referral"?100:120}/></View>;
 const selector=(label:string,selected:string,items:{value:string;label:string}[],onSelect:(v:string)=>void)=><View style={s.field}><Text style={s.label}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.row}>
 {items.map(x=><Pressable accessibilityRole="button" accessibilityState={{selected:selected===x.value}} key={x.value} onPress={()=>onSelect(x.value)} style={[s.choice,selected===x.value&&s.active]}><Text style={{color:selected===x.value?"#fff":"#174632"}}>{x.label}</Text></Pressable>)}
 </ScrollView></View>;
 const send=async(cmd:Command)=>{if(busy)return;setBusy(true);setMessage("");
  try{await memberInvoke(cmd.path,cmd.method,cmd.body,token);pending.current=null;await onSaved();setMessage("Application saved. Verify your identity proof before submitting.");}
  catch(e){setMessage(e instanceof Error?e.message:"Save outcome uncertain. Check before retrying.");}
  finally{setBusy(false);}
 };
 const save=()=>{if(busy||pending.current||!draft.consent)return;const p=plans.find(p=>p.planCode===offer)??(application?.planCode===offer?{planCode:offer,offerRevision:application.offerRevision}:null);
  if(!p){setMessage("Choose a current membership plan.");return;}
  if(!draft.stateRef||!draft.districtRef||draft.address.trim().length<5||draft.city.trim().length<2||!/^[1-9][0-9]{5}$/.test(draft.pinCode.trim())){setMessage("Enter your address, city, PIN, state and district.");return;}
  const body={requestKey:Crypto.randomUUID(),planCode:p.planCode,offerRevision:p.offerRevision,address:draft.address,city:draft.city,pinCode:draft.pinCode,stateRef:draft.stateRef,districtRef:draft.districtRef,branchRef:draft.branchRef||null,referral:draft.referral,consent:true,...(application?{expectedVersion:application.version}:{})};
  const cmd={path:"/api/v1/membership/applications"+(application?"/"+application.ref:""),method:application?"PATCH" as const:"POST" as const,body};pending.current=cmd;void send(cmd);
 };
 return <View style={s.card}><Text accessibilityRole="header" style={s.title}>{application?"Correct application":"Apply for membership"}</Text>
 {!!message&&<Text accessibilityRole="alert">{message}</Text>}
 {selector("Membership plan",offer,plans.map(p=>({value:p.planCode,label:p.name})).concat(application&&!plans.some(p=>p.planCode===application.planCode)?[{value:application.planCode,label:application.plan+" (original offer)"}]:[]),setOffer)}
 {selectedOffer&&<View style={s.offer}><Text style={s.label}>Selected membership plan</Text><Text>{selectedOffer.name} · {rupees(selectedOffer.feeMinor)} · {selectedOffer.durationUnit==="LIFETIME"?"Lifetime":selectedOffer.durationCount+" "+selectedOffer.durationUnit.toLowerCase()+"(s)"}</Text><Text>Fee and validity are confirmed only when you save this current offer.</Text></View>}
 {application&&!selectedOffer&&application.planCode===offer&&<View style={s.offer}><Text style={s.label}>Previously accepted membership offer</Text><Text>{application.plan} · {rupees(application.feeMinor)}</Text><Text>This is the original accepted amount; current plan prices may differ.</Text></View>}
 {field("Street and building address","address")}{field("City","city")}{field("Six-digit PIN","pinCode")}
 {selector("State",draft.stateRef,options?.states??[],v=>setDraft(d=>({...d,stateRef:v,districtRef:""})))}
 {selector("District",draft.districtRef,options?.districts??[],v=>setDraft(d=>({...d,districtRef:v})))}
 {selector("Optional branch preference",draft.branchRef,[{value:"",label:"None"},...(options?.branches??[])],v=>setDraft(d=>({...d,branchRef:v})))}
 {field("Referral (optional)","referral")}
  <NativeReferralCodeCheck code={draft.referral}/>
 <Pressable accessibilityRole="checkbox" accessibilityState={{checked:draft.consent}} onPress={()=>setDraft(d=>({...d,consent:!d.consent}))} style={s.choice}><Text>{draft.consent?"☑":"☐"} I consent to processing of this membership application and its protected evidence.</Text></Pressable>
 <Pressable accessibilityRole="button" disabled={busy||!draft.consent||!options||!offer||!!pending.current} onPress={save} style={[s.primary,busy&&{opacity:.5}]}><Text style={s.white}>Save application</Text></Pressable>
 {pending.current&&<View style={s.field}><Text>Save result uncertain. Refresh your current applications before retrying the original request.</Text><Pressable onPress={()=>void onSaved()}><Text>Refresh current status</Text></Pressable><Pressable onPress={()=>void send(pending.current!)}><Text>Retry original save</Text></Pressable></View>}
 </View>;
}
const s=StyleSheet.create({card:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#dce7e1",gap:12},title:{fontSize:20,fontWeight:"700",color:"#174632"},field:{gap:6},label:{fontWeight:"600",color:"#244559"},input:{minHeight:46,borderWidth:1,borderColor:"#bdcfda",borderRadius:9,padding:10,color:"#12324d"},row:{gap:8,alignItems:"center"},choice:{padding:12,borderWidth:1,borderColor:"#a8c9b3",borderRadius:9,minHeight:44,justifyContent:"center"},active:{backgroundColor:"#174632"},primary:{backgroundColor:"#174632",borderRadius:9,padding:13,alignItems:"center",minHeight:48},white:{color:"white",fontWeight:"700"},offer:{backgroundColor:"#eff6f1",borderWidth:1,borderColor:"#d2e6d6",borderRadius:10,padding:12,gap:6}});
