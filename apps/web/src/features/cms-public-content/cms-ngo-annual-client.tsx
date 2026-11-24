"use client";
import {useMemo,useState} from "react";

export type ApprovedAnnualReport={title:string;date:string;href:string};
export function CmsNgoAnnualReports({reports,kind="annual"}:{reports:ApprovedAnnualReport[];kind?:"annual"|"financial"}){
 const [year,setYear]=useState("ALL");
 const years=useMemo(()=>Array.from(new Set(reports.map(r=>r.date.slice(0,4))))
  .filter(v=>/^\d{4}$/.test(v)).sort((a,b)=>b.localeCompare(a)),[reports]);
 const matching=reports.filter(r=>year==="ALL"||r.date.startsWith(year+"-"));
 return <section aria-label={"Foundation-published "+kind+" reports"}>
  <div className="cg-site-gallery-filters">
   <label>Financial year
    <select value={year} onChange={e=>setYear(e.target.value)}>
     <option value="ALL">All years</option>
     {years.map(v=><option key={v} value={v}>{v}</option>)}
    </select>
   </label>
   <button className="cg-site-filter-reset" type="button" disabled={year==="ALL"}
    onClick={()=>setYear("ALL")}>Reset Filters</button>
  </div>
  <p className="cg-site-provenance" role="status" aria-live="polite">
   {matching.length} approved {matching.length===1?"report":"reports"} match
  </p>
  {matching.length===0?<p className="cg-site-gallery-empty">
   No approved {kind} report is available for the selected year.</p>:
   <div className="cg-site-table-wrap"><table className="cg-site-evidence-table">
    <caption>Current Foundation-published {kind} documents</caption>
    <thead><tr><th scope="col">Report</th><th scope="col">Document date</th>
     <th scope="col">Approved file</th></tr></thead>
    <tbody>{matching.map((r,i)=><tr key={r.href+"-"+i}>
     <th scope="row">{r.title}</th><td>{r.date}</td>
     <td><a href={r.href} download>View document</a></td>
    </tr>)}</tbody>
   </table></div>}
 </section>;
}
