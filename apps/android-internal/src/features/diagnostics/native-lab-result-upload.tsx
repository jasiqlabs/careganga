import {useRef,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Props={token:string;centerRef:string;orderRef:string;
 onVerified:()=>Promise<void>;onExpired:()=>void};
type Picked={uri:string;size:number;name:string};
type Prepare={uploadRef:string;status:string;uploadReady:boolean;
 uploadUrl?:string;uploadHeaders?:Record<string,string>;message?:string};
type Status={uploadRef:string;status:string;cleanVerified:boolean;
 professionallyReleased?:boolean};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 const result=await identityRequest("/api/v1/diagnostics/clinical/"+path,{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  body:body?JSON.stringify(body):undefined
 });
 if(!result.ok)throw Object.assign(new Error(
  result.status===401?"Sign in again to access protected lab records.":
  result.status===403?"Your current laboratory assignment does not permit this action.":
  result.status===409?"This report state changed. Check the original upload.":
  "Secure laboratory report status cannot be confirmed."),{status:result.status});
 return await result.json() as T;
}
/** Original CG19 scan-verified evidence only. NO professional approval/release. */
export function NativeLabResultUpload({token,centerRef,orderRef,onVerified,onExpired}:Props){
 const [picked,setPicked]=useState<Picked|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [status,setStatus]=useState("NOT_UPLOADED");
 const original=useRef<{requestKey:string;sizeBytes:number;sha256:string;mime:string}|null>(null);
 const uploadRef=useRef("");
 const base="centers/"+centerRef+"/orders/"+orderRef+"/reports";
 async function choose(){
  if(busy||uploadRef.current)return;
  try{
   const result=await DocumentPicker.getDocumentAsync({type:"application/pdf",
    multiple:false,copyToCacheDirectory:true});
   if(result.canceled)return;
   const file=result.assets?.[0];
   if(!file||!file.size||file.size<1||file.size>10485760||
      file.mimeType!=="application/pdf"||!file.name.toLowerCase().endsWith(".pdf")){
    setMessage("Choose one PDF smaller than 10 MB.");return;
   }
   setPicked({uri:file.uri,size:file.size,name:file.name});
   setMessage("");
  }catch{setMessage("The report file picker could not be opened.");}
 }
 async function check(){
  if(!uploadRef.current||busy)return;
  setBusy(true);setMessage("");
  try{
   const response=await api<Status>(token,base+"/"+uploadRef.current+"/status");
   setStatus(response.status);
   setMessage(response.cleanVerified?
    "Private PDF is scanner-verified. Professional approval, release and delivery have NOT occurred.":
    "Original report upload is not yet scanner-verified. No clinical approval or release.");
   if(response.cleanVerified)try{await onVerified();}catch{
    setMessage("Scan verified, but the order detail could not be refreshed.");
   }
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setMessage(e instanceof Error?e.message:"Check the existing report upload.");
  }finally{setBusy(false);}
 }
 async function upload(){
  if(!picked||busy||["RESULT_READY","VALIDATED","REJECTED"].includes(status))return;
  setBusy(true);setMessage("");
  try{
   const f=new File(picked.uri),sha256=await f.digest("SHA-256");
   if(!/^[a-f0-9]{64}$/.test(sha256))
    throw Error("The selected PDF checksum could not be checked.");
   const payload=original.current??{requestKey:Crypto.randomUUID(),
    sizeBytes:picked.size,sha256,mime:"application/pdf"};
   if(payload.sha256!==sha256||payload.sizeBytes!==picked.size)
    throw Error("The selected file changed. Check the original upload before trying again.");
   original.current=payload;
   const res=await api<Prepare>(token,base+"/prepare","POST",payload);
   uploadRef.current=res.uploadRef;setStatus(res.status);
   if(!res.uploadReady||!res.uploadUrl||!res.uploadHeaders){
    setMessage(res.message??"Secure upload is not available. No report is verified.");return;
   }
   const uri=new URL(res.uploadUrl);
   if(uri.protocol!=="https:"||uri.username||uri.password||uri.hash||
      res.uploadHeaders["Content-Type"]!=="application/pdf")
    throw Error("The secure report destination was not validated.");
   const task=f.createUploadTask(res.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
    mimeType:"application/pdf",headers:res.uploadHeaders,
    sessionType:"foreground"
   });
   const uploaded=await task.uploadAsync();
   task.release();
   if(uploaded.status<200||uploaded.status>=300)
    throw Error("Report transfer cannot be confirmed. Check the original upload first.");
   setStatus("UPLOADED_UNVERIFIED");
   const verified=await api<Status>(token,base+"/"+res.uploadRef+"/confirm","POST");
   setStatus(verified.status);
   setMessage(verified.cleanVerified?
    "PDF uploaded and scanned clean. Clinical approval and release are NOT done.":
    "Report scan verification is pending or unavailable. Check the original upload.");
   if(verified.cleanVerified)try{await onVerified();}catch{
    setMessage("Report verified, but the latest order detail is unavailable.");
   }
  }catch(e){
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
   setMessage(e instanceof Error?e.message:"This original report may be pending. Check its status.");
  }finally{setBusy(false);}
 }
 return <View style={s.panel}>
  <Text style={s.heading}>Private clinical report PDF</Text>
  <Text style={s.text}>Evidence upload and malware verification are separate from
   qualified clinical review, professional release and patient delivery.</Text>
  {!uploadRef.current&&<Pressable accessibilityRole="button" disabled={busy}
   style={s.button} onPress={()=>void choose()}>
   <Text style={s.text}>{picked?picked.name:"Choose private PDF (max 10 MB)"}</Text>
  </Pressable>}
  {!!picked&&<Pressable accessibilityRole="button" disabled={busy||
   ["RESULT_READY","VALIDATED","REJECTED","UPLOADED_UNVERIFIED","VERIFICATION_UNAVAILABLE"].includes(status)}
   style={s.button} onPress={()=>void upload()}>
   <Text style={s.text}>{uploadRef.current?"Retry the same upload":"Upload and verify original PDF"}</Text>
  </Pressable>}
  {!!uploadRef.current&&<Pressable accessibilityRole="button" disabled={busy}
   style={s.button} onPress={()=>void check()}>
   <Text style={s.text}>Check original scan status</Text>
  </Pressable>}
  <Text style={s.text}>Report evidence: {status.replaceAll("_"," ")}.
   Clinical approval: not completed. Released to patient: no.</Text>
  {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
 </View>;
}
const s=StyleSheet.create({
 panel:{padding:12,borderRadius:12,borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,gap:10},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{fontSize:13,lineHeight:20,color:t.text},
 message:{fontSize:13,lineHeight:19,color:t.mutedText},
 button:{minHeight:48,padding:12,borderRadius:10,borderWidth:1,borderColor:t.border,
  justifyContent:"center"}
});
