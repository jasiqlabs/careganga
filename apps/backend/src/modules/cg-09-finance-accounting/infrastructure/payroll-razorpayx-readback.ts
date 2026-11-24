import {createHash,createHmac} from "node:crypto";
import {matchesPayoutEvidence} from "../../cg-11-payroll-compensation/domain/payout-instruction";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const payout=/^pout_[A-Za-z0-9]{8,40}$/,fund=/^fa_[A-Za-z0-9]{8,40}$/;
type Config={root:string;bank:string;account:string;reference:string;authorization:string;binding:string};
export function readbackEnabled(){return process.env.CG09_PAYROLL_RAZORPAYX_READBACK==="1";}
export function payrollReadbackConfig():Config|null{
 if(!readbackEnabled())return null;
 const root=process.env.CG09_PAYROLL_RAZORPAYX_ROOT??"",bank=process.env.CG09_PAYROLL_RAZORPAYX_BANK_REF??"",account=process.env.CG09_PAYROLL_RAZORPAYX_ACCOUNT??"",reference=process.env.CG09_PAYROLL_RAZORPAYX_SECRET_REF??"",id=process.env.CG09_PAYROLL_RAZORPAYX_KEY_ID??"",secret=process.env.CG09_PAYROLL_RAZORPAYX_KEY_SECRET??"";
 if(!uuid.test(root)||!uuid.test(bank)||!/^[A-Za-z0-9]{6,35}$/.test(account)||!/^secretref:[A-Za-z0-9/_-]{10,230}$/.test(reference)||!/^rzp_(live|test)_[A-Za-z0-9]{8,}$/.test(id)||secret.length<16||(process.env.NODE_ENV==="production"&&!id.startsWith("rzp_live_")))return null;
 if(id===process.env.CG07_RAZORPAY_KEY_ID||reference===process.env.CG07_RAZORPAY_SECRET_REF)return null;
 return {root,bank,account,reference,binding:createHmac("sha256",secret).update(JSON.stringify(["CG09_PAYROLL_BANK_V1",root,bank,account,reference,id])).digest("hex"),authorization:"Basic "+Buffer.from(id+":"+secret).toString("base64")};
}
const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
async function get(c:Config,path:string):Promise<Record<string,unknown>>{
 const res=await fetch("https://api.razorpay.com/v1/"+path,{method:"GET",headers:{Authorization:c.authorization},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!res.ok){await res.body?.cancel().catch(()=>undefined);throw Error("Payout status unavailable");}
 const reader=res.body?.getReader();if(!reader)throw Error("Payout status unavailable");
 const chunks:Uint8Array[]=[];let bytes=0;
 try{for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>262144){await reader.cancel();throw Error("Payout status unavailable");}chunks.push(item.value);}}finally{reader.releaseLock();}
 const value=record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
 if(!value)throw Error("Payout status unavailable");return value;
}
export async function verifyPayrollReadback(reference:string,root:string):Promise<boolean>{
 const c=payrollReadbackConfig();if(!c||reference!==c.reference||root!==c.root)return false;
 try{const balances=await get(c,"banking_balances?count=100");if(balances.entity!=="collection"||!Array.isArray(balances.items)||balances.items.filter(x=>{const b=record(x);return b?.entity==="banking_balance"&&b.account_number===c.account&&b.currency==="INR";}).length!==1)return false;const data=await get(c,"payouts?"+new URLSearchParams({account_number:c.account,count:"1"}));return data.entity==="collection"&&Array.isArray(data.items)&&data.items.length<=1;}catch{return false;}
}
export type ReadbackState="PROCESSING"|"UNKNOWN_WRITE_STATUS"|"PROCESSED_AWAITING_PROOF"|"FAILED_AWAITING_PROOF"|"REVIEW_REQUIRED";
export type Readback={state:ReadbackState;providerRef:string|null;utrDigest?:string|null};
export function classifyPayout(status:unknown):ReadbackState{
 if(["queued","pending","processing","initiated"].includes(String(status)))return "PROCESSING";
 if(status==="processed")return "PROCESSED_AWAITING_PROOF";
 if(status==="reversed")return "REVIEW_REQUIRED";
 if(["failed","rejected","cancelled"].includes(String(status)))return "FAILED_AWAITING_PROOF";
 return "UNKNOWN_WRITE_STATUS";
}
/** Real authenticated provider GET only. The original attempt UUID is the
 * merchant reference supplied when the authorised bank operator submits the
 * payment externally. A missing/ambiguous result never authorises a retry. */
