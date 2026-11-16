import {useCallback,useEffect,useState} from "react";
import {
  ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,View
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import {File,UploadType} from "expo-file-system";
import * as Crypto from "expo-crypto";
import type {
  CG03CaseView,CG19UploadStart,CG19UploadStatus
} from "@careganga/api-contracts";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Props={token:string;onExit:()=>void;onExpired:()=>void};
const MIME=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
type Selected={uri:string;name:string;size:number;mime:string};
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

export function PrivateCaseEvidenceScreen({token,onExit,onExpired}:Props){
  const [list,setList]=useState<CG03CaseView[]>([]);
  const [selected,setSelected]=useState<CG03CaseView|null>(null);
  const [picked,setPicked]=useState<Selected|null>(null);
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
  const verified=result&&"cleanVerified" in result&&result.cleanVerified;
  return <SafeAreaView style={styles.page}>
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
              onPress={()=>{setSelected(c);clearFile();}}
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
          {!!verified&&<Text style={styles.muted}>Verified private evidence is recorded.
            A direct public download or identity QR is never provided.</Text>}
        </View>}
        <View style={styles.card}>
          <Text style={styles.heading}>Approved-access letters</Text>
          <Text>Letter issuance is unavailable in this checkpoint. No pending
            application or unscanned file is called an issued document.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.background},
  content:{padding:18,gap:15,paddingBottom:40,maxWidth:760,width:"100%",alignSelf:"center"},
  row:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:10},
  title:{fontSize:21,fontWeight:"700",color:theme.text,flexShrink:1},
  heading:{fontWeight:"700",fontSize:16,color:theme.text},
  card:{backgroundColor:theme.surface,borderColor:theme.border,borderWidth:1,
    borderRadius:12,padding:15,gap:12},
  option:{padding:12,borderWidth:1,borderRadius:8,borderColor:theme.border,
    minHeight:54,gap:3},
  chosen:{borderColor:theme.selectedNavigation,backgroundColor:"#EEF4FF"},
  button:{paddingHorizontal:14,paddingVertical:12,borderColor:theme.border,
    borderWidth:1,borderRadius:8,minHeight:48,justifyContent:"center"},
  primary:{paddingHorizontal:14,paddingVertical:12,backgroundColor:theme.primary,
    borderRadius:8,minHeight:48,justifyContent:"center"},
  primaryText:{fontWeight:"700",color:theme.primaryText},
  muted:{fontSize:13,color:theme.mutedText},
  alert:{color:theme.error,backgroundColor:theme.surface,padding:11,borderRadius:8}
});
