import {useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Visit={bookingId:string;consultationAt:string;status:string};
type Page={appointmentRef:string;items:Visit[];next:string|null};

/** Original clinician-only same-center timeline. Real CG14 account/doctor,
 * current CG01 role, patient care consent and original checked-in appointment
 * are always enforced server side. This is not an all-center medical record.
 */
export function NativeClinicianVisitHistory({token,centerRef,bookingRef,onExpired}:{
 token:string;centerRef:string;bookingRef:string;onExpired:()=>void
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [page,setPage]=useState<Page|null>(null),[error,setError]=useState("");
 const serial=useRef(0);
 useEffect(()=>{
  serial.current++;setOpen(false);setBusy(false);setPage(null);setError("");
  return()=>{serial.current++;};
 },[token,centerRef,bookingRef]);
 async function load(before?:string){
  const stamp=++serial.current;setBusy(true);setError("");
  try{
   const path="/api/v1/appointments/queue/my-centers/"+
    encodeURIComponent(centerRef)+"/bookings/"+encodeURIComponent(bookingRef)+
    "/clinical-history"+(before?"?before="+encodeURIComponent(before):"");
   const r=await identityRequest(path,{
    method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}});
   if(r.status===401)onExpired();
   if(!r.ok)throw Error(r.status===403||r.status===404?
    "This clinician, consent or center does not authorize the selected patient history.":
    "Current consultation history cannot be checked.");
   const data=await r.json() as Page;
   if(stamp!==serial.current||data.appointmentRef!==bookingRef)return;
   setPage(old=>before&&old?{...data,items:[...old.items,...data.items]}:data);
  }catch(e){
   if(stamp===serial.current)
    setError(e instanceof Error?e.message:"Consultation history unavailable.");
  }finally{if(stamp===serial.current)setBusy(false);}
 }
 return <View style={styles.container}>
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>{
   if(open){
    serial.current++;setOpen(false);setPage(null);setError("");setBusy(false);
   }else{setOpen(true);void load();}
  }} style={styles.button}>
   <Text style={styles.label}>{open?"Hide my earlier patient visits":
    "My patient's earlier consultations here"}</Text>
  </Pressable>
  {open&&<View style={styles.panel}>
   <Text style={styles.note}>This is only your own doctor account's
    consultations at this center, not medical reports from another center.</Text>
   {busy&&<Text accessibilityRole="alert" style={styles.note}>
    Checking live clinician and consent authorization…</Text>}
   {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
   {page&&page.items.length===0&&<Text style={styles.note}>
    No earlier consultations available within your current access.</Text>}
   {page?.items.map((item,i)=><Text key={item.bookingId+":"+i} style={styles.note}>
    {item.bookingId} · {new Date(item.consultationAt).toLocaleString("en-IN")} ·
    {" "+item.status.replaceAll("_"," ")}
   </Text>)}
   {page?.next&&<Pressable accessibilityRole="button" disabled={busy}
    onPress={()=>void load(page.next!)} style={styles.button}>
    <Text style={styles.label}>Older consultations</Text>
   </Pressable>}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 container:{gap:8},
 panel:{gap:8,padding:10,borderWidth:1,borderColor:t.border,borderRadius:10},
 button:{minHeight:44,padding:10,borderWidth:1,borderColor:t.border,
  borderRadius:8,justifyContent:"center"},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 note:{fontSize:12,color:t.mutedText}
});
