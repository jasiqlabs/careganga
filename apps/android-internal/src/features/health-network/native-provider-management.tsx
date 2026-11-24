import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View}
 from "react-native";
import * as Crypto from "expo-crypto";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativeHealthCenterEditor,blankCenter,type CenterDraft}
 from "./native-health-center-editor";
import {NativeHealthEvidenceUploader} from "./native-health-evidence-uploader";
import {NativeCenterContentPublisher} from "./native-center-content-publisher";
import {NativePartnerApplicationInbox} from "./native-partner-application-inbox";
type Provider={providerCode:string;legalName:string;providerType:string;
 contactName:string;contactPhone:string;contactEmail:string;registrationRef:string};
type Row={providerRef:string;code:string;name:string;type:string;status:string;
 version:number;centerCount:number};
type Detail={provider:{providerRef:string;code:string;name:string;type:string;
 status:string;version:number;contactName:string;contactPhone:string;
 contactEmail:string|null;registrationRef:string|null};
 centers:{centerRef:string;code:string;name:string;type:string;
 status:string;version:number;accessState:string;publicationState:string;
 publicSlug:string|null}[]};
type CenterDetail={centerRef:string;version:number;center:CenterDraft};
type Representative={affiliationRef:string;name:string;status:string;version:number};
type AccountOption={value:string;label:string};
type Props={token:string;onExpired:()=>void;onExit:()=>void;
 canManage:boolean;canVerify:boolean;canActivate:boolean;canPublish:boolean;
 canViewFinance:boolean;canManageFinance:boolean};
const types=["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING","OTHER"];
const statuses=["ALL","PENDING","SUBMITTED","RETURNED","REJECTED","VERIFIED","SUSPENDED"];
const blank=():Provider=>({providerCode:"",legalName:"",providerType:"CLINIC",
 contactName:"",contactPhone:"",contactEmail:"",registrationRef:""});
