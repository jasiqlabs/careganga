import React,{useCallback,useEffect,useRef,useState} from "react";
import {View,Text,TextInput,Pressable,StyleSheet,ActivityIndicator} from "react-native";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import {identityRequest} from "../identity-access/http-client";
type Mode="own"|"manage"|"review";
type Template={templateId:string;kind:string;version:number;title:string;body:string};
type Subject={reference:string;label:string;designation:string;branch:string};
type Snapshot={recipient:string;designation:string;branch:string;department?:string|null;hireDate:string;issueDate:string;expiryDate?:string|null;lastWorkingDate?:string|null;templateVersion:number};
type DocumentStatus={documentRef:string;status:string;issueRevision:number;canDownload:boolean;canRetry:boolean;receiptStatus:string;dispatch:{channel:string;status:string}[]};
type Row={reference:string;caseRef?:string;kind:string;status:string;revision:number;recipient?:string;snapshot?:Snapshot;document?:DocumentStatus|null;canSubmit?:boolean;canReview?:boolean};
const kinds=["APPOINTMENT","OFFER","JOINING","EXPERIENCE","RELIEVING","MEMO","EMPLOYEE_ID"];
const title=(s:string)=>({EMPLOYEE_ID:"Employee ID card",SENT_TO_PROVIDER:"Accepted by provider, delivery pending",IN_APP:"Available in app",UNKNOWN_PROVIDER:"Provider outcome uncertain"} as Record<string,string>)[s]??s.toLowerCase().replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const known=(e:unknown)=>!!e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&e.status>=400&&e.status<500;
type Command={path:string;body:Record<string,unknown>;proof:boolean};

