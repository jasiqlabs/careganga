import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,BackHandler,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
import {FinanceSetupEditor,type FinanceKind,type FinanceSetup} from "./finance-setup-editor";
import {FinanceVoucherDraftScreen} from "./finance-voucher-draft-screen";
import {FinanceNativeManualReversal} from "./finance-native-manual-reversal";

type Year={yearRef:string;name:string;startOn:string;endOn:string;status:string;version:number};
type Account={accountRef:string;name:string;code:string;groupName:string;kind:string;
  scopeKind:string;branchName:string|null;status:string;balanceMinor:string;
  bankLabel:string|null;maskedDetails:string|null;version:number};
type Setup=FinanceSetup & {accounts:Account[];years:Year[];
  openingJournals:{journalRef:string;yearName:string;postingDate:string;amountMinor:string}[];
  canManageFoundationFinance:boolean;nextOffset:number|null};
type Props={token:string;canManage:boolean;canPost:boolean;canViewVouchers:boolean;canManageVouchers:boolean;canViewEvidence:boolean;canUploadEvidence:boolean;canVerifyPayment:boolean;canReverse:boolean;onExit:()=>void;onExpired:()=>void};
function inr(minor:string):string{
 try{
  const n=BigInt(minor),abs=n<0n?-n:n;
  return (n<0n?"−":"")+"₹"+(abs/100n).toLocaleString("en-IN")+"."+
   (abs%100n).toString().padStart(2,"0");
 }catch{return "Balance unavailable";}
}
function viewError(status:number):string{
 if(status===401)return "Your session expired. Sign in again.";
 if(status===403)return "Your role does not allow you to view finance accounts. Ask the Foundation Administrator for access.";
 if(status===429)return "Too many finance requests. Please try again after a short break.";
 if(status===400)return "The requested finance list could not be loaded. Refresh and try again.";
 return "Finance information is temporarily unavailable. Check your connection and try again.";
}
/** US-001 native read-only counterpart to the original U35/U36 Admin Web
 * account overview; no second finance editor and no raw technical identifiers.
 */
