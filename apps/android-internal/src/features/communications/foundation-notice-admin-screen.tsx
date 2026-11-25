import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,BackHandler,Pressable,ScrollView,StyleSheet,
  Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Channel="IN_APP"|"EMAIL"|"SMS";
type Option={value:string;label:string};
type Notice={noticeRef:string;title:string;body:string;state:string;
  revision:number;audienceCount:number;priority:string;purpose:string;
  channels:Channel[];audienceKind:string;targetHref:string|null;
  expiresAt:string;scheduledAt:string|null;createdAt:string};
type Review={ref:string;revision:number;action:"APPROVE"|"CANCEL"};
type Provider={channel:string;state:string;configured:boolean};
type ClientEmailReference={code:string;title:string;owner:string;trigger:string;
 recipient:string;subject:string;body:string;attachmentRule:string;
 placeholders:string[];state:string;deliveryEnabled:false};
type Props={token:string;mayManage:boolean;mayApprove:boolean;mayProcess:boolean;
  mayViewDelivery:boolean;maySelectAccounts:boolean;maySelectRoles:boolean;
  onExit:()=>void;onExpired:()=>void};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
  let response:Response;
  try{response=await identityRequest("/api/communications/"+path,{
    method,headers:{Authorization:"Bearer "+token,
      ...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  })}catch{throw Error("UNKNOWN")}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("CONFLICT");
  if(response.status===400)throw Error("INVALID");
  if(!response.ok)throw Error("UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN")}
}
function explain(e:unknown){
  const reason=e instanceof Error?e.message:"UNKNOWN";
  return reason==="EXPIRED"?"The Foundation session expired.":
    reason==="DENIED"?"Your current role does not permit this operation.":
    reason==="CONFLICT"?"This notice changed. Refresh the original record.":
    reason==="INVALID"?"Check the audience, message and expiry.":
    "Result not confirmed. Check the original request before any retry.";
}
export function FoundationNoticeAdminScreen({token,mayManage,mayApprove,mayProcess,
  mayViewDelivery,maySelectAccounts,maySelectRoles,onExit,onExpired}:Props){
  const [notices,setNotices]=useState<Notice[]>([]);
  const [providers,setProviders]=useState<Provider[]>([]);
  const [options,setOptions]=useState<Option[]>([]);
  const [counts,setCounts]=useState<Array<{channel:string;status:string;count:number}>>([]);
  const [countRef,setCountRef]=useState("");
  const [title,setTitle]=useState(""),[body,setBody]=useState("");
  const [priority,setPriority]=useState("NORMAL"),[purpose,setPurpose]=useState("TRANSACTIONAL");
  const [audienceKind,setAudienceKind]=useState<"ALL_ACTIVE"|"ROLE"|"INDIVIDUAL">("ALL_ACTIVE");
  const [audienceRef,setAudienceRef]=useState("");
  const [email,setEmail]=useState(false),[sms,setSms]=useState(false);
  const [scheduledAt,setScheduledAt]=useState(""),[expiresAt,setExpiresAt]=useState("");
  const [targetHref,setTargetHref]=useState("");
  const [draftKey,setDraftKey]=useState(""),[draftUnknown,setDraftUnknown]=useState(false);
  const [review,setReview]=useState<Review|null>(null),[currentPassword,setCurrentPassword]=useState("");
  const [reviewKey,setReviewKey]=useState(""),[reviewUnknown,setReviewUnknown]=useState(false);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const [emailOpen,setEmailOpen]=useState(false);
  const [emailLoading,setEmailLoading]=useState(false);
  const [emailReferences,setEmailReferences]=useState<ClientEmailReference[]>([]);
  const [emailSearch,setEmailSearch]=useState("");
  const [emailSelected,setEmailSelected]=useState("");
  const [emailImportUnknown,setEmailImportUnknown]=useState(false);
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [list,status]=await Promise.all([
        mayManage?api<{notices:Notice[]}>(token,"notices?limit=30"):
          Promise.resolve({notices:[]}),
        mayViewDelivery?api<{channels:Provider[]}>(token,"providers/status"):
          Promise.resolve({channels:[]})
      ]);
      if(!Array.isArray(list.notices)||list.notices.length>30)
        throw Error("UNKNOWN");
      setNotices(list.notices);setProviders(status.channels);
    }catch(e){
      setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setLoading(false)}
  },[token,mayManage,mayViewDelivery,onExpired]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    setOptions([]);setAudienceRef("");
    if(audienceKind==="ALL_ACTIVE"||!mayManage)return;
    if(audienceKind==="ROLE"&&!maySelectRoles||
      audienceKind==="INDIVIDUAL"&&!maySelectAccounts)return;
    let live=true;
    const path=audienceKind==="ROLE"?"roles":"accounts";
    void identityRequest("/api/access/"+path+"/options?search=",{
      headers:{Authorization:"Bearer "+token}})
      .then(r=>r.ok?r.json():Promise.reject()).then((r:unknown)=>{
        if(live&&r&&typeof r==="object"&&"options" in r&&Array.isArray(r.options))
          setOptions((r.options as Option[]).slice(0,30));
      }).catch(()=>{if(live)setNotice("Current audience options unavailable.")});
    return()=>{live=false};
  },[audienceKind,mayManage,maySelectAccounts,maySelectRoles,token]);
  const leave=useCallback(()=>{
    if(draftUnknown||reviewUnknown||emailImportUnknown){
      Alert.alert("Original Foundation request not confirmed",
        "The previous notice, approval or template import may have "+
        "committed. Leaving loses the local request/reconciliation state.",[
          {text:"Check original request",style:"cancel"},
          {text:"Leave anyway",style:"destructive",onPress:onExit}
        ]);
      return;
    }
    onExit();
  },[draftUnknown,reviewUnknown,emailImportUnknown,onExit]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(review&&!reviewUnknown){setReview(null);return true}
      leave();return true;
    });
    return()=>sub.remove();
  },[review,reviewUnknown,leave]);
  async function create(){
    if(!mayManage||busy||draftUnknown)return;
    if(!expiresAt||!Number.isFinite(Date.parse(expiresAt))||
      scheduledAt&&!Number.isFinite(Date.parse(scheduledAt))){
      setNotice("Enter a valid ISO date/time for expiry and optional schedule.");return;
    }
    setBusy(true);setNotice("");
    const requestKey=draftKey||Crypto.randomUUID();setDraftKey(requestKey);
    try{
      const result=await api<Notice&{result:string}>(token,"notices","POST",{
        title,body,priority,purpose,audienceKind,
        audienceRef:audienceKind==="ALL_ACTIVE"?null:audienceRef,
        channels:["IN_APP",...(email?["EMAIL"]:[]),...(sms?["SMS"]:[])],
        scheduledAt:scheduledAt?new Date(scheduledAt).toISOString():null,
        expiresAt:new Date(expiresAt).toISOString(),targetHref:targetHref||null,
        requestKey
      });
      if(!result.noticeRef||!Number.isInteger(result.revision))throw Error("UNKNOWN");
      setDraftKey("");setDraftUnknown(false);setTitle("");setBody("");
      setExpiresAt("");setScheduledAt("");setTargetHref("");
      setNotice("Original notice draft saved. No external delivery is claimed.");
      await load();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setDraftUnknown(true);
      setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false)}
  }
  async function lookupDraft(){
    if(!draftKey||busy)return;
    setBusy(true);setNotice("");
    try{
      const x=await api<{status:string;notice:Notice|null}>(token,
        "notices/requests/"+draftKey);
      if(x.status==="CONFIRMED"&&x.notice){
        setDraftKey("");setDraftUnknown(false);
        setNotice("The original saved notice was recovered.");
        await load();
      }else{setNotice("Original draft was not confirmed. Keep the request key; do not create a second notice.");}
    }catch(e){setNotice(explain(e))}
    finally{setBusy(false)}
  }
  async function decide(){
    if(!review||busy||!mayApprove||reviewUnknown)return;
    if((currentPassword.length<8||currentPassword.length>1024)){setNotice("Enter a current password.");return;}
    setBusy(true);setNotice("");
    const requestKey=reviewKey||Crypto.randomUUID();setReviewKey(requestKey);
    try{
      const out=await api<{status:string;revision:number}>(token,
        "notices/"+review.ref+"/decision","POST",{
          action:review.action,expectedRevision:review.revision,
          requestKey,currentPassword
        });
      if(!Number.isInteger(out.revision))throw Error("UNKNOWN");
      setReview(null);setReviewKey("");setReviewUnknown(false);setCurrentPassword("");
      setNotice("Original Foundation notice state confirmed: "+out.status);
      await load();
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setReviewUnknown(true);
      setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false)}
  }
  async function lookupDecision(){
    if(!review||!reviewKey||busy)return;
    setBusy(true);setNotice("");
    try{
      const res=await api<{status:string;revision:number|null;action:string|null}>(token,
        "notices/"+review.ref+"/requests/"+reviewKey);
      if(res.status==="CONFIRMED"&&Number.isInteger(res.revision)){
        setReview(null);setReviewKey("");setReviewUnknown(false);setCurrentPassword("");
        setNotice("Original notice action confirmed: "+res.action);
        await load();
      }else setNotice("No confirmed action located. Keep the original key for Foundation operations.");
    }catch(e){setNotice(explain(e))}
    finally{setBusy(false)}
  }
  async function delivery(ref:string){
    if(!mayViewDelivery||busy)return;
    setBusy(true);setNotice("");
    try{
      const x=await api<{counts:Array<{channel:string;status:string;count:number}>}>(
        token,"notices/"+ref+"/counts");
      setCountRef(ref);setCounts(x.counts);
    }catch(e){setNotice(explain(e))}
    finally{setBusy(false)}
  }
  async function loadClientEmailReferences(){
    if(!mayManage||emailLoading||busy)return;
    setEmailLoading(true);setNotice("");
    try{
      const result=await api<{templates:ClientEmailReference[];total:number;
        deliveryEnabled:false}>(token,"client-email-templates");
      if(result.total!==52||result.deliveryEnabled!==false||
        !Array.isArray(result.templates)||result.templates.length!==52||
        result.templates.some(t=>!t.code||!t.title||!t.subject||!t.body||
          !Array.isArray(t.placeholders)||t.deliveryEnabled!==false))
        throw Error("UNKNOWN");
      setEmailReferences(result.templates);
      // Import is a single original atomic, disabled-only transaction.
      // A lost response can be reconciled from the real persisted statuses.
      if(emailImportUnknown){
        const all=result.templates.every(t=>t.state==="SOURCE_DRAFT");
        setEmailImportUnknown(false);
        setNotice(all?
          "All 52 client email references are confirmed as disabled drafts. No mail was sent.":
          "Some original email references remain unimported or changed. "+
          "Review the source status before retrying the safe disabled-draft import.");
      }
    }catch(e){
      setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setEmailLoading(false)}
  }
  async function importClientEmailDrafts(){
    if(!mayManage||busy||emailLoading||emailImportUnknown)return;
    setBusy(true);setNotice("");
    try{
      const result=await api<{imported:number;alreadyPresent:number;
        total:number;deliveryEnabled:false}>(token,
        "client-email-templates/import-drafts","POST");
      if(result.total!==52||result.deliveryEnabled!==false||
        !Number.isSafeInteger(result.imported)||
        !Number.isSafeInteger(result.alreadyPresent)||
        result.imported+result.alreadyPresent!==52)
        throw Error("UNKNOWN");
      setEmailImportUnknown(false);
      setNotice(result.imported+" original client references saved as disabled drafts; "+
        result.alreadyPresent+" already existed. No emails were sent.");
      setEmailReferences([]);
    }catch(e){
      if(e instanceof Error&&e.message==="UNKNOWN")setEmailImportUnknown(true);
      setNotice(e instanceof Error&&e.message==="CONFLICT"?
        "Existing client email text differs from the approved source. "+
        "Review the source version; no emails were sent.":explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false)}
  }
  async function recovery(kind:"process-due"|"recover-decisions"){
    if(!mayProcess||busy)return;
    setBusy(true);setNotice("");
    try{
      await api(token,kind,"POST");
      setNotice("Bounded recovery requested. Refresh to verify original status.");
      await load();
    }catch(e){setNotice(explain(e))}
    finally{setBusy(false)}
  }
  return <SafeAreaView style={s.page} edges={["left","right"]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.row}>
        <Pressable style={s.button} accessibilityRole="button" onPress={leave}>
          <Text>Back</Text></Pressable>
        <Text style={s.title} accessibilityRole="header">Foundation communications</Text>
      </View>
      <Text style={s.muted}>Approve notices against the frozen permitted audience.
        Queued or provider-accepted is not confirmed delivery.</Text>
      {notice?<Text style={s.error} accessibilityRole="alert">{notice}</Text>:null}
      {loading&&<ActivityIndicator accessibilityLabel="Loading verified notice state"/>}
      <Pressable style={s.button} onPress={()=>void load()} disabled={busy}>
        <Text>Refresh notices</Text></Pressable>
      {mayViewDelivery&&providers.length>0&&<View style={s.card}>
        <Text style={s.heading}>Channel readiness</Text>
        {providers.map(x=><Text key={x.channel}>{x.channel}: {x.state}</Text>)}
      </View>}
      {mayProcess&&<View style={s.card}>
        <Text style={s.heading}>Source recovery</Text>
        <Pressable style={s.button} disabled={busy} onPress={()=>void recovery("recover-decisions")}>
          <Text>Recover committed decisions</Text></Pressable>
        <Pressable style={s.button} disabled={busy} onPress={()=>void recovery("process-due")}>
          <Text>Process bounded due jobs</Text></Pressable>
      </View>}
      {mayManage&&<View style={s.card}>
        <Pressable style={s.button} accessibilityRole="button"
          accessibilityState={{expanded:emailOpen}} disabled={busy}
          onPress={()=>setEmailOpen(v=>!v)}>
          <Text style={s.heading}>Client email references (52) {emailOpen?"−":"+"}</Text>
        </Pressable>
        {emailOpen&&<>
          <Text style={s.muted}>Approved source words and attachment rules only.
            Imports are disabled drafts. They cannot send an email or create
            donation, membership, volunteer, HR or payroll records. Real sending
            requires its owning module, verified recipients and approved documents.</Text>
          <View style={s.rowWrap}>
            <Pressable style={s.button} accessibilityRole="button"
              disabled={busy||emailLoading||emailImportUnknown}
              onPress={()=>void importClientEmailDrafts()}>
              <Text>Import missing disabled drafts</Text>
            </Pressable>
            <Pressable style={s.button} accessibilityRole="button"
              disabled={busy||emailLoading}
              onPress={()=>void loadClientEmailReferences()}>
              <Text>{emailImportUnknown?"Check uncertain import":"Refresh template references"}</Text>
            </Pressable>
          </View>
          {emailLoading&&<ActivityIndicator
            accessibilityLabel="Loading verified client email reference catalog"/>}
          {emailImportUnknown&&<Text style={s.error}>
            Import result not confirmed. Check the original references before retrying.
          </Text>}
          <TextInput style={s.input} value={emailSearch} onChangeText={setEmailSearch}
            maxLength={80} accessibilityLabel="Search email references"
            placeholder="Search name or owning module"/>
          {emailReferences.filter(x=>
            (x.title+" "+x.code+" "+x.owner).toLowerCase()
              .includes(emailSearch.trim().toLowerCase())).map(x=>
            <View key={x.code} style={s.item}>
              <Pressable accessibilityRole="button" style={s.button}
                accessibilityState={{expanded:emailSelected===x.code}}
                onPress={()=>setEmailSelected(v=>v===x.code?"":x.code)}>
                <Text style={s.label}>{x.title}</Text>
                <Text style={s.muted}>{x.owner} · {x.state.replaceAll("_"," ")}</Text>
              </Pressable>
              {emailSelected===x.code&&<>
                <Text style={s.muted}>Source trigger: {x.trigger}</Text>
                <Text style={s.muted}>Recipient: {x.recipient||
                  "Verified by the original owning module"}</Text>
                <Text style={s.muted}>Required documents: {x.attachmentRule}</Text>
                <Text style={s.muted}>Required fields: {x.placeholders.join(", ")||"None"}</Text>
                <Text style={s.label}>Subject preview</Text>
                <Text selectable>{x.subject}</Text>
                <Text style={s.label}>Body preview (source placeholders only)</Text>
                <Text selectable>{x.body}</Text>
              </>}
            </View>)}
          {!emailLoading&&!emailReferences.length&&
            <Text style={s.muted}>Refresh references to inspect the approved catalog.</Text>}
        </>}
      </View>}
      {mayManage&&<View style={s.card}>
        <Text style={s.heading}>Draft new Foundation notice</Text>
        <TextInput value={title} onChangeText={setTitle} style={s.input}
          maxLength={120} accessibilityLabel="Notice title" placeholder="Title (5–120)"/>
        <TextInput value={body} onChangeText={setBody} style={[s.input,s.long]}
          maxLength={480} multiline accessibilityLabel="Notice message"
          placeholder="Approved message body (10–480)"/>
        <Text style={s.label}>Priority</Text>
        <View style={s.rowWrap}>{["NORMAL","IMPORTANT"].map(x=>
          <Pressable key={x} style={s.button} accessibilityRole="button"
            accessibilityState={{selected:priority===x}} onPress={()=>setPriority(x)}>
            <Text>{x}</Text></Pressable>)}</View>
        <Text style={s.label}>Purpose</Text>
        <View style={s.rowWrap}>{["TRANSACTIONAL","PROMOTIONAL"].map(x=>
          <Pressable key={x} style={s.button} accessibilityRole="button"
            accessibilityState={{selected:purpose===x}} onPress={()=>setPurpose(x)}>
            <Text>{x}</Text></Pressable>)}</View>
        <Text style={s.label}>Audience</Text>
        <View style={s.rowWrap}>{(["ALL_ACTIVE","ROLE","INDIVIDUAL"] as const)
          .filter(x=>x==="ALL_ACTIVE"||x==="ROLE"&&maySelectRoles||
            x==="INDIVIDUAL"&&maySelectAccounts).map(x=>
          <Pressable key={x} style={s.button} accessibilityRole="button"
            accessibilityState={{selected:audienceKind===x}}
            onPress={()=>setAudienceKind(x)}><Text>{x.replace(/_/g," ")}</Text></Pressable>)}
        </View>
        {audienceKind!=="ALL_ACTIVE"&&options.map(item=>
          <Pressable key={item.value} style={s.item} accessibilityRole="button"
            accessibilityState={{selected:audienceRef===item.value}}
            onPress={()=>setAudienceRef(item.value)}>
            <Text>{item.label}</Text></Pressable>)}
        <Text style={s.label}>Channels (in-app always included)</Text>
        <View style={s.rowWrap}>
          <Text>IN APP</Text>
          <Pressable style={s.button} accessibilityRole="checkbox"
            accessibilityState={{checked:email}} onPress={()=>setEmail(v=>!v)}>
            <Text>{email?"☑":"□"} EMAIL</Text></Pressable>
          <Pressable style={s.button} accessibilityRole="checkbox"
            accessibilityState={{checked:sms}} onPress={()=>setSms(v=>!v)}>
            <Text>{sms?"☑":"□"} SMS</Text></Pressable>
        </View>
        <Text style={s.muted}>Optional EMAIL/SMS require verified contact, consent,
          approved provider and applicable sender registration. Unavailable channels do not send.</Text>
        <TextInput value={scheduledAt} onChangeText={setScheduledAt}
          style={s.input} autoCapitalize="none" accessibilityLabel="Optional schedule ISO date"
          placeholder="Schedule ISO date/time (optional)"/>
        <TextInput value={expiresAt} onChangeText={setExpiresAt} style={s.input}
          autoCapitalize="none" accessibilityLabel="Required expiry ISO date"
          placeholder="Expiry ISO date/time (required)"/>
        <TextInput value={targetHref} onChangeText={setTargetHref} style={s.input}
          autoCapitalize="none" maxLength={160}
          accessibilityLabel="Optional internal link" placeholder="/admin/… (optional)"/>
        <Pressable style={s.button} accessibilityRole="button"
          disabled={busy||draftUnknown||title.trim().length<5||body.trim().length<10||
            !expiresAt||audienceKind!=="ALL_ACTIVE"&&!audienceRef}
          onPress={()=>void create()}><Text>Save private notice draft</Text></Pressable>
        {draftKey&&<Pressable style={s.button} disabled={busy}
          onPress={()=>void lookupDraft()}>
          <Text>Check original draft request</Text></Pressable>}
      </View>}
      {mayManage&&<View style={s.card}>
        <Text style={s.heading}>Foundation notices (latest 30)</Text>
        {notices.length===0&&!loading&&<Text>No permitted notices yet.</Text>}
        {notices.map(n=><View key={n.noticeRef} style={s.item}>
          <Text style={s.heading}>{n.title}</Text><Text>{n.body}</Text>
          <Text style={s.muted}>{n.state} · {n.priority} · {n.audienceCount} recipients</Text>
          <Text style={s.muted}>{n.channels.join(", ")} · expires {new Date(n.expiresAt).toLocaleString()}</Text>
          {mayApprove&&(["DRAFT","ACTIVE","SCHEDULED"].includes(n.state))&&
            <View style={s.rowWrap}>
              {n.state==="DRAFT"&&<Pressable style={s.button}
                disabled={busy||reviewUnknown} onPress={()=>{
                  setReview({ref:n.noticeRef,revision:n.revision,action:"APPROVE"});
                  setReviewKey("");setCurrentPassword("");
                }}><Text>Review approval</Text></Pressable>}
              <Pressable style={s.button} disabled={busy||reviewUnknown}
                onPress={()=>{setReview({ref:n.noticeRef,revision:n.revision,action:"CANCEL"});
                  setReviewKey("");setCurrentPassword("")}}>
                <Text>Review cancellation</Text></Pressable>
            </View>}
          {mayViewDelivery&&<Pressable style={s.button} disabled={busy}
            onPress={()=>void delivery(n.noticeRef)}>
            <Text>View true delivery counts</Text></Pressable>}
          {countRef===n.noticeRef&&counts.map((x,i)=><Text key={i}>
            {x.channel} · {x.status}: {x.count}</Text>)}
        </View>)}
      </View>}
      {review&&mayApprove&&<View style={s.card}>
        <Text style={s.heading}>Confirm {review.action.toLowerCase()} notice</Text>
        <Text>Selected notice revision: {review.revision}. Current Super Admin password confirmation required.</Text>
        <TextInput value={currentPassword} onChangeText={x=>setCurrentPassword(x)}
          accessibilityLabel="Current password" secureTextEntry autoComplete="current-password"
          style={s.input} keyboardType="default" maxLength={1024}/>
        <Pressable style={s.button} disabled={busy||reviewUnknown||currentPassword.length<8}
          onPress={()=>void decide()}><Text>Confirm {review.action.toLowerCase()}</Text></Pressable>
        {reviewKey&&<Pressable style={s.button} disabled={busy}
          onPress={()=>void lookupDecision()}>
          <Text>Check original approval/cancellation</Text></Pressable>}
        <Pressable style={s.button} disabled={busy||reviewUnknown}
          onPress={()=>{setReview(null);setReviewKey("");setCurrentPassword("")}}>
          <Text>Cancel review panel</Text></Pressable>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.adminCanvas},
  content:{padding:16,paddingBottom:96,gap:14,width:"100%",maxWidth:760,alignSelf:"center"},
  row:{flexDirection:"row",gap:8,alignItems:"center",flexWrap:"wrap"},
  rowWrap:{flexDirection:"row",gap:8,alignItems:"center",flexWrap:"wrap"},
  title:{fontSize:22,fontWeight:"700",flex:1,color:theme.text},
  heading:{fontSize:16,fontWeight:"700",color:theme.text},
  label:{fontSize:14,fontWeight:"600",color:theme.text},
  muted:{fontSize:13,color:theme.mutedText},
  error:{fontSize:13,color:theme.error,backgroundColor:theme.surface,padding:11},
  card:{padding:15,borderColor:theme.border,borderWidth:1,
    borderRadius:14,backgroundColor:theme.surface,gap:10,
    shadowColor:theme.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
  item:{padding:11,borderColor:theme.border,borderWidth:1,borderRadius:8,gap:7},
  input:{minHeight:48,color:theme.text,backgroundColor:theme.surface,
    borderWidth:1,borderColor:theme.border,borderRadius:10,padding:10},
  long:{minHeight:100,textAlignVertical:"top"},
  button:{minHeight:48,padding:11,justifyContent:"center",
    borderWidth:1,borderColor:theme.border,borderRadius:12}
});
