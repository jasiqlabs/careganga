import {BadRequestException} from "@nestjs/common";
export type StaffCandidate={firstName:string;lastName:string;mobile:string;city:string};
const invalid=(message:string):never=>{throw new BadRequestException(message);};
const allowed=new Set(["csv","rows","requestKey"]);
function textValue(value:unknown,min:number,max:number,field:string){
 if(typeof value!=="string"||value.trim().length<min||value.trim().length>max||
  /[\u0000-\u001f\u007f]/.test(value)||/^[=+@-]/.test(value.trim()))
  return invalid("Check the "+field+" in the unverified volunteer intake.");
 return value.trim().replace(/ +/g," ");
}
function normalizedPhone(value:unknown){
 if(typeof value!=="string")return invalid("Enter an Indian mobile number.");
 const v=value.trim().replace(/ /g,"");
 const result=/^[6-9]\d{9}$/.test(v)?"+91"+v:/^\+91[6-9]\d{9}$/.test(v)?v:null;
 if(!result)return invalid("Enter a valid ten-digit Indian mobile number.");
 return result;
}
function candidate(raw:unknown):StaffCandidate{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return invalid("Check the volunteer intake row.");
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["firstName","lastName","mobile","city"].includes(k)))
  return invalid("Only name, mobile and optional city may be imported.");
 return {firstName:textValue(x.firstName,1,100,"first name"),lastName:textValue(x.lastName,1,100,"last name"),
  mobile:normalizedPhone(x.mobile),city:x.city===undefined||x.city===""?"":textValue(x.city,1,120,"city")};
}
/** Parse a strict four-column, quoted RFC4180-style CSV without creating any account or consent. */
function parseCsv(csv:string):StaffCandidate[]{
 if(csv.length>100000||!csv.trim())return invalid("Choose a CSV file under 100 KB with volunteer rows.");
 if(csv.charCodeAt(0)===0xfeff)csv=csv.slice(1); // Excel UTF-8 BOM; content is still fully validated.
 const records:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false;
 for(let i=0;i<csv.length;i++){
  const ch=csv[i];
  if(quoted){
   if(ch==='"'&&csv[i+1]==='"'){cell+='"';i++;}
   else if(ch==='"'){quoted=false;closed=true;}
   else cell+=ch;
  }else if(ch==='"'&&!cell&&!closed){quoted=true;}
  else if(ch===","||ch==="\n"||ch==="\r"){
   row.push(cell);cell="";closed=false;
   if(ch!==","){records.push(row);row=[];if(ch==="\r"&&csv[i+1]==="\n")i++;}
  }else if(ch==='"'||closed)return invalid("Check CSV quotation and column separators.");
  else cell+=ch;
 }
 if(quoted)return invalid("The CSV contains an unfinished quoted field.");
 if(cell||row.length){row.push(cell);records.push(row);}
 if(records[0]?.length!==4||records[0].map(x=>x.trim().toLowerCase()).join(",")!=="first name,last name,mobile,city")
  return invalid("Use the columns: First Name, Last Name, Mobile, City.");
 const data=records.slice(1).filter(r=>r.some(c=>c.trim()));
 if(data.length<1||data.length>200)return invalid("Import between 1 and 200 volunteer drafts per file.");
 return data.map((cells,i)=>{
  if(cells.length!==4)return invalid("Check CSV row "+String(i+2)+": four columns are required.");
  return candidate({firstName:cells[0],lastName:cells[1],mobile:cells[2],city:cells[3]});
 });
}
export function parseVolunteerStaffIntake(raw:unknown):StaffCandidate[]{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return invalid("Check the volunteer intake request.");
 const x=raw as Record<string,unknown>;
 if(Object.keys(x).some(k=>!allowed.has(k)))return invalid("Unrecognized volunteer intake field.");
 if((typeof x.csv==="string")===(Array.isArray(x.rows)))return invalid("Use one CSV or one set of unverified draft rows.");
 const rows=typeof x.csv==="string"?parseCsv(x.csv):
   (x.rows as unknown[]).length>0&&(x.rows as unknown[]).length<=200?
    (x.rows as unknown[]).map(candidate):invalid("Choose between 1 and 200 volunteer drafts.");
 const seen=new Set<string>();
 for(const row of rows){if(seen.has(row.mobile))return invalid("The intake contains a duplicate mobile number.");seen.add(row.mobile);}
 return rows;
}
