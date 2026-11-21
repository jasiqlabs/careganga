import {StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

export type MonthlyTrend={
 type:"MONTHLY_FINANCE";windowLabel:string;state:"AVAILABLE"|"EMPTY"|"FAILED";
 points:{month:string;incomeMinor:string;expenseMinor:string}[]
};
type Metric={key:string;label:string;unit:string;value:string};
const asBig=(v:string)=>{try{return BigInt(v)}catch{return 0n}};
const money=(v:string)=>{
 try{const n=BigInt(v),abs=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+
   "."+(abs%100n).toString().padStart(2,"0");
 }catch{return "Not confirmed";}
};
const monthLabel=(v:string)=>{
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(v))return "Posted month";
 return new Date(v+"-01T00:00:00Z").toLocaleDateString("en-IN",{
  month:"short",year:"numeric",timeZone:"UTC"});
};
const percent=(v:bigint,max:bigint)=>{
 const abs=v<0n?-v:v;
 return max>0n?Number(abs*100n/max):0;
};
/** CG-20 US-001 actual native graph and full accessible numeric alternative.
 * No WebView, SVG dependency, fabricated graph points or personal data.
 */
export function NativeMisFinanceTrend({trend}:{trend:MonthlyTrend}){
 if(trend.state==="FAILED")return <Text style={s.note}>
  Monthly finance trend cannot currently be verified.</Text>;
 if(trend.state==="EMPTY"||!trend.points.length)return <Text style={s.note}>
  No posted income or expense entries in the last six months for this scope.</Text>;
 const maximum=trend.points.reduce((max,p)=>{
  const a=asBig(p.incomeMinor),b=asBig(p.expenseMinor);
  return [a,b].reduce((m,v)=>{const abs=v<0n?-v:v;return abs>m?abs:m},max);
 },0n);
 return <View style={s.panel}>
  <Text accessibilityRole="header" style={s.heading}>
   {trend.windowLabel} · Posted finance trends</Text>
  <Text style={s.note}>Net posted income (blue) and expense (grey) by month.
   Months with no qualifying entries are not estimated.</Text>
  {trend.points.map(point=><View key={point.month} style={s.group}>
   <Text style={s.month}>{monthLabel(point.month)}</Text>
   <Text accessibilityLabel={"Posted income "+money(point.incomeMinor)} style={s.note}>
    Posted income: {money(point.incomeMinor)}</Text>
   <View style={s.track}><View style={[s.bar,{width:`${percent(asBig(point.incomeMinor),maximum)}%` as const,
    backgroundColor:t.primary}]}/></View>
   <Text accessibilityLabel={"Posted expenses "+money(point.expenseMinor)} style={s.note}>
    Posted expenses: {money(point.expenseMinor)}</Text>
   <View style={s.track}><View style={[s.bar,{width:`${percent(asBig(point.expenseMinor),maximum)}%` as const,
    backgroundColor:"#64748B"}]}/></View>
  </View>)}
 </View>;
}
export function NativeMisAppointmentDistribution({metrics}:{metrics:Metric[]}){
 const get=(key:string)=>asBig(metrics.find(x=>x.key===key)?.value??"0");
 const total=get("bookings");
 if(total===0n)return <Text style={s.note}>No appointments recorded in this scope.</Text>;
 const completed=get("completed"),waiting=get("waiting"),cancelled=get("cancelled");
 if(completed<0n||waiting<0n||cancelled<0n||
  completed+waiting+cancelled>total)return <Text style={s.note}>
  Appointment category distribution is unavailable.</Text>;
 const other=total-completed-waiting-cancelled;
 const groups=[
  {label:"Completed",count:completed,color:t.primary},
  {label:"Waiting or in progress",count:waiting,color:"#64748B"},
  {label:"Cancelled",count:cancelled,color:"#EAB308"},
  {label:"Other statuses",count:other,color:"#CBD5E1"}
 ];
 return <View style={s.panel}>
  <Text accessibilityRole="header" style={s.heading}>Appointment status distribution</Text>
  <View style={s.track}>
   {groups.map(g=><View key={g.label} style={{
    height:"100%",width:`${percent(g.count,total)}%` as const,backgroundColor:g.color}}/>)}
  </View>
  {groups.map(g=><View key={g.label} style={s.countRow}>
   <Text style={s.note}>{g.label}</Text>
   <Text style={s.number}>{g.count.toString()}</Text>
  </View>)}
  <Text style={s.note}>Foundation-wide status counts; no patient-identifying details.</Text>
 </View>;
}
const s=StyleSheet.create({
 panel:{gap:9,marginTop:12,padding:12,backgroundColor:t.surface,
  borderRadius:12,borderColor:t.border,borderWidth:1},
 heading:{fontWeight:"800",fontSize:14,color:t.text},
 note:{fontSize:12,color:t.mutedText,lineHeight:18},
 group:{gap:5,paddingVertical:6},
 month:{color:t.text,fontSize:13,fontWeight:"700"},
 track:{height:12,borderRadius:8,backgroundColor:"#EEF2F7",
  flexDirection:"row",overflow:"hidden"},
 bar:{height:"100%",borderRadius:8},
 countRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
  gap:10,paddingVertical:4},
 number:{fontSize:13,color:t.text,fontWeight:"700"}
});

/** Native grouped CG15 appointments, already privacy-suppressed server-side. */
export function NativeMisAppointmentGroupBars({rows}:{
 rows:{statusLabel:string;count:string}[]
}){
 const groups=rows.map(row=>({label:row.statusLabel,value:asBig(row.count)}));
 const maximum=groups.reduce((n,row)=>row.value>n?row.value:n,0n);
 return <View style={s.panel} accessibilityLabel="Verified appointment status group chart">
  <Text accessibilityRole="header" style={s.heading}>Appointment status groups</Text>
  {groups.map((row,i)=><View key={i} style={s.group}>
   <Text style={s.note}>{row.label}: {row.value.toString()} appointments</Text>
   <View style={s.track} accessibilityElementsHidden>
    <View style={[s.bar,{backgroundColor:t.primary,
     width:`${percent(row.value,maximum)}%` as const}]}/>
   </View>
  </View>)}
 </View>;
}
