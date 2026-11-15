import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback,useEffect,useRef,useState } from "react";
import { BackHandler,KeyboardAvoidingView,Platform,Pressable,ScrollView,
  StyleSheet,Text,TextInput,View } from "react-native";
import * as Crypto from "expo-crypto";
import type { CG01AccountList,CG01AccountView } from "@careganga/api-contracts";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";
import { identityRequest } from "./http-client";

type Option={value:string;label:string;context:string};
/** Display business words, never the wire status code. */
const accountStatusLabel=(status:string):string=>({
  INVITED:"Invited",ACTIVE:"Active",SUSPENDED:"Suspended",DEACTIVATED:"Deactivated"
} as Record<string,string>)[status]??"Status unavailable";
const deliveryLabel=(status:string|null):string=>status===null?"Not applicable":({
  PENDING:"Waiting to send",CLAIMED:"Sending status not confirmed",
  PROVIDER_ACCEPTED:"Accepted by email service",UNKNOWN:"Delivery not confirmed",
  UNAVAILABLE:"Email service unavailable"
} as Record<string,string>)[status]??"Delivery status unavailable";
const auditOutcomeLabel=(outcome:string):string=>({
  SUCCESS:"Completed",DENIED:"Not permitted",PENDING:"Awaiting confirmation"
} as Record<string,string>)[outcome]??"Outcome unavailable";
type Pending={kind:"assign"|"revoke"|"status"|"resend";row:CG01AccountView;status?:string};
async function call(token:string,path:string,method="GET",body?:object):Promise<unknown>{
  let response:Response;
  try{
    response=await identityRequest("/api/access/"+path,{
      method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
  }catch{throw new Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");}
  if(!response.ok){
    if(response.status===401)throw new Error("SESSION_EXPIRED");
    if(response.status===403)throw new Error("PERMISSION_DENIED");
    if(response.status===409)throw new Error("CONFLICT");
    if(response.status===429)throw new Error("RETRY_LATER");
    throw new Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");
  }
  try{return await response.json() as unknown;}
  catch{throw new Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");}
}
export function AccountsScreen({token,onExit,onExpired,inviteOnly=false}:{
  token:string;onExit:()=>void;onExpired:()=>void;inviteOnly?:boolean
}){
  const [list,setList]=useState<CG01AccountList|null>(null);
  const listGeneration=useRef(0);
  const optionsGeneration=useRef(0);
  const historyGeneration=useRef(0);
  const [actions,setActions]=useState<string[]>([]);
  const [roles,setRoles]=useState<Option[]>([]);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [offset,setOffset]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [unknown,setUnknown]=useState(false);
  const [screen,setScreen]=useState<"list"|"invite"|"detail">(inviteOnly?"invite":"list");
  const [selected,setSelected]=useState<CG01AccountView|null>(null);
  const [pending,setPending]=useState<Pending|null>(null);
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [roleRef,setRoleRef]=useState("");
  const [roleQuery,setRoleQuery]=useState("");
  const [requestKey,setRequestKey]=useState("");
  const [history,setHistory]=useState<Array<{eventRef:string;occurredAt:string;actionLabel:string;outcome:string}>|null>(null);
  const canInvite=actions.includes("accounts.invite")&&actions.includes("roles.assign");
  const canAssign=actions.includes("roles.assign");
  const canStatus=actions.includes("accounts.status.manage");
  const canAudit=actions.includes("access.audit.view");
  const deny=useCallback((kind:string)=>{
    ++listGeneration.current;++optionsGeneration.current;++historyGeneration.current;
    setList(null);setActions([]);setRoles([]);setSelected(null);setPending(null);
    setBusy(false);setHistory(null);setRoleRef("");
    setScreen("list");setMessage("Your account access cannot be verified. Restricted information was cleared.");
    if(kind==="SESSION_EXPIRED")onExpired();
  },[onExpired]);
  const load=useCallback(async(q="",skip=0,status="all")=>{
    const generation=++listGeneration.current;
    setBusy(true);setMessage("");
    try{
      if(inviteOnly){
        // Use only the effective permission contract; never query the private staff list.
        const access=await call(token,"effective") as {actions?:{key:string}[]};
        if(generation!==listGeneration.current)return false;
        if(!access||!Array.isArray(access.actions)||
          !access.actions.every(a=>a&&typeof a.key==="string"))throw new Error("UNAVAILABLE");
        const keys=access.actions.map(a=>a.key);
        if(!keys.includes("accounts.invite")||!keys.includes("roles.assign"))
          throw new Error("PERMISSION_DENIED");
        setList(null);setActions(keys);return true;
      }
      const params=new URLSearchParams({search:q,limit:"20",offset:String(skip),status});
      const [listData,access]=await Promise.all([
        call(token,"accounts?"+params.toString()),
        call(token,"effective")
      ]);
      if(!listData||typeof listData!=="object"||!("accounts" in listData)||
        !Array.isArray(listData.accounts)||!("summary" in listData))throw new Error("UNAVAILABLE");
      if(!access||typeof access!=="object"||!("actions" in access)||!Array.isArray(access.actions))
        throw new Error("UNAVAILABLE");
      if(generation!==listGeneration.current)return false;
      setList(listData as CG01AccountList);
      setActions(access.actions.map((a:{key:string})=>a.key));
      setOffset(skip);setFilter(status);
      setSelected(prev=>(listData as CG01AccountList).accounts.find(x=>x.accountRef===prev?.accountRef)??null);
      return true;
    }catch(e){
      if(generation!==listGeneration.current)return false;
      if(e instanceof Error&&(e.message==="SESSION_EXPIRED"||e.message==="PERMISSION_DENIED"))
        deny(e.message);
      else deny("UNAVAILABLE");
      return false;
    }finally{if(generation===listGeneration.current)setBusy(false);}
  },[token,deny,inviteOnly]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(pending){setPending(null);return true;}
      if(inviteOnly){onExit();return true;}
      if(screen!=="list"){setScreen("list");return true;}
      onExit();return true;
    });
    return()=>sub.remove();
  },[pending,screen,onExit,inviteOnly]);
  async function searchRoles(q=""){
    const generation=++optionsGeneration.current;
    setRoleQuery(q);
    try{
      const result=await call(token,"roles/options?"+new URLSearchParams({search:q})) as {options:Option[]};
      if(generation!==optionsGeneration.current)return;
      if(!Array.isArray(result.options))throw new Error("UNAVAILABLE");
      setRoles(result.options.filter(x=>x.context==="Foundation"));
    }catch(e){
      if(generation!==optionsGeneration.current)return;
      setRoles([]);
      if(e instanceof Error&&(e.message==="SESSION_EXPIRED"||e.message==="PERMISSION_DENIED"))deny(e.message);
      else setMessage("Eligible roles are unavailable. Try again later.");
    }
  }
  function beginInvite(){
    ++optionsGeneration.current;++historyGeneration.current;
    setName("");setEmail("");setRoleRef("");setHistory(null);setRoleQuery("");setRoles([]);setUnknown(false);
    setPending(null);setScreen("invite");setRequestKey(Crypto.randomUUID());void searchRoles();
  }
  useEffect(()=>{
    if(inviteOnly)beginInvite();
  },[inviteOnly]);
  function beginDetail(row:CG01AccountView){
    ++optionsGeneration.current;++historyGeneration.current;
    setSelected(row);setRoleRef(row.roleRef??"");setHistory(null);setRoleQuery("");setRoles([]);setUnknown(false);
    setPending(null);setScreen("detail");setRequestKey(Crypto.randomUUID());
    if(canAssign)void searchRoles();
  }
  async function commit(){
    if(busy||unknown)return;
    const wasInvite=screen==="invite";
    setBusy(true);setMessage("");
    try{
      if(screen==="invite"){
        if(!roleRef)throw new Error("SELECT_ROLE");
        await call(token,"invitations","POST",{displayName:name.trim(),email:email.trim().toLowerCase(),
          roleRef,requestKey});
        setMessage("Invitation saved. Email delivery is not guaranteed; check account status.");
      }else if(pending){
        const root="accounts/"+pending.row.accountRef;
        if(pending.kind==="assign"){
          if(!roleRef)throw new Error("SELECT_ROLE");
          await call(token,root+"/role","PUT",{roleRef,expectedRevision:pending.row.revision,requestKey});
        }else if(pending.kind==="resend"){
          await call(token,root+"/invitation/resend","POST",{
            expectedRevision:pending.row.revision,requestKey});
        }else if(pending.kind==="revoke"){
          await call(token,root+"/role","DELETE",{expectedRevision:pending.row.revision,requestKey});
        }else{
          await call(token,root+"/status","PATCH",{status:pending.status,
            expectedRevision:pending.row.revision,requestKey});
        }
        setMessage("Account change confirmed.");
      }
      setPending(null);setScreen(inviteOnly?"invite":"list");setRequestKey("");
      if(inviteOnly&&wasInvite){
        setName("");setEmail("");setRoleRef("");
        setRequestKey(Crypto.randomUUID());
      }
      const verified=await load(search,0,filter);
      if(verified)setMessage(wasInvite?
        "Invitation saved. Email delivery is not guaranteed; check account status.":
        "Change saved. The latest account state is shown above.");
    }catch(e){
      const reason=e instanceof Error?e.message:"UNAVAILABLE";
      if(reason==="SESSION_EXPIRED"||reason==="PERMISSION_DENIED")deny(reason);
      else if(reason==="UNKNOWN"){
        setUnknown(true);setMessage("The result could not be confirmed. Refresh before retrying.");
      }else if(reason==="CONFLICT")setMessage("The account changed elsewhere. Refresh before saving.");
      else if(reason==="SELECT_ROLE")setMessage("Choose an eligible role.");
      else setMessage("The requested account change could not be confirmed.");
    }finally{setBusy(false);}
  }
  async function showAudit(targetRef?:string){
    const generation=++historyGeneration.current;
    try{
      const params=new URLSearchParams({limit:"20",...(targetRef?{targetRef}:{})});
      const result=await call(token,"audit?"+params.toString()) as {
        events:{eventRef:string;occurredAt:string;actionLabel:string;outcome:string}[]
      };
      if(generation!==historyGeneration.current)return;
      if(!Array.isArray(result.events))throw new Error("UNAVAILABLE");
      setHistory(result.events);
    }catch(e){
      if(generation!==historyGeneration.current)return;
      if(e instanceof Error&&(e.message==="SESSION_EXPIRED"||e.message==="PERMISSION_DENIED"))deny(e.message);
      else setMessage("Security history could not be verified.");
    }
  }
  const row=selected;
  const s=list?.summary;
  const numbers=[
    ["Total Accounts",s?.total],["Active",s?.active],["Invited",s?.invited],
    ["Suspended",s?.suspended],["Deactivated",s?.deactivated],["Assigned Roles",s?.assigned]
  ] as const;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.page}
    behavior={Platform.OS==="ios"?"padding":undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.line}><Pressable accessibilityRole="button" style={styles.button}
        onPress={()=>{if(pending)setPending(null);else if(inviteOnly)onExit();else if(screen!=="list")setScreen("list");else onExit();}}>
        <Text style={styles.buttonText}>{inviteOnly?"My account":screen==="list"?"My account":"Back"}</Text>
      </Pressable><Text accessibilityRole="header" style={styles.title}>Users Management</Text></View>
      {screen==="list"&&!inviteOnly&&<>
        <Text>Foundation staff and current access</Text>
        <View style={styles.stats}>{numbers.map(([label,value])=><View key={label} style={styles.stat}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value??"—"}</Text>
        </View>)}</View>
        <TextInput style={styles.input} accessibilityLabel="Search staff by name or email"
          value={search} onChangeText={setSearch} placeholder="Search name or email"/>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>void load(search,0,filter)}><Text style={styles.buttonText}>Search</Text></Pressable>
        <View style={styles.line}>{(["all","ACTIVE","INVITED","SUSPENDED","DEACTIVATED"] as const).map(status=>
          <Pressable key={status} accessibilityRole="button"
            accessibilityState={{selected:filter===status}}
            style={[styles.smallButton,filter===status&&styles.activeButton]}
            onPress={()=>void load(search,0,status)}>
            <Text style={filter===status?styles.activeText:styles.buttonText}>
              {status==="all"?"All":status==="DEACTIVATED"?"Deactivated":
                status==="SUSPENDED"?"Suspended":status==="INVITED"?"Invited":"Active"}
            </Text>
          </Pressable>)}</View>
        {canInvite&&<Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
          onPress={beginInvite}><Text style={styles.primaryText}>Add staff</Text></Pressable>}
        {list&&!list.accounts.length&&<Text>No matching staff accounts.</Text>}
        {list?.accounts.map(account=><Pressable key={account.accountRef}
          accessibilityRole="button" style={styles.card} onPress={()=>beginDetail(account)}>
          <Text style={styles.heading}>{account.displayName}</Text>
          <Text>{account.email}</Text>
          <Text>{account.roleName??"No role assigned"} · {accountStatusLabel(account.status)}</Text>
          <Text style={styles.note}>View account details</Text>
        </Pressable>)}
        {list&&list.total>20&&<View style={styles.line}>
          <Pressable accessibilityRole="button" style={styles.button} disabled={offset===0||busy}
            onPress={()=>void load(search,Math.max(0,offset-20),filter)}><Text>Previous</Text></Pressable>
          <Text>{offset+1}–{Math.min(offset+20,list.total)} of {list.total}</Text>
          <Pressable accessibilityRole="button" style={styles.button} disabled={offset+20>=list.total||busy}
            onPress={()=>void load(search,offset+20,filter)}><Text>Next</Text></Pressable>
        </View>}
        {canAudit&&<Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>void showAudit()}><Text style={styles.buttonText}>View access history</Text></Pressable>}
        {history&&<View style={styles.card}>
          <Text style={styles.heading}>Recent security activity</Text>
          {history.map(item=><View key={item.eventRef} style={styles.group}>
            <Text>{item.actionLabel} · {auditOutcomeLabel(item.outcome)}</Text>
            <Text style={styles.note}>{new Date(item.occurredAt).toLocaleString()}</Text>
          </View>)}
          {!history.length&&<Text>No accessible security history.</Text>}
        </View>}
      </>}
      {screen==="invite"&&<View style={styles.card}>
        <Text style={styles.heading}>Add New Staff Account</Text>
        <Text style={styles.label}>Full name</Text>
        <TextInput accessibilityLabel="Full name" style={styles.input} maxLength={160}
          value={name} onChangeText={setName}/>
        <Text style={styles.label}>Work email</Text>
        <TextInput accessibilityLabel="Work email" style={styles.input} maxLength={254}
          autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail}/>
        <Text style={styles.note}>Applies to: Entire foundation</Text>
        <Text style={styles.label}>Find eligible roles</Text>
        <TextInput accessibilityLabel="Find eligible roles" style={styles.input}
          maxLength={80} value={roleQuery} onChangeText={setRoleQuery}/>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>void searchRoles(roleQuery)}><Text>Find roles</Text></Pressable>
        {roles.map(role=><Pressable key={role.value} style={[styles.option,roleRef===role.value&&styles.selected]}
          accessibilityRole="radio" accessibilityLabel={role.label}
          accessibilityState={{checked:roleRef===role.value}} onPress={()=>setRoleRef(role.value)}>
          <Text>{role.label}{roleRef===role.value?" — selected":""}</Text>
        </Pressable>)}
        <Text style={styles.note}>The invited person chooses their own password and authenticator.</Text>
        <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
          disabled={!name.trim()||!email.includes("@")||!roleRef||busy||unknown}
          onPress={()=>void commit()}><Text style={styles.primaryText}>{busy?"Saving…":"Create invitation"}</Text></Pressable>
      </View>}
      {screen==="detail"&&row&&<View style={styles.card}>
        <Text style={styles.heading}>{row.displayName}</Text>
        <Text>{row.email}</Text>
        {row.phone&&<Text>Phone (unverified): {row.phone}</Text>}
        <Text>Account status: {accountStatusLabel(row.status)}</Text>
        <Text>Current role: {row.roleName??"Not assigned"}</Text>
        <Text>Applies to: Entire foundation</Text>
        <Text>Invitation delivery: {deliveryLabel(row.deliveryStatus)}</Text>
        {canAudit&&<Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>void showAudit(row.accountRef)}><Text>View account access history</Text></Pressable>}
        {history&&<View style={styles.group}>
          <Text style={styles.heading}>Recent account access</Text>
          {history.map(event=><View style={styles.option} key={event.eventRef}>
            <Text>{event.actionLabel} · {auditOutcomeLabel(event.outcome)}</Text>
            <Text style={styles.note}>{new Date(event.occurredAt).toLocaleString()}</Text>
          </View>)}
          {!history.length&&<Text>No account access events found.</Text>}
        </View>}
        {row.roleProtected?<Text>Protected administrator. This account cannot be changed here.</Text>:<>
          {row.status==="INVITED"&&canInvite&&!pending&&<Pressable accessibilityRole="button"
            style={styles.button} onPress={()=>{
              setRequestKey(Crypto.randomUUID());setPending({kind:"resend",row});
            }}><Text>Resend invitation</Text></Pressable>}
          {canAssign&&!pending&&<>
            <Text style={styles.label}>Search eligible roles</Text>
            <TextInput accessibilityLabel="Find eligible roles" style={styles.input}
              value={roleQuery} onChangeText={setRoleQuery}/>
            <Pressable accessibilityRole="button" style={styles.button}
              onPress={()=>void searchRoles(roleQuery)}><Text>Find roles</Text></Pressable>
            {roles.map(role=><Pressable key={role.value}
              accessibilityRole="radio" accessibilityLabel={role.label}
              accessibilityState={{checked:roleRef===role.value}}
              style={[styles.option,roleRef===role.value&&styles.selected]}
              onPress={()=>setRoleRef(role.value)}><Text>{role.label}</Text>
            </Pressable>)}
            <Pressable accessibilityRole="button" style={styles.button}
              disabled={!roleRef||roleRef===row.roleRef}
              onPress={()=>{setRequestKey(Crypto.randomUUID());setPending({kind:"assign",row});}}>
              <Text>Assign selected role</Text>
            </Pressable>
            {!!row.roleRef&&<Pressable accessibilityRole="button" style={styles.button}
              onPress={()=>{setRequestKey(Crypto.randomUUID());setPending({kind:"revoke",row});}}>
              <Text>Revoke current role</Text>
            </Pressable>}
          </>}
          {canStatus&&row.status!=="INVITED"&&row.status!=="DEACTIVATED"&&!pending&&
            <View style={styles.group}>
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>{setRequestKey(Crypto.randomUUID());setPending({kind:"status",row,
                  status:row.status==="ACTIVE"?"SUSPENDED":"ACTIVE"});}}>
                <Text>{row.status==="ACTIVE"?"Suspend account":"Reactivate account"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.button}
                onPress={()=>{setRequestKey(Crypto.randomUUID());setPending({kind:"status",row,status:"DEACTIVATED"});}}>
                <Text>Deactivate account</Text>
              </Pressable>
            </View>}
        </>}
        {pending&&<View style={styles.group}>
          <Text style={styles.heading}>Confirm account change</Text>
          <Text>{pending.kind==="assign"?"Assign chosen role":pending.kind==="revoke"?"Revoke role":pending.kind==="resend"?"Resend invitation":
            "Change status to "+accountStatusLabel(pending.status??"")} for {row.displayName}?</Text>
          <Text style={styles.note}>A change to access invalidates existing sessions.</Text>
          <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
            disabled={busy||unknown} onPress={()=>void commit()}>
            <Text style={styles.primaryText}>{busy?"Saving…":"Confirm change"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.button}
            onPress={()=>setPending(null)}><Text>Cancel</Text></Pressable>
        </View>}
      </View>}
      {!!message&&<Text accessibilityRole="alert" style={styles.notice}>{message}</Text>}
      {unknown&&<Pressable accessibilityRole="button" style={styles.button} onPress={()=>{
        setUnknown(false);setPending(null);setScreen(inviteOnly?"invite":"list");void load(search,0,filter);
      }}><Text>Refresh status before trying again</Text></Pressable>}
    </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:careGangaTheme.background},
  content:{padding:20,gap:12,paddingBottom:36},
  title:{fontSize:23,fontWeight:"700",color:careGangaTheme.text,flexShrink:1},
  heading:{fontSize:18,fontWeight:"700",color:careGangaTheme.text},
  note:{fontSize:13,color:careGangaTheme.mutedText},
  label:{fontWeight:"600",color:careGangaTheme.text},
  line:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:8},
  group:{gap:8,paddingVertical:10},
  card:{padding:15,borderWidth:1,borderColor:careGangaTheme.border,
    backgroundColor:careGangaTheme.surface,borderRadius:10,gap:10},
  input:{minHeight:48,paddingHorizontal:12,borderWidth:1,borderColor:careGangaTheme.border,
    backgroundColor:careGangaTheme.surface,color:careGangaTheme.text,borderRadius:7},
  button:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,
    borderRadius:7,padding:12,justifyContent:"center",alignItems:"center"},
  smallButton:{minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,
    borderRadius:7,paddingHorizontal:11,justifyContent:"center",alignItems:"center"},
  buttonText:{fontWeight:"600",color:careGangaTheme.text},
  primary:{backgroundColor:careGangaTheme.primary,borderColor:careGangaTheme.primary},
  primaryText:{fontWeight:"700",color:careGangaTheme.primaryText},
  activeButton:{backgroundColor:careGangaTheme.primary},
  activeText:{fontWeight:"700",color:careGangaTheme.primaryText},
  option:{padding:12,minHeight:48,borderWidth:1,borderColor:careGangaTheme.border,
    backgroundColor:careGangaTheme.surface,borderRadius:7},
  selected:{borderColor:careGangaTheme.primary,borderWidth:2},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:8},
  stat:{flexBasis:"47%",flexGrow:1,minWidth:125,padding:12,gap:6,
    borderWidth:1,borderColor:careGangaTheme.border,borderRadius:8,
    backgroundColor:careGangaTheme.surface},
  statLabel:{fontSize:12,fontWeight:"600",color:careGangaTheme.mutedText},
  statValue:{fontSize:21,fontWeight:"800",color:careGangaTheme.text},
  notice:{borderLeftWidth:3,borderColor:careGangaTheme.primary,padding:12,
    backgroundColor:careGangaTheme.surface,color:careGangaTheme.text}
});
