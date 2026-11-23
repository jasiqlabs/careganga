import React,{useEffect,useState} from "react";
import {ActivityIndicator,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Project={title:string;category:string;summary:string|null;description:string|null;
 location:string|null;owner:string;manager:string|null;branch:string|null;status:string};
type Result={kind:"PROJECT"|"GENERAL_FOUNDATION";project:Project|null;note:string;
 teamStatus?:"SOURCE"|"RESTRICTED";assigned?:{name:string;kind:string}[]};
export function NativeCsrFundingProjectContext({token,proposalRef,mode,onExpired}:{
 token:string;proposalRef:string;mode:"PROJECT"|"TEAM";onExpired:()=>void}){
 const [value,setValue]=useState<Result|null>(null),[loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  let live=true;setLoading(true);setError("");setValue(null);
  void identityRequest("/api/v1/csr/funding-proposals/"+proposalRef+"/project-context",{
   method:"GET",headers:{Authorization:"Bearer "+token}})
   .then(async r=>{
    if(r.status===401){onExpired();throw Error("Sign in again to view CG05 project.");}
    if(!r.ok)throw Error(r.status===403?
     "Original CG05 project or task permission is restricted.":
     "Current CG05 project context is unavailable.");
    return await r.json() as Result;
   }).then(v=>{if(live)setValue(v);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Project data unavailable.");})
   .finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[token,proposalRef,mode,onExpired]);
 return <View style={styles.panel}>
  <Text style={styles.title}>{mode==="PROJECT"?
   "Original CG05 Project Details":"4. Team & Members — original CG05"}</Text>
  {loading?<ActivityIndicator/>:value?.project?mode==="PROJECT"?<>
   <Text style={styles.heading}>{value.project.title}</Text>
   <Text style={styles.text}>Category: {value.project.category} · {value.project.status}</Text>
   <Text style={styles.text}>Location: {value.project.location||"Not recorded"}</Text>
   <Text style={styles.text}>Branch: {value.project.branch??"Foundation"}</Text>
   <Text style={styles.text}>Objectives: {value.project.summary||value.project.description||"Not recorded"}</Text>
  </>:<>
   <Text style={styles.text}>Project head: {value.project.owner}</Text>
   <Text style={styles.text}>Branch manager: {value.project.manager??"Not recorded"}</Text>
   {value.teamStatus==="RESTRICTED"?
    <Text style={styles.text}>Current project-task roster restricted.</Text>:
    value.assigned?.length?value.assigned.map((m,i)=>
     <Text key={m.name+":"+m.kind+":"+i} style={styles.text}>
      {m.name} — recorded {m.kind.toLowerCase()} task assignment</Text>):
     <Text style={styles.text}>No current recorded task assignments.</Text>}
   <Text style={styles.text}>Roster updates remain in CG05 Projects & Tasks.</Text>
  </>:value?<Text style={styles.text}>{value.note}</Text>:null}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:"#fff",borderRadius:10,borderWidth:1,
  borderColor:"#CBD5E1",padding:12,gap:8},
 title:{fontSize:15,fontWeight:"700",color:"#0F172A"},
 heading:{fontSize:15,fontWeight:"600",color:"#0F172A"},
 text:{fontSize:13,color:"#475569"},error:{fontSize:13,color:"#B91C1C"}
});
