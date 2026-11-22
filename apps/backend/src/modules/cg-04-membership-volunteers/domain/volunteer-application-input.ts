import {invalid,int,object,pick,plain,uuid} from "./tier-input";
export const volunteerAvailabilities=["FULL_TIME","PART_TIME","WEEKENDS","FLEXIBLE"] as const;
export const volunteerBloodGroups=["A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;
/** Existing U15-U17 original form only. Applicant identity/contact is CG01-derived. */
export function parseVolunteerDraft(raw:unknown,editing=false){
 const x=object(raw,["requestKey","expectedVersion","firstName","lastName","dateOfBirth","gender","bloodGroup",
  "address","city","village","pinCode","stateRef","districtRef","branchRef","departmentRef",
  "availability","skills","experience","referral","consent"]);
 const date=x.dateOfBirth;
 if(typeof date!=="string"||!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)||
    Number.isNaN(Date.parse(date+"T00:00:00Z"))||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date||
    date>new Date().toISOString().slice(0,10))
  return invalid("dateOfBirth","Enter your valid date of birth.");
 if(x.consent!==true)return invalid("consent","Confirm the original volunteer application consent before saving.");
 if(!Array.isArray(x.skills)||x.skills.length>20)return invalid("skills","Choose no more than 20 current volunteer skills.");
 const skills=x.skills.map(v=>plain(v,1,100,"skill").replace(/\s+/gu," "));
 if(new Set(skills.map(v=>v.toLowerCase())).size!==skills.length)return invalid("skills","Remove duplicate skills.");
 const blood=x.bloodGroup===undefined||x.bloodGroup===null||x.bloodGroup===""?null:
  pick(x.bloodGroup,volunteerBloodGroups,"optional blood group");
 return {
  key:uuid(x.requestKey),expected:editing?int(x.expectedVersion,1,2147483646,"application revision"):null,
  first:plain(x.firstName,1,100,"first name"),last:plain(x.lastName,1,100,"last name"),
  dob:date,gender:plain(x.gender,2,40,"gender"),blood, address:plain(x.address,5,1000,"address"),
  city:plain(x.city,2,120,"city"),village:plain(x.village??"",0,120,"village"),
  pin:(typeof x.pinCode==="string"&&/^[1-9][0-9]{5}$/.test(x.pinCode))?x.pinCode:invalid("pinCode","Enter a six-digit Indian PIN."),
  state:uuid(x.stateRef),district:uuid(x.districtRef),
  branch:x.branchRef===undefined||x.branchRef===null||x.branchRef===""?null:uuid(x.branchRef),
  department:uuid(x.departmentRef),
  availability:pick(x.availability,volunteerAvailabilities,"availability"),
  skills,experience:plain(x.experience??"",0,1000,"experience"),referral:plain(x.referral??"",0,100,"referral"),
  consentVersion:"VOLUNTEER_V1" as const
 };
}
export function parseVolunteerCancel(raw:unknown){
 const x=object(raw,["requestKey","expectedVersion"]);
 return {key:uuid(x.requestKey),expected:int(x.expectedVersion,1,2147483646,"application revision")};
}
