"use client";
type Group={groupLabel:string;debitMinor:string;creditMinor:string};
const money=(value:string)=>{
 try{const n=BigInt(value),a=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+"."+
   (a%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}
};
export function MisGroupedFinanceChart({rows}:{rows:Group[]}){
 const vals=rows.flatMap(row=>{
  try{return [BigInt(row.debitMinor),BigInt(row.creditMinor)]}
  catch{return [0n,0n]}
 });
 const maximum=vals.reduce((a,b)=>a>(b<0n?-b:b)?a:(b<0n?-b:b),0n);
 const percent=(raw:string)=>{
  try{const n=BigInt(raw),v=n<0n?-n:n;
   return maximum?Math.max(v>0n?2:0,Number(v*100n/maximum)):0;
  }catch{return 0;}
 };
 return <div role="group" aria-label="Grouped posted debit and credit chart"
  style={{display:"grid",gap:12,marginBlock:"1rem"}}>
  {rows.map((item,i)=><div key={i} style={{border:"1px solid var(--cg-border)",
   borderRadius:8,padding:12}}>
   <strong style={{display:"block",marginBottom:8}}>{item.groupLabel}</strong>
   {(["debitMinor","creditMinor"] as const).map(key=><div key={key}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:".8rem"}}>
     <span>{key==="debitMinor"?"Posted debit":"Posted credit"}</span>
     <span>{money(item[key])}</span>
    </div>
    <div aria-hidden="true" style={{height:10,background:"var(--cg-border)",borderRadius:8,overflow:"hidden"}}>
     <div style={{height:"100%",width:percent(item[key])+"%",
      background:key==="debitMinor"?"#0D6EBC":"#16A085"}}/>
    </div>
   </div>)}
  </div>)}
 </div>;
}
