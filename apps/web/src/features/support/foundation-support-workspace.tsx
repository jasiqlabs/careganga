"use client";
import {useCallback,useEffect,useState} from "react";
import {FoundationSupportAttachments} from "./foundation-support-attachments";

type CaseItem={caseRef:string;ticketNumber:string;subject:string;name:string;contact:string;
  status:string;revision:number;assignedAccountRef:string|null;
  createdAt:string;updatedAt:string;unread:boolean;archived:boolean};
type CaseDetail=CaseItem&{sourceChannel:string;message:string;replies:Array<{replyRef:string;
  authorAccountRef:string;body:string;createdAt:string}>;
  history:Array<{kind:string;at:string}>;
  statusNotes?:Array<{revision:number;status:string;summary:string;recordedAt:string}>};
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

function statusBadgeClass(status:string){
  switch(status){
    case "OPEN": return "cg19-badge cg19-badge-info";
    case "ASSIGNED": return "cg19-badge cg19-badge-purple";
    case "IN_PROGRESS": return "cg19-badge cg19-badge-info";
    case "WAITING_FOR_USER": return "cg19-badge cg19-badge-warning";
    case "ESCALATED": return "cg19-badge cg19-badge-danger";
    case "REPLIED": return "cg19-badge cg19-badge-teal";
    case "RESOLVED": return "cg19-badge cg19-badge-success";
    case "CLOSED": return "cg19-badge cg19-badge-neutral";
    case "ARCHIVED": return "cg19-badge cg19-badge-neutral";
    default: return "cg19-badge cg19-badge-neutral";
  }
}

