import {useCallback,useEffect,useRef,useState} from "react";
import {
 ActivityIndicator,AppState,BackHandler,Image,Linking,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaPublicTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {DoctorSchedulePreview} from "./doctor-schedule-preview";
import {PublicLabOfferDirectory,hasCurrentLabOffers} from "./public-lab-offer-directory";
import {NativeApprovedConsultationBenefits} from "./native-approved-consultation-benefits";
import {NativePublicPartnerOffers} from "./native-public-partner-offers";

const base=process.env.EXPO_PUBLIC_API_URL;
type Mode="centers"|"doctors";
type Fee={currency:string;amountMinor:number;kind:string;mode:string};
type Center={slug:string;centerName:string;providerName:string;type:string;
 address:string;pinCode:string;publicPhone:string|null;
 latitude:number|null;longitude:number|null;declaredServices:string[];photo:{fileRef:string;altText:string}|null};
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
type Selection={kind:"center";slug:string}|{kind:"doctor";ref:string;centerSlug?:string};
type Area={value:string;label:string;level:"STATE"|"DISTRICT"|"BLOCK";
 parentRef:string|null};
type State={status:"LOADING"|"READY"|"ERROR";items:(Center|Doctor)[];
 next:string|null;details:Details|DoctorDetails|null};
const weekdays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const money=(minor:number)=>"₹"+(minor/100).toLocaleString("en-IN",{
 minimumFractionDigits:0,maximumFractionDigits:2});
const nice=(x:string)=>x.replaceAll("_"," ").toLowerCase()
 .replace(/\b\w/g,s=>s.toUpperCase());
const validCoordinates=(lat:unknown,lng:unknown)=>typeof lat==="number"&&Number.isFinite(lat)&&
 Math.abs(lat)<=90&&typeof lng==="number"&&Number.isFinite(lng)&&Math.abs(lng)<=180;
const stringList=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==="string");
function validListing(x:unknown,mode:Mode):boolean{
 if(!x||typeof x!=="object")return false;
 const v=x as Partial<Center & Doctor>;
 if(typeof v.centerName!=="string"||typeof v.address!=="string"||typeof v.pinCode!=="string")return false;
 if(mode==="centers")return typeof v.slug==="string"&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(v.slug)&&typeof v.providerName==="string"&&typeof v.type==="string"&&stringList(v.declaredServices)&&
  (v.photo===null||!!v.photo&&typeof v.photo.fileRef==="string"&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v.photo.fileRef)&&typeof v.photo.altText==="string");
 return typeof v.doctorRef==="string"&&typeof v.doctorName==="string"&&typeof v.centerSlug==="string"&&
  stringList(v.specialties)&&stringList(v.qualifications)&&Number.isInteger(v.experienceYears)&&
  (v.fee===null||!!v.fee&&Number.isSafeInteger(v.fee.amountMinor)&&v.fee.amountMinor>=0);
}
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
export function PublicHealthcareDirectory({onExit,reschedule}:{onExit:()=>void;
 reschedule?:{bookingRef:string;expectedVersion:number}}){
 const [mode,setMode]=useState<Mode>(reschedule?"doctors":"centers"),[search,setSearch]=useState("");
 const [labMenu,setLabMenu]=useState(false),[labCenterSlug,setLabCenterSlug]=useState("");
 const [linkNotice,setLinkNotice]=useState("");
 const [hasCenterLabOffer,setHasCenterLabOffer]=useState(false);
 const [centerDoctors,setCenterDoctors]=useState<{slug:string;items:Doctor[];failed:boolean}|null>(null);
 const [pin,setPin]=useState(""),[specialty,setSpecialty]=useState("");
 const [category,setCategory]=useState(""),[facility,setFacility]=useState("");
 const [service,setService]=useState(""),[day,setDay]=useState("");
 const [minExperience,setMinExperience]=useState(""),[maxExperience,setMaxExperience]=useState("");
 const [minFee,setMinFee]=useState("");
 const [maxFee,setMaxFee]=useState("");
 const [selection,setSelection]=useState<Selection|null>(null);
 const [areas,setAreas]=useState<Area[]>([]);
 const [areaQuery,setAreaQuery]=useState("");
 const [region,setRegion]=useState<{state:Area|null;district:Area|null;block:Area|null}>({
  state:null,district:null,block:null
 });
 const [resetVersion,setResetVersion]=useState(0);
 const [filtersExpanded,setFiltersExpanded]=useState(false);
 const [state,setState]=useState<State>({status:"LOADING",items:[],next:null,details:null});
 const seq=useRef(0);
 const applied=useRef<{mode:Mode;query:string}|null>(null);
 const selectionRef=useRef<Selection|null>(null);
 const detailHistory=useRef<Selection[]>([]);
 const load=useCallback(async(nextCursor="",append=false,reuseApplied=false,categoryOverride?:string)=>{
  const request=++seq.current;
  setState(s=>({...s,status:"LOADING",items:append?s.items:[],next:null,details:null}));
  try{
   let query=new URLSearchParams();
   if(search.trim())query.set("q",search.trim().slice(0,80));
   if(pin.trim())query.set("pin",pin.trim().slice(0,6));
   if(region.state)query.set("state",region.state.value);
   if(region.district)query.set("district",region.district.value);
   if(region.block)query.set("block",region.block.value);
   const activeCategory=categoryOverride??category;
   if(activeCategory)query.set("category",activeCategory);
   if(service)query.set("service",service);
   if(day)query.set("day",day);
   if(facility.trim())query.set("facility",facility.trim().slice(0,80));
   if(mode==="doctors"){
    if(specialty.trim())query.set("specialty",specialty.trim().slice(0,60));
    if(minExperience)query.set("minExperience",minExperience);
    if(maxExperience)query.set("maxExperience",maxExperience);
    if(minFee)query.set("minFee",minFee);
    if(maxFee)query.set("maxFee",maxFee);
   }
   if((append||reuseApplied)&&applied.current?.mode===mode)
    query=new URLSearchParams(applied.current.query);
   else applied.current={mode,query:query.toString()};
   if(nextCursor)query.set("after",nextCursor);
   const raw=await read(mode+"?"+query.toString());
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid directory response");
   const r=raw as {items?:unknown;next?:unknown};
   if(!Array.isArray(r.items)||!r.items.every(x=>validListing(x,mode))||
    !(r.next===null||typeof r.next==="string"))
    throw Error("Unable to verify the latest directory response.");
   if(request!==seq.current)return;
   setState(s=>({status:"READY",
    items:append?[...s.items,...r.items as (Center|Doctor)[]]:r.items as (Center|Doctor)[],
    next:r.next as string|null,details:null}));
  }catch(e){
   if(request!==seq.current)return;
   setState({status:"ERROR",items:[],next:null,details:null});
  }
 },[mode,search,pin,category,facility,service,day,specialty,minFee,maxFee,
  minExperience,maxExperience,region]);
 const show=useCallback(async(item:Selection,pushHistory=true)=>{
  const previous=selectionRef.current;
  if(pushHistory&&previous&&
     (previous.kind!==item.kind||
      (previous.kind==="center"?previous.slug:
        previous.ref+":"+(previous.centerSlug??""))!==(item.kind==="center"?item.slug:item.ref+":"+(item.centerSlug??""))))
   detailHistory.current.push(previous);
  selectionRef.current=item;
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
  let alive=true;
  void read("facets").then(raw=>{
   if(!alive||!raw||typeof raw!=="object"||!("areas" in raw)||
    !Array.isArray(raw.areas))return;
   setAreas(raw.areas.filter((a:unknown):a is Area=>
    !!a&&typeof a==="object"&&"value" in a&&"label" in a&&"level" in a&&
    typeof a.value==="string"&&/^[a-f0-9-]{36}$/i.test(a.value)&&
    typeof a.label==="string"&&typeof a.level==="string"&&
    ["STATE","DISTRICT","BLOCK"].includes(a.level)).slice(0,500));
  }).catch(()=>{});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  const sub=AppState.addEventListener("change",status=>{
   if(status==="active"){
    if(selection)void show(selection,false);
    else void load("",false,true);
   }
  });
  return()=>sub.remove();
 },[selection,show,load]);
 function reset(){
  seq.current++;selectionRef.current=null;detailHistory.current=[];
  setFiltersExpanded(false);setSelection(null);setSearch("");setPin("");setCategory("");
  setFacility("");setService("");setDay("");
  setMinExperience("");setMaxExperience("");
  setRegion({state:null,district:null,block:null});setAreaQuery("");
  setSpecialty("");setMinFee("");setMaxFee("");
  // Same mode means no dependency change; explicitly refresh defaults via next action.
  setState({status:"LOADING",items:[],next:null,details:null});
  setResetVersion(v=>v+1);
 }
 function back(){
  if(labMenu){setLabMenu(false);return;}
  seq.current++;
  const previous=detailHistory.current.pop();
  if(selection&&previous){
   // Refresh the previous live verified detail, not stale cached doctor fees.
   void show(previous,false);
  }else if(selection){
   selectionRef.current=null;setSelection(null);void load("",false,true);
  }else{
   selectionRef.current=null;detailHistory.current=[];onExit();
  }
 }
 useEffect(()=>{
  const listener=BackHandler.addEventListener("hardwareBackPress",()=>{
   back();return true;
  });
  return()=>listener.remove();
 },[selection,load,show,onExit,labMenu]);
 useEffect(()=>{
  let active=true;
  setHasCenterLabOffer(false);setCenterDoctors(null);
  if(selection?.kind==="center"&&state.details){
   const slug=selection.slug;
   void read("doctors?"+new URLSearchParams({center:slug}).toString()).then(raw=>{const v=raw as {items?:unknown};if(!v||!Array.isArray(v.items)||!v.items.every(x=>validListing(x,"doctors")&&(x as Doctor).centerSlug===slug))throw Error("Unavailable");if(active)setCenterDoctors({slug,items:v.items.slice(0,20) as Doctor[],failed:false});}).catch(()=>{if(active)setCenterDoctors({slug,items:[],failed:true});});
   void hasCurrentLabOffers(selection.slug).then(v=>{
    if(active)setHasCenterLabOffer(v);
   });
  }
  return()=>{active=false;};
 },[selection,state.details]);
 if(labMenu)return <PublicLabOfferDirectory key={labCenterSlug||"all"}
   initialCenterSlug={labCenterSlug} onExit={()=>setLabMenu(false)}/>;
 const openDirections=(lat:unknown,lng:unknown)=>{
  if(!validCoordinates(lat,lng))return;
  void Linking.openURL("https://www.google.com/maps/search/?api=1&query="+
   encodeURIComponent(lat+","+lng)).catch(()=>{setLinkNotice("Directions could not open. Use the center address instead.");});
 };
 const centerDetails=selection?.kind==="center"?state.details as Details|null:null;
 const doctorDetails=selection?.kind==="doctor"?state.details as DoctorDetails|null:null;
 return <SafeAreaView style={styles.page}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   <View style={styles.headingRow}>{label("‹ Back",back)}
    <Text accessibilityRole="header" style={styles.heading}>Healthcare Network</Text></View>
   {!!linkNotice&&<Text accessibilityRole="alert" onPress={()=>setLinkNotice("")}>{linkNotice}</Text>}
   {!selection?<><View style={styles.hero}><Text style={styles.heroTitle}>Healthcare assistance</Text><Text style={styles.heroText}>Find verified doctors and partner centers.</Text></View><Text style={styles.helper}>Search only current verified centers and doctors.
    Check appointment times before booking. Assistance is confirmed separately.</Text>
    <View style={styles.row}>
     {!reschedule&&label("Centers",()=>{if(mode!=="centers"){seq.current++;setState({status:"LOADING",items:[],next:null,details:null});setMode("centers");}},mode==="centers")}
     {label("Doctors",()=>{if(mode!=="doctors"){seq.current++;setState({status:"LOADING",items:[],next:null,details:null});setMode("doctors");}},mode==="doctors")}
     {!reschedule&&label("Lab tests & prices",()=>{
      setLabCenterSlug("");setLabMenu(true);})}
    </View>
    {mode==="centers"&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{["","POLYCLINIC","DIAGNOSTIC_CENTER","DENTAL_CLINIC","MEDICAL_LABORATORY","HOSPITAL","NURSING_HOME","PHARMACY","ORTHOPEDIC_CLINIC","HOMEOPATHY_CLINIC","AYURVEDIC_CLINIC"].map(v=><View key={v||"all"}>{label(v?nice(v):"All centers",()=>{setCategory(v);void load("",false,false,v);},category===v)}</View>)}</ScrollView>}
    <Text style={styles.label}>Search name or qualification</Text>
    <TextInput accessibilityLabel="Search current verified directory" style={styles.input}
     value={search} onChangeText={setSearch} maxLength={80} placeholder="Name or qualification"/>
    {label(filtersExpanded?"Hide additional filters":"Additional filters",()=>{
      setFiltersExpanded(v=>!v);
    },filtersExpanded)}
    {filtersExpanded&&<>
     <Text style={styles.helper}>Choose any optional filters, then Apply filters.
      State, district and block must match the same area.</Text>
    <Text style={styles.label}>Area PIN code (optional)</Text>
    <TextInput accessibilityLabel="Filter by six-digit PIN" style={styles.input}
     value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6}
     placeholder="Six-digit PIN"/>
    {areas.length>0&&<>
     <Text style={styles.label}>State, district or block (optional)</Text>
     <Text style={styles.helper}>
      {region.state?.label||"All states"} · {region.district?.label||"All districts"} ·
      {region.block?.label||"All blocks"}
     </Text>
     <TextInput accessibilityLabel="Find a state district or block"
      value={areaQuery} onChangeText={setAreaQuery} maxLength={60}
      style={styles.input} placeholder="Type an area name, then select below"/>
     {areaQuery.trim().length>=2&&areas.filter(a=>
      a.label.toLowerCase().includes(areaQuery.trim().toLowerCase())&&
      (a.level==="STATE"||a.level==="DISTRICT"&&
       !!region.state&&a.parentRef===region.state.value||
       a.level==="BLOCK"&&!!region.district&&a.parentRef===region.district.value))
      .slice(0,8).map(a=><View key={a.value}>
       {label(a.label+" ("+nice(a.level)+")",()=>{
        setRegion(s=>a.level==="STATE"?{state:a,district:null,block:null}:
         a.level==="DISTRICT"?{state:s.state,district:a,block:null}:
         {...s,block:a});
        setAreaQuery("");
       })}
      </View>)}
     {label("Clear area",()=>{setRegion({state:null,district:null,block:null});
       setAreaQuery("");})}
    </>}
    <Text style={styles.label}>Center type</Text>
    <View style={styles.row}>
     {["","HOSPITAL","CLINIC","DIAGNOSTIC_LAB","PHARMACY","NURSING","OTHER",
      "POLYCLINIC","DIAGNOSTIC_CENTER","DENTAL_CLINIC","MEDICAL_LABORATORY",
      "NURSING_HOME","ORTHOPEDIC_CLINIC","HOMEOPATHY_CLINIC","AYURVEDIC_CLINIC"]
      .map(v=><View key={v}>{label(v?nice(v):"All",()=>setCategory(v),category===v)}</View>)}
    </View>
    <Text style={styles.label}>Recorded center services</Text>
    <View style={styles.row}>
     {["","CONSULTATION","DIAGNOSTICS","PHARMACY","NURSING","SURGERY","EMERGENCY"]
      .map(v=><View key={v}>{label(v?nice(v):"All services",
       ()=>setService(v),service===v)}</View>)}
    </View>
    <Text style={styles.label}>Working weekday (not live availability)</Text>
    <View style={styles.row}>
     {["","0","1","2","3","4","5","6"].map(v=><View key={v}>
      {label(v?weekdays[Number(v)]:"Any day",()=>setDay(v),day===v)}
     </View>)}
    </View>
    <Text style={styles.label}>Available facilities</Text>
    <TextInput accessibilityLabel="Filter by approved center facilities"
     value={facility} onChangeText={setFacility} maxLength={80}
     style={styles.input} placeholder="e.g. Wheelchair access"/>
    {mode==="doctors"&&<>
     <Text style={styles.label}>Specialty</Text>
     <TextInput accessibilityLabel="Filter doctors by specialty" style={styles.input}
      value={specialty} onChangeText={setSpecialty} maxLength={60}/>
     <Text style={styles.label}>Minimum years of experience</Text>
     <TextInput accessibilityLabel="Minimum years of experience"
      style={styles.input} keyboardType="number-pad" value={minExperience}
      onChangeText={setMinExperience} maxLength={2}/>
     <Text style={styles.label}>Maximum years of experience</Text>
     <TextInput accessibilityLabel="Maximum years of experience"
      style={styles.input} keyboardType="number-pad" value={maxExperience}
      onChangeText={setMaxExperience} maxLength={2}/>
     <Text style={styles.label}>Minimum consultation fee (₹)</Text>
     <TextInput accessibilityLabel="Minimum approved consultation fee" style={styles.input}
      keyboardType="number-pad" value={minFee} onChangeText={setMinFee} maxLength={7}/>
     <Text style={styles.label}>Maximum consultation fee (₹)</Text>
     <TextInput accessibilityLabel="Maximum approved consultation fee" style={styles.input}
      keyboardType="number-pad" value={maxFee} onChangeText={setMaxFee} maxLength={7}/>
    </>}
    </>}
    <View style={styles.row}>
     {label("Search / apply filters",()=>{setFiltersExpanded(false);void load();})}
     {label("Reset",()=>reset())}
    </View>
    {state.status==="READY"&&state.items.length===0&&
     <Text accessibilityLiveRegion="polite">No currently verified listings match the filters.</Text>}
    {state.status==="READY"&&state.items.map((item,i)=>mode==="centers"?
     <View key={"c-"+(item as Center).slug+"-"+i} style={styles.card}>
      {!!base&&(item as Center).photo&&<Image accessibilityLabel={(item as Center).photo!.altText} style={styles.listPhoto} source={{uri:new URL("/api/documents/health-center-content/public/"+encodeURIComponent((item as Center).slug)+"/"+encodeURIComponent((item as Center).photo!.fileRef),base).toString()}}/>}
       <Text accessibilityRole="header" style={styles.cardTitle}>{item.centerName}</Text>
      <Text style={styles.helper}>Verified center · {nice((item as Center).type)}</Text>
      <Text style={styles.label}>{(item as Center).providerName}</Text>
       {!!(item as Center).declaredServices.length&&<View style={styles.row}>{(item as Center).declaredServices.map(s=><Text key={s} style={styles.tag}>{nice(s)}</Text>)}</View>
      <Text>{item.address}, {item.pinCode}</Text>
      <View style={styles.row}>
       {label("View center details",()=>void show({kind:"center",slug:(item as Center).slug}))}
       {validCoordinates((item as Center).latitude,(item as Center).longitude)&&
        label("Directions",()=>openDirections((item as Center).latitude,(item as Center).longitude))}
      </View>
     </View>:
     <View key={"d-"+(item as Doctor).doctorRef+"-"+(item as Doctor).centerSlug+"-"+i}
      style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{(item as Doctor).doctorName}</Text>
      <Text style={styles.helper}>Verified doctor · {item.centerName}</Text>
      <Text>{(item as Doctor).specialties.join(", ")||"Specialty not listed"}</Text>
      {(item as Doctor).qualifications.length>0&&<Text>{(item as Doctor).qualifications.join(", ")}</Text>}
      {Number.isInteger((item as Doctor).experienceYears)&&(item as Doctor).experienceYears>=0&&
       <Text>{(item as Doctor).experienceYears} {(item as Doctor).experienceYears===1?"year":"years"} of experience</Text>}
      <Text>{item.address}, {item.pinCode}</Text>
      <Text style={styles.label}>{(item as Doctor).fee?money((item as Doctor).fee!.amountMinor)+" · In-person consultation":
        "Fee not listed"}</Text>
      {label(reschedule?"Choose a new time":(item as Doctor).fee?"View profile & check times":"View doctor profile",
       ()=>void show({kind:"doctor",ref:(item as Doctor).doctorRef,centerSlug:(item as Doctor).centerSlug}))}
     </View>)}
    {state.status==="READY"&&state.next&&
     label("More verified results",()=>void load(state.next!,true))}
   </>:centerDetails?<View style={styles.card}>
    {!!base&&selection?.kind==="center"&&centerDetails.approvedPresentation?.media[0]&&<Image accessibilityLabel={centerDetails.approvedPresentation.media[0].altText} style={styles.photo} source={{uri:new URL("/api/documents/health-center-content/public/"+encodeURIComponent(selection.slug)+"/"+encodeURIComponent(centerDetails.approvedPresentation.media[0].fileRef),base).toString()}}/>}
    <Text accessibilityRole="header" style={styles.cardTitle}>{centerDetails.centerName}</Text>
    <Text>{centerDetails.providerName} · {nice(centerDetails.type)}</Text>
    <Text>{centerDetails.address}, {centerDetails.pinCode}</Text>
    {hasCenterLabOffer&&selection?.kind==="center"&&<>
     {label("View this lab's approved test prices",()=>{
      setLabCenterSlug(selection.slug);setLabMenu(true);
     })}
     {centerDetails.publicPhone&&label("Enquire about tests by phone",()=>void Linking.openURL(
      "tel:"+centerDetails.publicPhone))}
     <Text style={styles.helper}>Partner commercial prices only. Contact does not
      create a lab order, collect payment or confirm a booking.</Text>
    </>}
    {!!centerDetails.publicPhone&&label("Call center",()=>void Linking.openURL(
      "tel:"+centerDetails.publicPhone))}
    {validCoordinates(centerDetails.latitude,centerDetails.longitude)&&
     label("View directions",()=>openDirections(centerDetails.latitude,centerDetails.longitude))}
    {centerDetails.approvedPresentation&&<>
     <Text style={styles.cardTitle}>About this center</Text>
     <Text>{centerDetails.approvedPresentation.description}</Text>
     {!!base&&selection?.kind==="center"&&centerDetails.approvedPresentation.media.slice(1).map(m=>
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
    {selection?.kind==="center"&&centerDoctors?.slug===selection.slug&&<View style={styles.subcard}><Text accessibilityRole="header" style={styles.cardTitle}>Verified doctors at this center</Text>{centerDoctors.failed?<Text style={styles.helper}>Doctor listings could not be checked.</Text>:centerDoctors.items.length===0?<Text style={styles.helper}>No current verified doctor listing.</Text>:centerDoctors.items.map(d=><View key={d.doctorRef} style={styles.subcard}><Text style={styles.label}>{d.doctorName}</Text><Text>{d.specialties.join(", ")}</Text><Text>{d.fee?money(d.fee.amountMinor):"Fee not listed"}</Text>{label("View doctor & check times",()=>void show({kind:"doctor",ref:d.doctorRef,centerSlug:d.centerSlug}))}</View>)}</View>}
    {selection?.kind==="center"&&
     <NativePublicPartnerOffers key={"partner-offers:"+selection.slug}
      centerSlug={selection.slug}/>}
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
    {selection?.kind==="doctor"&&
     <NativeApprovedConsultationBenefits key={"benefit:"+selection.ref}
      doctorRef={selection.ref}/>}
    {selection?.kind==="doctor"&&
     <DoctorSchedulePreview key={selection.ref+":"+(selection.centerSlug??"")} doctorRef={selection.ref}
      preferredCenterSlug={selection.centerSlug} reschedule={reschedule}/>}
   </View>:null}
   {state.status==="LOADING"&&<ActivityIndicator accessibilityLabel="Checking current verified listings"/>}
   {state.status==="ERROR"&&<View style={styles.card}>
    <Text accessibilityRole="alert">Current publication cannot be verified.
     Results may have changed; no saved details are shown.</Text>
    {label("Recheck now",()=>selection?void show(selection,false):void load("",false,true))}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:theme.background},
 content:{padding:18,paddingBottom:48,gap:14,width:"100%",maxWidth:720,alignSelf:"center"},
 headingRow:{flexDirection:"row",alignItems:"center",gap:12,flexWrap:"wrap"},
 heading:{fontSize:24,fontWeight:"800",color:theme.sidebar,flexShrink:1},
 helper:{fontSize:13,lineHeight:20,color:theme.mutedText},
 label:{fontSize:14,fontWeight:"600",color:theme.text},
 input:{minHeight:48,padding:12,borderWidth:1,borderColor:theme.border,
  backgroundColor:theme.surface,borderRadius:10,color:theme.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8,alignItems:"center"},
 button:{minHeight:48,minWidth:72,borderWidth:1,borderColor:theme.border,
  borderRadius:10,paddingHorizontal:12,paddingVertical:10,justifyContent:"center"},
 selected:{backgroundColor:theme.selectedSurface,borderColor:theme.primary},
 hero:{backgroundColor:theme.primary,borderRadius:14,padding:18,gap:8},heroTitle:{color:theme.primaryText,fontSize:22,fontWeight:"800"},heroText:{color:theme.primaryText,fontSize:14,lineHeight:20},categoryRow:{gap:8,paddingVertical:4},
 buttonLabel:{color:theme.text,fontWeight:"600"},
 card:{backgroundColor:theme.surface,borderRadius:16,borderWidth:1,
  borderColor:theme.border,padding:18,gap:12},
 subcard:{borderTopWidth:1,borderColor:theme.border,paddingTop:12,gap:6},
 cardTitle:{fontSize:18,fontWeight:"700",color:theme.text},
 listPhoto:{width:"100%",height:150,borderRadius:10,backgroundColor:theme.selectedSurface},
 tag:{paddingHorizontal:9,paddingVertical:5,borderRadius:8,backgroundColor:theme.selectedSurface,color:theme.text,fontSize:12},
 photo:{width:"100%",height:220,borderRadius:10}
});
