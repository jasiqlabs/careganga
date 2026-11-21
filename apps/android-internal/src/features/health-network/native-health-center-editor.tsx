import {useEffect,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
export type CenterDraft={centerCode:string;displayName:string;centerType:string;
 addressLine:string;stateRef:string;districtRef:string;blockRef:string|null;
 pinCode:string;latitude:number|null;longitude:number|null;timeZone:string;
 publicPhone:string|null;diagnosticLicenseValidThrough:string|null;
 hours:{weekday:number;openLocal:string;closeLocal:string;serviceType:string}[];
 capabilities:string[]};
type Option={value:string;label:string;level:string};
type Props={token:string;value:CenterDraft;onChange:(x:CenterDraft)=>void;
 disabled?:boolean;identityLocked?:boolean};
const types=["HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING",
 "OTHER","POLYCLINIC","DIAGNOSTIC_CENTER","DENTAL_CLINIC",
 "MEDICAL_LABORATORY","NURSING_HOME","ORTHOPEDIC_CLINIC",
 "HOMEOPATHY_CLINIC","AYURVEDIC_CLINIC"];
const capabilities=["CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING","SURGERY","EMERGENCY"];
const serviceTypes=["GENERAL","CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING"];
const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const label=(v:string)=>v.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export const blankCenter=():CenterDraft=>({
 centerCode:"",displayName:"",centerType:"CLINIC",addressLine:"",stateRef:"",
 districtRef:"",blockRef:null,pinCode:"",latitude:null,longitude:null,
 timeZone:"Asia/Kolkata",publicPhone:null,diagnosticLicenseValidThrough:null,
 hours:[],capabilities:[]});
async function areas(token:string,level:string,parentRef?:string){
 const q=new URLSearchParams({level,...(parentRef?{parentRef}:{})});
 const response=await identityRequest("/api/v1/health-network/geography?"+q,{
  method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}});
 if(!response.ok)throw Error("Original healthcare geography unavailable.");
 const value:unknown=await response.json();
 if(!value||typeof value!=="object"||!("options" in value)||
  !Array.isArray(value.options))throw Error("Geography choices could not be verified.");
 return value.options.filter((x:unknown):x is Option=>!!x&&typeof x==="object"&&
  "value" in x&&typeof x.value==="string"&&"label" in x&&
  typeof x.label==="string");
}
export function NativeHealthCenterEditor({token,value,onChange,disabled=false,
 identityLocked=false}:Props){
 const [states,setStates]=useState<Option[]>([]);
 const [districts,setDistricts]=useState<Option[]>([]);
 const [blocks,setBlocks]=useState<Option[]>([]);
 const [error,setError]=useState("");
 useEffect(()=>{
  let live=true;
  void areas(token,"STATE").then(x=>{if(live)setStates(x)})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Geography unavailable.")});
  return()=>{live=false};
 },[token]);
 useEffect(()=>{
  let live=true;setDistricts([]);
  if(value.stateRef)void areas(token,"DISTRICT",value.stateRef)
   .then(x=>{if(live)setDistricts(x)})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Districts unavailable.")});
  return()=>{live=false};
 },[token,value.stateRef]);
 useEffect(()=>{
  let live=true;setBlocks([]);
  if(value.districtRef)void areas(token,"BLOCK",value.districtRef)
   .then(x=>{if(live)setBlocks(x)})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Blocks unavailable.")});
  return()=>{live=false};
 },[token,value.districtRef]);
 const set=<K extends keyof CenterDraft,>(field:K,v:CenterDraft[K])=>
  onChange({...value,[field]:v});
 const field=(name:string,content:string,update:(x:string)=>void,maxLength=180,
  locked=false)=><View style={styles.area} key={name}>
   <Text style={styles.note}>{name}</Text>
   <TextInput style={styles.input} value={content} onChangeText={update}
    accessibilityLabel={name} maxLength={maxLength} editable={!disabled&&!locked}/>
  </View>;
 const pick=(title:string,choices:{value:string;label:string}[],current:string,
  change:(id:string)=>void,locked=false)=><View style={styles.area}>
   <Text style={styles.note}>{title}</Text>
   <View style={styles.row}>{choices.map(x=><Pressable key={x.value||"none"}
    disabled={disabled||locked} accessibilityRole="button"
    accessibilityState={{selected:x.value===current,disabled:disabled||locked}}
    onPress={()=>change(x.value)} style={[styles.choice,
     x.value===current&&styles.chosen]}>
    <Text style={styles.text}>{x.value===current?"✓ ":""}{x.label}</Text>
   </Pressable>)}</View>
  </View>;
 const options=(x:Option[])=>x.map(o=>({value:o.value,label:o.label}));
 const updateHours=(i:number,delta:Partial<CenterDraft["hours"][number]>)=>
  set("hours",value.hours.map((x,j)=>i===j?{...x,...delta}:x));
 return <View style={styles.wrap}>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {field("Center code",value.centerCode,x=>set("centerCode",x.toUpperCase()),24,identityLocked)}
  {field("Center name",value.displayName,x=>set("displayName",x),160)}
  {pick("Healthcare facility type",types.map(x=>({value:x,label:label(x)})),
   value.centerType,x=>set("centerType",x),identityLocked)}
  {field("Address",value.addressLine,x=>set("addressLine",x),500)}
  {pick("State",options(states),value.stateRef,x=>
   onChange({...value,stateRef:x,districtRef:"",blockRef:null}),identityLocked)}
  {pick("District",options(districts),value.districtRef,x=>
   onChange({...value,districtRef:x,blockRef:null}),identityLocked||!value.stateRef)}
  {pick("Block (optional)",[{value:"",label:"Not specified"},...options(blocks)],
   value.blockRef??"",x=>set("blockRef",x||null),identityLocked||!value.districtRef)}
  {field("PIN code",value.pinCode,x=>set("pinCode",x.replace(/[^0-9]/g,"")),6)}
  {field("Time zone",value.timeZone,x=>set("timeZone",x),64)}
  {field("Public contact (optional)",value.publicPhone??"",
   x=>set("publicPhone",x||null),16)}
  {field("Latitude (optional)",value.latitude===null?"":String(value.latitude),
   x=>set("latitude",x.trim()===""?null:Number(x)),15)}
  {field("Longitude (optional)",value.longitude===null?"":String(value.longitude),
   x=>set("longitude",x.trim()===""?null:Number(x)),15)}
  {pick("Declared services",capabilities.map(x=>({value:x,label:label(x)})),
   "",x=>set("capabilities",value.capabilities.includes(x)?
    value.capabilities.filter(k=>k!==x):[...value.capabilities,x])}
  <Text style={styles.note}>Selected services: {
   value.capabilities.map(label).join(", ")||"None"}</Text>
  {value.capabilities.includes("DIAGNOSTICS")&&field(
   "Diagnostic license valid through (YYYY-MM-DD)",
   value.diagnosticLicenseValidThrough??"",
   x=>set("diagnosticLicenseValidThrough",x||null),10)}
  <Text style={styles.heading}>Operating hours</Text>
  {value.hours.map((h,i)=><View key={i} style={styles.hours}>
   <Text style={styles.note}>Operating period {i+1}</Text>
   {pick("Day",days.map((d,j)=>({value:String(j),label:d})),
    String(h.weekday),x=>updateHours(i,{weekday:Number(x)}))}
   {field("Opening time (HH:MM)",h.openLocal,x=>updateHours(i,{openLocal:x}),5)}
   {field("Closing time (HH:MM)",h.closeLocal,x=>updateHours(i,{closeLocal:x}),5)}
   {pick("Service",serviceTypes.map(x=>({value:x,label:label(x)})),
    h.serviceType,x=>updateHours(i,{serviceType:x}))}
   <Pressable accessibilityRole="button" disabled={disabled}
    onPress={()=>set("hours",value.hours.filter((_,j)=>j!==i))}
    style={styles.choice}><Text style={styles.text}>Remove this period</Text></Pressable>
  </View>)}
  <Pressable accessibilityRole="button" disabled={disabled||value.hours.length>=42}
   style={styles.choice}
   onPress={()=>set("hours",[...value.hours,{
    weekday:1,openLocal:"09:00",closeLocal:"17:00",serviceType:"GENERAL"}])}>
   <Text style={styles.text}>Add operating hours</Text>
  </Pressable>
  <Text style={styles.note}>Details stay pending until the original
   Foundation provider and center verification process is complete.</Text>
 </View>;
}
const styles=StyleSheet.create({
 wrap:{gap:10},area:{gap:5},heading:{fontSize:16,fontWeight:"700",color:t.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:6},
 choice:{borderColor:t.border,borderWidth:1,borderRadius:8,
  padding:9,minHeight:44,justifyContent:"center"},
 chosen:{backgroundColor:t.adminCanvas},
 text:{color:t.text,fontSize:12,fontWeight:"500"},
 input:{borderColor:t.border,borderWidth:1,borderRadius:8,
  backgroundColor:t.surface,color:t.text,padding:10,minHeight:45},
 note:{fontSize:13,color:t.mutedText},
 error:{fontSize:13,color:"#A52626"},
 hours:{borderWidth:1,borderColor:t.border,padding:10,borderRadius:10,gap:8}
});
