import {useEffect,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Voucher={voucherRef:string;voucherNumber:string;version:number;
 status:string;approvalCaseRef:string|null};
type Proof={fileRef:string;fileVersion:number;mime:string;sizeBytes:string};
type Selected={uri:string;name:string;size:number;mime:string};
type Pending={key:string;kind:"submit"|"settle";body:Record<string,unknown>};
type Props={token:string;voucher:Voucher;canViewEvidence:boolean;canUploadEvidence:boolean;
 onUpdated:()=>void;onExpired:()=>void};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
type Start={status:string;uploadRef:string;uploadUrl?:string;
 uploadHeaders?:Record<string,string>};
type Verify={status:string;cleanVerified:boolean;fileRef:string|null;fileVersion:number|null};
async function call<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 let result:Response;
 try{
  result=await identityRequest(path,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 }catch{throw Error("UNKNOWN");}
 if(result.status===401)throw Error("EXPIRED");
 if(result.status===403)throw Error("DENIED");
 if(result.status===409)throw Error("CHANGED");
 if(result.status===400)throw Error("INVALID");
 if(!result.ok)throw Error(method==="POST"?"UNKNOWN":"OFFLINE");
 try{return await result.json() as T;}catch{throw Error("UNKNOWN");}
}
const friendly=(e:unknown)=>{
 const c=e instanceof Error?e.message:"UNKNOWN";
 return c==="EXPIRED"?"Session expired. Sign in again.":
  c==="DENIED"?"Your current role cannot use private voucher evidence.":
  c==="CHANGED"?"The original voucher, file or reviewer outcome changed. Refresh.":
  c==="INVALID"?"Check the voucher version, file and amounts.":
  c==="OFFLINE"?"Original records cannot be reached. Check your connection.":
  "The operation outcome is uncertain. Check the original request before retrying.";
};
export function FinanceVoucherNativeEvidence({token,voucher,canViewEvidence,
 canUploadEvidence,onUpdated,onExpired}:Props){
 const [files,setFiles]=useState<Proof[]>([]);
 const [selected,setSelected]=useState("");
 const [picked,setPicked]=useState<Selected|null>(null);
 const [requestKey,setRequestKey]=useState("");
 const [intent,setIntent]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [noResult,setNoResult]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const current=files.find(f=>f.fileRef===selected);
 useEffect(()=>{setFiles([]);setSelected("");setPicked(null);setRequestKey("");setIntent("");
  setPending(null);setNoResult(false);setMessage("");},
  [voucher.voucherRef,voucher.version]);
 async function load(){
  if(!canViewEvidence||busy)return;
  setBusy(true);setMessage("");
  try{
   const result=await call<{files:Proof[]}>(token,
    "/api/documents/finance-voucher-evidence/vouchers/"+voucher.voucherRef+
     "/files?version="+voucher.version);
   if(!Array.isArray(result.files))throw Error("OFFLINE");
   const rows=result.files.filter(f=>typeof f.fileRef==="string"&&
    Number.isSafeInteger(f.fileVersion)&&f.fileVersion>0);
   setFiles(rows);setSelected(old=>rows.some(f=>f.fileRef===old)?old:rows[0]?.fileRef??"");
   setMessage(rows.length?"Original verified attachments available.":
    "No original clean attachment exists for this voucher version.");
  }catch(e){setFiles([]);setSelected("");setMessage(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function choose(){
  if(!canUploadEvidence||busy||pending)return;
  try{
   const result=await DocumentPicker.getDocumentAsync({
    type:["application/pdf","image/jpeg","image/png","image/webp"],
    multiple:false,copyToCacheDirectory:true});
   if(result.canceled)return;
   const item=result.assets?.[0];
   if(!item||!item.mimeType||!MIME.has(item.mimeType)||
     !item.size||item.size<1||item.size>10485760){
    setMessage("Choose a supported PDF/JPG/PNG/WebP file under 10 MB.");return;}
   setPicked({uri:item.uri,name:item.name,size:item.size,mime:item.mimeType});
   setRequestKey("");setIntent("");setMessage("");
  }catch{setMessage("The private file picker could not open.");}
 }
 async function status(){
  if(!intent||busy)return;
  setBusy(true);setMessage("");
  try{
   const result=await call<Verify>(token,"/api/documents/finance-voucher-evidence/intents/"+intent);
   if(result.cleanVerified&&result.fileRef&&result.fileVersion){
    setFiles([{fileRef:result.fileRef,fileVersion:result.fileVersion,
     mime:picked?.mime??"application/pdf",sizeBytes:String(picked?.size??0)}]);
    setSelected(result.fileRef);
    setMessage("The original private voucher attachment is verified.");
   }else setMessage("The original file is not fully verified: "+result.status.replaceAll("_"," ")+".");
  }catch(e){setMessage(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function upload(){
  if(!picked||busy||!canUploadEvidence||pending)return;
  const key=requestKey||Crypto.randomUUID();setRequestKey(key);setBusy(true);setMessage("");
  try{
   const nativeFile=new File(picked.uri);
   const digest=await nativeFile.digest("SHA-256");
   if(!/^[0-9a-f]{64}$/.test(digest))throw Error("UNKNOWN");
   const prepared=await call<Start>(token,
    "/api/documents/finance-voucher-evidence/intents","POST",{
     voucherRef:voucher.voucherRef,voucherVersion:voucher.version,
     requestKey:key,mime:picked.mime,sizeBytes:picked.size,sha256:digest});
   if(!prepared.uploadRef)throw Error("UNKNOWN");
   setIntent(prepared.uploadRef);
   if(prepared.status!=="UPLOAD_READY"||!prepared.uploadUrl||
     !prepared.uploadUrl.startsWith("https://")||!prepared.uploadHeaders||
     prepared.uploadHeaders["Content-Type"]!==picked.mime){
    setMessage("The original storage reservation is unavailable. No evidence has been verified.");return;}
   const job=nativeFile.createUploadTask(prepared.uploadUrl,{
    httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,mimeType:picked.mime,
    headers:prepared.uploadHeaders,sessionType:"foreground"});
   let result;
   try{result=await job.uploadAsync();}finally{job.release();}
   if(result.status<200||result.status>=300)throw Error("UNKNOWN");
   const clean=await call<Verify>(token,
    "/api/documents/finance-voucher-evidence/intents/"+prepared.uploadRef+"/confirm","POST",{});
   if(!clean.cleanVerified||!clean.fileRef||!clean.fileVersion)
    throw Error("UNKNOWN");
   setFiles([{fileRef:clean.fileRef,fileVersion:clean.fileVersion,mime:picked.mime,
    sizeBytes:String(picked.size)}]);
   setSelected(clean.fileRef);
   setMessage("Private file passed source, checksum and malware verification.");
  }catch(e){setMessage(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 async function send(p:Pending){
  setBusy(true);setMessage("");setNoResult(false);
  try{
   const path=p.kind==="submit"?
    "/api/finance-accounting/vouchers/drafts/"+voucher.voucherRef+"/submit":
    "/api/finance-accounting/vouchers/"+voucher.voucherRef+"/settle";
   const r=await call<{confirmed:boolean;status:string}>(token,path,"POST",
    {...p.body,requestKey:p.key});
   if(r.confirmed!==true||typeof r.status!=="string")throw Error("UNKNOWN");
   setPending(null);setMessage("Original Finance change confirmed: "+r.status+
    ". This is not a verified payment.");onUpdated();
  }catch(e){setPending(p);setMessage(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 function submit(){
  if(!current||voucher.status!=="DRAFT"||busy||pending)return;
  void send({kind:"submit",key:Crypto.randomUUID(),body:{
   expectedVersion:voucher.version,proofFileRef:current.fileRef,
   proofVersion:current.fileVersion}});
 }
 function settle(){
  if(!voucher.approvalCaseRef||voucher.status!=="SUBMITTED"||busy||pending)return;
  void send({kind:"settle",key:Crypto.randomUUID(),
   body:{caseRef:voucher.approvalCaseRef}});
 }
 async function checkOriginal(){
  if(!pending||busy)return;
  setBusy(true);setMessage("");
  try{
   const r=await call<{confirmed:boolean;status:string|null}>(token,
    "/api/finance-accounting/vouchers/workflow-commands/"+pending.key);
   if(r.confirmed){setPending(null);setMessage(
    "The original voucher request was confirmed as "+r.status+".");onUpdated();}
   else{setNoResult(true);setMessage("No completed change was found. Retry only the same request.");}
  }catch(e){setMessage(friendly(e));
   if(e instanceof Error&&e.message==="EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 return <View style={styles.card}>
  <Text style={styles.title}>Verified voucher attachment & review</Text>
  <Text style={styles.hint}>Only the exact current clean file version can be submitted.</Text>
  {voucher.status==="DRAFT"&&<>
   {canViewEvidence&&<Pressable accessibilityRole="button" disabled={busy}
    style={styles.button} onPress={()=>void load()}>
    <Text style={styles.text}>Check verified attachments</Text></Pressable>}
   {canUploadEvidence&&<Pressable accessibilityRole="button" disabled={busy||!!pending}
    style={styles.button} onPress={()=>void choose()}>
    <Text style={styles.text}>Choose private voucher file</Text></Pressable>}
   {picked&&canUploadEvidence&&<><Text style={styles.hint}>{picked.name}</Text>
    <Pressable accessibilityRole="button" disabled={busy||!!pending}
     style={styles.button} onPress={()=>void upload()}>
     <Text style={styles.text}>{busy?"Verifying…":"Upload and verify"}</Text></Pressable></>}
   {!!intent&&<Pressable accessibilityRole="button" disabled={busy} style={styles.button}
    onPress={()=>void status()}><Text style={styles.text}>Check original upload</Text></Pressable>}
   {files.map((f,i)=><Pressable key={f.fileRef} accessibilityRole="radio"
    accessibilityState={{checked:selected===f.fileRef}} disabled={busy}
    style={styles.button} onPress={()=>setSelected(f.fileRef)}>
    <Text style={styles.text}>Verified attachment {i+1}{selected===f.fileRef?" · Selected":""}</Text>
   </Pressable>)}
   <Pressable accessibilityRole="button" disabled={!current||busy||!!pending}
    style={[styles.button,styles.primary]} onPress={submit}>
    <Text style={styles.primaryText}>Submit for authorized review</Text></Pressable>
  </>}
  {voucher.status==="SUBMITTED"&&<Pressable accessibilityRole="button"
   disabled={busy||!!pending||!voucher.approvalCaseRef} style={styles.button}
   onPress={settle}><Text style={styles.text}>Check genuine reviewer outcome</Text></Pressable>}
  {pending&&<><Text style={styles.hint}>Last request result unconfirmed. Check it before retrying.</Text>
   <Pressable accessibilityRole="button" disabled={busy} style={styles.button}
    onPress={()=>void checkOriginal()}><Text style={styles.text}>Check original action</Text></Pressable>
   {noResult&&<Pressable accessibilityRole="button" disabled={busy} style={styles.button}
    onPress={()=>void send(pending)}><Text style={styles.text}>Retry same request</Text></Pressable>}</>}
  {busy&&<ActivityIndicator color={t.primary}/>}
  {!!message&&<Text accessibilityRole="alert" style={styles.hint}>{message}</Text>}
  {!canUploadEvidence&&voucher.status==="DRAFT"&&<Text style={styles.hint}>
   A Foundation Administrator can grant the required verified-file upload permissions.</Text>}
 </View>;
}
const styles=StyleSheet.create({
 card:{gap:9,padding:12,borderWidth:1,borderColor:t.border,borderRadius:8,
  backgroundColor:t.surface},
 title:{fontSize:15,fontWeight:"700",color:t.text},
 hint:{fontSize:13,color:t.mutedText,lineHeight:19},
 button:{borderWidth:1,borderColor:t.border,borderRadius:7,minHeight:48,
  justifyContent:"center",paddingHorizontal:11},
 text:{color:t.text,fontSize:13,fontWeight:"600"},
 primary:{backgroundColor:t.primary,borderColor:t.primary},
 primaryText:{color:t.primaryText,fontWeight:"700"}
});
