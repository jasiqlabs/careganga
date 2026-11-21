import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Value={lineRef:string;value:string;unit:string;observation:string};
type Source={canEnter:boolean;canCorrect?:boolean;
 previousReleaseRef?:string|null;
 resumeCorrection?:{previousReleaseRef:string;reason:string}|null;
 reportReady:boolean;resume:{
 requestKey:string;results:Value[]}|null;tests:{lineRef:string;name:string}[]};
type Status={state:"RESULT_READY"|"UNKNOWN";generated:boolean};
type Props={token:string;centerRef:string;orderRef:string;
 onVerified:()=>Promise<void>;onExpired:()=>void};
const path=(center:string,order:string,kind:string)=>
 "/api/v1/diagnostics/clinical/centers/"+center+"/orders/"+order+
 "/results/"+kind;
async function request<T>(token:string,url:string,body?:object):Promise<T>{
 const response=await identityRequest(url,{method:body?"POST":"GET",
  cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Session expired. Please sign in again.":
  response.status===403?"Your current lab role cannot enter these results.":
  response.status===409?"The original report or ordered tests changed. Refresh the order.":
  "The original result could not be verified. Check before retrying."),{
   status:response.status});
 return response.json() as Promise<T>;
}
/** Same CG16 value→CG19 generated PDF source as Web. No document picker
 * needed; a clinician must still independently approve and release it.
 */
export function NativeLabResultEntry({token,centerRef,orderRef,
 onVerified,onExpired}:Props){
 const [source,setSource]=useState<Source|null>(null);
 const [values,setValues]=useState<Value[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false),[message,setMessage]=useState("");
 const [correctionReason,setCorrectionReason]=useState("");
 const key=useRef<string|null>(null);
 const warn=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Original laboratory results unavailable.");
 },[onExpired]);
 useEffect(()=>{
  let live=true;
  void request<Source>(token,path(centerRef,orderRef,"entry")).then(x=>{
   if(!live)return;
   if(!Array.isArray(x.tests)||!x.tests.length||x.tests.length>50)
    throw Error("Original ordered test list cannot be verified.");
   setSource(x);key.current=x.resume?.requestKey??null;
   setCorrectionReason(x.resumeCorrection?.reason??"");
   const prior=new Map((x.resume?.results??[]).map(v=>[v.lineRef,v]));
   setValues(x.tests.map(item=>prior.get(item.lineRef)??{
    lineRef:item.lineRef,value:"",unit:"",observation:""
   }));
  }).catch(e=>{if(live)warn(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[token,centerRef,orderRef,warn]);
 const isCorrection=Boolean(source?.canCorrect||source?.resumeCorrection);
 const edit=(line:string,field:"value"|"unit"|"observation",v:string)=>{
  if(uncertain||busy)return;key.current=null;
  setValues(old=>old.map(x=>x.lineRef===line?{...x,[field]:v}:x));
 };
 const submit=async()=>{
  if(busy||!source?.canEnter||values.some(x=>!x.value.trim())||
   (isCorrection&&correctionReason.trim().length<8))return;
  key.current??=Crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const previous=source.resumeCorrection?.previousReleaseRef??
    source.previousReleaseRef;
   if(isCorrection&&!previous)
    throw Error("A verified previously released report is required.");
   const result=await request<Status>(token,path(centerRef,orderRef,"generate"),
    {requestKey:key.current,results:values,
     ...(isCorrection?{correction:{previousReleaseRef:previous,
      reason:correctionReason.trim()}}:{})});
   if(result.state==="RESULT_READY"&&result.generated){
    key.current=null;setUncertain(false);
    setMessage(isCorrection?
     "New corrected PDF version ready. Prior release preserved; clinician must review again.":
     "PDF automatically generated. Clinician review is next.");
    await onVerified();
   }else{
    setUncertain(true);
    setMessage("Original PDF verification is uncertain. Retry the same entry.");
   }
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)key.current=null;
   warn(e);
  }finally{setBusy(false)}
 };
 const button=(title:string,press:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" accessibilityState={{disabled}}
   disabled={disabled} onPress={press} style={[styles.button,
    disabled&&styles.disabled]}>
   <Text style={styles.buttonText}>{title}</Text>
  </Pressable>;
 return <View style={styles.panel}>
  <Text style={styles.title}>{isCorrection?
   "Correct released lab report":"Enter actual test results"}</Text>
  <Text style={styles.note}>CareGanga generates the PDF automatically.
   Enter only the recorded results, units and optional observations.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking original tests"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {source&&!source.canEnter&&<Text style={styles.note}>
   An original report is already being prepared or is ready for review.
   Do not create a second result.</Text>}
  {source?.canEnter&&source.tests.map(x=>{
   const value=values.find(v=>v.lineRef===x.lineRef);
   if(!value)return null;
   return <View key={x.lineRef} style={styles.line}>
    <Text style={styles.label}>{x.name}</Text>
    <TextInput accessibilityLabel={x.name+" recorded result"} style={styles.input}
     placeholder="Recorded result" value={value.value} maxLength={120}
     editable={!busy&&!uncertain}
     onChangeText={v=>edit(x.lineRef,"value",v)}/>
    <TextInput accessibilityLabel={x.name+" unit"} style={styles.input}
     placeholder="Unit, if applicable" value={value.unit} maxLength={32}
     editable={!busy&&!uncertain}
     onChangeText={v=>edit(x.lineRef,"unit",v)}/>
    <TextInput accessibilityLabel={x.name+" observation"} style={styles.input}
     placeholder="Observation (optional)" value={value.observation}
     maxLength={500} multiline editable={!busy&&!uncertain}
     onChangeText={v=>edit(x.lineRef,"observation",v)}/>
   </View>;
  })}
  {source?.canEnter&&isCorrection&&<View style={styles.line}>
   <Text style={styles.label}>Reason for correction (required)</Text>
   <TextInput accessibilityLabel="Reason for lab report correction"
    multiline value={correctionReason} maxLength={500}
    editable={!busy&&!uncertain} style={styles.input}
    onChangeText={v=>{key.current=null;setCorrectionReason(v);}}/>
   <Text style={styles.note}>The previous released PDF remains unchanged.
    A clinician must approve and release the new version.</Text>
  </View>}
  {source?.canEnter&&button(uncertain?"Retry same PDF generation":
   isCorrection?"Generate corrected PDF":"Generate report PDF",()=>
    Alert.alert("Generate private lab PDF?",
     "Use the entered test values to create the report PDF. "+
     "A clinician must approve and release it before the patient can access it.",[
      {text:"Cancel",style:"cancel"},
      {text:"Generate",onPress:()=>void submit()}]),
    busy||loading||values.some(x=>!x.value.trim())||
    (isCorrection&&correctionReason.trim().length<8))}
  {uncertain&&<Text accessibilityRole="alert" style={styles.note}>
   Keep the same results and retry this original request, not a new report.</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{gap:10,padding:12,backgroundColor:t.surface,
  borderColor:t.border,borderWidth:1,borderRadius:12},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:20,color:t.mutedText},
 label:{fontSize:14,fontWeight:"600",color:t.text},
 line:{gap:7,paddingVertical:7,borderBottomWidth:1,borderColor:t.border},
 input:{padding:10,minHeight:48,borderWidth:1,borderColor:t.border,
  borderRadius:9,backgroundColor:t.surface,color:t.text},
 button:{minHeight:48,padding:11,justifyContent:"center",
  borderWidth:1,borderRadius:9,borderColor:t.border},
 buttonText:{fontWeight:"600",color:t.text,fontSize:13},
 disabled:{opacity:.45}
});
