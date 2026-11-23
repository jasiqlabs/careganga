import React,{useEffect,useRef,useState} from "react";
import {NativeCsrAgreementPanel} from "./native-csr-agreement-panel";
import {NativeCsrPublicRightsPanel} from "./native-csr-public-rights-panel";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";

type Option={value:string;label:string};
type Options={foundation:boolean;branches:Option[]};
type Partner={ref:string;branchRef:string|null;branch:string|null;legalName:string;registrationReference:string|null;
 contactName:string;contactEmail:string|null;contactMobile:string|null;supportSummary:string;status:string;version:number};
type Page={items:Partner[];hasMore:boolean};
const reviewTabs=[{value:"ALL",label:"All Partners"},{value:"SUBMITTED",label:"Pending Review"},
 {value:"APPROVED",label:"Approved Partners"},{value:"REJECTED",label:"Rejected"}] as const;
type ReviewStatus=(typeof reviewTabs)[number]["value"];
type ReviewHistory={items:{reference:string;status:string;submittedAt:string}[]};
type Draft={branchRef:string;legalName:string;registrationReference:string;contactName:string;contactEmail:string;contactMobile:string;supportSummary:string};
type Command={path:string;method:"POST"|"PATCH";body:Record<string,unknown>};
const blank=():Draft=>({branchRef:"",legalName:"",registrationReference:"",contactName:"",contactEmail:"",contactMobile:"",supportSummary:""});
const from=(p:Partner):Draft=>({branchRef:p.branchRef??"",legalName:p.legalName,registrationReference:p.registrationReference??"",
 contactName:p.contactName,contactEmail:p.contactEmail??"",contactMobile:p.contactMobile??"",supportSummary:p.supportSummary});
