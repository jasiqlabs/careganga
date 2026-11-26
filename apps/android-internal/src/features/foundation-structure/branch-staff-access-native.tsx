import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Option={value:string;label:string};
type Options={accounts:Option[];branches:Option[];areas:Option[]};
type Assignment={assignmentRef:string;staffName:string;scopeKind:"BRANCH"|"AREA"|"ALL_BRANCHES";
 scopeName:string;reason:string;endedAt:string|null};
type Result={canGrant:boolean;items:Assignment[]};
const url="/api/foundation-structure/branch-access";
async function request<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 const response=await identityRequest(url+path,{method,
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Error(response.status===401?"EXPIRED":
   response.status===403?"DENIED":
   method==="POST"?"The access outcome is uncertain. Refresh before any further change.":
   "Current branch access cannot be verified.");
 return await response.json() as T;
}
/** Real CG02 staff scope only. CG14 healthcare center access remains separate. */
export function BranchStaffAccessNative({token,onExpired}:{token:string;onExpired:()=>void}){
 const [visible,setVisible]=useState(false),[listing,setListing]=useState<Result|null>(null);
 const [choices,setChoices]=useState<Options|null>(null),[search,setSearch]=useState("");
 const [account,setAccount]=useState(""),[kind,setKind]=useState<"BRANCH"|"AREA"|"ALL_BRANCHES">("BRANCH");
 const [scope,setScope]=useState(""),[reason,setReason]=useState(""),[password,setPassword]=useState("");
 const [panel,setPanel]=useState<"ACCOUNT"|"SCOPE"|null>(null);
 const [busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false);
 const [message,setMessage]=useState("");
 const requestKey=useRef<string|null>(null);
 const refresh=useCallback(async(q="")=>{
  const [current,options]=await Promise.all([
   request<Result>(token,"/assignments"),
   request<Options>(token,"/options?search="+encodeURIComponent(q))]);
  setListing(current);setChoices(options);setBlocked(false);setMessage("");
 },[token]);
 useEffect(()=>{if(!visible)return;let live=true;void refresh().catch(e=>{
  if(!live)return;
  if(e instanceof Error&&e.message==="EXPIRED")onExpired();
  else setMessage("Staff assignments cannot be verified. Use Refresh before making changes.");
 });return()=>{live=false;};},[visible,refresh,onExpired]);
 const press=(name:string,action:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   onPress={action} disabled={disabled} style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{name}</Text></Pressable>);
 const pick=(label:string,items:Option[],value:string,choose:(s:string)=>void)=>(
  <View style={styles.field}><Text style={styles.label}>{label}</Text>
   <Text style={styles.copy}>{items.find(x=>x.value===value)?.label??"Not selected"}</Text>
   {press("Choose "+label.toLowerCase(),()=>setPanel(panel===labelToPanel(label)?null:labelToPanel(label)))}
   {panel===labelToPanel(label)&&items.map(x=>(
    <Pressable key={x.value} accessibilityRole="radio"
     accessibilityState={{selected:value===x.value}} style={styles.option}
     onPress={()=>{choose(x.value);setPanel(null);requestKey.current=null;}}>
     <Text style={styles.copy}>{x.label}</Text></Pressable>))}
  </View>);
 async function grant(){
  if(busy||blocked||!listing?.canGrant||!account||
   (kind!=="ALL_BRANCHES"&&!scope)||reason.trim().length<6||password.length<8)return;
  if(!requestKey.current)requestKey.current=Crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const outcome=await request<{message:string}>(token,"/assignments","POST",{
    requestKey:requestKey.current,accountRef:account,scopeKind:kind,
    ...(kind==="BRANCH"?{branchRef:scope}:kind==="AREA"?{areaRef:scope}:{}),
    reason:reason.trim(),currentPassword:password});
   requestKey.current=null;setPassword("");setReason("");setScope("");
   await refresh(search);setMessage(outcome.message);
  }catch(e){setBlocked(true);setMessage(e instanceof Error?e.message:
   "Access outcome uncertain. Verify current assignments.");}
  finally{setBusy(false);}
 }
 async function end(ref:string){
  if(busy||blocked||!listing?.canGrant||password.length<8)return;
  if(!requestKey.current)requestKey.current=Crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const outcome=await request<{message:string}>(token,"/assignments/"+ref+"/end","POST",
    {requestKey:requestKey.current,currentPassword:password});
   requestKey.current=null;setPassword("");await refresh(search);setMessage(outcome.message);
  }catch(e){setBlocked(true);setMessage(e instanceof Error?e.message:
   "Access change uncertain. Refresh first.");}
  finally{setBusy(false);}
 }
 return <View style={styles.card}>
  {press(visible?"Hide staff branch access":"Manage delegated staff branch access",
   ()=>{setVisible(v=>!v);setPanel(null);})}
  {visible&&<>
   <Text style={styles.title}>Current Foundation branch / area assignments</Text>
   <Text style={styles.copy}>Staff role permissions remain separate. Healthcare center access is managed independently.</Text>
   {!!message&&<Text accessibilityRole="alert" style={styles.notice}>{message}</Text>}
   {blocked&&<Text style={styles.notice}>Do not repeat an unknown result. Refresh current staff assignments.</Text>}
   {press("Refresh original staff assignments",()=>void refresh(search).catch(e=>{
    if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    else setMessage("Current assignments cannot be verified.");}),busy)}
   {listing?.canGrant&&<>
    <Text style={styles.label}>Find staff by name</Text>
    <TextInput style={styles.input} value={search} onChangeText={setSearch}
     accessibilityLabel="Find eligible staff" placeholder="Search staff" placeholderTextColor={theme.mutedText}/>
    {press("Search eligible staff",()=>void refresh(search).catch(()=>setMessage(
     "Eligible staff cannot be verified.")),busy)}
    {pick("Staff account",choices?.accounts??[],account,setAccount)}
    <Text style={styles.label}>Scope type</Text>
    {(["BRANCH","AREA","ALL_BRANCHES"] as const).map(x=>press(
      x==="BRANCH"?"Specific branch":x==="AREA"?"State / district / block":
       "All active branches (not Foundation master)",
      ()=>{setKind(x);setScope("");requestKey.current=null;},busy||kind===x))}
    {kind!=="ALL_BRANCHES"&&pick("Access scope",
      kind==="BRANCH"?choices?.branches??[]:choices?.areas??[],scope,setScope)}
    {kind==="ALL_BRANCHES"&&<Text style={styles.copy}>
      This assignment includes current and future active branches, but never Foundation-only legal or financial records.</Text>}
    <Text style={styles.label}>Reason for access</Text>
    <TextInput style={styles.input} value={reason} onChangeText={x=>{setReason(x);requestKey.current=null;}}
     maxLength={500} multiline accessibilityLabel="Reason for access"/>
    <Text style={styles.label}>Current protected administrator password</Text>
    <TextInput style={styles.input} value={password} onChangeText={setPassword}
     secureTextEntry accessibilityLabel="Current administrator password"/>
    {press("Grant selected restricted access",()=>void grant(),
     busy||blocked||!account||(kind!=="ALL_BRANCHES"&&!scope)||
      reason.trim().length<6||password.length<8)}
   </>}
   {listing&&!listing.canGrant&&<Text style={styles.copy}>
    Only a protected Foundation administrator may change delegated scope.</Text>}
   {listing?.items.map(x=><View key={x.assignmentRef} style={styles.option}>
    <Text style={styles.label}>{x.staffName} · {x.scopeName}</Text>
    <Text style={styles.copy}>{x.scopeKind==="BRANCH"?"Branch":x.scopeKind==="AREA"?
      "Geographic area":"All active Foundation branches"} ·
     {x.endedAt?"Ended":"Active"}</Text>
    {listing.canGrant&&!x.endedAt&&press("End this staff access",()=>void end(x.assignmentRef),
     busy||blocked||password.length<8)}
   </View>)}
  </>}
 </View>;
}
function labelToPanel(label:string):"ACCOUNT"|"SCOPE"{
 return label==="Staff account"?"ACCOUNT":"SCOPE";
}
const styles=StyleSheet.create({
 card:{padding:16,gap:10,borderRadius:14,backgroundColor:"#FFFFFF",
  borderWidth:1,borderColor:"#E2E8F0",shadowColor:"#0F172A",shadowOpacity:0.04,
  shadowOffset:{width:0,height:2},shadowRadius:6,elevation:2},
 title:{fontSize:18,color:theme.text,fontWeight:"700"},
 label:{color:theme.text,fontSize:14,fontWeight:"600"},copy:{color:theme.text,fontSize:13},
 button:{padding:12,minHeight:48,backgroundColor:"#F8FAFC",
  borderColor:"#E2E8F0",borderWidth:1,borderRadius:9,justifyContent:"center"},
 buttonText:{color:theme.text,fontWeight:"600",textAlign:"center"},
 field:{gap:6},input:{borderWidth:1,borderColor:"#E2E8F0",padding:12,
  borderRadius:9,minHeight:48,color:theme.text,backgroundColor:"#FFFFFF"},
 disabled:{opacity:.5},option:{padding:12,borderColor:"#E2E8F0",borderWidth:1,
  borderRadius:10,gap:5,backgroundColor:"#FFFFFF"},notice:{padding:10,color:theme.text,backgroundColor:theme.background}
});
