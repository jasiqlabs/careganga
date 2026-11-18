import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,AppState,Image,Linking,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";

const base=process.env.EXPO_PUBLIC_API_URL;
type Mode="centers"|"doctors";
type Fee={currency:string;amountMinor:number;kind:string;mode:string};
type Center={slug:string;centerName:string;providerName:string;type:string;
 address:string;pinCode:string;publicPhone:string|null;
 latitude:number|null;longitude:number|null};
type Doctor={doctorRef:string;doctorName:string;centerSlug:string;
 centerName:string;address:string;pinCode:string;fee:Fee|null;
 specialties:string[];qualifications:string[];experienceYears:number};
type Details={centerName:string;providerName:string;type:string;address:string;
 approvedPresentation:null|{description:string;services:string[];facilities:string[];
 hoursNote:string;publicEmail:string;faqs:{question:string;answer:string}[];
 media:{fileRef:string;altText:string}[]};
 pinCode:string;publicPhone:string|null;latitude:number|null;longitude:number|null;
 declaredServices:string[];hours:{weekday:number;opens:string;closes:string}[];
 timeZone:string;notice:string};
type DoctorDetails={doctorName:string;specialties:string[];qualifications:string[];
 experienceYears:number;bio:string;centers:Doctor[];notice:string};
type Selection={kind:"center";slug:string}|{kind:"doctor";ref:string};
type State={status:"LOADING"|"READY"|"ERROR";items:(Center|Doctor)[];
 next:string|null;details:Details|DoctorDetails|null};
const weekdays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const money=(minor:number)=>"₹"+(minor/100).toLocaleString("en-IN",{
 minimumFractionDigits:0,maximumFractionDigits:2});
