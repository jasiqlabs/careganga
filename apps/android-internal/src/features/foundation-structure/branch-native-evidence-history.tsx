import {useCallback,useEffect,useRef,useState} from "react";
import {Alert,AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {IconFileText,IconRefresh} from "../dashboard/dashboard-icons";

type FileItem={fileRef:string;revision:number;classification:string;mime:string;
 sizeBytes:number;status:string;revoked:boolean;createdAt:string};
type Props={registrationRef:string;token:string;canManage:boolean;onExpired:()=>void};
const ROOT="/api/documents/branch-evidence";
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
async function request(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
 const response=await identityRequest(ROOT+path,{method,
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 if(response.status===401)throw Error("EXPIRED");
 if(!response.ok)throw Error(response.status===403?"DENIED":"UNAVAILABLE");
 return response;
}
export function BranchNativeEvidenceHistory({registrationRef,token,canManage,onExpired}:Props){
 const [rows,setRows]=useState<FileItem[]>([]),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const previewFile=useRef<File|null>(null);
 const leftApp=useRef(false);
 // File.preview resolves when the external viewer opens, not when it closes:
 // keep the private cached bytes until return/unmount instead of deleting
 // them beneath an Android ACTION_VIEW consumer.
 useEffect(()=>{
   const subscription=AppState.addEventListener("change",state=>{
     if(state!=="active"){leftApp.current=true;return;}
     if(leftApp.current){
       leftApp.current=false;
       try{previewFile.current?.delete();}catch{}
       previewFile.current=null;
     }
   });
   return ()=>{
     subscription.remove();
     try{previewFile.current?.delete();}catch{}
     previewFile.current=null;
   };
 },[]);
 const refresh=useCallback(async()=>{
   const result=await request(token,"/registration/"+encodeURIComponent(registrationRef));
   const data=await result.json() as {files:FileItem[]};
   if(!Array.isArray(data.files))throw Error("UNAVAILABLE");
   setRows(data.files);
 },[registrationRef,token]);
 useEffect(()=>{
   let active=true;
   void refresh().catch(error=>{
     if(!active)return;
     setRows([]);setMessage("Private file history could not be verified.");
     if(error instanceof Error&&error.message==="EXPIRED")onExpired();
   });
   return()=>{active=false;};
 },[refresh,onExpired]);
 async function openPrivate(file:FileItem){
   if(busy||file.revoked||file.status!=="VALIDATED")return;
   setBusy(true);setMessage("");
   let temporary:File|null=null;
   let handedOff=false;
   try{
     const response=await request(token,"/files/"+encodeURIComponent(file.fileRef)+"/download");
     const contentType=response.headers.get("content-type")??"";
     if(!MIME.has(contentType))throw Error("UNAVAILABLE");
     const lengthHeader=response.headers.get("content-length");
     const expected=lengthHeader===null?null:Number(lengthHeader);
     if(expected!==null&&(!Number.isSafeInteger(expected)||expected<1||expected>10485760))
       throw Error("UNAVAILABLE");
     const bytes=new Uint8Array(await response.arrayBuffer());
     if(bytes.length<1||bytes.length>10485760||
       expected!==null&&bytes.length!==expected)throw Error("UNAVAILABLE");
     const suffix=contentType==="application/pdf"?".pdf":
       contentType==="image/jpeg"?".jpg":contentType==="image/png"?".png":".webp";
     try{previewFile.current?.delete();}catch{}
     previewFile.current=null;
     temporary=new File(Paths.cache,"careganga-branch-private-"+Crypto.randomUUID()+suffix);
     temporary.create();
     await temporary.write(bytes);
     await temporary.preview({title:"Protected branch evidence"});
     previewFile.current=temporary;handedOff=true;
   }catch(error){
     setMessage(error instanceof Error&&error.message==="DENIED"?
       "You no longer have permission to view this private document.":
       "The verified private file could not be previewed.");
     if(error instanceof Error&&error.message==="EXPIRED")onExpired();
   }finally{
     if(!handedOff)try{temporary?.delete();}catch{}
     setBusy(false);
   }
 }
 async function revoke(file:FileItem){
   if(!canManage||busy||file.revoked)return;
   setBusy(true);setMessage("");
   try{
     await request(token,"/files/"+encodeURIComponent(file.fileRef)+"/revoke",
       "POST",{expectedRevision:file.revision});
     await refresh();
     setMessage("Private file revoked; historical approval evidence remains recorded.");
   }catch(error){
     setMessage("File revocation cannot be confirmed. Refresh the original file state.");
     if(error instanceof Error&&error.message==="EXPIRED")onExpired();
   }finally{setBusy(false);}
 }
 return <View style={styles.panel}>
   <Text style={styles.heading}>Saved private evidence</Text>
   {!!message&&<Text accessibilityRole="alert" style={styles.help}>{message}</Text>}
   {rows.length===0?<Text style={styles.help}>No verified evidence available.</Text>:
     rows.map(row=><View key={row.fileRef} style={styles.item}>
       <Text style={styles.label}>{row.classification.replaceAll("_"," ").toLowerCase()}</Text>
       <Text style={styles.help}>{row.revoked?"Revoked":row.status.replaceAll("_"," ")}</Text>
       {!row.revoked&&row.status==="VALIDATED"&&<Pressable accessibilityRole="button"
         disabled={busy} style={styles.action} onPress={()=>void openPrivate(row)}>
         <IconFileText size={16} color="#2563EB" />
         <Text style={styles.actionLabel}>Preview private original</Text></Pressable>}
       {canManage&&!row.revoked&&<Pressable accessibilityRole="button" disabled={busy}
         style={styles.action} onPress={()=>Alert.alert(
           "Revoke protected file?",
           "This removes access to the selected private document. Existing approval history is retained.",
           [{text:"Cancel",style:"cancel"},{text:"Revoke file",style:"destructive",
             onPress:()=>void revoke(row)}]
         )}>
         <Text style={[styles.actionLabel,{color:"#DC2626"}]}>Revoke file</Text></Pressable>}
     </View>)}
   <Pressable accessibilityRole="button" disabled={busy} style={styles.action}
     onPress={()=>void refresh().catch(()=>setMessage("File history cannot be refreshed."))}>
     <IconRefresh size={16} color="#64748B" />
     <Text style={styles.actionLabel}>Refresh original file status</Text></Pressable>
 </View>;
}
const styles=StyleSheet.create({
 panel:{borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#FFFFFF",borderRadius:14,padding:16,gap:10,
   shadowColor:"#0F172A",shadowOpacity:0.04,shadowOffset:{width:0,height:2},shadowRadius:6,elevation:2},
 heading:{color:theme.text,fontSize:17,fontWeight:"700"},
 item:{borderTopWidth:1,borderColor:"#E2E8F0",paddingVertical:10,gap:6},
 label:{color:theme.text,fontSize:14,fontWeight:"600"},
 help:{fontSize:13,color:theme.mutedText},
 action:{minHeight:44,padding:10,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#F8FAFC",
   borderRadius:9,flexDirection:"row",gap:6,justifyContent:"center",alignItems:"center"},
 actionLabel:{color:theme.text,fontSize:14,fontWeight:"600"}
});
