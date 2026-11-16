"use client";
import {useCallback,useEffect,useState} from "react";
type CaseItem={caseRef:string;subject:string;name:string;contact:string;
  status:string;revision:number;assignedAccountRef:string|null;
  createdAt:string;updatedAt:string;unread:boolean;archived:boolean};
type CaseDetail=CaseItem&{message:string;replies:Array<{replyRef:string;
  authorAccountRef:string;body:string;createdAt:string}>;
  history:Array<{kind:string;at:string}>};
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
  const [agents,setAgents]=useState<Option[]>([]);
  const [faqs,setFaqs]=useState<Faq[]>([]);
  const [question,setQuestion]=useState(""),[answer,setAnswer]=useState("");
  const [editing,setEditing]=useState<Faq|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [cases,faqList]=await Promise.all([
        mayView?request<{items:CaseItem[];counts:Counts;nextCursor:string|null}>(
          "cases?limit=30&filter="+encodeURIComponent(filter)+
          (cursor?"&cursor="+encodeURIComponent(cursor):"")):
          Promise.resolve({items:[],counts:null}),
        mayEditFaq?request<{faqs:Faq[]}>("faqs"):Promise.resolve({faqs:[]})
      ]);
      setItems(cases.items);setCounts(cases.counts);
      setNextCursor("nextCursor" in cases?cases.nextCursor:null);
      setFaqs(faqList.faqs);
    }catch(e){setAlert(failure(e))}
    finally{setLoading(false)}
  },[filter,cursor,mayView,mayEditFaq]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!mayManage||!mayChooseAccounts)return;
    const controller=new AbortController();
    void fetch("/api/access/accounts/options?search=",{
      signal:controller.signal,cache:"no-store",credentials:"same-origin"})
      .then(r=>r.ok?r.json():Promise.reject())
      .then((data:unknown)=>{
        if(!controller.signal.aborted&&data&&typeof data==="object"&&
          "options" in data&&Array.isArray(data.options))
          setAgents((data.options as Option[]).slice(0,30));
      }).catch(()=>{});
    return()=>controller.abort();
  },[mayManage,mayChooseAccounts]);
  async function detail(ref:string){
    setBusy(true);setAlert("");
    try{
      const caseData=await request<CaseDetail>("cases/"+encodeURIComponent(ref));
      setSelected(caseData);setAssignee(caseData.assignedAccountRef??"");
      setReply("");setReplyKey("");
      await request("cases/"+encodeURIComponent(ref)+"/read","POST");
      await load();
    }catch(e){setAlert(failure(e))}
    finally{setBusy(false)}
  }
  async function act(kind:"REPLY"|"ASSIGN"|"CLOSE"|"REOPEN"|"ARCHIVE"){
    if(!selected||busy)return;
    if(kind==="REPLY"&&!mayReply||["ASSIGN","CLOSE","REOPEN"].includes(kind)&&!mayManage)
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
      }else if(kind==="CLOSE"||kind==="REOPEN"){
        await request("cases/"+id+"/status","PATCH",
          {expectedRevision:selected.revision,status:kind==="CLOSE"?"CLOSED":"OPEN"});
      }else{
        await request("cases/"+id+"/archive","POST",{archived:!selected.archived});
      }
      setAlert(kind==="REPLY"?"Reply saved in the private case. No email or SMS delivery is claimed.":
        "Original support record updated.");
      const updated=await request<CaseDetail>("cases/"+id);
      setSelected(updated);
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
  const visible=items.filter(x=>
    [x.subject,x.name,x.status,x.contact].some(v=>
      v.toLowerCase().includes(search.toLowerCase())));
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
          {key:"closed",label:"Resolved Messages",hint:"Cases closed by the Foundation"},
          {key:"received_today",label:"Received Today",hint:"Based on server date"}
        ] as const).map(({key,label,hint})=>
          <div className="kpi" key={key}><span>{label}</span>
            <strong>{counts[key]}</strong><small>{hint}</small></div>)}
      </div>}
      <div className="search-row">
        <label htmlFor="support-filter">Status</label>
        <select id="support-filter" value={filter} onChange={e=>{setFilter(e.target.value);setCursor(null);
          setPriorCursors([]);setNextCursor(null);}}>
          {["ALL","OPEN","UNREAD","REPLIED","CLOSED","ARCHIVED"].map(x=>
            <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
        </select>
        <label htmlFor="support-search">Search current page</label>
        <input id="support-search" type="search" value={search}
          onChange={e=>setSearch(e.target.value)} placeholder="Name or subject"/>
      </div>
      <div className="role-table-wrap"><table className="role-table">
        <thead><tr><th>Contact</th><th>Subject</th><th>Status</th>
          <th>Received</th><th>Action</th></tr></thead>
        <tbody>{visible.map(x=><tr key={x.caseRef}>
          <td><strong>{x.name}</strong><p>{x.contact}</p></td>
          <td>{x.subject}{x.unread&&!x.archived&&<strong> · Unread</strong>}
            {x.archived&&<span> · Archived</span>}</td>
          <td>{x.status==="CLOSED"?"RESOLVED":x.status}</td>
          <td>{new Date(x.createdAt).toLocaleString()}</td>
          <td><button type="button" disabled={busy}
            onClick={()=>void detail(x.caseRef)}>Open</button></td>
        </tr>)}</tbody>
      </table>{!loading&&visible.length===0&&<p className="notice">
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
      <p>Up to 30 authorized messages per page, with server-side paging.
        Search filters this page only.</p>
      {selected&&<div className="drawer-backdrop" role="presentation">
        <section className="role-drawer" role="dialog" aria-modal="true"
          aria-label="Private Foundation support case">
          <div className="topbar"><h2>{selected.subject}</h2>
            <button type="button" onClick={()=>setSelected(null)}>Close panel</button></div>
          <p><strong>{selected.name}</strong> · {selected.contact}</p>
          <p>Status: {selected.status==="CLOSED"?"RESOLVED":selected.status} · Revision {selected.revision}</p>
          <p style={{whiteSpace:"pre-wrap"}}>{selected.message}</p>
          <h3>Private reply history</h3>
          {selected.replies.length===0&&<p>No operator replies yet.</p>}
          {selected.replies.map(r=><article key={r.replyRef} className="permission-group">
            <p style={{whiteSpace:"pre-wrap"}}>{r.body}</p>
            <small>{new Date(r.createdAt).toLocaleString()}</small>
          </article>)}
          <h3>Activity</h3>
          <ul>{selected.history.map((h,i)=><li key={i}>
            {h.kind.replaceAll("_"," ")} · {new Date(h.at).toLocaleString()}</li>)}</ul>
          {mayManage&&<div className="permission-group">
            <label htmlFor="support-assign">Assigned operator</label>
            {mayChooseAccounts?<select id="support-assign" value={assignee}
              onChange={e=>setAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
            </select>:<p>Account selector unavailable for this role.</p>}
            <button type="button" disabled={busy||!mayChooseAccounts}
              onClick={()=>void act("ASSIGN")}>Save assignment</button>
            <div className="toolbar">
              <button type="button" disabled={busy||selected.status==="CLOSED"}
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
