import {StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
type Group={groupLabel:string;debitMinor:string;creditMinor:string};
const money=(value:string)=>{
 try{const n=BigInt(value),a=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+"."+
   (a%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}
};
/** Native accessible chart alternative to the same CG09 bounded original
 * grouping, never estimates amounts from an incomplete paginated ledger.
 */
export function NativeMisGroupedFinanceChart({rows}:{rows:Group[]}){
 const vals=rows.flatMap(r=>{
  try{return [BigInt(r.debitMinor),BigInt(r.creditMinor)]}
  catch{return [0n,0n]}
 });
 const maximum=vals.reduce((a,b)=>a>(b<0n?-b:b)?a:(b<0n?-b:b),0n);
 const width=(raw:string):`${number}%`=>{
  try{const n=BigInt(raw),v=n<0n?-n:n;
   const amount=maximum?Math.max(v>0n?2:0,Number(v*100n/maximum)):0;
   return `${amount}%`;
  }catch{return "0%";}
 };
 return <View style={s.root} accessibilityLabel="Grouped posted debit and credit chart">
  {rows.map((row,i)=><View key={i} style={s.card}>
   <Text style={s.title}>{row.groupLabel}</Text>
   {(["debitMinor","creditMinor"] as const).map(key=><View key={key} style={s.series}>
    <Text style={s.label}>{key==="debitMinor"?"Debit":"Credit"}: {money(row[key])}</Text>
    <View style={s.track} accessibilityElementsHidden>
     <View style={[s.bar,{width:width(row[key]),
      backgroundColor:key==="debitMinor"?t.primary:"#16A085"}]}/>
    </View>
   </View>)}
  </View>)}
 </View>;
}
const s=StyleSheet.create({
 root:{gap:10},card:{padding:10,borderWidth:1,borderColor:t.border,borderRadius:9,gap:8},
 title:{fontWeight:"800",fontSize:14,color:t.text},
 label:{fontSize:12,color:t.mutedText},
 series:{gap:4},track:{height:10,backgroundColor:t.border,borderRadius:6,
  overflow:"hidden"},bar:{height:10,borderRadius:6}
});
