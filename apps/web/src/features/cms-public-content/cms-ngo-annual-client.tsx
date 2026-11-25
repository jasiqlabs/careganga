"use client";
import {useMemo,useState} from "react";

export type ApprovedAnnualReport={title:string;date:string;href:string};
export function CmsNgoAnnualReports({reports,kind="annual"}:{reports:ApprovedAnnualReport[];kind?:"annual"|"financial"}){
 const [year,setYear]=useState("ALL");
 const approved=useMemo(()=>reports.filter(r=>{
  if(!r||typeof r.title!=="string"||!r.title.trim()||typeof r.date!=="string"||
   !/^\d{4}-\d{2}-\d{2}$/.test(r.date)||typeof r.href!=="string"||
   !/^\/api\/public\/content\/media\/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(r.href))return false;
  const date=new Date(r.date+"T00:00:00Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===r.date;
 }),[reports]);
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
   <div className="cg-site-table-wrap" tabIndex={0} role="region" aria-label={"Approved "+kind+" documents table"}><table className="cg-site-evidence-table" role="table">
    <caption>Current Foundation-published {kind} documents</caption>
    <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Report</th><th scope="col" role="columnheader">Document date</th>
     <th scope="col" role="columnheader">Approved file</th></tr></thead>
    <tbody role="rowgroup">{matching.length===0?<tr role="row"><td role="cell" colSpan={3} className="cg-site-report-empty">{approved.length?"No approved report is available for the selected year.":"No reports published yet."}</td></tr>:matching.map((r,i)=><tr role="row" key={r.href+"-"+i}>
     <th scope="row" role="rowheader">{r.title}</th><td role="cell"><span className="cg-site-report-date-label">Document date: </span>{r.date}</td>
     <td role="cell"><a href={r.href} download>View document</a></td>
    </tr>)}</tbody>
   </table></div>
 </section>;
}