const nice=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,s=>s.toUpperCase());
async function read(path:string):Promise<unknown>{
 if(!base||!/^https?:\/\//.test(base)||
   (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("The current healthcare directory is not configured.");
 const res=await fetch(new URL("/api/v1/public/health-network/"+path,base),{
  cache:"no-store",signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw Error(res.status===404?"This published profile is no longer available.":
  "Current verification could not be confirmed. Refresh to try again.");
 return res.json();
}
const label=(title:string,onPress:()=>void,active=false)=>(
 <Pressable accessibilityRole="button" accessibilityState={{selected:active}}
  onPress={onPress} style={[styles.button,active&&styles.selected]}>
  <Text style={styles.buttonLabel}>{title}</Text>
 </Pressable>);
export function PublicHealthcareDirectory({onExit}:{onExit:()=>void}){
 const [mode,setMode]=useState<Mode>("centers"),[search,setSearch]=useState("");
 const [pin,setPin]=useState(""),[specialty,setSpecialty]=useState("");
 const [category,setCategory]=useState(""),[minFee,setMinFee]=useState("");
 const [maxFee,setMaxFee]=useState(""),[cursor,setCursor]=useState("");
 const [selection,setSelection]=useState<Selection|null>(null);
 const [resetVersion,setResetVersion]=useState(0);
 const [state,setState]=useState<State>({status:"LOADING",items:[],next:null,details:null});
 const seq=useRef(0);
 const load=useCallback(async(nextCursor="",append=false)=>{
  const request=++seq.current;
  setState(s=>({...s,status:"LOADING",details:null}));
  try{
   const query=new URLSearchParams();
   if(search.trim())query.set("q",search.trim().slice(0,80));
   if(pin.trim())query.set("pin",pin.trim().slice(0,6));
   if(category)query.set("category",category);
   if(mode==="doctors"){
    if(specialty.trim())query.set("specialty",specialty.trim().slice(0,60));
    if(minFee)query.set("minFee",minFee);
    if(maxFee)query.set("maxFee",maxFee);
   }
   if(nextCursor)query.set("after",nextCursor);
   const raw=await read(mode+"?"+query.toString());
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid directory response");
   const r=raw as {items?:unknown;next?:unknown};
   if(!Array.isArray(r.items)||!r.items.every(x=>
    x!==null&&typeof x==="object"&&"centerName" in x&&
    (mode==="centers"?"slug" in x:"doctorRef" in x))||
    !(r.next===null||typeof r.next==="string"))
    throw Error("Unable to verify the latest directory response.");
   if(request!==seq.current)return;
   setCursor(nextCursor);
   setState(s=>({status:"READY",
    items:append?[...s.items,...r.items as (Center|Doctor)[]]:r.items as (Center|Doctor)[],
    next:r.next as string|null,details:null}));
  }catch(e){
   if(request!==seq.current)return;
   setState(s=>({...s,status:"ERROR",next:null,details:null}));
  }
 },[mode,search,pin,category,specialty,minFee,maxFee]);
 const show=useCallback(async(item:Selection)=>{
  const request=++seq.current;
  setSelection(item);
  setState(s=>({...s,status:"LOADING",details:null}));
  try{
   const path=item.kind==="center"?"centers/"+encodeURIComponent(item.slug):
     "doctors/"+encodeURIComponent(item.ref);
   const data=await read(path);
   if(!data||typeof data!=="object"||Array.isArray(data)||
     !(item.kind==="center"?"centerName" in data:"doctorName" in data))
    throw Error("The published record cannot be verified.");
   if(request===seq.current)setState(s=>({...s,status:"READY",
    details:data as Details|DoctorDetails}));
  }catch{
   if(request===seq.current)setState(s=>({...s,status:"ERROR",details:null}));
  }
 },[]);
 useEffect(()=>{void load();return()=>{seq.current++;};},[mode,resetVersion]); // Search is applied explicitly
 useEffect(()=>{
  const sub=AppState.addEventListener("change",status=>{
   if(status==="active"){
    if(selection)void show(selection);
    else void load();
   }
  });
  return()=>sub.remove();
 },[selection,show,load]);
 function reset(){
  seq.current++;setSelection(null);setSearch("");setPin("");setCategory("");
  setSpecialty("");setMinFee("");setMaxFee("");
  // Same mode means no dependency change; explicitly refresh defaults via next action.
  setState({status:"LOADING",items:[],next:null,details:null});
  setResetVersion(v=>v+1);
 }
 function back(){
  seq.current++;
  if(selection){setSelection(null);void load();}else onExit();
 }
 const centerDetails=selection?.kind==="center"?state.details as Details|null:null;
 const doctorDetails=selection?.kind==="doctor"?state.details as DoctorDetails|null:null;
 return <SafeAreaView style={styles.page}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   <View style={styles.headingRow}>{label("‹ Back",back)}
    <Text accessibilityRole="header" style={styles.heading}>Healthcare Network</Text></View>
   {!selection?<><Text style={styles.helper}>Search only current verified centers and doctors.
    This directory cannot confirm appointments or financial assistance.</Text>
    <View style={styles.row}>
     {label("Centers",()=>{setSelection(null);setMode("centers");},mode==="centers")}
     {label("Doctors",()=>{setSelection(null);setMode("doctors");},mode==="doctors")}
    </View>
    <Text style={styles.label}>Search name or qualification</Text>
    <TextInput accessibilityLabel="Search current verified directory" style={styles.input}
     value={search} onChangeText={setSearch} maxLength={80} placeholder="Name or qualification"/>
    <Text style={styles.label}>Area PIN code (optional)</Text>
    <TextInput accessibilityLabel="Filter by six-digit PIN" style={styles.input}
     value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6}
     placeholder="Six-digit PIN"/>
    <Text style={styles.label}>Center type</Text>
    <View style={styles.row}>
     {["","HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING","OTHER",
      "POLYCLINIC","DIAGNOSTIC_CENTER","DENTAL_CLINIC","MEDICAL_LABORATORY",
      "NURSING_HOME","ORTHOPEDIC_CLINIC","HOMEOPATHY_CLINIC","AYURVEDIC_CLINIC"]
      .map(v=><View key={v}>{label(v?nice(v):"All",()=>setCategory(v),category===v)}</View>)}
    </View>
    {mode==="doctors"&&<>
     <Text style={styles.label}>Specialty</Text>
     <TextInput accessibilityLabel="Filter doctors by specialty" style={styles.input}
      value={specialty} onChangeText={setSpecialty} maxLength={60}/>
     <Text style={styles.label}>Minimum consultation fee (₹)</Text>
     <TextInput accessibilityLabel="Minimum approved consultation fee" style={styles.input}
      keyboardType="number-pad" value={minFee} onChangeText={setMinFee} maxLength={7}/>
     <Text style={styles.label}>Maximum consultation fee (₹)</Text>
     <TextInput accessibilityLabel="Maximum approved consultation fee" style={styles.input}
      keyboardType="number-pad" value={maxFee} onChangeText={setMaxFee} maxLength={7}/>
    </>}
    <View style={styles.row}>
     {label("Apply filters",()=>void load())}
     {label("Reset",()=>reset())}
    </View>
    {state.status==="READY"&&state.items.length===0&&
     <Text accessibilityLiveRegion="polite">No currently verified listings match the filters.</Text>}
    {state.items.map((item,i)=>mode==="centers"?
     <View key={"c-"+(item as Center).slug+"-"+i} style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{item.centerName}</Text>
      <Text>{nice((item as Center).type)} · {(item as Center).address}, {item.pinCode}</Text>
      {label("View verified center",()=>void show({
       kind:"center",slug:(item as Center).slug}))}
     </View>:
     <View key={"d-"+(item as Doctor).doctorRef+"-"+(item as Doctor).centerSlug+"-"+i}
      style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{(item as Doctor).doctorName}</Text>
      <Text>{item.centerName} · {(item as Doctor).specialties.join(", ")}</Text>
      <Text>{(item as Doctor).fee?"Approved consultation: "+money((item as Doctor).fee!.amountMinor):
        "No current consultation fee published"}</Text>
      {label("View doctor",()=>void show({kind:"doctor",ref:(item as Doctor).doctorRef}))}
     </View>)}
    {state.status==="READY"&&state.next&&
     label("More verified results",()=>void load(state.next!,true))}
   </>:centerDetails?<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.cardTitle}>{centerDetails.centerName}</Text>
    <Text>{centerDetails.providerName} · {nice(centerDetails.type)}</Text>
    <Text>{centerDetails.address}, {centerDetails.pinCode}</Text>
    {!!centerDetails.publicPhone&&label("Call center",()=>void Linking.openURL(
      "tel:"+centerDetails.publicPhone))}
    {centerDetails.latitude!==null&&centerDetails.longitude!==null&&
     label("View directions",()=>void Linking.openURL(
      "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(
       centerDetails.latitude+","+centerDetails.longitude)))}
    {centerDetails.approvedPresentation&&<>
     <Text style={styles.cardTitle}>About this center</Text>
     <Text>{centerDetails.approvedPresentation.description}</Text>
     {!!base&&selection?.kind==="center"&&centerDetails.approvedPresentation.media.map(m=>
      <View key={m.fileRef} style={styles.subcard}>
       <Image accessibilityLabel={m.altText} style={styles.photo}
        source={{uri:new URL("/api/documents/health-center-content/public/"+
         encodeURIComponent(selection.slug)+"/"+encodeURIComponent(m.fileRef),base).toString()}}/>
       <Text>{m.altText}</Text>
      </View>)}
     <Text style={styles.cardTitle}>Approved services</Text>
     {centerDetails.approvedPresentation.services.map((v,i)=><Text key={i}>• {v}</Text>)}
     <Text style={styles.cardTitle}>Facilities</Text>
     {centerDetails.approvedPresentation.facilities.map((v,i)=><Text key={i}>• {v}</Text>)}
     {!!centerDetails.approvedPresentation.hoursNote&&
      <Text>Hours note: {centerDetails.approvedPresentation.hoursNote}</Text>}
     {!!centerDetails.approvedPresentation.publicEmail&&
      label("Email this center",()=>void Linking.openURL(
       "mailto:"+centerDetails.approvedPresentation!.publicEmail))}
     {centerDetails.approvedPresentation.faqs.length>0&&
      <Text style={styles.cardTitle}>Center questions</Text>}
     {centerDetails.approvedPresentation.faqs.map((f,i)=><View key={i}>
      <Text style={styles.label}>{f.question}</Text><Text>{f.answer}</Text>
     </View>)}
    </>}
    <Text style={styles.cardTitle}>Declared services</Text>
    {centerDetails.declaredServices.map(s=><Text key={s}>• {nice(s)}</Text>)}
    <Text style={styles.cardTitle}>Working hours</Text>
    {centerDetails.hours.map((h,i)=><Text key={i}>
     {weekdays[h.weekday]}: {h.opens}–{h.closes}</Text>)}
    <Text style={styles.helper}>{centerDetails.notice}</Text>
   </View>:doctorDetails?<View style={styles.card}>
    <Text accessibilityRole="header" style={styles.cardTitle}>{doctorDetails.doctorName}</Text>
    <Text>Qualifications: {doctorDetails.qualifications.join(", ")||"Not listed"}</Text>
    <Text>Specialties: {doctorDetails.specialties.join(", ")||"Not listed"}</Text>
    <Text>Experience: {doctorDetails.experienceYears} years</Text>
    {!!doctorDetails.bio&&<Text>{doctorDetails.bio}</Text>}
    <Text style={styles.cardTitle}>Verified centers</Text>
    {doctorDetails.centers.map(c=><View key={c.centerSlug} style={styles.subcard}>
     <Text style={styles.cardTitle}>{c.centerName}</Text>
     <Text>{c.address}, {c.pinCode}</Text>
     <Text>{c.fee?"Current approved consultation: "+money(c.fee.amountMinor):
      "No current approved consultation fee"}</Text>
     {label("View center",()=>void show({kind:"center",slug:c.centerSlug}))}
    </View>)}
    <Text style={styles.helper}>{doctorDetails.notice}</Text>
   </View>:null}
   {state.status==="LOADING"&&<ActivityIndicator accessibilityLabel="Checking current verified listings"/>}
   {state.status==="ERROR"&&<View style={styles.card}>
    <Text accessibilityRole="alert">Current publication cannot be verified.
     Results may have changed; no saved details are shown.</Text>
    {label("Recheck now",()=>selection?void show(selection):void load(cursor))}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:theme.background},
 content:{padding:20,gap:12,width:"100%",maxWidth:720,alignSelf:"center"},
 headingRow:{flexDirection:"row",alignItems:"center",gap:12,flexWrap:"wrap"},
 heading:{fontSize:23,fontWeight:"700",color:theme.sidebar,flexShrink:1},
 helper:{fontSize:13,lineHeight:20,color:theme.mutedText},
 label:{fontSize:14,fontWeight:"600",color:theme.text},
 input:{minHeight:48,padding:12,borderWidth:1,borderColor:theme.border,
  backgroundColor:theme.surface,borderRadius:8,color:theme.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8,alignItems:"center"},
 button:{minHeight:48,minWidth:72,borderWidth:1,borderColor:theme.border,
  borderRadius:8,paddingHorizontal:12,paddingVertical:10,justifyContent:"center"},
 selected:{backgroundColor:theme.surface,borderColor:theme.primary},
 buttonLabel:{color:theme.text,fontWeight:"600"},
 card:{backgroundColor:theme.surface,borderRadius:12,borderWidth:1,
  borderColor:theme.border,padding:16,gap:10},
 subcard:{borderTopWidth:1,borderColor:theme.border,paddingTop:12,gap:6},
 cardTitle:{fontSize:18,fontWeight:"700",color:theme.text},
 photo:{width:"100%",height:220,borderRadius:10}
});
