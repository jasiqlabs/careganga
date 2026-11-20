"use client";
import {useCallback,useEffect,useState} from "react";
import {FoundationSupportAttachments} from "./foundation-support-attachments";
type CaseItem={caseRef:string;ticketNumber:string;subject:string;name:string;contact:string;
  status:string;revision:number;assignedAccountRef:string|null;
  createdAt:string;updatedAt:string;unread:boolean;archived:boolean};
type CaseDetail=CaseItem&{sourceChannel:string;message:string;replies:Array<{replyRef:string;
  authorAccountRef:string;body:string;createdAt:string}>;
  history:Array<{kind:string;at:string}>;
  statusNotes:Array<{revision:number;status:string;summary:string;recordedAt:string}>};
type Counts={total:number;open:number;replied:number;closed:number;
  unread:number;archived:number;received_today:number};
type Faq={faqRef:string;question:string;answer:string;state:string;revision:number};
type Option={value:string;label:string};
async function request<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",
  payload?:object):Promise<T>{
  let response:Response;
  try{response=await fetch("/api/support/"+path,{method,cache:"no-store",
    credentials:"same-origin",...(payload?{
      headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}:{})})}
  catch{throw Error("UNKNOWN")}
  if(!response.ok)throw Error(response.status===401?"LOGIN":
    response.status===403?"DENIED":response.status===409?"CONFLICT":
    response.status===400?"INVALID":"UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN")}
}
function failure(error:unknown){
  const reason=error instanceof Error?error.message:"UNKNOWN";
  return reason==="DENIED"?"Your current role no longer permits this action.":
    reason==="LOGIN"?"Sign in to continue.":
    reason==="CONFLICT"?"Another operator updated this record. Refresh before continuing.":
    reason==="INVALID"?"Check the entered content and revision.":
    "The action outcome is unconfirmed. Verify the original record before retrying.";
}
export function FoundationSupportWorkspace({mayView,mayManage,mayReply,
  mayEditFaq,mayChooseAccounts}:{mayView:boolean;mayManage:boolean;mayReply:boolean;
    mayEditFaq:boolean;mayChooseAccounts:boolean}){
  const [tab,setTab]=useState<"CASES"|"FAQ">(mayView?"CASES":"FAQ");
  const [filter,setFilter]=useState("ALL"),[search,setSearch]=useState("");
  const [appliedSearch,setAppliedSearch]=useState("");
  const [cursor,setCursor]=useState<string|null>(null);
  const [priorCursors,setPriorCursors]=useState<string[]>([]);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [items,setItems]=useState<CaseItem[]>([]);
  const [counts,setCounts]=useState<Counts|null>(null);
  const [selected,setSelected]=useState<CaseDetail|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [alert,setAlert]=useState("");
  const [reply,setReply]=useState(""),[replyKey,setReplyKey]=useState("");
  const [assignee,setAssignee]=useState("");
  const [nextStatus,setNextStatus]=useState("OPEN");
  const [statusNote,setStatusNote]=useState("");
  const [agentSearch,setAgentSearch]=useState("");
  const [agents,setAgents]=useState<Option[]>([]);
  const [faqs,setFaqs]=useState<Faq[]>([]);
  const [question,setQuestion]=useState(""),[answer,setAnswer]=useState("");
  const [editing,setEditing]=useState<Faq|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [cases,faqList]=await Promise.all([
        mayView?request<{items:CaseItem[];counts:Counts;nextCursor:string|null}>(
          "cases/search","POST",{limit:30,filter,cursor,search:appliedSearch}):
          Promise.resolve({items:[],counts:null}),
        mayEditFaq?request<{faqs:Faq[]}>("faqs"):Promise.resolve({faqs:[]})
      ]);
      setItems(cases.items);setCounts(cases.counts);
      setNextCursor("nextCursor" in cases?cases.nextCursor:null);
      setFaqs(faqList.faqs);
    }catch(e){setAlert(failure(e))}
    finally{setLoading(false)}
  },[filter,cursor,appliedSearch,mayView,mayEditFaq]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!mayManage||!mayChooseAccounts)return;
    const controller=new AbortController();
    void fetch("/api/support/agents?search="+encodeURIComponent(agentSearch.trim()),{
      signal:controller.signal,cache:"no-store",credentials:"same-origin"})
      .then(r=>r.ok?r.json():Promise.reject())
      .then((data:unknown)=>{
        if(!controller.signal.aborted&&data&&typeof data==="object"&&
          "options" in data&&Array.isArray(data.options))
          setAgents((data.options as Option[]).slice(0,30));
      }).catch(()=>{});
    return()=>controller.abort();
  },[mayManage,mayChooseAccounts,agentSearch]);
  async function detail(ref:string){
    setBusy(true);setAlert("");
    try{
      const caseData=await request<CaseDetail>("cases/"+encodeURIComponent(ref));
      setSelected(caseData);setAssignee(caseData.assignedAccountRef??"");
      setNextStatus(caseData.status);setStatusNote("");
      setReply("");setReplyKey("");
      await request("cases/"+encodeURIComponent(ref)+"/read","POST");
      await load();
    }catch(e){setAlert(failure(e))}
    finally{setBusy(false)}
  }
  async function act(kind:"REPLY"|"ASSIGN"|"CLOSE"|"REOPEN"|"CHANGE_STATUS"|"ARCHIVE"){
    if(!selected||busy)return;
    if(kind==="REPLY"&&!mayReply||["ASSIGN","CLOSE","REOPEN","CHANGE_STATUS"].includes(kind)&&!mayManage)
      return;
    setBusy(true);setAlert("");
    const id=encodeURIComponent(selected.caseRef);
    try{
      if(kind==="REPLY"){
        const key=replyKey||crypto.randomUUID();setReplyKey(key);
        await request("cases/"+id+"/reply","POST",
          {expectedRevision:selected.revision,requestKey:key,body:reply});
        setReply("");setReplyKey("");
      }else if(kind==="ASSIGN"){
        await request("cases/"+id+"/assign","POST",
          {expectedRevision:selected.revision,assignedAccountRef:assignee||null});
      }else if(kind==="CLOSE"||kind==="REOPEN"||kind==="CHANGE_STATUS"){
        const status=kind==="CLOSE"?"CLOSED":
          kind==="REOPEN"?"OPEN":nextStatus;
        if(["WAITING_FOR_USER","RESOLVED","CLOSED"].includes(status)&&
          statusNote.trim().length<8){
          setAlert("Enter a summary of at least 8 characters before saving this status.");
          return;
        }
        await request("cases/"+id+"/status","PATCH",{
          expectedRevision:selected.revision,status,
          ...(statusNote.trim()?{note:statusNote.trim()}:{})
        });
      }else{
        await request("cases/"+id+"/archive","POST",{archived:!selected.archived});
      }
      setAlert(kind==="REPLY"?"Reply saved in the private case. No email or SMS delivery is claimed.":
        "Original support record updated.");
      const updated=await request<CaseDetail>("cases/"+id);
      setSelected(updated);setNextStatus(updated.status);setStatusNote("");
      await load();
    }catch(e){setAlert(failure(e))}
    finally{setBusy(false)}
  }
  async function saveFaq(publish=false){
    if(!mayEditFaq||busy)return;
    setBusy(true);setAlert("");
    try{
      if(editing){
        await request("faqs/"+encodeURIComponent(editing.faqRef),"PATCH",{
          expectedRevision:editing.revision,question,answer,
          state:publish?"PUBLISHED":editing.state
        });
      }else{
        if(publish)throw Error("INVALID");
        await request("faqs","POST",{question,answer});
      }
      setAlert(publish?"FAQ published from the Foundation source.":"FAQ draft saved.");
      setQuestion("");setAnswer("");setEditing(null);await load();
    }catch(e){setAlert(failure(e))}
    finally{setBusy(false)}
  }
  async function faqState(f:Faq,state:"PUBLISHED"|"WITHDRAWN"){
    if(!mayEditFaq||busy)return;setBusy(true);setAlert("");
    try{
      await request("faqs/"+encodeURIComponent(f.faqRef),"PATCH",{
        expectedRevision:f.revision,state});
      setAlert("FAQ source updated.");await load();
    }catch(e){setAlert(failure(e))}
    finally{setBusy(false)}
  }
  const visible=items; // already filtered using the original server-side blind index
  const applySearch=()=>{
    if(search.trim().length>0&&search.trim().length<3){
      setAlert("Enter at least three characters to search all Foundation cases.");
      return;
    }
    setCursor(null);setPriorCursors([]);setNextCursor(null);
    setAppliedSearch(search.trim());setAlert("");
  };
  return <section className="role-workspace">
    <header className="topbar"><div><h1>Contact Messages & Help</h1>
      <p>Foundation support intake, private replies, assignments and help questions</p>
    </div><div className="toolbar">
      {mayView&&<button type="button" aria-pressed={tab==="CASES"}
        onClick={()=>setTab("CASES")}>Contact Messages</button>}
      {mayEditFaq&&<button type="button" aria-pressed={tab==="FAQ"}
        onClick={()=>setTab("FAQ")}>Help questions</button>}
      <button type="button" disabled={busy} onClick={()=>void load()}>Refresh</button>
    </div></header>
    {alert&&<p role="status" className="notice">{alert}</p>}
    {tab==="CASES"&&mayView&&<>
      {counts&&<div className="kpi-grid" aria-label="Actual Contact Messages counts">
        {([
          {key:"total",label:"Total Inquiries",hint:"All received"},
          {key:"unread",label:"Unread Inquiries",hint:"Awaiting your review"},
          {key:"closed",label:"Resolved or Closed",hint:"Finalized cases"},
          {key:"received_today",label:"Received Today",hint:"Based on server date"}
        ] as const).map(({key,label,hint})=>
          <div className="kpi" key={key}><span>{label}</span>
            <strong>{counts[key]}</strong><small>{hint}</small></div>)}
      </div>}
      <div className="search-row">
        <label htmlFor="support-filter">Status</label>
        <select id="support-filter" value={filter} onChange={e=>{setFilter(e.target.value);setCursor(null);
          setPriorCursors([]);setNextCursor(null);}}>
          {["ALL","OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER","ESCALATED",
            "REPLIED","RESOLVED","CLOSED","UNREAD","ARCHIVED"].map(x=>
            <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
        </select>
        <label htmlFor="support-search">Search all permitted messages</label>
        <input id="support-search" type="search" value={search} maxLength={100}
          onChange={e=>setSearch(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")applySearch()}}
          placeholder="Name, contact or subject (3+ characters)"/>
        <button type="button" disabled={busy} onClick={applySearch}>Search</button>
        {appliedSearch&&<button type="button" onClick={()=>{
          setSearch("");setAppliedSearch("");setCursor(null);setPriorCursors([]);setNextCursor(null);
        }}>Clear search</button>}
      </div>
      <div className="role-table-wrap"><table className="role-table">
        <thead><tr><th>Ticket</th><th>Contact</th><th>Subject</th><th>Status</th>
          <th>Received</th><th>Action</th></tr></thead>
        <tbody>{visible.map(x=><tr key={x.caseRef}>
          <td><strong>{x.ticketNumber}</strong></td>
          <td><strong>{x.name}</strong><p>{x.contact}</p></td>
          <td>{x.subject}{x.unread&&!x.archived&&<strong> · Unread</strong>}
            {x.archived&&<span> · Archived</span>}</td>
          <td>{x.status.replaceAll("_"," ")}</td>
          <td>{new Date(x.createdAt).toLocaleString()}</td>
          <td><button type="button" disabled={busy}
            onClick={()=>void detail(x.caseRef)}>Open</button></td>
        </tr>)}</tbody>
      </table>{!loading&&visible.length===0&&<p className="cg-module-empty" role="status">
        No permitted messages in this page or filter.</p>}
      </div>
      <div className="toolbar" aria-label="Support message pages">
        <button type="button" disabled={busy||priorCursors.length===0}
          onClick={()=>{const previous=priorCursors.at(-1)??"";
            setPriorCursors(old=>old.slice(0,-1));setCursor(previous||null);}}>
          Previous page</button>
        <button type="button" disabled={busy||!nextCursor}
          onClick={()=>{if(!nextCursor)return;
            setPriorCursors(old=>[...old,cursor??""]);setCursor(nextCursor);}}>
          Next page</button>
      </div>
      <p>Up to 30 current authorized cases per page. Search uses protected,
        server-side word/prefix matching without exposing contact details in URLs.</p>
      {selected&&<div className="drawer-backdrop" role="presentation">
        <section className="role-drawer" role="dialog" aria-modal="true"
          aria-label="Private Foundation support case">
          <div className="topbar"><h2>{selected.ticketNumber} · {selected.subject}</h2>
            <button type="button" onClick={()=>setSelected(null)}>Close panel</button></div>
          <p><strong>{selected.name}</strong> · {selected.contact}</p>
          <p>Status: {selected.status.replaceAll("_"," ")} · Revision {selected.revision}</p>
          <p style={{whiteSpace:"pre-wrap"}}>{selected.message}</p>
          {selected.sourceChannel==="CENTER_PORTAL"&&
           <FoundationSupportAttachments key={selected.caseRef} caseRef={selected.caseRef}/>}
          <h3>Private reply history</h3>
          {selected.replies.length===0&&<p className="cg-module-empty" role="status">No operator replies yet.</p>}
          {selected.replies.map(r=><article key={r.replyRef} className="permission-group">
            <p style={{whiteSpace:"pre-wrap"}}>{r.body}</p>
            <small>{new Date(r.createdAt).toLocaleString()}</small>
          </article>)}
          <h3>Private status and resolution notes</h3>
          {selected.statusNotes.length===0&&
            <p className="cg-module-empty">No resolution notes have been recorded.</p>}
          {selected.statusNotes.map(n=>
            <article key={n.revision} className="permission-group">
              <strong>{n.status.replaceAll("_"," ")} · revision {n.revision}</strong>
              <p style={{whiteSpace:"pre-wrap"}}>{n.summary}</p>
              <small>{new Date(n.recordedAt).toLocaleString()}</small>
            </article>)}
          <h3>Activity</h3>
          <ul>{selected.history.map((h,i)=><li key={i}>
            {h.kind.replaceAll("_"," ")} · {new Date(h.at).toLocaleString()}</li>)}</ul>
          {mayManage&&<div className="permission-group">
            <label htmlFor="support-assign">Assigned operator</label>
            {mayChooseAccounts?<><label htmlFor="support-agent-search">Find eligible support operator</label>
              <input id="support-agent-search" type="search" maxLength={70}
                value={agentSearch} onChange={e=>setAgentSearch(e.target.value)}
                placeholder="Search eligible names"/>
              <select id="support-assign" value={assignee}
              onChange={e=>setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {assignee&&!agents.some(a=>a.value===assignee)&&
                <option value={assignee}>Current assigned operator (not in search results)</option>}
              {agents.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
            </select></>:<p>Account selector unavailable for this role.</p>}
            <button type="button" disabled={busy||!mayChooseAccounts}
              onClick={()=>void act("ASSIGN")}>Save assignment</button>
            <label htmlFor="support-status">Current case status</label>
            <select id="support-status" value={nextStatus}
              onChange={e=>setNextStatus(e.target.value)}>
              {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER",
                "ESCALATED","RESOLVED","CLOSED","REPLIED"].map(value=>
                <option key={value} value={value}
                  disabled={value==="REPLIED"||
                    selected.status==="CLOSED"&&value!=="OPEN"||
                    selected.status==="RESOLVED"&&!["OPEN","CLOSED"].includes(value)||
                    value==="ASSIGNED"&&!selected.assignedAccountRef}>
                  {value.replaceAll("_"," ")}
                </option>)}
            </select>
            <label htmlFor="support-status-note">
              Private status or resolution summary
              <textarea id="support-status-note" rows={3} maxLength={1200}
                value={statusNote} onChange={e=>setStatusNote(e.target.value)}
                placeholder="Required for Waiting for User, Resolved and Closed"/>
            </label>
            <p>Required for waiting, resolved and closed cases; visible only to
              authorized Foundation staff. It is not emailed automatically.</p>
            <button type="button" disabled={busy||nextStatus===selected.status||
              ["WAITING_FOR_USER","RESOLVED","CLOSED"].includes(nextStatus)&&
              statusNote.trim().length<8}
              onClick={()=>void act("CHANGE_STATUS")}>Save status</button>
            <div className="toolbar">
              <button type="button" disabled={busy||selected.status==="CLOSED"||statusNote.trim().length<8}
                onClick={()=>void act("CLOSE")}>Close case</button>
              <button type="button" disabled={busy||selected.status==="OPEN"}
                onClick={()=>void act("REOPEN")}>Reopen case</button>
            </div>
          </div>}
          {mayReply&&selected.status!=="CLOSED"&&<div className="field">
            <label htmlFor="support-reply">Private Foundation reply</label>
            <textarea id="support-reply" rows={5} minLength={2} maxLength={2400}
              value={reply} onChange={e=>setReply(e.target.value)}/>
            <button className="primary" type="button" disabled={busy||reply.trim().length<2}
              onClick={()=>void act("REPLY")}>Save original reply</button>
            <small>Saving here does not claim that a message was delivered externally.</small>
          </div>}
          <div className="toolbar"><button type="button" disabled={busy}
            onClick={()=>void act("ARCHIVE")}>
            {selected.archived?"Restore from archive":"Archive for my account"}
          </button></div>
        </section>
      </div>}
    </>}
    {tab==="FAQ"&&mayEditFaq&&<>
      <div className="role-pane" style={{padding:"1.25rem"}}>
        <h2>{editing?"Edit help question":"New Foundation help question"}</h2>
        <div className="form">
          <div className="field"><label htmlFor="faq-question">Question</label>
            <input id="faq-question" value={question} maxLength={200}
              onChange={e=>setQuestion(e.target.value)}/></div>
          <div className="field"><label htmlFor="faq-answer">Answer</label>
            <textarea id="faq-answer" value={answer} maxLength={1600} rows={4}
              onChange={e=>setAnswer(e.target.value)}/></div>
          <div className="toolbar">
            <button type="button" className="primary" disabled={busy}
              onClick={()=>void saveFaq()}>Save draft/revision</button>
            {editing&&editing.state!=="PUBLISHED"&&
              <button type="button" disabled={busy}
                onClick={()=>void saveFaq(true)}>Publish</button>}
            {editing&&<button type="button" onClick={()=>{setEditing(null);
              setQuestion("");setAnswer("")}}>Cancel edit</button>}
          </div>
        </div>
      </div>
      <div className="role-table-wrap"><table className="role-table">
        <thead><tr><th>Question</th><th>Status</th><th>Revision</th><th>Actions</th></tr></thead>
        <tbody>{faqs.map(f=><tr key={f.faqRef}>
          <td>{f.question}</td><td>{f.state}</td><td>{f.revision}</td>
          <td><div className="toolbar">
            <button type="button" disabled={busy} onClick={()=>{
              setEditing(f);setQuestion(f.question);setAnswer(f.answer)}}>Edit</button>
            {f.state==="DRAFT"&&<button type="button" disabled={busy}
              onClick={()=>void faqState(f,"PUBLISHED")}>Publish</button>}
            {f.state==="PUBLISHED"&&<button type="button" disabled={busy}
              onClick={()=>void faqState(f,"WITHDRAWN")}>Withdraw</button>}
          </div></td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
