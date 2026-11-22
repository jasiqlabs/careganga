import {useEffect,useRef,useState} from "react";
import {AppState,ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

const steps=["Basic Details","Project & Category","Team & Assignment","Budget & Targets","Documents & Media","Review & Submit"];
type Draft={
 basic:{title:string;type:"GENERAL";summary:string;description:string;tags:string[]};
 project:{category:string;branchRef:string|null;projectRef:null;eventRef:null;stateRef:string|null;districtRef:string|null;location:string;targetGroup:string;plannedBeneficiaries:number|null};
 team:{coordinatorRef:string|null;volunteerRef:null};
 budget:{goal:string;expectedCost:string;startAt:string;endAt:string};
 media:{fileRef:null;alt:string};review:Record<string,never>;
};
type Row={ref:string;code:string;title:string;status:string;category:string;version:number;revision:number;steps?:Record<string,unknown>};
type Page={items:Row[];offset:number;hasMore:boolean};
type Saved={ref:string;version:number;code:string;replayed:boolean;status:string};
type Choice={value:string;label:string};
type Choices={canFoundation:boolean;branches:Choice[];states:Choice[];districts:Choice[];coordinators:Choice[]};
const blank=():Draft=>({basic:{title:"",type:"GENERAL",summary:"",description:"",tags:[]},
 project:{category:"GENERAL",branchRef:null,projectRef:null,eventRef:null,stateRef:null,districtRef:null,location:"",targetGroup:"",plannedBeneficiaries:null},
 team:{coordinatorRef:null,volunteerRef:null},budget:{goal:"",expectedCost:"",startAt:"",endAt:""},media:{fileRef:null,alt:""},review:{}});
const rupees=(v:unknown)=>{try{if(typeof v!=="string"||!/^[0-9]+$/.test(v))return "";
 const n=BigInt(v);return (n/100n).toString()+"."+(n%100n).toString().padStart(2,"0");}catch{return "";}};
function fromRow(row:Row):Draft{
 const b=row.steps?.basic as Partial<Draft["basic"]>|undefined;
 const p=row.steps?.project as Partial<Draft["project"]>|undefined;
 const t=row.steps?.team as Partial<Draft["team"]>|undefined;
 const g=row.steps?.budget as {goalMinor?:string;expectedCostMinor?:string;startAt?:string|null;endAt?:string|null}|undefined;
 return {...blank(),basic:{...blank().basic,title:b?.title??row.title,summary:b?.summary??"",
  description:b?.description??"",tags:Array.isArray(b?.tags)?b.tags:[]},
  project:{...blank().project,category:p?.category??row.category,branchRef:p?.branchRef??null,
   stateRef:p?.stateRef??null,districtRef:p?.districtRef??null,location:p?.location??"",targetGroup:p?.targetGroup??"",
   plannedBeneficiaries:p?.plannedBeneficiaries??null},
  team:{...blank().team,coordinatorRef:t?.coordinatorRef??null},
  budget:{goal:rupees(g?.goalMinor),expectedCost:rupees(g?.expectedCostMinor),
   startAt:g?.startAt??"",endAt:g?.endAt??""}};
}
export function NativeCampaignDrafts({token,canManage,onExpired}:{
 token:string;canManage:boolean;onExpired:()=>void
}){
 const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState<Row|null>(null);
 const [form,setForm]=useState<Draft>(blank),[step,setStep]=useState(0),[editing,setEditing]=useState(false);
 const [offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[search,setSearch]=useState("");
 const [applied,setApplied]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const [notice,setNotice]=useState(""),[error,setError]=useState(""),[choices,setChoices]=useState<Choices|null>(null);
 const choiceSeq=useRef(0);
 const pending=useRef<{key:string;body:Record<string,unknown>;path:string;method:"POST"|"PATCH"}|null>(null);
 const seq=useRef(0),active=useRef(true);
 async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>){
  const r=await identityRequest("/api/v1/campaigns"+(path.startsWith("?")?path:path?"/"+path:""),{
   method,cache:"no-store",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Sign in again.");}
  const data:unknown=await r.json().catch(()=>null);
  if(!r.ok||!data)throw Object.assign(Error(r.status===403?"Your current Foundation role or branch cannot access this campaign.":
   r.status===409?"This campaign changed. Refresh the saved draft.":
   r.status===400?"Check campaign title, amounts, dates and required details.":
   "Campaign result cannot be confirmed. Check the original draft."),{status:r.status});
  return data as T;
 }
 const refresh=async()=>{
  const id=++seq.current;setLoading(true);setError("");
  try{
   const p=await api<Page>("?"+new URLSearchParams({offset:String(offset),q:applied}).toString());
   if(id===seq.current&&active.current){setRows(p.items);setHasMore(p.hasMore);}
  }catch(e){if(id===seq.current&&active.current){setRows([]);setError(e instanceof Error?e.message:"Campaigns unavailable.");}}
  finally{if(id===seq.current&&active.current)setLoading(false);}
 };
 useEffect(()=>{void refresh();return()=>{seq.current++;};},[token,offset,applied]);
 useEffect(()=>{
  if(!editing||!active.current){setChoices(null);return;}
  const id=++choiceSeq.current;
  void api<Choices>("options?"+new URLSearchParams({stateRef:form.project.stateRef??""}).toString())
   .then(value=>{if(id===choiceSeq.current&&active.current)setChoices(value);})
   .catch(()=>{if(id===choiceSeq.current&&active.current){setChoices(null);setError("Current campaign branch and area choices are unavailable.");}});
  return()=>{choiceSeq.current++;};
 },[editing,form.project.stateRef,token]);
 useEffect(()=>{
  const subscription=AppState.addEventListener("change",state=>{
   active.current=state==="active";
   if(!active.current){
    seq.current++;choiceSeq.current++;setRows([]);setSelected(null);setForm(blank());setEditing(false);setChoices(null);
    setError("");setNotice("");pending.current=null;
   }else void refresh();
  });
  return()=>subscription.remove();
 },[token,offset,applied]);
 const reset=()=>{
  if(busy||pending.current)return;
  seq.current++;setSelected(null);setForm(blank());setEditing(false);setStep(0);setError("");setNotice("");
 };
 const open=async(row:Row)=>{
  if(busy||pending.current)return;const id=++seq.current;setLoading(true);setError("");
  try{
   const item=await api<Row>(row.ref);
   if(id===seq.current&&active.current){setSelected(item);setForm(fromRow(item));setEditing(true);setStep(0);}
  }catch(e){if(id===seq.current&&active.current)setError(e instanceof Error?e.message:"Campaign details unavailable.");}
  finally{if(id===seq.current&&active.current)setLoading(false);}
 };
 const change=<K extends keyof Draft>(name:K,key:string,value:unknown)=>{
  if(!canManage||pending.current)return;setForm(x=>({...x,[name]:{...x[name],[key]:value}}));
 };
 const save=async()=>{
  if(!canManage||busy||!form.basic.title.trim()||!active.current)return;setBusy(true);setError("");setNotice("");
  if(!pending.current)pending.current={key:Crypto.randomUUID(),path:selected?selected.ref+"/draft":"",
   method:selected?"PATCH":"POST",body:{requestKey:"",...(selected?{expectedVersion:selected.version}:{}),steps:form}};
  const current=pending.current;current.body.requestKey=current.key;
  const id=seq.current;
  try{
   const outcome=await api<Saved>(current.path,current.method,current.body);
   if(!active.current||id!==seq.current)return;
   pending.current=null;
   setNotice("Campaign "+outcome.code+" saved as private draft. No publication or donation has been approved.");
   const row=await api<Row>(outcome.ref);
   if(!active.current||id!==seq.current)return;
   setSelected(row);setForm(fromRow(row));setEditing(true);await refresh();
  }catch(e){
   if(!active.current||id!==seq.current)return;
   const code=e&&typeof e==="object"&&"status" in e?Number(e.status):0;
   if(code>0&&code<500&&![408,429].includes(code))pending.current=null;
   setError(e instanceof Error?e.message:"Save result uncertain. Retry the same original request.");
  }finally{setBusy(false);}
 };
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled||busy}
  onPress={fn} style={[s.button,(disabled||busy)&&{opacity:.5}]}><Text style={s.action}>{label}</Text></Pressable>;
 const pick=(label:string,value:string|null,items:Choice[],onPick:(v:string|null)=>void,empty:string)=>
  <View style={s.block}><Text style={s.label}>{label}</Text>
   <ScrollView horizontal contentContainerStyle={s.row} nestedScrollEnabled>
    {button(empty,()=>onPick(null),!!pending.current||!choices||value===null)}
    {items.map(item=><View key={item.value}>{button((value===item.value?"✓ ":"")+item.label,
     ()=>onPick(item.value),!!pending.current||!choices||item.value===value)}</View>)}
   </ScrollView>
  </View>;
 const field=(label:string,value:string,changeValue:(v:string)=>void,large=false)=><View style={s.block}>
  <Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input,large&&{minHeight:92}]}
   multiline={large} editable={canManage&&!busy&&!pending.current} value={value} onChangeText={changeValue}/></View>;
 return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
  <Text accessibilityRole="header" style={s.title}>Campaigns</Text>
  <Text style={s.muted}>Current Foundation campaign drafts. Verified contributions and public publication are separate.</Text>
  <View style={s.block}>
   {canManage&&button("Launch New Campaign",()=>{reset();setEditing(true);},!!pending.current)}
   {field("Search campaign or code",search,setSearch)}
   <View style={s.row}>{button("Search",()=>{setOffset(0);setApplied(search.trim());})}{button("Refresh",()=>void refresh())}</View>
  </View>
  {loading&&<ActivityIndicator accessibilityLabel="Checking original Foundation campaigns"/>}
  {!loading&&!rows.length&&<Text style={s.muted}>No permitted campaigns match the current search.</Text>}
  {rows.map(c=><View key={c.ref} style={s.card}><Text style={s.heading}>{c.title}</Text>
   <Text>{c.code} · {c.status.replaceAll("_"," ")} · {c.category}</Text>
   {button(canManage?"Open draft":"View details",()=>void open(c),!!pending.current)}
  </View>)}
  <View style={s.row}>{offset>0&&button("Previous page",()=>setOffset(v=>Math.max(0,v-25)))}
   {hasMore&&button("Next page",()=>setOffset(v=>v+25))}</View>
  {editing&&<View style={s.card}>
   <Text style={s.heading}>{selected?selected.code:"New Campaign"} · Step {step+1} of 6</Text>
   <Text>{steps[step]}</Text>
   <ScrollView horizontal contentContainerStyle={s.row}>
    {steps.map((name,i)=><View key={name}>{button((i+1)+". "+name,()=>setStep(i),!!pending.current)}</View>)}
   </ScrollView>
   {step===0&&<>
    {field("Campaign title (required)",form.basic.title,v=>change("basic","title",v))}
    <Text>General Foundation Campaign</Text>
    {field("Short explanation",form.basic.summary,v=>change("basic","summary",v),true)}
    {field("Full explanation",form.basic.description,v=>change("basic","description",v),true)}
    {field("Tags (comma-separated)",form.basic.tags.join(", "),v=>change("basic","tags",v.split(",").map(x=>x.trim()).filter(Boolean)))}
   </>}
   {step===1&&<>
    {pick("Foundation branch",form.project.branchRef,choices?.branches??[],v=>change("project","branchRef",v),
      choices?.canFoundation?"Foundation-wide":"Select active branch")}
    {pick("State",form.project.stateRef,choices?.states??[],v=>setForm(d=>({...d,
      project:{...d.project,stateRef:v,districtRef:null}})),"No state")}
    {pick("District",form.project.districtRef,choices?.districts??[],v=>change("project","districtRef",v),"No district")}
    {field("Campaign category",form.project.category,v=>change("project","category",v))}
    {field("Location description",form.project.location,v=>change("project","location",v))}
    {field("Planned target group",form.project.targetGroup,v=>change("project","targetGroup",v))}
    {field("Planned beneficiaries (estimate, not achieved)",form.project.plannedBeneficiaries===null?"":String(form.project.plannedBeneficiaries),
     v=>change("project","plannedBeneficiaries",v===""?null:/^\d+$/.test(v)?Number(v):-1))}
    <Text style={s.muted}>Project and event links require verified CG-05 source and remain unavailable in this initial draft.</Text>
   </>}
   {step===2&&<View style={s.block}>
    {pick("Campaign coordinator",form.team.coordinatorRef,choices?.coordinators??[],v=>change("team","coordinatorRef",v),
      "Use signed-in operator")}
    <Text style={s.muted}>Optional verified volunteer association requires the actual current CG-04 source and does not grant a staff role.</Text>
   </View>}
   {step===3&&<>
    {field("Fundraising goal in INR",form.budget.goal,v=>change("budget","goal",v))}
    {field("Expected cost in INR",form.budget.expectedCost,v=>change("budget","expectedCost",v))}
    {field("Start date (YYYY-MM-DD)",form.budget.startAt,v=>change("budget","startAt",v))}
    {field("End date (YYYY-MM-DD)",form.budget.endAt,v=>change("budget","endAt",v))}
    <Text style={s.muted}>Planned targets are not approved CG-09 budgets or collected donations.</Text>
   </>}
   {step===4&&<Text>A text-only campaign draft is permitted. CG-19 private verified media upload remains unavailable until genuine owner integration.</Text>}
   {step===5&&<View style={s.block}>
    <Text style={s.heading}>Review private draft</Text>
    <Text>Title: {form.basic.title||"Not entered"}</Text><Text>Category: {form.project.category}</Text>
    <Text>Target: {form.budget.goal||"Not entered"} INR</Text>
    <Text>Dates: {form.budget.startAt||"Not entered"} to {form.budget.endAt||"Not entered"}</Text>
    <Text style={s.muted}>Submitting requires genuine CG-03 review followed by independently approved CG-18 publication. Draft does not enable donation.</Text>
    {button("Submit for Verification (not available)",()=>{},true)}
   </View>}
   <View style={s.row}>
    {button("Previous",()=>setStep(v=>Math.max(0,v-1)),step===0||!!pending.current)}
    {button("Next",()=>setStep(v=>Math.min(5,v+1)),step===5||!!pending.current)}
    {canManage&&button(pending.current?"Retry original draft":"Save as Draft",()=>void save(),form.basic.title.trim().length<2)}
    {button("Close",reset,!!pending.current)}
   </View>
  </View>}
  {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
  {!!pending.current&&<Text accessibilityRole="alert">Original save outcome unconfirmed. Retry the same request or refresh the original list before another change.</Text>}
 </ScrollView>;
}
const s=StyleSheet.create({
 page:{backgroundColor:t.adminCanvas,padding:15,paddingBottom:56,gap:12},
 title:{fontSize:23,fontWeight:"700",color:t.text},heading:{fontSize:16,fontWeight:"700",color:t.text},
 muted:{fontSize:13,color:t.mutedText},block:{gap:9},row:{flexDirection:"row",gap:7,flexWrap:"wrap"},
 card:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,borderRadius:12,padding:13,gap:10},
 label:{color:t.text,fontWeight:"600"},input:{borderWidth:1,borderColor:t.border,borderRadius:8,
  padding:11,minHeight:44,color:t.text,backgroundColor:t.surface},
 button:{minHeight:44,padding:11,borderRadius:9,borderWidth:1,borderColor:t.border,justifyContent:"center"},
 action:{color:t.text,fontWeight:"600",fontSize:13},error:{color:t.error}
});
