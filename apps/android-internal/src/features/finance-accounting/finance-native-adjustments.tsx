import {useCallback,useEffect,useState} from "react";
import {Text,View} from "react-native";
import * as Crypto from "expo-crypto";
import {NativeFinanceAction as Action,NativeFinanceCard as Card,
 NativeFinanceField as Field,NativeFinanceOptions as Options,
 financeNativeRequest as request,financeNativeProblem as problem,
 formatFinanceMoney as money,financeNativeStyles as s} from "./finance-native-source-kit";
type Choice={ref:string;name:string};
type Note={credit_note_number:string;total_minor:string;collected_minor:string};
type Refund={refundRef:string;status:string;amountMinor:string};
type Detail={creditNote:Note|null;refund:Refund|null;
 replacementInvoice:{invoiceNumber:string;status:string}|null};
type OptionsData={refundLiabilityAccounts:Choice[];years:Choice[];banks:Choice[]};
type Command={path:string;body:Record<string,unknown>;label:string};
/** Native equivalent of the original Admin invoice correction/refund path.
 * No new accounting master or external bank API: all writes use CG09 source.
 */
export function FinanceNativeAdjustments({token,invoiceRef,canReview,canManage,
 onExpired,onPdf,onCredited}:{
 token:string;invoiceRef:string;canReview:boolean;canManage:boolean;
 onExpired:()=>void;onPdf:(path:string)=>Promise<void>;onCredited:()=>void
}){
 const [data,setData]=useState<Detail|null>(null),[choices,setChoices]=useState<OptionsData|null>(null);
 const [year,setYear]=useState(""),[date,setDate]=useState(""),
  [reason,setReason]=useState(""),[liability,setLiability]=useState(""),
  [reviewPassword,setReviewPassword]=useState("");
 const [refundYear,setRefundYear]=useState(""),[refundDate,setRefundDate]=useState(""),
  [refundBank,setRefundBank]=useState(""),[refundPassword,setRefundPassword]=useState("");
 const [transferReference,setTransferReference]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),
  [notice,setNotice]=useState("");
 const [pending,setPending]=useState<Command|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const [d,o]=await Promise.all([
    request<Detail>(token,"/api/finance-accounting/invoices/"+invoiceRef+"/adjustment"),
    request<OptionsData>(token,"/api/finance-accounting/invoices/"+invoiceRef+"/adjustment-options")
   ]);
   setData(d);setChoices(o);
  }catch(e){setError(problem(e));
   if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();}
 },[token,invoiceRef,onExpired]);
 useEffect(()=>{void refresh();setPending(null);},[refresh]);
 async function execute(c:Command){
  if(busy)return;
  setBusy(true);setError("");setNotice("");setPending(c);
  try{
   const result=await request<{confirmed:boolean;status:string}>(token,c.path,"POST",c.body);
   if(!result.confirmed)throw Error("UNKNOWN");
   setPending(null);setReviewPassword("");setRefundPassword("");
   if(result.status==="CREDIT_NOTE_POSTED")onCredited();
   setNotice(c.label+" recorded: "+result.status.replaceAll("_"," ")+
    ". Bank refund is not verified until original statement review.");
   await refresh();
  }catch(e){setError(problem(e));
   if(e instanceof Error&&e.message==="SESSION_EXPIRED")onExpired();}
  finally{setBusy(false);}
 }
 const base="/api/finance-accounting/invoices/"+invoiceRef+"/";
 return <Card title="Issued invoice credit note & refund">
  <Text style={s.muted}>Do not change an issued invoice. Create a linked credit note;
   collected money must be refunded with a separate approval and real bank evidence.</Text>
  {!!error&&<Text accessibilityRole="alert" style={s.alert}>{error}</Text>}
  {!!notice&&<Text style={s.text}>{notice}</Text>}
  {data?.creditNote?<View style={s.card}>
   <Text style={s.heading}>Credit note {data.creditNote.credit_note_number}</Text>
   <Text style={s.text}>{money(data.creditNote.total_minor)} invoice correction</Text>
   <Text style={s.muted}>Original verified collection: {money(data.creditNote.collected_minor)}</Text>
   {data.replacementInvoice&&<Text style={s.text}>Replacement: {data.replacementInvoice.invoiceNumber} · {data.replacementInvoice.status}</Text>}
   <Action label="View / print protected credit note PDF" secondary disabled={busy}
    onPress={()=>void onPdf(base+"credit-note/pdf")}/>
   {data.refund&&<Text style={s.text}>Refund: {data.refund.status.replaceAll("_"," ")}</Text>}
  </View>:canReview&&choices&&<View style={s.card}>
   <Text style={s.heading}>Correct issued invoice</Text>
   <Options label="Credit note financial year" value={year}
    options={choices.years.map(x=>({ref:x.ref,label:x.name}))} onChange={setYear}/>
   <Field label="Credit date (YYYY-MM-DD)" value={date} onChange={setDate}/>
   <Field label="Business reason" value={reason} onChange={setReason} multiline/>
   <Options label="Refund payable account (only if original payments exist)" value={liability}
    options={[{ref:"",label:"None — invoice has no collected money"},
     ...choices.refundLiabilityAccounts.map(x=>({ref:x.ref,label:x.name}))]}
    onChange={setLiability}/>
   <Field label="Current independent reviewer password" secure
    value={reviewPassword} onChange={setReviewPassword}/>
   <Action label="Post original protected credit note" disabled={busy||!!pending||
    !year||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||reason.trim().length<8||
    reviewPassword.length<8}
    onPress={()=>void execute({path:base+"credit-note",label:"Credit note",
     body:{requestKey:Crypto.randomUUID(),financialYearRef:year,postingDate:date,
      reason,currentPassword:reviewPassword,refundLiabilityAccountRef:liability||null}})}/>
  </View>}
  {data?.creditNote&&BigInt(data.creditNote.collected_minor)>0n&&!data.refund&&canManage&&choices&&
   <View style={s.card}>
    <Text style={s.heading}>Request refund of {money(data.creditNote.collected_minor)}</Text>
    <Options label="Actual Foundation bank" value={refundBank}
     options={choices.banks.map(x=>({ref:x.ref,label:x.name}))} onChange={setRefundBank}/>
    <Options label="Open financial year" value={refundYear}
     options={choices.years.map(x=>({ref:x.ref,label:x.name}))} onChange={setRefundYear}/>
    <Field label="Bank posting date (YYYY-MM-DD)" value={refundDate} onChange={setRefundDate}/>
    <Action label="Submit refund for independent approval" disabled={busy||!!pending||
     !refundBank||!refundYear||!refundDate}
     onPress={()=>void execute({path:base+"refunds",label:"Refund request",
      body:{requestKey:Crypto.randomUUID(),bankAccountRef:refundBank,
       financialYearRef:refundYear,postingDate:refundDate}})}/>
   </View>}
  {data?.refund?.status==="PENDING_APPROVAL"&&canReview&&<View style={s.card}>
   <Text style={s.heading}>Independent refund approval</Text>
   <Text style={s.muted}>The refund requester cannot approve their own bank posting.
    Enter a real completed transfer reference. The statement still needs independent verification.</Text>
   <Field label="Completed bank transfer reference" value={transferReference}
    onChange={setTransferReference}/>
   <Field label="Current reviewer password" secure value={refundPassword}
    onChange={setRefundPassword}/>
   <Action label="Approve and post refund bank journal" disabled={busy||!!pending||
    refundPassword.length<8||
    !/^[A-Za-z0-9._/: -]{4,100}$/.test(transferReference.trim())
    onPress={()=>void execute({path:"/api/finance-accounting/invoices/refunds/"+
     data.refund!.refundRef+"/approve",label:"Refund approval",
     body:{requestKey:Crypto.randomUUID(),currentPassword:refundPassword,
      transferReference:transferReference.trim()}})}/>
  </View>}
  {pending&&<View style={s.card}>
   <Text style={s.muted}>The original write result is uncertain. Retry only this request key.</Text>
   <Action label="Check current status" secondary disabled={busy} onPress={()=>void refresh()}/>
   <Action label="Retry original protected action" disabled={busy}
    onPress={()=>void execute(pending)}/>
  </View>}
  <Action label="Refresh credit / refund status" secondary disabled={busy}
   onPress={()=>void refresh()}/>
 </Card>;
}
