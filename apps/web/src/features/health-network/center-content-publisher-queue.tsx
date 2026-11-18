"use client";
import {useCallback,useEffect,useState} from "react";
type Case={caseRef:string;reference:string;centerRef:string;centerName:string;
 status:string;readyToPublish:boolean;isCurrentPublished:boolean;
 publicationGeneration:number|null;approvedRevisionRef:string|null};
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const res=await fetch("/api/health-network/my-centers/"+path,{
  ...init,cache:"no-store",credentials:"same-origin"});
 const data:unknown=await res.json().catch(()=>null);
 if(!res.ok)throw Error(data&&typeof data==="object"&&"message" in data&&
  typeof data.message==="string"?data.message:
  "Current approved content could not be confirmed.");
 return data as T;
}
/** This UI requires health.centers.publish, NOT approvals.review. */
export function CenterContentPublisherQueue(){
 const [records,setRecords]=useState<Case[]>([]);
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  try{
   const data=await api<{cases:Case[]}>("content/publishing");
   setRecords(data.cases);setUncertain(false);setError("");
  }catch(e){setRecords([]);setError(e instanceof Error?e.message:
   "The approved content queue is unavailable.");}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 async function change(item:Case,kind:"publish"|"withdraw"){
  if(busy||uncertain||password.length<8||
     kind==="publish"&&!item.readyToPublish||
     kind==="withdraw"&&(!item.isCurrentPublished||
      item.publicationGeneration===null||!item.approvedRevisionRef))return;
  setBusy(true);setError("");setNotice("");
  try{
   await api(kind==="publish"?
     "content/reviews/"+encodeURIComponent(item.caseRef)+"/apply":
     encodeURIComponent(item.centerRef)+"/content/withdraw",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(kind==="publish"?{currentPassword:password}:{
     currentPassword:password,expectedGeneration:item.publicationGeneration,
     approvedRevisionRef:item.approvedRevisionRef})
   });
   setPassword("");await refresh();
   setNotice(kind==="publish"?
    "The independently approved center presentation was published.":
    "The currently published presentation was withdrawn.");
  }catch(e){setUncertain(true);setError(e instanceof Error?e.message:
   "Publication state is uncertain. Refresh the original queue before retrying.");}
  finally{setBusy(false);}
 }
 return <section className="form-section" aria-labelledby="content-publisher-heading">
  <h2 id="content-publisher-heading">Approved content — Foundation publication</h2>
  <p>Review and publication are separate permissions. This queue shows only
   already-reviewed case references and current publication status—not
   private evidence or reviewer actions.</p>
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  <label>Current Foundation password to publish or withdraw
   <input type="password" value={password} autoComplete="current-password"
    disabled={busy} onChange={e=>setPassword(e.target.value)}/>
  </label>
  <button type="button" disabled={busy} onClick={()=>void refresh()}>
   Refresh approved cases</button>
  {uncertain&&<p role="alert">A recent change may already be recorded.
   Refresh original publication status before retrying.</p>}
  {records.length===0&&<p>No approved content cases are currently visible.</p>}
  <div className="role-table-wrap"><table className="role-table">
   <thead><tr><th>Center</th><th>Original approval</th><th>Current status</th>
    <th>Publication action</th></tr></thead>
   <tbody>{records.map(c=><tr key={c.caseRef}>
    <td>{c.centerName}</td><td>{c.reference}</td>
    <td>{c.readyToPublish?"Approved; awaiting publication":
     c.isCurrentPublished?"Current published presentation":
     "Previously reviewed; not current"}</td>
    <td><div className="toolbar">
     {c.readyToPublish&&<button type="button"
      disabled={busy||uncertain||password.length<8}
      onClick={()=>void change(c,"publish")}>Publish approved version</button>}
     {c.isCurrentPublished&&<button type="button"
      disabled={busy||uncertain||password.length<8}
      onClick={()=>void change(c,"withdraw")}>Withdraw current version</button>}
    </div></td>
   </tr>)}</tbody>
  </table></div>
 </section>;
}
