"use client";
import {useEffect,useState} from "react";
type Stats={total:number;pending:number;approved:number;rejected:number;
 paid:number;posted:number;totalMinor:string;pendingMinor:string;
 approvedMinor:string;paidMinor:string};
type Month={month:string;count:number;totalMinor:string};
type Category={category:string;count:number;totalMinor:string};
type Dashboard={cards:Stats;monthly:Month[];categories:Category[];
 updatedFrom:string};
const format=(value:string)=>{
 try{const n=BigInt(value),v=n<0n?-n:n;
  return(n<0n?"−":"")+"₹"+(v/100n).toLocaleString("en-IN")+
   "."+(v%100n).toString().padStart(2,"0");
 }catch{return "Amount unavailable";}
};
const percent=(part:number,total:number)=>total>0?Math.round(part*100/total):0;
export function FinanceVoucherDashboard({onRefresh}:{onRefresh?:()=>void}){
 const [data,setData]=useState<Dashboard|null>(null);
 const [loading,setLoading]=useState(true);
 const [issue,setIssue]=useState("");
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let live=true;
  void(async()=>{
   if(live)setLoading(true);
   try{
    const response=await fetch("/api/finance/vouchers/dashboard",{cache:"no-store"});
    if(!response.ok)throw Error(response.status===403?
     "Your current role cannot view voucher totals.":
     "Original voucher totals are unavailable. Refresh the dashboard.");
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object"||!("cards" in raw)||!("monthly" in raw)||
      !("categories" in raw)||!Array.isArray(raw.monthly)||!Array.isArray(raw.categories)||
      !raw.cards||typeof raw.cards!=="object"||!("total" in raw.cards)||
      typeof raw.cards.total!=="number")
     throw Error("Voucher totals could not be verified from current records.");
    if(live){setData(raw as Dashboard);setIssue("");}
   }catch(e){if(live){setData(null);setIssue(
    e instanceof Error?e.message:"The original Finance dashboard is unavailable.");}}
   finally{if(live)setLoading(false);}
  })();
  return()=>{live=false;};
 },[revision]);
 const totals=data?.cards;
 const months=data?.monthly??[];
 const categories=data?.categories??[];
 const newest=months.slice(-12);
 const peak=Math.max(1,...newest.map(m=>m.count));
 const sum=categories.reduce((n,c)=>n+Number(BigInt(c.totalMinor)),0);
 const slices=categories.map((c,index)=>({
  ...c,ratio:sum>0?100*Number(BigInt(c.totalMinor))/sum:0,index
 }));
 let run=0;
 const stops=slices.map(s=>{
  const start=run;run+=s.ratio;
  return `var(--cg-chart-${s.index%6}, #1E53DC) ${start.toFixed(2)}% ${run.toFixed(2)}%`;
 }).join(",");
 const tiles: {name:string;value:string;description:string}[]=totals?[
  {name:"Total vouchers",value:String(totals.total),description:"All original voucher records"},
  {name:"Awaiting approval",value:String(totals.pending),description:"Actual submitted cases"},
  {name:"Approved / in progress",value:String(totals.approved),description:"Reviewer-accepted sources"},
  {name:"Rejected",value:String(totals.rejected),description:"Final rejection decisions"},
  {name:"Payment proof recorded",value:String(totals.paid),description:"Separate money verification"},
  {name:"Total voucher amount",value:format(totals.totalMinor),description:"Includes unposted draft values"}
 ]:[];
 return <section className="cg-fin-voucher-dashboard" aria-label="Original Finance voucher dashboard">
  <div className="cg-fin-dashboard-title">
   <div><h3>Voucher Management Dashboard</h3>
    <p>Real current-source voucher counts, review activity and amounts</p></div>
   <button type="button" disabled={loading}
    onClick={()=>{onRefresh?.();setRevision(n=>n+1);}}>Refresh dashboard</button>
  </div>
  {loading&&<p role="status">Loading verified Finance voucher totals…</p>}
  {issue&&<p role="alert">{issue}</p>}
  {totals&&<>
   <div className="cg-fin-voucher-tiles">
    {tiles.map((t,i)=><div className="cg-fin-voucher-tile" key={t.name}>
     <span className="cg-fin-tile-symbol" aria-hidden="true">
      {["▣","◷","✓","×","₹","▤"][i]}</span>
     <div><p className="cg-fin-tile-label">{t.name}</p>
      <strong>{t.value}</strong><small>{t.description}</small></div>
    </div>)}
   </div>
   <div className="cg-fin-voucher-charts">
    <article className="cg-fin-voucher-chart">
     <h4>Voucher Status Overview</h4>
     <div className="cg-fin-donut-detail">
      <div className="cg-fin-donut" style={{background:
       `conic-gradient(#ECA62C 0% ${percent(totals.pending,totals.total)}%,
        #18A775 ${percent(totals.pending,totals.total)}% ${percent(totals.pending+totals.approved,totals.total)}%,
        #1E53DC ${percent(totals.pending+totals.approved,totals.total)}% 100%)`}}>
       <div><strong>{totals.total}</strong><span>vouchers</span></div>
      </div>
      <div className="cg-fin-chart-legend">
       <p>Awaiting review <strong>{totals.pending}</strong></p>
       <p>Approved / in progress <strong>{totals.approved}</strong></p>
       <p>Rejected <strong>{totals.rejected}</strong></p>
       <p>Paid verified <strong>{totals.paid}</strong></p>
       <p>Posted <strong>{totals.posted}</strong></p>
      </div>
     </div>
    </article>
    <article className="cg-fin-voucher-chart">
     <h4>Monthly Voucher Trend</h4>
     {newest.length?<div className="cg-fin-month-bars" role="img"
      aria-label="Monthly original voucher counts">
      {newest.map(m=><div className="cg-fin-month" key={m.month}>
       <span title={m.month+": "+m.count+" voucher(s)"} style={{height:
        Math.max(4,100*m.count/peak)+"%"}}/>
       <small>{m.month.slice(5)}</small>
      </div>)}</div>:<p className="cg-fin-help">No vouchers in the last 12 months.</p>}
     <p className="cg-fin-help">Counts by original voucher posting date, not paid totals</p>
    </article>
    <article className="cg-fin-voucher-chart">
     <h4>Expense Category Wise</h4>
     {sum>0?<><div className="cg-fin-category-pie"
      style={{background:`conic-gradient(${stops})`}} role="img"
      aria-label="Expense categories from recorded original vouchers"/>
      <div className="cg-fin-chart-legend">
       {slices.map(v=><p key={v.category}>{v.category}
        <strong>{format(v.totalMinor)}</strong></p>)}
      </div></>:<p className="cg-fin-help">No expense categories with voucher amounts.</p>}
    </article>
   </div>
  </>}
 </section>;
}
