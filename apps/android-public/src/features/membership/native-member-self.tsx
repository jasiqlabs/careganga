import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,BackHandler,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import {File,Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";
import {fetch as expoFetch} from "expo/fetch";
import type {CG04Application,CG04Member,CG04MemberHistory,CG19OwnMemberPacks,CG04MembershipFee,CG04PublicTier,CG04PublicTierPage} from "@careganga/api-contracts";
import {memberInvoke,memberEndpoint} from "./member-native-api";
import {NativeEligibleRewardsCatalogue} from "../referrals/native-eligible-rewards-catalogue";
import {NativeReferralCode} from "../referrals/native-referral-code";
import {NativeCommunityAuth} from "./native-community-auth";
import {NativeMemberApplication} from "./native-member-application";
import {NativeMemberProof} from "./native-member-proof";
const KEY="cg_public_community_membership_session";
const rupees=(minor:string)=>{if(!/^[0-9]{1,15}$/.test(minor))return "Fee unavailable";const n=BigInt(minor),p=(n%100n).toString().padStart(2,"0");return "₹"+(n/100n).toString()+(p==="00"?"":"."+p);};
type Pending={path:string;body:Record<string,unknown>};
export function NativeMemberSelf({onExit,initialPlan}:{onExit:()=>void;initialPlan?:string|null}){
 const [token,setToken]=useState<string|null>(null),[verified,setVerified]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[apps,setApps]=useState<CG04Application[]>([]),[selected,setSelected]=useState<CG04Application|null>(null),[member,setMember]=useState<CG04Member|null>(null),[history,setHistory]=useState<CG04MemberHistory|null>(null),[issued,setIssued]=useState<CG19OwnMemberPacks|null>(null),[showHistory,setShowHistory]=useState(false),[fee,setFee]=useState<CG04MembershipFee|null>(null),[plans,setPlans]=useState<CG04PublicTier[]>([]),[otp,setOtp]=useState("");
 const pending=useRef<Pending|null>(null),sequence=useRef(0),foreground=useRef(true);
 const clear=useCallback(()=>{sequence.current++;setToken(null);setVerified(false);setApps([]);setSelected(null);setMember(null);setHistory(null);setIssued(null);setShowHistory(false);setFee(null);pending.current=null;void SecureStore.deleteItemAsync(KEY).catch(()=>undefined);},[]);
 const refresh=useCallback(async(key:string)=>{
  const n=++sequence.current;
  try{
   const phone=await memberInvoke<{verified:boolean}>("/api/identity/mobile/status","GET",undefined,key);
   if(n!==sequence.current||!foreground.current)return;
   setToken(key);setVerified(phone.verified);
   if(!phone.verified){setApps([]);setSelected(null);setMember(null);setHistory(null);setIssued(null);return;}
   const [list,self,terms,documents]=await Promise.all([memberInvoke<{items:CG04Application[]}>("/api/v1/membership/applications","GET",undefined,key),memberInvoke<{member:CG04Member|null}>("/api/v1/membership/me","GET",undefined,key),memberInvoke<CG04MemberHistory>("/api/v1/membership/me/history","GET",undefined,key),memberInvoke<CG19OwnMemberPacks>("/api/v1/membership/documents/me","GET",undefined,key).catch(()=>null)]);
   if(n!==sequence.current||!foreground.current)return;
   setApps(list.items);setMember(self.member);setHistory(terms);setIssued(documents);
   setSelected(old=>list.items.find(x=>x.ref===old?.ref)??list.items.find(x=>["DRAFT","RETURNED","SUBMITTED"].includes(x.status))??list.items[0]??null);
  }catch(e){if(e&&typeof e==="object"&&"status" in e&&e.status===401){clear();throw Error("Your membership session expired. Sign in again.");}throw e;}
 },[clear]);
 useEffect(()=>{let active=true;void (async()=>{
  try{const stored=await SecureStore.getItemAsync(KEY);if(stored&&active)await refresh(stored);}
  catch(e){if(active)setMessage(e instanceof Error?e.message:"Membership status unavailable. Retry.");}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false;sequence.current++;};},[refresh]);
 useEffect(()=>{if(Platform.OS!=="android")return;const sub=BackHandler.addEventListener("hardwareBackPress",()=>{onExit();return true;});return()=>sub.remove();},[onExit]);
 useEffect(()=>{const sub=AppState.addEventListener("change",state=>{
  foreground.current=state==="active";
  if(state!=="active"){sequence.current++;setApps([]);setSelected(null);setMember(null);setHistory(null);setIssued(null);setFee(null);setVerified(false);setOtp("");return;}
  if(token)void refresh(token).catch(()=>setMessage("Private membership status unavailable. Retry when connected."));
 });return()=>sub.remove();},[token,refresh]);
 useEffect(()=>{if(!selected||!token||!verified){setFee(null);return;}let active=true;
  void memberInvoke<CG04MembershipFee>("/api/v1/membership/applications/"+selected.ref+"/fee","GET",undefined,token).then(v=>{if(active&&foreground.current)setFee(v);}).catch(()=>{if(active&&foreground.current)setFee(null);});
  return()=>{active=false;};
 },[selected?.ref,selected?.version,token,verified]);
 useEffect(()=>{let active=true;void (async()=>{
  const all:CG04PublicTier[]=[];let cursor="";
  for(let i=0;i<4;i++){
   const uri="/api/v1/public/membership/tiers?"+new URLSearchParams({cursor});
   const v=await memberInvoke<CG04PublicTierPage>(uri);
   if(!Array.isArray(v.items))throw Error("Current plans unavailable.");
   all.push(...v.items);if(!v.nextCursor)break;cursor=v.nextCursor;
  }
  if(active)setPlans(all);
 })().catch(()=>{if(active)setMessage("Current plans unavailable. Refresh before applying.");});return()=>{active=false;};},[]);
 const act=async(job:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage("");try{await job();}catch(e){setMessage(e instanceof Error?e.message:"The outcome is uncertain. Refresh before retrying.");}finally{setBusy(false);}};
 const button=(label:string,fn:()=>void,disabled=false)=> <Pressable accessibilityRole="button" disabled={busy||disabled} onPress={fn} style={[s.button,(busy||disabled)&&{opacity:.45}]}><Text style={s.buttonText}>{label}</Text></Pressable>;
 const command=(c:Pending)=>void act(async()=>{if(!token)throw Error("Sign in again.");pending.current=c;await memberInvoke(c.path,"POST",c.body,token);pending.current=null;await refresh(token);setMessage("Original membership action confirmed.");});
 const openOfficialPdf=(ref:string,kind:"CARD"|"CERTIFICATE"|"WELCOME")=>void act(async()=>{
  if(!token)throw Error("Sign in again to open official membership documents.");
  let file:File|null=null;
  try{
   const url=memberEndpoint("/api/v1/membership/documents/packs/"+ref+"/"+kind+"/download");
   const result=await expoFetch(url,{headers:{Authorization:"Bearer "+token}});
   if(!result.ok)throw Error("This official membership document is no longer available. Refresh your membership status.");
   if((result.headers.get("content-type")??"").split(";")[0].trim()!=="application/pdf")throw Error("Official document format could not be confirmed.");
   const bytes=new Uint8Array(await result.arrayBuffer());
   if(!bytes.length||bytes.length>10485760)throw Error("Private membership document could not be verified.");
   if(!await Sharing.isAvailableAsync())throw Error("Protected PDF sharing is unavailable on this device.");
   file=new File(Paths.cache,"careganga-official-member-"+Crypto.randomUUID()+".pdf");
   file.create();file.write(bytes);
   await Sharing.shareAsync(file.uri,{mimeType:"application/pdf",dialogTitle:"Open private CareGanga membership document"});
   setMessage("Private official PDF opened. Share only with trusted recipients.");
  }finally{try{file?.delete();}catch{}}
 });
 const action=(kind:"submit"|"cancel"|"activate")=>{if(!token||!selected||pending.current||busy)return;
  command({path:"/api/v1/membership/applications/"+selected.ref+"/"+kind,body:{requestKey:Crypto.randomUUID(),...(kind==="activate"?{}:{expectedVersion:selected.version})}});};
 const logout=()=>void act(async()=>{if(token)try{await memberInvoke("/api/identity/logout","POST",{},token);}catch{}clear();setMessage("Membership session removed from this device; remote logout may be unconfirmed.");});
 const onSignedIn=async(key:string)=>{await SecureStore.setItemAsync(KEY,key);await refresh(key);};
 return <SafeAreaView style={s.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
 <View style={s.head}><Text accessibilityRole="header" style={s.title}>CareGanga Membership</Text>{button("Back",onExit)}</View>
 {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
 {loading?<ActivityIndicator accessibilityLabel="Checking membership account"/>:!token?<NativeCommunityAuth onSignedIn={onSignedIn}/>:
 <>
 {button("Sign out",()=>void logout())}
 {!verified?<View style={s.card}><Text style={s.heading}>Verify your mobile contact</Text><Text>Your current contact must be verified before joining.</Text>
 {button("Request code",()=>void act(async()=>{await memberInvoke("/api/identity/mobile/verify/start","POST",{},token);setMessage("Verification code requested. Delivery is not guaranteed.");}))}
 <TextInput accessibilityLabel="Received SMS code" value={otp} onChangeText={setOtp} style={s.input} maxLength={10} keyboardType="number-pad"/>
 {button("Confirm code",()=>void act(async()=>{const v=await memberInvoke<{status:string}>("/api/identity/mobile/verify/confirm","POST",{code:otp},token);if(v.status!=="VERIFIED")throw Error("Code not verified.");setOtp("");await refresh(token);}),!otp)}
 </View>:
 <>
 <View style={s.card}><Text style={s.heading}>Current membership</Text><Text>{member?member.memberNumber+" · "+member.plan+" · "+member.status:"No approved member yet."}</Text>{member&&<Text>Validity: {member.startsOn} to {member.expiresOn??"Lifetime"}</Text>}
 {member&&history&&button(showHistory?"Hide history":"Renewals and branch history",()=>setShowHistory(x=>!x))}
 {member&&history&&showHistory&&<View style={s.history}>
  <Text style={s.heading}>Recorded terms</Text>
  {!history.terms.length&&<Text>No recorded membership terms yet.</Text>}
  {history.terms.map(t=><View key={t.applicationNumber} style={s.historyItem}>
   <Text style={s.heading}>{t.plan} · {t.category}</Text>
   <Text>{t.startsOn} to {t.expiresOn??"Lifetime"}</Text><Text>Accepted fee: {rupees(t.feeMinor)}</Text><Text>{t.applicationNumber}</Text>
  </View>)}
  {history.termsHasMore&&<Text>More older terms are available from the Foundation.</Text>}
  <Text style={s.heading}>Foundation branch history</Text>
  {!history.branches.length&&<Text>No recorded branch history yet.</Text>}
  {history.branches.map((h,i)=><View key={h.effectiveFrom+":"+i} style={s.historyItem}>
   <Text style={s.heading}>{h.branch??"Foundation"}</Text>
   <Text>{new Date(h.effectiveFrom).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})} to {h.effectiveTo?new Date(h.effectiveTo).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"}):"Current"}</Text><Text>{h.reason}</Text>
  </View>)}
  {history.branchesHasMore&&<Text>Older affiliations are available from the Foundation.</Text>}
 </View>}
 </View>
 {member&&<View style={s.card} accessibilityLabel="Your official membership documents">
  <Text style={s.heading}>Official membership documents</Text>
  <Text>Only issued, currently eligible documents may be opened. Pending approval does not issue a card.</Text>
  {!issued?<Text>Official document status cannot be confirmed. Refresh your account.</Text>:
   !issued.items.length?<Text>No signed documents have been issued yet.</Text>:
   issued.items.map(pack=><View key={pack.packRef} style={s.historyItem}>
    <Text style={s.heading}>{pack.status==="ISSUED"?"Official PDF pack issued":pack.status==="REVOKED"?"Revoked document pack":pack.status==="UNKNOWN"?"Issue outcome uncertain":"Documents pending verification"}</Text>
    <Text>Issue revision {pack.issueRevision}</Text>
    {pack.canDownload&&<View style={s.history}>
     {button("Open front/back membership card PDF",()=>openOfficialPdf(pack.packRef,"CARD"))}
     {button("Open membership certificate PDF",()=>openOfficialPdf(pack.packRef,"CERTIFICATE"))}
     {button("Open welcome letter PDF",()=>openOfficialPdf(pack.packRef,"WELCOME"))}
    </View>}
   </View>)}
  {issued?.hasMore&&<Text>Request older document revisions from the Foundation.</Text>}
 </View>}
 <View style={s.card}><Text style={s.heading}>My applications</Text>{apps.map(a=>button(a.applicationNumber+" · "+a.status,()=>setSelected(a)))}{button("New membership / renewal",()=>setSelected(null),apps.some(a=>["DRAFT","RETURNED","SUBMITTED"].includes(a.status)))}</View>
 {(!selected||["DRAFT","RETURNED"].includes(selected.status))&&<NativeMemberApplication token={token} application={selected} initialPlan={initialPlan} plans={plans} onSaved={()=>refresh(token)}/>}
 {selected&&<View style={s.card}><Text style={s.heading}>{selected.applicationNumber}</Text><Text>Status: {selected.status} · {selected.plan}</Text><Text>Accepted fee: {rupees(selected.feeMinor)}</Text>
 {!!selected.reviewReference&&<Text>Review {selected.reviewReference} · {selected.reviewStatus}</Text>}{!!selected.reviewRemarks&&<Text>Reviewer notes: {selected.reviewRemarks}</Text>}
 <Text>Payment: {fee?.paymentStatus.replaceAll("_"," ")??"Not confirmed"}. A posted bank entry is not verified payment.</Text>
 {["DRAFT","RETURNED"].includes(selected.status)&&<><NativeMemberProof token={token} applicationRef={selected.ref} version={selected.version} editable onChange={()=>void refresh(token)}/>{button("Submit for review",()=>action("submit"))}{button("Cancel draft",()=>action("cancel"))}</>}
 {selected.status==="SUBMITTED"&&selected.reviewStatus==="PENDING_OWNER"&&fee&&["NOT_DUE","VERIFIED"].includes(fee.paymentStatus)&&button("Complete approved membership",()=>action("activate"))}
 </View>}
 {pending.current&&<View style={s.card}><Text>Outcome uncertain. Refresh, then retry the exact same request if needed.</Text>{button("Refresh original status",()=>void act(()=>refresh(token)))}{button("Retry original request",()=>command(pending.current!))}</View>}
 <NativeEligibleRewardsCatalogue token={token} onExpired={clear}/>
  <NativeReferralCode token={token} onExpired={clear}/>
 {button("Refresh membership",()=>void act(()=>refresh(token)))}
 </>}
 </>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:"#f5f7f9"},content:{padding:18,paddingBottom:48,gap:14,width:"100%",maxWidth:740,alignSelf:"center"},head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:23,fontWeight:"800",color:"#174632",flexShrink:1},heading:{fontSize:18,fontWeight:"700",color:"#174632"},card:{backgroundColor:"white",borderRadius:13,borderWidth:1,borderColor:"#d9e5df",padding:15,gap:11},button:{minHeight:46,padding:12,borderWidth:1,borderColor:"#a7c6b4",borderRadius:9,justifyContent:"center"},buttonText:{fontWeight:"700",color:"#174632"},input:{minHeight:46,padding:10,borderWidth:1,borderColor:"#c4d6cd",borderRadius:8,color:"#12324d"},message:{padding:12,backgroundColor:"white",color:"#993b28",borderRadius:9},history:{gap:9},historyItem:{paddingVertical:9,borderBottomWidth:1,borderColor:"#d9e5df",gap:5}});
