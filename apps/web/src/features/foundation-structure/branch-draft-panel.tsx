"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {BranchEvidenceUploader} from "./branch-evidence-uploader";
import {BranchApprovalInbox} from "./branch-approval-inbox";
import {BranchEvidenceHistory} from "./branch-evidence-history";

type Draft={recordRef:string;branchName:string;branchType:string;status:string;
  currentStep:number;version:number;updatedAt:string};
type Detail=Draft&{stages:Record<string,Record<string,unknown>>;managerRef:string|null;managerName:string|null;geographyRef:string|null};
type Option={value:string;label:string;kind?:string};
type Area={areaRef:string;name:string;level:string;status:string};
type Pending={action:"BRANCH_DRAFT_CREATE"|"BRANCH_DRAFT_SAVE";requestKey:string};
type RegistrationStatus={status:string;branch:{branchCode:string;status:string}|null;
  submissions:{revision:number;status:string;caseRef:string|null}[];
  approval:{reference:string;status:string;revision:number;
    history:{action:string;remarks:string;at:string}[]}|null;message?:string};
const steps=[
  "Branch details","Location & address","Registration documents",
  "Agreement & photos","Branch manager","Foundation departments","Review draft"
];
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object):Promise<T>{
  let result:Response;
  try{
    result=await fetch("/api/foundation"+path,{method,cache:"no-store",
      ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
  }catch{throw Error("The save result is unknown. Check the original request before retrying.");}
  const data:unknown=await result.json().catch(()=>null);
  if(!result.ok){
    const message=data&&typeof data==="object"&&"message" in data&&typeof data.message==="string"
      ?data.message:"This information cannot be verified right now.";
    throw Object.assign(new Error(message),{status:result.status});
  }
  return data as T;
}
const fresh=()=>crypto.randomUUID();
function string(value:unknown){return typeof value==="string"?value:"";}
function ids(value:unknown):string[]{return Array.isArray(value)?value.filter((v):v is string=>typeof v==="string"):[];}
export function BranchDraftPanel({canManage,canReview,embedded=false}:{canManage:boolean;canReview:boolean;embedded?:boolean}){
  const [drafts,setDrafts]=useState<Draft[]>([]);
  const [nextOffset,setNextOffset]=useState<number|null>(null);
  const [selected,setSelected]=useState<Detail|null>(null);
  const [step,setStep]=useState(1);
  const [draftName,setDraftName]=useState("");
  const [branchType,setBranchType]=useState("");
  const [openingDate,setOpeningDate]=useState("");
  const [officialPhone,setOfficialPhone]=useState(""),[officialEmail,setOfficialEmail]=useState("");
  const [stagePhotos,setStagePhotos]=useState<string[]>([]);
  const [stageLogos,setStageLogos]=useState<string[]>([]);
  const [registrationFiles,setRegistrationFiles]=useState<string[]>([]);
  const [agreementFiles,setAgreementFiles]=useState<string[]>([]);
  const [documentPhotos,setDocumentPhotos]=useState<string[]>([]);
  const [submissionNotice,setSubmissionNotice]=useState("");
  const [submissionBusy,setSubmissionBusy]=useState(false);
  const [submitKey,setSubmitKey]=useState("");
  const [registrationStatus,setRegistrationStatus]=useState<RegistrationStatus|null>(null);
  const [areaRef,setAreaRef]=useState("");
  const [address,setAddress]=useState("");
  const [pin,setPin]=useState("");
  const [latitude,setLatitude]=useState("");
  const [longitude,setLongitude]=useState("");
  const [manager,setManager]=useState("");
  const [departments,setDepartments]=useState<string[]>([]);
  const [ack,setAck]=useState(false);
  const [areas,setAreas]=useState<Area[]>([]);
  const [managerOptions,setManagerOptions]=useState<Option[]>([]);
  const [departmentOptions,setDepartmentOptions]=useState<Option[]>([]);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [pending,setPending]=useState<Pending|null>(null);
  const [createOpen,setCreateOpen]=useState(embedded);
  const load=useCallback(async(offset=0)=>{
    const items=await api<{drafts:Draft[];nextOffset:number|null}>("/branches/drafts?offset="+offset);
    setDrafts(prev=>offset===0?items.drafts:[...prev,...items.drafts]);
    setNextOffset(items.nextOffset);
  },[]);
  useEffect(()=>{
    let alive=true;
    void load().catch(()=>{if(alive){setDrafts([]);setError("Branch drafts cannot be verified.");}})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[load]);
  useEffect(()=>{
    if(!canManage)return;
    let alive=true;
    void Promise.allSettled([
      api<{areas:Area[]}>("/geography?level=BLOCK").then(x=>{if(alive)setAreas(x.areas.filter(a=>a.status==="ACTIVE"));}),
      api<{options:Option[]}>("/branches/managers/options").then(x=>{if(alive)setManagerOptions(x.options);}),
      api<{options:Option[]}>("/branches/department-options").then(x=>{if(alive)setDepartmentOptions(x.options);})
    ]).then(results=>{if(alive&&results.some(r=>r.status==="rejected"))
      setError("Some eligible selections are unavailable. Refresh before choosing them.");});
    return()=>{alive=false;};
  },[canManage]);
  function hydrate(data:Detail){
    setSelected(data);setStep(Math.max(1,Math.min(7,data.currentStep)));
    const stages=data.stages??{},s1=stages["1"]??{},s2=stages["2"]??{},
      s3=stages["3"]??{},s4=stages["4"]??{},s5=stages["5"]??{},
      s6=stages["6"]??{},s7=stages["7"]??{};
    setDraftName(string(s1.branchName));setBranchType(string(s1.branchType));setOpeningDate(string(s1.openingDate));
    setOfficialPhone(string(s1.officialPhone));setOfficialEmail(string(s1.officialEmail));
    setStagePhotos(ids(s1.photoFiles));setStageLogos(ids(s1.logoFiles));
    setRegistrationFiles(ids(s3.registrationFiles));setAgreementFiles(ids(s4.agreementFiles));
    setDocumentPhotos(ids(s4.photoFiles));
    setAreaRef(string(s2.geographyRef));setAddress(string(s2.postalAddress));setPin(string(s2.pinCode));
    setLatitude(s2.latitude===null||s2.latitude===undefined?"":String(s2.latitude));
    setLongitude(s2.longitude===null||s2.longitude===undefined?"":String(s2.longitude));
    setManager(string(s5.managerRef));setDepartments(ids(s6.departmentRefs));
    setAck(s7.reviewAcknowledged===true);
  }
  async function loadStatus(ref:string){
    const state=await api<RegistrationStatus>(
      "/branch-workflow/registrations/"+encodeURIComponent(ref)+"/status");
    setRegistrationStatus(state);
  }
  async function open(ref:string){
    setError("");setMessage("");setSubmitKey("");setBusy(true);
    try{
      hydrate(await api<Detail>("/branches/drafts/"+encodeURIComponent(ref)));
      try{await loadStatus(ref);}
      catch{
        setRegistrationStatus(null);
        setSubmissionNotice("The approval timeline cannot be verified right now. Your saved draft remains available.");
      }
    }
    catch(e){setSelected(null);setRegistrationStatus(null);setError(e instanceof Error?e.message:"Draft cannot be verified.");}
    finally{setBusy(false);}
  }
  function currentStage():Record<string,unknown>{
    if(step===1)return {branchName:draftName,branchType,openingDate:openingDate||null,
      officialPhone,officialEmail,photoFiles:stagePhotos,logoFiles:stageLogos};
    if(step===2)return {geographyRef:areaRef||null,postalAddress:address,pinCode:pin,
      latitude:latitude.trim()?Number(latitude):null,longitude:longitude.trim()?Number(longitude):null};
    if(step===3)return {registrationFiles};
    if(step===4)return {agreementFiles,photoFiles:documentPhotos};
    if(step===5)return {managerRef:manager||null};
    if(step===6)return {departmentRefs:departments};
    return {reviewAcknowledged:ack};
  }
  async function refreshAfterWrite(ref?:string|null){
    await load();
    if(ref)await open(ref);
  }
  async function create(){
    if(!canManage||pending)return;
    const requestKey=fresh();
    setBusy(true);setError("");setMessage("");setPending({action:"BRANCH_DRAFT_CREATE",requestKey});
    try{
      const result=await api<{recordRef:string}>("/branches/drafts","POST",
        {requestKey,stage:{branchName:draftName,branchType,openingDate:openingDate||null}});
      setPending(null);setCreateOpen(false);await refreshAfterWrite(result.recordRef);
      setMessage("Branch draft created. No approval or evidence has been claimed.");
    }catch(e){
      if(e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&
         [400,401,403,404,409,429].includes(e.status))setPending(null);
      setError(e instanceof Error?e.message:"The save result is unknown.");
    }
    finally{setBusy(false);}
  }
  async function save(){
    if(!canManage||!selected||pending)return;
    const requestKey=fresh(),ref=selected.recordRef;
    setBusy(true);setError("");setMessage("");setPending({action:"BRANCH_DRAFT_SAVE",requestKey});
    try{
      await api("/branches/drafts/"+encodeURIComponent(ref),"PATCH",
        {requestKey,expectedVersion:selected.version,step,stage:currentStage()});
      setPending(null);await refreshAfterWrite(ref);
      setMessage("Branch draft updated. Documents and approval remain unverified.");
    }catch(e){
      if(e&&typeof e==="object"&&"status" in e&&typeof e.status==="number"&&
         [400,401,403,404,409,429].includes(e.status))setPending(null);
      setError(e instanceof Error?e.message:"The save result is unknown.");
    }
    finally{setBusy(false);}
  }
  async function submit(){
    if(!selected||!canManage||submissionBusy||pending)return;
    const key=submitKey||fresh();setSubmitKey(key);
    setSubmissionBusy(true);setError("");setSubmissionNotice("");
    try{
      const outcome=await api<{status:string;message?:string}>(
        "/branch-workflow/registrations/"+encodeURIComponent(selected.recordRef)+"/submit",
        "POST",{requestKey:key,expectedVersion:selected.version});
      setSubmissionNotice(outcome.message??"The original submission state needs confirmation.");
      if(outcome.status!=="SUBMISSION_UNCONFIRMED")setSubmitKey("");
      await loadStatus(selected.recordRef);
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Submission is unconfirmed.");
      // Preserve the exact original key across retry or unknown commit.
    }finally{setSubmissionBusy(false);}
  }
  async function confirmPending(){
    if(!pending)return;
    setBusy(true);setError("");
    try{
      const outcome=await api<{status:string;recordRef:string|null}>(
        "/branches/changes/"+pending.action+"/"+encodeURIComponent(pending.requestKey));
      if(outcome.status==="CONFIRMED"){
        setPending(null);setCreateOpen(false);await refreshAfterWrite(outcome.recordRef);
        setMessage("The original save was confirmed. Refreshed from the Foundation source.");
      }else{
        setError("The original save is not confirmed. Keep the request key; do not create a duplicate.");
      }
    }catch{setError("The original save cannot be checked. Try checking this same request again.");}
    finally{setBusy(false);}
  }
  const hasAttachedEvidence=registrationFiles.length>0&&agreementFiles.length>0;
  return <section className="role-workspace branch-workspace">
    {!embedded&&<header className="topbar"><div><h1>Branches & registration</h1>
      <p>Seven-stage Foundation registration, protected evidence and Super Admin decisions.</p></div>
      <Link href="/admin/foundation">Foundation overview</Link>
    </header>}
    <div className="toolbar"><span className="account-status">Genuine verified approvals required for activation</span>
      {canManage&&<button type="button" className="primary" disabled={busy||!!pending}
        onClick={()=>{setSelected(null);setCreateOpen(true);setDraftName("");setBranchType("");
          setOpeningDate("");setError("");setMessage("");setSubmitKey("");}}>New branch draft</button>}
    </div>
    {error&&<p className="notice" role="alert">{error}</p>}
    {message&&<p className="notice" role="status">{message}</p>}
    {pending&&<div className="notice" role="alert">The original write may have succeeded.
      <button type="button" disabled={busy} onClick={()=>void confirmPending()}>Check original save</button>
    </div>}
    {loading?<p role="status" className="cg-module-loading">Checking permitted Foundation branches...</p>:
      <div className="branch-columns">
        <aside className="role-pane"><h2>Registration drafts</h2>
          {drafts.length===0?<p className="cg-module-empty" role="status">No verified branch drafts are available.</p>:
            <ul className="branch-draft-list">{drafts.map(x=><li key={x.recordRef}>
              <button type="button" aria-current={selected?.recordRef===x.recordRef?"true":undefined}
                disabled={busy} onClick={()=>void open(x.recordRef)}>
                <strong>{x.branchName}</strong><span>{x.status.replaceAll("_"," ")} · Step {x.currentStep} of 7</span>
              </button></li>)}</ul>}
          {nextOffset!==null&&<button type="button" disabled={busy}
            onClick={()=>void load(nextOffset).catch(()=>setError("More drafts could not be verified."))}>
            Load more drafts</button>}
        </aside>
        <div className="role-pane">
          {createOpen&&<div className="form"><h2>Start branch registration</h2>
            <label className="field">Branch name<input value={draftName} maxLength={160}
              onChange={e=>setDraftName(e.target.value)} required/></label>
            <label className="field">Branch type<input value={branchType} maxLength={80}
              onChange={e=>setBranchType(e.target.value)}/></label>
            <label className="field">Opening date<input type="date" value={openingDate}
              onChange={e=>setOpeningDate(e.target.value)}/></label>
            <div className="toolbar"><button type="button" onClick={()=>setCreateOpen(false)}>Cancel</button>
              <button type="button" className="primary" disabled={busy||!!pending||draftName.trim().length<2}
                onClick={()=>void create()}>Create draft</button></div>
          </div>}
          {selected&&!createOpen&&<BranchEvidenceHistory key={selected.recordRef+":"+selected.version}
            registrationRef={selected.recordRef} canRevoke={canManage}/>}
          {selected&&!createOpen&&<div className="form">
            <header><h2>{selected.branchName}</h2><p>{selected.status.replaceAll("_"," ")} · Revision {selected.version}</p></header>
            <nav className="branch-stepper" aria-label="Registration steps">
              {steps.map((title,i)=><button key={title} type="button" disabled={i+1>selected.currentStep+1||busy}
                aria-current={step===i+1?"step":undefined}
                onClick={()=>setStep(i+1)}><span className="branch-step-number">{i+1}</span><span>{title}</span></button>)}
            </nav>
            <h3>Step {step} — {steps[step-1]}</h3>
            {step===1&&<>
              <label className="field">Branch name<input value={draftName} maxLength={160}
                onChange={e=>setDraftName(e.target.value)}/></label>
              <label className="field">Branch type<input value={branchType} maxLength={80}
                onChange={e=>setBranchType(e.target.value)}/></label>
              <label className="field">Opening date<input type="date" value={openingDate}
                onChange={e=>setOpeningDate(e.target.value)}/></label>
              <label className="field">Official phone<input type="tel" maxLength={80}
                value={officialPhone} onChange={e=>setOfficialPhone(e.target.value)}/></label>
              <label className="field">Official email<input type="email" maxLength={180}
                value={officialEmail} onChange={e=>setOfficialEmail(e.target.value)}/></label>
              {canManage&&<BranchEvidenceUploader registrationRef={selected.recordRef}
                draftVersion={selected.version} key={selected.recordRef+":"+selected.version+":"+("BRANCH_PHOTO")} classification="BRANCH_PHOTO"
                onVerified={ref=>setStagePhotos(old=>old.includes(ref)?old:[...old,ref])}/>}
              {stagePhotos.length>0&&<p className="notice">{stagePhotos.length} private photograph(s) selected for next save.</p>}
              {canManage&&<BranchEvidenceUploader registrationRef={selected.recordRef}
                draftVersion={selected.version} key={selected.recordRef+":"+selected.version+":"+("BRANCH_LOGO")} classification="BRANCH_LOGO"
                onVerified={ref=>setStageLogos(old=>old.includes(ref)?old:[...old,ref])}/>}
            </>}
            {step===2&&<>
              <label className="field">Block / area<select value={areaRef}
                onChange={e=>setAreaRef(e.target.value)}><option value="">Choose a real area</option>
                  {areas.map(x=><option value={x.areaRef} key={x.areaRef}>{x.name}</option>)}</select></label>
              <label className="field">Postal address<textarea value={address} maxLength={700}
                onChange={e=>setAddress(e.target.value)}/></label>
              <label className="field">PIN code<input value={pin} maxLength={6} inputMode="numeric"
                onChange={e=>setPin(e.target.value)}/></label>
              <div className="branch-coordinate"><label className="field">Latitude<input value={latitude}
                inputMode="decimal" onChange={e=>setLatitude(e.target.value)}/></label>
                <label className="field">Longitude<input value={longitude} inputMode="decimal"
                  onChange={e=>setLongitude(e.target.value)}/></label></div>
            </>}
            {step===3&&<>
              {canManage&&<BranchEvidenceUploader registrationRef={selected.recordRef}
                draftVersion={selected.version} key={selected.recordRef+":"+selected.version+":"+("REGISTRATION_PROOF")} classification="REGISTRATION_PROOF"
                onVerified={ref=>setRegistrationFiles(old=>old.includes(ref)?old:[...old,ref])}/>}
              <p className="notice">Registration proof selected: {registrationFiles.length}.
                A signed agreement is also required before submission.</p>
            </>}
            {step===4&&<>
              {canManage&&<BranchEvidenceUploader registrationRef={selected.recordRef}
                draftVersion={selected.version} key={selected.recordRef+":"+selected.version+":"+("AGREEMENT")} classification="AGREEMENT"
                onVerified={ref=>setAgreementFiles(old=>old.includes(ref)?old:[...old,ref])}/>}
              {canManage&&<BranchEvidenceUploader registrationRef={selected.recordRef}
                draftVersion={selected.version} key={selected.recordRef+":"+selected.version+":"+("BRANCH_PHOTO")} classification="BRANCH_PHOTO"
                onVerified={ref=>setDocumentPhotos(old=>old.includes(ref)?old:[...old,ref])}/>}
              <p className="notice">Agreements selected: {agreementFiles.length}.
                Additional private photos: {documentPhotos.length}.</p>
            </>}
            {step===5&&<label className="field">Eligible Foundation manager<select value={manager}
              onChange={e=>setManager(e.target.value)}><option value="">Choose a real account</option>
              {manager&&selected.managerName&&!managerOptions.some(x=>x.value===manager)&&
                <option value={manager}>{selected.managerName}</option>}
              {managerOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>
              <small>Only current eligible CG01 accounts can be selected.</small></label>}
            {step===6&&<fieldset className="branch-department-fieldset"><legend>Foundation-wide departments</legend>
              {departmentOptions.map(x=><label key={x.value}><input type="checkbox"
                checked={departments.includes(x.value)}
                onChange={e=>setDepartments(previous=>e.target.checked?[...previous,x.value]:
                  previous.filter(id=>id!==x.value))}/>{x.label} ({x.kind?.toLowerCase()})</label>)}
              {departmentOptions.length===0&&<p>No active Foundation departments verified.</p>}
            </fieldset>}
            {step===7&&<>
              <p>Review all seven saved stages and your genuine private evidence.
                Submission creates a frozen record and a distinct Super Admin approval case.
                The branch becomes active only after the approved owner transition is verified.</p>
              <label className="field"><input type="checkbox" checked={ack}
                onChange={e=>setAck(e.target.checked)}/> I have reviewed the draft</label>
              {!hasAttachedEvidence&&<p className="notice">Registration proof and signed agreement
                must be uploaded, confirmed clean and saved in their original stages.</p>}
            </>}
            <div className="toolbar">
              <button type="button" disabled={step<=1||busy} onClick={()=>setStep(x=>x-1)}>Previous</button>
              <button type="button" disabled={step>=7||step>=selected.currentStep+1||busy}
                onClick={()=>setStep(x=>x+1)}>Next step</button>
              {canManage&&<button type="button" className="primary"
                disabled={busy||!!pending||submissionBusy} onClick={()=>void save()}>Save draft</button>}
              {step===7&&canManage&&["DRAFT","RETURNED"].includes(selected.status)&&
                <button type="button" className="primary" disabled={busy||!!pending||submissionBusy||
                  selected.stages?.["7"]?.reviewAcknowledged!==true||!hasAttachedEvidence}
                  onClick={()=>void submit()}>Submit for Super Admin approval</button>}
              {submitKey&&<button type="button" disabled={submissionBusy||busy}
                onClick={()=>void submit()}>Retry/check original submission</button>}
            </div>
          </div>}
          {!createOpen&&!selected&&<div className="role-empty">Select a permitted branch draft,
            or start a new registration.</div>}
        </div>
        <aside className="role-pane"><h2>Branch Setup Summary</h2>
          <p>Seven-stage registration with real draft and approval status.</p>
          {selected&&<div className="branch-setup-summary">
            <label htmlFor="branch-stage-progress">Stage reached:
              <strong>{selected.currentStep} of 7</strong></label>
            <progress id="branch-stage-progress" max={7}
              value={selected.currentStep}/>
            <dl className="audit-detail">
              <dt>Branch name</dt><dd>{draftName.trim()||"Not provided"}</dd>
              <dt>Branch type</dt><dd>{branchType.trim()||"Not provided"}</dd>
              <dt>Opening date</dt><dd>{openingDate||"Not provided"}</dd>
              <dt>Manager</dt><dd>{managerOptions.find(x=>x.value===manager)?.label||
                selected.managerName||"Not assigned"}</dd>
              <dt>Registration proof selected</dt><dd>{registrationFiles.length}</dd>
              <dt>Signed agreements selected</dt><dd>{agreementFiles.length}</dd>
            </dl>
            <p className="notice">Evidence becomes authoritative only after
              the selected documents are saved and CG19 verifies them.
              A branch code is issued only after genuine Super Admin approval.</p>
          </div>}
          {!!submissionNotice&&<p className="notice" role="status">{submissionNotice}</p>}
          <dl className="audit-detail">
            <dt>Registration</dt><dd>{registrationStatus?.status.replaceAll("_"," ")??"Select a draft"}</dd>
            <dt>Evidence</dt><dd>Original private files verified at submission and activation</dd>
            <dt>Approval</dt><dd>{registrationStatus?.approval?
              registrationStatus.approval.reference+" · "+
                registrationStatus.approval.status.replaceAll("_"," "):
              "Not yet confirmed"}</dd>
            <dt>Activation</dt><dd>{registrationStatus?.branch?
              registrationStatus.branch.branchCode+" · "+
              registrationStatus.branch.status.replaceAll("_"," "):"No branch code issued"}</dd>
          </dl>
          {selected&&<button type="button" disabled={busy||submissionBusy}
            onClick={()=>void loadStatus(selected.recordRef).catch(
              ()=>setError("The real registration status is currently unavailable."))}>
            Refresh original status</button>}
          {registrationStatus?.approval&&<ol>{registrationStatus.approval.history.map((event,i)=>
            <li key={i}>{event.action.replaceAll("_"," ")}
              {event.remarks?": "+event.remarks:""}</li>)}</ol>}
        </aside>
      </div>}
    {!embedded&&canReview&&<BranchApprovalInbox/>}
  </section>;
}