export function FinanceAccountsScreen({token,canManage,canPost,canViewVouchers,canManageVouchers,canViewEvidence,canUploadEvidence,canVerifyPayment,canReverse,onExit,onExpired}:Props){
 const [data,setData]=useState<Setup|null>(null);
 const canFoundation=Boolean(data?.canManageFoundationFinance);
 const [offset,setOffset]=useState(0);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [category,setCategory]=useState<"ACCOUNTS"|"GROUPS"|"YEARS"|"OPENING"|"JOURNALS">("ACCOUNTS");
 const [voucherOpen,setVoucherOpen]=useState(false);
 const [reversingJournal,setReversingJournal]=useState("");
 const [protectedEligible,setProtectedEligible]=useState(false);
 const canCorrect=canReverse&&protectedEligible;
 useEffect(()=>{
  if(!canReverse){setProtectedEligible(false);return;}
  let active=true;
  void (async()=>{
   try{
    const res=await identityRequest("/api/finance-accounting/manual-journals/reversal-eligibility",{
     headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(res.status===401){onExpired();return;}
    const v=res.ok?await res.json() as {canReverse?:boolean}:null;
    if(active)setProtectedEligible(v?.canReverse===true);
   }catch{if(active)setProtectedEligible(false);}
  })();
  return()=>{active=false;};
 },[token,canReverse,onExpired]);
 const [manualJournals,setManualJournals]=useState<Array<{
  journalRef:string;description:string;postingDate:string;yearName:string;debitMinor:string;
  reversed:boolean;differentCreator:boolean}>>([]);
 const [manualError,setManualError]=useState("");
 const [manualLoading,setManualLoading]=useState(false);
 const [manualRefresh,setManualRefresh]=useState(0);
 const [editor,setEditor]=useState<{kind:FinanceKind;target?:{
   ref:string;name:string;status:string;version:number}}|null>(null);
 const reload=useCallback(async()=>{
  setBusy(true);setNotice("");
  try{
   const response=await identityRequest("/api/finance-accounting/setup?offset="+offset,{
    headers:{Authorization:"Bearer "+token},cache:"no-store"
   });
   if(response.status===401){onExpired();return;}
   if(!response.ok){setData(null);setNotice(viewError(response.status));return;}
   const result:unknown=await response.json();
   if(!result||typeof result!=="object"||Array.isArray(result)||
      !("accounts" in result)||!Array.isArray(result.accounts)||
      !("years" in result)||!Array.isArray(result.years)||
      !("canManageFoundationFinance" in result)||
      typeof result.canManageFoundationFinance!=="boolean"||
      !("openingJournals" in result)||!Array.isArray(result.openingJournals)||
      !("nextOffset" in result)||(result.nextOffset!==null&&
       !(typeof result.nextOffset==="number"&&Number.isSafeInteger(result.nextOffset)))){
    setData(null);setNotice("The finance list could not be verified. Refresh and try again.");return;
   }
   setData(result as Setup);
  }catch{setData(null);setNotice("Cannot reach the finance service. Check your connection and try again.");}
  finally{setBusy(false);}
 },[token,offset,onExpired]);
 useEffect(()=>{void reload();},[reload]);
 useEffect(()=>{
  const sub=BackHandler.addEventListener("hardwareBackPress",()=>{if(editor)setEditor(null);else if(voucherOpen)setVoucherOpen(false);else onExit();return true;});
  return()=>sub.remove();
 },[onExit,editor,voucherOpen]);
 useEffect(()=>{
  if(category!=="JOURNALS")return;
  let active=true;
  setManualLoading(true);setManualError("");
  void (async()=>{
   try{
    const response=await identityRequest("/api/finance-accounting/manual-journals",{
     headers:{Authorization:"Bearer "+token},cache:"no-store"});
    if(response.status===401){if(active)onExpired();return;}
    if(!response.ok)throw Error(viewError(response.status));
    const value:unknown=await response.json();
    if(!value||typeof value!=="object"||!("journals" in value)||
       !Array.isArray(value.journals))throw Error("Posted journals could not be verified. Refresh and try again.");
    if(active)setManualJournals(value.journals);
   }catch(e){
    if(active){setManualJournals([]);setManualError(
     e instanceof Error?e.message:"Cannot load journal records. Refresh and retry.");}
   }finally{if(active)setManualLoading(false);}
  })();
  return()=>{active=false;};
 },[category,token,manualRefresh,onExpired]);
 if(voucherOpen&&data)return <FinanceVoucherDraftScreen token={token}
   years={data.years} branches={data.branches} canManage={canManageVouchers} canViewEvidence={canViewEvidence} canUploadEvidence={canUploadEvidence}
   canPost={canPost} canVerifyPayment={canVerifyPayment}
   onClose={()=>setVoucherOpen(false)} onExpired={onExpired}/>;
 if(reversingJournal&&data)return <FinanceNativeManualReversal token={token}
   journalRef={reversingJournal} years={data.years} onExit={()=>setReversingJournal("")}
   onDone={()=>{setReversingJournal("");setManualRefresh(v=>v+1);void reload();}}
   onExpired={onExpired}/>;
 if(editor&&data)return <FinanceSetupEditor token={token} data={data}
    kind={editor.kind} target={editor.target} onClose={()=>setEditor(null)}
    onSaved={()=>{const wasManual=editor.kind==="manual";setEditor(null);setOffset(0);void reload();if(wasManual){setCategory("JOURNALS");setManualRefresh(n=>n+1);}}} onExpired={onExpired}/>;
 return <SafeAreaView style={s.safe} edges={["top","bottom"]}>
  <View style={s.header}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to Foundation"
    hitSlop={12} style={s.back} onPress={onExit}><Text style={s.backText}>‹ Back</Text></Pressable>
   <View style={s.headerTitle}><Text style={s.eyebrow}>FOUNDATION / FINANCE</Text>
    <Text style={s.title} accessibilityRole="header">Accounts & Years</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Refresh finance records"
    disabled={busy} style={s.back} onPress={()=>{void reload();setManualRefresh(n=>n+1);}}>
    <Text style={s.backText}>Refresh</Text></Pressable>
  </View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
   {([["ACCOUNTS","Accounts"],["GROUPS","Groups"],["YEARS","Financial Years"],["OPENING","Opening Entries"],["JOURNALS","Journals"]] as const)
    .map(([key,label])=><Pressable key={key} accessibilityRole="tab"
     accessibilityState={{selected:category===key}} style={[s.tab,category===key&&s.selectedTab]}
     onPress={()=>setCategory(key)}><Text style={[s.tabText,category===key&&s.selectedTabText]}>
       {label}</Text></Pressable>)}
  </ScrollView>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.subtext}>Only confirmed financial data for your permitted Foundation role is shown.</Text>
   <View style={s.actionRow}>
    {canManage&&canFoundation&&<Pressable style={s.create} accessibilityRole="button"
     onPress={()=>setEditor({kind:"year"})}><Text style={s.createText}>+ Financial Year</Text></Pressable>}
    {canManage&&canFoundation&&<Pressable style={s.create} accessibilityRole="button"
     onPress={()=>setEditor({kind:"group"})}><Text style={s.createText}>+ Account Group</Text></Pressable>}
    {canManage&&(canFoundation||Boolean(data?.branches.length))&&
     <Pressable style={s.create} accessibilityRole="button"
     onPress={()=>setEditor({kind:"account"})}><Text style={s.createText}>+ Account</Text></Pressable>}
    {canPost&&<Pressable style={s.create} accessibilityRole="button"
     onPress={()=>setEditor({kind:"opening"})}><Text style={s.createText}>+ Opening Entry</Text></Pressable>}
    {canPost&&<Pressable style={s.create} accessibilityRole="button"
     onPress={()=>setEditor({kind:"manual"})}><Text style={s.createText}>+ General Journal</Text></Pressable>}
    {canViewVouchers&&<Pressable style={s.create} accessibilityRole="button"
     onPress={()=>setVoucherOpen(true)}><Text style={s.createText}>Voucher Drafts</Text></Pressable>}
   </View>
   {busy&&<View style={s.state}><ActivityIndicator color={theme.primary}/>
    <Text style={s.subtext}>Checking current finance records…</Text></View>}
   {!!notice&&<View style={s.error} accessibilityRole="alert"><Text style={s.errorText}>{notice}</Text>
    <Pressable onPress={()=>void reload()} style={s.retry} accessibilityRole="button">
     <Text style={s.retryText}>Try again</Text></Pressable></View>}
   {!busy&&data&&category==="ACCOUNTS"&&<>
    {!data.accounts.length?<Text style={s.empty}>There are no financial accounts on this page. Ask your Finance Administrator to create accounts in CareGanga Admin.</Text>:
     data.accounts.map(a=><View style={s.card} key={a.accountRef}>
      <View style={s.line}><Text style={s.cardTitle} numberOfLines={2}>{a.name}</Text>
       <Text style={[s.status,a.status==="ACTIVE"&&s.active]}>{a.status==="ACTIVE"?"Active":"Inactive"}</Text></View>
      <Text style={s.meta}>{a.code} · {a.groupName}</Text>
      <Text style={s.meta}>{a.branchName??"Foundation"} · {a.kind==="BANK"?"Bank":a.kind==="CASH"?"Cash":"General"}</Text>
      {!!a.bankLabel&&<Text style={s.meta}>{a.bankLabel}{a.maskedDetails?" · "+a.maskedDetails:""}</Text>}
      <Text style={s.amount}>{inr(a.balanceMinor)}</Text>
      {canManage&&(canFoundation||a.scopeKind==="BRANCH")&&
       <Pressable accessibilityRole="button" style={s.create}
       onPress={()=>setEditor({kind:"accountStatus",
        target:{ref:a.accountRef,name:a.name,status:a.status,version:a.version}})}>
       <Text style={s.createText}>{a.status==="ACTIVE"?"Deactivate account":"Reactivate account"}</Text>
      </Pressable>}
     </View>)}
    <View style={s.pager}><Pressable accessibilityRole="button" disabled={offset===0||busy}
      style={[s.pagerButton,offset===0&&s.disabled]} onPress={()=>setOffset(x=>Math.max(0,x-50))}>
       <Text style={s.pagerText}>Previous</Text></Pressable>
      <Text style={s.meta}>Accounts on this page: {data.accounts.length}</Text>
      <Pressable accessibilityRole="button" disabled={data.nextOffset===null||busy}
       style={[s.pagerButton,data.nextOffset===null&&s.disabled]}
       onPress={()=>setOffset(data.nextOffset??0)}><Text style={s.pagerText}>Next</Text></Pressable></View>
   </>}
   {!busy&&data&&category==="GROUPS"&&
    (!data.groups.length?<Text style={s.empty}>No account groups have been added yet. Use the New Account Group action if your role permits it.</Text>:
     data.groups.map(g=><View style={s.card} key={g.groupRef}>
       <Text style={s.cardTitle}>{g.name}</Text><Text style={s.meta}>Business code: {g.code}</Text>
       <Text style={s.meta}>Category: {g.category.toLowerCase()}</Text>
      </View>))}
   {!busy&&data&&category==="YEARS"&&
    (!data.years.length?<Text style={s.empty}>No financial year exists. An authorized Finance Administrator can create one using the Financial Year action.</Text>:
     data.years.map(y=><View style={s.card} key={y.yearRef}>
       <View style={s.line}><Text style={s.cardTitle}>{y.name}</Text>
        <Text style={[s.status,y.status==="OPEN"&&s.active]}>{y.status==="OPEN"?"Open":"Closed"}</Text></View>
       <Text style={s.meta}>{y.startOn} to {y.endOn}</Text>
       {canManage&&canFoundation&&y.status==="OPEN"&&<Pressable accessibilityRole="button"
         style={s.create} onPress={()=>setEditor({kind:"yearStatus",
           target:{ref:y.yearRef,name:y.name,status:y.status,version:y.version}})}>
        <Text style={s.createText}>Close financial year</Text>
       </Pressable>
      </View>))}
   {!busy&&data&&category==="OPENING"&&
    (!data.openingJournals.length?<Text style={s.empty}>No opening entries are posted yet. An authorized staff member can post a balanced opening entry using the Opening Entry action.</Text>:
     data.openingJournals.map(j=><View style={s.card} key={j.journalRef}>
       <Text style={s.cardTitle}>{j.yearName}</Text><Text style={s.meta}>{j.postingDate} · Posted</Text>
       <Text style={s.amount}>{inr(j.amountMinor)}</Text>
      </View>))}
   {category==="JOURNALS"&&<>
    {manualLoading&&<View style={s.state}><ActivityIndicator color={theme.primary}/>
     <Text style={s.meta}>Checking posted journals…</Text></View>}
    {!!manualError&&<View style={s.error} accessibilityRole="alert">
     <Text style={s.errorText}>{manualError}</Text>
     <Pressable style={s.retry} accessibilityRole="button" onPress={()=>setManualRefresh(n=>n+1)}>
      <Text style={s.retryText}>Try again</Text></Pressable></View>}
    {!manualLoading&&!manualError&&(!manualJournals.length?
     <Text style={s.empty}>No manual journals have been posted yet.
      Authorized Finance staff can record a balanced general journal.</Text>:
     manualJournals.map(j=><View key={j.journalRef} style={s.card}>
      <Text style={s.cardTitle}>{j.description}</Text>
      <Text style={s.meta}>{j.yearName} · {j.postingDate}</Text>
      <Text style={s.amount}>{inr(j.debitMinor)}</Text>
      <Text style={s.meta}>{j.reversed?"Original reversed by an offsetting journal":
       "Posted to ledger — not a verified payment"}</Text>
      {canCorrect&&j.differentCreator&&!j.reversed&&
       <Pressable accessibilityRole="button" style={s.create}
        onPress={()=>setReversingJournal(j.journalRef)}>
        <Text style={s.createText}>Correct original journal</Text>
       </Pressable>}
     </View>))}
   </>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 actionRow:{flexDirection:"row",flexWrap:"wrap",gap:8},
 create:{borderWidth:1,borderColor:theme.primary,borderRadius:7,paddingHorizontal:12,
  justifyContent:"center",minHeight:48,backgroundColor:theme.surface,alignSelf:"flex-start"},
 createText:{color:theme.primary,fontSize:13,fontWeight:"600"},

 safe:{flex:1,backgroundColor:theme.background},
 header:{backgroundColor:theme.surface,borderBottomColor:theme.border,borderBottomWidth:1,
  paddingHorizontal:14,paddingVertical:12,flexDirection:"row",alignItems:"center",gap:8},
 headerTitle:{flex:1,minWidth:0},
 eyebrow:{fontSize:10,color:theme.mutedText,letterSpacing:.5},
 title:{fontSize:19,fontWeight:"700",color:theme.text},
 back:{paddingHorizontal:8,minHeight:48,justifyContent:"center"},
 backText:{fontSize:14,fontWeight:"600",color:theme.primary},
 tabs:{flexDirection:"row",backgroundColor:theme.surface,borderBottomWidth:1,borderBottomColor:theme.border},
 tab:{minWidth:105,minHeight:50,justifyContent:"center",alignItems:"center",paddingHorizontal:10,borderBottomWidth:3,borderBottomColor:"transparent"},
 selectedTab:{borderBottomColor:theme.primary},
 tabText:{fontSize:12,fontWeight:"500",color:theme.mutedText,textAlign:"center"},
 selectedTabText:{color:theme.primary,fontWeight:"700"},
 content:{padding:14,paddingBottom:32,gap:12},
 subtext:{fontSize:13,lineHeight:19,color:theme.mutedText},
 state:{flexDirection:"row",gap:12,alignItems:"center",padding:14},
 error:{backgroundColor:"#FFF3F3",borderRadius:8,borderWidth:1,borderColor:"#F7CBCB",padding:14,gap:10},
 errorText:{color:theme.error,fontSize:14,lineHeight:21},
 retry:{backgroundColor:theme.primary,alignSelf:"flex-start",paddingVertical:11,paddingHorizontal:15,borderRadius:6},
 retryText:{color:theme.primaryText,fontWeight:"600"},
 empty:{padding:22,backgroundColor:theme.surface,borderRadius:9,borderWidth:1,
  borderColor:theme.border,color:theme.mutedText,textAlign:"center",lineHeight:21},
 card:{padding:15,borderWidth:1,borderColor:theme.border,borderRadius:9,
  backgroundColor:theme.surface,gap:5},
 line:{flexDirection:"row",gap:10,alignItems:"center",justifyContent:"space-between"},
 cardTitle:{fontWeight:"700",fontSize:16,color:theme.text,flexShrink:1},
 meta:{fontSize:12,color:theme.mutedText},
 status:{fontSize:11,fontWeight:"600",paddingVertical:4,paddingHorizontal:9,
  backgroundColor:"#F1F3F6",color:theme.mutedText,borderRadius:20,overflow:"hidden"},
 active:{backgroundColor:"#E8F8EF",color:"#23794A"},
 amount:{fontSize:18,fontWeight:"700",color:theme.text,marginTop:5},
 pager:{flexDirection:"row",justifyContent:"space-between",gap:6,alignItems:"center"},
 pagerButton:{minHeight:48,justifyContent:"center",paddingHorizontal:10,borderRadius:6,
  backgroundColor:theme.surface,borderWidth:1,borderColor:theme.border},
 pagerText:{fontWeight:"600",color:theme.text},
 disabled:{opacity:.4}
});
