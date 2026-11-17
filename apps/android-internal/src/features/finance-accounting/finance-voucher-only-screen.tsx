import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,StyleSheet,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {FinanceVoucherDraftScreen} from "./finance-voucher-draft-screen";
import type {FinanceYear,FinanceBranch} from "./finance-setup-editor";

export function FinanceVoucherOnlyScreen({token,canManage,onExit,onExpired}:{
 token:string;canManage:boolean;onExit:()=>void;onExpired:()=>void
}){
 const [ready,setReady]=useState<{years:FinanceYear[];branches:FinanceBranch[]}|null>(null);
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const refresh=useCallback(async()=>{
  setLoading(true);setMessage("");
  try{
   const response=await identityRequest("/api/finance-accounting/vouchers/options",{
    headers:{Authorization:"Bearer "+token},cache:"no-store"});
   if(response.status===401){onExpired();return;}
   if(!response.ok)throw Error(response.status===403?
    "Your role cannot open voucher drafts. Ask an Administrator for access.":
    "Voucher years and branches are temporarily unavailable. Check the connection and retry.");
   const value:unknown=await response.json();
   if(!value||typeof value!=="object"||!("years" in value)||!("branches" in value)||
     !Array.isArray(value.years)||!Array.isArray(value.branches))
    throw Error("Voucher options could not be verified. Refresh and retry.");
   setReady({years:value.years as FinanceYear[],branches:value.branches as FinanceBranch[]});
  }catch(e){setReady(null);setMessage(e instanceof Error?e.message:
   "Cannot load voucher options. Check the connection and retry.");}
  finally{setLoading(false);}
 },[token,onExpired]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(ready)return;
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{onExit();return true;});
  return()=>sub.remove();
 },[ready,onExit]);
 if(ready)return <FinanceVoucherDraftScreen token={token}
  years={ready.years} branches={ready.branches} canManage={canManage}
  onClose={onExit} onExpired={onExpired}/>;
 return <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
  <View style={styles.header}>
   <Pressable onPress={onExit} accessibilityRole="button" style={styles.back}>
    <Text style={styles.backText}>‹ Back</Text></Pressable>
   <Text style={styles.title}>Voucher Drafts</Text>
  </View>
  {loading&&<View style={styles.center}><ActivityIndicator color={theme.primary}/>
   <Text style={styles.hint}>Checking your permitted voucher options…</Text></View>}
  {!!message&&<View style={styles.center} accessibilityRole="alert">
   <Text style={styles.hint}>{message}</Text>
   <Pressable style={styles.retry} onPress={()=>void refresh()}>
    <Text style={styles.retryText}>Try again</Text></Pressable>
  </View>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:theme.background},
 header:{minHeight:64,backgroundColor:theme.surface,paddingHorizontal:14,
  flexDirection:"row",alignItems:"center",gap:15,borderBottomWidth:1,borderBottomColor:theme.border},
 back:{minHeight:48,justifyContent:"center"},backText:{color:theme.primary,fontSize:15,fontWeight:"600"},
 title:{fontSize:18,fontWeight:"700",color:theme.text},
 center:{padding:18,gap:14,alignItems:"center"},
 hint:{fontSize:14,color:theme.mutedText,textAlign:"center"},
 retry:{minHeight:48,borderRadius:8,backgroundColor:theme.primary,paddingHorizontal:15,justifyContent:"center"},
 retryText:{color:theme.primaryText,fontWeight:"700"}
});