const errorText=(v:unknown)=>v&&typeof v==="object"&&"message" in v&&typeof v.message==="string"?v.message:"CSR service unavailable.";
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",data?:Record<string,unknown>):Promise<T>{
 const r=await identityRequest("/api/v1/csr/partners"+path,{method,
  headers:{Authorization:"Bearer "+token,...(data?{"Content-Type":"application/json"}:{})},
  body:data?JSON.stringify(data):undefined});
 const parsed:unknown=await r.json().catch(()=>null);
 if(!r.ok||parsed===null)throw Object.assign(Error(errorText(parsed)),{status:r.status||503});
 return parsed as T;
}
export function NativeCsrPartners({token,canManage,canReadAgreement,canUploadAgreement,canManagePublic,onExpired}:{token:string;canManage:boolean;canReadAgreement:boolean;canUploadAgreement:boolean;canManagePublic:boolean;onExpired:()=>void}){
 const [options,setOptions]=useState<Options|null>(null),[page,setPage]=useState<Page>({items:[],hasMore:false});
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("ALL"),[statusFilter,setStatusFilter]=useState<ReviewStatus>("ALL"),[offset,setOffset]=useState(0),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[listError,setListError]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [draft,setDraft]=useState<Draft>(blank),[selected,setSelected]=useState<Partner|null>(null),[editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false),[pending,setPending]=useState<Command|null>(null),seq=useRef(0);
 const [history,setHistory]=useState<ReviewHistory|null>(null),[historyError,setHistoryError]=useState("");
 const canEditCurrent=canManage&&(!selected||["DRAFT","RETURNED"].includes(selected.status));
 const refresh=()=>{setSelected(null);setEditing(false);setEpoch(n=>n+1);};
 useEffect(()=>{
  let live=true;const n=++seq.current;setLoading(true);setListError("");
  const p=new URLSearchParams({offset:String(offset)});
  if(query.trim())p.set("q",query.trim().slice(0,80));
  if(filter!=="ALL")p.set("branchRef",filter);
  if(statusFilter!=="ALL")p.set("status",statusFilter);
  void api<Page>(token,"?"+p.toString()).then(v=>{if(live&&n===seq.current){setPage(v);setListError("");}})
   .catch(e=>{if(live&&n===seq.current){setListError(e instanceof Error?e.message:"CSR list unavailable.");setPage({items:[],hasMore:false});if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();}})
   .finally(()=>{if(live&&n===seq.current)setLoading(false);});
  return()=>{live=false;};
 },[token,query,filter,statusFilter,offset,epoch,onExpired]);
 useEffect(()=>{
  let live=true;void api<Options>(token,"/options").then(v=>{if(live)setOptions(v);}).catch(()=>{if(live)setError("Current CSR branch choices unavailable.");});
  return()=>{live=false;};
 },[token,epoch]);
 useEffect(()=>{
  let live=true;setHistory(null);setHistoryError("");
  if(selected)void api<ReviewHistory>(token,"/"+selected.ref+"/review-history")
   .then(v=>{if(live)setHistory(v);}).catch(e=>{
    if(!live)return;
    setHistoryError("Current CSR review history is unavailable.");
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   });
  return()=>{live=false;};
 },[token,selected?.ref,epoch,onExpired]);
 const set=(k:keyof Draft,v:string)=>setDraft(x=>({...x,[k]:v}));
 const start=()=>{if(pending||busy)return;setSelected(null);setDraft({...blank(),branchRef:options?.foundation?"":options?.branches[0]?.value??""});setEditing(true);setError("");};
 const loadPartner=async(p:Partner)=>{
  if(pending||busy)return;
  try{const full=await api<Partner>(token,"/"+p.ref);setSelected(full);setDraft(from(full));setEditing(true);setError("");}
  catch(e){setSelected(null);setEditing(false);setError(e instanceof Error?e.message:"CSR partner unavailable.");
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();}
 };
 const send=async(cmd:Command)=>{
  setBusy(true);setPending(cmd);setError("");
  try{await api(token,cmd.path,cmd.method,cmd.body);setPending(null);setEditing(false);setSelected(null);setDraft(blank());setNotice("CSR draft saved. It is not approved or publicly listed.");setOffset(0);setStatusFilter("ALL");refresh();}
  catch(e){const status=e&&typeof e==="object"&&"status" in e?Number(e.status):503;
   if(status===401){onExpired();return;}
   if(status<500&&status!==0){setPending(null);setError(e instanceof Error?e.message:"CSR draft not saved.");}
   else setError("Result uncertain. Check the list or retry the exact original request.");
  }finally{setBusy(false);}
 };
 const save=()=>{
  if(!canEditCurrent||busy||pending)return;
  if(!draft.legalName.trim()||!draft.contactName.trim()||!draft.supportSummary.trim()||
   !draft.contactEmail.trim()&&!draft.contactMobile.trim()||!draft.branchRef&&!options?.foundation){setError("Complete the organization, contact, support and permitted branch fields.");return;}
  const payload:Record<string,unknown>={requestKey:Crypto.randomUUID(),branchRef:draft.branchRef||null,
   legalName:draft.legalName.trim(),registrationReference:draft.registrationReference.trim()||null,
   contactName:draft.contactName.trim(),contactEmail:draft.contactEmail.trim()||null,contactMobile:draft.contactMobile.trim()||null,
   supportSummary:draft.supportSummary.trim()};
  if(selected)payload.expectedVersion=selected.version;
  void send({path:selected?"/"+selected.ref:"",method:selected?"PATCH":"POST",body:payload});
 };
 const discard=()=>{
  if(!selected||!canEditCurrent||busy||pending)return;
  Alert.alert("Discard CSR draft?","This draft cannot be restored.",[
   {text:"Keep draft",style:"cancel"},{text:"Discard",style:"destructive",
    onPress:()=>{void send({path:"/"+selected.ref+"/cancel",method:"POST",body:{requestKey:Crypto.randomUUID(),expectedVersion:selected.version}});}}]);
 };
 const field=(label:string,key:keyof Draft,multiline=false)=><View style={styles.field} key={key}>
  <Text style={styles.label}>{label}</Text>
  <TextInput style={[styles.input,multiline?styles.multi:null]} placeholder={label} placeholderTextColor="#64748B"
   value={draft[key]} onChangeText={v=>set(key,v)} editable={canEditCurrent&&!busy&&!pending} multiline={multiline}
   autoCapitalize={key==="contactEmail"?"none":"sentences"} maxLength={key==="supportSummary"?1000:key==="contactEmail"?254:200}/>
 </View>;
 const choice=(value:string,name:string,current:string,change:(v:string)=>void,disabled=false)=>
  <Pressable key={value} disabled={disabled} accessibilityRole="button"
   accessibilityState={{selected:current===value,disabled}} onPress={()=>change(value)}
   style={[styles.choice,current===value?styles.chosen:null]}><Text style={styles.choiceText}>{name}</Text></Pressable>;
 return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
  <Text style={styles.heading}>CSR & Partnerships</Text>
  <Text style={styles.description}>Verified agreements, approvals and received money are separate from draft registration.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text style={styles.notice}>{notice}</Text>}
  <View style={styles.panel}>
   <Text style={styles.label}>CSR review status</Text>
   <ScrollView horizontal contentContainerStyle={styles.choices}>
    {reviewTabs.map(tab=>choice(tab.value,tab.label,statusFilter,v=>{setSelected(null);setEditing(false);setOffset(0);setStatusFilter(v as ReviewStatus);},!!pending))}
   </ScrollView>
   <Text style={styles.label}>Search organization</Text>
   <TextInput style={styles.input} value={query} placeholder="Organization name" onChangeText={v=>{setOffset(0);setQuery(v);}} autoCapitalize="none"/>
   <Text style={styles.label}>Current permitted branch</Text>
   <ScrollView horizontal contentContainerStyle={styles.choices}>
    {choice("ALL","All assigned",filter,v=>{setSelected(null);setEditing(false);setOffset(0);setFilter(v);},!!pending)}
    {options?.foundation&&choice("FOUNDATION","Foundation",filter,v=>{setSelected(null);setEditing(false);setOffset(0);setFilter(v);},!!pending)}
    {options?.branches.map(b=>choice(b.value,b.label,filter,v=>{setSelected(null);setEditing(false);setOffset(0);setFilter(v);},!!pending))}
   </ScrollView>
   <View style={styles.actions}>
    <Pressable accessibilityRole="button" style={styles.btn} disabled={!!pending||busy} accessibilityState={{disabled:!!pending||busy}} onPress={refresh}><Text>Refresh</Text></Pressable>
    {canManage&&<Pressable accessibilityRole="button" style={styles.primary} disabled={!!pending} onPress={start}><Text style={styles.primaryText}>New draft</Text></Pressable>}
   </View>
   {!!listError&&<Text accessibilityRole="alert" style={styles.error}>{listError}</Text>}
   {loading?<ActivityIndicator/>:listError?null:page.items.length===0?<Text style={styles.description}>No CSR partners match the current status, search and permitted branches.</Text>:
    page.items.map(p=><View key={p.ref} style={styles.record}>
     <Text style={styles.recordTitle}>{p.legalName}</Text>
     <Text style={styles.description}>{p.branch??"Foundation"} · {p.status}</Text>
     <Pressable accessibilityRole="button" style={styles.btn} disabled={!!pending} onPress={()=>void loadPartner(p)}><Text>{canManage&&["DRAFT","RETURNED"].includes(p.status)?"Edit draft":"View details"}</Text></Pressable>
    </View>)}
   <View style={styles.actions}>
    <Pressable style={styles.btn} disabled={offset===0||loading} onPress={()=>setOffset(n=>Math.max(0,n-25))}><Text>Previous</Text></Pressable>
    <Text>Page {Math.floor(offset/25)+1}</Text>
    <Pressable style={styles.btn} disabled={!page.hasMore||loading} onPress={()=>setOffset(n=>n+25)}><Text>Next</Text></Pressable>
   </View>
  </View>
  {editing&&<View style={styles.panel}>
   <Text style={styles.subheading}>{selected?(canEditCurrent?"Edit CSR partner":"CSR partner details"):"Register CSR partner draft"}</Text>
   <Text style={styles.description}>No partner verification or financial posting takes place here.</Text>
   <Text style={styles.label}>Foundation branch</Text>
   <ScrollView horizontal contentContainerStyle={styles.choices}>
    {options?.foundation&&choice("","Foundation",draft.branchRef,v=>set("branchRef",v),!!selected||!canEditCurrent||busy||!!pending)}
    {options?.branches.map(b=>choice(b.value,b.label,draft.branchRef,v=>set("branchRef",v),!!selected||!canEditCurrent||busy||!!pending))}
   </ScrollView>
   {field("Registered organization", "legalName")}
   {field("Registration reference (optional)","registrationReference")}
   {field("Contact person","contactName")}
   {field("Contact email","contactEmail")}
   {field("Indian contact mobile (+91…)","contactMobile")}
   {field("Proposed CSR support","supportSummary",true)}
   {selected&&canReadAgreement&&<NativeCsrAgreementPanel token={token} partnerRef={selected.ref} version={selected.version} canUpload={canUploadAgreement&&canEditCurrent} canSubmit={canEditCurrent&&selected.status==="DRAFT"} onSubmitted={()=>{setEditing(false);setSelected(null);setNotice("Submitted for independent review.");refresh();}} onExpired={onExpired}/>}
   {selected?.status==="APPROVED"&&<NativeCsrPublicRightsPanel key={selected.ref} token={token} partnerRef={selected.ref} canManage={canManagePublic} onExpired={onExpired}/>}
   {selected&&<View style={styles.panel}><Text style={styles.subheading}>Original review history</Text>
    {!!historyError&&<Text accessibilityRole="alert" style={styles.error}>{historyError}</Text>}
    {!history&&!historyError&&<ActivityIndicator accessibilityLabel="Loading protected review history"/>}
    {history?.items.length===0&&<Text style={styles.description}>No review submissions yet.</Text>}
    {history?.items.map((item,i)=><Text key={item.reference+String(i)} style={styles.description}>{item.reference} · {item.status.replaceAll("_"," ")}</Text>)}
   </View>}
   <View style={styles.actions}>
    {canEditCurrent&&<Pressable accessibilityRole="button" style={styles.primary} disabled={busy||!!pending} onPress={save}>
     <Text style={styles.primaryText}>{busy?"Saving…":"Save draft"}</Text></Pressable>}
    <Pressable accessibilityRole="button" style={styles.btn} disabled={busy||!!pending} onPress={()=>{setEditing(false);setSelected(null);}}><Text>Close</Text></Pressable>
    {selected&&canEditCurrent&&<Pressable accessibilityRole="button" style={styles.btn} disabled={busy||!!pending} onPress={discard}><Text>Discard draft</Text></Pressable>}
   </View>
  </View>}
  {pending&&<View style={styles.panel}>
   <Text style={styles.error}>The saved result is uncertain. Do not start another command.</Text>
   <Pressable accessibilityRole="button" style={styles.btn} disabled={busy} onPress={()=>void send(pending)}><Text>Retry original request</Text></Pressable>
   <Pressable accessibilityRole="button" style={styles.btn} disabled={busy} onPress={refresh}><Text>Refresh directory</Text></Pressable>
  </View>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 body:{padding:16,paddingBottom:120,gap:14,backgroundColor:"#F8FAFC"},
 heading:{fontSize:22,fontWeight:"800",color:"#0F172A"},
 subheading:{fontSize:18,fontWeight:"700",color:"#0F172A"},
 description:{fontSize:13,color:"#64748B",lineHeight:19},
 panel:{backgroundColor:"#FFFFFF",borderRadius:12,borderColor:"#DBE2EA",borderWidth:1,padding:14,gap:10},
 field:{gap:5},
 label:{fontSize:13,fontWeight:"600",color:"#334155"},
 input:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:8,padding:10,minHeight:44,color:"#0F172A",backgroundColor:"#FFFFFF"},
 multi:{minHeight:85,textAlignVertical:"top"},
 choices:{flexDirection:"row",gap:8,paddingVertical:6,alignItems:"center"},
 choice:{borderRadius:8,paddingHorizontal:12,paddingVertical:10,backgroundColor:"#F1F5F9",borderWidth:1,borderColor:"#CBD5E1"},
 chosen:{backgroundColor:"#DBEAFE",borderColor:"#2563EB"},
 choiceText:{fontSize:13,color:"#0F172A"},
 actions:{flexDirection:"row",gap:8,alignItems:"center",flexWrap:"wrap"},
 btn:{padding:11,borderRadius:8,borderWidth:1,borderColor:"#CBD5E1",backgroundColor:"#FFFFFF"},
 primary:{padding:11,borderRadius:8,backgroundColor:"#2563EB"},
 primaryText:{fontWeight:"700",color:"#FFFFFF"},
 record:{borderBottomColor:"#E2E8F0",borderBottomWidth:1,paddingVertical:10,gap:7},
 recordTitle:{fontSize:15,fontWeight:"700",color:"#0F172A"},
 error:{color:"#B91C1C",fontSize:13},notice:{color:"#166534",fontSize:13}
});
