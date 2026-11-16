import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Draft={recordRef:string;branchName:string;branchType:string;version:number;
  status:string;currentStep:number;updatedAt:string};
type Detail=Draft&{stages:Record<string,Record<string,unknown>>;managerRef:string|null;geographyRef:string|null};
type Option={value:string;label:string;kind?:string};
type Area={areaRef:string;name:string;level:string;status:string};
type Pending={action:"BRANCH_DRAFT_CREATE"|"BRANCH_DRAFT_SAVE";requestKey:string};
type Props={token:string;canManage:boolean;onExit:()=>void;onExpired:()=>void};
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
export function BranchRegistrationScreen({token,canManage,onExit,onExpired}:Props){
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [selected,setSelected]=useState<Detail|null>(null),[step,setStep]=useState(1);
  const [name,setName]=useState(""),[branchType,setBranchType]=useState("");
  const [openingDate,setOpeningDate]=useState("");
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
  const load=useCallback(async()=>{
    const response=await api<{drafts:Draft[]}>(token,"branches/drafts");
    setDrafts(response.drafts);
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
      s5=stages["5"]??{},s6=stages["6"]??{},s7=stages["7"]??{};
    setSelected(detail);setStep(Math.max(1,Math.min(7,detail.currentStep)));
    setName(value(s1.branchName));setBranchType(value(s1.branchType));setOpeningDate(value(s1.openingDate));
    setArea(value(s2.geographyRef));setAddress(value(s2.postalAddress));setPin(value(s2.pinCode));
    setLatitude(s2.latitude===null||s2.latitude===undefined?"":String(s2.latitude));
    setLongitude(s2.longitude===null||s2.longitude===undefined?"":String(s2.longitude));
    setManager(value(s5.managerRef));setDepartmentRefs(list(s6.departmentRefs));
    setReviewed(s7.reviewAcknowledged===true);
  }
  async function open(reference:string){
    setBusy(true);setMessage("");
    try{hydrate(await api<Detail>(token,"branches/drafts/"+encodeURIComponent(reference)));}
    catch(error){setSelected(null);setMessage(friendly(error));if(error instanceof Error&&error.message==="EXPIRED")onExpired();}
    finally{setBusy(false);}
  }
  function stage():Record<string,unknown>{
    if(step===1)return {branchName:name,branchType,openingDate:openingDate||null};
    if(step===2)return {geographyRef:area||null,postalAddress:address,pinCode:pin,
      latitude:latitude.trim()?Number(latitude):null,longitude:longitude.trim()?Number(longitude):null};
    if(step===3)return {registrationFiles:[]};
    if(step===4)return {agreementFiles:[],photoFiles:[]};
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
    }catch(error){setMessage(friendly(error));if(error instanceof Error&&error.message==="EXPIRED")onExpired();}
    finally{setBusy(false);}
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
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.title}>Branch registration</Text>
        <Text style={styles.help}>CareGanga Foundation · Seven-stage draft workflow</Text>
        {button("Back to staff home",onExit,busy)}
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
          {canManage&&button("New branch draft",()=>{setCreating(true);setName("");setBranchType("");setOpeningDate("");},busy||!!pending,true)}
        </View>}
        {creating&&<View style={styles.card}>
          <Text style={styles.heading}>Start branch</Text>
          {input("Branch name",name,setName)}
          {input("Branch type",branchType,setBranchType)}
          {input("Opening date (YYYY-MM-DD)",openingDate,setOpeningDate)}
          {button("Save new draft",()=>void write(),busy||!!pending||name.trim().length<2,true)}
          {button("Cancel",()=>setCreating(false),busy)}
        </View>}
        {selected&&!creating&&<View style={styles.card}>
          <Text style={styles.heading}>{selected.branchName}</Text>
          <Text style={styles.help}>{selected.status.replaceAll("_"," ")} · Revision {selected.version}</Text>
          <View style={styles.stepRow}>{titles.map((title,i)=><Pressable key={title}
            style={[styles.stepButton,step===i+1&&styles.selected]}
            accessibilityRole="button" accessibilityState={{disabled:i+1>selected.currentStep+1}}
            disabled={i+1>selected.currentStep+1||busy} onPress={()=>setStep(i+1)}>
            <Text style={styles.stepText}>{i+1}. {title}</Text></Pressable>)}</View>
          <Text style={styles.heading}>Step {step}: {titles[step-1]}</Text>
          {step===1&&<>
            {input("Branch name",name,setName)}
            {input("Branch type",branchType,setBranchType)}
            {input("Opening date (YYYY-MM-DD)",openingDate,setOpeningDate)}
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
          {(step===3||step===4)&&<Text style={styles.notice}>Secure pre-submission evidence
            upload is not yet connected. This stage can be saved as a draft only;
            no file is verified and the branch cannot be submitted or activated.</Text>}
          {step===5&&<>
            <Text style={styles.label}>Current eligible Foundation manager</Text>
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
            <Text style={styles.notice}>Only real CG19 verified evidence and CG03 final
              Super Admin approval can activate a branch. Those integrations are pending.</Text>
            <Pressable accessibilityRole="checkbox" accessibilityState={{checked:reviewed}}
              onPress={()=>setReviewed(x=>!x)} style={styles.option}>
              <Text style={styles.optionTitle}>{reviewed?"☑":"☐"} I reviewed this draft</Text></Pressable>
          </>}
          <View style={styles.actions}>
            {button("Previous",()=>setStep(x=>x-1),step<=1||busy)}
            {button("Next stage",()=>setStep(x=>x+1),
              step>=7||step>=selected.currentStep+1||busy)}
            {canManage&&button("Save draft",()=>void write(),busy||!!pending,true)}
          </View>
          {button("Back to drafts",()=>{setSelected(null);setMessage("");},busy)}
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.background},
  content:{padding:18,gap:12,paddingBottom:40},
  title:{fontSize:24,fontWeight:"800",color:theme.sidebar},
  help:{fontSize:13,color:theme.mutedText},
  card:{padding:16,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,borderRadius:12,gap:12},
  heading:{fontSize:17,fontWeight:"700",color:theme.text},
  field:{gap:5},label:{fontSize:14,fontWeight:"600",color:theme.text},
  input:{minHeight:48,padding:10,borderWidth:1,borderColor:theme.border,borderRadius:7,
    backgroundColor:theme.surface,color:theme.text},
  button:{minHeight:48,padding:12,borderWidth:1,borderColor:theme.border,borderRadius:7,
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
