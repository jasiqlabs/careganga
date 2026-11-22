import {BadRequestException} from "@nestjs/common";
import {choice,clean,fields,optionalRef,ref,version} from "./project-input";
import {instant} from "./activity-input";
export const visitStatuses=["DRAFT","PLANNED","IN_PROGRESS","PENDING_PROOF","PENDING_APPROVAL","RETURNED","REJECTED","COMPLETED","CANCELLED"] as const;
export type VisitStatus=typeof visitStatuses[number];
export const visitProvenance=["DEVICE_GPS","MANUAL_ENTERED","UNAVAILABLE","REJECTED"] as const;
export type VisitProvenance=typeof visitProvenance[number];
export const visitConsents=["GRANTED","DENIED","NOT_REQUESTED","MANUAL_DECLARED"] as const;
export type VisitConsent=typeof visitConsents[number];
const workKeys=["projectRef","taskRef","actorRef","stateRef","districtRef","visitType","location","plannedAt","purpose","report"] as const;
const visitLabels:Record<string,string>={projectRef:"project",taskRef:"task",actorRef:"assigned staff",stateRef:"state",districtRef:"district",visitType:"visit type",location:"visit location",plannedAt:"planned date and time",purpose:"purpose",report:"visit report",status:"status",reason:"cancellation reason",comment:"comment",latitude:"latitude",longitude:"longitude",accuracyM:"location accuracy",deviceRecordedAt:"capture time"};
export function visitError(field:string,code="CG05_VISIT_FIELD_INVALID"){
 const messages:Record<string,string>={CG05_VISIT_REPORT_ONLY:"After check-in, only the report may be edited. The original visit plan and assigned staff are preserved.",CG05_VISIT_COORDINATES_INVALID:"Check the latitude, longitude and location accuracy.",CG05_VISIT_CONSENT_REQUIRED:"Confirm location consent or choose manual or unverified location.",CG05_VISIT_CAPTURE_STALE:"Capture the current location again. The recorded device time is stale or out of order.",CG05_ACTIVITY_GEOGRAPHY_INVALID:"Choose a state before choosing its district."};
 return new BadRequestException({code,field,message:messages[code]??"Check the "+(visitLabels[field]??"visit details")+" and try again."});
}
function checked<T>(field:string,fn:()=>T):T{try{return fn();}catch(e){if(e instanceof BadRequestException)throw visitError(field);throw e;}}
function work(x:Record<string,unknown>){
 const state=checked("stateRef",()=>optionalRef(x.stateRef)),district=checked("districtRef",()=>optionalRef(x.districtRef));
 if(district&&!state)throw visitError("stateRef","CG05_ACTIVITY_GEOGRAPHY_INVALID");
 return {project:checked("projectRef",()=>ref(x.projectRef)),task:checked("taskRef",()=>optionalRef(x.taskRef)),actor:checked("actorRef",()=>ref(x.actorRef)),state,district,
  kind:checked("visitType",()=>clean(x.visitType,1,80)),location:checked("location",()=>clean(x.location,2,250)),planned:checked("plannedAt",()=>instant(x.plannedAt)),purpose:checked("purpose",()=>clean(x.purpose,2,500)),report:checked("report",()=>clean(x.report??"",0,4000))};
}
export function parseVisitCreate(raw:unknown){const x=fields(raw,["requestKey",...workKeys,"status"]);return {key:ref(x.requestKey),...work(x),status:checked("status",()=>choice(x.status,["DRAFT","PLANNED"] as const))};}
export function parseVisitEdit(raw:unknown){const x=fields(raw,["requestKey","expectedVersion",...workKeys]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),...work(x)};}
function bounded(v:unknown,field:string,min:number,max:number){if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)throw visitError(field,"CG05_VISIT_COORDINATES_INVALID");return v;}
function absent(v:unknown){return v===null||v===undefined;}
/** Parse shape separately from freshness so a lost-response retry can resolve
 * the original event even after the original device timestamp grows stale. */
export function parseVisitCapture(raw:unknown){
 const x=fields(raw,["requestKey","expectedVersion","locationProvenance","consentState","latitude","longitude","accuracyM","deviceRecordedAt"]);
 const key=ref(x.requestKey),expected=version(x.expectedVersion);
 const provenance=checked("locationProvenance",()=>choice(x.locationProvenance,visitProvenance)),consent=checked("consentState",()=>choice(x.consentState,visitConsents));
 let latitude:number|null=null,longitude:number|null=null,accuracy:number|null=null,deviceAt:string|null=null;
 if(provenance==="DEVICE_GPS"){
  if(consent!=="GRANTED")throw visitError("consentState","CG05_VISIT_CONSENT_REQUIRED");
  latitude=bounded(x.latitude,"latitude",-90,90);longitude=bounded(x.longitude,"longitude",-180,180);accuracy=bounded(x.accuracyM,"accuracyM",0.1,1000);
  try{deviceAt=instant(x.deviceRecordedAt);}catch(e){if(e instanceof BadRequestException)throw visitError("deviceRecordedAt","CG05_VISIT_CAPTURE_STALE");throw e;}
 }else if(provenance==="MANUAL_ENTERED"){
  if(consent!=="MANUAL_DECLARED")throw visitError("consentState","CG05_VISIT_CONSENT_REQUIRED");
  latitude=bounded(x.latitude,"latitude",-90,90);longitude=bounded(x.longitude,"longitude",-180,180);
  if(!absent(x.accuracyM)||!absent(x.deviceRecordedAt))throw visitError("locationProvenance","CG05_VISIT_COORDINATES_INVALID");
 }else{
  if(consent==="MANUAL_DECLARED"||![x.latitude,x.longitude,x.accuracyM,x.deviceRecordedAt].every(absent))throw visitError("locationProvenance","CG05_VISIT_COORDINATES_INVALID");
 }
 return {key,expected,provenance,consent,latitude,longitude,accuracy,deviceAt};
}
export function validateVisitCaptureTime(input:ReturnType<typeof parseVisitCapture>,serverRecordedAt:Date,previousDeviceAt:Date|null){
 if(input.provenance!=="DEVICE_GPS"||!input.deviceAt)return;
 const time=Date.parse(input.deviceAt),now=serverRecordedAt.valueOf();
 if(time<now-300000||time>now+60000||previousDeviceAt&&time<previousDeviceAt.valueOf())throw visitError("deviceRecordedAt","CG05_VISIT_CAPTURE_STALE");
}
export function parseVisitReview(raw:unknown){const x=fields(raw,["requestKey","expectedVersion"]);return {key:ref(x.requestKey),expected:version(x.expectedVersion)};}
export function parseVisitCancel(raw:unknown){const x=fields(raw,["requestKey","expectedVersion","reason"]);return {key:ref(x.requestKey),expected:version(x.expectedVersion),reason:checked("reason",()=>clean(x.reason,3,500))};}
export function parseVisitComment(raw:unknown){const x=fields(raw,["requestKey","comment"]);return {key:ref(x.requestKey),body:checked("comment",()=>clean(x.comment,1,2000))};}
