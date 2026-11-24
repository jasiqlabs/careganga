import {matchesPayoutEvidence} from "../../cg-11-payroll-compensation/domain/payout-instruction";
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const payout=/^pout_[A-Za-z0-9]{8,40}$/,fund=/^fa_[A-Za-z0-9]{8,40}$/;
type Config={root:string;bank:string;account:string;reference:string;authorization:string};
export function readbackEnabled(){return process.env.CG09_PAYROLL_RAZORPAYX_READBACK==="1";}
export function payrollReadbackConfig():Config|null{
 if(!readbackEnabled())return null;
 const root=process.env.CG09_PAYROLL_RAZORPAYX_ROOT??"",bank=process.env.CG09_PAYROLL_RAZORPAYX_BANK_REF??"",account=process.env.CG09_PAYROLL_RAZORPAYX_ACCOUNT??"",reference=process.env.CG09_PAYROLL_RAZORPAYX_SECRET_REF??"",id=process.env.CG09_PAYROLL_RAZORPAYX_KEY_ID??"",secret=process.env.CG09_PAYROLL_RAZORPAYX_KEY_SECRET??"";
 if(!uuid.test(root)||!uuid.test(bank)||!/^[A-Za-z0-9]{6,35}$/.test(account)||!/^secretref:[A-Za-z0-9/_-]{10,230}$/.test(reference)||!/^rzp_(live|test)_[A-Za-z0-9]{8,}$/.test(id)||secret.length<16||(process.env.NODE_ENV==="production"&&!id.startsWith("rzp_live_")))return null;
 if(id===process.env.CG07_RAZORPAY_KEY_ID||reference===process.env.CG07_RAZORPAY_SECRET_REF)return null;
 return {root,bank,account,reference,authorization:"Basic "+Buffer.from(id+":"+secret).toString("base64")};
}
const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
async function get(c:Config,path:string):Promise<Record<string,unknown>>{
 const res=await fetch("https://api.razorpay.com/v1/"+path,{method:"GET",headers:{Authorization:c.authorization},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw Error("Payout status unavailable");
 const reader=res.body?.getReader();if(!reader)throw Error("Payout status unavailable");
 const chunks:Uint8Array[]=[];let bytes=0;
 try{for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>262144){await reader.cancel();throw Error("Payout status unavailable");}chunks.push(item.value);}}finally{reader.releaseLock();}
 const value=record(JSON.parse(Buffer.concat(chunks).toString("utf8")));
 if(!value)throw Error("Payout status unavailable");return value;
}
export async function verifyPayrollReadback(reference:string,root:string):Promise<boolean>{
 const c=payrollReadbackConfig();if(!c||reference!==c.reference||root!==c.root)return false;
 try{const data=await get(c,"payouts?"+new URLSearchParams({account_number:c.account,count:"1"}));return data.entity==="collection"&&Array.isArray(data.items)&&data.items.length<=1;}catch{return false;}
}
export type ReadbackState="PROCESSING"|"UNKNOWN_WRITE_STATUS"|"PROCESSED_AWAITING_PROOF"|"FAILED_AWAITING_PROOF"|"REVIEW_REQUIRED";
export type Readback={state:ReadbackState;providerRef:string|null};
export function classifyPayout(status:unknown):ReadbackState{
 if(["queued","pending","processing","initiated"].includes(String(status)))return "PROCESSING";
 if(status==="processed")return "PROCESSED_AWAITING_PROOF";
 if(["failed","rejected","cancelled","reversed"].includes(String(status)))return "FAILED_AWAITING_PROOF";
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
  const p=record(data.items[0]);if(!p||typeof p.id!=="string"||!payout.test(p.id)||input.priorRef&&input.priorRef!==p.id||p.reference_id!==input.id||p.currency!=="INR"||p.purpose!=="salary"||!Number.isSafeInteger(p.amount)||String(p.amount)!==input.amount||typeof p.fund_account_id!=="string"||!fund.test(p.fund_account_id))return {state:"REVIEW_REQUIRED",providerRef:input.priorRef};
  const a=await get(c,"fund_accounts/"+p.fund_account_id),b=record(a.bank_account);
  if(a.id!==p.fund_account_id||a.entity!=="fund_account"||a.account_type!=="bank_account"||!b||!matchesPayoutEvidence(input.root,input.employee,input.fingerprint,{accountHolder:b.name,accountNumber:b.account_number,ifsc:b.ifsc}))return {state:"REVIEW_REQUIRED",providerRef:input.priorRef};
  return {state:classifyPayout(p.status),providerRef:p.id};
 }catch{return unknown;}
}
