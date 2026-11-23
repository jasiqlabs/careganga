import {BadRequestException} from "@nestjs/common";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG=/^cg-camp-[0-9]{8}$/;
const unsafe=/[<>\u0000-\u001f\u007f]/;
const invalid=()=>new BadRequestException({code:"CG07_DONATION_INPUT_INVALID",message:"Check the donation amount and contact details."});
export type DonationIntentInput=Readonly<{
 requestKey:string;campaignSlug:string|null;amountMinor:string;consent:true;
 donor:Readonly<{name:string;mobile:string;email:string;pan:string;address:string;geography:string;remarks:string;recurringIntent:boolean;paymentReferenceNote:string}>;
}>;
export const donationUuid=(x:unknown):string=>{
 if(typeof x!=="string"||!ID.test(x))throw invalid();
 return x.toLowerCase();
};
const text=(v:unknown,max:number)=>{
 if(v===null||v===undefined||v==="")return "";
 if(typeof v!=="string"||v.trim().length>max||unsafe.test(v))throw invalid();
 return v.trim();
};
export function parseDonationIntent(raw:unknown):DonationIntentInput{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw invalid();
 const data=raw as Record<string,unknown>;
 if(Object.keys(data).some(k=>!["requestKey","campaignSlug","amount","consent","donor"].includes(k))||
  data.consent!==true||typeof data.amount!=="string"||
  !/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(data.amount))
  throw invalid();
 const [units,frac=""]=data.amount.split(".");
 const minor=BigInt(units)*100n+BigInt(frac.padEnd(2,"0"));
 if(minor<100n||minor>99999999999999n)throw invalid();
 const campaignSlug=data.campaignSlug===null||data.campaignSlug===undefined||data.campaignSlug===""?
  null:data.campaignSlug;
 if(campaignSlug!==null&&(typeof campaignSlug!=="string"||!SLUG.test(campaignSlug)))throw invalid();
 if(!data.donor||typeof data.donor!=="object"||Array.isArray(data.donor))throw invalid();
 const donor=data.donor as Record<string,unknown>;
 if(Object.keys(donor).some(k=>!["name","mobile","email","pan","address","geography","remarks","recurringIntent","paymentReferenceNote"].includes(k)))throw invalid();
 const name=text(donor.name,120),mobile=text(donor.mobile,20),email=text(donor.email,254).toLowerCase();
 const pan=text(donor.pan,10).toUpperCase(),address=text(donor.address,300);
 const geography=text(donor.geography,100),remarks=text(donor.remarks,300);
 const paymentReferenceNote=text(donor.paymentReferenceNote,100);
 const recurringIntent=donor.recurringIntent===undefined?false:donor.recurringIntent;
 if(typeof recurringIntent!=="boolean")throw invalid();
 // This is an unverified donor note, NEVER an authenticated bank proof.
 if(paymentReferenceNote&&!/^[A-Za-z0-9][A-Za-z0-9 ._\/-]{3,99}$/.test(paymentReferenceNote))throw invalid();
 if(mobile&&!/^[+]?[0-9]{8,15}$/.test(mobile))throw invalid();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw invalid();
 if(pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))throw invalid();
 if(!name&&!mobile&&!email&&!pan&&!address){/* Truly anonymous general donation is supported. */}
 return {requestKey:donationUuid(data.requestKey),campaignSlug,amountMinor:minor.toString(),
  consent:true,donor:{name,mobile,email,pan,address,geography,remarks,recurringIntent,paymentReferenceNote}};
}
