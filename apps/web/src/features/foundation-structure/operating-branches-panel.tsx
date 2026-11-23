"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ActiveBranchEvidenceUploader} from "./active-branch-evidence-uploader";
import {BranchAccessPanel} from "./branch-access-panel";

type Branch={branchRef:string;branchName:string;branchCode:string;status:string;
 version:number;branchType:string;openingDate:string|null;areaName:string;managerName:string};
type BranchTotals={total:number;active:number;inactive:number;closed:number};
type BranchTypeSummary={name:string;total:number};
type BranchDetail=Branch&{openingDate:string|null;geographyRef:string;postalAddress:string;
 pinCode:string|null;latitude:number|null;longitude:number|null;officialPhone:string;officialEmail:string;
 managerRef:string;managerName:string|null;evidenceVersions:{fileRef:string;revision:number;classification:string}[]};
type Department={departmentRef:string;name:string;kind:string;description:string;openingDate:string|null;active:boolean;
 version:number;geographyRef:string|null;parentRef:string|null;headAccountRef:string|null;headDisplayName:string|null};
type Link={linkRef:string;departmentRef:string;name:string;kind:string;endedAt:string|null;linkedAt:string};
type Participant={participationRef:string;displayName:string|null;officeRole:string;activeUntil:string|null;accountRef:string};
type History={version:number;changedAt:string;before:Record<string,unknown>;after:Record<string,unknown>};
type Option={value:string;label:string;kind?:string};
type Area={areaRef:string;name:string;level:string;status:string};
const base="/api/foundation";
async function req<T>(route:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>):Promise<T>{
 let response:Response;
 try{response=await fetch(base+route,{method,cache:"no-store",
   ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});}
 catch{throw new Error("The change may have succeeded. Refresh the original branch before retrying.");}
 const raw:unknown=await response.json().catch(()=>null);
 if(!response.ok){
   const message=raw&&typeof raw==="object"&&"message" in raw&&typeof raw.message==="string"?
     raw.message:"The current Foundation record cannot be verified.";
   throw Object.assign(new Error(message),{status:response.status});
 }
 return raw as T;
}
const label=(status:string)=>status.toLowerCase().replaceAll("_"," ").replace(/^./,x=>x.toUpperCase());
const key=()=>crypto.randomUUID();
function str(v:unknown){return typeof v==="string"?v:"";}
export function OperatingBranchesPanel({canManage,canAdmin}:{canManage:boolean;canAdmin:boolean}){
 const [rows,setRows]=useState<Branch[]>([]),[next,setNext]=useState<number|null>(null);
 const [totals,setTotals]=useState<BranchTotals|null>(null);
 const [branchTypes,setBranchTypes]=useState<BranchTypeSummary[]>([]);
 const [searchInput,setSearchInput]=useState(""),[searchApplied,setSearchApplied]=useState("");
 const [selected,setSelected]=useState<BranchDetail|null>(null);
 const [history,setHistory]=useState<History[]>([]);
 const [departments,setDepartments]=useState<Department[]>([]),[links,setLinks]=useState<Link[]>([]);
 const [nextDepartmentOffset,setNextDepartmentOffset]=useState<number|null>(null);
 const [participants,setParticipants]=useState<Participant[]>([]),[focusedDept,setFocusedDept]=useState("");
 const [managers,setManagers]=useState<Option[]>([]),[areas,setAreas]=useState<Area[]>([]);
 const [foundationDepartments,setFoundationDepartments]=useState<Option[]>([]);
 const [statusFilter,setStatusFilter]=useState("ALL");
 const [name,setName]=useState(""),[branchType,setBranchType]=useState(""),
   [openingDate,setOpeningDate]=useState(""),[geographyRef,setGeographyRef]=useState(""),
   [address,setAddress]=useState(""),[pin,setPin]=useState(""),[lat,setLat]=useState(""),
   [lng,setLng]=useState(""),[phone,setPhone]=useState(""),[email,setEmail]=useState(""),
   [manager,setManager]=useState("");
 const [editDepartment,setEditDepartment]=useState<Department|null>(null),
   [deptName,setDeptName]=useState(""),[deptKind,setDeptKind]=useState("DEPARTMENT"),
   [deptDesc,setDeptDesc]=useState(""),[deptOpeningDate,setDeptOpeningDate]=useState(""),
   [deptGeo,setDeptGeo]=useState(""),
   [deptParent,setDeptParent]=useState(""),[deptHead,setDeptHead]=useState(""),
   [deptActive,setDeptActive]=useState(true);
 const [departmentDrawerOpen,setDepartmentDrawerOpen]=useState(false);
 const departmentDrawerRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
   const dialog=departmentDrawerRef.current;
   if(departmentDrawerOpen&&dialog&&!dialog.open)dialog.showModal();
 },[departmentDrawerOpen]);
 const [participantAccount,setParticipantAccount]=useState(""),[participantRole,setParticipantRole]=useState("");
 const [foundationLink,setFoundationLink]=useState("");
 const [replacementFiles,setReplacementFiles]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const [unknown,setUnknown]=useState(false),[operationKey,setOperationKey]=useState("");
 const [stagedOperation,setStagedOperation]=useState<{method:"PATCH"|"POST";route:string;body:Record<string,unknown>}|null>(null);
 const load=useCallback(async(offset=0,filter=statusFilter)=>{
   const result=await req<{branches:Branch[];nextOffset:number|null;
     totals:BranchTotals;branchTypes:BranchTypeSummary[]}>(
     "/operating-branches?offset="+offset+
     (filter!=="ALL"?"&status="+encodeURIComponent(filter):"")+
     (searchApplied?"&search="+encodeURIComponent(searchApplied):""));
   setRows(prev=>offset===0?result.branches:[...prev,...result.branches]);
   setTotals(result.totals);setBranchTypes(result.branchTypes);
   setNext(result.nextOffset);
 },[statusFilter,searchApplied]);
 useEffect(()=>{
   let live=true;
   void load(0).catch(()=>{if(live){setRows([]);setError("Operating branches cannot be verified.");}})
     .finally(()=>{if(live)setLoading(false);});
   return()=>{live=false;};
 },[load]);
 useEffect(()=>{
   if(!canManage)return;
   let live=true;
   void Promise.allSettled([
     req<{options:Option[]}>("/branches/managers/options").then(x=>{if(live)setManagers(x.options);}),
     req<{options:Option[]}>("/branches/department-options").then(x=>{if(live)setFoundationDepartments(x.options);}),
     req<{areas:Area[]}>("/geography?level=BLOCK").then(x=>{if(live)setAreas(x.areas.filter(a=>a.status==="ACTIVE"));})
   ]).then(results=>{if(live&&results.some(x=>x.status==="rejected"))
     setError("Some current eligible selections cannot be verified.");});
   return()=>{live=false;};
 },[canManage]);
 function hydrate(branch:BranchDetail){
   setDepartmentDrawerOpen(false);
   setSelected(branch);setName(branch.branchName);setBranchType(branch.branchType);
   setOpeningDate(branch.openingDate??"");setGeographyRef(branch.geographyRef);
   setAddress(branch.postalAddress);setPin(branch.pinCode??"");
   setLat(branch.latitude===null?"":String(branch.latitude));
   setLng(branch.longitude===null?"":String(branch.longitude));
   setPhone(branch.officialPhone);setEmail(branch.officialEmail);
   setManager(branch.managerRef);setReplacementFiles([]);
 }
 async function loadAssociations(ref:string){
   const [depts,linked,revision]=await Promise.all([
     req<{departments:Department[];nextOffset:number|null}>("/operating-branches/"+ref+"/departments?offset=0"),
     req<{links:Link[]}>("/operating-branches/"+ref+"/department-links"),
     req<{history:History[]}>("/operating-branches/"+ref+"/revisions")
   ]);
   setDepartments(depts.departments);setNextDepartmentOffset(depts.nextOffset);
   setLinks(linked.links);setHistory(revision.history);
 }
 async function open(ref:string){
   setBusy(true);setError("");setMessage("");setFocusedDept("");
   try{
     hydrate(await req<BranchDetail>("/operating-branches/"+encodeURIComponent(ref)));
     await loadAssociations(ref);
   }catch(e){
     setSelected(null);setDepartments([]);setLinks([]);setHistory([]);
     setError(e instanceof Error?e.message:"Branch information is unavailable.");
   }finally{setBusy(false);}
 }
 async function refresh(){
   await load(0);
   if(selected)await open(selected.branchRef);
 }
 async function mutate(method:"PATCH"|"POST",route:string,data:Record<string,unknown>){
   if(busy||unknown)return;
   setBusy(true);setError("");setMessage("");
   const requestKey=operationKey||key();
   const body={...data,requestKey};
   setOperationKey(requestKey);setStagedOperation({method,route,body});
   try{
     await req(route,method,body);
     setOperationKey("");setStagedOperation(null);
     setMessage("Foundation change saved and source-audited.");
     setDepartmentDrawerOpen(false);
     setReplacementFiles([]);
     await refresh();
   }catch(e){
     const definite=e&&typeof e==="object"&&"status" in e&&
       typeof e.status==="number"&&[400,401,403,404,409,429].includes(e.status);
     if(definite){setOperationKey("");setStagedOperation(null);setUnknown(false);}
     else setUnknown(true);
     setError(e instanceof Error?e.message:"The change result is unknown.");
   }finally{setBusy(false);}
 }
 async function retryOriginal(){
   if(!stagedOperation||busy)return;
   setBusy(true);setError("");
   try{
     await req(stagedOperation.route,stagedOperation.method,stagedOperation.body);
     setUnknown(false);setOperationKey("");setStagedOperation(null);
     setMessage("The original change was confirmed.");await refresh();
   }catch(e){setError(e instanceof Error?e.message:"Original change could not be confirmed.");}
   finally{setBusy(false);}
 }
 function resetDepartment(d?:Department){
   setEditDepartment(d??null);setDeptName(d?.name??"");setDeptKind(d?.kind??"DEPARTMENT");
   setDeptDesc(d?.description??"");setDeptOpeningDate(d?.openingDate??"");
   setDeptGeo(d?.geographyRef??"");setDepartmentDrawerOpen(true);
   setDeptParent(d?.parentRef??"");setDeptHead(d?.headAccountRef??"");
   setDeptActive(d?.active??true);
 }
 async function loadParticipants(branchRef:string,departmentRef:string){
   setFocusedDept(departmentRef);
   try{
     const data=await req<{participants:Participant[]}>(
       "/operating-branches/"+branchRef+"/departments/"+departmentRef+"/participants");
     setParticipants(data.participants);
   }catch{setParticipants([]);setError("Committee officeholders cannot be verified.");}
 }
 const baseRef=selected?"/operating-branches/"+selected.branchRef:"";
 return <section className="role-workspace operating-branches">
   <header className="toolbar"><div><h2>Branches / Locations</h2>
     <p>Approved operating branches, current locations and change history.</p></div>
     <button type="button" disabled={busy}
       onClick={()=>void req<{csv:string}>("/operating-branches/export").then(result=>{
         const blob=new Blob([result.csv],{type:"text/csv;charset=utf-8"});
         const url=URL.createObjectURL(blob);
         const link=document.createElement("a");
         link.href=url;link.download="CareGanga-approved-branches.csv";link.click();
         URL.revokeObjectURL(url);
       }).catch(()=>setError("This branch export could not be verified."))}>
       Export permitted branches</button>
     <button type="button" disabled={busy} onClick={()=>void refresh().catch(
       ()=>setError("Operating branches cannot be refreshed."))}>Refresh</button>
   </header>
   {totals&&<div className="kpi-grid branch-overview" aria-label="Live permitted branch summary">
     {([
       ["Total branches",totals.total],
       ["Active branches",totals.active],
       ["Inactive branches",totals.inactive],
       ["Closed branches",totals.closed]
     ] as const).map(([name,value])=><div key={name} className="kpi">
       <span>{name}</span><strong>{value}</strong>
     </div>)}
   </div>}
   <div className="search-row branch-filters">
     <label>Search by branch name, code or type
       <input type="search" value={searchInput} maxLength={80}
         placeholder="Search approved branches"
         onChange={e=>setSearchInput(e.target.value)}
         onKeyDown={e=>{if(e.key==="Enter"){setSelected(null);setSearchApplied(searchInput.trim());}}}/>
     </label>
     <label>Branch status
       <select value={statusFilter}
         onChange={e=>{setStatusFilter(e.target.value);setSelected(null);setLoading(true);}}>
         <option value="ALL">All statuses</option><option value="ACTIVE">Active</option>
         <option value="INACTIVE">Inactive</option><option value="CLOSED">Closed</option>
       </select>
     </label>
     <button type="button" disabled={busy} onClick={()=>{
       setSelected(null);setSearchApplied(searchInput.trim());
     }}>Apply filters</button>
     <button type="button" disabled={busy} onClick={()=>{
       setSelected(null);setSearchInput("");setSearchApplied("");setStatusFilter("ALL");
     }}>Reset</button>
   </div>
   {canAdmin&&<BranchAccessPanel/>}
   {!!message&&<p role="status" className="notice">{message}</p>}
   {!!error&&<p role="alert" className="notice">{error}</p>}
   {unknown&&<div role="alert" className="notice">The original write is uncertain.
     <button type="button" disabled={busy} onClick={()=>void retryOriginal()}>Check original change</button></div>}
   {loading?<p className="cg-module-loading" role="status">Checking current approved branches...</p>:
     <div className="branch-columns">
       <section className="role-pane"><h3>All permitted branches</h3>
         {rows.length===0?<p className="cg-module-empty" role="status">No operating branches match the selected filters.</p>:
           <div className="branch-directory-scroll"><table className="role-table branch-directory-table">
             <thead><tr><th>Branch code</th><th>Branch name</th>
               <th>Location</th><th>Branch type</th><th>Incharge / Manager</th>
               <th>Status</th><th>Opening date</th><th>Action</th></tr></thead>
             <tbody>{rows.map(branch=><tr key={branch.branchRef}>
               <td>{branch.branchCode}</td><td><strong>{branch.branchName}</strong></td>
               <td>{branch.areaName}</td><td>{branch.branchType||"Not specified"}</td>
               <td>{branch.managerName||"Current manager"}</td>
               <td><span className={"account-status "+branch.status.toLowerCase()}>
                 {label(branch.status)}</span></td>
               <td>{branch.openingDate||"Not specified"}</td>
               <td><button type="button" disabled={busy}
                 aria-label={"View "+branch.branchName}
                 aria-current={selected?.branchRef===branch.branchRef?"true":undefined}
                 onClick={()=>void open(branch.branchRef)}>View</button></td>
             </tr>)}</tbody></table></div>}
         {next!==null&&<button type="button" disabled={busy}
           onClick={()=>void load(next).catch(()=>setError("More branches cannot be verified."))}>
           Load more branches</button>}
       </section>
       <div className="role-pane">
         {!selected?<p>Select a branch to view its current authorized details.</p>:<>
           <header><h3>{selected.branchName} · {selected.branchCode}</h3>
             <span className="account-status">{label(selected.status)}</span></header>
           {!canManage&&<dl className="audit-detail">
             <dt>Branch name</dt><dd>{selected.branchName}</dd>
             <dt>Branch type</dt><dd>{selected.branchType||"Not specified"}</dd>
             <dt>Opening date</dt><dd>{selected.openingDate||"Not specified"}</dd>
             <dt>Address</dt><dd>{selected.postalAddress||"Not specified"}</dd>
             <dt>PIN code</dt><dd>{selected.pinCode||"Not specified"}</dd>
             <dt>Official contact</dt><dd>{selected.officialPhone||"Not specified"}</dd>
             <dt>Official email</dt><dd>{selected.officialEmail||"Not specified"}</dd>
             <dt>Manager</dt><dd>{selected.managerName||"Current manager"}</dd>
           </dl>}
           {canManage&&<fieldset className="form" disabled={busy||unknown||selected.status!=="ACTIVE"}>
             <legend>Operating branch profile</legend>
             <label className="field">Branch name<input maxLength={160} value={name}
               onChange={e=>setName(e.target.value)}/></label>
             <label className="field">Branch type<input maxLength={80} value={branchType}
               onChange={e=>setBranchType(e.target.value)}/></label>
             <label className="field">Opening date<input type="date" value={openingDate}
               onChange={e=>setOpeningDate(e.target.value)}/></label>
             <label className="field">Block<select value={geographyRef}
               onChange={e=>setGeographyRef(e.target.value)}>
               <option value="">Choose active block</option>
               {areas.map(a=><option key={a.areaRef} value={a.areaRef}>{a.name}</option>)}</select></label>
             <label className="field">Address<textarea maxLength={700} value={address}
               onChange={e=>setAddress(e.target.value)}/></label>
             <label className="field">PIN code<input maxLength={6} value={pin} inputMode="numeric"
               onChange={e=>setPin(e.target.value)}/></label>
             <div className="branch-coordinate">
               <label className="field">Latitude<input value={lat} onChange={e=>setLat(e.target.value)}/></label>
               <label className="field">Longitude<input value={lng} onChange={e=>setLng(e.target.value)}/></label></div>
             <label className="field">Official phone<input type="tel" maxLength={80} value={phone}
               onChange={e=>setPhone(e.target.value)}/></label>
             <label className="field">Official email<input type="email" maxLength={180} value={email}
               onChange={e=>setEmail(e.target.value)}/></label>
             <label className="field">Branch manager<select value={manager}
               onChange={e=>setManager(e.target.value)}>
               <option value="">Choose eligible Foundation account</option>
               {manager&&selected.managerName&&!managers.some(x=>x.value===manager)&&
                 <option value={manager}>{selected.managerName}</option>}
               {managers.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
             </select></label>
             {canManage&&<section className="form">
               <h4>Replace protected branch evidence</h4>
               <p>Private photos, registration documents and agreements are verified before
                 an operating-profile revision is accepted.</p>
               {(["BRANCH_PHOTO","BRANCH_LOGO","REGISTRATION_PROOF","AGREEMENT"] as const)
                 .map(kind=><ActiveBranchEvidenceUploader
                   key={selected.branchRef+":"+selected.version+":"+kind}
                   branchRef={selected.branchRef} branchVersion={selected.version}
                   classification={kind} onVerified={ref=>setReplacementFiles(old=>
                     old.includes(ref)?old:[...old,ref])}/>)}
               {!!replacementFiles.length&&<p className="notice">
                 {replacementFiles.length} new verified private file(s) ready to save.</p>}
             </section>}
             {canManage&&<button type="button" className="primary" disabled={busy||unknown}
               onClick={()=>void mutate(
                 replacementFiles.length?"POST":"PATCH",
                 replacementFiles.length?
                   "/branch-workflow/operating-branches/"+selected.branchRef+"/update":baseRef,{
                 expectedVersion:selected.version,branchName:name,branchType,
                 openingDate:openingDate||null,geographyRef,postalAddress:address,pinCode:pin,
                 latitude:lat.trim()?Number(lat):null,
                 longitude:lng.trim()?Number(lng):null,officialPhone:phone,officialEmail:email,managerRef:manager,
                 ...(replacementFiles.length?{evidenceFiles:replacementFiles}:{})
               })}>Save operating profile</button>}
           </fieldset>}
           {canAdmin&&selected.status!=="CLOSED"&&<div className="form">
             <h4>Change branch operating status</h4>
             <div className="toolbar">
               {(selected.status==="ACTIVE"?["INACTIVE","CLOSED"]:["ACTIVE","CLOSED"]).map(nextStatus=>
                 <button type="button" key={nextStatus} disabled={busy||unknown}
                   onClick={()=>void mutate("POST",
                     "/branch-workflow/operating-branches/"+selected.branchRef+"/status",
                     {expectedVersion:selected.version,status:nextStatus})}>
                   Mark {label(nextStatus)}</button>)}
             </div></div>}
           <h3>Branch departments and committees</h3>
           {departments.length===0?<p className="cg-module-empty" role="status">No branch-scoped departments.</p>:
             <ul className="branch-draft-list">{departments.map(d=><li key={d.departmentRef}>
               {canManage&&selected.status==="ACTIVE"?<button type="button" onClick={()=>{resetDepartment(d);
                 void loadParticipants(selected.branchRef,d.departmentRef);}} disabled={busy}>
                 <strong>{d.name}</strong><span>{label(d.kind)} · {d.active?"Active":"Inactive"}</span>
               </button>:<div className="branch-department-readonly">
                 <strong>{d.name}</strong><span>{label(d.kind)} · {d.active?"Active":"Inactive"}</span>
               </div>}
             </li>)}</ul>}
           {nextDepartmentOffset!==null&&<button type="button" disabled={busy}
             onClick={()=>{
               const offset=nextDepartmentOffset;
               setBusy(true);
               void req<{departments:Department[];nextOffset:number|null}>(
                 baseRef+"/departments?offset="+offset)
                 .then(result=>{
                   setDepartments(old=>[...old.filter(x=>!result.departments.some(y=>
                     y.departmentRef===x.departmentRef)),...result.departments]);
                   setNextDepartmentOffset(result.nextOffset);
                 })
                 .catch(()=>setError("More branch departments cannot be verified."))
                 .finally(()=>setBusy(false));
             }}>Load more departments</button>}
           {canManage&&selected.status==="ACTIVE"&&<button type="button" disabled={busy||unknown}
             onClick={()=>resetDepartment()}>New branch department / committee</button>}
           {canManage&&selected.status==="ACTIVE"&&departmentDrawerOpen&&
             <dialog ref={departmentDrawerRef}
               aria-labelledby="branch-department-drawer-heading"
               className="foundation-department-sheet"
               onCancel={e=>{if(busy)e.preventDefault();}}
               onClose={()=>setDepartmentDrawerOpen(false)}>
               <header className="toolbar"><div>
                 <h3 id="branch-department-drawer-heading">
                   {editDepartment?"Edit Department / Committee":"Add New Department"}
                 </h3>
                 <p>Branch / Location: {selected.branchName}</p></div>
                 <button type="button" disabled={busy}
                   aria-label="Close department editor"
                   onClick={()=>setDepartmentDrawerOpen(false)}>Close</button></header>
               <div className="form">
             <h4>{editDepartment?"Edit branch department":"Create branch department"}</h4>
             <label className="field">Name<input maxLength={100} value={deptName}
               onChange={e=>setDeptName(e.target.value)}/></label>
             <label className="field">Type<select disabled={!!editDepartment} value={deptKind}
               onChange={e=>setDeptKind(e.target.value)}>
                 <option value="DEPARTMENT">Department</option><option value="COMMITTEE">Committee</option></select></label>
             <label className="field">Description<textarea maxLength={800} value={deptDesc}
               onChange={e=>setDeptDesc(e.target.value)}/></label>
             <label className="field">Opening date<input type="date" value={deptOpeningDate}
               onChange={e=>setDeptOpeningDate(e.target.value)}/></label>
             <label className="field">Area<select value={deptGeo} onChange={e=>setDeptGeo(e.target.value)}>
                 <option value="">Branch-wide</option>
                 {areas.map(a=><option key={a.areaRef} value={a.areaRef}>{a.name}</option>)}
               </select></label>
             <label className="field">Parent<select value={deptParent} onChange={e=>setDeptParent(e.target.value)}>
                 <option value="">No parent department</option>
                 {departments.filter(d=>d.active&&d.departmentRef!==editDepartment?.departmentRef)
                   .map(d=><option key={d.departmentRef} value={d.departmentRef}>{d.name}</option>)}</select></label>
             <label className="field">Head account<select value={deptHead} onChange={e=>setDeptHead(e.target.value)}>
                 <option value="">No head assigned</option>
                 {managers.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
               </select></label>
             {editDepartment&&<label className="field"><input type="checkbox"
               checked={deptActive} onChange={e=>setDeptActive(e.target.checked)}/> Active</label>}
             <button type="button" className="primary" disabled={busy||unknown||deptName.trim().length<2}
               onClick={()=>void mutate(editDepartment?"PATCH":"POST",
                 baseRef+"/departments"+(editDepartment?"/"+editDepartment.departmentRef:""),
                 {name:deptName,kind:deptKind,description:deptDesc,openingDate:deptOpeningDate||null,
                   geographyRef:deptGeo||null,parentRef:deptParent||null,
                   headAccountRef:deptHead||null,active:deptActive,
                   ...(editDepartment?{expectedVersion:editDepartment.version}:{})})}>
               {editDepartment?"Save department":"Create department"}</button>
             <button type="button" disabled={busy}
               onClick={()=>setDepartmentDrawerOpen(false)}>Cancel</button>
           </div></dialog>}
           {focusedDept&&<section><h4>Committee officeholders</h4>
             {participants.map(p=><div className="toolbar" key={p.participationRef}>
               <span>{p.displayName??"Historical account"} · {p.officeRole}</span>
               {canManage&&selected.status==="ACTIVE"&&!p.activeUntil&&<button type="button"
                 disabled={busy||unknown} onClick={()=>void mutate("POST",
                   baseRef+"/departments/"+focusedDept+"/participants/"+p.participationRef+"/end",{})}>
                 End assignment</button>}
             </div>)}
             {canManage&&selected.status==="ACTIVE"&&<div className="form">
               <label className="field">Foundation account<select value={participantAccount}
                 onChange={e=>setParticipantAccount(e.target.value)}>
                 <option value="">Choose eligible account</option>
                 {managers.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
               <label className="field">Officeholder responsibility<input maxLength={80}
                 value={participantRole} onChange={e=>setParticipantRole(e.target.value)}/></label>
               <button type="button" disabled={busy||unknown||!participantAccount||participantRole.trim().length<2}
                 onClick={()=>void mutate("POST",baseRef+"/departments/"+focusedDept+"/participants",
                   {accountRef:participantAccount,officeRole:participantRole})}>Assign account</button>
             </div>}</section>}
           <h3>Linked Foundation departments</h3>
           {links.map(link=><div className="toolbar" key={link.linkRef}>
             <span>{link.name} · {link.endedAt?"Ended":"Linked"}</span>
             {canManage&&selected.status==="ACTIVE"&&!link.endedAt&&<button type="button"
               disabled={busy||unknown} onClick={()=>void mutate("POST",
                 baseRef+"/department-links/"+link.linkRef+"/end",{})}>Unlink</button>}
           </div>)}
           {canManage&&selected.status==="ACTIVE"&&<div className="form">
             <label className="field">Link Foundation department<select
               value={foundationLink} onChange={e=>setFoundationLink(e.target.value)}>
               <option value="">Choose existing Foundation department</option>
               {foundationDepartments.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}
             </select></label>
             <button type="button" className="primary" disabled={busy||unknown||!foundationLink}
               onClick={()=>void mutate("POST",baseRef+"/department-links",
                 {departmentRef:foundationLink})}>Link selected department</button>
           </div>}
           <h3>Immutable operating revision history</h3>
           {history.length===0?<p className="cg-module-empty" role="status">No changes have been recorded.</p>:
             <ol>{history.map(h=><li key={h.version}>
               Revision {h.version} · {new Date(h.changedAt).toLocaleString()}</li>)}</ol>}
         </>}
       </div>
       <aside className="role-pane"><h3>Branches by status</h3>
         {totals&&totals.total>0?([
           ["Active",totals.active],["Inactive",totals.inactive],
           ["Closed",totals.closed]
         ] as const).map(([status,count])=><div className="branch-summary-row" key={status}>
           <span>{status}</span><strong>{count}</strong>
           <progress aria-label={status+" branches"} max={totals.total} value={count}/>
         </div>):<p className="cg-module-empty" role="status">No approved branch status records yet.</p>}
         <h3>Branches by type</h3>
         {branchTypes.length?branchTypes.map(type=><div className="branch-summary-row" key={type.name}>
           <span>{type.name}</span><strong>{type.total}</strong>
           <progress aria-label={type.name+" branches"}
             max={Math.max(1,totals?.total??1)} value={type.total}/>
         </div>):<p className="cg-module-empty" role="status">No approved branch types yet.</p>}
         <p className="notice">These summaries use the current permitted records.
           Staff totals and unsupported future-module statistics are not shown.</p>
       </aside>
     </div>}
 </section>;
}
