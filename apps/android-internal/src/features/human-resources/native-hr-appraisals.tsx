import React,{useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Item={reference:string;periodStart:string;periodEnd:string;goal:number;competency:number;attendance:number;status:string};
export function NativeHrMyAppraisals({token,onExpired}:{token:string;onExpired:()=>void}){
 const [items,setItems]=useState<Item[]>([]),[linked,setLinked]=useState<boolean|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{
  const read=++sequence.current;setLoading(true);setError("");setItems([]);setLinked(null);
  try{
   const response=await identityRequest("/api/hr/me/appraisals",{method:"GET",headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(response.status===401){if(read===sequence.current)onExpired();throw Error("Your session expired. Sign in again.");}
   if(!response.ok)throw Error("Released appraisals are unavailable. Refresh to retry.");
   const result=await response.json() as {linked:boolean;items:Item[]};
   if(typeof result.linked!=="boolean"||!Array.isArray(result.items))throw Error("Appraisal result unavailable");
   if(read===sequence.current){setItems(result.items);setLinked(result.linked);}
  }catch(e){if(read===sequence.current)setError(e instanceof Error?e.message:"Unable to read performance.");}
  finally{if(read===sequence.current)setLoading(false);}
 },[token,onExpired]);
 useEffect(()=>{void refresh();return()=>{sequence.current++;};},[refresh]);
 return <View style={styles.card}><Text style={styles.title}>My performance</Text>
  <Pressable accessibilityRole="button" accessibilityState={{disabled:loading}} disabled={loading} onPress={()=>void refresh()} style={styles.button}><Text style={styles.label}>Refresh</Text></Pressable>
  {loading&&<ActivityIndicator accessibilityLabel="Loading released appraisals"/>}
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {linked===false&&<Text style={styles.muted}>No current approved employment is linked to your account.</Text>}
  {linked===true&&!items.length&&<Text style={styles.muted}>No appraisal has been released to you.</Text>}
  {items.map(x=><View key={x.reference} style={styles.item}>
   <Text style={styles.label}>{x.periodStart} – {x.periodEnd}</Text>
   <Text>Goal & delivery: {x.goal}/100</Text><Text>Competency: {x.competency}/100</Text><Text>Attendance & conduct: {x.attendance}/100</Text><Text style={styles.muted}>Released</Text>
  </View>)}
 </View>;
}
const styles=StyleSheet.create({card:{padding:14,borderRadius:14,borderWidth:1,borderColor:"#E2E8F0",backgroundColor:"#fff",gap:10},title:{fontSize:17,fontWeight:"700",color:"#0F172A"},
 label:{fontSize:14,fontWeight:"600",color:"#334155"},button:{backgroundColor:"#F1F5F9",borderRadius:9,minHeight:44,alignItems:"center",justifyContent:"center"},muted:{fontSize:13,color:"#64748B"},item:{borderTopWidth:1,borderColor:"#E2E8F0",paddingTop:10,gap:5},error:{color:"#991B1B"}});