function faqBadgeClass(state:string){
  switch(state){
    case "PUBLISHED": return "cg19-badge cg19-badge-success";
    case "DRAFT": return "cg19-badge cg19-badge-warning";
    case "WITHDRAWN": return "cg19-badge cg19-badge-danger";
    default: return "cg19-badge cg19-badge-neutral";
  }
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
          Promise.resolve({items:[],counts:null,nextCursor:null}),
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

  const visible=items;
  const applySearch=()=>{
    if(search.trim().length>0&&search.trim().length<3){
      setAlert("Enter at least three characters to search all Foundation cases.");
      return;
    }
    setCursor(null);setPriorCursors([]);setNextCursor(null);
    setAppliedSearch(search.trim());setAlert("");
  };

  const statusNoteNeedsLength=["WAITING_FOR_USER","RESOLVED","CLOSED"].includes(nextStatus);
  const statusNoteValid=!statusNoteNeedsLength||statusNote.trim().length>=8;

  return <section className="role-workspace">
    <header className="topbar"><div><h1>Contact Messages &amp; Help</h1>
      <p>Foundation support intake, private replies, assignments and help questions (C39–C43)</p>
    </div><div className="toolbar">
      {mayView&&<button type="button" aria-pressed={tab==="CASES"}
        onClick={()=>setTab("CASES")}>Contact Messages (C39)</button>}
      {mayEditFaq&&<button type="button" aria-pressed={tab==="FAQ"}
        onClick={()=>setTab("FAQ")}>Help questions &amp; FAQ</button>}
      <button type="button" disabled={busy} onClick={()=>void load()}>Refresh</button>
    </div></header>

    {alert&&<p role="status" className="notice info">{alert}</p>}

    {tab==="CASES"&&mayView&&<>
      {/* C39 Contact Messages KPI Dashboard */}
      {counts&&<div className="kpi-grid" aria-label="Actual Contact Messages counts (C39)">
        {([
          {key:"total",label:"Total Inquiries",count:counts.total,hint:"All received in Foundation"},
          {key:"unread",label:"Unread Inquiries",count:counts.unread,hint:"Awaiting your operator review"},
          {key:"replied",label:"Replied Inquiries",count:counts.replied,hint:"Responded by staff"},
          {key:"closed",label:"Resolved or Closed",count:counts.closed,hint:"Finalized cases"},
          {key:"received_today",label:"Received Today",count:counts.received_today,hint:"Based on server date"}
        ] as const).map(({key,label,count,hint})=>
          <article className="kpi" key={key}>
            <small>{label}</small>
            <strong>{count}</strong>
            <span>{hint}</span>
          </article>)}
      </div>}

      {/* C39 Status Filter Tabs / Pills */}
      <div className="cg19-filter-tabs" role="tablist" aria-label="Support status filter tabs (C39)">
        {([
          "ALL","UNREAD","OPEN","ASSIGNED","IN_PROGRESS",
          "WAITING_FOR_USER","ESCALATED","REPLIED","RESOLVED","CLOSED","ARCHIVED"
        ] as const).map(pillKey=>
          <button key={pillKey} type="button"
            className={`cg19-tab-btn ${filter===pillKey?"is-active":""}`}
            aria-pressed={filter===pillKey}
            onClick={()=>{
              setFilter(pillKey);setCursor(null);setPriorCursors([]);setNextCursor(null);
            }}>
            <span>{pillKey.replaceAll("_"," ")}</span>
            {pillKey==="UNREAD"&&counts&&counts.unread>0&&
              <span className="cg19-tab-count">{counts.unread}</span>}
          </button>)}
      </div>

      {/* Search and Filter Row */}
      <div className="search-row">
        <label htmlFor="support-search" className="sr-only">Search all permitted messages</label>
        <input id="support-search" type="search" value={search} maxLength={100}
          onChange={e=>setSearch(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter")applySearch()}}
          placeholder="Search by name, contact or subject (3+ characters)"/>
        <button type="button" className="primary" disabled={busy} onClick={applySearch}>Search</button>
        {appliedSearch&&<button type="button" onClick={()=>{
          setSearch("");setAppliedSearch("");setCursor(null);setPriorCursors([]);setNextCursor(null);
        }}>Clear search</button>}
      </div>

      {/* C40/C41 Inquiries Table */}
      <div className="role-table-wrap"><table className="role-table">
        <thead><tr><th>Ticket</th><th>Contact</th><th>Subject</th><th>Status</th>
          <th>Received</th><th>Action</th></tr></thead>
        <tbody>{visible.map(x=><tr key={x.caseRef}>
          <td>
            <code style={{fontWeight:700,color:"var(--cg-sidebar)",fontSize:"0.85rem"}}>
              {x.ticketNumber}
            </code>
          </td>
          <td>
            <strong>{x.name}</strong>
            <p style={{fontSize:"0.825rem",color:"var(--cg-muted)"}}>{x.contact}</p>
          </td>
          <td>
            {x.subject}
            {x.unread&&!x.archived&&<span style={{marginLeft:"0.5rem"}} className="cg19-badge cg19-badge-warning">Unread</span>}
            {x.archived&&<span style={{marginLeft:"0.5rem"}} className="cg19-badge cg19-badge-neutral">Archived</span>}
          </td>
          <td>
            <span className={statusBadgeClass(x.status)}>
              {x.status.replaceAll("_"," ")}
            </span>
          </td>
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
        <small style={{color:"var(--cg-muted)"}}>
          Up to 30 current authorized cases per page. Search uses protected,
          server-side word/prefix matching without exposing contact details in URLs.
        </small>
      </div>

      {/* C42/C43 Help & Support Drawer */}
      {selected&&<div className="drawer-backdrop" role="presentation" onClick={()=>setSelected(null)}>
        <section className="role-drawer" role="dialog" aria-modal="true"
          aria-label="Private Foundation support case" onClick={e=>e.stopPropagation()}>
          <div className="topbar">
            <div>
              <h2 style={{margin:0}}>
                <span className="cg19-badge cg19-badge-info" style={{marginRight:"0.5rem"}}>
                  {selected.ticketNumber}
                </span>
                {selected.subject}
              </h2>
            </div>
            <button type="button" onClick={()=>setSelected(null)}>Close panel</button>
          </div>

          <aside className="permission-group" style={{marginTop:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"0.5rem"}}>
              <div>
                <strong>{selected.name}</strong>
                <p style={{margin:"0.25rem 0",color:"var(--cg-muted)"}}>{selected.contact}</p>
              </div>
              <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap"}}>
                <span className={statusBadgeClass(selected.status)}>{selected.status.replaceAll("_"," ")}</span>
                <span className="cg19-badge cg19-badge-neutral">{selected.sourceChannel.replaceAll("_"," ")}</span>
                <span className="cg19-badge cg19-badge-neutral">Rev {selected.revision}</span>
              </div>
            </div>
          </aside>

          <div className="permission-group" style={{marginTop:"0.75rem"}}>
            <strong>Original inquiry:</strong>
            <p style={{whiteSpace:"pre-wrap",lineHeight:1.6,margin:0}}>{selected.message}</p>
            <small style={{color:"var(--cg-muted)"}}>Received on {new Date(selected.createdAt).toLocaleString()}</small>
          </div>

          {selected.sourceChannel==="CENTER_PORTAL"&&
           <FoundationSupportAttachments key={selected.caseRef} caseRef={selected.caseRef}/>}

          <h3 style={{marginTop:"1.25rem",marginBottom:"0.5rem"}}>Private reply history</h3>
          {selected.replies.length===0&&<p className="cg-module-empty" role="status">No operator replies yet.</p>}
          {selected.replies.map(r=><article key={r.replyRef} className="permission-group" style={{background:"#F8FAFC"}}>
            <p style={{whiteSpace:"pre-wrap",margin:0}}>{r.body}</p>
            <small style={{color:"var(--cg-muted)",display:"block",marginTop:"0.5rem"}}>
              {new Date(r.createdAt).toLocaleString()}
            </small>
          </article>)}

          <h3 style={{marginTop:"1.25rem",marginBottom:"0.5rem"}}>Private status and resolution notes</h3>
          {((selected.statusNotes?.length??0)===0)&&
            <p className="cg-module-empty">No resolution notes have been recorded.</p>}
          {(selected.statusNotes??[]).map(n=>
            <article key={n.revision} className="permission-group" style={{borderLeft:"3px solid var(--cg-accent)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span className={statusBadgeClass(n.status)}>{n.status.replaceAll("_"," ")}</span>
                <small style={{color:"var(--cg-muted)"}}>Rev {n.revision} · {new Date(n.recordedAt).toLocaleString()}</small>
              </div>
              <p style={{whiteSpace:"pre-wrap",margin:"0.5rem 0 0 0"}}>{n.summary}</p>
            </article>)}

          <h3 style={{marginTop:"1.25rem",marginBottom:"0.5rem"}}>Activity audit</h3>
          <ul style={{fontSize:"0.825rem",color:"var(--cg-muted)",paddingLeft:"1.25rem",margin:0}}>
            {selected.history.map((h,i)=><li key={i}>
              {h.kind.replaceAll("_"," ")} · {new Date(h.at).toLocaleString()}
            </li>)}
          </ul>

          {mayManage&&<div className="permission-group" style={{marginTop:"1.25rem"}}>
            <strong>Operator Assignment</strong>
            {mayChooseAccounts?<div className="form">
              <label htmlFor="support-agent-search">Search eligible support operator</label>
              <input id="support-agent-search" type="search" maxLength={70}
                value={agentSearch} onChange={e=>setAgentSearch(e.target.value)}
                placeholder="Search staff names"/>
              <select id="support-assign" value={assignee}
                onChange={e=>setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {assignee&&!agents.some(a=>a.value===assignee)&&
                  <option value={assignee}>Current assigned operator (not in search results)</option>}
                {agents.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <button type="button" disabled={busy||!mayChooseAccounts}
                onClick={()=>void act("ASSIGN")}>Save assignment</button>
            </div>:<p>Account selector unavailable for this role.</p>}

            <hr style={{margin:"1rem 0",borderColor:"var(--cg-border)"}} />

            <strong>Case Status &amp; Resolution (C42)</strong>
            <div className="form">
              <label htmlFor="support-status">Update status</label>
              <select id="support-status" value={nextStatus}
                onChange={e=>setNextStatus(e.target.value)}>
                {["OPEN","ASSIGNED","IN_PROGRESS","WAITING_FOR_USER",
                  "ESCALATED","RESOLVED","CLOSED","REPLIED"].map(value=>
                  <option key={value} value={value}
                    disabled={value==="REPLIED"||
                      (selected.status==="CLOSED"&&value!=="OPEN")||
                      (selected.status==="RESOLVED"&&!["OPEN","CLOSED"].includes(value))||
                      (value==="ASSIGNED"&&!selected.assignedAccountRef)}>
                    {value.replaceAll("_"," ")}
                  </option>)}
              </select>

              <label htmlFor="support-status-note">
                Private status or resolution summary ({statusNote.length}/1200)
                <textarea id="support-status-note" rows={3} maxLength={1200}
                  value={statusNote} onChange={e=>setStatusNote(e.target.value)}
                  placeholder="Required for Waiting for User, Resolved and Closed (minimum 8 characters)"/>
              </label>

              {statusNoteNeedsLength&&<small style={{color:statusNoteValid?"var(--cg-muted)":"#DC2626"}}>
                {statusNoteValid?
                  `Valid note length: ${statusNote.trim().length} characters`:
                  `Enter at least 8 characters (${statusNote.trim().length}/8 entered)`}
              </small>}

              <button type="button" className="primary"
                disabled={busy||nextStatus===selected.status||!statusNoteValid}
                onClick={()=>void act("CHANGE_STATUS")}>Save status</button>

              <div className="toolbar" style={{marginTop:"0.5rem"}}>
                <button type="button"
                  disabled={busy||selected.status==="CLOSED"||statusNote.trim().length<8}
                  onClick={()=>void act("CLOSE")}>Close case</button>
                <button type="button"
                  disabled={busy||selected.status==="OPEN"}
                  onClick={()=>void act("REOPEN")}>Reopen case</button>
              </div>
              {selected.status==="CLOSED"&&
                <small style={{color:"var(--cg-muted)"}}>
                  This case is closed. Click &quot;Reopen case&quot; to resume work on it.
                </small>}
              {selected.status!=="CLOSED"&&statusNote.trim().length<8&&
                <small style={{color:"var(--cg-muted)"}}>
                  Enter at least 8 characters in the status note above to close this case.
                </small>}
            </div>
          </div>}

          {mayReply&&!["CLOSED","RESOLVED"].includes(selected.status)&&<div className="field" style={{marginTop:"1.25rem"}}>
            <label htmlFor="support-reply"><strong>Private Foundation reply</strong></label>
            <textarea id="support-reply" rows={5} minLength={2} maxLength={2400}
              value={reply} onChange={e=>setReply(e.target.value)}
              placeholder="Type official private response (min 2 characters)"/>
            <button className="primary" type="button" disabled={busy||reply.trim().length<2}
              onClick={()=>void act("REPLY")}>Save original reply</button>
            <small style={{color:"var(--cg-muted)"}}>Saving here does not claim that a message was delivered externally.</small>
          </div>}

          <div className="toolbar" style={{marginTop:"1.25rem",paddingTop:"1rem",borderTop:"1px solid var(--cg-border)"}}>
            <button type="button" disabled={busy}
              onClick={()=>void act("ARCHIVE")}>
              {selected.archived?"Restore from archive":"Archive for my account"}
            </button>
          </div>
        </section>
      </div>}
    </>}

    {tab==="FAQ"&&mayEditFaq&&<>
      <div className="role-pane" style={{padding:"1.25rem"}}>
        <h2>{editing?"Edit help question":"New Foundation help question"}</h2>
        <div className="form">
          <div className="field"><label htmlFor="faq-question">Question</label>
            <input id="faq-question" value={question} maxLength={200}
              onChange={e=>setQuestion(e.target.value)}
              placeholder="e.g. How can I verify my membership certificate?"/></div>
          <div className="field"><label htmlFor="faq-answer">Answer</label>
            <textarea id="faq-answer" value={answer} maxLength={1600} rows={4}
              onChange={e=>setAnswer(e.target.value)}
              placeholder="Official sanitized answer visible to visitors"/></div>
          <div className="toolbar">
            <button type="button" className="primary" disabled={busy||!question.trim()||!answer.trim()}
              onClick={()=>void saveFaq()}>Save draft/revision</button>
            {editing&&editing.state!=="PUBLISHED"&&
              <button type="button" disabled={busy}
                onClick={()=>void saveFaq(true)}>Publish</button>}
            {editing&&<button type="button" onClick={()=>{setEditing(null);
              setQuestion("");setAnswer("")}}>Cancel edit</button>}
          </div>
        </div>
      </div>
      <div className="role-table-wrap" style={{marginTop:"1rem"}}><table className="role-table">
        <thead><tr><th>Question</th><th>Status</th><th>Revision</th><th>Actions</th></tr></thead>
        <tbody>{faqs.map(f=><tr key={f.faqRef}>
          <td><strong>{f.question}</strong><p style={{fontSize:"0.85rem",color:"var(--cg-muted)"}}>{f.answer}</p></td>
          <td><span className={faqBadgeClass(f.state)}>{f.state}</span></td>
          <td>Rev {f.revision}</td>
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
