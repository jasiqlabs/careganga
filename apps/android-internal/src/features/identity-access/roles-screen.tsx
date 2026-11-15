import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View
} from "react-native";
import * as Crypto from "expo-crypto";
import { SafeAreaView } from "react-native-safe-area-context";
import { identityRequest } from "./http-client";

import type { CG01RoleSummary,CG01Capability,CG01AuditEvent } from "@careganga/api-contracts";
type Role=CG01RoleSummary;
type Action=CG01Capability;
type Group={group:string;actions:Action[]};
type Editing={mode:"create"|"edit"|"copy";source?:Role};
type Audit=CG01AuditEvent;
const base="/api/access/";
async function call(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object):Promise<unknown>{
  let result:Response;
  try {
    result=await identityRequest(base+path,{
      method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
  } catch {
    // Lost response after a mutation may conceal a successful commit.
    throw new Error(method==="GET"?"UNAVAILABLE":"UNKNOWN");
  }
  if(result.status===401)throw new Error("SESSION_EXPIRED");
  if(result.status===403)throw new Error("PERMISSION_DENIED");
  if(result.status===409){
    const payload:unknown=await result.json();
    const code=payload&&typeof payload==="object"&&"code" in payload&&
      typeof payload.code==="string"?payload.code:"CONFLICT";
    throw new Error(["DUPLICATE_ROLE","STALE_ROLE","ROLE_RETIRED","ROLE_ASSIGNED","REPLAY_CONFLICT"]
      .includes(code)?code:"CONFLICT");
  }
  if(!result.ok)throw new Error(result.status>=500?"UNKNOWN":"INVALID");
  return result.json() as Promise<unknown>;
}
export function RolesScreen({token,onExit,onExpired}:{token:string;onExit:()=>void;onExpired:()=>void}){
  const [roles,setRoles]=useState<Role[]>([]);
  const [groups,setGroups]=useState<Group[]>([]);
  const [allowed,setAllowed]=useState<string[]>([]);
  const [busy,setBusy]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [search,setSearch]=useState("");
  const [editor,setEditor]=useState<Editing|null>(null);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [requestKey,setRequestKey]=useState("");
  const [history,setHistory]=useState<Audit[]|null>(null);
  const [historyCursor,setHistoryCursor]=useState<string|null>(null);
  const [offset,setOffset]=useState(0);
  const [total,setTotal]=useState(0);
  const [uncertain,setUncertain]=useState(false);
  const canEdit=allowed.includes("roles.manage");
  const canAudit=allowed.includes("access.audit.view");
  const load=useCallback(async(q="",skip=0)=>{
    setBusy(true);setError("");
    try{
      const query=new URLSearchParams({search:q,limit:"30",offset:String(skip)});
      const [list,cap,effective]=await Promise.all([
        call(token,"roles?"+query),
        call(token,"capabilities"),
        call(token,"effective")
      ]);
      const a=list as {roles:Role[];total:number};
      const c=cap as {groups:Group[]};
      const eff=effective as {actions:{key:string}[]};
      if(!Array.isArray(a.roles)||!Array.isArray(c.groups)||!Array.isArray(eff.actions))
        throw new Error("INVALID");
      setRoles(a.roles);setGroups(c.groups);setAllowed(eff.actions.map(x=>x.key));
      setOffset(skip);setTotal(a.total);
    }catch(e){
      // Data cached on screen is not a source of current permission truth.
      setRoles([]);setGroups([]);setAllowed([]);setHistory(null);setHistoryCursor(null);
      setEditor(null);
      if(e instanceof Error&&e.message==="SESSION_EXPIRED"){onExpired();return;}
      setError(e instanceof Error&&e.message==="PERMISSION_DENIED"?
        "You don't have access to Foundation roles.":"Roles cannot be verified right now.");
    }finally{setBusy(false);}
  },[token,onExpired]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(editor&&!saving){setEditor(null);return true;}
      if(!editor){onExit();return true;}
      return true;
    });
    return()=>sub.remove();
  },[editor,saving,onExit]);
  function open(mode:Editing["mode"],source?:Role){
    if(!canEdit||source?.protected)return;
    setEditor({mode,source});
    setName(mode==="copy"?(source?.name??"")+" copy":source?.name??"");
    setDescription(source?.description??"");
    const eligible=new Set(groups.flatMap(g=>g.actions.filter(a=>a.assignable).map(a=>a.key)));
    setSelected(source?.actionKeys.filter(k=>eligible.has(k))??[]);
    setRequestKey(Crypto.randomUUID());setError("");setSuccess("");setUncertain(false);
  }
  async function submit(){
    if(!editor||saving||uncertain||name.trim().length<2)return;
    setSaving(true);setError("");setSuccess("");
    const source=editor.source;
    const url=editor.mode==="create"?"roles":editor.mode==="copy"&&source?
      "roles/"+source.roleRef+"/copy":"roles/"+source?.roleRef;
    const method=editor.mode==="edit"?"PATCH":"POST";
    try{
      await call(token,url,method,{
        name:name.trim(),description:description.trim(),colorKey:"default",
        actionKeys:selected,requestKey,
        ...(editor.mode!=="create"&&source?{expectedRevision:source.revision}:{})
      });
      setEditor(null);await load(search,offset);setSuccess("Role change saved.");
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED"){onExpired();return;}
      if(e instanceof Error&&e.message==="PERMISSION_DENIED"){
        setRoles([]);setGroups([]);setAllowed([]);setHistory(null);setEditor(null);
      }
      if(e instanceof Error&&e.message==="UNKNOWN"){
        setUncertain(true);
        setError("The result could not be confirmed. Return to the role list before trying again.");
      }else setError(e instanceof Error&&e.message==="DUPLICATE_ROLE"?
        "A role with this name already exists. Choose another name.":
        e instanceof Error&&e.message==="REPLAY_CONFLICT"?
        "This request reference was already used. Refresh before retrying.":
        e instanceof Error&&["STALE_ROLE","ROLE_RETIRED","CONFLICT"].includes(e.message)?
        "This role changed elsewhere. Refresh before saving.":e instanceof Error&&e.message==="PERMISSION_DENIED"?
        "You don't have permission for this change.":"Check the role details and try again.");
    }finally{setSaving(false);}
  }
  function confirmRetire(role:Role){
    if(!canEdit||role.protected||!role.active||role.assignedCount>0)return;
    Alert.alert("Retire role?","This role cannot be selected again after retirement.",[
      {text:"Cancel",style:"cancel"},{text:"Retire role",style:"destructive",onPress:()=>void retire(role)}
    ]);
  }
  async function retire(role:Role){
    if(!canEdit||role.protected||!role.active||role.assignedCount>0||saving)return;
    setSaving(true);setError("");setSuccess("");
    try{
      await call(token,"roles/"+role.roleRef+"/retire","POST",{
        expectedRevision:role.revision,requestKey:Crypto.randomUUID()
      });
      await load(search,offset);setSuccess("Role retired.");
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED"){onExpired();return;}
      setError(e instanceof Error&&e.message==="ROLE_ASSIGNED"?
        "Reassign accounts using this role before retiring it.":
        "Retirement could not be confirmed. Refresh roles before trying again.");
    }finally{setSaving(false);}
  }
  async function loadHistory(){
    setBusy(true);setError("");
    try{
      const result=await call(token,"audit?limit=30") as {events:Audit[];nextCursor:string|null};
      if(!Array.isArray(result.events))throw new Error("INVALID");
      setHistory(result.events);setHistoryCursor(result.nextCursor);
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED"){onExpired();return;}
      setError("Security history is unavailable.");
    }finally{setBusy(false);}
  }
  async function moreHistory(){
    if(!historyCursor||busy)return;
    setBusy(true);
    try{
      const data=await call(token,"audit?limit=30&cursor="+encodeURIComponent(historyCursor))
        as {events:Audit[];nextCursor:string|null};
      if(!Array.isArray(data.events))throw new Error("INVALID");
      setHistory(old=>[...(old??[]),...data.events]);setHistoryCursor(data.nextCursor);
    }catch(e){
      if(e instanceof Error&&e.message==="SESSION_EXPIRED"){onExpired();return;}
      setError("Additional history could not be confirmed.");
    }finally{setBusy(false);}
  }
  return <SafeAreaView style={styles.page}><ScrollView
    keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.line}>
      <Pressable onPress={onExit} accessibilityRole="button" style={styles.button}><Text>Back</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Roles & permissions</Text>
    </View>
    <Text>Foundation staff access</Text>
    <Text>Roles: {total}</Text>
    <View style={styles.line}>
      <TextInput accessibilityLabel="Search roles" placeholder="Search role name"
        style={styles.input} value={search} onChangeText={setSearch}/>
      <Pressable accessibilityRole="button" onPress={()=>void load(search,0)} style={styles.button}>
        <Text>Search</Text></Pressable>
    </View>
    <View style={styles.line}>
      {canEdit&&<Pressable accessibilityRole="button" style={styles.button}
        onPress={()=>open("create")}><Text>Create role</Text></Pressable>}
      {canAudit&&<Pressable accessibilityRole="button" style={styles.button}
        onPress={()=>void loadHistory()}><Text>Access history</Text></Pressable>}
    </View>
    {busy&&<ActivityIndicator accessibilityLabel="Loading roles"/>}
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!success&&<Text accessibilityRole="alert">{success}</Text>}
    {!busy&&!roles.length&&<Text>No matching roles are available.</Text>}
    {!busy&&roles.map(role=><View key={role.roleRef} style={styles.roleCard}>
      <Text style={styles.heading}>{role.name}</Text>
      <Text>{role.protected?"Protected Foundation role":role.active?"Active":"Retired"}</Text>
      <Text>{role.assignedCount} assigned accounts</Text>
      <Text>{role.protected?"Protected authority":role.actionKeys.length+" allowed actions"}</Text>
      {!!role.description&&<Text>{role.description}</Text>}
      {canEdit&&!role.protected&&role.active&&<View style={styles.line}>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>open("edit",role)}><Text>Edit</Text></Pressable>
        <Pressable accessibilityRole="button" style={styles.button}
          onPress={()=>open("copy",role)}><Text>Copy</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={saving||role.assignedCount>0}
          style={styles.button} onPress={()=>confirmRetire(role)}><Text>Retire</Text></Pressable>
      </View>}
    </View>)}
    {!busy&&total>30&&<View style={styles.line}>
      <Pressable accessibilityRole="button" disabled={offset===0} style={styles.button}
        onPress={()=>void load(search,Math.max(0,offset-30))}><Text>Previous</Text></Pressable>
      <Text>{offset+1}–{Math.min(offset+30,total)} of {total}</Text>
      <Pressable accessibilityRole="button" disabled={offset+30>=total} style={styles.button}
        onPress={()=>void load(search,offset+30)}><Text>Next</Text></Pressable>
    </View>}
    {history&&<View style={styles.roleCard}>
      <Text style={styles.heading}>Recent access history</Text>
      {history.map((a,i)=><View key={i} style={styles.historyLine}>
        <Text>{a.actionLabel} · {a.targetDisplay}</Text>
        <Text>{a.outcome} · {a.actorDisplay}</Text>
        <Text>{new Date(a.occurredAt).toLocaleString()}</Text>
      </View>)}
      {historyCursor&&<Pressable accessibilityRole="button" disabled={busy} style={styles.button}
        onPress={()=>void moreHistory()}><Text>Load more history</Text></Pressable>}
    </View>}
  </ScrollView>
  <Modal visible={Boolean(editor)} animationType="slide" transparent={false}
    onRequestClose={()=>{if(!saving)setEditor(null);}}>
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS==="ios"?"padding":undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>
            {editor?.mode==="edit"?"Edit role":editor?.mode==="copy"?"Copy role":"Create role"}
          </Text>
          <Text>Role name</Text>
          <TextInput accessibilityLabel="Role name" style={styles.input}
            value={name} maxLength={80} onChangeText={setName}/>
          <Text>Description</Text>
          <TextInput accessibilityLabel="Role description" style={styles.input}
            multiline value={description} maxLength={350} onChangeText={setDescription}/>
          <Text>Color: CareGanga theme default.</Text>
          {editor?.mode==="copy"&&<Text>Only permitted actions are copied. People and protected rights are not copied.</Text>}
          {groups.map(g=><View key={g.group} style={styles.group}>
            <Text style={styles.heading}>{g.group}</Text>
            {g.actions.map(c=><View key={c.key} style={styles.permission}>
              <Text style={styles.permissionLabel}>
                {c.businessLabel}{c.assignable?"":" — Protected"}
              </Text>
              <Switch accessibilityLabel={c.businessLabel} disabled={!c.assignable||saving||editor?.mode==="copy"}
                value={c.assignable&&selected.includes(c.key)}
                onValueChange={value=>setSelected(old=>value?[...old,c.key]:old.filter(k=>k!==c.key))}/>
            </View>)}
          </View>)}
          <Text>{selected.length} actions selected</Text>
          {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {!!success&&<Text>{success}</Text>}
          <View style={styles.line}>
            <Pressable accessibilityRole="button" style={styles.button} disabled={saving}
              onPress={()=>setEditor(null)}><Text>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.button}
              disabled={saving||uncertain||name.trim().length<2} onPress={()=>void submit()}>
              <Text>{saving?"Saving…":"Save role"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1},
  content:{padding:20,gap:12,paddingBottom:36},
  title:{fontSize:24,fontWeight:"700",flexShrink:1},
  heading:{fontSize:18,fontWeight:"700"},
  line:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10},
  input:{borderWidth:1,borderRadius:6,minHeight:48,paddingHorizontal:12,flexGrow:1},
  button:{minHeight:48,minWidth:72,borderWidth:1,borderRadius:6,paddingHorizontal:12,
    paddingVertical:12,alignItems:"center",justifyContent:"center"},
  roleCard:{borderWidth:1,borderRadius:8,padding:14,gap:8},
  group:{borderWidth:1,borderRadius:7,padding:12,gap:10},
  permission:{flexDirection:"row",alignItems:"center",gap:12,minHeight:48},
  permissionLabel:{flex:1},
  historyLine:{paddingVertical:8,borderBottomWidth:1},
  error:{padding:12,borderWidth:1}
});
