import {BadRequestException} from "@nestjs/common";
import {fields,ref,revision,text,option,optionalRef} from "./beneficiary-input";
import {inventoryDate,inventoryQuantity} from "../../cg-12-inventory-suppliers/application/inventory-receipt-draft-source";
const invalid=()=>new BadRequestException({code:"CG06_INVALID_INPUT"});
export function moneyMinor(v:unknown){
 if(typeof v!=="string"||!/^[1-9][0-9]{0,13}$/.test(v))throw invalid();
 return v;
}
export function parseAssistance(raw:unknown){
 const x=fields(raw,["requestKey","beneficiaryRef","expectedRevision","category","kind","itemRef","locationRef","quantity","amountMinor","requestedOn","responsibleRef","projectRef","activityRef","visitRef","campaignRef"]);
 const kind=option(x.kind,["MATERIAL","FINANCIAL"] as const),item=optionalRef(x.itemRef),location=optionalRef(x.locationRef);
 if(kind==="MATERIAL"?(!item||!location||x.amountMinor!=null):(item!==null||location!==null||x.quantity!=null))throw invalid();
 const project=optionalRef(x.projectRef),activity=optionalRef(x.activityRef),visit=optionalRef(x.visitRef),campaign=optionalRef(x.campaignRef);
 if((activity||visit)&&!project)throw invalid();
 return {key:ref(x.requestKey),beneficiary:ref(x.beneficiaryRef),expected:revision(x.expectedRevision),category:text(x.category,2,60),kind,item,location,
 quantity:kind==="MATERIAL"?inventoryQuantity(x.quantity):null,minor:kind==="FINANCIAL"?moneyMinor(x.amountMinor):null,
 date:inventoryDate(x.requestedOn),responsible:optionalRef(x.responsibleRef),project,activity,visit,campaign};
}
