"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CenterEditor,type CenterDraft} from "./center-editor";
import {HealthEvidenceUploader} from "./health-evidence-uploader";
import {CenterDoctorFees} from "./center-doctor-fees";
import {CenterLabPricingPanel} from "../diagnostics/center-lab-pricing-panel";
import {LabEquipmentWorkspace} from "../diagnostics/lab-equipment-workspace";
import {CenterMerchantBinding} from "../healthcare-assistance/center-merchant-binding";
import {CenterMonthlySettlementSummary} from "../healthcare-assistance/center-monthly-settlement-summary";
import {CenterSupportDesk} from "./center-support-desk";
import {CenterContentEditor} from "./center-content-editor";
import {PartnerPublicOffersWorkspace} from "./partner-public-offers-workspace";
import {CenterErpCapabilityPanel} from "./center-erp-capability-panel";
import {DoctorScheduleWorkspace} from "../appointments/doctor-schedule-workspace";
import {CenterPatientIntakePanel} from "../patients/center-patient-intake-panel";
import {CenterAssistedConsultationBooking}
 from "../appointments/center-assisted-consultation-booking";

type Row={centerRef:string;name:string;providerName:string;version:number;status:string};
type Detail={centerRef:string;providerRef:string;version:number;center:CenterDraft;status:string;
 providerStatus:string;accessState:string;publicationState:string;publicSlug:string|null};
