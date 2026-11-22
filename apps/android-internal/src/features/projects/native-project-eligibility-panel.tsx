import {useEffect,useRef,useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet,Switch} from "react-native";
import * as Crypto from "expo-crypto";
import type {CG05ProjectDetail as Detail,CG05PublicEligibility as Eligibility} from "@careganga/api-contracts";
import {identityRequest} from "../identity-access/http-client";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
type Command={path:string;body:Record<string,unknown>};
export function NativeProjectEligibilityPanel({project,token,onExpired,canManage}:{project:Detail;token:string;onExpired:()=>void;canManage:boolean}){
 const [state,setState]=useState<Eligibility|null>(null),[summary,setSummary]=useState(""),[area,setArea]=useState(""),[consent,setConsent]=useState(false),[remark,setRemark]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[epoch,setEpoch]=useState(0);
 const command=useRef<Command|null>(null),running=useRef(false),path="projects/"+project.ref;
 const api=async<T,>(path:string,body?:Record<string,unknown>):Promise<T>=>{
  const r=await identityRequest("/api/v1/project-public-eligibility/"+path,{headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},cache:"no-store",...(body?{method:"POST",body:JSON.stringify(body)}:{})});
  if(r.status===401){onExpired();throw Object.assign(Error("Sign in again."),{status:401});}
  const v=await r.json().catch(()=>null);if(!r.ok||!v)throw Object.assign(Error(r.status===403?"Your current role cannot perform this review.":r.status===409?"Project or review changed. Refresh before retrying.":r.status===400?"Check public-safe details and password.":"Eligibility result unconfirmed."),{status:r.ok?503:r.status});return v as T;
 };
 useEffect(()=>{let live=true;setState(null);void api<Eligibility>(path).then(v=>{if(live)setState(v);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[token,path,epoch]);
 const perform=async(next?:Command)=>{if(running.current)return;const c=command.current??next;if(!c)return;command.current=c;running.current=true;setBusy(true);setError("");setNotice("");try{
  await api(c.path,c.body);command.current=null;setPending(false);setPassword("");setRemark("");setConsent(false);setNotice("Eligibility action confirmed. Publication is a separate CMS decision.");setEpoch(x=>x+1);
 }catch(e){const code=(e as {status?:number}).status;setError(e instanceof Error?e.message:"Result unconfirmed.");if(!code||code>=500||code===408||code===429){setPending(true);setState(null);}else{command.current=null;setPending(false);setPassword("");setEpoch(x=>x+1);}}finally{running.current=false;setBusy(false);}};
 const locked=busy||pending,canSubmit=!!state&&state.status==="PRIVATE"&&canManage&&["PLANNED","ACTIVE"].includes(project.status);
 const decision=(action:"APPROVE"|"RETURN"|"REJECT")=>{if(!state?.caseRef||!state.revision)return;void perform({path:"cases/"+state.caseRef+"/decide",body:{requestKey:Crypto.randomUUID(),expectedRevision:state.revision,action,remarks:remark,currentPassword:password}});};
 const button=(label:string,onPress:()=>void,disabled=false)=><Pressable key={label} accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[s.button,disabled&&{opacity:.45}]}><Text style={s.label}>{label}</Text></Pressable>;
 const field=(label:string,value:string,onChangeText:(v:string)=>void,maxLength=500,secure=false)=><View><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} maxLength={maxLength} editable={!locked} secureTextEntry={secure} autoCapitalize={secure?"none":"sentences"} style={s.input}/></View>;
 return <View style={s.card}><Text accessibilityRole="header" style={s.heading}>Public Project Eligibility</Text><Text>Projects are private by default. This review permits only public-safe text; private covers remain protected.</Text>
 <Text>Source review: {state?state.status==="ELIGIBLE_NOT_PUBLISHED"?"Eligible for separate CMS publication":state.status.replaceAll("_"," "):"Not confirmed"}</Text>{!!state?.caseNumber&&<Text>Review case: {state.caseNumber}</Text>}
 {state?.source&&<View><Text style={s.label}>{state.source.title}</Text><Text>{state.source.category} · {state.source.area}</Text><Text>{state.source.summary}</Text><Text>{state.source.status}{state.source.launch?" · "+state.source.launch:""}</Text></View>}
 {canSubmit&&<View style={s.group}><Text style={s.label}>Submit public-safe source</Text><Text>{project.title} · {project.category} · {project.plannedStart??"No planned start"}</Text>
 {field("Public summary",summary,setSummary,500)}{field("General public area (not private address)",area,setArea,160)}
 <Text>I confirm these details may be released without private beneficiary, employee, financial, contact or precise location data.</Text><Switch accessibilityLabel="Confirm public release of these details" value={consent} disabled={locked} onValueChange={setConsent}/>
 {button("Submit for independent eligibility review",()=>void perform({path:path+"/submit",body:{requestKey:Crypto.randomUUID(),expectedVersion:project.version,publicSummary:summary,generalArea:area,publicReleaseConfirmed:true}}),locked||!consent||summary.trim().length<3||area.trim().length<2)}</View>}
 {state?.canReview&&!pending&&<View style={s.group}><Text style={s.label}>Independent original CG-03 decision</Text>{field("Remarks",remark,setRemark)}{field("Current password",password,setPassword,1024,true)}
 {(["APPROVE","RETURN","REJECT"] as const).map(a=>button(a,()=>decision(a),locked||password.length<8||a!=="APPROVE"&&remark.trim().length<3))}</View>}
 {state?.canWithdraw&&!pending&&<View style={s.group}>{field("Withdrawal reason",remark,setRemark)}{button("Withdraw eligibility",()=>void perform({path:path+"/withdraw",body:{expectedVersion:project.version,reason:remark}}),locked||remark.trim().length<3)}</View>}
 {pending?<><Text accessibilityRole="alert">Original outcome unknown. Retry the same request to confirm.</Text>{button("Retry original request",()=>void perform(),busy)}</>:button("Refresh eligibility",()=>{setError("");setEpoch(x=>x+1);},busy)}
 {!!error&&<Text accessibilityRole="alert" style={{color:theme.error}}>{error}</Text>}{!!notice&&<Text accessibilityRole="alert">{notice}</Text>}</View>;
}
const s=StyleSheet.create({card:{padding:12,borderWidth:1,borderColor:theme.border,borderRadius:10,gap:8,backgroundColor:theme.surface},heading:{fontSize:16,fontWeight:"700",color:theme.text},label:{fontWeight:"600",color:theme.text},group:{gap:8},input:{padding:10,minHeight:44,borderWidth:1,borderColor:theme.border,borderRadius:8,color:theme.text},button:{padding:12,minHeight:44,borderRadius:8,borderWidth:1,borderColor:theme.border,justifyContent:"center"}});
