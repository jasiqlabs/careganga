import React,{useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {File,Paths,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import type {CG19MemberBrandStatus,CG19MemberPackStatus} from "@careganga/api-contracts";
import {identityRequest} from "../identity-access/http-client";

type AssetKind="LOGO"|"SIGNATURE"|"SEAL";
type Pending={path:string;body:Record<string,unknown>};
type Asset={assetRef:string;kind:AssetKind;status:string;verified:boolean;uploadUrl?:string;uploadHeaders?:Record<string,string>};
const kinds=["CARD","CERTIFICATE","WELCOME"] as const;
const show=(value:string)=>value.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
export function NativeMemberDocuments({token,memberRef,memberNumber,onExpired}:{
 token:string;memberRef?:string|null;memberNumber?:string;onExpired:()=>void
}){
 const [open,setOpen]=useState(false),[brand,setBrand]=useState<CG19MemberBrandStatus|null>(null);
 const [assetRefs,setAssetRefs]=useState<Partial<Record<AssetKind,string>>>({}),[pack,setPack]=useState<CG19MemberPackStatus|null>(null);
 const [displayName,setDisplayName]=useState(""),[signatoryName,setSignatoryName]=useState(""),[password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const pending=useRef<Pending|null>(null),running=useRef(false),foreground=useRef(true),seq=useRef(0);
 async function request<T>(path:string,body?:Record<string,unknown>):Promise<T>{
  const r=await identityRequest("/api/v1/membership/documents"+path,{
   method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"
  });
  if(r.status===401){onExpired();throw Error("Sign in again.");}
  if(!r.ok)throw Error(r.status===403?"Current role cannot issue Foundation membership documents.":r.status===400?"Check the verified branding and required fields.":r.status===409?"The issued document source changed. Refresh the original member status.":"Official document outcome uncertain. Refresh before retrying.");
  return await r.json() as T;
 }
 const refresh=useCallback(async()=>{
  const current=++seq.current;setLoading(true);
  try{
   const [status,membership]=await Promise.all([request<CG19MemberBrandStatus>("/config"),
    memberRef?request<{pack:CG19MemberPackStatus|null}>("/members/"+memberRef):Promise.resolve({pack:null})]);
   if(current===seq.current&&foreground.current){setBrand(status);setPack(membership.pack);}
  }catch(e){if(current===seq.current&&foreground.current)setError(e instanceof Error?e.message:"Official documents unavailable.");}
  finally{if(current===seq.current&&foreground.current)setLoading(false);}
 },[token,memberRef]);
 useEffect(()=>{if(memberRef)setOpen(true);setPack(null);},[memberRef]);
 useEffect(()=>{if(open)void refresh();},[open,refresh]);
 useEffect(()=>{const sub=AppState.addEventListener("change",state=>{
  foreground.current=state==="active";
  if(state!=="active"){seq.current++;setPack(null);setBrand(null);setAssetRefs({});setPassword("");setLoading(true);}
  else if(open)void refresh();
 });return()=>sub.remove();},[open,refresh]);
 const action=async(fn:()=>Promise<void>)=>{
  if(running.current)return;running.current=true;setBusy(true);setError("");setNotice("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Document result uncertain. Refresh its current status.");}
  finally{running.current=false;setBusy(false);setPassword("");}
 };
 const chip=(label:string,onClick:()=>void,disabled=false)=>(
  <Pressable accessibilityRole="button" disabled={disabled||busy||loading} onPress={onClick} style={[styles.chip,(disabled||busy||loading)&&styles.disabled]}>
   <Text style={styles.chipLabel}>{label}</Text>
  </Pressable>
 );
 async function pick(kind:AssetKind){
  await action(async()=>{
   const filePick=await File.pickFileAsync({mimeTypes:["image/png","image/jpeg"]});
   if(filePick.canceled)return;
   const file=filePick.result,mime=file.type,size=file.size;
   if(!["image/png","image/jpeg"].includes(mime)||size<1||size>2097152)throw Error("Select an authentic Foundation JPG/PNG under 2 MB.");
   const sha256=await file.digest("SHA-256");
   const upload=await request<Asset>("/assets",{kind,requestKey:Crypto.randomUUID(),mime,sizeBytes:size,sha256});
   if(upload.status!=="UPLOAD_READY"||!upload.uploadUrl||!upload.uploadHeaders)throw Error("Private branding storage is not configured.");
   const sent=await file.createUploadTask(upload.uploadUrl,{httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,mimeType:mime,headers:upload.uploadHeaders}).uploadAsync();
   if(sent.status<200||sent.status>=300)throw Error("Official branding upload was not confirmed.");
   const verified=await request<Asset>("/assets/"+upload.assetRef+"/confirm",{});
   if(!verified.verified)throw Error("Secure document verification is pending or rejected.");
   setAssetRefs(old=>({...old,[kind]:verified.assetRef}));setNotice(show(kind)+" has passed original secure verification.");
  });
 }
 const send=(cmd:Pending,secret:string)=>void action(async()=>{
  if(secret.length<8)throw Error("Enter the current Foundation password.");
  pending.current=cmd;
  await request(cmd.path,{...cmd.body,currentPassword:secret});
  pending.current=null;await refresh();setNotice("Original Foundation document request confirmed. Check current status.");
 });
 const configure=()=>{
  if(!assetRefs.LOGO||!assetRefs.SIGNATURE||!assetRefs.SEAL)return;
  send({path:"/config",body:{displayName:displayName.trim(),signatoryName:signatoryName.trim(),
   signatureAssetRef:assetRefs.SIGNATURE,sealAssetRef:assetRefs.SEAL,logoAssetRef:assetRefs.LOGO,
   expectedVersion:brand?.version??0,requestKey:Crypto.randomUUID()}},password);
 };
 const issue=()=>{if(memberRef)send({path:"/members/"+memberRef+"/issue",body:{requestKey:Crypto.randomUUID()}},password);};
 async function share(ref:string,kind:typeof kinds[number]){
  await action(async()=>{
   let file:File|null=null;
   try{
    const r=await identityRequest("/api/v1/membership/documents/packs/"+ref+"/"+kind+"/download",{
     headers:{Authorization:"Bearer "+token},cache:"no-store"
    });
    if(r.status===401){onExpired();throw Error("Sign in again.");}
    if(!r.ok)throw Error("Official document is no longer authorized. Refresh before downloading.");
    if((r.headers.get("content-type")??"").split(";")[0].trim()!=="application/pdf")throw Error("Official PDF format is unavailable.");
    const data=new Uint8Array(await r.arrayBuffer());
    if(!data.length||data.length>10485760)throw Error("Private issued document is invalid.");
    if(!await Sharing.isAvailableAsync())throw Error("Official document sharing is unavailable on this device.");
    file=new File(Paths.cache,"careganga-private-member-issued-"+Crypto.randomUUID()+".pdf");
    file.create();file.write(data);
    await Sharing.shareAsync(file.uri,{mimeType:"application/pdf",dialogTitle:"Open protected issued membership PDF"});
    setNotice("Protected official document opened. Share it only when permitted.");
   }finally{try{file?.delete();}catch{}}
  });
 }
 return <View style={styles.card}>
  <Text style={styles.heading}>Official membership documents</Text>
  <Text style={styles.muted}>Current actual Foundation branding and signed member PDF issuance only.</Text>
  {chip(open?"Hide official document tools":"Open official document tools",()=>{setOpen(v=>!v);setPassword("");})}
  {open&&<>
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text style={styles.muted}>{notice}</Text>}
   {chip("Refresh official state",()=>void refresh())}
   {brand&&!brand.configured&&<View style={styles.card}>
    <Text style={styles.heading}>Verify official Foundation assets</Text>
    <Text style={styles.muted}>Upload the real approved logo, seal and authorized signature, never client example artwork.</Text>
    {(["LOGO","SIGNATURE","SEAL"] as const).map(kind=><View key={kind} style={styles.item}>
     <Text style={styles.label}>{show(kind)} · {assetRefs[kind]?"Verified":"Missing verified file"}</Text>
     {chip("Select actual "+show(kind).toLowerCase(),()=>void pick(kind))}
    </View>)}
    <Text style={styles.label}>Foundation display name</Text>
    <TextInput accessibilityLabel="Approved Foundation display name" maxLength={120} style={styles.input} value={displayName} onChangeText={setDisplayName}/>
    <Text style={styles.label}>Authorized signatory name</Text>
    <TextInput accessibilityLabel="Authorized signatory" maxLength={120} style={styles.input} value={signatoryName} onChangeText={setSignatoryName}/>
    <Text style={styles.label}>Current Foundation password</Text>
    <TextInput accessibilityLabel="Password to approve official branding" secureTextEntry style={styles.input} value={password} onChangeText={setPassword}/>
    {chip("Approve genuine official branding",configure,!assetRefs.LOGO||!assetRefs.SEAL||!assetRefs.SIGNATURE||!displayName.trim()||!signatoryName.trim()||password.length<8||!!pending.current)}
   </View>}
   {brand?.configured&&<Text style={styles.muted}>Approved: {brand.displayName} · Signatory: {brand.signatoryName} · Brand version {brand.version}</Text>}
   {memberRef&&<View style={styles.item}>
    <Text style={styles.heading}>Member {memberNumber??"selected"}</Text>
    <Text>Current official pack: {pack?show(pack.status):"Not issued"}</Text>
    {pack?.canDownload&&<View style={styles.buttons}>{kinds.map(kind=><React.Fragment key={kind}>
     {chip("Open "+(kind==="CARD"?"front/back card":kind==="CERTIFICATE"?"certificate":"welcome letter")+" PDF",()=>void share(pack.packRef,kind))}
    </React.Fragment>)}</View>}
    {pack?.canRetry&&chip("Retry original PDF verification",()=>void action(async()=>{await request("/packs/"+pack.packRef+"/reconcile",{});await refresh();}))}
    {brand?.configured&&(!pack||pack.status==="REVOKED")&&<>
     <Text style={styles.label}>Current password to issue actual documents</Text>
     <TextInput accessibilityLabel="Password for official member issuance" secureTextEntry style={styles.input} value={password} onChangeText={setPassword}/>
     {chip("Issue three verified PDF documents",issue,password.length<8||!!pending.current)}
    </>}
    {pack&&pack.status!=="REVOKED"&&<>
     <Text style={styles.label}>Current password to revoke document</Text>
     <TextInput accessibilityLabel="Password for document revocation" secureTextEntry style={styles.input} value={password} onChangeText={setPassword}/>
     {chip("Revoke current official pack",()=>void action(async()=>{await request("/packs/"+pack.packRef+"/revoke",{currentPassword:password});await refresh();}),password.length<8)}
    </>}
   </View>}
   {pending.current&&<View style={styles.item}><Text style={styles.muted}>Outcome uncertain. Refresh the existing record and re-enter your password to retry the exact original command.</Text>
    <TextInput secureTextEntry accessibilityLabel="Re-enter password for original request retry" style={styles.input} value={password} onChangeText={setPassword}/>
    {chip("Retry exact original request",()=>{const original=pending.current;if(original)send(original,password);},password.length<8)}
   </View>}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 card:{backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border,borderRadius:12,padding:14,gap:10},
 heading:{fontSize:16,fontWeight:"800",color:theme.text},
 label:{fontSize:13,fontWeight:"600",color:theme.text},
 muted:{fontSize:13,color:theme.mutedText,lineHeight:20},
 error:{fontSize:13,color:theme.error},
 item:{paddingVertical:10,gap:8,borderTopWidth:1,borderColor:theme.border},
 input:{minHeight:46,padding:11,borderWidth:1,borderColor:theme.border,borderRadius:9,color:theme.text},
 buttons:{gap:8,flexDirection:"row",flexWrap:"wrap"},
 chip:{paddingVertical:10,paddingHorizontal:12,minHeight:44,borderWidth:1,borderColor:theme.border,backgroundColor:theme.selectedSurface,borderRadius:9,justifyContent:"center"},
 chipLabel:{fontSize:13,color:theme.primary,fontWeight:"700"},
 disabled:{opacity:0.45}
});
