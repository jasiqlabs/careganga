import {useEffect,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";

type Details={version:number;bloodGroup:string|null;emergencyName:string|null;
 emergencyMobile:string|null;medicalInfo:string|null};
const base=process.env.EXPO_PUBLIC_API_URL;
function url(){
 if(!base||!/^https?:\/\//.test(base)||
  (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
  throw Error("Private patient information is unavailable.");
 return new URL("/api/v1/patients/me/private-details",base).toString();
}
async function source(token:string,method:"GET"|"POST",body?:object){
 const res=await fetch(url(),{method,cache:"no-store",
  signal:AbortSignal.timeout(15000),
  headers:{Authorization:"Bearer "+token,
   ...(method==="POST"?{"Content-Type":"application/json"}:{})},
  body:method==="POST"?JSON.stringify(body??{}):undefined});
 if(!res.ok)throw Object.assign(new Error(res.status===401?
  "Sign in again to access your private patient information.":
  res.status===409?"Your private information changed. Refresh before saving.":
  res.status===403||res.status===404?
   "Your verified patient account cannot access these details.":
   "Encrypted patient information cannot be confirmed."),
  {status:res.status});
 return res.json() as Promise<Details>;
}
/** Self-only encrypted original CG15 optional profile context.
 * Not a clinical diagnosis and never used to find/claim family identities.
 */
export function NativePatientPrivateDetails({token,consentGranted,onExpired}:{
 token:string;consentGranted:boolean;onExpired:()=>void
}){
 const [value,setValue]=useState<Details|null>(null);
 const [blood,setBlood]=useState(""),[name,setName]=useState("");
 const [mobile,setMobile]=useState(""),[medical,setMedical]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 function apply(d:Details){
  setValue(d);setBlood(d.bloodGroup??"");setName(d.emergencyName??"");
  setMobile(d.emergencyMobile??"");setMedical(d.medicalInfo??"");
 }
 async function load(active:()=>boolean){
  setLoading(true);setError("");
  try{
   const result=await source(token,"GET");
   if(active())apply(result);
  }catch(e){
   if(active()){
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
    setError(e instanceof Error?e.message:"Current private details unavailable.");
   }
  }finally{if(active())setLoading(false);}
 }
 useEffect(()=>{
  let active=true;
  setValue(null);setError("");setMessage("");
  void load(()=>active);
  return()=>{active=false;};
 },[token]);
 async function save(){
  if(!value||busy||!consentGranted)return;
  setBusy(true);setMessage("");setError("");
  try{
   const next=await source(token,"POST",{
    expectedVersion:value.version,bloodGroup:blood||null,
    emergencyName:name.trim()||null,emergencyMobile:mobile.trim()||null,
    medicalInfo:medical.trim()||null});
   apply(next);setMessage("Your optional encrypted patient details were saved.");
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setError(e instanceof Error?e.message:"Private patient details could not be saved.");
  }finally{setBusy(false);}
 }
 const button=(label:string,onPress:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled}}
   onPress={onPress} style={[styles.button,(busy||disabled)&&styles.disabled]}>
   <Text style={styles.buttonText}>{label}</Text>
  </Pressable>);
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.heading}>Optional private care information</Text>
  <Text style={styles.note}>Your blood group and medical notes are self-reported,
   not a verified laboratory result or doctor's diagnosis. Emergency contacts
   never link or authorize another patient account.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {loading?<Text style={styles.note}>Checking private information…</Text>:value?<>
   <Text style={styles.note}>Blood group (optional)</Text>
   <View style={styles.groups}>
    {["","A+","A-","B+","B-","AB+","AB-","O+","O-"].map(group=>
     <Pressable accessibilityRole="radio"
      accessibilityState={{checked:blood===group,disabled:busy||!consentGranted}}
      disabled={busy||!consentGranted} key={group} onPress={()=>setBlood(group)}
      style={[styles.option,blood===group&&styles.active]}>
      <Text style={styles.note}>{group||"Not provided"}</Text>
     </Pressable>)}
   </View>
   <Text style={styles.note}>Emergency contact name (optional)</Text>
   <TextInput value={name} maxLength={100} editable={!busy&&consentGranted}
    autoComplete="off" accessibilityLabel="Emergency contact name"
    onChangeText={setName} style={styles.field}/>
   <Text style={styles.note}>Emergency contact mobile (optional)</Text>
   <TextInput value={mobile} maxLength={10} keyboardType="phone-pad"
    editable={!busy&&consentGranted} autoComplete="off"
    accessibilityLabel="Emergency mobile number"
    onChangeText={setMobile} style={styles.field}/>
   <Text style={styles.note}>Private medical information you choose to provide (optional)</Text>
   <TextInput value={medical} maxLength={500} multiline
    editable={!busy&&consentGranted}
    accessibilityLabel="Self-reported medical context"
    onChangeText={setMedical} style={[styles.field,styles.multiline]}/>
   {consentGranted?<>
    {button("Save private details",()=>void save())}
    {button("Refresh private details",()=>void load(()=>true))}
   </>:<Text style={styles.note}>Consent is withdrawn. You can read your
    retained private information, but new changes need current consent.
    No clinic document sharing is granted.</Text>}
  </>:button("Retry private details",()=>void load(()=>true))}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,borderRadius:10,
  backgroundColor:t.surface,gap:9},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:12,color:t.mutedText},
 field:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:10,
  minHeight:45,color:t.text},
 multiline:{minHeight:80,textAlignVertical:"top"},
 groups:{flexDirection:"row",flexWrap:"wrap",gap:6},
 option:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:8},
 active:{borderWidth:2,borderColor:t.primary},
 button:{padding:12,borderRadius:8,minHeight:45,backgroundColor:t.primary,
  alignItems:"center",justifyContent:"center"},
 buttonText:{fontSize:13,color:t.primaryText,fontWeight:"600"},
 disabled:{opacity:0.5}
});
