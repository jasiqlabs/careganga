import * as Crypto from "expo-crypto";
import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {File,Paths,UploadType} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import type {CG04MembershipEvidenceList,CG04MembershipEvidenceStatus} from "@careganga/api-contracts";
import {memberEndpoint,memberInvoke} from "./member-native-api";
type Kind="MEMBER_IDENTITY_PROOF"|"MEMBER_PORTRAIT";
export function NativeMemberProof({token,applicationRef,version,editable,onChange}:{token:string;applicationRef:string;version:number;editable:boolean;onChange:()=>void}){
 const [busy,setBusy]=useState(false),[list,setList]=useState<CG04MembershipEvidenceList|null>(null),[message,setMessage]=useState("");
 const previews=useRef<File[]>([]);
 const refresh=useCallback(async()=>{setList(await memberInvoke<CG04MembershipEvidenceList>("/api/documents/membership/applications/"+applicationRef+"/files","GET",undefined,token));},[applicationRef,token]);
 useEffect(()=>{let active=true;void memberInvoke<CG04MembershipEvidenceList>("/api/documents/membership/applications/"+applicationRef+"/files","GET",undefined,token).then(v=>{if(active)setList(v);}).catch(()=>{if(active)setMessage("Verified evidence could not be read. Retry.");});return()=>{active=false;};},[refresh,version]);
 useEffect(()=>{
  const clear=()=>{for(const f of previews.current)try{f.delete();}catch{}previews.current=[];};
  const sub=AppState.addEventListener("change",state=>{if(state!=="active"){clear();setList(null);}});
  return()=>{sub.remove();clear();};
 },[]);
 const act=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage("");try{await work();}catch(e){setMessage(e instanceof Error?e.message:"Document state is uncertain. Refresh before retrying.");}finally{setBusy(false);}};
 const upload=(kind:Kind)=>void act(async()=>{
  if(!editable)return;
  const pick=await File.pickFileAsync({mimeTypes:kind==="MEMBER_PORTRAIT"?["image/jpeg","image/png","image/webp"]:["application/pdf","image/jpeg","image/png","image/webp"]});
  if(pick.canceled)return;
  const f=pick.result,mime=f.type,size=f.size;
  if(!mime||!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime)||kind==="MEMBER_PORTRAIT"&&mime==="application/pdf"||size<1||size>10485760)throw Error("Select a supported private PDF or image under 10 MB.");
  const sha256=await f.digest("SHA-256");
  const intent=await memberInvoke<CG04MembershipEvidenceStatus>("/api/documents/membership/intents","POST",{applicationRef,applicationVersion:version,requestKey:Crypto.randomUUID(),classification:kind,mime,sizeBytes:size,sha256},token);
  if(intent.status!=="UPLOAD_READY"||!intent.uploadUrl||!intent.uploadHeaders)throw Error("Private upload is pending or unavailable. Check its status before retrying.");
  const response=await f.createUploadTask(intent.uploadUrl,{httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,mimeType:mime,headers:intent.uploadHeaders}).uploadAsync();
  if(response.status<200||response.status>=300)throw Error("Document upload was not confirmed. Refresh before retrying.");
  const status=await memberInvoke<CG04MembershipEvidenceStatus>("/api/documents/membership/intents/"+intent.uploadRef+"/confirm","POST",{},token);
  if(!status.cleanVerified)throw Error("The security scan has not accepted this document.");
  await refresh();onChange();setMessage("Original document passed verification.");
 });
 const revoke=(ref:string,expectedVersion:number)=>void act(async()=>{await memberInvoke("/api/documents/membership/files/"+ref+"/revoke","POST",{expectedVersion},token);await refresh();onChange();setMessage("Previous proof revoked.");});
 const preview=(ref:string,mime:string)=>void act(async()=>{
  const r=await expoFetch(memberEndpoint("/api/documents/membership/files/"+ref+"/download"),{headers:{Authorization:"Bearer "+token}});
  if(!r.ok)throw Error("Protected document unavailable.");
  const serverMime=(r.headers.get("content-type")??"").split(";")[0].trim();
  if(serverMime!==mime||!["application/pdf","image/jpeg","image/png","image/webp"].includes(serverMime))throw Error("Protected document type could not be verified.");
  const bytes=await r.bytes();if(!bytes.length||bytes.length>10485760)throw Error("Document content could not be verified.");
  const suffix=mime==="application/pdf"?".pdf":mime==="image/png"?".png":mime==="image/webp"?".webp":".jpg";
  const local=new File(Paths.cache,"careganga-private-member-"+Crypto.randomUUID()+suffix);
  try{await local.write(bytes);previews.current.push(local);await local.preview({mimeType:mime,title:"CareGanga private membership evidence"});}
  finally{try{local.delete();}catch{}previews.current=previews.current.filter(f=>f.uri!==local.uri);}
 });
 const button=(title:string,fn:()=>void)=> <Pressable accessibilityRole="button" disabled={busy} onPress={fn} style={[s.button,busy&&{opacity:.5}]}><Text style={s.text}>{title}</Text></Pressable>;
 return <View style={s.card}><Text style={s.heading}>Private verified documents</Text><Text>Identity proof must be scanned and verified before submission. These files are not public.</Text>
 {!!message&&<Text accessibilityRole="alert">{message}</Text>}
 {editable&&<><View style={s.row}>{button("Select identity proof",()=>upload("MEMBER_IDENTITY_PROOF"))}{button("Optional photo",()=>upload("MEMBER_PORTRAIT"))}</View></>}
 {list?.files.map(f=><View key={f.fileRef} style={s.row}><Text>{f.classification==="MEMBER_IDENTITY_PROOF"?"Verified identity proof":"Verified photo"}</Text>{button("Open privately",()=>preview(f.fileRef,f.mime))}{editable&&button("Revoke",()=>revoke(f.fileRef,f.fileVersion))}</View>)}
 {!!list?.pending.length&&<Text>Document verification is pending. Refresh before submission.</Text>}
 {button("Refresh documents",()=>void act(refresh))}
 </View>;
}
const s=StyleSheet.create({card:{borderWidth:1,borderColor:"#d6e2dd",backgroundColor:"white",padding:14,borderRadius:12,gap:10},heading:{fontSize:17,fontWeight:"700"},row:{flexDirection:"row",alignItems:"center",gap:10,flexWrap:"wrap"},button:{borderWidth:1,borderColor:"#b8cfbf",borderRadius:9,padding:12,minHeight:44,justifyContent:"center"},text:{fontWeight:"600",color:"#174632"}});