export async function readOriginalPayout(c:Config,input:{id:string;root:string;employee:string;fingerprint:string;amount:string;priorRef:string|null}):Promise<Readback>{
 const unknown:Readback={state:"UNKNOWN_WRITE_STATUS",providerRef:input.priorRef};
 if(c.root!==input.root||!uuid.test(input.id))return {state:"REVIEW_REQUIRED",providerRef:input.priorRef};
 try{
  const data=await get(c,"payouts?"+new URLSearchParams({account_number:c.account,reference_id:input.id,count:"2"}));
  if(data.entity!=="collection"||!Array.isArray(data.items)||data.items.length===0)return unknown;
  if(data.items.length!==1)return {state:"REVIEW_REQUIRED",providerRef:input.priorRef};
  const p=record(data.items[0]);if(!p||p.entity!=="payout"||(typeof p.debit_account_number==="string"&&p.debit_account_number!==c.account)||typeof p.id!=="string"||!payout.test(p.id)||input.priorRef&&input.priorRef!==p.id||p.reference_id!==input.id||p.currency!=="INR"||p.purpose!=="salary"||!Number.isSafeInteger(p.amount)||String(p.amount)!==input.amount||typeof p.fund_account_id!=="string"||!fund.test(p.fund_account_id))return {state:"REVIEW_REQUIRED",providerRef:input.priorRef};
  const a=await get(c,"fund_accounts/"+p.fund_account_id),b=record(a.bank_account);
  if(a.id!==p.fund_account_id||a.entity!=="fund_account"||a.account_type!=="bank_account"||!b||!matchesPayoutEvidence(input.root,input.employee,input.fingerprint,{accountHolder:b.name,accountNumber:b.account_number,ifsc:b.ifsc}))return {state:"REVIEW_REQUIRED",providerRef:input.priorRef};
  const state=classifyPayout(p.status);
  // Reversed payments can have moved funds; never label them a failed/no-money transfer.
  if(state==="REVIEW_REQUIRED")return {state,providerRef:p.id};
  if(state==="PROCESSED_AWAITING_PROOF"){
   if(typeof p.utr!=="string"||!/^[A-Za-z0-9 /._-]{6,64}$/.test(p.utr.trim()))return {state:"PROCESSING",providerRef:p.id};
   return {state,providerRef:p.id,utrDigest:createHash("sha256").update(input.id+":"+p.utr.trim().toUpperCase()).digest("hex")};
  }
  return {state,providerRef:p.id};
 }catch{return unknown;}
}

export function dispatchEnabled(){return readbackEnabled()&&process.env.CG09_PAYROLL_RAZORPAYX_DISPATCH==="1"&&process.env.CG09_PAYROLL_RAZORPAYX_SIGNING_APPROVED==="1";}
export type Dispatch={id:string;employee:string;amount:string;destination:{holder:string;account:string;ifsc:string}};
/** Query the actual selected merchant bank's current withdrawable funds. No
 * balance or credential is returned to the browser. Reject missing/stale balance. */
export async function checkDispatchBalance(c:Config,amount:string):Promise<boolean>{
 const fee=process.env.CG09_PAYROLL_RAZORPAYX_FEE_RESERVE_MINOR??"";
 if(!/^[0-9]{1,8}$/.test(fee)||!/^([1-9][0-9]{0,13})$/.test(amount))return false;
 try{const data=await get(c,"banking_balances?count=100");if(data.entity!=="collection"||!Array.isArray(data.items)||data.items.length>100)return false;
 const matches=data.items.map(record).filter(b=>b?.entity==="banking_balance"&&b.account_number===c.account&&b.currency==="INR");
 if(matches.length!==1)return false;
 const b=matches[0]!;
 return typeof b.available_amount==="number"&&Number.isSafeInteger(b.available_amount)&&typeof b.refreshed_at==="number"&&Number.isSafeInteger(b.refreshed_at)&&b.refreshed_at<=Date.now()/1000+60&&Date.now()/1000-b.refreshed_at<=300&&BigInt(b.available_amount)>=BigInt(amount)+BigInt(fee);
 }catch{return false;}
}
/** Sole write call. Same immutable attempt key is both merchant reference
 * and documented X-Payout-Idempotency. No automated repeat POST; exact GET
 * readback handles uncertain response and the service never claims payment. */
export async function sendApprovedPayout(c:Config,x:Dispatch):Promise<void>{
 if(!dispatchEnabled()||!uuid.test(x.id)||!uuid.test(x.employee)||!/^([1-9][0-9]{0,13})$/.test(x.amount)||BigInt(x.amount)<100n||x.destination.holder.length<4||x.destination.holder.length>50)throw Error("Approved payout unavailable");
 const response=await fetch("https://api.razorpay.com/v1/payouts",{method:"POST",headers:{Authorization:c.authorization,"Content-Type":"application/json","X-Payout-Idempotency":x.id},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),body:JSON.stringify({account_number:c.account,amount:Number(x.amount),currency:"INR",mode:"NEFT",purpose:"salary",fund_account:{account_type:"bank_account",bank_account:{name:x.destination.holder,ifsc:x.destination.ifsc,account_number:x.destination.account},contact:{name:x.destination.holder,type:"employee",reference_id:x.employee}},queue_if_low_balance:false,reference_id:x.id,narration:"CareGanga Salary"})});
 // Do not trust or log a create response, including errors containing bank data.
 await response.body?.cancel().catch(()=>undefined);
}
