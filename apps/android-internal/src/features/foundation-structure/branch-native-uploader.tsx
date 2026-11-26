import {useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Props={token:string;registrationRef:string;draftVersion:number;
 classification:"BRANCH_PHOTO"|"BRANCH_LOGO"|"REGISTRATION_PROOF"|"AGREEMENT";
 onVerified:(ref:string)=>void;onExpired:()=>void;disabled?:boolean};
type Selected={uri:string;name:string;size:number;mime:string};
type Intent={uploadRef:string;status:string;uploadUrl?:string;uploadHeaders?:Record<string,string>};
type Status={uploadRef:string;status:string;fileRef:string|null;fileVersion:number|null;
 cleanVerified:boolean};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
 let response:Response;
 try{
   response=await identityRequest("/api/documents/branch-evidence"+path,{
     method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
     ...(body?{body:JSON.stringify(body)}:{})
   });
 }catch{throw Error("UNKNOWN");}
 if(response.status===401)throw Error("EXPIRED");
 if(response.status===403)throw Error("DENIED");
 if(response.status===409)throw Error("CONFLICT");
 if(response.status===400)throw Error("INVALID");
 if(!response.ok)throw Error("UNAVAILABLE");
 try{return await response.json() as T;}catch{throw Error("UNKNOWN");}
}
const friendly=(error:unknown)=>{
 const code=error instanceof Error?error.message:"UNKNOWN";
 return ({
   EXPIRED:"The session expired. Sign in again.",
   DENIED:"You are not permitted to access this private evidence.",
   CONFLICT:"The branch or upload changed. Refresh before retrying.",
   INVALID:"Choose a supported file under 10 MB.",
   UNAVAILABLE:"Private storage or malware scanning is unavailable.",
   UNKNOWN:"The original file request is unconfirmed. Check its status before another upload."
 } as Record<string,string>)[code]??"Private file verification could not be confirmed.";
};
export function BranchNativeUploader({token,registrationRef,draftVersion,classification,
 onVerified,onExpired,disabled=false}:Props){
 const [picked,setPicked]=useState<Selected|null>(null);
 const [key,setKey]=useState(""),[intent,setIntent]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [verified,setVerified]=useState(false),[message,setMessage]=useState("");
 const label=({BRANCH_PHOTO:"Branch photo",BRANCH_LOGO:"Branch logo",
   REGISTRATION_PROOF:"Registration proof",AGREEMENT:"Signed agreement"} as Record<string,string>)[classification];
 async function choose(){
   if(busy||disabled||uncertain)return;
   try{
     const result=await DocumentPicker.getDocumentAsync({
       type:["application/pdf","image/jpeg","image/png","image/webp"],
       multiple:false,copyToCacheDirectory:true
     });
     if(result.canceled)return;
     const asset=result.assets?.[0];
     if(!asset||!asset.mimeType||!MIME.has(asset.mimeType)||
       !asset.size||asset.size<1||asset.size>10485760){
       setMessage("Choose a PDF, JPG, PNG or WebP file under 10 MB.");return;
     }
     setPicked({uri:asset.uri,name:asset.name,size:asset.size,mime:asset.mimeType});
     setKey("");setIntent("");setMessage("");setVerified(false);
   }catch{setMessage("The private file picker could not open.");}
 }
 async function check(){
   if(!intent||busy)return;
   setBusy(true);
   try{
     const result=await api<Status>(token,"/intents/"+encodeURIComponent(intent));
     setUncertain(false);
     if(result.cleanVerified&&result.fileRef){
       onVerified(result.fileRef);setVerified(true);
       setMessage("The original file was verified and is stored privately.");
     }else setMessage("The original file is not verified: "+result.status.replaceAll("_"," ")+".");
   }catch(e){setUncertain(true);setMessage(friendly(e));
     if(e instanceof Error&&e.message==="EXPIRED")onExpired();
   }finally{setBusy(false);}
 }
 async function upload(){
   if(busy||disabled||uncertain||verified||!picked)return;
   const requestKey=key||Crypto.randomUUID();setKey(requestKey);
   setBusy(true);setMessage("");
   try{
     const file=new File(picked.uri);
     const digest=await file.digest("SHA-256");
     if(!/^[a-f0-9]{64}$/.test(digest))throw Error("UNKNOWN");
     const started=await api<Intent>(token,"/intents","POST",{
       registrationRef,draftVersion,classification,requestKey,
       mime:picked.mime,sizeBytes:picked.size,sha256:digest
     });
     if(!started.uploadRef)throw Error("UNKNOWN");
     setIntent(started.uploadRef);
     if(started.status==="STORAGE_UNAVAILABLE"||!started.uploadUrl){
       setMessage("Secure storage or scan is unavailable. No file was accepted.");return;
     }
     if(!started.uploadUrl.startsWith("https://")||
       started.uploadHeaders?.["Content-Type"]!==picked.mime)throw Error("UNKNOWN");
     const job=file.createUploadTask(started.uploadUrl,{
       httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,
       mimeType:picked.mime,headers:started.uploadHeaders,sessionType:"foreground"
     });
     let sent;
     try{sent=await job.uploadAsync();}
     finally{job.release();}
     if(sent.status<200||sent.status>=300)throw Error("UNKNOWN");
     const final=await api<Status>(token,
       "/intents/"+encodeURIComponent(started.uploadRef)+"/confirm","POST");
     if(!final.cleanVerified||!final.fileRef){
       setUncertain(true);setMessage("File scan not confirmed. Check original upload.");return;
     }
     onVerified(final.fileRef);setVerified(true);
     setMessage("Private file verified. Save the registration stage to include it.");
   }catch(e){setUncertain(true);setMessage(friendly(e));
     if(e instanceof Error&&e.message==="EXPIRED")onExpired();
   }finally{setBusy(false);}
 }
 return <View style={styles.card}>
   <Text style={styles.label}>{label}</Text>
   {picked&&<Text style={styles.help}>{picked.name}</Text>}
   <Pressable accessibilityRole="button" disabled={busy||disabled||uncertain}
     style={styles.button} onPress={()=>void choose()}>
     <Text style={styles.text}>Choose private file</Text></Pressable>
   {picked&&!verified&&<Pressable accessibilityRole="button" disabled={busy||disabled||uncertain}
     style={[styles.button,styles.primary]} onPress={()=>void upload()}>
     <Text style={styles.primaryText}>{busy?"Verifying...":"Upload and verify"}</Text></Pressable>}
   {intent!==""&&<Pressable accessibilityRole="button" disabled={busy}
     style={styles.button} onPress={()=>void check()}>
     <Text style={styles.text}>Check original upload</Text></Pressable>}
   {uncertain&&<Pressable accessibilityRole="button" disabled={busy}
     style={styles.button} onPress={()=>{setUncertain(false);setMessage(
       "Reuse the original request or check its status before another upload.");}}>
     <Text style={styles.text}>Review unknown result</Text></Pressable>}
   {!!message&&<Text accessibilityRole="alert" style={styles.help}>{message}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:16,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#FFFFFF",borderRadius:14,gap:10,
   shadowColor:"#0F172A",shadowOpacity:0.04,
   shadowOffset:{width:0,height:2},shadowRadius:6,elevation:2},
 label:{fontWeight:"700",fontSize:14,color:theme.text},
 help:{fontSize:13,color:theme.mutedText},
 button:{minHeight:48,padding:10,borderRadius:10,borderWidth:1,borderColor:"#E2E8F0",
   backgroundColor:"#F8FAFC",alignItems:"center",justifyContent:"center"},
 text:{fontSize:14,fontWeight:"600",color:theme.text},
 primary:{backgroundColor:theme.primary,borderColor:theme.primary},
 primaryText:{color:theme.primaryText,fontWeight:"700"}
});