const label=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,c=>c.toUpperCase());
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",
 body?:object):Promise<T>{
 const r=await identityRequest("/api/v1/health-network/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(
  r.status===401?"Sign in again.":
  r.status===403?"Your current Foundation permission or center access denies this action.":
  r.status===409?"The original healthcare source changed. Refresh before retry.":
  "Current provider source outcome could not be verified."),{status:r.status});
 return r.json() as Promise<T>;
}
export function NativeProviderManagement({token,onExpired,onExit,canManage,
 canVerify,canActivate,canPublish,canViewFinance,canManageFinance}:Props){
 const [rows,setRows]=useState<Row[]>([]);
 const [status,setStatus]=useState("ALL"),[search,setSearch]=useState("");
 const [appliedSearch,setAppliedSearch]=useState("");
 const [next,setNext]=useState<number|null>(null);
 const [selected,setSelected]=useState<Detail|null>(null);
 const [provider,setProvider]=useState<Provider>(blank);
 const [centers,setCenters]=useState<CenterDraft[]>([blankCenter()]);
 const [editing,setEditing]=useState<"none"|"create"|"provider"|"center">("none");
 const [centerEdit,setCenterEdit]=useState<{ref:string|null;version:number;value:CenterDraft}|null>(null);
 const [providerProof,setProviderProof]=useState("");
 const [centerProofs,setCenterProofs]=useState<Record<string,string>>({});
 const [currentPassword,setCurrentPassword]=useState("");
 const [publicSlug,setPublicSlug]=useState("");
 const [bankProof,setBankProof]=useState("");
 const [bankVersion,setBankVersion]=useState(0);
 const [existingBankProof,setExistingBankProof]=useState("");
 const [maskedBank,setMaskedBank]=useState("");
 const [representatives,setRepresentatives]=useState<Representative[]>([]);
 const [staffChoices,setStaffChoices]=useState<AccountOption[]>([]);
 const [representativeCenter,setRepresentativeCenter]=useState("");
 const [representativeSearch,setRepresentativeSearch]=useState("");
 const [repAccount,setRepAccount]=useState("");

 const [partnerApplicationsOpen,setPartnerApplicationsOpen]=useState(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const command=useRef<{operation:string;key:string}|null>(null);
 const serial=useRef(0),listTurn=useRef(0),detailTurn=useRef(0);
 const activeProvider=useRef("");
 const [detailLoading,setDetailLoading]=useState(false);
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  const code=e&&typeof e==="object"&&"status" in e&&
   typeof e.status==="number"?e.status:503;
  if(code>=500)setUncertain(true);
  setError(e instanceof Error?e.message:"Original provider state unknown.");
 },[onExpired]);
 const load=useCallback(async(offset=0)=>{
  const request=++listTurn.current;
  const query=new URLSearchParams({offset:String(offset),status,q:appliedSearch});
  const response=await api<{providers:Row[];nextOffset:number|null}>(
   token,"providers?"+query.toString());
  if(request!==listTurn.current)return;
  if(!response||!Array.isArray(response.providers))
   throw Error("The original verified provider list is unavailable.");
  if(offset===0)setRows(response.providers);
  else setRows(old=>{
   const seen=new Set(old.map(x=>x.providerRef));
   return [...old,...response.providers.filter(x=>!seen.has(x.providerRef))];
  });
  setNext(Number.isInteger(response.nextOffset)?response.nextOffset:null);
 },[token,status,appliedSearch]);
 const detail=useCallback(async(ref:string)=>{
  const response=await api<Detail>(token,"providers/"+encodeURIComponent(ref));
  if(response?.provider?.providerRef!==ref||!Array.isArray(response.centers))
   throw Error("The provider record has changed.");
  if(activeProvider.current===ref)setSelected(response);
  return response;
 },[token]);
 useEffect(()=>{
  const turn=++serial.current;detailTurn.current++;activeProvider.current="";setDetailLoading(false);
  setLoading(true);setError("");setSelected(null);setRows([]);setNext(null);
  void load().catch(e=>{if(turn===serial.current)failure(e)})
   .finally(()=>{if(turn===serial.current)setLoading(false)});
  return()=>{serial.current++;listTurn.current++;detailTurn.current++;activeProvider.current="";};
 },[load,failure]);
 const button=(caption:string,fn:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={fn} style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{caption}</Text>
  </Pressable>;
 const input=(caption:string,value:string,onChange:(v:string)=>void,max=180)=>
  <View style={styles.field}>
   <Text style={styles.note}>{caption}</Text>
   <TextInput accessibilityLabel={caption} style={styles.input} value={value}
    onChangeText={onChange} maxLength={max} editable={!busy&&!uncertain}/>
  </View>;
 const choice=(caption:string,items:string[],value:string,change:(v:string)=>void)=>
  <View style={styles.field}><Text style={styles.note}>{caption}</Text>
   <View style={styles.row}>{items.map(x=><View key={x}>
    {button((x===value?"✓ ":"")+label(x),()=>change(x),busy||uncertain)}
   </View>)}</View>
  </View>;
 const source=(s:Detail["provider"]):Provider=>({
  providerCode:s.code,legalName:s.name,providerType:s.type,
  contactName:s.contactName,contactPhone:s.contactPhone,
  contactEmail:s.contactEmail??"",registrationRef:s.registrationRef??""
 });
 async function finance(ref:string){
  if(!canViewFinance)return;
  const request=detailTurn.current;
  const data=await api<{reference:{fileRef:string;version:number;
   maskedLabel:string}|null}>(token,"providers/"+encodeURIComponent(ref)+"/finance-reference");
  if(request!==detailTurn.current||activeProvider.current!==ref)return;
  setBankVersion(data.reference?.version??0);
  setExistingBankProof(data.reference?.fileRef??"");
  setMaskedBank(data.reference?.maskedLabel??"");
  setBankProof("");
 }
 async function open(ref:string){
  const request=++detailTurn.current;activeProvider.current=ref;
  setDetailLoading(true);setSelected(null);setError("");setNotice("");setEditing("none");
  setProviderProof("");setCenterProofs({});setCurrentPassword("");setBankProof("");setExistingBankProof("");setBankVersion(0);setMaskedBank("");
  setRepresentatives([]);setStaffChoices([]);setRepresentativeCenter("");setRepAccount("");
  try{await detail(ref);if(request!==detailTurn.current)return;await finance(ref);}
  catch(e){if(request===detailTurn.current){setSelected(null);activeProvider.current="";failure(e)}}
  finally{if(request===detailTurn.current)setDetailLoading(false)}
 }
 const key=(operation:string)=>{
  if(command.current?.operation!==operation)
   command.current={operation,key:Crypto.randomUUID()};
  return command.current.key;
 };
 async function write<T>(operation:string,path:string,method:"POST"|"PATCH",
  payload:(requestKey:string)=>object,after:(v:T)=>Promise<void>){
  if(busy||uncertain)return;
  setBusy(true);setError("");setNotice("");
  try{
   const result=await api<T>(token,path,method,payload(key(operation)));
   command.current=null;setUncertain(false);
   await after(result);
  }catch(e){failure(e)}
  finally{setBusy(false)}
 }
 function editor(){
  return <View style={styles.panel}>
   <Text style={styles.heading}>{editing==="create"?
    "Initial pending center":"Pending center details"}</Text>
   {centers.map((item,i)=><View key={i} style={styles.panel}>
    <Text accessibilityRole="header" style={styles.heading}>{i+1}. {item.displayName.trim()||"New operating center"}</Text>
    <NativeHealthCenterEditor token={token} value={item}
     disabled={busy||uncertain} onChange={x=>setCenters(old=>
      old.map((v,j)=>j===i?x:v))}/>
    {centers.length>1&&button("Remove this pending center",()=>Alert.alert("Remove this unsaved center?","Other centers will be kept.",[{text:"Keep",style:"cancel"},{text:"Remove",style:"destructive",onPress:()=>setCenters(old=>old.filter((_,j)=>j!==i))}]),busy||uncertain)}
   </View>)}
   {centers.length<10&&button("Add another pending center",()=>
    setCenters(old=>[...old,blankCenter()]),busy||uncertain)}
  </View>;
 }
 const fields=()=><View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.heading}>Organization details</Text>
  {input("Provider code",provider.providerCode,x=>
   setProvider(old=>({...old,providerCode:x.toUpperCase()})),24)}
  {input("Legal organization name",provider.legalName,x=>
   setProvider(old=>({...old,legalName:x})))}
  {choice("Organization type",types,provider.providerType,x=>
   setProvider(old=>({...old,providerType:x})))}
  <Text accessibilityRole="header" style={styles.heading}>Contact details</Text>
  {input("Contact person",provider.contactName,x=>
   setProvider(old=>({...old,contactName:x})),120)}
  {input("Registered contact number",provider.contactPhone,x=>
   setProvider(old=>({...old,contactPhone:x})),16)}
  {input("Email (optional)",provider.contactEmail,x=>
   setProvider(old=>({...old,contactEmail:x})))}
  {input("Registration reference (optional)",provider.registrationRef,x=>
   setProvider(old=>({...old,registrationRef:x})),120)}
 </View>;
 const providerBody=()=>({...provider,contactEmail:provider.contactEmail||null,
  registrationRef:provider.registrationRef||null});
 async function saveProvider(){
  if(!canManage)return;
  if(editing==="create"){
   await write<{providerRef:string}>("create","providers","POST",
    requestKey=>({requestKey,provider:providerBody(),centers}),
    async saved=>{
     if(!saved.providerRef)throw Error("The original provider was not confirmed.");
     setEditing("none");setProvider(blank());setCenters([blankCenter()]);
     await load();await open(saved.providerRef);
     setNotice("Pending provider and centers recorded. Independent verification is required.");
    });
  }else if(editing==="provider"&&selected){
   const ref=selected.provider.providerRef;
   await write("edit:"+ref,"providers/"+encodeURIComponent(ref),"PATCH",
    requestKey=>({requestKey,expectedVersion:selected.provider.version,
     provider:providerBody()}),async()=>{
     setEditing("none");await detail(ref);await load();
     setNotice("Pending provider draft updated.");
    });
  }
 }
 async function saveCenter(){
  if(!canManage||!selected||!centerEdit)return;
  const ref=selected.provider.providerRef;
  const chosen=centerEdit;
  const route=chosen.ref?"centers/"+encodeURIComponent(chosen.ref):
   "providers/"+encodeURIComponent(ref)+"/centers";
  await write("center:"+route,route,chosen.ref?"PATCH":"POST",
   requestKey=>({requestKey,expectedVersion:chosen.ref?
     chosen.version:selected.provider.version,center:chosen.value}),async()=>{
    setCenterEdit(null);setEditing("none");await detail(ref);await load();
    setNotice("Pending center saved. It has not been publicly published.");
   });
 }
 async function editCenter(centerRef:string){
  if(busy||uncertain)return;
  setBusy(true);setError("");
  try{
   const result=await api<CenterDetail>(token,"centers/"+encodeURIComponent(centerRef));
   if(!result.center)throw Error("Original pending center unavailable.");
   setCenterEdit({ref:centerRef,version:result.version,value:result.center});
   setEditing("center");command.current=null;
  }catch(e){failure(e)}finally{setBusy(false)}
 }
 const review=(kind:"providers"|"centers",ref:string,version:number,proof:string)=>{
  if(!canManage||!proof||busy||uncertain)return;
  Alert.alert("Submit verified proof for review?",
   "This requests independent verification. It does not activate or publish.",[
    {text:"Cancel",style:"cancel"},
    {text:"Submit",onPress:()=>void write("submit:"+kind+ref,
     kind+"/"+encodeURIComponent(ref)+"/submit","POST",
     requestKey=>({requestKey,expectedVersion:version,proofFileRef:proof}),async()=>{
      if(selected)await detail(selected.provider.providerRef);
      await load();setNotice("Verified evidence submitted for independent review.");
     })}
   ]);
 };
 async function statusChange(kind:"providers"|"centers",ref:string,version:number,
  operation:"access"|"publication"|"suspend"|"reopen",enabled=false){
  if(busy||uncertain||currentPassword.length<8)return;
  const route=kind+"/"+encodeURIComponent(ref)+"/"+operation;
  let input=(requestKey:string):object=>({
   requestKey,expectedVersion:version,currentPassword});
  if(operation==="access")input=requestKey=>({
   requestKey,expectedVersion:version,enabled,currentPassword});
  if(operation==="publication")input=requestKey=>({
   requestKey,expectedVersion:version,published:enabled,
   slug:enabled?publicSlug:null,currentPassword});
  await write("protected:"+route,route,"POST",input,async()=>{
   setCurrentPassword("");if(selected)await detail(selected.provider.providerRef);
   await load();setNotice("Original protected center/provider state updated.");
  });
 }
 async function showRepresentatives(centerRef:string){
  setBusy(true);setError("");setRepresentativeCenter(centerRef);
  try{
   const [list,staff]=await Promise.all([
    api<{representatives:Representative[]}>(token,
     "centers/"+encodeURIComponent(centerRef)+"/representatives"),
    api<{options:AccountOption[]}>(token,
     "representatives/options?search="+encodeURIComponent(representativeSearch))
   ]);
   if(!Array.isArray(list.representatives)||!Array.isArray(staff.options))
    throw Error("Original center representative scope cannot be verified.");
   setRepresentatives(list.representatives);setStaffChoices(staff.options);
  }catch(e){failure(e)}finally{setBusy(false)}
 }
 async function assignRepresentative(){
  if(busy||uncertain||!canManage||!repAccount||!representativeCenter)return;
  await write("affiliate:"+representativeCenter,
   "centers/"+encodeURIComponent(representativeCenter)+"/representatives","POST",
   requestKey=>({requestKey,accountRef:repAccount}),async()=>{
    setRepAccount("");await showRepresentatives(representativeCenter);
    setNotice("Original center staff assignment recorded.");
   });
 }
 async function revokeRepresentative(ref:string,version:number){
  if(busy||uncertain||!canManage||!representativeCenter)return;
  const url="centers/"+encodeURIComponent(representativeCenter)+
    "/representatives/"+encodeURIComponent(ref)+"/revoke";
  await write("revoke:"+ref,url,"POST",
   requestKey=>({requestKey,expectedVersion:version}),async()=>{
    await showRepresentatives(representativeCenter);
    setNotice("Original center edit access revoked.");
   });
 }
 async function saveBank(){
  if(!selected||!canManageFinance||!bankProof||busy||uncertain||
   maskedBank.trim().length<4)return;
  const providerRef=selected.provider.providerRef;
  await write("bank:"+providerRef,"providers/"+
   encodeURIComponent(providerRef)+"/finance-reference","POST",
   requestKey=>({requestKey,expectedVersion:bankVersion,
    fileRef:bankProof,maskedLabel:maskedBank.trim()}),async()=>{
    await finance(providerRef);
    setNotice("Only a masked reference was recorded; actual bank proof remains private.");
   });
 }
 const selectedProvider=selected?.provider;
 if(partnerApplicationsOpen)return <NativePartnerApplicationInbox token={token}
  canManage={canManage} onExpired={onExpired}
  onExit={()=>setPartnerApplicationsOpen(false)}/>;
 return <SafeAreaView style={styles.page}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   <Text accessibilityRole="header" style={styles.title}>
    Verified healthcare providers & centers</Text>
   <Text style={styles.note}>Foundation provider registration, genuine center
    geography, private evidence and separate independent verification.</Text>
   {button("Back to dashboard",onExit)}
   {button("Review public partner applications",()=>setPartnerApplicationsOpen(true),busy)}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
   {uncertain&&<Text style={styles.error}>The last request may have committed.
    Refresh the original provider before retrying.</Text>}
   {loading&&<ActivityIndicator accessibilityLabel="Loading Foundation providers"/>}
   {canPublish&&editing==="none"&&
    <NativeCenterContentPublisher token={token} onExpired={onExpired}/>}
   {editing==="none"&&<View style={styles.panel}>
    <Text style={styles.heading}>Search original providers</Text>
    {input("Search by provider name or code",search,setSearch,80)}
    {button("Apply search",()=>setAppliedSearch(search.trim()),busy||loading||detailLoading||uncertain)}
    {choice("Status",statuses,status,x=>{if(!loading&&!detailLoading)setStatus(x)})}
    {button("Refresh original providers",()=>{
     setUncertain(false);command.current=null;setLoading(true);
     void load().catch(failure).finally(()=>setLoading(false));},busy)}
    {canManage&&button("Register a pending provider and center",()=>{
     detailTurn.current++;activeProvider.current="";setSelected(null);setProvider(blank());setCenters([blankCenter()]);
     setEditing("create");command.current=null;},busy||loading||detailLoading||uncertain)}
    {rows.map(row=><View key={row.providerRef}>
     {button(row.name+" · "+row.code+" · "+label(row.status)+
      " · "+row.centerCount+" centers",()=>void open(row.providerRef),busy||loading||detailLoading||uncertain)}
    </View>)}
    {next!==null&&button("More original providers",()=>{
     setLoading(true);void load(next).catch(failure).finally(()=>setLoading(false));
    },busy)}
   </View>}
   {editing==="create"&&canManage&&<>
    <Text accessibilityRole="header" style={styles.heading}>Register healthcare provider</Text>
    <Text style={styles.note}>Enter organization details, then add each operating center. Verification comes after saving.</Text>
    {fields()}
    <Text accessibilityRole="header" style={styles.heading}>Operating centers ({centers.length})</Text>
    {editor()}
    {button("Save original pending provider and centers",()=>
     Alert.alert("Save pending provider?", "Approval and activation remain separate.",[
      {text:"Cancel",style:"cancel"},{text:"Save",onPress:()=>void saveProvider()}
     ]),busy||uncertain)}
    {button("Cancel registration",()=>Alert.alert("Discard unsaved registration?","Saved records will not change.",[{text:"Keep editing",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>{setEditing("none");command.current=null;}}]),busy||uncertain)}
   </>}
   {detailLoading&&<ActivityIndicator accessibilityLabel="Loading provider details"/>}
    {selectedProvider&&!detailLoading&&editing!=="create"&&<View key={selectedProvider.providerRef} style={styles.panel}>
    <Text style={styles.heading}>{selectedProvider.name}</Text>
    <Text style={styles.note}>Code: {selectedProvider.code} · Type: {
     label(selectedProvider.type)} · Status: {label(selectedProvider.status)}</Text>
    <Text style={styles.note}>Contact: {selectedProvider.contactName} · {
     selectedProvider.contactPhone}</Text>
    {editing==="none"&&canManage&&selectedProvider.status==="PENDING"&&
     button("Edit pending provider",()=>{
      setProvider(source(selectedProvider));setEditing("provider");command.current=null;
     },busy||uncertain)}
    {editing==="provider"&&<>{fields()}
     {button("Save pending provider",()=>void saveProvider(),busy||uncertain)}
     {button("Cancel editing",()=>{setEditing("none");command.current=null;})}</>}
    {selectedProvider.status==="PENDING"&&canManage&&<>
     <NativeHealthEvidenceUploader token={token}
      providerRef={selectedProvider.providerRef}
      sourceVersion={selectedProvider.version}
      classification="HEALTH_PROVIDER_REGISTRATION"
      onVerified={ref=>{if(activeProvider.current===selectedProvider.providerRef)setProviderProof(ref);}} onExpired={onExpired}/>
     {button("Submit provider proof for independent review",()=>
      review("providers",selectedProvider.providerRef,
       selectedProvider.version,providerProof),busy||uncertain||!providerProof)}
    </>}
    {canVerify&&["VERIFIED","SUSPENDED"].includes(selectedProvider.status)&&<>
     {input("Current Foundation password for protected status",currentPassword,
      setCurrentPassword,1024)}
     {button(selectedProvider.status==="SUSPENDED"?
      "Reopen original provider draft":"Suspend verified provider",()=>Alert.alert(
       "Change provider verification status?","This changes current center availability.",[
        {text:"Cancel",style:"cancel"},
        {text:"Confirm",onPress:()=>void statusChange("providers",
         selectedProvider.providerRef,selectedProvider.version,
         selectedProvider.status==="SUSPENDED"?"reopen":"suspend")}
       ]),busy||uncertain||currentPassword.length<8)}
    </>}
    {canViewFinance&&<View style={styles.panel}>
      <Text style={styles.heading}>Protected provider settlement destination</Text>
      <Text style={styles.note}>Only the original scanner-verified bank
       document is accepted. A masked label is not proof of actual payment.</Text>
      {!!existingBankProof&&<Text style={styles.note}>
       Current protected bank instruction: {maskedBank}</Text>}
      {canManageFinance&&<>
       <NativeHealthEvidenceUploader token={token}
        providerRef={selectedProvider.providerRef}
        sourceVersion={selectedProvider.version}
        classification="HEALTH_BANK_PROOF"
        onVerified={ref=>{if(activeProvider.current===selectedProvider.providerRef)setBankProof(ref);}} onExpired={onExpired}/>
       {input("Masked bank account label (e.g. Bank ****1234)",
        maskedBank,setMaskedBank,60)}
       {button("Save protected verified provider bank destination",()=>void saveBank(),
        busy||uncertain||!bankProof||maskedBank.trim().length<4)}
      </>}
     </View>}
    <Text style={styles.heading}>Original healthcare centers</Text>
    {canManage&&button("Add pending center",()=>{
     setCenterEdit({ref:null,version:selectedProvider.version,value:blankCenter()});
     setEditing("center");command.current=null;
    },busy||uncertain)}
    {selected.centers.map(center=><View key={center.centerRef} style={styles.panel}>
     <Text style={styles.heading}>{center.name}</Text>
     <Text style={styles.note}>Center: {center.code} · {label(center.status)}</Text>
     <Text style={styles.note}>Access: {label(center.accessState)} ·
      Publication: {label(center.publicationState)}</Text>
     {canManage&&button("Manage currently assigned center representatives",
      ()=>void showRepresentatives(center.centerRef),busy||uncertain)}
     {representativeCenter===center.centerRef&&canManage&&<View style={styles.panel}>
      <Text style={styles.heading}>Center representatives</Text>
      {representatives.map(person=><View key={person.affiliationRef}>
       <Text style={styles.note}>{person.name} · {label(person.status)}</Text>
       {person.status!=="REVOKED"&&button("Revoke center edit access",()=>
        Alert.alert("Revoke this center assignment?","Staff access will change immediately.",[
         {text:"Keep",style:"cancel"},
         {text:"Revoke",onPress:()=>void revokeRepresentative(
          person.affiliationRef,person.version)}
        ]),busy||uncertain)}
      </View>)}
      {input("Search eligible Foundation staff",representativeSearch,
       setRepresentativeSearch,60)}
      {button("Search staff accounts",()=>void showRepresentatives(center.centerRef),
       busy||uncertain)}
      {staffChoices.map(person=>button((repAccount===person.value?"✓ ":"")+person.label,
       ()=>setRepAccount(person.value),busy||uncertain))}
      {button("Assign selected staff to this center",
       ()=>void assignRepresentative(),busy||uncertain||!repAccount)}
     </View>}
     {canManage&&center.status==="PENDING"&&button("Edit pending center",
      ()=>void editCenter(center.centerRef),busy||uncertain)}
     {canManage&&center.status==="PENDING"&&<>
      <NativeHealthEvidenceUploader token={token}
       providerRef={selectedProvider.providerRef} centerRef={center.centerRef}
       sourceVersion={center.version} classification="HEALTH_CENTER_LICENSE"
       onVerified={ref=>setCenterProofs(old=>({...old,[center.centerRef]:ref}))}
       onExpired={onExpired}/>
      {selectedProvider.status==="VERIFIED"&&
       button("Submit center licence for independent review",()=>
        review("centers",center.centerRef,center.version,
         centerProofs[center.centerRef]??""),busy||uncertain||
         !centerProofs[center.centerRef])}
     </>}
     {center.status==="VERIFIED"&&<>{canVerify&&!canActivate&&!canPublish&&
      input("Current Foundation password for protected center state",
       currentPassword,setCurrentPassword,1024)}
      {canActivate&&<>
      {input("Current Foundation password",currentPassword,setCurrentPassword,1024)}
      {button(center.accessState==="ENABLED"?"Disable center access":
       "Enable verified center access",()=>void statusChange("centers",
        center.centerRef,center.version,"access",center.accessState!=="ENABLED"),
        busy||uncertain||currentPassword.length<8)}
     </>}
     {canPublish&&<>{input("Public center slug",publicSlug,setPublicSlug,100)}
      {input("Current Foundation password for publication",
       currentPassword,setCurrentPassword,1024)}
      {button(center.publicationState==="PUBLISHED"?"Withdraw public listing":
       "Publish verified center",()=>void statusChange("centers",
        center.centerRef,center.version,"publication",
        center.publicationState!=="PUBLISHED"),
        busy||uncertain||currentPassword.length<8)}
     </>}</>}
     {canVerify&&["VERIFIED","SUSPENDED"].includes(center.status)&&
      button(center.status==="SUSPENDED"?"Reopen pending center":
       "Suspend current center",()=>void statusChange("centers",center.centerRef,
        center.version,center.status==="SUSPENDED"?"reopen":"suspend"),
        busy||uncertain||currentPassword.length<8)}
    </View>)}
    {editing==="center"&&centerEdit&&canManage&&<View style={styles.panel}>
     <Text style={styles.heading}>{centerEdit.ref?"Edit center":"Add center"}</Text>
     <NativeHealthCenterEditor token={token} value={centerEdit.value}
      disabled={busy||uncertain} onChange={value=>setCenterEdit(o=>o?{...o,value}:null)}/>
     {button("Save pending center",()=>void saveCenter(),busy||uncertain)}
     {button("Cancel center editing",()=>{setEditing("none");setCenterEdit(null);})}
    </View>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:15,paddingBottom:90,gap:12},
 title:{fontSize:20,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:13,lineHeight:18,color:t.mutedText},
 panel:{borderWidth:1,borderColor:t.border,borderRadius:12,
  padding:12,gap:9,backgroundColor:t.surface},
 field:{gap:5},row:{flexDirection:"row",flexWrap:"wrap",gap:6},
 input:{borderColor:t.border,borderWidth:1,backgroundColor:t.surface,
  color:t.text,borderRadius:9,padding:10,minHeight:45},
 button:{borderColor:t.border,borderWidth:1,borderRadius:9,
  padding:11,minHeight:46,justifyContent:"center"},
 disabled:{opacity:.4},error:{color:t.error,fontSize:13,lineHeight:19}
});
