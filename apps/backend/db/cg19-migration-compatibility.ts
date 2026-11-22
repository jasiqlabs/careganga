import {createHash} from "node:crypto";

/**
 * Exact historical CG19 migration composition. The finance branch extended
 * 0206/0903/0911/0926; health migrations were independently authored against
 * the pre-finance names. Never change the original ledger SHA256 or skip any
 * original DDL. Compose only these pinned original blobs inside their normal
 * SQL transaction and preserve both owners' restrictive predicates.
 */
const pinned:Readonly<Record<string,string>>={
  "1402_cg19_health_draft_evidence.sql": "19437492ececf86966705f64b62e12548a0c585a",
  "1407_cg19_doctor_original_private_license.sql": "a3f145e2034d6746f96be09d596225f86114f5aa",
  "1411_cg19_doctor_private_portrait_source.sql": "d3c4cf52fa93709e7f0e55db54006445ce43af97",
  "1415_cg19_original_center_content_media_and_rights.sql": "c6b8329c7ee250d9c519e72056cb428a68378b96",
  "1417_cg19_center_support_original_attachments.sql": "7b38da02c3f994af981449730faa11a63b8ddb9f"
};
const legacyOwner="owner_kind IN('CG03_CASE','CG02_DRAFT','CG02_BRANCH','CG09_VOUCHER','CG09_PAYMENT','CG09_CLAIM','CG09_BANK_STATEMENT')";
const legacySource="(owner_kind='CG03_CASE' AND case_id IS NOT NULL AND\n   num_nonnulls(registration_id,registration_draft_version,branch_id,branch_version,\n    voucher_id,voucher_version,claim_id,claim_version,reconciliation_id)=0)\n  OR (owner_kind='CG02_DRAFT' AND registration_id IS NOT NULL AND\n   registration_draft_version>0 AND proposal_revision=registration_draft_version AND\n   num_nonnulls(case_id,branch_id,branch_version,voucher_id,voucher_version,\n    claim_id,claim_version,reconciliation_id)=0)\n  OR (owner_kind='CG02_BRANCH' AND branch_id IS NOT NULL AND branch_version>0 AND\n   proposal_revision=branch_version AND\n   num_nonnulls(case_id,registration_id,registration_draft_version,voucher_id,voucher_version,\n    claim_id,claim_version,reconciliation_id)=0)\n  OR (owner_kind IN('CG09_VOUCHER','CG09_PAYMENT') AND voucher_id IS NOT NULL AND\n   voucher_version>0 AND proposal_revision=voucher_version AND\n   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,\n    claim_id,claim_version,reconciliation_id)=0)\n  OR (owner_kind='CG09_CLAIM' AND claim_id IS NOT NULL AND claim_version>0 AND\n   proposal_revision=claim_version AND\n   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,\n    voucher_id,voucher_version,reconciliation_id)=0)\n  OR (owner_kind='CG09_BANK_STATEMENT' AND reconciliation_id IS NOT NULL AND\n   proposal_revision=1 AND\n   num_nonnulls(case_id,registration_id,registration_draft_version,branch_id,branch_version,\n    voucher_id,voucher_version,claim_id,claim_version)=0)";
const legacyClassification="(owner_kind='CG03_CASE' AND classification IN('PRIVATE_CASE_EVIDENCE','PRIVATE_CASE_ARCHIVE'))\n  OR (owner_kind IN('CG02_DRAFT','CG02_BRANCH') AND classification IN\n   ('BRANCH_PHOTO','BRANCH_LOGO','REGISTRATION_PROOF','AGREEMENT'))\n  OR (owner_kind='CG09_VOUCHER' AND classification='FINANCE_VOUCHER_PROOF')\n  OR (owner_kind='CG09_PAYMENT' AND classification='FINANCE_PAYMENT_PROOF')\n  OR (owner_kind='CG09_CLAIM' AND classification='FINANCE_CLAIM_BILL')\n  OR (owner_kind='CG09_BANK_STATEMENT' AND classification='FINANCE_BANK_STATEMENT')";
const financeColumns="branch_id,branch_version,voucher_id,voucher_version,claim_id,claim_version,reconciliation_id";
const names=[
 "cg19_upload_intent_owner_kind_check","cg19_stored_file_owner_kind_check",
 "cg19_intent_branch_source","cg19_file_branch_source",
 "cg19_intent_source_classification","cg19_doc_event_source"
] as const;
const oldNames=[
 "cg19_intent_owner_kind_voucher","cg19_file_owner_kind_voucher",
 "cg19_intent_one_source_voucher","cg19_file_one_source_voucher",
 "cg19_intent_voucher_classification","cg19_doc_event_three_sources"
] as const;

function replaceCheck(sql:string,name:string,compose:(value:string)=>string):string {
 const re=new RegExp("ADD CONSTRAINT "+name+"\\s+CHECK\\s*\\(","g");
 const hits=Array.from(sql.matchAll(re));
 if(hits.length!==1)throw new Error("Expected exactly one original CG19 check: "+name);
 const start=hits[0].index!+hits[0][0].length;
 let depth=1,quoted=false;
 for(let i=start;i<sql.length;i++){
  const c=sql[i];
  if(c==="'"){if(quoted&&sql[i+1]==="'"){i++;continue;}quoted=!quoted;}
  else if(!quoted){
   if(c==="(")depth++;
   else if(c===")"&&--depth===0)return sql.slice(0,start)+compose(sql.slice(start,i))+sql.slice(i);
  }
 }
 throw new Error("Unterminated original CG19 check: "+name);
}
export function composeCg19HistoricalMigration(filename:string,sql:string):string{
 const expected=pinned[filename];
 if(!expected)return sql;
 const blob=createHash("sha1").update("blob "+Buffer.byteLength(sql,"utf8")+"\0").update(sql,"utf8").digest("hex");
 if(blob!==expected)throw new Error("Reviewed CG19 migration bytes changed: "+filename);
 const first=filename.startsWith("1402_"),portrait=filename.startsWith("1411_"),event=first||filename.startsWith("1407_");
 const healthColumns=["health_provider_id","health_center_id","health_source_version"];
 if(!first)healthColumns.push("health_doctor_id");
 if(filename.startsWith("1417_"))healthColumns.push("support_case_id");
 if(first){
  // The actual preceding finance migration (0926) owns these names.
  for(let i=0;i<names.length;i++){
   const from="DROP CONSTRAINT "+names[i];
   if(sql.split(from).length!==2)throw new Error("Expected original CG19 drop: "+names[i]);
   sql=sql.replace(from,"DROP CONSTRAINT "+oldNames[i]);
  }
 }
 if(!portrait){
  for(const name of names.slice(0,2))sql=replaceCheck(sql,name,value=>"("+legacyOwner+") OR ("+value+")");
  for(const name of names.slice(2,4))sql=replaceCheck(sql,name,value=>
   "(("+legacySource+") AND num_nonnulls("+healthColumns.join(",")+")=0) OR (NOT ("+legacyOwner+") AND ("+value+") AND num_nonnulls("+financeColumns+")=0)");
 }
 sql=replaceCheck(sql,names[4],value=>"("+legacyClassification+") OR (NOT ("+legacyOwner+") AND ("+value+"))");
 if(event)sql=replaceCheck(sql,names[5],()=>"num_nonnulls(case_id,registration_id,branch_id,voucher_id,claim_id,reconciliation_id,health_provider_id"+(first?"":",health_doctor_id")+")=1");
 return sql;
}
