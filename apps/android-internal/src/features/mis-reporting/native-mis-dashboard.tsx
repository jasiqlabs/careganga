import {useCallback,useEffect,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
import {NativeFinanceOptions} from "../finance-accounting/finance-native-source-kit";

type Metric={key:string;label:string;unit:string;value:string};
type Source={sourceKey:string;sourceLabel:string;state:string;metrics:Metric[];
 explanation?:string};
type Overview={state:string;readAt:string;sources:Source[];
 periodLabel?:string;scopeLabel?:string;message?:string};
type Option={ref:string;name:string};
type Choices={state:string;years:Option[];branches:Option[];allBranches:boolean};
const currency=(v:string)=>{
 try{const n=BigInt(v),a=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(a/100n).toLocaleString("en-IN")+"."+
   (a%100n).toString().padStart(2,"0");
 }catch{return "Unavailable";}
};
/** Actual native CG-20 US-001: no WebView and no public clinical/finance route. */
export function NativeMisDashboard({token,onExpired,onOpenFinance}:{
 token:string;onExpired:()=>void;onOpenFinance?:()=>void}){
 const [overview,setOverview]=useState<Overview|null>(null);
 const [busy,setBusy]=useState(true);
 const [problem,setProblem]=useState("");
 const [ready,setReady]=useState(false),[allBranches,setAllBranches]=useState(false);
 const [years,setYears]=useState<Option[]>([]),[branches,setBranches]=useState<Option[]>([]);
 const [year,setYear]=useState(""),[branch,setBranch]=useState("");
 useEffect(()=>{let live=true;void(async()=>{
  try{
   const response=await identityRequest("/api/v1/mis/options",{
    headers:{Authorization:"Bearer "+token}});
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error("OPTIONS");
   const opts=await response.json() as Choices;
   if(!Array.isArray(opts.years)||!Array.isArray(opts.branches))throw Error("OPTIONS");
   if(live){setYears(opts.years);setBranches(opts.branches);
    setAllBranches(opts.allBranches===true);
    setBranch(opts.allBranches===true?"":opts.branches[0]?.ref??"");setReady(true);}
  }catch{if(live){setProblem("Reporting filters are unavailable. Please retry.");setReady(false);}}
 })();return()=>{live=false;};},[token,onExpired]);
 const reload=useCallback(async()=>{
  setBusy(true);setProblem("");setOverview(null);
  try{
   const query=new URLSearchParams();
   if(year)query.set("yearRef",year);
   if(branch)query.set("branchRef",branch);
   const response=await identityRequest("/api/v1/mis/dashboard?"+query.toString(),{
    headers:{Authorization:"Bearer "+token}});
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error(response.status===403?
    "Your role cannot view these reports.":"Dashboard data could not be verified.");
   const data=await response.json() as Overview;
   if(!data||!Array.isArray(data.sources)||typeof data.state!=="string")
    throw Error("Reporting data could not be verified.");
   setOverview(data);
  }catch(e){setProblem(e instanceof Error&&e.message==="Your role cannot view these reports."?
   e.message:"Unable to load current reporting data. Refresh to retry.");}
  finally{setBusy(false);}
 },[token,onExpired,year,branch]);
 useEffect(()=>{if(ready)void reload();},[ready,reload]);
 return <View style={styles.container}>
  <View style={styles.header}>
   <View style={{flex:1}}>
    <Text style={styles.title}>Foundation MIS · Verified Sources</Text>
    <Text style={styles.helper}>Original business data · current authorized scope</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Refresh MIS metrics"
    disabled={busy} style={styles.refresh} onPress={()=>void reload()}>
    <Text style={styles.link}>{busy?"Loading…":"Refresh"}</Text>
   </Pressable>
  </View>
  {ready&&<View style={{gap:6}}>
   <NativeFinanceOptions label="Financial year" value={year}
    options={[{ref:"",label:"All permitted years"},...years.map(y=>({ref:y.ref,label:y.name}))]}
    onChange={setYear}/>
   {!!branches.length&&<NativeFinanceOptions label="Branch" value={branch}
    options={[...(allBranches?[{ref:"",label:"All permitted branches"}]:[]),
      ...branches.map(b=>({ref:b.ref,label:b.name}))]}
    onChange={setBranch}/>}
  </View>}
  {busy&&ready&&<Text accessibilityRole="text" style={styles.helper}>Checking current reports…</Text>}
  {!!problem&&<Text accessibilityRole="alert" style={styles.error}>{problem}</Text>}
  {overview&&<>
   <Text style={styles.helper}>{overview.periodLabel} · {overview.scopeLabel}</Text>
   <Text style={styles.helper}>Retrieved {new Date(overview.readAt).toLocaleString("en-IN")}</Text>
   {!!overview.message&&<Text style={styles.helper}>{overview.message}</Text>}
   {overview.sources.map(source=><View key={source.sourceKey} style={styles.source}>
    <Text style={styles.title}>{source.sourceLabel}</Text>
    {source.state==="AVAILABLE"?<>
     <View style={styles.metrics}>
      {source.metrics.map(m=><View key={m.key} style={styles.card}>
       <Text style={styles.helper}>{m.label}</Text>
       <Text accessibilityLabel={m.label+": "+(m.unit==="INR_MINOR"?currency(m.value):m.value)}
        style={styles.value}>{m.unit==="INR_MINOR"?currency(m.value):m.value}</Text>
      </View>)}
     </View>
     {!!source.explanation&&<Text style={styles.helper}>{source.explanation}</Text>}
     {!!onOpenFinance&&source.sourceKey==="CG09_POSTED_FINANCE"&&
      <Pressable accessibilityRole="button" style={styles.refresh} onPress={onOpenFinance}>
       <Text style={styles.link}>Open detailed finance reports</Text>
      </Pressable>}
    </>:<Text style={styles.helper}>Original source unavailable; no estimated values.</Text>}
   </View>)}
   {overview.sources.length===0&&
    <Text style={styles.helper}>No reporting sources are permitted for this role.</Text>}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 container:{marginHorizontal:18,marginTop:18,gap:9},
 header:{flexDirection:"row",alignItems:"center",gap:10},
 title:{color:"#0F172A",fontSize:16,fontWeight:"800"},
 helper:{color:"#64748B",fontSize:12,lineHeight:18},
 error:{color:"#B91C1C",fontSize:13,padding:10,backgroundColor:"#FEF2F2",borderRadius:10},
 refresh:{borderWidth:1,borderColor:"#BFDBFE",backgroundColor:"#EFF6FF",
  paddingHorizontal:12,paddingVertical:9,borderRadius:10,minHeight:42,justifyContent:"center"},
 link:{color:"#1D4ED8",fontSize:12,fontWeight:"700"},
 source:{backgroundColor:"#FFFFFF",padding:14,gap:9,borderRadius:14,
  borderColor:"#E2E8F0",borderWidth:1},
 metrics:{flexDirection:"row",flexWrap:"wrap",gap:8},
 card:{borderWidth:1,borderColor:"#E2E8F0",borderRadius:10,
  padding:12,minWidth:"45%",flexGrow:1,gap:5,backgroundColor:"#FFFFFF"},
 value:{fontSize:16,fontWeight:"800",color:"#0F172A"}
});
