import {usePublicIntro} from "../cms/use-public-intro";
import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import type {CG04VolunteerApplication,CG04VolunteerOptions,CG04VolunteerProfile} from "@careganga/api-contracts";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {NativeCommunityAuth} from "../membership/native-community-auth";
import {memberInvoke} from "../membership/member-native-api";
import {NativeEligibleRewardsCatalogue} from "../referrals/native-eligible-rewards-catalogue";
import {NativeReferralCodeCheck} from "../referrals/native-referral-code-check";
import {NativeReferralCode} from "../referrals/native-referral-code";
import {NativeVolunteerProof} from "./native-volunteer-proof";
import {NativeVolunteerCard} from "./native-volunteer-card";
const KEY="cg_public_community_membership_session";
type Draft={firstName:string;lastName:string;dateOfBirth:string;gender:string;bloodGroup:string;address:string;city:string;village:string;
 pinCode:string;stateRef:string;districtRef:string;branchRef:string;departmentRef:string;availability:string;skills:string;experience:string;referral:string;consent:boolean};
type Pending={path:string;method:"POST"|"PATCH";body:Record<string,unknown>;digest:string};
const empty=():Draft=>({firstName:"",lastName:"",dateOfBirth:"",gender:"",bloodGroup:"",address:"",city:"",village:"",pinCode:"",stateRef:"",districtRef:"",branchRef:"",departmentRef:"",availability:"PART_TIME",skills:"",experience:"",referral:"",consent:false});
const from=(a:CG04VolunteerApplication):Draft=>({firstName:a.firstName,lastName:a.lastName,dateOfBirth:a.dateOfBirth,gender:a.gender,bloodGroup:a.bloodGroup??"",
 address:a.address,city:a.city,village:a.village,pinCode:a.pinCode,stateRef:a.stateRef,districtRef:a.districtRef,branchRef:a.branchRef??"",
 departmentRef:a.departmentRef,availability:a.availability,skills:a.skills.join(", "),experience:a.experience,referral:a.referral,consent:true});
