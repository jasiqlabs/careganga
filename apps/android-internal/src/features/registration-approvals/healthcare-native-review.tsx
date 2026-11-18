import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,BackHandler,KeyboardAvoidingView,Platform,Pressable,
  ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type Kind="HEALTH_PROVIDER_VERIFICATION"|"HEALTH_CENTER_VERIFICATION"|"HEALTH_DOCTOR_VERIFICATION";
type Review={caseRef:string;reference:string;title:string;kind:Kind;status:string;revision:number};
type Detail=Review&{source:null|{source:Record<string,unknown>;proofStatus:string}};
type Props={token:string;canDoctors:boolean;canProviders:boolean;
  canManageDoctors:boolean;canManageProviders:boolean;
  onExit:()=>void;onExpired:()=>void};
const label=(s:string)=>s.replace(/([a-z])([A-Z])/g,"$1 $2")
  .replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const caption=(kind:Kind)=>kind==="HEALTH_DOCTOR_VERIFICATION"?
  "Doctor":kind==="HEALTH_PROVIDER_VERIFICATION"?"Provider":"Center";
type HttpError=Error&{status?:number};
async function request<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object):Promise<T>{
  let response:Response;
  try{
    response=await identityRequest(path,{method,cache:"no-store",
      headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
  }catch{throw Object.assign(new Error("Network result could not be confirmed."),{status:503});}
  if(!response.ok){
    const data:unknown=await response.json().catch(()=>null);
    const safe=data&&typeof data==="object"&&"message" in data&&
      typeof data.message==="string"&&data.message.length<=220?data.message:
      response.status===401?"Session expired. Sign in again.":
      response.status===403?"Your current role cannot review this healthcare record.":
      response.status===409?"The original review changed. Refresh before continuing.":
      response.status===400?"Check the original review details.":"The review result is uncertain. Refresh before retrying.";
    throw Object.assign(new Error(safe),{status:response.status});
  }
  try{return await response.json() as T;}
  catch{throw Object.assign(new Error("Review response could not be verified."),{status:503});}
}
function renderable(v:unknown):string{
  if(typeof v==="string")return v.length<=250?v:v.slice(0,250)+"…";
  if(typeof v==="number"&&Number.isFinite(v))return String(v);
  if(Array.isArray(v))return v.filter(x=>typeof x==="string").slice(0,12).join(", ");
  return "Not specified";
}
export function HealthcareNativeReview({token,canDoctors,canProviders,
  canManageDoctors,canManageProviders,onExit,onExpired}:Props){
  const [cases,setCases]=useState<Review[]>([]);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  const [kind,setKind]=useState<Kind|"ALL">(canDoctors&&!canProviders?"HEALTH_DOCTOR_VERIFICATION":"ALL");
  const [query,setQuery]=useState("");
  const [applied,setApplied]=useState("");
  const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
  const [remarks,setRemarks]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const requestKey=useRef("");
  const serial=useRef(0);
  const permission=(e:unknown)=>{
    if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
    setError(e instanceof Error?e.message:"The original reviewer status is unavailable.");
  };
  const load=useCallback(async(offset=0)=>{
    const id=++serial.current;
    const params="?offset="+offset+"&kind="+encodeURIComponent(kind)+
      "&q="+encodeURIComponent(applied)+"&status=ALL";
    const out=await request<{cases:Review[];nextOffset:number|null}>(
      token,"/api/health/reviews"+params);
    if(id!==serial.current)return;
    if(!Array.isArray(out.cases)||out.cases.length>40)
      throw Error("The original review queue returned invalid results.");
    if(offset===0)setCases(out.cases);
    else setCases(previous=>{
      const known=new Set(previous.map(x=>x.caseRef));
      return [...previous,...out.cases.filter(x=>!known.has(x.caseRef))];
    });
    setNextOffset(Number.isSafeInteger(out.nextOffset)?out.nextOffset:null);
  },[token,kind,applied]);
  useEffect(()=>{
    let alive=true;setLoading(true);setDetail(null);setCases([]);
    void load().catch(e=>{if(alive)permission(e)})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false;++serial.current};
  },[load]);
  useEffect(()=>{
    const subscription=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(busy||uncertain)return true;
      if(detail)setDetail(null);else onExit();
      return true;
    });
    return()=>subscription.remove();
  },[busy,uncertain,detail,onExit]);
  async function open(ref:string){
    setError("");setNotice("");setPassword("");setRemarks("");
    setUncertain(false);requestKey.current="";
    try{
      const data=await request<Detail>(token,"/api/health/reviews/"+encodeURIComponent(ref));
      if(!data.caseRef||!data.kind)throw Error("Original review is unavailable.");
      setDetail(data);
    }catch(e){permission(e)}
  }
  async function refresh(){
    setError("");setNotice("");
    try{
      await load(0);
      if(detail){
        const found=await request<Detail>(token,"/api/health/reviews/"+
          encodeURIComponent(detail.caseRef));
        setDetail(found);
      }
      setUncertain(false);requestKey.current="";
    }catch(e){permission(e)}
  }
  async function decide(){
    if(!detail||busy||uncertain||password.length<8||
      !["SUBMITTED","IN_REVIEW"].includes(detail.status))return;
    if(!requestKey.current)requestKey.current=Crypto.randomUUID();
    setBusy(true);setError("");setNotice("");
    try{
      await request(token,"/api/health/reviews/"+
        encodeURIComponent(detail.caseRef)+"/decide","POST",{
          requestKey:requestKey.current,expectedRevision:detail.revision,
          action,remarks,currentPassword:password
        });
      requestKey.current="";setPassword("");
      await refresh();
      setNotice("Independent reviewer decision recorded. Foundation application is a separate step.");
    }catch(e){
      setPassword("");permission(e);
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
      else requestKey.current="";
    }finally{setBusy(false)}
  }
  async function finalize(operation:"apply"|"return-to-draft"){
    if(!detail||busy||uncertain)return;
    const ref=detail.caseRef;
    const source=detail.kind==="HEALTH_DOCTOR_VERIFICATION"?"doctors":
      detail.kind==="HEALTH_PROVIDER_VERIFICATION"?"providers":"centers";
    setBusy(true);setError("");setNotice("");
    try{
      await request(token,"/api/v1/health-network/"+source+"/reviews/"+
        encodeURIComponent(ref)+"/"+operation,"POST",{});
      await refresh();
      setNotice(operation==="apply"?
        "Independent approval applied to its original registration. Other permissions remain separate.":
        "Application returned to pending for corrections and new evidence.");
    }catch(e){
      permission(e);
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false)}
  }
  async function viewProtectedEvidence(){
    if(!detail||busy||!detail.source)return;
    setBusy(true);setError("");
    let temporary:File|null=null;
    try{
      const kind=detail.kind==="HEALTH_DOCTOR_VERIFICATION"?
        "doctor-evidence":"health-draft";
      const res=await identityRequest("/api/documents/"+kind+"/reviews/"+
        encodeURIComponent(detail.caseRef)+"/download",{
          method:"GET",headers:{Authorization:"Bearer "+token}});
      if(res.status===401){onExpired();return;}
      if(!res.ok)throw Error("Private original review evidence is not available to your current role.");
      const mime=(res.headers.get("content-type")??"").split(";")[0].trim();
      const supported=["application/pdf","image/jpeg","image/png","image/webp"];
      if(!supported.includes(mime))throw Error("Private file type could not be verified.");
      const len=res.headers.get("content-length");
      if(len!==null&&(!Number.isSafeInteger(Number(len))||Number(len)<1||
        Number(len)>10485760))throw Error("Private file exceeds the preview limit.");
      const bytes=new Uint8Array(await res.arrayBuffer());
      if(bytes.length<1||bytes.length>10485760||
        (len!==null&&bytes.length!==Number(len)))
        throw Error("The original private file could not be verified.");
      const ext=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":
        mime==="image/png"?"png":"webp";
      temporary=new File(Paths.cache,"careganga-health-review-"+Crypto.randomUUID()+"."+ext);
      temporary.create();await temporary.write(bytes);
      await temporary.preview({title:"Private healthcare reviewer evidence"});
    }catch(e){permission(e)}
    finally{try{temporary?.delete()}catch{}setBusy(false)}
  }
  const canManage=(item:Detail)=>item.kind==="HEALTH_DOCTOR_VERIFICATION"?
    canManageDoctors:canManageProviders;
  const rows=detail?.source?Object.entries(detail.source.source).filter(([key])=>
    !/(?:Ref|Id|digest|file|url|token|objectKey|bank)/i.test(key)):[];
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.page}
      behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" style={styles.button}
            disabled={busy||uncertain}
            onPress={()=>{if(detail)setDetail(null);else onExit()}}>
            <Text style={styles.link}>Back</Text>
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">Healthcare verification</Text>
        </View>
        <Text style={styles.hint}>Original Foundation review records. Only approved,
          currently authorized staff may decide. No action creates bookings or payments.</Text>
        {loading&&<ActivityIndicator color={t.primary}/>}
        {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!!notice&&<Text accessibilityRole="summary" style={styles.hint}>{notice}</Text>}
        {uncertain&&<View style={styles.card}>
          <Text style={styles.error}>The last change may have succeeded. Check the original case
            before another review action.</Text>
          <Pressable accessibilityRole="button" style={styles.button}
            disabled={busy} onPress={()=>void refresh()}>
            <Text style={styles.link}>Check original case</Text>
          </Pressable>
        </View>}
        {!detail&&<>
          <View style={styles.card}>
            <Text style={styles.bold}>Find cases</Text>
            <TextInput style={styles.input} value={query} maxLength={80}
              onChangeText={setQuery} placeholder="Case number or name"
              accessibilityLabel="Search healthcare review cases"/>
            <View style={styles.row}>
              {canDoctors&&canProviders&&<>
                <Pressable accessibilityRole="button" style={styles.button}
                  accessibilityState={{selected:kind==="ALL"}}
                  onPress={()=>setKind("ALL")}><Text style={styles.link}>All</Text></Pressable>
                <Pressable accessibilityRole="button" style={styles.button}
                  accessibilityState={{selected:kind==="HEALTH_PROVIDER_VERIFICATION"}}
                  onPress={()=>setKind("HEALTH_PROVIDER_VERIFICATION")}>
                  <Text style={styles.link}>Providers</Text></Pressable>
              </>}
              {canProviders&&<Pressable accessibilityRole="button" style={styles.button}
                accessibilityState={{selected:kind==="HEALTH_CENTER_VERIFICATION"}}
                onPress={()=>setKind("HEALTH_CENTER_VERIFICATION")}>
                <Text style={styles.link}>Centers</Text>
              </Pressable>}
              {canDoctors&&<Pressable accessibilityRole="button" style={styles.button}
                accessibilityState={{selected:kind==="HEALTH_DOCTOR_VERIFICATION"}}
                onPress={()=>setKind("HEALTH_DOCTOR_VERIFICATION")}>
                <Text style={styles.link}>Doctors</Text>
              </Pressable>}
            </View>
            <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
              disabled={loading||busy} onPress={()=>setApplied(query.trim())}>
              <Text style={styles.primaryText}>Search cases</Text>
            </Pressable>
          </View>
          {cases.length===0&&!loading&&<Text style={styles.hint}>
            No permitted healthcare review cases match this search.</Text>}
          {cases.map(row=><Pressable key={row.caseRef} accessibilityRole="button"
            style={styles.card} disabled={busy||uncertain}
            onPress={()=>void open(row.caseRef)}>
            <Text style={styles.bold}>{row.reference}</Text>
            <Text style={styles.label}>{row.title}</Text>
            <Text style={styles.hint}>{caption(row.kind)} · {label(row.status)}</Text>
            <Text style={styles.link}>View original review</Text>
          </Pressable>)}
          {nextOffset!==null&&<Pressable accessibilityRole="button" style={styles.button}
            disabled={loading||busy} onPress={()=>{
              setLoading(true);
              void load(nextOffset).catch(permission).finally(()=>setLoading(false));
            }}><Text style={styles.link}>Load more cases</Text></Pressable>}
        </>}
        {detail&&<>
          <View style={styles.card}>
            <Text style={styles.bold}>{detail.reference}</Text>
            <Text style={styles.label}>{caption(detail.kind)} · {label(detail.status)}</Text>
            {!!detail.source&&<>
              <Text style={styles.bold}>Submitted registration</Text>
              {rows.map(([key,value])=><View key={key}>
                <Text style={styles.hint}>{label(key)}</Text>
                <Text style={styles.label}>{renderable(value)}</Text>
              </View>)}
              <Text style={styles.hint}>Private scanned evidence: {label(detail.source.proofStatus)}</Text>
              <Pressable accessibilityRole="button" style={styles.button}
                disabled={busy||uncertain} onPress={()=>void viewProtectedEvidence()}>
                <Text style={styles.link}>View original private evidence</Text>
              </Pressable>
            </>}
          </View>
          {["SUBMITTED","IN_REVIEW"].includes(detail.status)&&<View style={styles.card}>
            <Text style={styles.bold}>Independent reviewer decision</Text>
            <View style={styles.row}>{(["APPROVE","RETURN","REJECT"] as const).map(value=>
              <Pressable key={value} accessibilityRole="button" style={styles.button}
                accessibilityState={{selected:action===value}}
                disabled={busy||uncertain}
                onPress={()=>{setAction(value);requestKey.current=""}}>
                <Text style={styles.link}>{label(value)}</Text>
              </Pressable>)}</View>
            <Text style={styles.hint}>Reviewer note</Text>
            <TextInput value={remarks} onChangeText={value=>{
              setRemarks(value);requestKey.current="";
            }} multiline maxLength={500} numberOfLines={3}
              style={styles.input} accessibilityLabel="Reviewer note"/>
            <Text style={styles.hint}>Confirm your current password</Text>
            <TextInput secureTextEntry autoCapitalize="none" value={password}
              onChangeText={value=>{setPassword(value);requestKey.current=""}}
              style={styles.input} accessibilityLabel="Current password"/>
            <Pressable accessibilityRole="button" style={[styles.button,styles.primary]}
              disabled={busy||uncertain||password.length<8} onPress={()=>void decide()}>
              <Text style={styles.primaryText}>Record reviewer decision</Text>
            </Pressable>
          </View>}
          {detail.status==="PENDING_OWNER"&&<Pressable accessibilityRole="button"
            disabled={busy||uncertain} style={[styles.button,styles.primary]}
            onPress={()=>void finalize("apply")}>
            <Text style={styles.primaryText}>Apply independently approved registration</Text>
          </Pressable>}
          {["RETURNED","REJECTED"].includes(detail.status)&&canManage(detail)&&
            <Pressable accessibilityRole="button" disabled={busy||uncertain}
              style={styles.button} onPress={()=>void finalize("return-to-draft")}>
              <Text style={styles.link}>Reopen for corrections</Text>
            </Pressable>}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:t.background},
 content:{padding:14,paddingBottom:60,gap:12},
 header:{flexDirection:"row",alignItems:"center",gap:12},
 title:{fontSize:18,fontWeight:"700",color:t.text,flexShrink:1},
 card:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1,
   borderRadius:10,padding:13,gap:9},
 bold:{fontSize:15,fontWeight:"700",color:t.text},
 label:{fontSize:14,lineHeight:20,color:t.text},
 hint:{fontSize:13,lineHeight:19,color:t.mutedText},
 error:{fontSize:14,color:t.error},
 row:{flexDirection:"row",gap:8,flexWrap:"wrap",alignItems:"center"},
 button:{borderWidth:1,borderColor:t.border,minHeight:48,borderRadius:8,
   paddingHorizontal:12,paddingVertical:8,justifyContent:"center"},
 primary:{backgroundColor:t.primary,borderColor:t.primary},
 primaryText:{fontSize:14,fontWeight:"700",color:t.primaryText},
 link:{fontSize:14,fontWeight:"600",color:t.primary},
 input:{borderWidth:1,borderColor:t.border,borderRadius:7,
   backgroundColor:t.surface,color:t.text,minHeight:48,padding:11}
});
