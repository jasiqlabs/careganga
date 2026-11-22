import {BadRequestException} from "@nestjs/common";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BAD=/[<>\u0000-\u001f\u007f]/;
const fail=(message:string):never=>{throw new BadRequestException({code:"CG07_CAMPAIGN_DRAFT_INVALID",message});};
export function campaignRef(value:unknown):string{
 if(typeof value!=="string"||!UUID.test(value))return fail("Choose a valid current campaign.");
 return value.toLowerCase();
}
const optionalRef=(value:unknown)=>value===null||value===undefined||value===""?null:campaignRef(value);
const fields=(v:unknown,allowed:readonly string[],label:string)=>{
 if(!v||typeof v!=="object"||Array.isArray(v))return fail("Check "+label+" before saving.");
 const r=v as Record<string,unknown>;
 if(Object.keys(r).some(k=>!allowed.includes(k)))return fail("Unsupported "+label+" field. Refresh this form.");
 return r;
};
const txt=(v:unknown,name:string,min:number,max:number)=>{
 if(typeof v!=="string"||v.trim().length<min||v.trim().length>max||BAD.test(v))return fail("Check the campaign "+name+".");
 return v.trim().replace(/ +/g," ");
};
const optionalText=(v:unknown,name:string,max:number)=>v===null||v===undefined||v===""?"":txt(v,name,1,max);
function day(v:unknown,label:string):string|null{
 if(v===null||v===undefined||v==="")return null;
 if(typeof v!=="string"||!/^20\d\d-\d\d-\d\d$/.test(v)||Number.isNaN(Date.parse(v))||
  new Date(v).toISOString().slice(0,10)!==v)return fail("Choose a valid "+label+" date.");
 return v;
}
function money(v:unknown,name:string):string|null{
 if(v===null||v===undefined||v==="")return null;
 if(typeof v!=="string"||!/^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$/.test(v))
  return fail("Enter "+name+" as a non-negative rupee amount with up to two decimal places.");
 const [units,decimal=""]=v.split(".");
 const minor=BigInt(units)*100n+BigInt(decimal.padEnd(2,"0"));
 if(minor<1n||minor>99999999999999n)return fail("Enter a positive, permitted "+name+".");
 return minor.toString();
}
export type CampaignDraft={
 key:string;expected:number|null;
 basic:{title:string;type:"GENERAL";summary:string;description:string;tags:string[]};
 project:{category:string;branchRef:string|null;projectRef:string|null;eventRef:string|null;
  stateRef:string|null;districtRef:string|null;location:string;targetGroup:string;plannedBeneficiaries:number|null};
 team:{coordinatorRef:string|null;volunteerRef:string|null};
 budget:{goalMinor:string|null;expectedCostMinor:string|null;startAt:string|null;endAt:string|null};
 media:{fileRef:string|null;alt:string};
 review:Record<string,never>;
};
export function parseCampaignDraft(raw:unknown,editing=false):CampaignDraft{
 const input=fields(raw,["requestKey",...(editing?["expectedVersion"]:[]),"steps"],"campaign request");
 const steps=fields(input.steps,["basic","project","team","budget","media","review"],"six-step campaign");
 const basic=fields(steps.basic,["title","type","summary","description","tags"],"basic details");
 const project=fields(steps.project??{},["category","branchRef","projectRef","eventRef","stateRef","districtRef",
  "location","targetGroup","plannedBeneficiaries"],"project and category");
 const team=fields(steps.team??{},["coordinatorRef","volunteerRef"],"team assignment");
 const budget=fields(steps.budget??{},["goal","expectedCost","startAt","endAt"],"budget and targets");
 const media=fields(steps.media??{},["fileRef","alt"],"documents and media");
 fields(steps.review??{},[],"review and submission");
 const rawTags=basic.tags??[];
 if(!Array.isArray(rawTags)||rawTags.length>12)return fail("Use up to 12 short campaign tags.");
 const tags=rawTags.map(v=>txt(v,"tag",1,32));
 if(new Set(tags.map(x=>x.toLowerCase())).size!==tags.length)return fail("Remove duplicate campaign tags.");
 if(basic.type!==undefined&&basic.type!=="GENERAL")return fail("Only the verified general campaign draft is currently available.");
 const estimate=project.plannedBeneficiaries;
 if(estimate!==undefined&&estimate!==null&&estimate!==""&&(!Number.isSafeInteger(estimate)||Number(estimate)<0||Number(estimate)>10000000))
  return fail("Enter a valid planned beneficiary estimate.");
 const start=day(budget.startAt,"start"),end=day(budget.endAt,"end");
 if(start&&end&&start>end)return fail("Campaign end date must not precede its start date.");
 const version=input.expectedVersion;
 if(editing&&(!Number.isSafeInteger(version)||Number(version)<1))return fail("Refresh the campaign before saving.");
 if(!editing&&version!==undefined)return fail("This campaign draft already exists. Refresh the list.");
 return {
  key:campaignRef(input.requestKey),expected:editing?Number(version):null,
  basic:{title:txt(basic.title,"title",2,160),type:"GENERAL",
   summary:optionalText(basic.summary,"summary",500),description:optionalText(basic.description,"description",4000),tags},
  project:{category:optionalText(project.category,"category",80)||"GENERAL",
   branchRef:optionalRef(project.branchRef),projectRef:optionalRef(project.projectRef),eventRef:optionalRef(project.eventRef),
   stateRef:optionalRef(project.stateRef),districtRef:optionalRef(project.districtRef),
   location:optionalText(project.location,"location",250),targetGroup:optionalText(project.targetGroup,"target group",160),
   plannedBeneficiaries:estimate===undefined||estimate===null||estimate===""?null:Number(estimate)},
  team:{coordinatorRef:optionalRef(team.coordinatorRef),volunteerRef:optionalRef(team.volunteerRef)},
  budget:{goalMinor:money(budget.goal,"fundraising goal"),expectedCostMinor:money(budget.expectedCost,"expected cost"),startAt:start,endAt:end},
  media:{fileRef:optionalRef(media.fileRef),alt:optionalText(media.alt,"media description",240)},
  review:{}
 };
}
