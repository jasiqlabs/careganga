import {BadRequestException} from "@nestjs/common";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type FundingKind="FOUNDATION"|"CSR_PARTNER"|"MIXED";
export type FundingProposalInput=Readonly<{
 requestKey:string;expectedVersion:number|null;branchRef:string|null;
 partnerRef:string|null;projectRef:string|null;projectVersion:number|null;
 purpose:string;fundType:FundingKind;amountMinor:string;
 csrShareBps:number;foundationShareBps:number;
 proposedFrom:string|null;proposedUntil:string|null;agreementSummary:string;
 csrRequestedMinor:string;foundationRequestedMinor:string;
}>;
const invalid=(message:string):never=>{throw new BadRequestException(message);};
const ref=(v:unknown,required=false):string|null=>{
 if(v===null||v===undefined||v===""){if(required)invalid("Choose a current CSR source.");return null;}
 if(typeof v!=="string"||!UUID.test(v))invalid("Choose a valid current project, partner or request.");
 return (v as string).toLowerCase();
};
function safeText(value:unknown,name:string,min:number,max:number){
 if(typeof value!=="string"||value.trim().length<min||value.length>max||
  /[<>\u0000-\u001f\u007f]/.test(value))invalid("Check "+name+".");
 return (value as string).trim();
}
function isoDate(value:unknown,name:string):string|null{
 if(value===null||value===undefined||value==="")return null;
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))invalid("Choose a real "+name+".");
 const date=new Date(value+"T00:00:00Z");
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)
  invalid("Choose a real "+name+".");
 return value;
}
function integer(v:unknown,min:number,max:number,name:string):number{
 if(typeof v!=="number"||!Number.isSafeInteger(v)||v<min||v>max)
  invalid("Check "+name+".");
 return v;
}
export function parseFundingProposal(raw:unknown):FundingProposalInput{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  invalid("Complete the CSR funding proposal form.");
 const v=raw as Record<string,unknown>;
 const allow=["requestKey","expectedVersion","branchRef","partnerRef","projectRef",
  "projectVersion","purpose","fundType","amountMinor","csrShareBps",
  "foundationShareBps","proposedFrom","proposedUntil","agreementSummary"];
 if(Object.keys(v).some(k=>!allow.includes(k)))
  invalid("This CSR proposal field is unavailable.");
 const requestKey=ref(v.requestKey,true)!;
 const expectedVersion=v.expectedVersion===undefined||v.expectedVersion===null?
  null:integer(v.expectedVersion,1,2147483646,"source revision");
 const branchRef=ref(v.branchRef),partnerRef=ref(v.partnerRef),projectRef=ref(v.projectRef);
 const projectVersion=v.projectVersion===undefined||v.projectVersion===null?
  null:integer(v.projectVersion,1,2147483646,"project version");
 if(Boolean(projectRef)!==Boolean(projectVersion))
  invalid("Refresh the currently eligible project selection.");
 const fundType=v.fundType;
 if(!["FOUNDATION","CSR_PARTNER","MIXED"].includes(String(fundType)))
  invalid("Select Foundation, CSR or shared funding.");
 const csrShareBps=integer(v.csrShareBps,0,10000,"CSR funding percentage"),
  foundationShareBps=integer(v.foundationShareBps,0,10000,"Foundation funding percentage");
 if(csrShareBps+foundationShareBps!==10000)invalid("Funding shares must total exactly 100%.");
 if(fundType==="FOUNDATION"&&(partnerRef!==null||csrShareBps!==0)||
    fundType==="CSR_PARTNER"&&(!partnerRef||csrShareBps!==10000)||
    fundType==="MIXED"&&(!partnerRef||csrShareBps<=0||csrShareBps>=10000))
  invalid("Funding type and approved CSR sponsor shares must agree.");
 const amountMinor=v.amountMinor;
 if(typeof amountMinor!=="string"||!/^[1-9][0-9]{0,14}$/.test(amountMinor)||
  BigInt(amountMinor)>999999999999999n)
  invalid("Enter a positive INR proposal amount in paise.");
 const proposedFrom=isoDate(v.proposedFrom,"start date"),
  proposedUntil=isoDate(v.proposedUntil,"end date");
 if(proposedFrom&&proposedUntil&&proposedFrom>proposedUntil)
  invalid("Funding end date must not precede its start.");
 const csrRequestedMinor=(BigInt(amountMinor)*BigInt(csrShareBps)/10000n).toString();
 const foundationRequestedMinor=(BigInt(amountMinor)-BigInt(csrRequestedMinor)).toString();
 return {requestKey,expectedVersion,branchRef,partnerRef,projectRef,projectVersion,
  purpose:safeText(v.purpose,"purpose",10,500),fundType:fundType as FundingKind,
  amountMinor,csrShareBps,foundationShareBps,proposedFrom,proposedUntil,
  agreementSummary:safeText(v.agreementSummary??"","agreement summary",0,1000),
  csrRequestedMinor,foundationRequestedMinor};
}
