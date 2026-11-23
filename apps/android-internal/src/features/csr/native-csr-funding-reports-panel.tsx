import React,{useEffect,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Item={ref:string;partnerName:string|null;projectName:string|null;branchName:string|null;
 purpose:string;status:string;financeStatus:string;requestedMinor:string;
 committedMinor:string;receivedMinor:string;allocatedMinor:string;utilizedMinor:string;
 availableMinor:string|null;updatedAt:string};
type Report={items:Item[];hasMore:boolean;nextCursor:string|null;notice:string};
type Choices={branches:{value:string;label:string}[]};
const money=(value:string|null)=>{
 if(value===null)return "Pending finance revalidation";
 try{const n=BigInt(value);return "₹"+(n/100n).toLocaleString("en-IN")+
 "."+(n%100n).toString().padStart(2,"0");}
 catch{return "Finance unavailable";}
};
export function NativeCsrFundingReportsPanel({token,onExpired}:{
 token:string;onExpired:()=>void}){
 const [page,setPage]=useState<Report|null>(null),[choices,setChoices]=useState<Choices|null>(null);
 const [branch,setBranch]=useState(""),[status,setStatus]=useState("ALL"),
  [query,setQuery]=useState(""),[cursor,setCursor]=useState("");
 const [back,setBack]=useState<string[]>([]),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const reset=()=>{setCursor("");setBack([]);};
 useEffect(()=>{
  let alive=true;
  void identityRequest("/api/v1/csr/funding-proposals/options",{
   headers:{Authorization:"Bearer "+token}})
   .then(async r=>r.ok?await r.json() as Choices:null)
   .then(v=>{if(alive)setChoices(v);})
   .catch(()=>{if(alive)setChoices(null);});
  return()=>{alive=false;};
 },[token,epoch]);
 useEffect(()=>{
  let alive=true;setLoading(true);setPage(null);setError("");
  const params=new URLSearchParams();
  if(branch)params.set("branchRef",branch);
  if(status!=="ALL")params.set("status",status);
  if(query.trim())params.set("q",query.trim().slice(0,100));
  if(cursor)params.set("cursor",cursor);
  void identityRequest("/api/v1/csr/funding-reports?"+params.toString(),{
   headers:{Authorization:"Bearer "+token}})
   .then(async r=>{
    if(r.status===401){onExpired();throw Error("Sign in to view the CSR report.");}
    if(!r.ok)throw Error(r.status===403?
     "Current CSR or finance branch permission is restricted.":
     "Original CG09 finance verification is unavailable. No money is reported.");
    return await r.json() as Report;
   }).then(v=>{if(alive)setPage(v);})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Report unavailable.");})
   .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[token,branch,status,query,cursor,epoch,onExpired]);
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button"
  disabled={disabled} accessibilityState={{disabled}}
  style={[styles.button,disabled&&{opacity:.45}]} onPress={fn}>
  <Text style={styles.buttonText}>{label}</Text></Pressable>;
 return <ScrollView contentContainerStyle={styles.page}>
  <Text style={styles.title}>CSR Funding Reports</Text>
  <Text style={styles.note}>Original CG08 approved pledges are not bank cash.
   Received, allocated and utilized values come only from verified CG09 sources.</Text>
  <TextInput style={styles.input} placeholder="Search sponsor or purpose"
   value={query} onChangeText={v=>{reset();setQuery(v);}}/>
  <Text style={styles.heading}>Status</Text>
  <View style={styles.tags}>{["ALL","DRAFT","SUBMITTED","APPROVED","RETURNED","REJECTED"].map(v=>
   <Pressable key={v} accessibilityRole="button"
    style={[styles.button,status===v&&styles.chosen]}
    onPress={()=>{reset();setStatus(v);}}>
    <Text style={styles.buttonText}>{v}</Text>
   </Pressable>)}</View>
  <Text style={styles.heading}>Foundation branch</Text>
  <View style={styles.tags}>
   {button("My permitted scope",()=>{reset();setBranch("");},!!loading&&!!cursor)}
   {(choices?.branches??[]).map(v=><Pressable key={v.value}
    accessibilityRole="button" style={[styles.button,branch===v.value&&styles.chosen]}
    onPress={()=>{reset();setBranch(v.value);}}>
    <Text style={styles.buttonText}>{v.label}</Text></Pressable>)}
  </View>
  {button("Refresh original CG09 finance",()=>{reset();setEpoch(v=>v+1);})}
  {loading&&<ActivityIndicator/>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {page&&!loading&&<>
   <Text style={styles.note}>{page.notice}</Text>
   {page.items.length===0&&<Text style={styles.note}>No funding records in this permitted scope.</Text>}
   {page.items.map(v=><View key={v.ref} style={styles.card}>
    <Text style={styles.heading}>{v.partnerName??"Foundation source"}</Text>
    <Text>{v.purpose}</Text>
    <Text style={styles.note}>{v.branchName??"Foundation"} · {v.projectName??"General purpose"}</Text>
    <Text style={styles.note}>Funding {v.status} · {v.financeStatus==="RECEIPT_PENDING"?
     "Bank verification pending":v.financeStatus==="REVALIDATION_REQUIRED"?
     "Finance revalidation required":v.financeStatus==="NOT_APPROVED"?
     "Not yet an approved commitment":"Verified finance source"}</Text>
    <View style={styles.numbers}>
     {([
      ["Requested",v.requestedMinor],["Committed",v.committedMinor],
      ["Received · CG09",v.receivedMinor],["Allocated · CG09",v.allocatedMinor],
      ["Utilized · CG09",v.utilizedMinor],["Available",v.availableMinor]
     ] as const).map(([label,val])=><Text key={label} style={styles.note}>
      {label}: <Text style={styles.strong}>{money(val)}</Text></Text>)}
    </View>
   </View>)}
   <View style={styles.tags}>
    {button("Previous",()=>{setCursor(back.at(-1)??"");setBack(x=>x.slice(0,-1));},
     back.length===0)}
    {button("Next 25",()=>{if(page.nextCursor){setBack(x=>[...x,cursor]);setCursor(page.nextCursor);}},
     !page.hasMore||!page.nextCursor)}
   </View>
  </>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 page:{padding:14,gap:12},title:{fontSize:21,fontWeight:"700",color:"#0F172A"},
 heading:{fontSize:14,fontWeight:"700",color:"#0F172A"},
 note:{fontSize:13,color:"#475569"},strong:{fontWeight:"700",color:"#0F172A"},
 input:{backgroundColor:"#fff",borderWidth:1,borderColor:"#CBD5E1",padding:12,borderRadius:9},
 tags:{flexDirection:"row",flexWrap:"wrap",gap:7},
 button:{padding:10,borderRadius:8,borderWidth:1,borderColor:"#CBD5E1"},
 chosen:{backgroundColor:"#EFF6FF",borderColor:"#1D4ED8"},
 buttonText:{fontSize:13,color:"#1D4ED8",fontWeight:"600"},
 card:{backgroundColor:"#fff",padding:13,borderRadius:10,borderWidth:1,
  borderColor:"#CBD5E1",gap:6},numbers:{gap:4},
 error:{color:"#B91C1C",fontSize:13}
});
