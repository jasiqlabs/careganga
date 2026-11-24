import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaPublicTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {NativeConsultationAction} from "../appointments/native-consultation-action";

const base=process.env.EXPO_PUBLIC_API_URL;
// Keep bounds aligned with CG15 doctor-availability.service.ts.
const MAX_CENTERS=40,MAX_SLOTS=144;
type Center={centerRef:string;centerName:string;centerSlug:string;timeZone:string;
 hasWorkingSchedule:boolean;consultationFeeMinor:string|null;consultationFeeVersion:number|null};
type Options={day:string;doctorName:string;centers:Center[];bookingEnabled:boolean;
 status:string;message:string};
type Slot={startAt:string;endAt:string;startLocal:string;endLocal:string;
 bookable:boolean};
type Detail={status:string;day:string;centerName:string;timeZone:string;slots:Slot[];
 bookingEnabled:boolean;message:string;consultationFeeMinor:string|null;
 consultationFeeVersion:number|null;doctorName:string;centerRef:string};
type Match={centerRef:string;centerName:string;centerSlug:string;timeZone:string;
 startAt:string;endAt:string;bookable:boolean;consultationFeeVersion:number|null;
 address:string;pinCode:string;consultationFeeMinor:string|null};
type Choices={day:string;time:string;centerChoices:Match[];message:string;bookingEnabled:boolean};
const dateAt=(offset:number)=>{
 const now=new Date();
 const value=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
 return String(value.getFullYear())+"-"+
  String(value.getMonth()+1).padStart(2,"0")+"-"+
  String(value.getDate()).padStart(2,"0");
};
async function get<T>(path:string):Promise<T>{
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Current healthcare schedules are not configured.");
 const response=await fetch(new URL("/api/v1/appointments/public/"+path,base),{
  cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!response.ok)
  throw Error(response.status===404?
   "This doctor's verified schedule is unavailable.":
   "Current working hours could not be confirmed. Try again.");
 return await response.json() as T;
}
const money=(minor:string|null)=>minor!==null&&/^\d+$/.test(minor)?
 "₹"+(Number(minor)/100).toLocaleString("en-IN",{maximumFractionDigits:2}):
 "Fee not confirmed";
export function DoctorSchedulePreview({doctorRef,reschedule,preferredCenterSlug}:{doctorRef:string;preferredCenterSlug?:string;
 reschedule?:{bookingRef:string;expectedVersion:number}}){
 const [week,setWeek]=useState(0),[day,setDay]=useState(dateAt(0));
 const [options,setOptions]=useState<Options|null>(null);
 const [center,setCenter]=useState<Center|null>(null);
 const [detail,setDetail]=useState<Detail|null>(null);
 const [choices,setChoices]=useState<Choices|null>(null);
 const [searchTime,setSearchTime]=useState(""),[timeInput,setTimeInput]=useState("");
 const [refresh,setRefresh]=useState(0);
 const [selectionLocked,setSelectionLocked]=useState(false);
 const [chosen,setChosen]=useState<{centerRef:string;centerName:string;doctorName:string;startAt:string;endAt:string;timeZone:string;feeMinor:string;feeVersion:number}|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const sequence=useRef(0);
 const days=useMemo(()=>Array.from({length:7},(_,i)=>week*7+i)
  .filter(offset=>offset<=30).map(offset=>({offset,date:dateAt(offset)})),[week]);
 useEffect(()=>{
  const id=++sequence.current;
  setCenter(null);setDetail(null);setChoices(null);setSearchTime("");setChosen(null);
  setOptions(null);setError("");setLoading(true);
  void get<Options>("doctor/"+encodeURIComponent(doctorRef)+
   "/center-options?date="+encodeURIComponent(day))
   .then(result=>{if(id===sequence.current){
    if(result.day!==day||!Array.isArray(result.centers)||result.centers.length>MAX_CENTERS)throw Error("The current center list could not be verified.");
    setOptions(result);setLoading(false);
   }})
   .catch(e=>{if(id===sequence.current){setError(e instanceof Error?
     e.message:"Working hours could not be checked.");setLoading(false);}});
  return()=>{sequence.current++;};
 },[doctorRef,day,refresh]);
 const chooseCenter=useCallback(async(value:Center)=>{
  const id=++sequence.current;
  setCenter(value);setDetail(null);setChoices(null);setSearchTime("");setChosen(null);
  setError("");setLoading(true);
  try{
   const result=await get<Detail>("center-first?doctorRef="+
    encodeURIComponent(doctorRef)+"&centerRef="+
    encodeURIComponent(value.centerRef)+"&date="+encodeURIComponent(day));
   if(id===sequence.current){if(result.day!==day||result.centerRef!==value.centerRef||!Array.isArray(result.slots)||result.slots.length>MAX_SLOTS)throw Error("The current center schedule could not be verified.");setDetail(result);setLoading(false);}
  }catch(e){if(id===sequence.current){
   setError(e instanceof Error?e.message:"Working hours could not be checked.");
   setLoading(false);
  }}
 },[doctorRef,day]);
 const compare=useCallback(async(time:string)=>{
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return;
  const id=++sequence.current;setSearchTime(time);setChoices(null);setDetail(null);setCenter(null);setChosen(null);
  setError("");setLoading(true);
  try{
   const result=await get<Choices>("slot-first?doctorRef="+
    encodeURIComponent(doctorRef)+"&date="+encodeURIComponent(day)+
    "&time="+encodeURIComponent(time));
   if(id===sequence.current){if(result.day!==day||result.time!==time||!Array.isArray(result.centerChoices)||result.centerChoices.length>MAX_CENTERS)throw Error("The current center choices could not be verified.");setChoices(result);setLoading(false);}
  }catch(e){if(id===sequence.current){
   setError(e instanceof Error?e.message:"Center choices could not be checked.");
   setLoading(false);
  }}
 },[doctorRef,day]);
 const changeDay=(value:string)=>{if(value===day||chosen)return;sequence.current++;setOptions(null);setDetail(null);setChoices(null);setCenter(null);setError("");setLoading(true);setDay(value);};
 const changeWeek=(delta:number)=>{if(chosen)return;
  const target=Math.max(0,Math.min(4,week+delta));
  setWeek(target);
  // Changing the displayed week also changes the queried day; never
  // show stale old-week sessions under a new date heading.
  changeDay(dateAt(target*7));
 };
 const button=(text:string,action:()=>void,active=false,disabled=false)=>(
  <Pressable accessibilityRole="button" accessibilityState={{selected:active,disabled}}
   style={[style.button,active&&style.selected,disabled&&style.disabled]}
   disabled={disabled} onPress={action}>
   <Text style={style.buttonText}>{text}</Text>
  </Pressable>
 );
 return <View style={style.panel} accessibilityLabel="Verified doctor working hours">
  <Text style={style.heading} accessibilityRole="header">Doctor Schedule &amp; Availability</Text>
  <View style={style.actions}>{["1. Doctor selected","2. Choose time","3. Review","4. Confirmation"].map((v,i)=><Text key={v} style={[style.step,(chosen?i===2:i===1)&&style.activeStep]}>{v}</Text>)}</View>
  {reschedule&&<Text style={style.help}>Select a new time. Your original booking remains intact until the change succeeds.</Text>}
  <Text style={style.help}>Times are advisory until a genuine reservation succeeds.
   Consultation payment is due directly at the healthcare center.</Text>
  {!chosen&&<>
  <View style={style.actions}>
   {button("‹ Previous week",()=>changeWeek(-1),false,week===0)}
   {button("Next week ›",()=>changeWeek(1),false,week===4)}
  </View>
  <View style={style.actions}>
   {days.map(item=>button(
    new Date(item.date+"T12:00:00Z").toLocaleDateString("en-IN",{
     day:"numeric",month:"short",weekday:"short"}),
    ()=>changeDay(item.date),day===item.date))}
  </View>
  {loading&&<ActivityIndicator accessibilityLabel="Checking verified working hours"/>}
  {!!error&&<View><Text style={style.error} accessibilityRole="alert">{error}</Text>{button("Check again",()=>setRefresh(v=>v+1),false,loading)}</View>}
  {options&&!loading&&options.centers.length===0&&
   <Text style={style.help}>No verified current center schedule is available.</Text>}
  {options&&!loading&&<View>
   <Text style={style.subheading}>Choose a verified center</Text>
   <View style={style.actions}>
    {[...options.centers].sort((a,b)=>Number(b.centerSlug===preferredCenterSlug)-Number(a.centerSlug===preferredCenterSlug)).map(c=><View key={c.centerRef} style={[style.center,c.centerSlug===preferredCenterSlug&&style.selected]}>
     <Text style={style.centerName}>{c.centerName}</Text>
     {c.centerSlug===preferredCenterSlug&&<Text style={style.help}>Center selected from your search</Text>}
     <Text style={style.help}>{money(c.consultationFeeMinor)}.
      {c.hasWorkingSchedule?" Published weekly hours.":" No current weekly hours."}</Text>
     {button("View working hours",()=>void chooseCenter(c),
      center?.centerRef===c.centerRef)}
    </View>)}
   </View>
  </View>}
  {options&&!loading&&<View style={style.center}>
   <Text accessibilityRole="header" style={style.subheading}>Find a time across centers</Text>
   <TextInput accessibilityLabel="Local appointment time, 24-hour HH:MM" value={timeInput} onChangeText={setTimeInput} maxLength={5} placeholder="09:30" style={style.input}/>
   {button("Find centers at this time",()=>void compare(timeInput),false,!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput))}
  </View>}
  {detail&&center&&!loading&&<View>
   <Text accessibilityRole="header" style={style.subheading}>
    {center.centerName} · {day}</Text>
   <Text style={style.help}>Times in {detail.timeZone}. A time is confirmed only after final review.</Text>
   {detail.slots.length===0?
    <Text style={style.help}>No current working-time window is shown for this day.</Text>:
    <View>{[["Morning",0,12],["Afternoon",12,16],["Evening",16,24]].map(([name,from,to])=>{const slots=detail.slots.filter(s=>Number(s.startLocal.slice(0,2))>=Number(from)&&Number(s.startLocal.slice(0,2))<Number(to));return slots.length?<View key={name} style={style.group}><Text style={style.subheading}>{name}</Text><View style={style.actions}>{slots.map(slot=><View key={slot.startAt} style={style.window}>{button(slot.startLocal+"–"+slot.endLocal,()=>{if(slot.bookable&&detail.consultationFeeMinor!==null&&detail.consultationFeeVersion!==null)setChosen({centerRef:center.centerRef,centerName:center.centerName,doctorName:detail.doctorName,startAt:slot.startAt,endAt:slot.endAt,timeZone:detail.timeZone,feeMinor:detail.consultationFeeMinor,feeVersion:detail.consultationFeeVersion});},false,!slot.bookable||detail.consultationFeeMinor==null||detail.consultationFeeVersion==null)}</View>)}</View></View>:null;})}</View>}
  </View>}
  {choices&&!loading&&<View>
   <Text style={style.subheading}>Verified centers at {searchTime}</Text>
   {choices.centerChoices.length===0?
    <Text style={style.help}>No matching working time was found.</Text>:
    choices.centerChoices.map(c=><View key={c.centerRef} style={style.center}>
     <Text style={style.help}>{c.centerName}, {c.address}, {c.pinCode}.
      {money(c.consultationFeeMinor)}. {c.timeZone}.</Text>
     {c.bookable&&c.consultationFeeMinor!==null&&c.consultationFeeVersion!==null&&button("Select center & time",()=>{if(c.consultationFeeMinor!==null&&c.consultationFeeVersion!==null)setChosen({centerRef:c.centerRef,centerName:c.centerName,doctorName:options?.doctorName??"Doctor",startAt:c.startAt,endAt:c.endAt,timeZone:c.timeZone,feeMinor:c.consultationFeeMinor,feeVersion:c.consultationFeeVersion});})}
    </View>)}
  </View>}
  </>}
  {chosen&&<View style={style.summary}><Text accessibilityRole="header" style={style.subheading}>Appointment summary</Text><NativeConsultationAction key={[doctorRef,chosen.centerRef,chosen.startAt,chosen.endAt,chosen.feeMinor,chosen.feeVersion].join("|")} doctorRef={doctorRef} {...chosen} reschedule={reschedule} onSelectionLock={setSelectionLocked}/>{button("Change selected time",()=>setChosen(null),false,selectionLocked)}<Text style={style.help}>{selectionLocked?"Finish the current reservation or recheck its original status before changing time.":"If a previous request is uncertain, check My Consultations before reserving again."}</Text></View>}
  <Text style={style.help}>Use My Patient Profile to sign in before booking.
   Only doctor consultations are booked here. Center payment options are verified separately.</Text>
 </View>;
}
const style=StyleSheet.create({
 panel:{padding:16,borderWidth:1,borderColor:theme.border,borderRadius:14,gap:12,
  backgroundColor:theme.background},
 heading:{fontSize:18,fontWeight:"700",color:theme.text},
 subheading:{fontSize:16,fontWeight:"700",color:theme.text,marginTop:8},
 help:{fontSize:13,lineHeight:19,color:theme.mutedText,flexShrink:1},
 actions:{flexDirection:"row",gap:8,flexWrap:"wrap"},
 button:{borderWidth:1,borderColor:theme.border,paddingHorizontal:10,
  paddingVertical:10,borderRadius:10,minHeight:48,justifyContent:"center"},
 selected:{borderColor:theme.primary,backgroundColor:theme.selectedSurface},
 disabled:{opacity:0.45},
 buttonText:{fontSize:13,fontWeight:"600",color:theme.text},
 center:{borderWidth:1,borderColor:theme.border,borderRadius:10,padding:12,gap:5,
  minWidth:180,maxWidth:330,flexGrow:1},
 centerName:{fontSize:15,fontWeight:"700",color:theme.text},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:8,padding:12,minHeight:48,color:theme.text},
 window:{minWidth:140,maxWidth:"100%"},
 group:{gap:6,marginBottom:10},step:{backgroundColor:theme.surface,borderRadius:12,padding:8,color:theme.text,fontSize:12,fontWeight:"600"},activeStep:{backgroundColor:theme.gold,color:theme.sidebar},summary:{borderColor:theme.border,borderWidth:1,borderRadius:12,padding:12,gap:10,backgroundColor:theme.surface},
 error:{color:theme.error,fontSize:13}
});
