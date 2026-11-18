import {useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Claim={claimRef:string;claimNumber:string;version:number;status:string};
type Selected={uri:string;name:string;mime:string;size:number};
type Intent={uploadRef:string;status:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>;cleanVerified?:boolean;
 fileRef?:string|null;fileVersion?:number|null};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
async function request<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:Record<string,unknown>):Promise<T>{
 let result:Response;
 try{result=await identityRequest(path,{method,cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});}
 catch{throw Error("UNKNOWN");}
 if(result.status===401)throw Error("EXPIRED");
 if(!result.ok){
  const data:unknown=await result.json().catch(()=>null);
  if(data&&typeof data==="object"&&!Array.isArray(data)&&
    "code" in data&&typeof data.code==="string"&&data.code.startsWith("FINANCE_")&&
    "message" in data&&typeof data.message==="string")
   throw Error("USER:"+data.message);
  throw Error(result.status===403?"DENIED":result.status===409?"CHANGED":"UNKNOWN");
 }
 return await result.json() as T;
}
const safe=(e:unknown)=>{
 const code=e instanceof Error?e.message:"UNKNOWN";
 return code.startsWith("USER:")?code.slice(5):
  code==="EXPIRED"?"Session expired. Sign in again.":
  code==="DENIED"?"Your role cannot upload private claim bills.":
  code==="CHANGED"?"The original claim or file changed. Refresh before submitting.":
  "The original file/claim result cannot be confirmed. Check status before retrying.";
};
export function FinanceClaimNativeBill({token,claim,canUpload,onUpdated,onExpired}:{
 token:string;claim:Claim;canUpload:boolean;onUpdated:()=>void;onExpired:()=>void
}){
 const [picked,setPicked]=useState<Selected|null>(null);
 const [intentRef,setIntentRef]=useState("");
 const [uploadKey,setUploadKey]=useState("");
 const [proof,setProof]=useState<{ref:string;version:number}|null>(null);
 const [pending,setPending]=useState<{key:string;body:Record<string,unknown>}|null>(null);
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 async function choose(){
  if(!canUpload||busy)return;
  try{
   const result=await DocumentPicker.getDocumentAsync({
    type:["application/pdf","image/jpeg","image/png","image/webp"],
    multiple:false,copyToCacheDirectory:true});
   if(result.canceled)return;
   const a=result.assets?.[0];
   if(!a?.mimeType||!MIME.has(a.mimeType)||!a.size||
      a.size<1||a.size>10485760){setNotice("Select one PDF or image under 10 MB.");return;}
   setPicked({uri:a.uri,name:a.name,size:a.size,mime:a.mimeType});
   setIntentRef("");setUploadKey("");setProof(null);setPending(null);setNotice("");
  }catch{setNotice("The private bill picker could not open.");}
 }
 async function check(){
  if(!intentRef||busy)return;
  setBusy(true);setNotice("");
  try{
   const data=await request<Intent>(token,
    "/api/documents/finance-claim-bills/intents/"+intentRef);
   if(data.cleanVerified&&data.fileRef&&data.fileVersion){
    setProof({ref:data.fileRef,version:data.fileVersion});
    setNotice("Your original private bill is scanned and verified.");
   }else setNotice("Private scan not confirmed. Status: "+
     String(data.status).replaceAll("_"," ")+".");
  }catch(e){setNotice(safe(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function upload(){
  if(!picked||!canUpload||busy)return;
  const key=uploadKey||Crypto.randomUUID();setUploadKey(key);
  setBusy(true);setNotice("");
  try{
   const file=new File(picked.uri),digest=await file.digest("SHA-256");
   if(!/^[0-9a-f]{64}$/.test(digest))throw Error("UNKNOWN");
   const init=await request<Intent>(token,
    "/api/documents/finance-claim-bills/intents","POST",{
     claimRef:claim.claimRef,claimVersion:claim.version,requestKey:key,
     mime:picked.mime,sizeBytes:picked.size,sha256:digest});
   if(!init.uploadRef)throw Error("UNKNOWN");
   setIntentRef(init.uploadRef);
   if(init.status==="UPLOAD_READY"&&init.uploadUrl&&
      init.uploadUrl.startsWith("https://")&&init.uploadHeaders&&
      init.uploadHeaders["Content-Type"]===picked.mime){
    const task=file.createUploadTask(init.uploadUrl,{
     httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
     mimeType:picked.mime,headers:init.uploadHeaders,sessionType:"foreground"});
    let result;
    try{result=await task.uploadAsync();}finally{task.release();}
    if(result.status<200||result.status>=300)throw Error("UNKNOWN");
   }else if(init.status!=="VALIDATED"){
    setNotice("Secure storage is unavailable. The bill was not verified.");return;
   }
   const final=await request<Intent>(token,
    "/api/documents/finance-claim-bills/intents/"+init.uploadRef+"/confirm","POST",{});
   if(!final.cleanVerified||!final.fileRef||!final.fileVersion)
    throw Error("UNKNOWN");
   setProof({ref:final.fileRef,version:final.fileVersion});
   setNotice("Private original bill passed storage and malware verification.");
  }catch(e){setNotice(safe(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function submit(input:{key:string;body:Record<string,unknown>}){
  setBusy(true);setNotice("");
  try{
   const outcome=await request<{confirmed:boolean;status:string}>(token,
    "/api/finance-accounting/claims/"+claim.claimRef+"/submit","POST",
    {...input.body,requestKey:input.key});
   if(!outcome.confirmed)throw Error("UNKNOWN");
   setPending(null);setNotice("Claim submitted for protected review. No payment is recorded.");
   onUpdated();
  }catch(e){setPending(input);setNotice(safe(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function original(){
  if(!pending||busy)return;
  setBusy(true);setNotice("");
  try{
   const result=await request<{confirmed:boolean;status:string|null}>(token,
    "/api/finance-accounting/claims/workflow-commands/"+pending.key);
   if(result.confirmed&&result.status==="SUBMITTED"){
    setPending(null);setNotice("Original claim submission confirmed. Await protected review.");
    onUpdated();
   }else setNotice("No confirmed submission found. Retry the SAME request reference only.");
  }catch(e){setNotice(safe(e));if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 return <View style={s.card}>
  <Text style={s.title}>Verified bill for {claim.claimNumber}</Text>
  <Text style={s.note}>Private file confirmation does not approve or pay the claim.</Text>
  {!picked&&<Pressable accessibilityRole="button" disabled={!canUpload||busy}
   style={s.button} onPress={()=>void choose()}>
   <Text style={s.buttonText}>Choose private bill</Text></Pressable>}
  {picked&&<Text style={s.note}>{picked.name}</Text>}
  {picked&&!proof&&<Pressable accessibilityRole="button" disabled={busy||!canUpload}
   style={s.button} onPress={()=>void upload()}>
   <Text style={s.buttonText}>Upload and scan original bill</Text></Pressable>}
  {intentRef&&!proof&&<Pressable accessibilityRole="button" disabled={busy}
    style={s.button} onPress={()=>void check()}>
    <Text style={s.buttonText}>Check existing file status</Text></Pressable>}
  {proof&&!pending&&<Pressable accessibilityRole="button" disabled={busy}
   style={s.button} onPress={()=>void submit({
    key:Crypto.randomUUID(),body:{expectedVersion:claim.version,
     billFileRef:proof.ref,billVersion:proof.version}})}>
   <Text style={s.buttonText}>Submit verified claim for review</Text></Pressable>}
  {pending&&<Pressable accessibilityRole="button" disabled={busy} style={s.button}
   onPress={()=>void original()}><Text style={s.buttonText}>Check original request</Text></Pressable>}
  {pending&&<Pressable accessibilityRole="button" disabled={busy} style={s.button}
   onPress={()=>void submit(pending)}>
   <Text style={s.buttonText}>Retry same submission only</Text></Pressable>}
  {!!notice&&<Text accessibilityRole="alert" style={s.note}>{notice}</Text>}
 </View>;
}
const s=StyleSheet.create({
 card:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
  borderRadius:9,padding:12,gap:9},title:{fontSize:14,fontWeight:"700",color:t.text},
 note:{fontSize:12,color:t.mutedText,lineHeight:18},
 button:{backgroundColor:t.primary,borderRadius:8,minHeight:48,padding:12,
  justifyContent:"center",alignItems:"center"},
 buttonText:{color:t.primaryText,fontWeight:"700",fontSize:13}
});
