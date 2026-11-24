import {type ReactNode,useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Sharing from "expo-sharing";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import type {
  CG21SettingView,CG21SettingRevision,CG21IntegrationView,CG21AuditPage,
  CG21AuditEvent,CG21AuditDetail,CG21AuditCsv,CG21RecoveryAvailability,
  CG21RecoveryOperation,CG21RecoveryOutcome
} from "@careganga/api-contracts";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Tab="settings"|"audit"|"recovery";
type SafeMessage={key:string;defaultMessage:string;effectiveMessage:string;revision:number;customized:boolean};
type MutatingCommand="SETTING_SAVE"|"INTEGRATION_REFERENCE"|"RECOVERY_REQUEST"|"RECOVERY_AUTHORIZE";
type Pending=
 |{kind:MutatingCommand;key:string}
 |{kind:"SAFE_COPY";key:string;messageKey:string;message:string;originalRevision:number};
type Props={token:string;roleActions:string[];onExit:()=>void;onExpired:()=>void};
const label=(v:string)=>v.replace(/[_-]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object):Promise<T>{
  let response:Response;
  try{
    response=await identityRequest("/api/platform-configuration-audit"+path,{
      method,cache:"no-store",headers:{
        Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})
      },...(body?{body:JSON.stringify(body)}:{})
    });
  }catch{throw Object.assign(new Error("The original request outcome could not be confirmed."),{status:503});}
  if(!response.ok)throw Object.assign(new Error(
    response.status===401?"Your session expired. Sign in again.":
    response.status===403?"Your current permission does not allow this action.":
    response.status===409?"This record changed. Refresh and review before proceeding.":
    response.status===400?"Check the information and current password.":
    "The original request outcome could not be confirmed."
  ),{status:response.status});
  try{return await response.json() as T;}
  catch{throw Object.assign(new Error("The original response could not be verified."),{status:503});}
}
const allowedSource=["ALL","CG-01","CG-21","PAYROLL"] as const;
export function NativePlatformConfiguration({token,roleActions,onExit,onExpired}:Props){
  const can=(name:string)=>roleActions.includes(name);
  const hasSettings=can("platform.settings.view")||can("platform.integrations.view");
  const hasAudit=can("platform.audit.view");
  const hasRecovery=can("platform.recovery.view");
  const [tab,setTab]=useState<Tab>(hasSettings?"settings":hasAudit?"audit":"recovery");
  const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
  const refreshVersion=useRef(0); // Prevent a slower previous tab/filter result replacing current data.
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [pending,setPending]=useState<Pending|null>(null);
  const [setting,setSetting]=useState<CG21SettingView|null>(null);
  const [size,setSize]=useState("");
  const [history,setHistory]=useState<CG21SettingRevision[]>([]);
  const [integrations,setIntegrations]=useState<CG21IntegrationView[]>([]);
  const [provider,setProvider]=useState(""),[purpose,setPurpose]=useState("");
  const [reference,setReference]=useState(""),[integrRev,setIntegrRev]=useState(0);
  const [copy,setCopy]=useState<SafeMessage[]>([]);
  const [selectedCopy,setSelectedCopy]=useState<SafeMessage|null>(null);
  const [copyText,setCopyText]=useState("");
  const [password,setPassword]=useState("");
  const [auditSource,setAuditSource]=useState<"ALL"|"CG-01"|"CG-21"|"PAYROLL">("ALL");
  const [auditFrom,setAuditFrom]=useState("");
  const [auditTo,setAuditTo]=useState("");
  const [appliedFrom,setAppliedFrom]=useState("");
  const [appliedTo,setAppliedTo]=useState("");
  const [audit,setAudit]=useState<CG21AuditPage|null>(null);
  const [auditRows,setAuditRows]=useState<CG21AuditEvent[]>([]);
  const [auditDetail,setAuditDetail]=useState<CG21AuditDetail|null>(null);
  const [availability,setAvailability]=useState<CG21RecoveryAvailability|null>(null);
  const [operations,setOperations]=useState<CG21RecoveryOperation[]>([]);
  const [backup,setBackup]=useState("");
  const [selectedOperation,setSelectedOperation]=useState<CG21RecoveryOperation|null>(null);
  const fail=useCallback((e:unknown)=>{
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
    setError(e instanceof Error?e.message:"The original source is unavailable.");
  },[onExpired]);
  const refresh=useCallback(async():Promise<boolean>=>{
    const requestVersion=++refreshVersion.current;
    setLoading(true);setError("");setAuditDetail(null);
    try{
      if(tab==="settings"){
        if(can("platform.settings.view")){
          const [s,h,m]=await Promise.all([
            api<CG21SettingView>(token,"/settings"),
            api<{events:CG21SettingRevision[]}>(token,"/settings/history?limit=20&offset=0"),
            api<{messages:SafeMessage[]}>(token,"/error-messages")
          ]);
          if(s.key!=="audit.default_page_size"||!Number.isInteger(s.value))throw Error("Current platform setting cannot be verified.");
          if(requestVersion!==refreshVersion.current)return false;
          setSetting(s);setSize(String(s.value));setHistory(h.events??[]);setCopy(m.messages??[]);
        }
        if(can("platform.integrations.view")){
          const c=await api<{connections:CG21IntegrationView[]}>(token,"/integrations");
          if(requestVersion!==refreshVersion.current)return false;
          setIntegrations(c.connections??[]);
        }
      }else if(tab==="audit"&&hasAudit){
        const range=(appliedFrom?"&from="+encodeURIComponent(appliedFrom):"")+
          (appliedTo?"&to="+encodeURIComponent(appliedTo):"");
        const a=await api<CG21AuditPage>(token,"/audit?source="+encodeURIComponent(auditSource==="PAYROLL"?"CG-21":auditSource)+(auditSource==="PAYROLL"?"&category=PAYROLL":"")+range);
        if(requestVersion!==refreshVersion.current)return false;
        setAudit(a);setAuditRows(a.events);setAuditDetail(null);
      }else if(tab==="recovery"&&hasRecovery){
        const [a,o]=await Promise.all([
          api<CG21RecoveryAvailability>(token,"/recovery/availability"),
          api<{operations:CG21RecoveryOperation[]}>(token,"/recovery/operations")
        ]);
        if(requestVersion!==refreshVersion.current)return false;
        setAvailability(a);setOperations(o.operations??[]);
        setSelectedOperation(v=>o.operations?.find(x=>x.operationRef===v?.operationRef)??null);
      }
      return true;
    }catch(e){if(requestVersion===refreshVersion.current)fail(e);return false;}
    finally{if(requestVersion===refreshVersion.current)setLoading(false);}
  },[token,tab,auditSource,appliedFrom,appliedTo,roleActions.join("|"),fail,hasAudit,hasRecovery]);
  useEffect(()=>{void refresh();},[refresh]);
  async function run(kind:MutatingCommand|null,requestKey:string|undefined,action:()=>Promise<unknown>,ok:string){
    if(busy||pending)return;
    setBusy(true);setError("");setNotice("");
    try{const result=await action();
      if(kind){
        const status=result&&typeof result==="object"&&"status" in result?String(result.status):"";
        const accepted=kind==="SETTING_SAVE"?["SAVED","REPLAY_CONFIRMED"]:
          kind==="INTEGRATION_REFERENCE"?["CONFIGURED_NOT_VERIFIED","REPLAY_CONFIRMED"]:
          kind==="RECOVERY_REQUEST"?["NOT_AVAILABLE","REQUESTED","REPLAY_CONFIRMED"]:
          ["PRIVILEGED_AUTHORIZED","REPLAY_CONFIRMED"];
        if(!accepted.includes(status))throw Object.assign(
          new Error("Original operation response is unconfirmed."),{status:503});
      }
      const message=result&&typeof result==="object"&&"status" in result&&result.status==="NOT_AVAILABLE"?
        "Verified secured backup is not available. No restore was requested.":
        result&&typeof result==="object"&&"verified" in result?
          (result.verified===true?"This integration was independently verified.":
            "Integration readiness is not verified. No provider sending permission is claimed."):
          ok;
      setPassword("");setReference("");setBackup("");
      const reloaded=await refresh();
      setNotice(reloaded?message:"Response received, but the latest original record could not be rechecked.");
    }catch(e){
      if(kind&&requestKey&&(!e||typeof e!=="object"||!("status" in e)||Number(e.status)>=500)){
        setPending({kind,key:requestKey});
        setError("Outcome unconfirmed. Check the original command before sending again.");
      }else fail(e);
    }finally{setBusy(false);}
  }
  async function checkOutcome(){
    if(!pending||busy)return;
    const p=pending;
    if(p.kind==="SAFE_COPY"){
      setBusy(true);setError("");
      try{
        const read=await api<{messages:SafeMessage[]}>(token,"/error-messages");
        const row=read.messages.find(x=>x.key===p.messageKey);
        if(row&&row.revision>p.originalRevision&&row.effectiveMessage===p.message){
          setPending(null);setSelectedCopy(null);
          const reloaded=await refresh();
          setNotice(reloaded?"The new safe wording is visible. The exact request outcome remains unverified.":"The new wording appears present, but the original request outcome is still unverified.");
        }else setError("An exact committed message is not verified. Contact Foundation operations before retrying.");
      }catch(e){fail(e);}finally{setBusy(false);}return;
    }
    const path=p.kind==="RECOVERY_REQUEST"?"/recovery/changes/"+encodeURIComponent(p.key):
      p.kind==="RECOVERY_AUTHORIZE"?"/recovery/authorization/changes/"+encodeURIComponent(p.key):
      "/changes/"+p.kind+"/"+encodeURIComponent(p.key);
    setBusy(true);setError("");
    try{
      const r=await api<{status:string}>(token,path);
      if(r.status==="CONFIRMED"){setPending(null);setNotice("The original command is confirmed.");await refresh();}
      else setError("No committed result is visible. Contact Foundation operations before retrying; do not submit a second command.");
    }catch(e){fail(e);}
    finally{setBusy(false);}
  }
  const button=(text:string,press:()=>void,disabled=false)=>
    <Pressable accessibilityRole="button" disabled={disabled}
      accessibilityState={{disabled}} style={[styles.btn,disabled&&styles.disabled]} onPress={press}>
      <Text style={styles.btnText}>{text}</Text>
    </Pressable>;
  const field=(title:string,value:string,change:(x:string)=>void,secure=false,placeholder="")=>
    <View style={styles.field}><Text style={styles.label}>{title}</Text>
      <TextInput style={styles.input} value={value} onChangeText={change}
        secureTextEntry={secure} placeholder={placeholder} placeholderTextColor={t.mutedText}
        autoCapitalize="none" accessibilityLabel={title}/></View>;
  const card=(content:ReactNode)=><View style={styles.card}>{content}</View>;
  const passwordField=field("Current account password",password,setPassword,true);
  const changeTab=(next:Tab)=>{setPassword("");setReference("");setBackup("");setSelectedCopy(null);setTab(next);};
  const confirm=(title:string,detail:string,perform:()=>void)=>
    Alert.alert(title,detail,[{text:"Cancel",style:"cancel"},{text:"Confirm",onPress:perform}]);
  async function savePageSize(){
    if(!setting||!can("platform.settings.manage")||!/^(?:[1-9]\d?|100)$/.test(size))return;
    const n=Number(size);if(!Number.isInteger(n)||n<10||n>100||n===setting.value){setError("Choose a different page size from 10 to 100.");return;}
    if(password.length<8){setError("Enter your current password.");return;}
    const key=Crypto.randomUUID();
    await run("SETTING_SAVE",key,()=>api(token,"/settings","PATCH",{
      key:"audit.default_page_size",value:n,expectedRevision:setting.revision,
      requestKey:key,currentPassword:password
    }),"The page-size change was recorded.");
  }
  async function saveIntegration(){
    if(!can("platform.integrations.manage")||!/^[a-z][a-z0-9_-]{1,62}$/.test(provider)||
        !/^[a-z][a-z0-9_-]{1,62}$/.test(purpose)||!reference.startsWith("secretref:")||
        password.length<8){setError("Enter a supported provider/purpose, secured reference and current password.");return;}
    const key=Crypto.randomUUID();
    await run("INTEGRATION_REFERENCE",key,()=>api(token,"/integrations","POST",{
      provider,purpose,secretReference:reference,expectedRevision:integrRev,
      requestKey:key,currentPassword:password
    }),"Secured integration reference recorded. Provider readiness is not yet verified.");
  }
  async function editCopy(){
    if(!selectedCopy||!can("platform.settings.manage")||password.length<8||
      copyText.trim().length<16||copyText.trim().length>220){
      setError("Check the approved message and current password.");return;
    }
    const original=selectedCopy,submitted=copyText.trim(),key=Crypto.randomUUID();
    if(busy||pending)return;
    setBusy(true);setError("");setNotice("");
    try{
      const saved=await api<{status:string;revision:number}>(token,"/error-messages","PATCH",{
        key:original.key,message:submitted,expectedRevision:original.revision,
        requestKey:key,currentPassword:password
      });
      if(!["SAVED","REPLAY_CONFIRMED"].includes(saved.status)||!Number.isInteger(saved.revision))
        throw Object.assign(new Error("Message update outcome cannot be confirmed."),{status:503});
      setPassword("");setSelectedCopy(null);
      const reloaded=await refresh();
      setNotice(reloaded?"Safe message wording updated; server validation is unchanged.":
        "The update response was recorded, but the latest source could not be rechecked.");
    }catch(e){
      if(!e||typeof e!=="object"||!("status" in e)||Number(e.status)>=500){
        setPending({kind:"SAFE_COPY",key,messageKey:original.key,message:submitted,originalRevision:original.revision});
        setError("The previous wording update is unconfirmed. Check the original message before contacting operations.");
      }else fail(e);
    }finally{setBusy(false);}
  }
  async function auditMore(){
    if(!audit?.nextCursor||busy)return;setBusy(true);setError("");
    const version=refreshVersion.current;
    try{const a=await api<CG21AuditPage>(token,"/audit?cursor="+encodeURIComponent(audit.nextCursor));
      if(version!==refreshVersion.current)return;
      setAudit(a);setAuditRows(rows=>[...rows,...a.events]);
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function openAudit(ref:string){
    if(busy)return;
    const version=refreshVersion.current;
    setBusy(true);setError("");
    try{const detail=await api<CG21AuditDetail>(token,"/audit/detail/"+encodeURIComponent(ref));
      if(version===refreshVersion.current)setAuditDetail(detail);}
    catch(e){fail(e);}finally{setBusy(false);}
  }
  async function exportAudit(){
    if(!can("platform.audit.export")||busy)return;setBusy(true);setError("");
    let temporary:File|null=null;
    try{const x=await api<CG21AuditCsv>(token,"/audit/export?source="+encodeURIComponent(auditSource==="PAYROLL"?"CG-21":auditSource)+(auditSource==="PAYROLL"?"&category=PAYROLL":"")+
        (appliedFrom?"&from="+encodeURIComponent(appliedFrom):"")+
        (appliedTo?"&to="+encodeURIComponent(appliedTo):""));
      if(x.coverage!=="COMPLETE"){setError("Audit coverage is incomplete; export is unavailable.");return;}
      if(!await Sharing.isAvailableAsync()){
        setError("CSV file sharing is not available on this device. No file was sent.");
        return;
      }
      // Same protected CG21 original audit bytes as Web, held in a
      // temporary app file only while the platform shares them.
      temporary=new File(Paths.cache,"careganga-foundation-audit-"+Crypto.randomUUID()+".csv");
      temporary.create();
      await temporary.write(x.csv);
      await Sharing.shareAsync(temporary.uri,{
        mimeType:"text/csv",dialogTitle:"Share protected Foundation audit CSV"
      });
      if(x.truncated)setNotice("This export is limited to the current approved first 100 records.");
    }catch(e){fail(e);}finally{
      try{temporary?.delete()}catch{}
      setBusy(false);
    }
  }
  async function requestRecovery(){
    if(!can("platform.recovery.request")||availability?.status!=="AVAILABLE"||!backup.startsWith("backupref:")||password.length<8){
      setError("Enter an actual verified backup reference and current password.");return;
    }
    const key=Crypto.randomUUID();
    await run("RECOVERY_REQUEST",key,()=>api<CG21RecoveryOutcome>(token,"/recovery/request","POST",{
      backupReference:backup,expectedVersion:0,requestKey:key,currentPassword:password
    }),"Recovery request recorded; no restore was executed.");
  }
  async function authorizeRecovery(){
    if(!can("platform.recovery.authorize")||!selectedOperation||
      selectedOperation.status!=="REQUESTED"||password.length<8){
      setError("Select a current pending recovery and enter your password.");return;
    }
    const key=Crypto.randomUUID();
    await run("RECOVERY_AUTHORIZE",key,()=>api(token,
      "/recovery/operations/"+encodeURIComponent(selectedOperation.operationRef)+"/authorize","POST",{
        requestKey:key,expectedVersion:selectedOperation.version,currentPassword:password
      }),"Independent authorization recorded; restoration has not been executed.");
  }
  return <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>Platform & Configuration</Text>
        {button("Back",onExit,busy)}
      </View>
      <Text style={styles.muted}>Foundation settings, source audit and protected recovery, with the same effective permissions as Web.</Text>
      <View style={styles.tabs}>
        {hasSettings&&button("Settings",()=>changeTab("settings"),tab==="settings"||busy)}
        {hasAudit&&button("Audit",()=>changeTab("audit"),tab==="audit"||busy)}
        {hasRecovery&&button("Recovery",()=>changeTab("recovery"),tab==="recovery"||busy)}
      </View>
      {button("Refresh original records",()=>void refresh(),busy||loading)}
      {loading&&<ActivityIndicator accessibilityLabel="Loading original platform records" color={t.primary}/>}
      {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {!!notice&&<Text style={styles.notice}>{notice}</Text>}
      {pending&&card(<>
        <Text style={styles.label}>Previous change outcome is unknown.</Text>
        <Text style={styles.muted}>Check the original command before attempting another change.</Text>
        {button("Check original command",()=>void checkOutcome(),busy)}
      </>)}
      {tab==="settings"&&hasSettings&&<>
        {can("platform.settings.view")&&card(<>
          <Text style={styles.section}>Audit page size</Text>
          <Text style={styles.muted}>Current approved value: {setting?.value??"Unavailable"}</Text>
          {can("platform.settings.manage")&&<>
            {field("Page size (10–100)",size,setSize,false,"25")}
            {passwordField}
            {button("Save setting",()=>void savePageSize(),busy||!!pending||!setting)}
          </>}
          {history.slice(0,10).map(h=><Text key={h.revision} style={styles.muted}>
            Version {h.revision}: {h.value} · {h.changedBy}
          </Text>)}
        </>)}
        {can("platform.integrations.view")&&card(<>
          <Text style={styles.section}>Integration references</Text>
          <Text style={styles.muted}>References and verification status only; credentials are never displayed.</Text>
          {integrations.map(x=><Pressable key={x.provider+"/"+x.purpose} style={styles.item}
            onPress={()=>{setProvider(x.provider);setPurpose(x.purpose);setIntegrRev(x.revision);setReference("");}}>
            <Text style={styles.label}>{label(x.provider)} · {label(x.purpose)}</Text>
            <Text style={styles.muted}>{label(x.status)}</Text>
          </Pressable>)}
          {can("platform.integrations.manage")&&<>
            {field("Provider",provider,setProvider)}
            {field("Purpose",purpose,setPurpose)}
            {field("Secured secret-store reference (not a credential)",reference,setReference,true,"secretref:...")}
            <Text style={styles.muted}>Existing version: {integrRev}. Do not paste passwords or API secrets.</Text>
            {passwordField}
            {button("Save reference",()=>void saveIntegration(),busy||!!pending)}
            {button("Check actual integration readiness",()=>void run(null,undefined,()=>api<{
                status:string;verified:boolean
              }>(token,"/integrations/"+encodeURIComponent(provider)+"/"+
                encodeURIComponent(purpose)+"/check","POST"),
              "Integration check returned. Inspect the source status."),busy||!!pending||!provider||!purpose)}
          </>}
        </>)}
        {can("platform.settings.view")&&card(<>
          <Text style={styles.section}>Safe error messages</Text>
          <Text style={styles.muted}>Editing wording never changes underlying validation or permissions.</Text>
          {copy.map(c=><Pressable key={c.key} style={styles.item}
            onPress={()=>{if(!can("platform.settings.manage"))return;setSelectedCopy(c);setCopyText(c.effectiveMessage);}}>
            <Text style={styles.label}>{label(c.key)}</Text>
            <Text style={styles.muted}>{c.effectiveMessage}</Text>
          </Pressable>)}
          {!!selectedCopy&&can("platform.settings.manage")&&<>
            {field("Approved safe message wording",copyText,setCopyText)}
            {passwordField}
            {button("Update wording",()=>void editCopy(),busy||!!pending)}
          </>}
        </>)}
      </>}
      {tab==="audit"&&hasAudit&&<>
        {card(<>
          <Text style={styles.section}>Foundation audit records</Text>
          {field("From (optional ISO-8601 UTC)",auditFrom,setAuditFrom,false,"2026-11-01T00:00:00Z")}
          {field("To (optional ISO-8601 UTC)",auditTo,setAuditTo,false,"2026-11-21T23:59:59Z")}
          <View style={styles.tabs}>{allowedSource.map(x=>button(x==="ALL"?"All":x==="CG-01"?"Identity":x==="PAYROLL"?"Payroll":"Platform",
            ()=>{setAuditSource(x);setAudit(null);setAuditRows([]);},busy||x===auditSource))}</View>
          {button("Apply audit dates",()=>{
            setAppliedFrom(auditFrom.trim());setAppliedTo(auditTo.trim());
          },busy||loading)}
          <Text style={styles.muted}>Coverage: {audit?.coverage??"Unavailable"} · Entries are restricted by the source owner.</Text>
          {audit?.coverage==="PARTIAL"&&<Text style={styles.error}>One owner feed is unavailable. Do not assume a complete audit.</Text>}
          {auditRows.map(x=><Pressable key={x.eventRef} style={styles.item}
            onPress={()=>void openAudit(x.eventRef)}>
            <Text style={styles.label}>{x.actionLabel}</Text>
            <Text style={styles.muted}>{x.actorDisplay} · {x.occurredAt}</Text>
            <Text style={styles.muted}>{x.outcome}</Text>
          </Pressable>)}
          {audit?.nextCursor&&button("Load more audit events",()=>void auditMore(),busy)}
          {auditDetail&&card(<>
            <Text style={styles.label}>{auditDetail.actionLabel}</Text>
            <Text style={styles.muted}>{auditDetail.occurredAt} · {auditDetail.actorDisplay}</Text>
            <Text style={styles.muted}>{auditDetail.targetDisplay} · {auditDetail.outcome}</Text>
            {button("Close detail",()=>setAuditDetail(null))}
          </>)}
          {can("platform.audit.export")&&button("Share approved audit CSV",()=>void exportAudit(),busy||audit?.coverage!=="COMPLETE")}
        </>)}
      </>}
      {tab==="recovery"&&hasRecovery&&card(<>
        <Text style={styles.section}>Protected backup & recovery</Text>
        <Text style={styles.muted}>{availability?.message??"Availability not verified."}</Text>
        <Text style={styles.muted}>A request or authorization does not execute a restore.</Text>
        {operations.map(o=><Pressable key={o.operationRef} style={styles.item}
          onPress={()=>{setSelectedOperation(o);setPassword("");}}>
          <Text style={styles.label}>{label(o.status)}</Text>
          <Text style={styles.muted}>Updated {o.updatedAt} · Version {o.version}</Text>
        </Pressable>)}
        {selectedOperation&&<Text style={styles.muted}>Selected: {label(selectedOperation.status)}</Text>}
        {can("platform.recovery.request")&&<>
          {field("Verified secured backup reference",backup,setBackup,true,"backupref:...")}
          {passwordField}
          {button("Record recovery request",()=>confirm("Review recovery request",
            "This records a privileged request only. No backup will be restored by this action.",
            ()=>void requestRecovery()),busy||!!pending||availability?.status!=="AVAILABLE")}
        </>}
        {can("platform.recovery.authorize")&&selectedOperation?.status==="REQUESTED"&&<>
          {passwordField}
          {button("Record separate authorization",()=>confirm("Review independent authorization",
            "This approves the recorded recovery operation only. It does not execute a restore.",
            ()=>void authorizeRecovery()),busy||!!pending)}
        </>}
      </>)}
      {!hasSettings&&!hasAudit&&!hasRecovery&&<Text style={styles.error}>This platform module is not authorized for your role.</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:t.adminCanvas},
  container:{padding:16,gap:13,paddingBottom:36},
  head:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
  title:{fontSize:21,fontWeight:"700",color:t.text,flex:1},
  section:{fontSize:17,fontWeight:"700",color:t.text,marginBottom:4},
  label:{fontSize:13,fontWeight:"600",color:t.text},
  muted:{fontSize:12,color:t.mutedText,lineHeight:18},
  card:{borderRadius:12,borderWidth:1,borderColor:t.border,backgroundColor:t.surface,padding:13,gap:10},
  tabs:{flexDirection:"row",flexWrap:"wrap",gap:8},
  btn:{backgroundColor:t.primary,paddingHorizontal:13,paddingVertical:11,borderRadius:9,alignSelf:"flex-start",minHeight:44,justifyContent:"center"},
  btnText:{fontSize:13,color:t.primaryText,fontWeight:"700"},
  disabled:{opacity:0.45},
  field:{gap:5},
  input:{borderWidth:1,borderColor:t.border,borderRadius:9,backgroundColor:t.surface,color:t.text,paddingHorizontal:12,paddingVertical:10,minHeight:44},
  item:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:9,gap:4},
  error:{fontSize:13,color:t.error},
  notice:{fontSize:13,color:t.primary}
});
