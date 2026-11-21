import {useCallback,useEffect,useRef,useState} from "react";
import {
  ActivityIndicator,Alert,BackHandler,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {File,Paths,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import type {
  CG03CaseView,CG19UploadStart,CG19UploadStatus
} from "@careganga/api-contracts";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {NativePrivateLetterPanel} from "./native-private-letter-panel";

type Props={token:string;onExit:()=>void;onExpired:()=>void;
 canViewLetters?:boolean;canRevokeLetters?:boolean};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
type Selected={uri:string;name:string;size:number;mime:string};
type Media={fileRef:string;revision:number;mime:string;sizeBytes:number;createdAt:string;revoked:boolean};
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:unknown){
  let response:Response;
  try{
    response=await identityRequest(path,{
      method,headers:{Authorization:"Bearer "+token,
        ...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
  }catch{throw Error(method==="POST"?"UNCERTAIN":"OFFLINE")}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("CHANGED");
  if(response.status===400)throw Error("INVALID");
  if(!response.ok)throw Error(method==="POST"?"UNCERTAIN":"OFFLINE");
  try{return await response.json() as T;}
  catch{throw Error(method==="POST"?"UNCERTAIN":"OFFLINE")}
}
function explain(error:unknown):string{
  const code=error instanceof Error?error.message:"UNCERTAIN";
  return code==="EXPIRED"?"Session expired. Sign in again.":
    code==="DENIED"?"Your current access does not permit this private file.":
    code==="CHANGED"?"The original application changed. Refresh to continue.":
    code==="INVALID"?"Check the file selection, type and size.":
    "The file action was not confirmed. Check the same original request before retrying.";
}
const statusLabel=(code:string)=>({
  VALIDATED:"File and malware scan verified",
  INITIATED:"Awaiting verified upload",
  UPLOAD_READY:"Upload permission ready, not yet verified",
  UNKNOWN:"File verification uncertain",
  STORAGE_UNAVAILABLE:"Secure storage unavailable",
  VERIFICATION_UNAVAILABLE:"Malware scan not verified",
  REJECTED:"File rejected",
  EXPIRED:"Upload permission expired"
} as Record<string,string>)[code]??"Private file not confirmed";

export function PrivateCaseEvidenceScreen({token,onExit,onExpired,
 canViewLetters=false,canRevokeLetters=false}:Props){
  const [list,setList]=useState<CG03CaseView[]>([]);
  const [selected,setSelected]=useState<CG03CaseView|null>(null);
  const [picked,setPicked]=useState<Selected|null>(null);
  const [media,setMedia]=useState<Media[]>([]);
  const [mediaBusy,setMediaBusy]=useState(false);
  const [revokeUncertain,setRevokeUncertain]=useState<string|null>(null);
  const mediaRequest=useRef(0);
  const [requestKey,setRequestKey]=useState("");
  const [intentRef,setIntentRef]=useState("");
  const [result,setResult]=useState<CG19UploadStart|CG19UploadStatus|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [uncertain,setUncertain]=useState(false);
  const [message,setMessage]=useState("");
  const fetchCases=useCallback(async()=>{
    setLoading(true);
    try{
      const data=await api<{cases:CG03CaseView[]}>(
        token,"/api/registration-approvals/cases?limit=30");
      if(!Array.isArray(data.cases)||data.cases.length>30||
        data.cases.some(c=>typeof c.caseRef!=="string"||
          typeof c.reference!=="string"||!Number.isInteger(c.proposalRevision)))
        throw Error("OFFLINE");
      setList(data.cases);
      setSelected(old=>old?data.cases.find(c=>c.caseRef===old.caseRef)??null:null);
    }catch(e){
      setList([]);setSelected(null);
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
      else setMessage(explain(e));
    }finally{setLoading(false);}
  },[token,onExpired]);
  useEffect(()=>{void fetchCases()},[fetchCases]);
  const loadMedia=useCallback(async()=>{
    const seq=++mediaRequest.current;
    if(!selected){setMedia([]);return;}
    setMediaBusy(true);
    try{
      const files=await api<{files:Media[]}>(token,
        "/api/documents/files/case/"+encodeURIComponent(selected.caseRef));
      if(!Array.isArray(files.files)||files.files.length>30)
        throw Error("OFFLINE");
      if(seq!==mediaRequest.current)return;
      setMedia(files.files);
      setRevokeUncertain(old=>old&&files.files.some(v=>v.fileRef===old&&v.revoked)?null:old);

    }catch(e){
      if(seq===mediaRequest.current){
        setMedia([]);
        if(e instanceof Error&&e.message==="EXPIRED")onExpired();
        else setMessage(explain(e));
      }
    }finally{
      if(seq===mediaRequest.current)setMediaBusy(false);
    }
  },[selected?.caseRef,token,onExpired]);
  useEffect(()=>{void loadMedia();return()=>{++mediaRequest.current};},[loadMedia]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(busy||uncertain)return true;
      onExit();return true;
    });
    return()=>sub.remove();
  },[busy,uncertain,onExit]);
  function clearFile(){
    if(busy||uncertain)return;
    setPicked(null);setResult(null);setIntentRef("");setRequestKey("");setMessage("");
  }
  async function choose(){
    if(busy||uncertain||!selected)return;
    try{
      const response=await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory:true,multiple:false,
        type:["application/pdf","image/jpeg","image/png","image/webp"]
      });
      if(response.canceled)return;
      const asset=response.assets?.[0];
      if(!asset||!asset.mimeType||!MIME.has(asset.mimeType)||
        !asset.size||asset.size<1||asset.size>10*1024*1024){
        setMessage("Select a PDF, JPG, PNG or WebP file under 10 MB.");return;
      }
      setPicked({uri:asset.uri,name:asset.name,size:asset.size,mime:asset.mimeType});
      setRequestKey("");setIntentRef("");setResult(null);setMessage("");
    }catch{setMessage("The document picker could not open. Try again.")}
  }
  async function checkPrevious(){
    if(!intentRef||busy)return;
    setBusy(true);
    try{
      const status=await api<CG19UploadStatus>(
        token,"/api/documents/files/intents/"+encodeURIComponent(intentRef));
      if(typeof status.status!=="string"||typeof status.cleanVerified!=="boolean")
        throw Error("OFFLINE");
      setResult(status);setUncertain(false);
      setMessage(status.cleanVerified?
        "Verified private evidence is recorded.":
        "Original request: "+statusLabel(status.status)+". Do not assume file acceptance.");
    }catch(e){
      setUncertain(true);setMessage(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false);}
  }
  async function upload(){
    if(!picked||!selected||busy||uncertain)return;
    const key=requestKey||Crypto.randomUUID();
    setRequestKey(key);setBusy(true);setMessage("");
    try{
      const nativeFile=new File(picked.uri);
      const digest=await nativeFile.digest("SHA-256");
      if(!/^[0-9a-f]{64}$/.test(digest))throw Error("UNCERTAIN");
      const initiated=await api<CG19UploadStart>(token,
        "/api/documents/files/initiate","POST",{
          caseRef:selected.caseRef,sourceRevision:selected.proposalRevision,
          requestKey:key,mime:picked.mime,sizeBytes:picked.size,sha256:digest
        });
      if(typeof initiated.uploadRef!=="string"||typeof initiated.status!=="string")
        throw Error("UNCERTAIN");
      setIntentRef(initiated.uploadRef);setResult(initiated);
      if(initiated.status==="STORAGE_UNAVAILABLE"||!initiated.uploadUrl){
        setMessage("Secure file storage is not available. No file was accepted.");return;
      }
      if(!initiated.uploadUrl.startsWith("https://")||!initiated.uploadHeaders||
        initiated.uploadHeaders["Content-Type"]!==picked.mime)throw Error("UNCERTAIN");
      const task=nativeFile.createUploadTask(initiated.uploadUrl,{
        httpMethod:"PUT",uploadType:UploadType.BINARY_CONTENT,mimeType:picked.mime,
        headers:initiated.uploadHeaders,
        sessionType:"foreground"
      });
      const uploaded=await task.uploadAsync();
      task.release();
      if(uploaded.status<200||uploaded.status>=300)throw Error("UNCERTAIN");
      // An HTTP upload success is not evidence of a clean file. Only the
      // server's independently checked object and malware scan can confirm.
      const result=await api<CG19UploadStatus>(
        token,"/api/documents/files/intents/"+encodeURIComponent(initiated.uploadRef)+
        "/confirm","POST");
      if(typeof result.cleanVerified!=="boolean")throw Error("UNCERTAIN");
      setResult(result);setUncertain(!result.cleanVerified);
      setMessage(result.cleanVerified?
        "File is confirmed private and clean. The approval was not modified.":
        "File verification was not confirmed. Check the original request.");
    }catch(e){
      setUncertain(true);setMessage(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false);}
  }
  async function revokeMedia(item:Media){
    if(item.revoked||!selected||busy||mediaBusy||uncertain||
       revokeUncertain||!item.fileRef||!Number.isInteger(item.revision))return;
    setBusy(true);setMessage("");
    try{
      const outcome=await api<{revoked:boolean;revision:number}>(
        token,"/api/documents/files/"+encodeURIComponent(item.fileRef)+
        "/revoke","POST",{expectedRevision:item.revision});
      if(outcome.revoked!==true)throw Error("UNCERTAIN");
      setMessage("Verified private file revoked; original audit history retained.");
      await loadMedia();
    }catch(e){
      if(e instanceof Error&&(e.message==="UNCERTAIN"||e.message==="OFFLINE")){
        setRevokeUncertain(item.fileRef);
        setMessage("Revocation outcome is uncertain. Refresh the original file "+
          "record before any further action. Do not send another revoke request.");
      }else setMessage(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false);}
  }
  async function previewVerified(ref:string,kind:"file"|"letter"="file"){
    if(!ref||busy)return;
    setBusy(true);setMessage("");
    let temporary:File|null=null;
    try{
      const response=await identityRequest(
        "/api/documents/"+(kind==="letter"?"letters/":"files/")+
        encodeURIComponent(ref)+"/download",{
          method:"GET",headers:{Authorization:"Bearer "+token}
        });
      if(response.status===401){onExpired();return;}
      if(!response.ok)throw Error(response.status===403?"DENIED":"OFFLINE");
      const mime=response.headers.get("content-type")??"";
      if(!MIME.has(mime)||(kind==="letter"&&mime!=="application/pdf"))
        throw Error("OFFLINE");
      const rawLength=response.headers.get("content-length");
      const expected=rawLength===null?null:Number(rawLength);
      if(expected!==null&&(!Number.isSafeInteger(expected)||expected<1||
        expected>10*1024*1024))throw Error("OFFLINE");
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length<1||bytes.length>10*1024*1024||
        (expected!==null&&bytes.length!==expected))
        throw Error("OFFLINE");
      const suffix=mime==="application/pdf"?".pdf":
        mime==="image/jpeg"?".jpg":mime==="image/png"?".png":".webp";
      temporary=new File(Paths.cache,"careganga-private-"+Crypto.randomUUID()+suffix);
      temporary.create();
      await temporary.write(bytes);
      await temporary.preview({title:"Private case evidence"});
    }catch(e){setMessage(explain(e))}
    finally{try{temporary?.delete();}catch{}setBusy(false);}
  }
  const verified=result&&"cleanVerified" in result&&result.cleanVerified;
  return <SafeAreaView style={styles.page} edges={["left","right"]}>
    <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined}
      style={styles.page}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={onExit} disabled={busy||uncertain}
            style={styles.button}><Text>Back</Text></Pressable>
          <Text accessibilityRole="header" style={styles.title}>Private case documents</Text>
        </View>
        <Text style={styles.muted}>Only evidence for a currently authorized
          Foundation application may be uploaded or viewed.</Text>
        {!!message&&<Text accessibilityRole="alert" style={styles.alert}>{message}</Text>}
        <View style={styles.card}>
          <Text style={styles.heading}>Choose protected application</Text>
          {loading?<ActivityIndicator accessibilityLabel="Verifying applications"/>:
            !list.length?<Text>No authorized applications are available.</Text>:
            list.map(c=><Pressable key={c.caseRef} accessibilityRole="button"
              accessibilityState={{selected:selected?.caseRef===c.caseRef}}
              disabled={busy||uncertain}
              onPress={()=>{setSelected(c);setRevokeUncertain(null);clearFile();}}
              style={[styles.option,selected?.caseRef===c.caseRef&&styles.chosen]}>
              <Text style={styles.heading}>{c.reference}</Text>
              <Text>{c.accountName}</Text>
              <Text style={styles.muted}>{c.status.replace(/_/g," ")} · Revision {c.proposalRevision}</Text>
            </Pressable>)}
          <Pressable accessibilityRole="button" style={styles.button}
            disabled={busy||uncertain||loading} onPress={()=>void fetchCases()}>
            <Text>Refresh applications</Text>
          </Pressable>
        </View>
        {selected&&<View style={styles.card}>
          <Text style={styles.heading}>Private evidence</Text>
          <Text style={styles.muted}>After a final review, new evidence is archival only
            and cannot change the signed approval.</Text>
          <Pressable accessibilityRole="button" disabled={busy||uncertain}
            onPress={()=>void choose()} style={styles.button}>
            <Text>Choose file (PDF or image, max 10 MB)</Text>
          </Pressable>
          {!!picked&&<Text>{picked.name} · {(picked.size/1048576).toFixed(2)} MB</Text>}
          {!!result&&<Text accessibilityRole="text">Upload status: {statusLabel(result.status)}</Text>}
          {uncertain&&<View style={styles.card}>
            <Text style={styles.heading}>Previous upload uncertain</Text>
            <Text>Never repeat the request before checking the original status.</Text>
            <Pressable accessibilityRole="button" style={styles.button}
              disabled={!intentRef||busy} onPress={()=>void checkPrevious()}>
              <Text>Check original upload status</Text>
            </Pressable>
            {!intentRef&&<Text>Contact Foundation support: the original request
              reference was not confirmed.</Text>}
          </View>}
          {!uncertain&&<View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={!picked||busy}
              style={styles.primary} onPress={()=>void upload()}>
              <Text style={styles.primaryText}>{busy?"Verifying…":"Upload & verify"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.button}
              disabled={busy} onPress={()=>void checkPrevious()}>
              <Text>Refresh verification status</Text>
            </Pressable>
          </View>}
          {!!verified&&<View style={styles.card}>
            <Text style={styles.muted}>Verified private evidence is recorded.
              Files open only through an authorized app-private preview.</Text>
            {result&&"fileRef" in result&&result.fileRef&&
              <Pressable accessibilityRole="button" style={styles.button}
                disabled={busy} onPress={()=>void previewVerified(result.fileRef as string)}> 
                <Text>Preview verified private file</Text>
              </Pressable>}
          </View>}
        </View>}
        {selected&&<View style={styles.card}>
          <Text style={styles.heading}>Verified case file library</Text>
          {mediaBusy?<ActivityIndicator accessibilityLabel="Loading verified case files"/>:
            !media.length?<Text>No verified private files for this application.</Text>:
            media.map(item=><View key={item.fileRef} style={styles.option}>
              <Text>{item.mime} · {(item.sizeBytes/1024).toFixed(0)} KB</Text>
              <Text style={styles.muted}>{item.revoked?"Revoked":"Verified private file"}</Text>
              {!item.revoked&&<Pressable accessibilityRole="button" style={styles.button}
                disabled={busy} onPress={()=>void previewVerified(item.fileRef)}>
                <Text>Preview private file</Text>
              </Pressable>}
              {!item.revoked&&<Pressable accessibilityRole="button"
                style={styles.button} disabled={busy||uncertain||!!revokeUncertain}
                onPress={()=>Alert.alert("Revoke original private file",
                 "Future authorized downloads will be blocked. "+
                 "Original evidence history stays in the case.",[
                   {text:"Cancel",style:"cancel"},
                   {text:"Revoke",style:"destructive",
                    onPress:()=>void revokeMedia(item)}
                 ])}>
                <Text>Review and revoke private file</Text>
              </Pressable>}
            </View>)}
          {!!revokeUncertain&&<Text accessibilityRole="alert" style={styles.alert}>
            An original revocation is unconfirmed. Refresh current verified
            files. If still not revoked, contact Foundation operations before
            another attempt; never infer success from an uncertain response.
          </Text>}
          <Pressable accessibilityRole="button" style={styles.button}
            disabled={busy||mediaBusy} onPress={()=>void loadMedia()}>
            <Text>Refresh verified files and revocation status</Text>
          </Pressable>
        </View>}
        {selected&&canViewLetters&&
          <NativePrivateLetterPanel key={selected.caseRef+"-"+selected.proposalRevision}
            token={token} caseRef={selected.caseRef}
            sourceRevision={selected.proposalRevision}
            canIssue={canViewLetters} canRevoke={canRevokeLetters}
            onExpired={onExpired}
            onPreview={async ref=>{await previewVerified(ref,"letter")}}/>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.adminCanvas},
  content:{padding:18,gap:15,paddingBottom:96,maxWidth:760,width:"100%",alignSelf:"center"},
  row:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10},
  title:{fontSize:21,fontWeight:"700",color:theme.text,flexShrink:1},
  heading:{fontWeight:"700",fontSize:16,color:theme.text},
  card:{backgroundColor:theme.surface,borderColor:theme.border,borderWidth:1,
    borderRadius:14,padding:15,gap:12,
    shadowColor:theme.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
  option:{padding:12,borderWidth:1,borderRadius:8,borderColor:theme.border,
    minHeight:54,gap:3},
  chosen:{borderColor:theme.selectedNavigation,backgroundColor:theme.surface},
  button:{paddingHorizontal:14,paddingVertical:12,borderColor:theme.border,
    borderWidth:1,borderRadius:12,minHeight:48,justifyContent:"center"},
  primary:{paddingHorizontal:14,paddingVertical:12,backgroundColor:theme.primary,
    borderRadius:12,minHeight:48,justifyContent:"center"},
  primaryText:{fontWeight:"700",color:theme.primaryText},
  muted:{fontSize:13,color:theme.mutedText},
  alert:{color:theme.error,backgroundColor:theme.surface,padding:11,borderRadius:8}
});
