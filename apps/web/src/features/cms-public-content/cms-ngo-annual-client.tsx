"use client";
import {useMemo,useState} from "react";
import {BarChart2,IndianRupee,ShieldCheck,RotateCcw} from "lucide-react";
import {CustomDropdown} from "../../shared/custom-dropdown";
import {CmsNgoDocModalButton} from "./cms-ngo-doc-modal";

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
 const HeaderIcon=kind==="annual"?BarChart2:IndianRupee;
 return <div className="cg-site-ngo-reports-stack">
  <section className="cg-site-report-panel cg-site-ngo-report-card" aria-label={"Foundation-published "+kind+" reports"}>
   <div className="cg-site-ngo-report-header">
    <div className="cg-site-ngo-report-title">
     <span className="cg-site-ngo-report-icon"><HeaderIcon size={17} aria-hidden="true"/></span>
     <h2>{kind==="annual"?"All Annual Reports":"All Financial Reports"}</h2>
    </div>
    <div className="cg-site-ngo-report-controls">
     <div style={{minWidth:"160px"}}>
      <CustomDropdown
       id={"cg-ngo-year-"+kind}
       value={selected}
       onChange={setYear}
       options={[{value:"ALL",label:"All Years"},...years.map(v=>({value:v,label:v}))]}
      />
     </div>
     <button className="cg-site-filter-reset" type="button" disabled={selected==="ALL"}
      onClick={()=>setYear("ALL")}><RotateCcw size={13} aria-hidden="true"/> Reset Filters</button>
    </div>
   </div>
   <p className="cg-site-provenance" role="status" aria-live="polite">
    {matching.length} approved {matching.length===1?"report":"reports"} match
   </p>
   <div className="cg-site-table-wrap" tabIndex={0} role="region" aria-label={"Approved "+kind+" documents table"}>
    <table className="cg-site-evidence-table" role="table">
     <caption>Current Foundation-published {kind} documents</caption>
     <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Report Title</th><th scope="col" role="columnheader">Document Date</th>
      <th scope="col" role="columnheader">Actions</th></tr></thead>
     <tbody role="rowgroup">{matching.length===0?<tr role="row"><td role="cell" colSpan={3} className="cg-site-report-empty">{approved.length?"No reports match these filters.":"No reports published yet."}</td></tr>:matching.map((r,i)=><tr role="row" key={r.href+"-"+i}>
      <th scope="row" role="rowheader">{r.title}</th><td role="cell"><span className="cg-site-report-date-label">Document date: </span>{r.date}</td>
      <td role="cell"><CmsNgoDocModalButton title={r.title} meta={`Published: ${r.date}`} src={r.href} buttonLabel="View document" className="cg-site-ngo-doc-btn"/></td>
     </tr>)}</tbody>
    </table>
   </div>
  </section>
  <aside className="cg-site-ngo-transparency-banner">
   <span className="cg-site-ngo-transparency-icon"><ShieldCheck size={20} aria-hidden="true"/></span>
   <div>
    <h3>{kind==="annual"?"Our Commitment to Transparency":"Our Commitment to Accountability"}</h3>
    <p>{kind==="annual"?"We believe in complete transparency. Approved annual reports are openly available for our donors, partners, and well-wishers.":"We maintain high standards of financial transparency so every contribution creates a measurable impact."}</p>
   </div>
  </aside>
 </div>;
}
