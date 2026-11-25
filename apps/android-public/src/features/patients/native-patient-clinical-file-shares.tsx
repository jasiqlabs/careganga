import {useEffect,useRef,useState} from "react";
import {Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";

type Booking={bookingRef:string;bookingId:string;bookingStatus:string};
type Share={grantRef:string;status:string;version:number;currentlyAuthorized:boolean;bookingId:string;
 doctorName:string;centerName:string};
const base=process.env.EXPO_PUBLIC_API_URL;
function endpoint(p:string){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Patient-shared document service is not configured.");
 return new URL(p,base).toString();
}
/** One patient-authorized scanned file to one real original booking; no
 * shared-phone/center-wide consent and no staff write to patient grants.
 */
export function NativePatientClinicalFileShares({token,fileRef,consentGranted,onExpired}:{
 token:string;fileRef:string;consentGranted:boolean;onExpired:()=>void
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [selected,setSelected]=useState("");
 const [grants,setGrants]=useState<Share[]>([]);
 const [message,setMessage]=useState("");
 const keys=useRef(new Map<string,string>());
 useEffect(()=>{setOpen(false);setBookings([]);setSelected("");setGrants([]);
  setMessage("");keys.current.clear();},[fileRef,token]);
 async function query<T>(path:string,method:"GET"|"POST"="GET",body?:object){
  const r=await fetch(endpoint(path),{method,cache:"no-store",
   signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,
    ...(method==="POST"?{"Content-Type":"application/json"}:{})},
   body:method==="POST"?JSON.stringify(body??{}):undefined});
  if(r.status===401){onExpired();throw Error("Your patient session expired. Sign in again.");}
  if(!r.ok)throw Error(r.status===403||r.status===404?
   "Your current patient/clinical sharing permission is not available.":
   r.status===409?"Original document permission changed. Refresh.":
   "Private appointment document sharing status is uncertain.");
  return await r.json() as T;
 }
 const root="/api/documents/patient-clinical/me/files/"+
  encodeURIComponent(fileRef)+"/shares";
 async function load(){
  const r=await query<{shares:Share[]}>(root);
  setGrants(r.shares);
 }
 async function reveal(){
  if(open){setOpen(false);setMessage("");return;}
  setOpen(true);setBusy(true);setMessage("");
  try{
   const [shares,visits]=await Promise.all([
    query<{shares:Share[]}>(root),
    query<{items:Booking[]}>("/api/v1/appointments/consultations/me?limit=20")
   ]);
   setGrants(shares.shares);
   setBookings(visits.items.filter(a=>a.bookingStatus==="CONFIRMED"));
  }catch(e){setMessage(e instanceof Error?e.message:"Patient-sharing history unavailable.");}
  finally{setBusy(false);}
 }
 async function share(){
  if(!selected||busy||!consentGranted)return;
  const key=keys.current.get(selected)??Crypto.randomUUID();
  keys.current.set(selected,key);
  setBusy(true);setMessage("");
  try{
   const grant=await query<{status:string}>(root,"POST",
    {requestKey:key,bookingRef:selected});
   await load();setMessage(grant.status==="ACTIVE"?
    "This file is shared only with the confirmed booking's own doctor after check-in, while consent remains valid.":
    "This document's previous permission is no longer active.");
   if(grant.status==="ACTIVE")keys.current.delete(selected);
  }catch(e){setMessage(e instanceof Error?e.message:
   "Sharing result uncertain. Refresh original grants.");}
  finally{setBusy(false);}
 }
 async function revoke(g:Share){
  if(busy)return;
  setBusy(true);setMessage("");
  try{
   await query("/api/documents/patient-clinical/me/shares/"+
    encodeURIComponent(g.grantRef)+"/revoke","POST",{expectedVersion:g.version});
   await load();setMessage("Doctor access revoked. External copies cannot be recalled.");
  }catch(e){setMessage(e instanceof Error?e.message:
   "Revocation status uncertain. Recheck original grants.");}
  finally{setBusy(false);}
 }
 const button=(label:string,action:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled}}
   style={[styles.button,(busy||disabled)&&styles.disabled]} onPress={action}>
   <Text style={styles.label}>{label}</Text>
  </Pressable>);
 return <View style={styles.panel}>
  {button(open?"Hide clinical document sharing":"Choose doctor access for this file",
   ()=>void reveal())}
  {open&&<>
   <Text style={styles.help}>Optional: only this appointment's booked verified
    doctor at the real center can view the document after check-in. Other
    centers, staff and doctors are not authorized.</Text>
   {!!message&&<Text accessibilityRole="alert" style={styles.help}>{message}</Text>}
   {consentGranted&&<>
    <Text style={styles.help}>Select one of my confirmed appointments</Text>
    <ScrollView horizontal contentContainerStyle={styles.choices}>
     {bookings.map(b=><Pressable key={b.bookingRef} accessibilityRole="radio"
      accessibilityState={{checked:selected===b.bookingRef}}
      disabled={busy} onPress={()=>setSelected(b.bookingRef)}
      style={[styles.button,selected===b.bookingRef&&styles.selected]}>
      <Text style={styles.label}>{b.bookingId}</Text>
     </Pressable>)}
    </ScrollView>
    {button("Allow this appointment's doctor to see my file",
     ()=>void share(),!selected)}
   </>}
   {!consentGranted&&<Text style={styles.help}>Patient care consent is
    withdrawn. New sharing cannot be granted; old permissions are visible.</Text>}
   <Text style={styles.help}>Existing patient file permissions</Text>
   {grants.length===0&&<Text style={styles.help}>No permissions recorded.</Text>}
   {grants.map(g=><View style={styles.item} key={g.grantRef}>
    <Text style={styles.help}>{g.bookingId} · {g.doctorName} ·
     {" "+g.centerName}</Text>
    <Text style={styles.help}>{g.status!=="ACTIVE"?"Revoked":
     g.currentlyAuthorized?"Active for this appointment":"Inactive: booking or consent changed"}</Text>
    {g.status==="ACTIVE"&&button("Revoke this doctor's file access",
     ()=>void revoke(g))}
   </View>)}
   {button("Refresh original permissions",()=>void load().catch(e=>
    setMessage(e instanceof Error?e.message:"Grants unavailable.")))}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:8,gap:7},
 help:{fontSize:12,color:t.mutedText},
 choices:{gap:6},
 item:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:9,gap:6},
 button:{minHeight:44,padding:9,borderColor:t.border,borderWidth:1,
  borderRadius:8,justifyContent:"center"},
 selected:{borderColor:t.primary,borderWidth:2},
 label:{color:t.text,fontSize:12,fontWeight:"600"},
 disabled:{opacity:0.4}
});