const readable=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
const steps=["Personal","Contact & location","Interests & availability","Review & submit"] as const;
export function NativeVolunteerSelf({onExit}:{onExit:()=>void}){
 const intro=usePublicIntro("VOLUNTEER");
 const [tab,setTab]=useState<"APPLICATION"|"VERIFY">("APPLICATION"),[verifyCode,setVerifyCode]=useState(""),[verifyStatus,setVerifyStatus]=useState<"IDLE"|"CHECKING"|"ACTIVE"|"NOT_VALID"|"UNAVAILABLE">("IDLE");
 const [token,setToken]=useState<string|null>(null),[verified,setVerified]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[apps,setApps]=useState<CG04VolunteerApplication[]>([]),[selected,setSelected]=useState<CG04VolunteerApplication|null>(null);
 const [profile,setProfile]=useState<CG04VolunteerProfile|null>(null),[options,setOptions]=useState<CG04VolunteerOptions|null>(null);
 const [draft,setDraft]=useState<Draft>(empty),[step,setStep]=useState(0);
 const seq=useRef(0),verifySeq=useRef(0),foreground=useRef(true),pending=useRef<Pending|null>(null);
 const reviewAfterSave=useRef<{ref:string;version:number}|null>(null);
 const change=(key:keyof Draft,value:string|boolean)=>setDraft(v=>({...v,[key]:value}));
 const clear=useCallback(()=>{
  reviewAfterSave.current=null;seq.current++;verifySeq.current++;setVerifyCode("");setVerifyStatus("IDLE");setToken(null);setVerified(false);setApps([]);setSelected(null);setProfile(null);setOptions(null);setDraft(empty());setStep(0);pending.current=null;
  void SecureStore.deleteItemAsync(KEY).catch(()=>undefined);
 },[]);
 const refresh=useCallback(async(session:string)=>{
  const n=++seq.current;setLoading(true);
  try{
   const phone=await memberInvoke<{verified:boolean}>("/api/identity/mobile/status","GET",undefined,session);
   if(n!==seq.current||!foreground.current)return;
   setToken(session);setVerified(phone.verified===true);
   if(!phone.verified){setApps([]);setSelected(null);setProfile(null);return;}
   const [list,own]=await Promise.all([memberInvoke<{items:CG04VolunteerApplication[]}>("/api/v1/volunteers/applications","GET",undefined,session),memberInvoke<CG04VolunteerProfile>("/api/v1/volunteers/me","GET",undefined,session)]);
   if(n!==seq.current||!foreground.current)return;
   setApps(list.items);setProfile(own);
   setSelected(old=>list.items.find(v=>v.ref===old?.ref)??list.items.find(v=>["DRAFT","RETURNED","SUBMITTED"].includes(v.status))??list.items[0]??null);
  }catch(e){
   if(n===seq.current){
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)clear();
    else setMessage(e instanceof Error?e.message:"Volunteer application status unavailable.");
   }
  }finally{if(n===seq.current)setLoading(false);}
 },[clear]);
 useEffect(()=>{let alive=true;void SecureStore.getItemAsync(KEY).then(v=>{if(alive&&v)void refresh(v);else if(alive)setLoading(false);}).catch(()=>{if(alive)setLoading(false);});return()=>{alive=false;seq.current++;};},[refresh]);
 useEffect(()=>{const sub=AppState.addEventListener("change",state=>{
  foreground.current=state==="active";
  if(state!=="active"){seq.current++;verifySeq.current++;setVerifyCode("");setVerifyStatus("IDLE");setApps([]);setSelected(null);setProfile(null);setOptions(null);setDraft(empty());setMessage("");setLoading(true);}
  else if(token)void refresh(token);
  else void SecureStore.getItemAsync(KEY).then(k=>{if(k)void refresh(k);else setLoading(false);});
 });return()=>sub.remove();},[token,refresh]);
 useEffect(()=>{
  if(!selected)return;
  const saved=reviewAfterSave.current;reviewAfterSave.current=null;
  setDraft(from(selected));setStep(saved?.ref===selected.ref&&saved?.version===selected.version?3:0);
 },[selected?.ref,selected?.version]);
 useEffect(()=>{
  if(!token||!verified)return;
  let active=true;
  const state=draft.stateRef,branch=draft.branchRef;
  void memberInvoke<CG04VolunteerOptions>("/api/v1/volunteers/applications/options?"+new URLSearchParams({stateRef:state,branchRef:branch}).toString(),"GET",undefined,token)
   .then(v=>{if(active&&foreground.current)setOptions(v);}).catch(()=>{if(active)setOptions(null);});
  return()=>{active=false;};
 },[token,verified,draft.stateRef,draft.branchRef]);
 const act=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage("");try{await work();}catch(e){setMessage(e instanceof Error?e.message:"The result is uncertain. Refresh before retrying.");}finally{setBusy(false);}};
 const button=(label:string,fn:()=>void,disabled=false,selectedButton=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||busy,selected:selectedButton}}
  disabled={disabled||busy} onPress={fn} style={[s.button,selectedButton&&s.chosen,(disabled||busy)&&s.disabled]}><Text style={[s.buttonText,selectedButton&&s.selectedText]}>{label}</Text></Pressable>;
 const field=(label:string,key:keyof Draft,keyboard:"default"|"number-pad"="default")=><View style={s.field}>
  <Text style={s.label}>{label}</Text>
  <TextInput accessibilityLabel={label} style={s.input} value={String(draft[key])} keyboardType={keyboard}
   editable={!busy&&(!selected||["DRAFT","RETURNED"].includes(selected.status))} onChangeText={v=>change(key,v)}/>
 </View>;
 const option=(label:string,key:"stateRef"|"districtRef"|"branchRef"|"departmentRef"|"availability",values:{value:string;label:string}[],emptyLabel?:string)=>(
  <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.row}>
   {emptyLabel&&button(emptyLabel,()=>change(key,""),false,draft[key]==="")}
   {values.map(o=><View key={o.value}>{button(o.label,()=>{
    if(key==="stateRef")setDraft(v=>({...v,stateRef:o.value,districtRef:""}));
    else if(key==="branchRef")setDraft(v=>({...v,branchRef:o.value,departmentRef:""}));
    else change(key,o.value);
   },false,draft[key]===o.value)}</View>)}
  </View></View>
 );
 const work=async(kind:"SAVE"|"SUBMIT"|"ACTIVATE")=>act(async()=>{
  if(!token||!verified)throw Error("Verify your mobile contact before enrolling.");
  let url:string,method:"POST"|"PATCH"="POST",body:Record<string,unknown>,fingerprint:string;
  if(kind==="SAVE"){
   if(!draft.consent)throw Error("Confirm the original volunteer application consent.");
   const editing=selected&&["DRAFT","RETURNED"].includes(selected.status)?selected:null;
   const fields={firstName:draft.firstName.trim(),lastName:draft.lastName.trim(),dateOfBirth:draft.dateOfBirth,
    gender:draft.gender,bloodGroup:draft.bloodGroup||null,address:draft.address.trim(),city:draft.city.trim(),
    village:draft.village.trim(),pinCode:draft.pinCode,stateRef:draft.stateRef,districtRef:draft.districtRef,
    branchRef:draft.branchRef||null,departmentRef:draft.departmentRef,availability:draft.availability,
    skills:draft.skills.split(",").map(x=>x.trim()).filter(Boolean),experience:draft.experience.trim(),referral:draft.referral.trim(),consent:true};
   url="/api/v1/volunteers/applications"+(editing?"/"+editing.ref:"");method=editing?"PATCH":"POST";
   body={...fields,...(editing?{expectedVersion:editing.version}:{}),requestKey:Crypto.randomUUID()};
   fingerprint=JSON.stringify([url,editing?.version,fields]);
  }else{
   if(!selected)throw Error("Save the original volunteer application first.");
   url="/api/v1/volunteers/applications/"+selected.ref+"/"+(kind==="SUBMIT"?"submit":"activate");
   if(kind==="SUBMIT"&&!["DRAFT","RETURNED"].includes(selected.status))throw Error("Only the current saved draft may be submitted.");
   if(kind==="ACTIVATE"&&selected.reviewStatus!=="PENDING_OWNER")throw Error("An independent Foundation approval is required.");
   body={...(kind==="SUBMIT"?{expectedVersion:selected.version}:{}),requestKey:Crypto.randomUUID()};
   fingerprint=JSON.stringify([url,selected.version]);
  }
  if(!pending.current||pending.current.digest!==fingerprint)pending.current={path:url,method,body,digest:fingerprint};
  const result=await memberInvoke<unknown>(pending.current.path,pending.current.method,pending.current.body,token);
  pending.current=null;
  if(kind==="SAVE"&&result&&typeof result==="object"&&"record" in result){
   const next=(result as {record:CG04VolunteerApplication}).record;
   setApps(old=>[next,...old.filter(v=>v.ref!==next.ref)]);reviewAfterSave.current={ref:next.ref,version:next.version};setSelected(next);setStep(3);
  }else await refresh(token);
  setMessage(kind==="SAVE"?"Draft saved. Verify your original identity document next.":kind==="SUBMIT"?"Original volunteer application sent for independent review.":"Approved volunteer identity confirmed, without a staff role.");
 });
 const verify=async()=>{
  if(verifyStatus==="CHECKING")return;
  const code=verifyCode.trim().toUpperCase(),id=++verifySeq.current;
  if(!/^CGV-[A-F0-9]{24}$/.test(code)){setVerifyStatus("NOT_VALID");return;}
  setVerifyStatus("CHECKING");
  try{
   const status=await memberInvoke<{valid:boolean;status:"ACTIVE"|"NOT_VALID"}>("/api/v1/public/volunteers/verify/"+encodeURIComponent(code));
   if(id===verifySeq.current&&foreground.current)setVerifyStatus(status.valid&&status.status==="ACTIVE"?"ACTIVE":"NOT_VALID");
  }catch{if(id===verifySeq.current&&foreground.current)setVerifyStatus("UNAVAILABLE");}
 };
 const choose=(app:CG04VolunteerApplication|null)=>{reviewAfterSave.current=null;pending.current=null;setSelected(app);setDraft(app?from(app):empty());setStep(0);};
 const editable=!selected||["DRAFT","RETURNED"].includes(selected.status);
 return <SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  {button("Back to CareGanga Foundation",onExit)}
  <View style={s.hero}>{!!intro?.eyebrow&&<Text style={s.heroOverline}>{intro.eyebrow}</Text>}<Text accessibilityRole="header" style={s.heroTitle}>{intro?.heading??"Volunteer registration"}</Text>{!!intro?.body&&<Text style={s.heroText}>{intro.body}</Text>}{intro?.highlights.map((line,i)=><Text key={i} style={s.heroText}>{line}</Text>)}<Text style={s.heroText}>Your application and evidence remain private until independently reviewed.</Text></View>
  <View style={s.row}>{button("Application Form",()=>{verifySeq.current++;setVerifyCode("");setVerifyStatus("IDLE");setTab("APPLICATION");},false,tab==="APPLICATION")}
   {button("Verify Volunteer",()=>setTab("VERIFY"),false,tab==="VERIFY")}</View>
  {tab==="VERIFY"?<View style={s.card}>
    <Text style={s.title}>Verify Volunteer</Text><Text style={s.muted}>Enter the opaque code on a genuinely issued CareGanga volunteer card. Only current eligibility is returned.</Text>
    <TextInput accessibilityLabel="Official volunteer verification code" style={s.input} value={verifyCode} placeholder="CGV-…" autoCapitalize="characters" autoCorrect={false} maxLength={28}
     onChangeText={value=>{verifySeq.current++;setVerifyCode(value.toUpperCase());setVerifyStatus("IDLE");}} onSubmitEditing={()=>void verify()}/>
    {button(verifyStatus==="CHECKING"?"Checking original status…":"Verify current volunteer",()=>void verify(),verifyStatus==="CHECKING")}
    {verifyStatus==="ACTIVE"&&<Text accessibilityRole="text">The official volunteer card currently verifies an active approved volunteer.</Text>}
    {verifyStatus==="NOT_VALID"&&<Text accessibilityRole="text">This code does not verify a current active official volunteer card.</Text>}
    {verifyStatus==="UNAVAILABLE"&&<Text accessibilityRole="alert">Official volunteer verification is unavailable. Retry before relying on it.</Text>}
  </View>:<>
  {loading&&<ActivityIndicator accessibilityLabel="Checking your volunteer account"/>}
  {!loading&&!token&&<NativeCommunityAuth onSignedIn={async k=>{await SecureStore.setItemAsync(KEY,k);await refresh(k);}}/>}
  {token&&!verified&&<View style={s.card}><Text>Verify your mobile contact in your CareGanga account before you can start the volunteer application.</Text>
   {button("Refresh verification status",()=>void refresh(token))}</View>}
  {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
  {token&&verified&&<><View style={s.card}>
   <Text style={s.title}>My volunteer applications</Text>
   <View style={s.row}>{button("New application",()=>choose(null))}
    {apps.map(a=><View key={a.ref}>{button(a.applicationNumber+" · "+readable(a.status),()=>choose(a),false,selected?.ref===a.ref)}</View>)}
    {button("Refresh",()=>void refresh(token))}{button("Sign out",()=>void act(async()=>{await memberInvoke("/api/identity/logout","POST",{},token);clear();}))}
   </View>
   {profile?.volunteer&&<Text>Approved volunteer: {profile.volunteer.volunteerNumber} · {profile.volunteer.name} · {profile.volunteer.department}</Text>}
   {selected&&<Text>Current status: {readable(selected.status)} · {selected.applicationNumber}{selected.reviewStatus?" · "+readable(selected.reviewStatus):""}{selected.reviewRemarks?" · "+selected.reviewRemarks:""}</Text>}
  </View>
  {profile?.volunteer&&token&&<NativeVolunteerCard token={token} onExpired={clear}/>}
  <NativeEligibleRewardsCatalogue token={token} onExpired={clear}/>
  <NativeReferralCode token={token} onExpired={clear}/>
  {editable&&<View style={s.card}>
   <Text accessibilityRole="header" style={s.title}>Volunteer Application</Text>
   <View style={s.row}>{steps.map((label,index)=><View key={label}>{button((index+1)+". "+label,()=>setStep(index),false,step===index)}</View>)}</View>
   {step===0&&<>{field("First name", "firstName")}{field("Last name","lastName")}{field("Date of birth (YYYY-MM-DD)","dateOfBirth")}
    {field("Gender","gender")}
    <View style={s.field}><Text style={s.label}>Optional blood group</Text><View style={s.row}>
     {["","A+","A-","B+","B-","AB+","AB-","O+","O-"].map(v=><View key={v}>{button(v||"Prefer not to provide",()=>change("bloodGroup",v),false,draft.bloodGroup===v)}</View>)}
    </View></View>
   </>}
   {step===1&&<>{field("Address","address")}{field("City","city")}{field("Village (optional)","village")}{field("Six-digit Indian PIN","pinCode","number-pad")}
    {option("State","stateRef",options?.states??[])}
    {option("District","districtRef",options?.districts??[])}
   </>}
   {step===2&&<>{option("Preferred Foundation branch","branchRef",options?.branches??[],"Foundation-wide")}
    {option("Current volunteer department","departmentRef",options?.departments??[])}
    {option("Availability","availability",(["FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const).map(v=>({value:v,label:readable(v)})))}
    {field("Skills and interests (comma-separated)","skills")}{field("Relevant experience","experience")}
   </>}
   {step===3&&<>{field("Referral (optional)","referral")}
  <NativeReferralCodeCheck code={draft.referral}/>
    {button(draft.consent?"Consent confirmed":"Confirm original volunteer application consent",()=>change("consent",!draft.consent),false,draft.consent)}
    <Text style={s.muted}>Application and private verified ID proof are required for independent CG03 review. No automatic member, paid benefit, task or staff access is granted.</Text>
   </>}
   <View style={s.row}>{button("Previous",()=>setStep(i=>Math.max(i-1,0)),step===0)}
    {button("Next",()=>setStep(i=>Math.min(i+1,3)),step===3)}
    {button("Save original draft",()=>void work("SAVE"),!draft.consent)}</View>
  </View>}
  {selected&&<NativeVolunteerProof token={token} applicationRef={selected.ref} version={selected.version} editable={editable} onChange={()=>void refresh(token)}/>}
  {selected&&editable&&<View style={s.card}><Text style={s.title}>Submit for independent review</Text>
   <Text>Save the draft and scan-verify a real identity proof before submitting.</Text>
   {button("Submit original application",()=>void work("SUBMIT"))}
  </View>}
  {selected&&selected.reviewStatus==="PENDING_OWNER"&&selected.status==="SUBMITTED"&&<View style={s.card}>
   <Text>Independent Foundation approval received. Confirm the original volunteer identity.</Text>
   {button("Activate approved volunteer",()=>void work("ACTIVATE"))}</View>}
  </>}
  </>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},content:{padding:15,gap:13,paddingBottom:40},
 hero:{backgroundColor:"#123a36",padding:22,borderRadius:15,gap:10},
 heroOverline:{color:"#b1eac5",letterSpacing:2,fontWeight:"700"},heroTitle:{color:"#fff",fontSize:25,fontWeight:"800",lineHeight:32},
 heroText:{color:"#fff",lineHeight:21},
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,borderRadius:12,padding:14,gap:12},
 title:{fontSize:17,fontWeight:"700",color:t.text},muted:{fontSize:13,color:t.mutedText},message:{padding:10,color:t.text},
 field:{gap:6},label:{fontSize:13,fontWeight:"600",color:t.text},input:{minHeight:48,borderRadius:9,padding:11,borderWidth:1,borderColor:t.border,color:t.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 button:{minHeight:48,padding:10,borderWidth:1,borderColor:t.border,borderRadius:9,justifyContent:"center",backgroundColor:t.surface,maxWidth:"100%"},
 chosen:{backgroundColor:t.primary,borderColor:t.primary},disabled:{opacity:.45},
 buttonText:{color:t.text,fontSize:14,fontWeight:"600",textAlign:"center",flexShrink:1},selectedText:{color:t.primaryText}
});
