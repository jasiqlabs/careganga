"use client";
export type MonthlyTrend={
 type:"MONTHLY_FINANCE";windowLabel:string;state:"AVAILABLE"|"EMPTY"|"FAILED";
 points:{month:string;incomeMinor:string;expenseMinor:string}[]
};
type Metric={key:string;label:string;unit:string;value:string};
const format=(v:string)=>{
 try{const n=BigInt(v),abs=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+"."+
   (abs%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}
};
const monthName=(month:string)=>{
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return "Recorded month";
 return new Date(month+"-01T00:00:00Z")
  .toLocaleDateString("en-IN",{month:"short",year:"numeric",timeZone:"UTC"});
};
const safeBig=(value:string)=>{
 try{return BigInt(value)}catch{return 0n;}
};
const width=(value:bigint,max:bigint)=>{
 const abs=value<0n?-value:value;
 return max>0n?Number(abs*100n/max):0;
};
/** C47 original finance chart: source-authoritative values, plus a readable
 * table for keyboard/screen-reader access. No sample months or fake zeros.
 */
export function MisFinanceTrend({trend}:{trend:MonthlyTrend}){
 if(trend.state==="FAILED")return <p role="status">
  Monthly finance trend is temporarily unavailable. Summary figures remain separate.</p>;
 if(trend.state==="EMPTY"||trend.points.length===0)return <p role="status">
  No posted income or expense entries for the last six months in this permitted scope.</p>;
 const values=trend.points.flatMap(p=>[safeBig(p.incomeMinor),safeBig(p.expenseMinor)]);
 const maxAbs=values.reduce((a,b)=>{const v=b<0n?-b:b;return v>a?v:a;},0n);
 const minimum=values.reduce((a,b)=>a<b?a:b,values[0]??0n);
 const maximum=values.reduce((a,b)=>a>b?a:b,values[0]??0n);
 const range=maximum===minimum?1n:maximum-minimum;
 const coords=(field:"incomeMinor"|"expenseMinor")=>trend.points.map((point,index)=>{
  const x=24+(trend.points.length===1?230:index*460/(trend.points.length-1));
  const y=150-Number((safeBig(point[field])-minimum)*115n/range);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
 }).join(" ");
 return <section aria-label="Posted finance trend" style={{marginTop:16}}>
  <h4 style={{fontSize:".95rem",margin:"0 0 .4rem"}}>{trend.windowLabel} · Posted income and expenses</h4>
  <p style={{fontSize:".78rem",color:"var(--cg-muted)"}}>
   Net journal values by posting month. Months without qualifying entries are not estimated.</p>
  <div style={{border:"1px solid var(--cg-border)",borderRadius:12,padding:14,
   background:"var(--cg-surface)",maxWidth:650}}>
   <svg viewBox="0 0 510 175" width="100%" role="img"
    aria-label="Line chart of original posted monthly income and expenses. Exact numbers follow in the table.">
    <title>Posted income and expense monthly trends</title>
    <line x1="15" y1="151" x2="503" y2="151" stroke="var(--cg-border)"/>
    <polyline points={coords("incomeMinor")} fill="none" stroke="var(--cg-accent)" strokeWidth="3"
     strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points={coords("expenseMinor")} fill="none" stroke="#64748B" strokeWidth="3"
     strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 5"/>
   </svg>
   <p style={{fontSize:".78rem",margin:"0 0 12px"}}>
    <span style={{color:"var(--cg-accent)"}}>━━</span> Posted income&nbsp;&nbsp;
    <span style={{color:"#64748B"}}>┄┄</span> Posted expenses
   </p>
   {trend.points.map(p=><div key={p.month} style={{display:"grid",
    gridTemplateColumns:"5rem minmax(0,1fr)",alignItems:"center",gap:10,marginBottom:10}}>
    <span style={{fontSize:".8rem",color:"var(--cg-muted)"}}>{monthName(p.month)}</span>
    <div style={{display:"grid",gap:3}}>
     <div style={{background:"var(--cg-canvas)",height:9,borderRadius:6}}>
      <div style={{width:width(safeBig(p.incomeMinor),maxAbs)+"%",
       background:"var(--cg-accent)",height:"100%",borderRadius:6}}/></div>
     <div style={{background:"var(--cg-canvas)",height:9,borderRadius:6}}>
      <div style={{width:width(safeBig(p.expenseMinor),maxAbs)+"%",
       background:"#64748B",height:"100%",borderRadius:6}}/></div>
    </div>
   </div>)}
   <details><summary style={{cursor:"pointer",fontSize:".85rem"}}>View exact monthly figures</summary>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",marginTop:10}}>
     <thead><tr><th scope="col">Month</th><th scope="col">Posted income</th>
      <th scope="col">Posted expense</th></tr></thead>
     <tbody>{trend.points.map(p=><tr key={p.month}><th scope="row">{monthName(p.month)}</th>
      <td>{format(p.incomeMinor)}</td><td>{format(p.expenseMinor)}</td></tr>)}</tbody>
    </table></div>
   </details>
  </div>
 </section>;
}
export function MisAppointmentDistribution({metrics}:{metrics:Metric[]}){
 const get=(key:string)=>safeBig(metrics.find(m=>m.key===key)?.value??"0");
 const total=get("bookings");
 if(total===0n)return <p role="status">No appointments recorded for this permitted Foundation scope.</p>;
 const completed=get("completed"),waiting=get("waiting"),cancelled=get("cancelled");
 if([completed,waiting,cancelled].some(x=>x<0n)||completed+waiting+cancelled>total)
  return <p role="status">Appointment category distribution cannot be verified.</p>;
 const other=total-completed-waiting-cancelled;
 const groups=[
  {label:"Completed",value:completed,color:"var(--cg-accent)"},
  {label:"Waiting or in progress",value:waiting,color:"#64748B"},
  {label:"Cancelled",value:cancelled,color:"#EAB308"},
  {label:"Other statuses",value:other,color:"var(--cg-border)"}
 ];
 let cursor=0;
 const stops=groups.map(group=>{
  const start=cursor;cursor+=Number(group.value*100n/total);
  return `${group.color} ${start}% ${cursor}%`;
 }).join(", ");
 return <section aria-label="Appointment status distribution" style={{marginTop:16}}>
  <h4 style={{fontSize:".95rem",margin:"0 0 .5rem"}}>Appointment status distribution</h4>
  <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
   <div role="img" aria-label="Donut chart; exact category counts are listed alongside"
    style={{width:115,height:115,borderRadius:"50%",position:"relative",
     background:`conic-gradient(${stops})`}}>
    <div style={{position:"absolute",inset:22,background:"var(--cg-surface)",borderRadius:"50%",
     display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
     {total.toString()}</div>
   </div>
   <dl style={{display:"grid",gridTemplateColumns:"auto auto",gap:"5px 15px",margin:0}}>
    {groups.map(g=><div key={g.label} style={{display:"contents"}}>
     <dt style={{fontSize:".83rem"}}>{g.label}</dt>
     <dd style={{margin:0,textAlign:"right",fontWeight:700}}>{g.value.toString()}</dd>
    </div>)}
   </dl>
  </div>
 </section>;
}

/** Owner CG15 groups are already small-cell-suppressed on the server.
 * This renders exactly those grouped counts, with no per-patient queries.
 */
export function MisAppointmentGroupBars({rows}:{rows:{statusLabel:string;count:string}[]}){
 const safe=rows.map(item=>({label:item.statusLabel,value:safeBig(item.count)}));
 const maximum=safe.reduce((n,item)=>item.value>n?item.value:n,0n);
 return <section role="group" aria-label="Authorized appointment status groups"
  style={{display:"grid",gap:10,marginBlock:14}}>
  {safe.map((group,i)=><div key={i} style={{padding:10,
   border:"1px solid var(--cg-border)",borderRadius:8}}>
   <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
    <strong>{group.label}</strong>
    <span>{group.value.toString()} appointments</span>
   </div>
   <div aria-hidden="true" style={{height:9,borderRadius:6,
    background:"var(--cg-border)",marginTop:6,overflow:"hidden"}}>
    <div style={{height:"100%",
     width:width(group.value,maximum)+"%",background:"var(--cg-accent)"}}/>
   </div>
  </div>)}
 </section>;
}
