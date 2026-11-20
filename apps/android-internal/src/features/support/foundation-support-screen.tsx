import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,
  Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";

type CaseView={caseRef:string;ticketNumber:string;subject:string;name:string;contact:string;
  status:string;revision:number;
  assignedAccountRef:string|null;unread:boolean;archived:boolean;
  createdAt:string;updatedAt:string};
type Detail=CaseView&{message:string;replies:Array<{replyRef:string;body:string;
  authorAccountRef:string;createdAt:string}>;
  history:Array<{kind:string;at:string}>;
  statusNotes?:Array<{revision:number;status:string;summary:string;recordedAt:string}>};
type Counts={total:number;unread:number;open:number;replied:number;
  closed:number;archived:number;received_today:number};
type Faq={faqRef:string;question:string;answer:string;state:string;revision:number};
type Option={value:string;label:string};
type Props={token:string;mayView:boolean;mayManage:boolean;mayReply:boolean;
  mayFaq:boolean;mayChooseAccounts:boolean;onExit:()=>void;onExpired:()=>void};
async function api<T>(token:string,path:string,method:"GET"|"POST"|"PATCH"="GET",
  payload?:object):Promise<T>{
  let result:Response;
  try{result=await identityRequest("/api/support/"+path,{
    method,headers:{Authorization:"Bearer "+token,
      ...(payload?{"Content-Type":"application/json"}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{})
  })}catch{throw Error("UNKNOWN")}
  if(result.status===401)throw Error("EXPIRED");
  if(result.status===403)throw Error("DENIED");
  if(result.status===409)throw Error("CONFLICT");
  if(result.status===400)throw Error("INVALID");
  if(!result.ok)throw Error("UNKNOWN");
  try{return await result.json() as T;}catch{throw Error("UNKNOWN")}
}
const friendly=(error:unknown)=>{
  const code=error instanceof Error?error.message:"UNKNOWN";
  return code==="EXPIRED"?"Current staff session expired.":
    code==="DENIED"?"Current role does not permit this support action.":
    code==="CONFLICT"?"Another operator changed this case. Refresh before retrying.":
    code==="INVALID"?"Check the entered information.":
    "The result could not be confirmed. Check the original case before retrying.";
};
export function FoundationSupportScreen({token,mayView,mayManage,mayReply,mayFaq,
  mayChooseAccounts,onExit,onExpired}:Props){
  const [tab,setTab]=useState<"CASES"|"FAQ">(mayView?"CASES":"FAQ");
  const [filter,setFilter]=useState("ALL"),[cursor,setCursor]=useState<string|null>(null);
  const [search,setSearch]=useState(""),[appliedSearch,setAppliedSearch]=useState("");
  const [previous,setPrevious]=useState<string[]>([]);
  const [next,setNext]=useState<string|null>(null);
  const [cases,setCases]=useState<CaseView[]>([]),[counts,setCounts]=useState<Counts|null>(null);
  const [selected,setSelected]=useState<Detail|null>(null);
  const [reply,setReply]=useState(""),[replyKey,setReplyKey]=useState("");
  const [agents,setAgents]=useState<Option[]>([]),[assignee,setAssignee]=useState("");
  const [nextStatus,setNextStatus]=useState("OPEN");
  const [statusNote,setStatusNote]=useState("");
  const [agentSearch,setAgentSearch]=useState("");
  const [appliedAgentSearch,setAppliedAgentSearch]=useState("");
  const [faqs,setFaqs]=useState<Faq[]>([]),[editing,setEditing]=useState<Faq|null>(null);
  const [question,setQuestion]=useState(""),[answer,setAnswer]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [result,faqResult]=await Promise.all([
        mayView?api<{items:CaseView[];counts:Counts;nextCursor:string|null}>(
          token,"cases/search","POST",
          {limit:30,filter,cursor,search:appliedSearch}):
          Promise.resolve({items:[],counts:null,nextCursor:null}),
        mayFaq?api<{faqs:Faq[]}>(token,"faqs"):Promise.resolve({faqs:[]})
      ]);
      setCases(result.items);setCounts(result.counts);setNext(result.nextCursor);
      setFaqs(faqResult.faqs);
    }catch(error){
      setMessage(friendly(error));
      if(error instanceof Error&&error.message==="EXPIRED")onExpired();
    }finally{setLoading(false)}
  },[token,filter,cursor,appliedSearch,mayView,mayFaq,onExpired]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!mayManage||!mayChooseAccounts)return;
    let live=true;
    void identityRequest("/api/support/agents?search="+encodeURIComponent(appliedAgentSearch),{
      headers:{Authorization:"Bearer "+token}})
      .then(r=>r.ok?r.json():Promise.reject()).then((r:unknown)=>{
        if(live&&r&&typeof r==="object"&&"options" in r&&Array.isArray(r.options))
          setAgents((r.options as Option[]).slice(0,30));
      }).catch(()=>{if(live)setAgents([])});
    return()=>{live=false};
  },[mayManage,mayChooseAccounts,token,appliedAgentSearch]);
  useEffect(()=>{
    const back=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(selected){setSelected(null);return true}
      if(editing){setEditing(null);return true}
      onExit();return true;
    });
    return()=>back.remove();
  },[selected,editing,onExit]);
  async function show(ref:string){
    setBusy(true);setMessage("");
    try{
      const item=await api<Detail>(token,"cases/"+ref);
      setSelected(item);setAssignee(item.assignedAccountRef??"");
      setNextStatus(item.status);setStatusNote("");
      setReply("");setReplyKey("");
      await api(token,"cases/"+ref+"/read","POST");
      await load();
    }catch(error){
      setMessage(friendly(error));
      if(error instanceof Error&&error.message==="EXPIRED")onExpired();
    }finally{setBusy(false)}
  }
  async function action(kind:"REPLY"|"ASSIGN"|"CLOSE"|"REOPEN"|"SET_STATUS"|"ARCHIVE"){
    if(!selected||busy)return;
    if(kind==="REPLY"&&!mayReply||["ASSIGN","CLOSE","REOPEN","SET_STATUS"].includes(kind)&&!mayManage)
      return;
    setBusy(true);setMessage("");
    try{
      const path="cases/"+selected.caseRef;
      if(kind==="REPLY"){
        const key=replyKey||Crypto.randomUUID();setReplyKey(key);
        await api(token,path+"/reply","POST",{
          expectedRevision:selected.revision,requestKey:key,body:reply});
        setReply("");setReplyKey("");
      }else if(kind==="ASSIGN"){
        await api(token,path+"/assign","POST",{
          expectedRevision:selected.revision,assignedAccountRef:assignee||null});
      }else if(kind==="ARCHIVE"){
        await api(token,path+"/archive","POST",{archived:!selected.archived});
      }else{
        const status=kind==="CLOSE"?"CLOSED":kind==="REOPEN"?"OPEN":nextStatus;
        if(["WAITING_FOR_USER","RESOLVED","CLOSED"].includes(status)&&
          statusNote.trim().length<8){
          setMessage("Add a private status or resolution summary of at least eight characters.");
          return;
        }
        await api(token,path+"/status","PATCH",{
          expectedRevision:selected.revision,status,
          ...(statusNote.trim()?{note:statusNote.trim()}:{})});
      }
      const updated=await api<Detail>(token,path);
      setSelected(updated);setNextStatus(updated.status);
      setStatusNote("");await load();
      setMessage(kind==="REPLY"?
        "Reply saved privately. External delivery has not been claimed.":
        "Original case state confirmed.");
    }catch(error){
      setMessage(friendly(error));
      if(error instanceof Error&&error.message==="EXPIRED")onExpired();
    }finally{setBusy(false)}
  }
  async function createOrUpdateFaq(publish:boolean){
    if(!mayFaq||busy)return;
    setBusy(true);setMessage("");
    try{
      if(editing){
        await api(token,"faqs/"+editing.faqRef,"PATCH",{
          expectedRevision:editing.revision,question,answer,
          state:publish?"PUBLISHED":editing.state});
      }else{
        if(publish)throw Error("INVALID");
        await api(token,"faqs","POST",{question,answer});
      }
      setEditing(null);setQuestion("");setAnswer("");
      await load();setMessage("Help question saved in the original Foundation source.");
    }catch(e){setMessage(friendly(e))}
    finally{setBusy(false)}
  }
  async function changeFaq(f:Faq,state:"PUBLISHED"|"WITHDRAWN"){
    if(!mayFaq||busy)return;
    setBusy(true);setMessage("");
    try{
      await api(token,"faqs/"+f.faqRef,"PATCH",{expectedRevision:f.revision,state});
      await load();
    }catch(e){setMessage(friendly(e))}
    finally{setBusy(false)}
  }
  function chooseFilter(value:string){
    setFilter(value);setCursor(null);setPrevious([]);setNext(null);
  }
  function applySearch(){
    if(search.trim().length>0&&search.trim().length<3){
      setMessage("Enter at least three characters to search the Foundation queue.");
      return;
    }
    setAppliedSearch(search.trim());setCursor(null);setPrevious([]);setNext(null);
    setMessage("");
  }
  return <SafeAreaView style={s.page} edges={["left","right"]}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <View style={s.row}>
        <Pressable style={s.button} accessibilityRole="button" onPress={selected?
          ()=>setSelected(null):onExit}><Text>Back</Text></Pressable>
        <Text style={s.title} accessibilityRole="header">Contact Messages & Help</Text>
      </View>
      <Text style={s.muted}>Foundation-only support. Current role permissions apply to every action.</Text>
      {message?<Text accessibilityRole="alert" style={s.error}>{message}</Text>:null}
      <View style={s.row}>
        {mayView&&<Pressable style={s.button} accessibilityRole="button"
          accessibilityState={{selected:tab==="CASES"}} onPress={()=>setTab("CASES")}>
          <Text>Messages</Text></Pressable>}
        {mayFaq&&<Pressable style={s.button} accessibilityRole="button"
          accessibilityState={{selected:tab==="FAQ"}} onPress={()=>setTab("FAQ")}>
          <Text>Help questions</Text></Pressable>}
        <Pressable style={s.button} accessibilityRole="button" disabled={busy}
          onPress={()=>void load()}><Text>Refresh</Text></Pressable>
      </View>
      {loading&&<ActivityIndicator accessibilityLabel="Loading current support records"/>}
      {tab==="CASES"&&mayView&&(selected?<View style={s.card}>
        <Text style={s.heading}>{selected.ticketNumber} · {selected.subject}</Text>
        <Text>{selected.name} · {selected.contact}</Text>
        <Text style={s.muted}>{selected.status.replaceAll("_"," ")} · Revision {selected.revision}</Text>
        <Text selectable style={s.message}>{selected.message}</Text>
        <Text style={s.heading}>Replies and history</Text>
        {selected.replies.length===0&&<Text>No replies recorded yet.</Text>}
        {selected.replies.map(r=><View key={r.replyRef} style={s.item}>
          <Text style={s.message}>{r.body}</Text>
          <Text style={s.muted}>{new Date(r.createdAt).toLocaleString()}</Text>
        </View>)}
        <Text style={s.heading}>Private status and resolution notes</Text>
        {(selected.statusNotes?.length??0)===0&&<Text>No resolution notes have been recorded.</Text>}
        {(selected.statusNotes??[]).map(note=><View key={note.revision} style={s.item}>
          <Text style={s.heading}>{note.status.replaceAll("_"," ")} · revision {note.revision}</Text>
          <Text selectable style={s.message}>{note.summary}</Text>
          <Text style={s.muted}>{new Date(note.recordedAt).toLocaleString()}</Text>
        </View>)}
        {selected.history.map((h,i)=><Text key={i} style={s.muted}>
          {h.kind} · {new Date(h.at).toLocaleString()}</Text>)}
        {mayManage&&<View style={s.card}>
          <Text style={s.heading}>Assignment and status</Text>
          {mayChooseAccounts?<>
            <Text>Assigned operator: {selected.assignedAccountRef?
              agents.find(a=>a.value===selected.assignedAccountRef)?.label??
                "Assigned (not in current search results)":"Unassigned"}</Text>
            <TextInput style={s.input} accessibilityLabel="Find eligible support operator"
              placeholder="Search permitted staff by name" maxLength={70}
              value={agentSearch} onChangeText={setAgentSearch}/>
            <Pressable style={s.button} accessibilityRole="button"
              onPress={()=>setAppliedAgentSearch(agentSearch.trim())}>
              <Text>Find operators</Text></Pressable>
            {agents.map(agent=><Pressable key={agent.value} style={s.item}
              accessibilityRole="button" accessibilityState={{selected:assignee===agent.value}}
              onPress={()=>setAssignee(agent.value)}><Text>{agent.label}</Text></Pressable>)}
            <Pressable style={s.button} onPress={()=>setAssignee("")}>
              <Text>Unassign</Text></Pressable>
            <Pressable style={s.button} disabled={busy}
              onPress={()=>void action("ASSIGN")}><Text>Save assignment</Text></Pressable>
          </>:<Text>Current role cannot open account options.</Text>}
          <Text style={s.heading}>Update support status</Text>
          <View style={s.rowWrap}>
            {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER",
              "ESCALATED","RESOLVED","CLOSED"].map(value=>
              <Pressable key={value} style={s.button}
                accessibilityRole="button"
                accessibilityState={{selected:nextStatus===value,disabled:
                  selected.status==="CLOSED"&&value!=="OPEN"||
                  selected.status==="RESOLVED"&&!["OPEN","CLOSED"].includes(value)||
                  value==="ASSIGNED"&&!selected.assignedAccountRef}}
                disabled={selected.status==="CLOSED"&&value!=="OPEN"||
                  selected.status==="RESOLVED"&&!["OPEN","CLOSED"].includes(value)||
                  value==="ASSIGNED"&&!selected.assignedAccountRef}
                onPress={()=>setNextStatus(value)}>
                <Text>{value.replaceAll("_"," ")}</Text>
              </Pressable>)}
          </View>
          <Text style={s.heading}>Private status or resolution summary</Text>
          <TextInput multiline style={[s.input,s.longInput]}
            maxLength={1200} value={statusNote} onChangeText={setStatusNote}
            accessibilityLabel="Status or resolution summary"
            placeholder="Required for Waiting for User, Resolved or Closed"/>
          <Text style={s.muted}>Visible only to authorized Foundation staff.
            Saving a note does not claim external email delivery.</Text>
          <Pressable style={s.button}
            disabled={busy||nextStatus===selected.status||
              ["WAITING_FOR_USER","RESOLVED","CLOSED"].includes(nextStatus)&&
              statusNote.trim().length<8}
            onPress={()=>void action("SET_STATUS")}>
            <Text>Save status</Text>
          </Pressable>
          <Pressable style={s.button} disabled={busy||selected.status==="CLOSED"||statusNote.trim().length<8}
            onPress={()=>void action("CLOSE")}><Text>Close case</Text></Pressable>
          <Pressable style={s.button} disabled={busy||selected.status==="OPEN"}
            onPress={()=>void action("REOPEN")}><Text>Reopen case</Text></Pressable>
        </View>}
        {mayReply&&!["CLOSED","RESOLVED"].includes(selected.status)&&<View style={s.card}>
          <Text style={s.heading}>Private reply</Text>
          <TextInput multiline value={reply} onChangeText={setReply}
            accessibilityLabel="Private reply" maxLength={2400} style={[s.input,s.longInput]}/>
          <Pressable style={s.button} disabled={busy||reply.trim().length<2}
            onPress={()=>void action("REPLY")}>
            <Text>Save reply (no external delivery)</Text></Pressable>
        </View>}
        <Pressable style={s.button} disabled={busy} onPress={()=>void action("ARCHIVE")}>
          <Text>{selected.archived?"Restore for my account":"Archive for my account"}</Text>
        </Pressable>
      </View>:<>
        {counts&&<View style={s.card}>
          <Text style={s.heading}>Contact Messages</Text>
          {([["Total Inquiries",counts.total],["Unread",counts.unread],
            ["Resolved or Closed",counts.closed],["Received Today",counts.received_today]] as const)
            .map(([label,value])=><Text key={label}>{label}: {value}</Text>)}
        </View>}
        <View style={s.card}><Text style={s.heading}>Filter messages</Text>
          <View style={s.rowWrap}>
            {["ALL","OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER",
              "ESCALATED","REPLIED","RESOLVED","CLOSED","UNREAD","ARCHIVED"].map(v=>
              <Pressable key={v} style={s.button} accessibilityRole="button"
                accessibilityState={{selected:filter===v}} onPress={()=>chooseFilter(v)}>
                <Text>{v}</Text></Pressable>)}
          </View></View>
        <View style={s.card}>
          <Text style={s.heading}>Search all permitted messages</Text>
          <TextInput accessibilityLabel="Search all support cases" style={s.input}
            value={search} onChangeText={setSearch} maxLength={100}
            placeholder="Name, contact or subject (3+ characters)"/>
          <View style={s.row}>
            <Pressable style={s.button} accessibilityRole="button"
              disabled={busy} onPress={applySearch}><Text>Search</Text></Pressable>
            {appliedSearch!==""&&<Pressable style={s.button}
              onPress={()=>{setSearch("");setAppliedSearch("");
                setCursor(null);setPrevious([]);setNext(null)}}>
              <Text>Clear search</Text></Pressable>}
          </View>
          <Text style={s.muted}>Search is performed server-side using private
            terms, not device-only filtering.</Text>
        </View>
        {cases.length===0&&!loading&&<Text>No messages match this page.</Text>}
        {cases.map(item=><Pressable key={item.caseRef} style={s.card}
          accessibilityRole="button" disabled={busy} onPress={()=>void show(item.caseRef)}>
          <Text style={s.heading}>{item.ticketNumber} · {item.subject}</Text>
          <Text>{item.name} · {item.contact}</Text>
          <Text style={s.muted}>{item.status.replaceAll("_"," ")} · {item.unread?"Unread":"Read"}
            {item.archived?" · Archived":""}</Text>
          <Text style={s.muted}>{new Date(item.createdAt).toLocaleString()}</Text>
        </Pressable>)}
        <View style={s.row}>
          <Pressable style={s.button} disabled={busy||previous.length===0}
            onPress={()=>{setCursor(previous.at(-1)||null);
              setPrevious(old=>old.slice(0,-1))}}><Text>Previous</Text></Pressable>
          <Pressable style={s.button} disabled={busy||!next}
            onPress={()=>{if(next){setPrevious(old=>[...old,cursor??""]);
              setCursor(next)}}}><Text>Next</Text></Pressable>
        </View>
      </>)}
      {tab==="FAQ"&&mayFaq&&<View style={s.card}>
        <Text style={s.heading}>Foundation help questions</Text>
        <TextInput style={s.input} value={question} onChangeText={setQuestion}
          accessibilityLabel="Question" maxLength={200} placeholder="Question"/>
        <TextInput style={[s.input,s.longInput]} multiline value={answer}
          onChangeText={setAnswer} accessibilityLabel="Answer" maxLength={1600}
          placeholder="Answer"/>
        <Pressable style={s.button} disabled={busy} onPress={()=>void createOrUpdateFaq(false)}>
          <Text>{editing?"Save revision":"Save draft"}</Text></Pressable>
        {editing&&editing.state!=="PUBLISHED"&&<Pressable style={s.button}
          disabled={busy} onPress={()=>void createOrUpdateFaq(true)}>
          <Text>Publish revised FAQ</Text></Pressable>}
        {editing&&<Pressable style={s.button} onPress={()=>{setEditing(null);
          setQuestion("");setAnswer("")}}><Text>Cancel edit</Text></Pressable>}
        {faqs.map(f=><View style={s.item} key={f.faqRef}>
          <Text style={s.heading}>{f.question}</Text><Text>{f.answer}</Text>
          <Text style={s.muted}>{f.state} · revision {f.revision}</Text>
          <Pressable style={s.button} disabled={busy} onPress={()=>{
            setEditing(f);setQuestion(f.question);setAnswer(f.answer)}}>
            <Text>Edit question</Text></Pressable>
          {f.state==="DRAFT"&&<Pressable style={s.button} disabled={busy}
            onPress={()=>void changeFaq(f,"PUBLISHED")}><Text>Publish</Text></Pressable>}
          {f.state==="PUBLISHED"&&<Pressable style={s.button} disabled={busy}
            onPress={()=>void changeFaq(f,"WITHDRAWN")}><Text>Withdraw</Text></Pressable>}
        </View>)}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.adminCanvas},
  content:{padding:16,paddingBottom:96,gap:14,width:"100%",maxWidth:800,alignSelf:"center"},
  row:{flexDirection:"row",gap:9,alignItems:"center",flexWrap:"wrap"},
  rowWrap:{flexDirection:"row",flexWrap:"wrap",gap:7},
  title:{fontSize:21,fontWeight:"700",color:theme.text,flex:1},
  heading:{fontSize:17,fontWeight:"700",color:theme.text},
  muted:{color:theme.mutedText,fontSize:13},
  error:{color:theme.error,padding:9,backgroundColor:theme.surface},
  card:{padding:15,backgroundColor:theme.surface,borderColor:theme.border,
    borderWidth:1,borderRadius:14,gap:9,
    shadowColor:theme.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
  item:{padding:11,borderColor:theme.border,borderWidth:1,borderRadius:12,gap:7},
  input:{minHeight:48,backgroundColor:theme.surface,borderColor:theme.border,
    borderWidth:1,borderRadius:10,padding:10,color:theme.text},
  longInput:{minHeight:100,textAlignVertical:"top"},
  message:{fontSize:14,lineHeight:20,color:theme.text},
  button:{minHeight:48,padding:10,borderColor:theme.border,borderWidth:1,
    borderRadius:12,justifyContent:"center"}
});