async function get<T>(path:string):Promise<T>{
  const r=await fetch("/api/health-network/"+path,{cache:"no-store",credentials:"same-origin"});
  const result:unknown=await r.json().catch(()=>null);
  if(!r.ok)throw Error(result&&typeof result==="object"&&"message" in result&&
    typeof result.message==="string"?result.message:"Pending center unavailable");
  return result as T;
}
export function CenterDraftPortal({canViewLabPricing=false,canManageLabPricing=false,
 canViewLabEquipment=false,canManageLabEquipment=false,canUploadLabQuality=false,
 canProposeMerchant=false,canVerifyMerchant=false,canViewSettlements=false,
 labERPEnabled=false}:{
 canViewLabPricing?:boolean;canManageLabPricing?:boolean;
 canViewLabEquipment?:boolean;canManageLabEquipment?:boolean;
 canUploadLabQuality?:boolean;labERPEnabled?:boolean;
 canProposeMerchant?:boolean;canVerifyMerchant?:boolean;
 canViewSettlements?:boolean
}){
  const [centers,setCenters]=useState<Row[]>([]);
  const [active,setActive]=useState<Detail|null>(null);
  const [draft,setDraft]=useState<CenterDraft|null>(null);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const requestKey=useRef("");
  const reviewKey=useRef("");
  const selectionSeq=useRef(0),selectedRef=useRef("");
  const [checking,setChecking]=useState(false);
  const [verifiedLicense,setVerifiedLicense]=useState("");
  const loadList=useCallback(async()=>{
    const r=await get<{centers:Row[]}>("my-centers");
    if(!Array.isArray(r.centers))throw Error("Assigned center list is incomplete");
    setCenters(r.centers);
  },[]);
  useEffect(()=>{
    let alive=true;
    void get<{centers:Row[]}>("my-centers")
      .then(r=>{if(alive)setCenters(r.centers);})
      .catch(e=>{if(alive)setError(e instanceof Error?e.message:"Center access unavailable");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;selectionSeq.current++;};
  },[]);
  async function choose(ref:string){
    const turn=++selectionSeq.current;selectedRef.current=ref;setChecking(true);
    setError("");setNotice("");setActive(null);setDraft(null);setVerifiedLicense("");
    try{
      const record=await get<Detail>("my-centers/"+encodeURIComponent(ref));
      if(turn!==selectionSeq.current)return;
      if(!record?.center||record.centerRef!==ref)throw Error("Center draft unavailable.");
      setActive(record);setDraft(record.center);requestKey.current="";reviewKey.current="";setUncertain(false);
    }catch(e){if(turn===selectionSeq.current)setError(e instanceof Error?e.message:"Center access unavailable.");}
    finally{if(turn===selectionSeq.current)setChecking(false);}
  }
  async function save(){
    if(!active||!draft||saving||checking||uncertain)return;
    setSaving(true);setError("");setNotice("");
    if(!requestKey.current)requestKey.current=crypto.randomUUID();
    try{
      const r=await fetch("/api/health-network/my-centers/"+encodeURIComponent(active.centerRef),{
        method:"PATCH",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestKey:requestKey.current,
          expectedVersion:active.version,center:draft})
      }).catch(e=>{setUncertain(true);throw e;});
      const payload:unknown=await r.json().catch(()=>null);
      if(!r.ok){
        const message=payload&&typeof payload==="object"&&"message" in payload&&
          typeof payload.message==="string"?payload.message:"Save could not be confirmed.";
        if(r.status>=500)setUncertain(true);
        throw Error(message);
      }
      requestKey.current="";
      await choose(active.centerRef);
      await loadList();
      setNotice("Your pending center draft was saved. Foundation approval is still required.");
    }catch(e){setError(e instanceof Error?e.message:"Save outcome uncertain.");}
    finally{setSaving(false);}
  }
  async function submitForReview(){
    if(!active||saving||checking||uncertain||!verifiedLicense||active.status!=="PENDING"||
      active.providerStatus!=="VERIFIED")return;
    setSaving(true);setError("");setNotice("");
    if(!reviewKey.current)reviewKey.current=crypto.randomUUID();
    try{
      const r=await fetch("/api/health-network/my-centers/"+
        encodeURIComponent(active.centerRef)+"/submit",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({requestKey:reviewKey.current,
          expectedVersion:active.version,proofFileRef:verifiedLicense})
      }).catch(e=>{setUncertain(true);throw e;});
      const response:unknown=await r.json().catch(()=>null);
      if(!r.ok){
        if(r.status>=500)setUncertain(true);
        throw Error(response&&typeof response==="object"&&
          "message" in response&&typeof response.message==="string"?
          response.message:"Original review submission could not be confirmed.");
      }
      reviewKey.current="";
      await choose(active.centerRef);await loadList();
      setNotice("Center licence submitted for independent Foundation verification. "+
        "Activation and publication are separate.");
    }catch(e){setError(e instanceof Error?e.message:
      "Review submission outcome uncertain. Check the original center.");}
    finally{setSaving(false);}
  }
  const renderedSelection=selectionSeq.current;
  function selectCenter(ref:string){
    if(saving||checking||uncertain)return;
    if(active&&draft&&JSON.stringify(active.center)!==JSON.stringify(draft)&&!window.confirm("Discard unsaved center changes?"))return;
    void choose(ref);
  }
  return <div className="role-workspace cg-health-workspace">
    <header className="topbar"><div><h1>My healthcare center</h1>
      <p>Maintain your assigned center. Foundation approval controls verification, doctor associations and public listing.</p>
    </div></header>
    {loading&&<p role="status">Checking your current center assignment…</p>}
    {!!error&&<p className="notice error" role="alert">{error}</p>}
    {!!notice&&<p className="notice" role="status">{notice}</p>}
    {uncertain&&<p role="alert">Your last save is uncertain. Refresh the original center before making another change.
      <button type="button" disabled={saving||checking||!selectedRef.current} onClick={()=>{if(selectedRef.current)void choose(selectedRef.current);}}>
        Refresh original center</button></p>}
    {!loading&&centers.length===0&&
      <p>No healthcare center is currently assigned to your account. Contact your Foundation administrator.</p>}
    <div className="toolbar">
      {centers.map(x=><button type="button" key={x.centerRef}
        disabled={saving||checking||uncertain} onClick={()=>selectCenter(x.centerRef)} aria-pressed={active?.centerRef===x.centerRef}>
        {x.providerName} — {x.name}</button>)}
    </div>
    {checking&&<p role="status">Checking selected center…</p>}
    {active&&draft&&!checking&&<section className="form-section">
      <h2>{draft.displayName}</h2>
      <p>Center: {active.status.replaceAll("_"," ")}.
        Provider: {active.providerStatus.replaceAll("_"," ")}.
        Access: {active.accessState==="ENABLED"?"Enabled":"Disabled"}.
        Listing: {active.publicationState==="PUBLISHED"?"Published":"Not published"}.</p>
      {active.publicationState==="PUBLISHED"&&active.publicSlug&&
        <p><a href={"/healthcare/centers/"+encodeURIComponent(active.publicSlug)}>
          View approved public page</a></p>}
      <p>Only the Foundation may approve, activate or publish this center.</p>
      {canViewSettlements&&active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
       <CenterMonthlySettlementSummary key={"settlement:"+active.centerRef}
        centerRef={active.centerRef}/>}
      {active.status==="PENDING"&&<CenterEditor value={draft} identityLocked
        disabled={saving||uncertain} onChange={setDraft}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
       (canProposeMerchant||canVerifyMerchant)&&
       <CenterMerchantBinding key={"merchant:"+active.centerRef}
        centerRef={active.centerRef} canPropose={canProposeMerchant}
        canVerify={canVerifyMerchant}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <CenterDoctorFees key={active.centerRef} centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <DoctorScheduleWorkspace key={"schedule:"+active.centerRef}
         channel="center" centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <CenterPatientIntakePanel key={"intake:"+active.centerRef} centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <CenterAssistedConsultationBooking key={"booking:"+active.centerRef} centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <CenterContentEditor key={"content:"+active.centerRef} centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
       draft.capabilities.some(x=>["PHARMACY","NURSING","SURGERY"].includes(x))&&
       <PartnerPublicOffersWorkspace mode="partner" centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <CenterSupportDesk key={"support:"+active.centerRef} centerRef={active.centerRef}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
       draft.capabilities.includes("DIAGNOSTICS")&&canViewLabPricing&&
       <CenterLabPricingPanel key={"lab:"+active.centerRef}
        centerRef={active.centerRef} canManage={canManageLabPricing}/>}
      {labERPEnabled&&active.status==="VERIFIED"&&
       active.accessState==="ENABLED"&&
       draft.capabilities.includes("DIAGNOSTICS")&&canViewLabEquipment&&
       <LabEquipmentWorkspace key={"equipment:"+active.centerRef}
        fixedCenterRef={active.centerRef} canView
        canManage={canManageLabEquipment} canUpload={canUploadLabQuality}/>}
      {active.status==="VERIFIED"&&active.accessState==="ENABLED"&&
        <CenterErpCapabilityPanel key={"erp:"+active.centerRef} centerRef={active.centerRef}/>}

      {active.status==="VERIFIED"&&active.accessState!=="ENABLED"&&
        <p>Center access is not active. Ask the Foundation to enable this verified location.</p>}
      {active.status==="PENDING"&&<div className="toolbar">
        <button type="button" className="primary" disabled={saving||uncertain}
          onClick={()=>void save()}>{saving?"Saving…":"Save pending details"}</button>
        <button type="button" disabled={saving}
          onClick={()=>{if(window.confirm("Discard unsaved center changes?"))void choose(active.centerRef);}}>Discard unsaved changes</button>
      </div>}
      {active.status==="PENDING"&&<>
        <h3>Private center licence</h3>
        <HealthEvidenceUploader key={active.centerRef+":"+active.version} providerRef={active.providerRef}
          centerRef={active.centerRef} sourceVersion={active.version}
          classification="HEALTH_CENTER_LICENSE"
          onVerified={fileRef=>{if(renderedSelection===selectionSeq.current)setVerifiedLicense(fileRef);}}/>
        {active.providerStatus==="VERIFIED"&&<button type="button"
          className="primary" disabled={saving||uncertain||!verifiedLicense}
          onClick={()=>void submitForReview()}>
          Submit scanned licence for independent review</button>}
      </>}
    </section>}
  </div>;
}