async function api<T>(token:string,path:string,body?:object):Promise<T>{
 const r=await identityRequest("/api/hr/"+path,{method:body?"POST":"GET",cache:"no-store",headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(r.status===401?"Sign in again.":r.status===403?"Current document permission unavailable.":r.status===409?"Original document or prerequisite changed.":r.status===400?"Check the details.":"Original outcome unconfirmed."),{status:r.status});const v=await r.json();if(!v||typeof v!=="object")throw Error("Original outcome unconfirmed");return v as T;
}
function Button({name,onPress,disabled=false}:{name:string;onPress:()=>void;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={[styles.button,disabled&&{opacity:.5}]}><Text>{name}</Text></Pressable>;}
function Field({label,value,onChange,secure=false,multi=false,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;secure?:boolean;multi?:boolean;disabled?:boolean}){return <View><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!disabled} secureTextEntry={secure} multiline={multi} style={styles.input} value={value} onChangeText={onChange} maxLength={1200}/></View>;}
function Select({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(v:string)=>void;disabled?:boolean}){return <View style={{gap:4}}><Text style={styles.label}>{label}</Text>{options.map(x=><Pressable key={x.value} accessibilityRole="radio" accessibilityState={{checked:x.value===value,disabled}} disabled={disabled} style={[styles.button,value===x.value&&{backgroundColor:"#D1FAE5"}]} onPress={()=>onChange(x.value)}><Text>{x.label}</Text></Pressable>)}</View>;}
export function NativeHrDocuments({token,onExpired,mode,canIssue=false,canApproveTemplate=false,canRevoke=false}:{token:string;onExpired:()=>void;mode:Mode;canIssue?:boolean;canApproveTemplate?:boolean;canRevoke?:boolean}){

 const route=mode==="own"?"me/documents":mode==="manage"?"document-requests":"document-reviews";
 const [rows,setRows]=useState<Row[]>([]),[templates,setTemplates]=useState<Template[]>([]),[people,setPeople]=useState<Subject[]>([]);
 const [kind,setKind]=useState("APPOINTMENT"),[search,setSearch]=useState(""),[subject,setSubject]=useState(""),[template,setTemplate]=useState("");
 const [issueDate,setIssueDate]=useState(""),[expiry,setExpiry]=useState(""),[heading,setHeading]=useState(""),[terms,setTerms]=useState(""),[password,setPassword]=useState("");
 const [selected,setSelected]=useState<Row|null>(null),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[filter,setFilter]=useState("ALL");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[locked,setLocked]=useState(false),[message,setMessage]=useState("");
 const pending=useRef<Command|null>(null),running=useRef(false),generation=useRef(0),personRead=useRef(0);
 const request=useCallback(<T,>(p:string,v?:object)=>api<T>(token,p,v),[token]);
 const fail=useCallback((e:unknown)=>{if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();setMessage(e instanceof Error?e.message:"Original outcome unconfirmed");},[onExpired]);
 const refresh=useCallback(async()=>{const g=++generation.current;setRows([]);setLoading(true);
  try{const v=await request<{items:Row[];hasMore:boolean}>(route+"?offset="+offset);if(!Array.isArray(v.items))throw Error("Document history unavailable");if(g===generation.current){setRows(v.items);setMore(v.hasMore===true);}}
  catch(e){if(g===generation.current)fail(e);}finally{if(g===generation.current)setLoading(false);}
 },[route,offset,request,fail]);
 useEffect(()=>{void refresh();return()=>{generation.current++;};},[refresh]);
 const loadTemplates=useCallback(async()=>{if(mode!=="manage")return;try{const v=await request<{items:Template[]}>("document-templates");setTemplates(v.items);}catch(e){fail(e);}},[mode,request,fail]);
 useEffect(()=>{void loadTemplates();},[loadTemplates]);
 const loadPeople=useCallback(async(k:string,q:string)=>{if(mode!=="manage")return;const g=++personRead.current;setPeople([]);
  try{const v=await request<{items:Subject[]}>("document-subjects?kind="+encodeURIComponent(k)+"&search="+encodeURIComponent(q));if(g===personRead.current)setPeople(v.items);}catch(e){if(g===personRead.current)fail(e);}
 },[mode,request,fail]);
 useEffect(()=>{void loadPeople(kind,"");return()=>{personRead.current++;};},[kind,loadPeople]);
 const current=templates.find(x=>x.kind===kind),chosen=templates.find(x=>x.templateId===template&&x.kind===kind),person=people.find(x=>x.reference===subject);
 const changeKind=(v:string)=>{setKind(v);setSubject("");setTemplate("");setPeople([]);setSearch("");setHeading("");setTerms("");setExpiry("");};
 const run=async(path?:string,body?:Record<string,unknown>,proof=false)=>{
  if(running.current)return;let cmd=pending.current;
  if(!cmd){if(!path||!body)return;if(proof&&password.length<8){setMessage("Confirm current password.");return;}cmd={path,body,proof};pending.current=cmd;}
  if(cmd.proof&&password.length<8){setMessage("Confirm current password.");return;}
  running.current=true;setBusy(true);setMessage("");
  try{const v=await request<Record<string,unknown>>(cmd.path,{...cmd.body,...(cmd.proof?{currentPassword:password}:{})});
   if(!v.reference&&!v.status&&!v.documentRef&&!v.confirmed)throw Error("Original outcome unconfirmed");
   pending.current=null;setLocked(false);setPassword("");setSelected(null);await refresh();await loadTemplates();setMessage("Recorded outcome: "+title(String(v.status??"Confirmed")));
  }catch(e){fail(e);setPassword("");if(known(e)){pending.current=null;setLocked(false);}else setLocked(true);}
  finally{running.current=false;setBusy(false);}
 };
 const save=()=>{if(!person||!chosen||!issueDate||(kind==="EMPLOYEE_ID"&&!expiry)){setMessage("Choose recipient, approved template and dates.");return;}
  void run("document-requests",{requestKey:Crypto.randomUUID(),kind,subjectReference:subject,templateId:chosen.templateId,templateVersion:chosen.version,issueDate,...(kind==="EMPLOYEE_ID"?{expiryDate:expiry}:{})});};
 const approveTemplate=()=>void run("document-templates/approve",{kind,title:heading,body:terms,expectedVersion:current?.version??0,requestKey:Crypto.randomUUID()},true);
 const open=async(x:Row)=>{if(mode!=="review"){setSelected(x);return;}if(!x.caseRef||running.current||locked)return;running.current=true;setBusy(true);setSelected(null);
  try{setSelected(await request<Row>(route+"/"+x.caseRef));}catch(e){fail(e);}finally{running.current=false;setBusy(false);}};
 const blocked=busy||locked,visible=rows.filter(x=>filter==="ALL"||(x.document?.status??x.status)===filter);
 const act=(path:string,proof=false,body:Record<string,unknown>={})=>void run(path,body,proof);
 const key=()=>Crypto.randomUUID();
 
 const preview=async(id:string)=>{if(running.current||locked)return;running.current=true;setBusy(true);let file:File|undefined;
  try{const r=await identityRequest("/api/hr/"+(mode==="own"?"me/documents/":"issued-documents/")+id+"/file",{method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+token}});
   if(!r.ok)throw Object.assign(new Error("Private document unavailable"),{status:r.status});if(!r.headers.get("content-type")?.startsWith("application/pdf"))throw Error("Invalid original PDF");
   const len=r.headers.get("content-length");if(len&&Number(len)>10485760)throw Error("PDF exceeds limit");const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length<100||bytes.length>10485760)throw Error("PDF exceeds limit");
   file=new File(Paths.cache,"careganga-employee-"+Crypto.randomUUID()+".pdf");file.create();await file.write(bytes);await file.preview({title:"Private employee document"});
  }catch(e){fail(e);}finally{try{file?.delete();}catch{}running.current=false;setBusy(false);}
 };
 return <View style={styles.card}><Text style={styles.title}>{mode==="own"?"My documents & ID":mode==="manage"?"Employee letters, memos & ID cards":"Employee document approvals"}</Text>
 <Button name="Refresh" disabled={blocked||loading} onPress={()=>{setSelected(null);void refresh();}}/>{!!message&&<Text accessibilityRole="alert">{message}</Text>}
 {mode==="manage"&&<View style={styles.item}><Text style={styles.label}>New document</Text>
 <Select label="Document type" value={kind} options={kinds.map(k=>({value:k,label:title(k)}))} onChange={changeKind} disabled={blocked}/>
 <Field label="Search eligible recipient" value={search} onChange={setSearch} disabled={blocked}/><Button name="Search" disabled={blocked} onPress={()=>void loadPeople(kind,search)}/>
 <Select label="Recipient" value={subject} options={people.map(x=>({value:x.reference,label:x.label+" · "+x.designation+" · "+x.branch}))} onChange={setSubject} disabled={blocked}/>
 <Select label="Approved template" value={template} options={templates.filter(x=>x.kind===kind).map(x=>({value:x.templateId,label:x.title+" · Version "+x.version}))} onChange={setTemplate} disabled={blocked}/>
 {!current&&<Text>No approved template for this document.</Text>}
 <Field label="Issue date (YYYY-MM-DD)" value={issueDate} onChange={setIssueDate} disabled={blocked}/>{kind==="EMPLOYEE_ID"&&<Field label="Expiry date (YYYY-MM-DD)" value={expiry} onChange={setExpiry} disabled={blocked}/>}
 {person&&chosen&&<View style={styles.item}><Text style={styles.label}>CareGanga Foundation · Draft preview</Text><Text>{chosen.title}</Text><Text>{person.label} · {person.designation} · {person.branch}</Text><Text>{issueDate||"Date not selected"} · {chosen.body}</Text>{kind==="EMPLOYEE_ID"&&<Text>Expiry: {expiry} · Back verification code after issue</Text>}<Text>Not an issued PDF.</Text></View>}
 <Button name="Save draft" disabled={blocked||!person||!chosen||!issueDate||(kind==="EMPLOYEE_ID"&&!expiry)} onPress={save}/></View>}
 {mode==="manage"&&canApproveTemplate&&<View style={styles.item}><Text style={styles.label}>Approve template — {title(kind)}</Text><Text>Current version: {current?.version??0}</Text>{current&&<Button name="Load current template" disabled={blocked} onPress={()=>{setHeading(current.title);setTerms(current.body);}}/>}<Field label="Heading" value={heading} onChange={setHeading} disabled={blocked}/><Field label="Terms" value={terms} onChange={setTerms} multi disabled={blocked}/><Field label="Current password" value={password} onChange={setPassword} secure disabled={blocked}/><Button name="Approve version" disabled={blocked||heading.trim().length<10||terms.trim().length<20||password.length<8} onPress={approveTemplate}/></View>}
 <Select label="Filter current page" value={filter} options={["ALL","DRAFT","SUBMITTED","APPROVED","PENDING","ISSUED","REVOKED","UNKNOWN","RETURNED","REJECTED"].map(s=>({value:s,label:title(s)}))} onChange={setFilter} disabled={blocked}/>
 {loading?<ActivityIndicator/>:!visible.length&&<Text>No documents in this view.</Text>}
 {visible.map(x=><View key={x.reference} style={styles.item}><Text style={styles.label}>{title(x.kind)} · {x.snapshot?.recipient??x.recipient}</Text><Text>{x.reference} · {title(x.document?.status??x.status)}</Text><Button name="View details" disabled={blocked} onPress={()=>void open(x)}/></View>)}
 {offset>0&&<Button name="Previous" disabled={blocked} onPress={()=>{setSelected(null);setOffset(v=>Math.max(0,v-25));}}/>}{more&&<Button name="Next" disabled={blocked} onPress={()=>{setSelected(null);setOffset(v=>v+25);}}/>}
 {selected&&<View style={styles.item}><Text style={styles.label}>{title(selected.kind)} · {selected.reference}</Text><Text>{title(selected.status)}</Text>
 {selected.snapshot&&<><Text>{selected.snapshot.recipient} · {selected.snapshot.designation} · {selected.snapshot.branch}</Text><Text>Joining: {selected.snapshot.hireDate} · Issue: {selected.snapshot.issueDate}</Text>{!!selected.snapshot.expiryDate&&<Text>Expiry: {selected.snapshot.expiryDate}</Text>}{!!selected.snapshot.lastWorkingDate&&<Text>Last working date: {selected.snapshot.lastWorkingDate}</Text>}</>}
 {mode==="manage"&&selected.canSubmit&&<Button name="Submit for review" disabled={blocked} onPress={()=>act("document-requests/"+selected.reference+"/submit",false,{requestKey:key(),expectedRevision:selected.revision})}/>}
 {mode==="review"&&selected.canReview&&<><Field label="Current password" value={password} onChange={setPassword} secure disabled={blocked}/>{["APPROVE","RETURN","REJECT"].map(action=><Button key={action} name={title(action)} disabled={blocked||password.length<8} onPress={()=>act("document-reviews/"+selected.caseRef+"/decide",true,{requestKey:key(),expectedRevision:selected.revision,action})}/>)}</>}
 {selected.document&&<><Text>File: {title(selected.document.status)} · Version {selected.document.issueRevision}</Text><Text>Receipt: {title(selected.document.receiptStatus)}</Text>{selected.document.dispatch.map(x=><Text key={x.channel}>{title(x.channel)}: {title(x.status)}</Text>)}
 {selected.document.canDownload&&<Button name="View verified PDF" disabled={blocked} onPress={()=>void preview(selected.document!.documentRef)}/>}
 {mode==="own"&&selected.document.canDownload&&selected.document.receiptStatus!=="ACKNOWLEDGED"&&<Button name="Acknowledge receipt" disabled={blocked} onPress={()=>act("me/documents/"+selected.document!.documentRef+"/acknowledge")}/>}
 {mode==="manage"&&canIssue&&selected.document.canRetry&&<Button name="Check original issuance" disabled={blocked} onPress={()=>act("issued-documents/"+selected.document!.documentRef+"/reconcile")}/>}
 {mode==="manage"&&canIssue&&selected.document.canDownload&&["IN_APP","EMAIL","SMS"].map(channel=><Button key={channel} name={"Dispatch "+title(channel)} disabled={blocked||selected.document!.dispatch.some(x=>x.channel===channel)} onPress={()=>act("issued-documents/"+selected.document!.documentRef+"/dispatch",false,{channel})}/>)}
 {mode==="manage"&&canRevoke&&selected.document.canDownload&&<><Field label="Current password" value={password} onChange={setPassword} secure disabled={blocked}/><Button name="Revoke" disabled={blocked||password.length<8} onPress={()=>act("issued-documents/"+selected.document!.documentRef+"/revoke",true)}/></>}</>}
 {mode==="manage"&&canIssue&&selected.status==="APPROVED"&&(!selected.document||["REVOKED","FAILED"].includes(selected.document.status))&&<><Field label="Current password" value={password} onChange={setPassword} secure disabled={blocked}/><Button name={selected.document?"Reissue":"Issue approved document"} disabled={blocked||password.length<8} onPress={()=>act("document-requests/"+selected.reference+"/issue",true,{requestKey:key()})}/></>}
 </View>}
 {locked&&<View><Text accessibilityRole="alert">Original outcome uncertain. Retry the same command.</Text>{pending.current?.proof&&<Field label="Current password" value={password} onChange={setPassword} secure disabled={busy}/>}<Button name="Retry original command" disabled={busy||!!pending.current?.proof&&password.length<8} onPress={()=>void run()}/></View>}
 </View>;
}
const styles=StyleSheet.create({card:{padding:14,borderRadius:14,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#fff",gap:10},title:{fontSize:17,fontWeight:"700",color:"#0F172A"},label:{fontWeight:"600",color:"#334155"},item:{borderTopWidth:1,borderColor:"#E2E8F0",paddingTop:10,gap:8},input:{borderWidth:1,borderColor:"#CBD5E1",borderRadius:9,padding:10,minHeight:44},button:{backgroundColor:"#F1F5F9",borderRadius:9,minHeight:44,alignItems:"center",justifyContent:"center",padding:8}});
