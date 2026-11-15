import {useCallback,useEffect,useState} from "react";
import {
  ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import type {
  CG03CaseView,CG03CaseDetail,CG03Lookup,CG03Option,CG03ProcessView
} from "@careganga/api-contracts";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Props={token:string;canConfigure:boolean;canPropose:boolean;onExit:()=>void;onExpired:()=>void};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  let res:Response;
  try{
    res=await identityRequest("/api/registration-approvals/"+path,{
      method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
  }catch{throw Error(method==="POST"?"UNKNOWN":"UNAVAILABLE");}
  if(res.status===401)throw Error("SESSION_EXPIRED");
  if(res.status===403)throw Error("DENIED");
  if(res.status===409)throw Error("CONFLICT");
  if(res.status===400)throw Error("INVALID");
  if(!res.ok)throw Error(method==="POST"?"UNKNOWN":"UNAVAILABLE");
  try{return await res.json() as T;}
  catch{throw Error(method==="POST"?"UNKNOWN":"UNAVAILABLE");}
}
const friendly=(status:string)=>({
  SUBMITTED:"Submitted",IN_REVIEW:"In review",RETURNED:"Returned",
  REJECTED:"Rejected",FINAL_APPROVED:"Final decision",PENDING_OWNER:"Applying access",
  OWNER_COMPLETED:"Access confirmed",OWNER_BLOCKED:"New approval required",
  OWNER_FAILED_RETRYABLE:"Awaiting source verification"
} as Record<string,string>)[status]??"Status unavailable";

export function ProposalScreen({token,canConfigure,canPropose,onExit,onExpired}:Props){
  const [cases,setCases]=useState<CG03CaseView[]>([]);
  const [route,setRoute]=useState<CG03ProcessView|null>(null);
  const [accounts,setAccounts]=useState<CG03Option[]>([]),[roles,setRoles]=useState<CG03Option[]>([]);
  const [accountQuery,setAccountQuery]=useState(""),[roleQuery,setRoleQuery]=useState("");
  const [account,setAccount]=useState(""),[role,setRole]=useState("");
  const [form,setForm]=useState(false),[routeForm,setRouteForm]=useState(false);
  const [firstReviewer,setFirstReviewer]=useState<"NONE"|"ACCESS_MANAGER">("NONE");
  const [totp,setTotp]=useState("");
  const [previous,setPrevious]=useState<string|null>(null);
  const [key,setKey]=useState("");
  const [unknown,setUnknown]=useState(false);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [detail,setDetail]=useState<CG03CaseDetail|null>(null);
  const [decisionAction,setDecisionAction]=useState<"APPROVE"|"RETURN"|"REJECT"|"FORWARD"|null>(null);
  const [decisionRemarks,setDecisionRemarks]=useState("");
  const [decisionTotp,setDecisionTotp]=useState("");
  const [decisionConfirmed,setDecisionConfirmed]=useState(false);
  const [decisionUnknown,setDecisionUnknown]=useState(false);
  const [decisionKey,setDecisionKey]=useState("");
  const [pendingKind,setPendingKind]=useState<"CASE"|"PROCESS">("CASE");

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [list,proc]=await Promise.all([
        api<{cases:CG03CaseView[]}>(token,"cases?limit=30"),
        api<CG03ProcessView>(token,"process")
      ]);
      if(!Array.isArray(list.cases)||!proc||!Number.isInteger(proc.version))
        throw Error("UNAVAILABLE");
      setCases(list.cases);setRoute(proc);
    }catch(error){
      setCases([]);setRoute(null);
      if(error instanceof Error&&error.message==="SESSION_EXPIRED")onExpired();
      else setMessage(error instanceof Error&&error.message==="DENIED"?
        "Current access does not permit this approval list.":
        "Could not verify Foundation applications. Refresh when connected.");
    }finally{setLoading(false);}
  },[token,onExpired]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(busy)return true;
      if(unknown||decisionUnknown)return true;
      if(detail){setDetail(null);return true;}
      if(form){setForm(false);return true;}
      if(routeForm){setRouteForm(false);return true;}
      onExit();return true;
    });
    return()=>sub.remove();
  },[busy,unknown,decisionUnknown,detail,form,routeForm,onExit]);
  async function search(kind:"account"|"role",text:string){
    if(text.length>70)return;
    try{
      const response=await api<{options:CG03Option[]}>(token,
        "options/"+kind+"?search="+encodeURIComponent(text));
      if(!Array.isArray(response.options)||response.options.length>30)throw Error();
      if(kind==="account")setAccounts(response.options);else setRoles(response.options);
    }catch{
      if(kind==="account")setAccounts([]);else setRoles([]);
      setMessage("Matching authorized records could not be retrieved.");
    }
  }
  function begin(entry?:CG03CaseView){
    if(busy||unknown||!canPropose)return;
    setForm(true);setRouteForm(false);
    setAccount("");setRole("");setAccountQuery(entry?.accountName??"");setRoleQuery("");
    setPrevious(entry?.caseRef??null);setKey(Crypto.randomUUID());setPendingKind("CASE");
    setMessage("");
    void search("account","");void search("role","");
  }
  async function create(){
    if(!account||!role||busy||unknown)return;
    setBusy(true);setMessage("");
    try{
      const outcome=await api<CG03CaseView>(token,"cases","POST",{
        targetAccountRef:account,targetRoleRef:role,requestKey:key,
        ...(previous?{previousCaseRef:previous}:{})
      });
      if(typeof outcome.reference!=="string")throw Error("UNKNOWN");
      setForm(false);setKey("");setPrevious(null);
      setMessage(outcome.reference+" submitted for review; no access has changed.");
      await load();
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();
      else{
        if(e instanceof Error&&e.message==="UNKNOWN")setUnknown(true);
        setMessage(e instanceof Error&&e.message==="DENIED"?
          "Your permission was removed. This request was not confirmed.":
          e instanceof Error&&e.message==="CONFLICT"?
          "This application changed. Verify its original status before trying again.":
          "The submission could not be confirmed. Check the original request first.");
      }
    }finally{setBusy(false);}
  }
  async function checkPrevious(){
    if(!unknown||busy||!key)return;
    setBusy(true);
    try{
      if(pendingKind==="CASE"){
        const result=await api<CG03Lookup>(token,"cases/requests/"+key);
        if(result.status==="CONFIRMED"&&result.case){
          setUnknown(false);setForm(false);setKey("");setPrevious(null);
          setMessage(result.case.reference+" is recorded; access was not granted.");
          await load();
        }else setMessage("No confirmed submission is visible. Ask Foundation support before retrying.");
      }else{
        const saved=await api<{status:string;version:number|null}>(token,
          "process/changes/"+key);
        if(saved.status==="CONFIRMED"&&Number.isInteger(saved.version)){
          const current=await api<CG03ProcessView>(token,"process");
          if(current.version<Number(saved.version))throw Error("UNAVAILABLE");
          setRoute(current);setUnknown(false);setKey("");setRouteForm(false);
          setMessage("Original reviewer process change confirmed.");
        }else setMessage("No confirmed process change is visible. Ask Foundation support before retrying.");
      }
    }catch{setMessage("The earlier result is still unconfirmed. Contact Foundation support.");}
    finally{setBusy(false);}
  }
  async function see(entry:CG03CaseView){
    setBusy(true);setDetail(null);setDecisionAction(null);setDecisionTotp("");
    setDecisionConfirmed(false);
    try{
      const result=await api<CG03CaseDetail>(token,"cases/"+entry.caseRef);
      if(!Array.isArray(result.history)||!Array.isArray(result.allowedDecisions))throw Error();
      setDetail(result);
    }catch{setMessage("The application details could not be verified.");}
    finally{setBusy(false);}
  }
  function selectDecision(action:"APPROVE"|"RETURN"|"REJECT"|"FORWARD"){
    if(!detail||!detail.allowedDecisions.includes(action)||decisionUnknown||busy)return;
    setDecisionAction(action);setDecisionRemarks("");setDecisionTotp("");
    setDecisionConfirmed(false);setDecisionKey(Crypto.randomUUID());setMessage("");
  }
  async function commitDecision(){
    if(!detail||!decisionAction||busy||decisionUnknown)return;
    if(detail.requiresFreshAuthenticator&&!/^[0-9]{6}$/.test(decisionTotp)){
      setMessage("Enter a fresh authenticator code for the final decision.");return;
    }
    if(!decisionConfirmed){setDecisionConfirmed(true);return;}
    setBusy(true);setMessage("");
    try{
      const result=await api<{status:string;revision:number}>(token,
        "cases/"+detail.caseRef+"/decisions","POST",{
          action:decisionAction,remarks:decisionRemarks.trim(),totp:decisionTotp,
          expectedRevision:detail.revision,requestKey:decisionKey
        });
      if(!Number.isInteger(result.revision))throw Error("UNKNOWN");
      const item=detail;setDecisionAction(null);setDecisionConfirmed(false);
      setDecisionKey("");setDecisionTotp("");
      setMessage("Review decision recorded. Account access is confirmed separately.");
      await load();await see(item);
    }catch(error){
      if(error instanceof Error&&error.message==="UNKNOWN")setDecisionUnknown(true);
      if(error instanceof Error&&error.message==="SESSION_EXPIRED")onExpired();
      else setMessage(error instanceof Error&&error.message==="CONFLICT"?
        "This case changed. Refresh before recording a decision.":
        "Decision result could not be verified. Check its original request.");
    }finally{setBusy(false);}
  }
  async function lookupDecision(){
    if(!detail||!decisionUnknown||!decisionKey||busy)return;
    setBusy(true);
    try{
      const result=await api<{status:string;revision:number|null}>(token,
        "cases/"+detail.caseRef+"/decisions/requests/"+decisionKey);
      if(result.status==="CONFIRMED"&&Number.isInteger(result.revision)){
        const item=detail;setDecisionUnknown(false);setDecisionKey("");
        setDecisionAction(null);setDecisionConfirmed(false);
        setMessage("Original review decision confirmed. No duplicate action was sent.");
        await load();await see(item);
      }else setMessage("No confirmed decision is visible. Ask Foundation support before retrying.");
    }catch{setMessage("Previous decision status could not be verified.");}
    finally{setBusy(false);}
  }
  async function version(){
    if(!canConfigure||!routeForm||busy||unknown)return;
    if(!/^[0-9]{6}$/.test(totp)){setMessage("Enter a fresh six-digit code.");return;}
    setBusy(true);setPendingKind("PROCESS");
    try{
      const result=await api<{version:number}>(token,"process/versions","POST",{
        firstReviewerCapability:firstReviewer==="NONE"?null:"roles.assign",
        requestKey:key,totp
      });
      if(!Number.isInteger(result.version))throw Error("UNKNOWN");
      setKey("");setRouteForm(false);setTotp("");
      setMessage("New review process saved. Older applications keep their process.");
      await load();
    }catch(error){
      if(error instanceof Error&&error.message==="UNKNOWN")setUnknown(true);
      if(error instanceof Error&&error.message==="SESSION_EXPIRED")onExpired();
      else setMessage("The reviewer-process result is uncertain. Check the previous version.");
    }finally{setBusy(false);}
  }
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={onExit} disabled={busy||unknown}><Text>My account</Text></Pressable>
        <Text accessibilityRole="header" style={styles.title}>Registration & Approval</Text>
      </View>
      <Text style={styles.muted}>Foundation protected role requests</Text>
      {!!message&&<Text accessibilityRole="alert" style={styles.notice}>{message}</Text>}
      {unknown&&<View style={styles.card}>
        <Text style={styles.title}>Previous submission uncertain</Text>
        <Text>Do not resend this request until verified.</Text>
        <Pressable accessibilityRole="button" style={styles.button} disabled={busy}
          onPress={()=>void checkPrevious()}><Text>Check previous request</Text></Pressable>
      </View>}
      {loading?<ActivityIndicator accessibilityLabel="Verifying approvals"/>:
        <View style={styles.card}>
          <Text>Approval process: {route?.active?"Version "+route.version:
            "Starts with first eligible application"}</Text>
          <Text>{route?.firstReviewer?route.firstReviewer+" then ":""}
            Different Foundation Super Admin (fresh MFA)</Text>
          {canConfigure&&<Pressable accessibilityRole="button"
            disabled={busy||unknown} style={styles.button}
            onPress={()=>{setRouteForm(true);setForm(false);setKey(Crypto.randomUUID());
              setFirstReviewer(route?.firstReviewer?"ACCESS_MANAGER":"NONE");setTotp("");}}>
            <Text>Version approval process</Text></Pressable>}
        </View>}
      {!form&&!routeForm&&!detail&&<View style={styles.card}>
        {canPropose&&<Pressable accessibilityRole="button" disabled={busy||unknown} style={styles.primary}
          onPress={()=>begin()}><Text style={styles.primaryText}>Request protected role access</Text></Pressable>}
        <Text style={styles.heading}>Visible applications</Text>
        {!cases.length&&!loading?<Text>No protected applications were found.</Text>:cases.map(item=>
          <View style={styles.item} key={item.caseRef}>
            <Text style={styles.heading}>{item.reference}</Text>
            <Text>{item.accountName} → {item.roleName}</Text>
            <Text style={styles.muted}>{friendly(item.status)}</Text>
            <View style={styles.row}>
              <Pressable style={styles.button} accessibilityRole="button"
                onPress={()=>void see(item)}><Text>View timeline</Text></Pressable>
              {canPropose&&item.status==="RETURNED"&&<Pressable accessibilityRole="button"
                disabled={busy||unknown} style={styles.button}
                onPress={()=>begin(item)}><Text>Submit correction</Text></Pressable>}
            </View>
          </View>)}
      </View>}
      {form&&!unknown&&<View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {previous?"Correct returned proposal":"Propose protected role change"}</Text>
        <Text>No account access changes until a different Super Admin approves.</Text>
        <Text style={styles.heading}>Find Foundation account</Text>
        <TextInput accessibilityLabel="Search staff name" style={styles.input}
          value={accountQuery} onChangeText={text=>{setAccountQuery(text);
            setAccount("");void search("account",text);}}/>
        {accounts.map(option=><Pressable key={option.value} accessibilityRole="radio"
          accessibilityState={{selected:option.value===account}}
          style={[styles.option,option.value===account&&styles.chosen]}
          onPress={()=>setAccount(option.value)}>
          <Text>{option.label}{option.value===account?" — selected":""}</Text>
        </Pressable>)}
        <Text style={styles.heading}>Find protected custom role</Text>
        <TextInput accessibilityLabel="Search custom role" style={styles.input}
          value={roleQuery} onChangeText={text=>{setRoleQuery(text);
            setRole("");void search("role",text);}}/>
        {roles.map(option=><Pressable key={option.value} accessibilityRole="radio"
          accessibilityState={{selected:option.value===role}}
          style={[styles.option,option.value===role&&styles.chosen]}
          onPress={()=>setRole(option.value)}>
          <Text>{option.label}{option.value===role?" — selected":""}</Text>
        </Pressable>)}
        <Text style={styles.muted}>Source account and role versions are frozen securely
          upon submission. Old returned applications remain unchanged.</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.button}
            onPress={()=>setForm(false)}><Text>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy||!account||!role}
            style={styles.primary} onPress={()=>void create()}>
            <Text style={styles.primaryText}>Submit for approval</Text></Pressable>
        </View>
      </View>}
      {routeForm&&!unknown&&canConfigure&&<View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>New process version</Text>
        <Pressable accessibilityRole="radio" accessibilityState={{selected:firstReviewer==="NONE"}}
          style={styles.option} onPress={()=>setFirstReviewer("NONE")}>
          <Text>Different Super Admin only</Text></Pressable>
        <Pressable accessibilityRole="radio"
          accessibilityState={{selected:firstReviewer==="ACCESS_MANAGER"}}
          style={styles.option} onPress={()=>setFirstReviewer("ACCESS_MANAGER")}>
          <Text>Access manager, then Super Admin</Text></Pressable>
        <Text style={styles.heading}>Fresh authenticator code</Text>
        <TextInput accessibilityLabel="Fresh authenticator code" style={styles.input}
          keyboardType="number-pad" maxLength={6} value={totp}
          onChangeText={x=>setTotp(x.replace(/[^0-9]/g,""))}/>
        <View style={styles.row}><Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>setRouteForm(false)}><Text>Cancel</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.primary}
            disabled={busy||totp.length!==6} onPress={()=>void version()}>
            <Text style={styles.primaryText}>Create new process version</Text></Pressable></View>
      </View>}
      {detail&&<View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{detail.reference}</Text>
        <Text>{detail.accountName} → {detail.roleName}</Text>
        <Text>{friendly(detail.status)}</Text>
        <Text>Proposal version {detail.proposalRevision};
          process version {detail.processVersion}</Text>
        <Text>Original account access revision {detail.sourceAccountAccessRevision};
          role revision {detail.sourceRoleRevision}</Text>
        {decisionUnknown&&<View style={styles.card}>
          <Text accessibilityRole="alert">A previous decision may have been saved.
            Do not repeat it until verified.</Text>
          <Pressable accessibilityRole="button" style={styles.button}
            disabled={busy} onPress={()=>void lookupDecision()}>
            <Text>Check previous decision</Text></Pressable>
        </View>}
        {!decisionUnknown&&detail.allowedDecisions.length>0&&<View style={styles.card}>
          <Text style={styles.heading}>Permitted reviewer actions</Text>
          <View style={styles.row}>
            {detail.allowedDecisions.map(action=><Pressable accessibilityRole="button"
              accessibilityState={{selected:decisionAction===action}}
              style={[styles.button,decisionAction===action&&styles.chosen]}
              key={action} disabled={busy} onPress={()=>selectDecision(action)}>
              <Text>{action==="APPROVE"?"Approve":action==="RETURN"?"Send back":
                action==="REJECT"?"Reject":"Forward"}</Text>
            </Pressable>)}
          </View>
          {decisionAction&&<>
            <Text style={styles.heading}>Reviewer remarks</Text>
            <TextInput accessibilityLabel="Reviewer remarks" style={styles.input}
              multiline maxLength={500} value={decisionRemarks}
              onChangeText={value=>{setDecisionRemarks(value);setDecisionConfirmed(false);}}/>
            {detail.requiresFreshAuthenticator&&<>
              <Text style={styles.heading}>Fresh authenticator code</Text>
              <TextInput accessibilityLabel="Fresh reviewer authenticator code"
                keyboardType="number-pad" maxLength={6} style={styles.input}
                value={decisionTotp} onChangeText={v=>{
                  setDecisionTotp(v.replace(/[^0-9]/g,""));setDecisionConfirmed(false);}}/>
            </>}
            {decisionConfirmed&&<Text>
              Confirm {decisionAction.toLowerCase()} for {detail.reference}.
              The decision becomes permanent.</Text>}
            <View style={styles.row}>
              <Pressable accessibilityRole="button" style={styles.button}
                disabled={busy} onPress={()=>setDecisionAction(null)}>
                <Text>Cancel</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.primary}
                disabled={busy} onPress={()=>void commitDecision()}>
                <Text style={styles.primaryText}>{decisionConfirmed?
                  "Confirm decision":"Review decision"}</Text></Pressable>
            </View>
          </>}
        </View>}
        <Text style={styles.heading}>Approval timeline</Text>
        {detail.history.map((item,i)=><View key={i} style={styles.item}>
          <Text>{item.action} · {item.by}</Text>
          <Text style={styles.muted}>{new Date(item.at).toLocaleString()}</Text>
          {!!item.remarks&&<Text>{item.remarks}</Text>}
        </View>)}
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>setDetail(null)}><Text>Back to applications</Text></Pressable>
      </View>}
      {!form&&!routeForm&&!detail&&<Pressable accessibilityRole="button"
        style={styles.button} disabled={loading||busy||unknown}
        onPress={()=>void load()}><Text>Refresh applications</Text></Pressable>}
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.background},
  content:{padding:18,gap:14,maxWidth:750,width:"100%",alignSelf:"center",paddingBottom:40},
  title:{fontSize:21,fontWeight:"700",color:theme.text,flexShrink:1},
  heading:{fontSize:15,fontWeight:"700",color:theme.text},
  muted:{color:theme.mutedText,fontSize:13},
  row:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",gap:9},
  card:{borderRadius:12,borderWidth:1,borderColor:theme.border,backgroundColor:theme.surface,
    padding:15,gap:12},
  item:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:theme.border,gap:5},
  input:{borderWidth:1,borderColor:theme.border,padding:12,borderRadius:8,
    fontSize:16,color:theme.text,minHeight:48},
  option:{borderWidth:1,borderColor:theme.border,borderRadius:8,padding:12,
    minHeight:48,justifyContent:"center",backgroundColor:theme.surface},
  chosen:{borderColor:theme.primary,backgroundColor:"#EEF4FF"},
  button:{borderWidth:1,borderColor:theme.border,paddingHorizontal:14,paddingVertical:12,
    borderRadius:8,minHeight:48,justifyContent:"center"},
  primary:{backgroundColor:theme.primary,paddingHorizontal:15,paddingVertical:12,
    borderRadius:8,minHeight:48,justifyContent:"center"},
  primaryText:{color:theme.primaryText,fontWeight:"700"},
  notice:{color:theme.error,backgroundColor:theme.surface,padding:10,borderRadius:7}
});
