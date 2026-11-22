import {int,invalid,object,plain,uuid} from "./tier-input";
export function parseApplicationDraft(raw:unknown,editing:boolean){
 const x=object(raw,["requestKey","expectedVersion","planCode","offerRevision","address","city","pinCode","stateRef","districtRef","branchRef","referral","consent"]);
 if(typeof x.planCode!=="string"||!/^MEM-[0-9A-F]{32}$/.test(x.planCode))return invalid("plan","Select an available membership plan.");
 if(typeof x.pinCode!=="string"||! /^[1-9][0-9]{5}$/.test(x.pinCode.trim()))return invalid("PIN code","Enter a valid six-digit PIN code.");
 if(x.consent!==true)return invalid("consent","Confirm that your information may be used to process this membership application.");
 if(!editing&&x.expectedVersion!==undefined)return invalid("form","Start a new membership application without an existing version.");
 return {key:uuid(x.requestKey),expected:editing?int(x.expectedVersion,1,2147483646,"application revision"):null,planCode:x.planCode,offerRevision:int(x.offerRevision,1,2147483647,"current membership offer"),address:plain(x.address,5,1000,"address"),city:plain(x.city,2,120,"city"),pin:x.pinCode.trim(),state:uuid(x.stateRef),district:uuid(x.districtRef),branch:x.branchRef===undefined||x.branchRef===null||x.branchRef===""?null:uuid(x.branchRef),referral:plain(x.referral??"",0,100,"referral"),consentVersion:"MEMBERSHIP_V1" as const};
}
export function parseDraftCancel(raw:unknown){const x=object(raw,["requestKey","expectedVersion"]);return {key:uuid(x.requestKey),expected:int(x.expectedVersion,1,2147483646,"application revision")};}
