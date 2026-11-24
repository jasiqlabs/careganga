import React,{useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Platform,Pressable,ScrollView,StyleSheet,
 Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaPublicTheme as theme} from "../../../../../packages/design-tokens/src/index";

type Kind="HOSPITAL"|"CLINIC"|"DIAGNOSTIC_LAB"|"DOCTOR"|"PHARMACY"|"NURSING"|"SURGERY_CENTER";
type Fields={partnerType:Kind;applicantName:string;contactName:string;
 contactPhone:string;contactEmail:string;registrationNumber:string;
 addressLine:string;districtName:string;stateName:string;pinCode:string;
 consentAccepted:boolean};
type Sent=Fields&{requestKey:string};
type Result={reference:string;status:string;receipt?:string;statusLabel?:string;message?:string};
const categories:{code:Kind;label:string}[]=[
 {code:"HOSPITAL",label:"Hospital"},{code:"CLINIC",label:"Clinic"},
 {code:"DIAGNOSTIC_LAB",label:"Diagnostic lab"},
 {code:"DOCTOR",label:"Doctor"},{code:"PHARMACY",label:"Pharmacy"},
 {code:"NURSING",label:"Nursing service"},
 {code:"SURGERY_CENTER",label:"OT / procedures (hospital or clinic)"}
];
const empty:Fields={partnerType:"HOSPITAL",applicantName:"",contactName:"",
 contactPhone:"",contactEmail:"",registrationNumber:"",addressLine:"",
 districtName:"",stateName:"",pinCode:"",consentAccepted:false};
