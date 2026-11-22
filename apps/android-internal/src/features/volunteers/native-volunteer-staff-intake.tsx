import {useEffect,useRef,useState} from "react";
import {AppState,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Row={firstName:string;lastName:string;mobile:string;city:string;alreadyImported:boolean};
type Preview={rows:Row[];rowCount:number;newCount:number;alreadyImported:number};
type Result={confirmed:boolean;importedCount:number;skippedCount:number};
const blank=()=>({firstName:"",lastName:"",mobile:"",city:""});
export function NativeVolunteerStaffIntake({token,onExpired}:{token:string;onExpired:()=>void}){
 const [mode,setMode]=useState<"SINGLE"|"CSV">("SINGLE"),[person,setPerson]=useState(blank),[csv,setCsv]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const [saved,setSaved]=useState<{ref:string;firstName:string;lastName:string;mobile:string}[]>([]);
 const pending=useRef<{key:string;body:Record<string,unknown>}|null>(null),active=useRef(true),sequence=useRef(0);
 const scrub=()=>{sequence.current++;setPerson(blank());setCsv("");setPreview(null);setSaved([]);setNotice("");pending.current=null;};
 useEffect(()=>{
  const sub=AppState.addEventListener("change",state=>{active.current=state==="active";if(!active.current)scrub();});
  return()=>{sub.remove();scrub();};
 },[]);
 async function call<T>(path:string,body?:Record<string,unknown>):Promise<T>{
  const r=await identityRequest("/api/v1/volunteers/roster/intake"+path,{
   method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   cache:"no-store",...(body?{body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Error("Session expired. Sign in again.");}
  if(!r.ok)throw Error(r.status===403?"Current Foundation reviewer authority is unavailable.":
   r.status===409?"Original import changed. Check existing drafts.":"Check the candidate information or CSV format.");
  return r.json() as Promise<T>;
 }
 const requestBody=():Record<string,unknown>=>mode==="SINGLE"?{rows:[person]}:{csv};
 const show=async()=>{if(busy||!active.current)return;setBusy(true);setNotice("");setPreview(null);pending.current=null;
  const id=++sequence.current;
  try{const value=await call<Preview>("/preview",requestBody());if(active.current&&id===sequence.current)setPreview(value);}
  catch(e){if(active.current&&id===sequence.current)setNotice(e instanceof Error?e.message:"CSV preview could not be confirmed.");}
  finally{setBusy(false);}
 };
 const save=async()=>{if(!preview||busy||!active.current)return;
  if(!pending.current)pending.current={key:Crypto.randomUUID(),body:requestBody()};
  setBusy(true);setNotice("");const id=sequence.current;
  try{
   const outcome=await call<Result>("",{...pending.current.body,requestKey:pending.current.key});
   if(!active.current||id!==sequence.current)return;
   if(!outcome.confirmed)throw Error();
   pending.current=null;setPreview(null);setPerson(blank());setCsv("");
   setNotice(outcome.importedCount+" unverified drafts saved; "+outcome.skippedCount+" existing contacts skipped. Applicants must register independently.");
  }catch(e){if(active.current&&id===sequence.current)setNotice(e instanceof Error?e.message:"Result uncertain. Retry the same request.");}
  finally{setBusy(false);}
 };
 const view=async()=>{if(busy||!active.current)return;const id=++sequence.current;setBusy(true);
  try{const value=await call<{items:typeof saved}>("/drafts");if(id===sequence.current&&active.current)setSaved(value.items);}
  catch(e){if(id===sequence.current)setNotice(e instanceof Error?e.message:"Draft list unavailable.");}
  finally{setBusy(false);}
 };
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={busy||disabled}
  onPress={fn} style={[s.button,(busy||disabled)&&{opacity:.5}]}><Text style={s.bold}>{label}</Text></Pressable>;
 const field=(label:string,key:keyof ReturnType<typeof blank>)=><View><Text style={s.bold}>{label}</Text>
  <TextInput accessibilityLabel={label} value={person[key]} editable={!busy&&!preview&&!pending.current} style={s.input}
   onChangeText={value=>setPerson(x=>({...x,[key]:value}))}/></View>;
 return <View style={s.card}>
  <Text accessibilityRole="header" style={s.heading}>Add volunteer / import CSV (U14)</Text>
  <Text style={s.muted}>Staff intake creates unverified candidates only: no account, consent, approval, role, or ID card.</Text>
  <View style={s.row}>{button("Add candidate",()=>{scrub();setMode("SINGLE");},!!pending.current)}
   {button("Paste CSV",()=>{scrub();setMode("CSV");},!!pending.current)}</View>
  {mode==="SINGLE"?<>{field("First name","firstName")}{field("Last name","lastName")}
    {field("Mobile number","mobile")}{field("City (optional)","city")}</>:
   <><Text>CSV: First Name, Last Name, Mobile, City. Maximum 200 rows, 100 KB.</Text>
    <TextInput accessibilityLabel="Volunteer CSV rows" multiline value={csv} onChangeText={setCsv} editable={!busy&&!preview&&!pending.current}
     maxLength={100000} style={[s.input,{minHeight:100}]} placeholder="First Name,Last Name,Mobile,City"/></>}
  {!preview&&button("Validate and preview",()=>void show(),mode==="CSV"&&!csv.trim())}
  {preview&&<View style={s.card}><Text>Preview: {preview.rowCount} candidates · {preview.newCount} new · {preview.alreadyImported} existing.</Text>
   <ScrollView style={{maxHeight:240}} nestedScrollEnabled>
    {preview.rows.map((v,i)=><Text key={i}>{v.firstName} {v.lastName} · {v.mobile} · {v.alreadyImported?"Existing draft":"Unverified draft"}</Text>)}
   </ScrollView>
   {button(pending.current?"Retry same intake request":"Confirm draft-only intake",()=>void save())}
  </View>}
  {!!notice&&<Text accessibilityRole="alert">{notice}</Text>}
  {button("Refresh unverified intake list",()=>void view())}
  {saved.map(v=><Text key={v.ref}>{v.firstName} {v.lastName} · {v.mobile} · Awaiting consented self-registration</Text>)}
 </View>;
}
const s=StyleSheet.create({card:{padding:12,gap:9,borderColor:t.border,borderWidth:1,borderRadius:11,backgroundColor:t.surface},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},heading:{fontWeight:"700",fontSize:16,color:t.text},
 muted:{fontSize:12,color:t.mutedText},bold:{fontWeight:"600",color:t.text},
 button:{borderColor:t.border,borderWidth:1,borderRadius:8,padding:10,minHeight:44,justifyContent:"center"},
 input:{borderColor:t.border,borderWidth:1,borderRadius:8,padding:10,color:t.text,minHeight:44}});
