import {careGangaTheme as hrTheme} from "../../../../../packages/design-tokens/src/index";
import React,{useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Fields={contactPhone:string|null;postalAddress:string|null;
 emergencyName:string|null;emergencyPhone:string|null;
 pan:string|null;bankAccount:string|null;bankIfsc:string|null;fatherName:string|null;motherName:string|null;dateOfBirth:string|null;gender:string|null;bloodGroup:string|null;contactEmail:string|null;pinCode:string|null;bankName:string|null;accountHolder:string|null;bankBranch:string|null;accountType:string|null;upiId:string|null};
const empty=():Fields=>({contactPhone:null,postalAddress:null,emergencyName:null,
 emergencyPhone:null,pan:null,bankAccount:null,bankIfsc:null,fatherName:null,motherName:null,dateOfBirth:null,gender:null,bloodGroup:null,contactEmail:null,pinCode:null,bankName:null,accountHolder:null,bankBranch:null,accountType:null,upiId:null});
const fields=[
 ["contactPhone","Contact phone"],["postalAddress","Postal address"],
 ["emergencyName","Emergency contact name"],["emergencyPhone","Emergency contact phone"],
 ["pan","PAN (if required)"],["bankAccount","Bank account number"],["bankIfsc","IFSC"],
 ["fatherName","Father's name (optional)"],
 ["motherName","Mother's name (optional)"],
 ["dateOfBirth","Date of birth (YYYY-MM-DD)"],
 ["gender","Gender (optional)"],
 ["bloodGroup","Blood group (optional, e.g. A+)"],
 ["contactEmail","Email address"],
 ["pinCode","PIN code"],
 ["bankName","Bank name"],
 ["accountHolder","Account holder name"],
 ["bankBranch","Bank branch"],
 ["accountType","Account type (Savings / Current / Other)"],
 ["upiId","UPI ID (optional)"]
] as const;
async function api(token:string,path:string,method:"GET"|"PATCH"="GET",body?:object){
 const res=await identityRequest("/api/hr/private/"+encodeURIComponent(path),{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok){const rejected:unknown=await res.json().catch(()=>null);throw Object.assign(new Error(
  res.status===400&&rejected&&typeof rejected==="object"&&"code" in rejected&&rejected.code==="CG10_PRIVATE_INVALID"&&"message" in rejected&&typeof rejected.message==="string"?rejected.message:
  res.status===401?"Session expired. Sign in again.":
  res.status===403?"Your current role does not permit private employee details.":
  res.status===409?"The employee record changed. Refresh before saving.":
   "Private employee information cannot be verified; do not repeat an uncertain write."
 ),{status:res.status});}
 return res.json() as Promise<unknown>;
}
export function NativeHrPrivate({token,applicationRef,canManage,onExpired}:{
 token:string;applicationRef:string;canManage:boolean;onExpired:()=>void
}){
 const [opened,setOpened]=useState(false);
 const [data,setData]=useState<Fields>(empty);
 const [revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const fail=(e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Protected data cannot be confirmed.");
 };
 const read=async()=>{
  if(busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const value=await api(token,applicationRef);
   if(!value||typeof value!=="object"||!("details" in value)||
    !("revision" in value)||typeof value.revision!=="number"||
    !value.details||typeof value.details!=="object")
    throw Error("The original private data cannot be verified.");
   setData(value.details as Fields);setRevision(value.revision);setOpened(true);
  }catch(e){setOpened(false);setData(empty());fail(e);}
  finally{setBusy(false);}
 };
 const save=async()=>{
  if(busy||!canManage||!opened)return;
  setBusy(true);setError("");setMessage("");
  try{
   const value=await api(token,applicationRef,"PATCH",{
    expectedRevision:revision,details:data});
   if(!value||typeof value!=="object"||!("saved" in value)||
    value.saved!==true||!("revision" in value)||
    typeof value.revision!=="number")
    throw Error("Protected employee update not confirmed.");
   setRevision(value.revision);
   setMessage("Encrypted employee details saved with original audit. "+
    "No role, approval or login access was granted.");
  }catch(e){fail(e);}
  finally{setBusy(false);}
 };
 const close=()=>{setOpened(false);setData(empty());setError("");setMessage("");};
 return <View style={styles.card}>
  <Text style={styles.heading}>Restricted personal and bank details</Text>
  <Text style={styles.muted}>Separate encrypted source. Protected reads are audited.
   Government ID documents use original CG-19 scanned evidence.
   No information here is part of a public directory.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!message&&<Text style={styles.success}>{message}</Text>}
  {!opened?<Pressable accessibilityRole="button" onPress={()=>void read()}
    disabled={busy} style={styles.button}>
    <Text style={styles.buttonText}>Open audited private details</Text></Pressable>:
   <View style={{gap:10}}>
    {fields.map(([field,label])=><View key={field}>
     <Text style={styles.label}>{label}</Text>
     <TextInput accessibilityLabel={label} editable={canManage&&!busy}
      value={data[field]??""} autoCorrect={false}
      placeholder="Optional" placeholderTextColor="#94A3B8"
      autoCapitalize="none" style={styles.input}
      onChangeText={v=>setData(old=>({...old,[field]:v}))}
      maxLength={field==="postalAddress"?700:field==="contactEmail"?254:field==="upiId"?128:field==="contactPhone"||field==="emergencyPhone"?20:field==="bankAccount"?22:field==="bankIfsc"?11:field==="pan"||field==="dateOfBirth"?10:field==="pinCode"?6:field==="bloodGroup"?3:field==="accountType"?16:field==="gender"?32:120}
      keyboardType={field==="contactEmail"?"email-address":field==="contactPhone"||field==="emergencyPhone"?"phone-pad":field==="pinCode"||field==="bankAccount"?"number-pad":"default"}
      multiline={field==="postalAddress"}/>
    </View>)}
    {canManage&&<Pressable accessibilityRole="button" style={styles.primary}
      disabled={busy} onPress={()=>void save()}>
     <Text style={styles.primaryText}>{busy?"Saving…":"Save encrypted details"}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" style={styles.button} onPress={close}
      disabled={busy}><Text style={styles.buttonText}>Close and clear details</Text></Pressable>
   </View>}
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:14,borderRadius:12,backgroundColor:hrTheme.surface,
  borderWidth:1,borderColor:hrTheme.border,gap:9},
 heading:{fontSize:16,fontWeight:"700",color:hrTheme.text},
 label:{fontSize:13,color:hrTheme.text,fontWeight:"600",marginBottom:4},
 muted:{color:hrTheme.mutedText,fontSize:13,lineHeight:19},
 input:{backgroundColor:hrTheme.surface,padding:12,minHeight:45,color:hrTheme.text,
  borderWidth:1,borderColor:hrTheme.border,borderRadius:9},
 button:{alignSelf:"flex-start",padding:11,borderRadius:9,backgroundColor:"#F1F5F9"},
 buttonText:{color:hrTheme.text,fontWeight:"600",fontSize:13},
 primary:{alignSelf:"flex-start",padding:12,borderRadius:9,backgroundColor:hrTheme.primary},
 primaryText:{color:hrTheme.surface,fontWeight:"700"},
 error:{color:"#991B1B",padding:9,backgroundColor:"#FEF2F2"},
 success:{color:"#166534",padding:9,backgroundColor:"#ECFDF5"}
});