const endpoint=()=>{
 let base=process.env.EXPO_PUBLIC_API_URL;
 if(!base||!/^https?:\/\//.test(base)||
  process.env.NODE_ENV==="production"&&!base.startsWith("https://"))
  throw Error("Service temporarily unavailable.");
 if(Platform.OS==="android"&&/^http:\/\/(localhost|127\.0\.0\.1):/.test(base))
  base=base.replace(/localhost|127\.0\.0\.1/,"10.0.2.2");
 return base;
};
async function request(action:"apply"|"status",payload:unknown):Promise<Result>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const url=new URL("/api/v1/public/health-network/partner-applications"+
   (action==="status"?"/status":""),endpoint()).toString();
  const response=await fetch(url,{method:"POST",
   headers:{"Content-Type":"application/json"},signal:controller.signal,
   body:JSON.stringify(payload)});
  if(!response.ok){
   const body:unknown=await response.json().catch(()=>null);
   const safe=new Set(["PARTNER_FIELD_INVALID","PARTNER_CONSENT_REQUIRED",
    "PARTNER_RECEIPT_INVALID","PARTNER_RECEIPT_UNAVAILABLE",
    "PARTNER_REQUEST_CONFLICT","HEALTH_PUBLIC_RATE_LIMIT"]);
   const info=body&&typeof body==="object"?body as Record<string,unknown>:null;
   if(info&&typeof info.code==="string"&&safe.has(info.code)&&
      typeof info.message==="string"&&info.message.length<=220&&
      !/[<>\r\n]/.test(info.message))
     throw Error(info.message);
   if(response.status===429)throw Error("Too many attempts. Try later.");
   if(response.status===400)throw Error("Please check the form details.");
   if(response.status===404)throw Error("Private tracking code not found.");
   if(response.status===409)throw Error("Original request changed. Refresh before retrying.");
   throw Error("The result is uncertain. Check the original status before retrying.");
  }
  const body:unknown=await response.json();
  if(!body||typeof body!=="object"||!("reference" in body)||
   typeof body.reference!=="string"||
   !/^CGPA-[A-F0-9]{12}$/.test(body.reference)||
   !("status" in body)||typeof body.status!=="string")
   throw Error("Application result could not be verified.");
  if(action==="apply"&&(!("receipt" in body)||typeof body.receipt!=="string"||
   !/^[A-Za-z0-9_-]{43}$/.test(body.receipt)))
   throw Error("Application receipt could not be verified.");
  return body as Result;
 }finally{clearTimeout(timeout);}
}
export function PublicPartnerApplication({onExit,onContact}:{
 onExit:()=>void;onContact:()=>void;
}){
 const [started,setStarted]=useState(false);
 const [fields,setFields]=useState<Fields>(empty);
 const [sent,setSent]=useState<Sent|null>(null);
 const [result,setResult]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [mode,setMode]=useState<"apply"|"status">("apply");
 const [tracking,setTracking]=useState(""),[checked,setChecked]=useState<Result|null>(null);
 // Keep Android hardware Back inside the same Partnerships flow as Web Back.
 useEffect(()=>{
  const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(started)setStarted(false);
   else onExit();
   return true;
  });
  return ()=>subscription.remove();
 },[started,onExit]);
 const change=<K extends keyof Fields,>(key:K,value:Fields[K])=>{
  if(!sent&&!result)setFields(s=>({...s,[key]:value}));
 };
 const field=(key:Exclude<keyof Fields,"partnerType"|"consentAccepted">,title:string,
  opts?:{phone?:boolean})=><View key={key} style={styles.field}>
    <Text style={styles.label}>{title}</Text>
    <TextInput accessibilityLabel={title} style={styles.input}
      value={fields[key] as string} editable={!busy&&!sent&&!result}
      keyboardType={key==="contactEmail"?"email-address":opts?.phone?"phone-pad":
        key==="pinCode"?"number-pad":"default"}
      autoCapitalize={key==="contactEmail"||opts?.phone?"none":"sentences"}
      autoCorrect={key==="contactEmail"?false:undefined}
      maxLength={key==="addressLine"?300:key==="applicantName"||key==="contactEmail"?180:
       key==="pinCode"?6:key==="contactPhone"?16:
       key==="districtName"||key==="stateName"?100:120}
      onChangeText={v=>change(key,v)}/>
   </View>;
 async function submit(payload:Sent){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const r=await request("apply",payload);
   setResult(r);setSent(null);
  }catch(e){setError(e instanceof Error?e.message:"Result is uncertain. Retry same request.");}
  finally{setBusy(false);}
 }
 function startSubmit(){
  if(busy||sent||result)return;
  if(fields.applicantName.trim().length<2||fields.contactName.trim().length<2||
    !/^[+]?[0-9]{10,15}$/.test(fields.contactPhone.trim())||
    (fields.contactEmail.trim()!==""&&
     !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contactEmail.trim()))||
    fields.addressLine.trim().length<5||fields.districtName.trim().length<2||
    fields.stateName.trim().length<2||!/^[1-9][0-9]{5}$/.test(fields.pinCode)||
    fields.partnerType==="DOCTOR"&&!fields.registrationNumber.trim()||
    !fields.consentAccepted){
    setError("Enter the required partner, contact, address, registration and consent details.");
    return;
  }
  const payload={...fields,requestKey:Crypto.randomUUID()};
  setSent(payload);void submit(payload);
 }
 async function status(){
  if(busy)return;
  setBusy(true);setError("");setChecked(null);
  try{setChecked(await request("status",{receipt:tracking.trim()}));}
  catch(e){setError(e instanceof Error?e.message:"Status cannot be verified.");}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={styles.safe}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
   <Pressable accessibilityRole="button" style={styles.secondary}
    disabled={busy} onPress={onExit}><Text>Back to CareGanga</Text></Pressable>
   <Text accessibilityRole="header" style={styles.title}>Partnerships</Text>
   {!started?<View style={styles.card}>
    <Text style={styles.heading}>Partner With Us</Text>
    <Text>CareGanga works with healthcare partners to help eligible people
     access essential services. All applications need Foundation verification.</Text>
    <Pressable accessibilityRole="button" style={styles.primary}
     onPress={()=>setStarted(true)}><Text style={styles.primaryText}>
      Apply as healthcare partner</Text></Pressable>
    <Text style={styles.heading}>Corporate / CSR collaboration</Text>
    <Text>Corporate applications are separate from healthcare partners.
     Enquiry does not imply acceptance or verification.</Text>
    <Pressable accessibilityRole="button" style={styles.secondary}
     onPress={onContact}><Text>Enquire about CSR partnership</Text></Pressable>
   </View>:<>
    <View style={styles.row}>
     <Pressable accessibilityRole="button" accessibilityState={{selected:mode==="apply"}}
      style={styles.secondary} disabled={busy||!!sent}
      onPress={()=>{setMode("apply");setError("");}}>
      <Text>Apply</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityState={{selected:mode==="status"}}
      style={styles.secondary} disabled={busy||!!sent}
      onPress={()=>{setMode("status");setError("");}}>
      <Text>Check status</Text></Pressable>
    </View>
    {mode==="apply"&&result?<View style={styles.card}>
     <Text accessibilityRole="header" style={styles.heading}>Application received</Text>
     <Text>Application {result.reference}</Text>
     <Text>Pending Foundation verification. No service discount or account
      is approved by application alone.</Text>
     <Text>Keep this private tracking code to check your application status:</Text>
     <Text selectable style={styles.receipt}>{result.receipt}</Text>
     <Pressable accessibilityRole="button" style={styles.primary}
      onPress={()=>{setTracking(result.receipt??"");setMode("status");}}>
      <Text style={styles.primaryText}>Check application status</Text></Pressable>
    </View>:mode==="apply"?<View style={styles.card}>
     <Text accessibilityRole="header" style={styles.heading}>Healthcare partner application</Text>
     <Text>Choose one partner category. Each category uses the same original
      CareGanga registration and verification process.</Text>
     <View style={styles.row}>{categories.map(c=>
      <Pressable key={c.code} accessibilityRole="radio"
       accessibilityState={{checked:fields.partnerType===c.code}}
       disabled={busy||!!sent}
       style={[styles.choice,fields.partnerType===c.code&&styles.selected]}
       onPress={()=>change("partnerType",c.code)}>
       <Text>{c.label}</Text></Pressable>)}</View>
     {field("applicantName",fields.partnerType==="DOCTOR"?
       "Doctor's full name":"Organization / facility name")}
     {field("contactName","Contact person's name")}
     {field("contactPhone","Phone number",{phone:true})}
     {field("contactEmail","Email (optional)")}
     {field("registrationNumber",fields.partnerType==="DOCTOR"?
       "Medical registration number (required)":"Registration / license (if available)")}
     {field("addressLine","Practice / facility address")}
     {field("districtName","District")}
     {field("stateName","State")}
     {field("pinCode","Six-digit PIN")}
     <Pressable accessibilityRole="checkbox"
      accessibilityState={{checked:fields.consentAccepted}}
      disabled={busy||!!sent}
      style={styles.row} onPress={()=>change("consentAccepted",!fields.consentAccepted)}>
      <Text>{fields.consentAccepted?"☑":"☐"}</Text>
      <Text style={{flex:1}}>I consent to CareGanga contacting me and
       reviewing these details. Applying does not guarantee verification,
       publication or a Foundation-funded discount.</Text>
     </Pressable>
     {sent&&<Text>The result is uncertain. Retry the SAME request without
       editing details to avoid a duplicate application.</Text>}
     <Pressable accessibilityRole="button" style={styles.primary} disabled={busy}
      onPress={()=>sent?void submit(sent):startSubmit()}>
      <Text style={styles.primaryText}>{busy?"Checking application…":
       sent?"Retry original application":"Submit for Foundation review"}</Text>
     </Pressable>
    </View>:<View style={styles.card}>
     <Text accessibilityRole="header" style={styles.heading}>Check status</Text>
     <Text>Use the private tracking code given at submission.
      A public application reference alone does not reveal personal details.</Text>
     <TextInput accessibilityLabel="Private tracking code"
      value={tracking} onChangeText={setTracking} maxLength={43}
      autoCapitalize="none" editable={!busy} style={styles.input}/>
     <Pressable accessibilityRole="button" disabled={busy} style={styles.primary}
      onPress={()=>void status()}><Text style={styles.primaryText}>
       {busy?"Checking…":"Check status"}</Text></Pressable>
     {checked&&<Text accessibilityLiveRegion="polite">Application {checked.reference}:
      {" "}{checked.statusLabel??"Under Foundation review"}.
      {" "}{checked.message??"The Foundation will contact you with the next step."}</Text>}
    </View>}
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {busy&&<ActivityIndicator accessibilityLabel="Checking current application"/>}
    <Text style={styles.muted}>Do not enter bank account details,
     private medical records or upload unverified evidence here.
     The Foundation will request protected documents if necessary.</Text>
   </>}
  </ScrollView>
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.background},
 page:{padding:20,paddingBottom:50,gap:14,maxWidth:720,width:"100%",alignSelf:"center"},
 card:{backgroundColor:theme.surface,borderRadius:14,padding:18,gap:12,borderWidth:1,borderColor:theme.border},
 title:{fontSize:26,fontWeight:"800",color:theme.sidebar},
 heading:{fontSize:19,fontWeight:"700",color:theme.text},
 row:{flexDirection:"row",flexWrap:"wrap",gap:9,alignItems:"center"},
 choice:{padding:10,borderRadius:10,borderWidth:1,borderColor:theme.border},
 selected:{borderColor:theme.primary,borderWidth:2,backgroundColor:theme.surface},
 primary:{borderRadius:10,backgroundColor:theme.primary,
  minHeight:48,padding:14,alignItems:"center",justifyContent:"center"},
 primaryText:{fontWeight:"700",color:theme.primaryText},
 secondary:{borderWidth:1,borderColor:theme.border,
  minHeight:44,borderRadius:10,padding:12,alignItems:"center",justifyContent:"center"},
 field:{gap:5},label:{fontSize:13,color:theme.mutedText,fontWeight:"600"},
 input:{borderWidth:1,borderColor:theme.border,borderRadius:8,
  minHeight:46,padding:12,color:theme.text},
 receipt:{fontFamily:Platform.select({ios:"Menlo",android:"monospace"})??"monospace",
  color:theme.text,flexWrap:"wrap"},
 error:{color:theme.error,fontWeight:"600"},
 muted:{fontSize:13,color:theme.mutedText}
});
