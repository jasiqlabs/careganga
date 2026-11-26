import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {File,Paths} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";
type Report={releaseRef:string;orderLabel:string;reportVersion:number;
 releasedAt:string;superseded?:boolean};
type Props={token:string;onExpired:()=>void};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const root=process.env.EXPO_PUBLIC_API_URL;
function endpoint(path:string){
 if(!root||!/^https?:\/\//.test(root)||
  (process.env.NODE_ENV==="production"&&!root.startsWith("https://")))
  throw Error("Your private laboratory report service is unavailable.");
 return new URL("/api/v1/diagnostics/patient-reports/"+path,root);
}
/** Original CG15 own-account token. Only reviewed, released, scanner-verified
 * PDFs can be opened. This does not claim a cryptographic digital signature.
 */
export function NativeMyLabReports({token,onExpired}:Props){
 const [reports,setReports]=useState<Report[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const preview=useRef<File|null>(null);
 useEffect(()=>()=>{try{preview.current?.delete()}catch{}},[]);
 const refresh=useCallback(async()=>{
  const res=await fetch(endpoint("me"),{method:"GET",cache:"no-store",
   signal:AbortSignal.timeout(14000),
   headers:{Authorization:"Bearer "+token}});
  if(res.status===401){onExpired();throw Error("Please sign in again.");}
  if(!res.ok)throw Error("Your released laboratory reports are unavailable.");
  const raw:unknown=await res.json();
  if(!raw||typeof raw!=="object"||!("reports" in raw)||
   !Array.isArray(raw.reports))
   throw Error("Private released report list cannot be verified.");
  setReports(raw.reports.filter((x:unknown):x is Report=>!!x&&
   typeof x==="object"&&"releaseRef" in x&&typeof x.releaseRef==="string"&&
   ID.test(x.releaseRef)&&"orderLabel" in x&&typeof x.orderLabel==="string"));
 },[token,onExpired]);
 useEffect(()=>{
  let mounted=true;
  void refresh().catch(e=>{if(mounted)setMessage(e instanceof Error?e.message:
   "No released lab reports could be checked.");})
   .finally(()=>{if(mounted)setLoading(false)});
  return()=>{mounted=false;};
 },[refresh]);
 async function open(x:Report){
  if(busy||!ID.test(x.releaseRef))return;
  setBusy(true);setMessage("");
  try{
   const response=await expoFetch(endpoint("me/"+x.releaseRef+"/pdf"),{
    method:"GET",signal:AbortSignal.timeout(20000),
    headers:{Authorization:"Bearer "+token}});
   if(response.status===401){onExpired();throw Error("Please sign in again.");}
   if(!response.ok||
    response.headers.get("Content-Type")?.split(";")[0]!=="application/pdf")
    throw Error("This protected laboratory PDF cannot be opened.");
   const bytes=await response.bytes();
   if(bytes.length<5||bytes.length>10485760||
    String.fromCharCode(...bytes.subarray(0,4))!=="%PDF")
    throw Error("The released laboratory PDF is invalid.");
   try{preview.current?.delete()}catch{}
   const file=new File(Paths.cache,"careganga-private-lab-report.pdf");
   file.write(bytes);preview.current=file;
   if(!await File.canPreview(file,{mimeType:"application/pdf"}))
    throw Error("A PDF viewer is not available on this device.");
   await File.preview(file,{title:"My laboratory report",
    mimeType:"application/pdf"});
  }catch(e){setMessage(e instanceof Error?e.message:
   "The original private report is unavailable.");}
  finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text accessibilityRole="header" style={styles.title}>My lab reports</Text>
  <Text style={styles.note}>Only approved reports released by a clinician
   are visible here. Reports are never publicly accessible.</Text>
  {loading&&<ActivityIndicator accessibilityLabel="Checking your lab reports"/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.note}>{message}</Text>}
  {!loading&&!reports.length&&
   <Text style={styles.note}>No laboratory reports have been released yet.</Text>}
  {reports.map(x=><View key={x.releaseRef} style={styles.entry}>
   <Text style={styles.note}>{x.orderLabel} · Version {x.reportVersion}</Text>
   {x.superseded&&<Text style={styles.note}>Earlier report version — a corrected report is available.</Text>}
   <Text style={styles.note}>Released {
    new Date(x.releasedAt).toLocaleDateString("en-IN")}</Text>
   <Pressable accessibilityRole="button" disabled={busy}
    accessibilityState={{disabled:busy}} style={styles.button}
    onPress={()=>void open(x)}>
    <Text style={styles.action}>Open my private PDF</Text>
   </Pressable>
  </View>)}
  <Pressable accessibilityRole="button" disabled={busy}
   style={styles.button}
   onPress={()=>void refresh().catch(e=>setMessage(e instanceof Error?e.message:
    "Unable to refresh your reports."))}>
   <Text style={styles.action}>Refresh my reports</Text>
  </Pressable>
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,gap:10,backgroundColor:t.surface,borderRadius:12,
  borderWidth:1,borderColor:t.border},
 title:{fontSize:17,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:20},
 entry:{paddingVertical:8,gap:5,borderBottomWidth:1,borderColor:t.border},
 button:{minHeight:48,justifyContent:"center",padding:10,
  borderWidth:1,borderRadius:9,borderColor:t.border},
 action:{color:t.text,fontWeight:"600"}
});
