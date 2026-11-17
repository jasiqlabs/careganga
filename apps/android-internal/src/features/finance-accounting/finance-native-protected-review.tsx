import {useCallback,useEffect,useState} from "react";
import {BackHandler,Pressable,ScrollView,Text,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {financeNativeStyles as s,NativeFinanceAction as Action,
 NativeFinanceCard as Card,NativeFinanceField as Field,NativeFinanceOptions as Options,
 financeNativeRequest as request,financeNativeProblem as problem,
 formatFinanceMoney as money} from "./finance-native-source-kit";
type Kind="INVOICE"|"BUDGET";
type ReviewerCase={caseRef:string;caseNumber:string;invoiceNumber?:string;budgetNumber?:string;
 status:string;revision:number};
type ReviewerDetail={caseRef:string;caseNumber:string;status:string;revision:number;
 source:Record<string,unknown>};
type Pending={key:string;caseRef:string;body:Record<string,unknown>};
export function FinanceNativeProtectedReview({token,kind,canConfigure,onExit,onExpired}:{
 token:string;kind:Kind;canConfigure:boolean;onExit:()=>void;onExpired:()=>void}){
 const endpoint=kind==="INVOICE"?"/api/approvals/finance-invoices":
  "/api/approvals/finance-budgets";
 const [cases,setCases]=useState<ReviewerCase[]>([]);
 const [selected,setSelected]=useState<ReviewerDetail|null>(null);
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [offset,setOffset]=useState(0),[nextOffset,setNextOffset]=useState<number|null>(null);
 const [action,setAction]=useState<"APPROVE"|"RETURN"|"REJECT">("APPROVE");
 const [password,setPassword]=useState(""),[setupPassword,setSetupPassword]=useState("");
 const [remarks,setRemarks]=useState("");
 const [pending,setPending]=useState<Pending|null>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const fail=(e:unknown)=>{setError(problem(e));
  if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();};
 const load=useCallback(async()=>{
  setError("");
  try{
   const [p,r]=await Promise.all([
    request<{configured:boolean}>(token,endpoint+"/process"),
    request<{cases:ReviewerCase[];nextOffset:number|null}>(token,
     endpoint+"/cases?offset="+offset)]);
   if(!Array.isArray(r.cases))throw Error("UNKNOWN");
   setCases(r.cases);setNextOffset(r.nextOffset);setConfigured(p.configured);
  }catch(e){fail(e);}
 },[token,endpoint,offset,onExpired]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const back=BackHandler.addEventListener("hardwareBackPress",()=>{
  if(selected){setSelected(null);setPassword("");return true;}onExit();return true;});
  return()=>back.remove();
 },[selected,onExit]);
 async function detail(ref:string){
  setBusy(true);setError("");
  try{
   const item=await request<ReviewerDetail>(token,endpoint+"/cases/"+ref);
   if(!item.source||!item.caseNumber)throw Error("UNKNOWN");
   setSelected(item);setPassword("");setRemarks("");setAction("APPROVE");setPending(null);
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 async function configure(){
  if(!canConfigure||busy)return;
  setBusy(true);setError("");
  try{
   const result=await request<{configured:boolean}>(token,endpoint+"/process","POST",
    {currentPassword:setupPassword});
   if(!result.configured)throw Error("UNKNOWN");
   setConfigured(true);setSetupPassword("");
   setNotice("Original protected "+kind.toLowerCase()+" review process is configured.");
   void load();
  }catch(e){fail(e);}finally{setBusy(false);}
 }
 async function decide(p:Pending){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const result=await request<{confirmed:boolean;status:string}>(token,
    endpoint+"/cases/"+p.caseRef+"/decisions","POST",
    {...p.body,requestKey:p.key});
   if(!result.confirmed)throw Error("UNKNOWN");
   setPending(null);setPassword("");setSelected(null);
   setNotice("Original "+kind.toLowerCase()+" review confirmed: "+result.status+
    ". Accounting posting and verified payment remain separate.");
   void load();
  }catch(e){setPending(p);setPassword("");fail(e);}
  finally{setBusy(false);}
 }
 function submit(){
  if(!selected||busy||pending||password.length<8)return;
  void decide({key:Crypto.randomUUID(),caseRef:selected.caseRef,
   body:{action,remarks,expectedRevision:selected.revision,currentPassword:password}});
 }
 const facts=selected?.source??{},info=facts.draft&&typeof facts.draft==="object"?
  (facts.draft as Record<string,unknown>):{};
 const invoiceInfo=info.info&&typeof info.info==="object"?
  info.info as Record<string,unknown>:{};
 const invoiceItems=info.items&&typeof info.items==="object"?
  info.items as Record<string,unknown>:{};
 return <SafeAreaView style={s.screen} edges={["top","bottom"]}>
  <View style={s.header}><Pressable accessibilityRole="button" onPress={()=>
    selected?setSelected(null):onExit()}><Text style={s.back}>‹ Back</Text></Pressable>
   <Text accessibilityRole="header" style={s.title}>
    {kind==="INVOICE"?"Protected Invoice Reviews":"Protected Budget Reviews"}</Text></View>
  <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
   {!!error&&<Text accessibilityRole="alert" style={s.alert}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={s.muted}>{notice}</Text>}
   {configured===false&&<Card title="Protected review is not configured">
    <Text style={s.muted}>An authorized administrator must configure a distinct current reviewer.
     A submitted financial source cannot auto-approve.</Text>
    {canConfigure&&<>
     <Field label="Current administrator password" value={setupPassword} secure
      onChange={setSetupPassword}/>
     <Action label="Configure original reviewer process" disabled={busy||setupPassword.length<8}
      onPress={()=>void configure()}/>
    </>}
   </Card>}
   <Card title="Original review cases">
    <Action secondary label="Refresh reviews" onPress={()=>void load()}/>
    {cases.map(x=><Pressable accessibilityRole="button" key={x.caseRef} style={s.card}
     disabled={busy} onPress={()=>void detail(x.caseRef)}>
     <Text style={s.heading}>{x.caseNumber}</Text>
     <Text style={s.text}>{x.invoiceNumber??x.budgetNumber??"Protected financial source"}</Text>
     <Text style={s.muted}>{x.status}</Text>
    </Pressable>)}
    {!cases.length&&<Text style={s.muted}>No current protected cases.</Text>}
    <View style={s.row}>
     <Action secondary label="Previous" disabled={offset===0}
      onPress={()=>setOffset(v=>Math.max(0,v-40))}/>
     <Action secondary label="Next" disabled={nextOffset===null}
      onPress={()=>setOffset(nextOffset??0)}/>
    </View>
   </Card>
   {selected&&<Card title={selected.caseNumber}>
    <Text style={s.heading}>{String(facts.invoiceNumber??facts.budgetNumber??"Original finance review")}</Text>
    {kind==="INVOICE"?<>
     <Text style={s.text}>Counterparty: {String(invoiceInfo.counterpartyName??"Unavailable")}</Text>
     <Text style={s.text}>Purpose: {String(invoiceInfo.purpose??"Unavailable")}</Text>
     <Text style={s.text}>Original amount: {money(String(invoiceItems.totalMinor??"0"))}</Text>
     <Text style={s.muted}>Items, tax and payment accounts are frozen to this original version.</Text>
    </>:<>
     <Text style={s.text}>Budget: {String(facts.name??"Unavailable")}</Text>
     <Text style={s.text}>Category: {String(facts.category??"Unavailable")}</Text>
     <Text style={s.text}>Ceiling: {money(String(facts.amountMinor??"0"))}</Text>
     <Text style={s.text}>Period: {String(facts.periodStart??"")} – {String(facts.periodEnd??"")}</Text>
    </>}
    <Text style={s.muted}>This decision does not post money or verify a bank transaction.</Text>
    {["SUBMITTED","IN_REVIEW"].includes(selected.status)&&<>
     <Options label="Protected decision" value={action} options={[
      {ref:"APPROVE",label:"Approve"},{ref:"RETURN",label:"Return"},
      {ref:"REJECT",label:"Reject"}]} onChange={v=>setAction(v as typeof action)}/>
     <Field label="Remarks" value={remarks} multiline onChange={setRemarks}/>
     <Field label="Current password" value={password} secure onChange={setPassword}/>
     <Action label="Confirm independent protected decision" disabled={busy||
      password.length<8||Boolean(pending)} onPress={submit}/>
    </>}
    {pending&&<Card title="Original decision uncertain">
     <Text style={s.muted}>Reopen and check the original case before attempting another reviewer decision.</Text>
     <Action secondary label="Reopen original case" onPress={()=>void detail(selected.caseRef)}/>
    </Card>}
   </Card>}
  </ScrollView>
 </SafeAreaView>;
}
