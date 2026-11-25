import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {IconArrowLeft, IconCheckCircle, IconRefresh} from "../dashboard/dashboard-icons";
import {BranchNativeUploader} from "./branch-native-uploader";
import {BranchNativeEvidenceHistory} from "./branch-native-evidence-history";
import {BranchStaffAccessNative} from "./branch-staff-access-native";

type Draft={recordRef:string;branchName:string;branchType:string;version:number;
  status:string;currentStep:number;updatedAt:string};
type Detail=Draft&{stages:Record<string,Record<string,unknown>>;managerRef:string|null;managerName:string|null;geographyRef:string|null};
type Option={value:string;label:string;kind?:string};
type Area={areaRef:string;name:string;level:string;status:string};
type Pending={action:"BRANCH_DRAFT_CREATE"|"BRANCH_DRAFT_SAVE";requestKey:string};
type Status={status:string;branch:{branchCode:string;status:string}|null;
  approval:{reference:string;status:string;revision:number;
    history:{action:string;remarks:string;at:string}[]}|null;
  submissions:{revision:number;status:string}[]};
type Props={token:string;canManage:boolean;canAdmin:boolean;onExit:()=>void;onExpired:()=>void};
const titles=["Branch details","Location","Registration documents","Agreement & photos",
  "Branch manager","Foundation departments","Review"];
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object):Promise<T>{
  let response:Response;
  try{
    response=await identityRequest("/api/foundation-structure/"+path,{
      method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
  }catch{throw Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("CONFLICT");
  if(response.status===400)throw Error("INVALID");
  if(!response.ok)throw Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");
  try{return await response.json() as T;}
  catch{throw Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");}
}
function friendly(error:unknown):string{
  const value=error instanceof Error?error.message:"UNAVAILABLE";
  return ({DENIED:"Your role does not permit this branch action.",
    CONFLICT:"The draft changed. Refresh before saving.",
    INVALID:"Check the branch fields and eligible selections.",
    UNKNOWN:"The result is uncertain. Check the original request before retrying.",
    UNAVAILABLE:"Branch information cannot be verified now.",
    EXPIRED:"Your session expired. Please sign in again."} as Record<string,string>)[value]??
    "The branch service is unavailable.";
}
const value=(x:unknown)=>typeof x==="string"?x:"";
const list=(x:unknown):string[]=>Array.isArray(x)?x.filter((v):v is string=>typeof v==="string"):[];
export function BranchRegistrationScreen({token,canManage,canAdmin,onExit,onExpired}:Props){
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [nextDraftOffset,setNextDraftOffset]=useState<number|null>(null);
  const [selected,setSelected]=useState<Detail|null>(null),[step,setStep]=useState(1);
  const [name,setName]=useState(""),[branchType,setBranchType]=useState("");
  const [openingDate,setOpeningDate]=useState("");
  const [phone,setPhone]=useState(""),[officialEmail,setOfficialEmail]=useState("");
  const [photos,setPhotos]=useState<string[]>([]),[logos,setLogos]=useState<string[]>([]);
  const [registrationFiles,setRegistrationFiles]=useState<string[]>([]);
  const [agreementFiles,setAgreementFiles]=useState<string[]>([]);
  const [extraPhotos,setExtraPhotos]=useState<string[]>([]);
  const [status,setStatus]=useState<Status|null>(null);
  const [submissionKey,setSubmissionKey]=useState("");
  const [submissionBusy,setSubmissionBusy]=useState(false);
  const [area,setArea]=useState(""),[address,setAddress]=useState(""),[pin,setPin]=useState("");
  const [latitude,setLatitude]=useState(""),[longitude,setLongitude]=useState("");
  const [manager,setManager]=useState(""),[departmentRefs,setDepartmentRefs]=useState<string[]>([]);
  const [reviewed,setReviewed]=useState(false);
  const [areas,setAreas]=useState<Area[]>([]);
  const [managers,setManagers]=useState<Option[]>([]);
  const [departments,setDepartments]=useState<Option[]>([]);
  const [creating,setCreating]=useState(false),[loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [pending,setPending]=useState<Pending|null>(null);
  const load=useCallback(async(offset=0)=>{
    const response=await api<{drafts:Draft[];nextOffset:number|null}>(
      token,"branches/drafts?offset="+offset);
    if(!Array.isArray(response.drafts))
      throw Error("UNAVAILABLE");
    setDrafts(previous=>offset===0?response.drafts:[
      ...previous.filter(item=>!response.drafts.some(incoming=>
        incoming.recordRef===item.recordRef)),...response.drafts]);
    setNextDraftOffset(response.nextOffset);
  },[token]);
  useEffect(()=>{
    let alive=true;
    void load().catch(error=>{
      if(alive){setDrafts([]);setMessage(friendly(error));if(error instanceof Error&&error.message==="EXPIRED")onExpired();}
    }).finally(()=>{if(alive)setLoading(false);});
    if(canManage)void Promise.allSettled([
      api<{areas:Area[]}>(token,"geography?level=BLOCK").then(x=>{if(alive)setAreas(x.areas.filter(r=>r.status==="ACTIVE"));}),
      api<{options:Option[]}>(token,"branches/managers/options").then(x=>{if(alive)setManagers(x.options);}),
      api<{options:Option[]}>(token,"branches/department-options").then(x=>{if(alive)setDepartments(x.options);})
    ]).then(x=>{if(alive&&x.some(p=>p.status==="rejected"))setMessage("Some eligible selections could not be verified.");});
    return()=>{alive=false;};
  },[load,token,canManage,onExpired]);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{onExit();return true;});
    return()=>subscription.remove();
  },[onExit]);
  function hydrate(detail:Detail){
    const stages=detail.stages??{},s1=stages["1"]??{},s2=stages["2"]??{},
      s3=stages["3"]??{},s4=stages["4"]??{},s5=stages["5"]??{},s6=stages["6"]??{},s7=stages["7"]??{};
    setSelected(detail);setStep(Math.max(1,Math.min(7,detail.currentStep)));
    setName(value(s1.branchName));setBranchType(value(s1.branchType));setOpeningDate(value(s1.openingDate));
    setPhone(value(s1.officialPhone));setOfficialEmail(value(s1.officialEmail));
    setPhotos(list(s1.photoFiles));setLogos(list(s1.logoFiles));
    setRegistrationFiles(list(s3.registrationFiles));setAgreementFiles(list(s4.agreementFiles));
    setExtraPhotos(list(s4.photoFiles));
    setArea(value(s2.geographyRef));setAddress(value(s2.postalAddress));setPin(value(s2.pinCode));
    setLatitude(s2.latitude===null||s2.latitude===undefined?"":String(s2.latitude));
    setLongitude(s2.longitude===null||s2.longitude===undefined?"":String(s2.longitude));
    setManager(value(s5.managerRef));setDepartmentRefs(list(s6.departmentRefs));
    setReviewed(s7.reviewAcknowledged===true);
  }
  async function open(reference:string){
    setBusy(true);setMessage("");setSubmissionKey("");
    try{
      hydrate(await api<Detail>(token,"branches/drafts/"+encodeURIComponent(reference)));
      try{await loadStatus(reference);}
      catch{
        setStatus(null);
        setMessage("Approval status is temporarily unavailable. This saved draft remains accessible.");
      }
    }
    catch(error){setSelected(null);setStatus(null);setMessage(friendly(error));if(error instanceof Error&&error.message==="EXPIRED")onExpired();}
    finally{setBusy(false);}
  }
  function stage():Record<string,unknown>{
    if(step===1)return {branchName:name,branchType,openingDate:openingDate||null,
      officialPhone:phone,officialEmail,photoFiles:photos,logoFiles:logos};
    if(step===2)return {geographyRef:area||null,postalAddress:address,pinCode:pin,
      latitude:latitude.trim()?Number(latitude):null,longitude:longitude.trim()?Number(longitude):null};
    if(step===3)return {registrationFiles};
    if(step===4)return {agreementFiles,photoFiles:extraPhotos};
    if(step===5)return {managerRef:manager||null};
    if(step===6)return {departmentRefs};
    return {reviewAcknowledged:reviewed};
  }
  async function write(){
    if(pending||busy||!canManage)return;
    const action=selected?"BRANCH_DRAFT_SAVE" as const:"BRANCH_DRAFT_CREATE" as const;
    const requestKey=Crypto.randomUUID();
    setBusy(true);setMessage("");setPending({action,requestKey});
    try{
      const result=selected?
        await api<{recordRef:string}>(token,"branches/drafts/"+selected.recordRef,"PATCH",
          {requestKey,expectedVersion:selected.version,step,stage:stage()}):
        await api<{recordRef:string}>(token,"branches/drafts","POST",
          {requestKey,stage:{branchName:name,branchType,openingDate:openingDate||null}});
      setPending(null);setCreating(false);
      await load();await open(result.recordRef);
      setMessage("Draft saved. Document and approval verification are still pending.");
    }catch(error){
      if(error instanceof Error&&["DENIED","CONFLICT","INVALID","EXPIRED"].includes(error.message))
        setPending(null);
      setMessage(friendly(error));if(error instanceof Error&&error.message==="EXPIRED")onExpired();
    }
    finally{setBusy(false);}
  }
  async function loadStatus(reference:string){
    const current=await api<Status>(token,
      "branch-workflow/registrations/"+encodeURIComponent(reference)+"/status");
    setStatus(current);
  }
  async function submit(){
    if(!selected||!canManage||submissionBusy||pending)return;
    const key=submissionKey||Crypto.randomUUID();setSubmissionKey(key);
    setSubmissionBusy(true);setMessage("");
    try{
      const result=await api<{status:string;message?:string}>(token,
        "branch-workflow/registrations/"+encodeURIComponent(selected.recordRef)+"/submit",
        "POST",{requestKey:key,expectedVersion:selected.version});
      setMessage(result.message??"The original submission needs verification.");
      if(result.status!=="SUBMISSION_UNCONFIRMED")setSubmissionKey("");
      await loadStatus(selected.recordRef);await load();
    }catch(e){
      setMessage(friendly(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setSubmissionBusy(false);}
  }
  async function checkOriginal(){
    if(!pending)return;
    setBusy(true);setMessage("");
    try{
      const state=await api<{status:string;recordRef:string|null}>(token,
        "branches/changes/"+pending.action+"/"+pending.requestKey);
      if(state.status==="CONFIRMED"){
        setPending(null);setCreating(false);
        await load();if(state.recordRef)await open(state.recordRef);
        setMessage("The original save was verified.");
      }else setMessage("The original request is unconfirmed. Do not create a second save.");
    }catch(error){setMessage(friendly(error));if(error instanceof Error&&error.message==="EXPIRED")onExpired();}
    finally{setBusy(false);}
  }
  function input(label:string,current:string,set:(s:string)=>void,mode:"default"|"numeric"="default"){
    return <View style={styles.field}><Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} value={current}
        keyboardType={mode==="numeric"?"numeric":"default"} onChangeText={set}/></View>;
  }
  function button(label:string,action:()=>void,disabled=false,primary=false){
    return <Pressable accessibilityRole="button" accessibilityState={{disabled}}
      onPress={action} disabled={disabled}
      style={[styles.button,primary&&styles.primary,disabled&&styles.disabled]}>
      <Text style={[styles.buttonText,primary&&styles.primaryText]}>{label}</Text></Pressable>;
  }
  return <SafeAreaView style={styles.page} edges={["left","right"]}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onExit}
            disabled={busy}
            style={styles.backBtn}
          >
            <IconArrowLeft size={18} color="#334155" />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text accessibilityRole="header" style={styles.title}>Branch registration</Text>
            <Text style={styles.help}>CareGanga Foundation · Seven-stage draft workflow</Text>
          </View>
        </View>
        {loading?<ActivityIndicator accessibilityLabel="Checking branch drafts"/>:null}
        {!!message&&<Text accessibilityRole="alert" style={styles.notice}>{message}</Text>}
        {pending&&button("Check original save",()=>void checkOriginal(),busy)}
        {!selected&&!creating&&<View style={styles.card}>
          <Text style={styles.heading}>My permitted drafts</Text>
          {drafts.length===0&&<Text style={styles.help}>No current branch drafts were verified.</Text>}
          {drafts.map(row=><Pressable key={row.recordRef} style={styles.option}
            accessibilityRole="button" onPress={()=>void open(row.recordRef)} disabled={busy}>
            <Text style={styles.optionTitle}>{row.branchName}</Text>
            <Text style={styles.help}>{row.status.replaceAll("_"," ")} · Step {row.currentStep} of 7</Text>
          </Pressable>)}
          {nextDraftOffset!==null&&button("Load more registrations",()=>{
            if(busy)return;
            setBusy(true);
            void load(nextDraftOffset).catch(error=>{
              setMessage(friendly(error));
              if(error instanceof Error&&error.message==="EXPIRED")onExpired();
            }).finally(()=>setBusy(false));
          },busy||!!pending)}
          {canManage&&button("New branch draft",()=>{setCreating(true);setName("");setBranchType("");setOpeningDate("");},busy||!!pending,true)}
        </View>}
        {!selected&&!creating&&canAdmin&&
         <BranchStaffAccessNative token={token} onExpired={onExpired}/>}
        {creating&&<View style={styles.card}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={()=>setCreating(false)}
              disabled={busy}
              style={styles.backBtn}
            >
              <IconArrowLeft size={18} color="#334155" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.heading}>Start branch</Text>
              <Text style={styles.help}>New branch registration draft</Text>
            </View>
          </View>
          {input("Branch name",name,setName)}
          {input("Branch type",branchType,setBranchType)}
          {input("Opening date (YYYY-MM-DD)",openingDate,setOpeningDate)}
          {button("Save new draft",()=>void write(),busy||!!pending||name.trim().length<2,true)}
          {button("Cancel",()=>setCreating(false),busy)}
        </View>}
        {selected&&!creating&&<View style={styles.card}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={()=>{setSelected(null);setStatus(null);setMessage("");}}
              disabled={busy}
              style={styles.backBtn}
            >
              <IconArrowLeft size={18} color="#334155" />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text style={styles.heading}>{selected.branchName}</Text>
              <Text style={styles.help}>{selected.status.replaceAll("_"," ")} · Revision {selected.version}</Text>
            </View>
          </View>
          <View style={styles.stepRow}>{titles.map((title,i)=><Pressable key={title}
            style={[styles.stepButton,step===i+1&&styles.selected]}
            accessibilityRole="button" accessibilityState={{disabled:i+1>selected.currentStep+1}}
            disabled={i+1>selected.currentStep+1||busy} onPress={()=>setStep(i+1)}>
            <Text style={styles.stepText}>{i+1}. {title}</Text></Pressable>)}</View>
          <BranchNativeEvidenceHistory key={selected.recordRef}
            registrationRef={selected.recordRef} token={token}
            canManage={canManage} onExpired={onExpired}/>
          <Text style={styles.heading}>Step {step}: {titles[step-1]}</Text>
          {step===1&&<>
            {input("Branch name",name,setName)}
            {input("Branch type",branchType,setBranchType)}
            {input("Opening date (YYYY-MM-DD)",openingDate,setOpeningDate)}
            {input("Official phone",phone,setPhone)}
            {input("Official email",officialEmail,setOfficialEmail)}
            {canManage&&selected&&<BranchNativeUploader token={token}
              registrationRef={selected.recordRef} draftVersion={selected.version}
              key={selected.recordRef+":"+selected.version+":"+("BRANCH_PHOTO")} classification="BRANCH_PHOTO" onExpired={onExpired}
              onVerified={ref=>setPhotos(old=>old.includes(ref)?old:[...old,ref])}/>}
            {canManage&&selected&&<BranchNativeUploader token={token}
              registrationRef={selected.recordRef} draftVersion={selected.version}
              key={selected.recordRef+":"+selected.version+":"+("BRANCH_LOGO")} classification="BRANCH_LOGO" onExpired={onExpired}
              onVerified={ref=>setLogos(old=>old.includes(ref)?old:[...old,ref])}/>}
          </>}
          {step===2&&<>
            <Text style={styles.label}>Choose a verified block</Text>
            {areas.map(row=><Pressable key={row.areaRef} accessibilityRole="radio"
              accessibilityState={{selected:area===row.areaRef}}
              onPress={()=>setArea(row.areaRef)} style={[styles.option,area===row.areaRef&&styles.selected]}>
              <Text style={styles.optionTitle}>{row.name}</Text></Pressable>)}
            {input("Postal address",address,setAddress)}
            {input("Six-digit PIN code",pin,setPin,"numeric")}
            {input("Latitude (optional)",latitude,setLatitude,"numeric")}
            {input("Longitude (optional)",longitude,setLongitude,"numeric")}
          </>}
          {step===3&&<>
            {canManage&&<BranchNativeUploader token={token}
              registrationRef={selected.recordRef} draftVersion={selected.version}
              key={selected.recordRef+":"+selected.version+":"+("REGISTRATION_PROOF")} classification="REGISTRATION_PROOF" onExpired={onExpired}
              onVerified={ref=>setRegistrationFiles(old=>old.includes(ref)?old:[...old,ref])}/>}
            <Text style={styles.notice}>{registrationFiles.length} registration proof document(s)
              selected. Save this stage to include them.</Text>
          </>}
          {step===4&&<>
            {canManage&&<BranchNativeUploader token={token}
              registrationRef={selected.recordRef} draftVersion={selected.version}
              key={selected.recordRef+":"+selected.version+":"+("AGREEMENT")} classification="AGREEMENT" onExpired={onExpired}
              onVerified={ref=>setAgreementFiles(old=>old.includes(ref)?old:[...old,ref])}/>}
            {canManage&&<BranchNativeUploader token={token}
              registrationRef={selected.recordRef} draftVersion={selected.version}
              key={selected.recordRef+":"+selected.version+":"+("BRANCH_PHOTO")} classification="BRANCH_PHOTO" onExpired={onExpired}
              onVerified={ref=>setExtraPhotos(old=>old.includes(ref)?old:[...old,ref])}/>}
            <Text style={styles.notice}>Signed agreement(s): {agreementFiles.length}.
              Save this stage to preserve your selection.</Text>
          </>}
          {step===5&&<>
            <Text style={styles.label}>Current eligible Foundation manager</Text>
            {manager&&selected.managerName&&!managers.some(x=>x.value===manager)&&
              <Pressable accessibilityRole="radio" accessibilityState={{selected:true}}
                style={[styles.option,styles.selected]} onPress={()=>setManager(manager)}>
                <Text style={styles.optionTitle}>{selected.managerName}</Text>
              </Pressable>}
            {managers.map(row=><Pressable key={row.value} accessibilityRole="radio"
              accessibilityState={{selected:manager===row.value}}
              onPress={()=>setManager(row.value)} style={[styles.option,manager===row.value&&styles.selected]}>
              <Text style={styles.optionTitle}>{row.label}</Text></Pressable>)}
          </>}
          {step===6&&<>
            <Text style={styles.label}>Foundation departments</Text>
            {departments.map(row=><Pressable key={row.value} accessibilityRole="checkbox"
              accessibilityState={{checked:departmentRefs.includes(row.value)}}
              onPress={()=>setDepartmentRefs(current=>current.includes(row.value)?
                current.filter(v=>v!==row.value):[...current,row.value])}
              style={[styles.option,departmentRefs.includes(row.value)&&styles.selected]}>
              <Text style={styles.optionTitle}>{row.label} · {row.kind?.toLowerCase()}</Text></Pressable>)}
          </>}
          {step===7&&<>
            <Text style={styles.notice}>Only verified private registration proof,
              a signed agreement and a distinct Super Admin final approval can activate a branch.
              Save this final reviewed step before submitting.</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{checked:reviewed}}
              onPress={()=>setReviewed(x=>!x)} style={[styles.option,styles.checkOption]}>
              <View style={styles.checkIconWrap}>
                {reviewed ? <IconCheckCircle size={20} color="#16A34A" /> : <View style={styles.checkboxUnchecked} />}
              </View>
              <Text style={styles.optionTitle}>I reviewed this draft</Text>
            </Pressable>
          </>}
          <View style={styles.actions}>
            {button("Previous",()=>setStep(x=>x-1),step<=1||busy)}
            {button("Next stage",()=>setStep(x=>x+1),
              step>=7||step>=selected.currentStep+1||busy)}
            {canManage&&button("Save draft",()=>void write(),busy||!!pending||submissionBusy,true)}
            {step===7&&canManage&&["DRAFT","RETURNED"].includes(selected.status)&&
              button("Submit for Super Admin review",()=>void submit(),
                busy||!!pending||submissionBusy||selected.stages?.["7"]?.reviewAcknowledged!==true||
                registrationFiles.length===0||agreementFiles.length===0,true)}
            {!!submissionKey&&button("Check/retry original submission",()=>void submit(),submissionBusy||busy)}
          </View>
          {!!status&&<View style={styles.card}>
            <Text style={styles.heading}>Current branch registration status</Text>
            <Text style={styles.help}>Registration: {status.status.replaceAll("_"," ")}</Text>
            <Text style={styles.help}>Approval: {status.approval?
              status.approval.reference+" · "+status.approval.status.replaceAll("_"," "):
              "Not yet confirmed"}</Text>
            {!!status.approval?.history?.length&&<>
              <Text style={styles.heading}>Approval history</Text>
              {status.approval.history.map((event,i)=><Text style={styles.help} key={i}>
                {event.action.replaceAll("_"," ")}
                {event.remarks?": "+event.remarks:""}
                {" · "}{new Date(event.at).toLocaleDateString()}</Text>)}
            </>}
            <Text style={styles.help}>Activation: {status.branch?
              status.branch.branchCode+" · "+status.branch.status:"No branch code issued"}</Text>
            {button("Refresh real approval status",
              ()=>void loadStatus(selected.recordRef).catch(e=>setMessage(friendly(e))),busy)}
          </View>}
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.adminCanvas},
  content:{padding:18,gap:12,paddingBottom:96},
  title:{fontSize:24,fontWeight:"800",color:theme.sidebar},
  help:{fontSize:13,color:theme.mutedText},
  card:{padding:16,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#FFFFFF",borderRadius:14,gap:12,
    shadowColor:"#0F172A",shadowOpacity:0.04,
    shadowOffset:{width:0,height:2},shadowRadius:6,elevation:2},
  headerRow:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:4},
  backBtn:{width:36,height:36,backgroundColor:"#FFFFFF",borderRadius:8,borderWidth:1,
    borderColor:"#CBD5E1",alignItems:"center",justifyContent:"center"},
  headerInfo:{flex:1},
  checkOption:{flexDirection:"row",alignItems:"center",gap:10},
  checkIconWrap:{width:24,height:24,alignItems:"center",justifyContent:"center"},
  checkboxUnchecked:{width:18,height:18,borderRadius:4,borderWidth:2,borderColor:"#94A3B8"},
  heading:{fontSize:17,fontWeight:"700",color:theme.text},
  field:{gap:5},label:{fontSize:14,fontWeight:"600",color:theme.text},
  input:{minHeight:48,padding:10,borderWidth:1,borderColor:theme.border,borderRadius:10,
    backgroundColor:theme.surface,color:theme.text},
  button:{minHeight:48,padding:12,borderWidth:1,borderColor:theme.border,borderRadius:12,
    alignItems:"center",justifyContent:"center",marginTop:4},
  buttonText:{color:theme.text,fontWeight:"600"},primary:{backgroundColor:theme.primary,borderColor:theme.primary},
  primaryText:{color:theme.primaryText},
  disabled:{opacity:.5},
  notice:{padding:12,borderColor:theme.border,borderWidth:1,borderRadius:8,
    color:theme.text,backgroundColor:theme.background},
  option:{padding:12,gap:4,borderWidth:1,borderColor:theme.border,borderRadius:7},
  optionTitle:{fontSize:14,fontWeight:"600",color:theme.text},
  stepRow:{flexDirection:"row",flexWrap:"wrap",gap:6},
  stepButton:{minHeight:42,padding:7,borderRadius:6,borderWidth:1,borderColor:theme.border},
  stepText:{fontSize:12,color:theme.text},
  selected:{borderColor:theme.primary,backgroundColor:theme.background},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:8}
});
