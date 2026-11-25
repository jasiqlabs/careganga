"use client";
import {useMemo,useState} from "react";

export type ApprovedAnnualReport={title:string;date:string;href:string};
export function CmsNgoAnnualReports({reports,kind="annual"}:{reports:ApprovedAnnualReport[];kind?:"annual"|"financial"}){
 const [year,setYear]=useState("ALL");
 const approved=useMemo(()=>reports.filter(r=>/^\/api\/public\/content\/media\/[a-f0-9-]{36}$/i.test(r.href)),[reports]);
 const years=useMemo(()=>Array.from(new Set(approved.map(r=>r.date.slice(0,4))))
  .filter(v=>/^\d{4}$/.test(v)).sort((a,b)=>b.localeCompare(a)),[approved]);
 const selected=years.includes(year)?year:"ALL";
 const matching=approved.filter(r=>selected==="ALL"||r.date.startsWith(selected+"-"));
 return <section className="cg-site-report-panel" aria-label={"Foundation-published "+kind+" reports"}>
  <div className="cg-site-gallery-filters">
   <h2>{kind==="annual"?"All Annual Reports":"All Financial Reports"}</h2>
   <label>Document year
    <select value={selected} onChange={e=>setYear(e.target.value)}>
     <option value="ALL">All years</option>
     {years.map(v=><option key={v} value={v}>{v}</option>)}
    </select>
   </label>
   <button className="cg-site-filter-reset" type="button" disabled={selected==="ALL"}
    onClick={()=>setYear("ALL")}>Reset Filters</button>
  </div>
  <p className="cg-site-provenance" role="status" aria-live="polite">
   {matching.length} approved {matching.length===1?"report":"reports"} match
  </p>
   <div className="cg-site-table-wrap" tabIndex={0} role="region" aria-label={"Approved "+kind+" documents table"}><table className="cg-site-evidence-table">
    <caption>Current Foundation-published {kind} documents</caption>
    <thead><tr><th scope="col">Report</th><th scope="col">Document date</th>
     <th scope="col">Approved file</th></tr></thead>
    <tbody>{matching.length===0?<tr><td colSpan={3} className="cg-site-report-empty">{approved.length?"No approved report is available for the selected year.":"No reports published yet."}</td></tr>:matching.map((r,i)=><tr key={r.href+"-"+i}>
     <th scope="row">{r.title}</th><td>{r.date}</td>
     <td><a href={r.href} download>View document</a></td>
    </tr>)}</tbody>
   </table></div>
 </section>;
}
