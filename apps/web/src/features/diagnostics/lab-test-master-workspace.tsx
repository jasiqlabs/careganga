"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import {
 diagnosticsCall,writeUncertain,moneyMinor,formatRupees,localDateTimeToUtc,
 type DiagnosticCategory,type DiagnosticTest,type DiagnosticPackage,
 type DiagnosticCenter,type DiagnosticMapping,type DiagnosticPrice
} from "./diagnostic-api";
type Props={canManage:boolean;canViewPricing:boolean;
 canManagePricing:boolean;canApprovePricing:boolean};
type Summary={totalTests:number;activeTests:number;categories:number;packages:number};
const samples=["BLOOD","URINE","STOOL","SALIVA","SWAB","TISSUE","OTHER","NOT_APPLICABLE"];
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
function csvCell(raw:unknown){
 const s=String(raw??"");
 return '"'+(/^[\s]*[=+\-@]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';
}
export function LabTestMasterWorkspace({canManage,canViewPricing,
 canManagePricing,canApprovePricing}:Props){
 const [summary,setSummary]=useState<Summary|null>(null);
 const [categories,setCategories]=useState<DiagnosticCategory[]>([]);
 const [tests,setTests]=useState<DiagnosticTest[]>([]);
 const [packages,setPackages]=useState<DiagnosticPackage[]>([]);
 const [centers,setCenters]=useState<DiagnosticCenter[]>([]);
 const [mappings,setMappings]=useState<DiagnosticMapping[]>([]);
 const [prices,setPrices]=useState<DiagnosticPrice[]>([]);
 const [centerRef,setCenterRef]=useState("");
 const [selectedRef,setSelectedRef]=useState("");
 const [tab,setTab]=useState("Test Information");
 const [search,setSearch]=useState("");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [uncertain,setUncertain]=useState(false);
 const keys=useRef<Record<string,string>>({});
 const centerEpoch=useRef(0);
 const [showForm,setShowForm]=useState(false),[editRef,setEditRef]=useState("");
 const [catCode,setCatCode]=useState(""),[catName,setCatName]=useState("");
 const [testCode,setTestCode]=useState(""),[testName,setTestName]=useState("");
 const [categoryRef,setCategoryRef]=useState(""),[sampleType,setSampleType]=useState("BLOOD");
 const [description,setDescription]=useState(""),[parameters,setParameters]=useState("");
 const [pkgCode,setPkgCode]=useState(""),[pkgName,setPkgName]=useState("");
 const [pkgDescription,setPkgDescription]=useState("");
 const [pkgTests,setPkgTests]=useState<{testRef:string;quantity:number}[]>([]);
 const [addTest,setAddTest]=useState("");
 const [kind,setKind]=useState<"TEST"|"PACKAGE">("TEST"),[itemRef,setItemRef]=useState("");
 const [mappingRef,setMappingRef]=useState("");
 const [basePrice,setBasePrice]=useState(""),[patientPrice,setPatientPrice]=useState("");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [discountReason,setDiscountReason]=useState("");

 const reload=useCallback(async()=>{
  const [overview,cat,t,p,lab]=await Promise.all([
   diagnosticsCall<Summary>("catalog/admin"),
   diagnosticsCall<{categories:DiagnosticCategory[]}>("categories"),
   diagnosticsCall<{tests:DiagnosticTest[]}>("tests"),
   diagnosticsCall<{packages:DiagnosticPackage[]}>("packages"),
   diagnosticsCall<{centers:DiagnosticCenter[]}>("centers/eligible")
  ]);
  setSummary(overview);setCategories(cat.categories??[]);
  setTests(t.tests??[]);setPackages(p.packages??[]);
  setCenters(lab.centers??[]);
 },[]);
 const reloadCenter=useCallback(async(ref:string)=>{
  const epoch=++centerEpoch.current;
  if(!ref){setMappings([]);setPrices([]);return;}
  const [a,p]=await Promise.all([
   diagnosticsCall<{mappings:DiagnosticMapping[]}>(
    "centers/"+encodeURIComponent(ref)+"/tests"),
   diagnosticsCall<{prices:DiagnosticPrice[]}>(
    "centers/"+encodeURIComponent(ref)+"/test-prices")
  ]);
  if(epoch===centerEpoch.current){
   setMappings(a.mappings??[]);setPrices(p.prices??[]);
  }
 },[]);
 useEffect(()=>{
  let mounted=true;
  void reload().catch(e=>{if(mounted)setError(e instanceof Error?e.message:
   "Current lab catalogue records are unavailable.");}).finally(()=>{
   if(mounted)setLoading(false);
  });
  return()=>{mounted=false;++centerEpoch.current;};
 },[reload]);
 useEffect(()=>{
  if(!canViewPricing)return;
  setMappings([]);setPrices([]);setItemRef("");setMappingRef("");
  void reloadCenter(centerRef).catch(e=>setError(e instanceof Error?e.message:
   "Center test mappings cannot be confirmed."));
 },[centerRef,canViewPricing,reloadCenter]);
 const selected=tests.find(t=>t.testRef===selectedRef)??null;
 const visible=tests.filter(t=>!search||[t.name,t.code,t.category,t.sampleType]
  .some(s=>s.toLowerCase().includes(search.toLowerCase())));
 async function change(operation:string,path:string,method:"POST"|"PATCH",
  fields:Record<string,unknown>,success:string,refreshCenter=true){
  if(busy||uncertain)return;
  const requestKey=keys.current[operation]??crypto.randomUUID();
  keys.current[operation]=requestKey;
  setBusy(true);setError("");setNotice("");
  try{
   await diagnosticsCall(path,method,{requestKey,...fields});
   delete keys.current[operation];
   await reload();
   if(refreshCenter&&canViewPricing&&centerRef)await reloadCenter(centerRef);
   setNotice(success);
  }catch(e){
   setError(e instanceof Error?e.message:"This change could not be confirmed.");
   if(writeUncertain(e))setUncertain(true);
   else delete keys.current[operation];
  }finally{setBusy(false);}
 }
 function openForm(record?:DiagnosticTest,copy=false){
  setEditRef(record&&!copy?record.testRef:"");
  setTestCode(record&&!copy?record.code:"");
  setTestName(record?(copy?record.name+" copy":record.name):"");
  setCategoryRef(record?.categoryRef??"");
  setSampleType(record?.sampleType??"BLOOD");
  setDescription(record?.clinicalDescription??"");
  setParameters(record?.parametersDescription??"");
  setShowForm(true);
 }
 function saveCategory(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  void change("category","categories","POST",{code:catCode,name:catName},
   "Category created in the Foundation catalogue.",false);
 }
 function saveTest(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const record=tests.find(x=>x.testRef===editRef);
  const fields={testCode,name:testName,categoryRef,sampleType,
   clinicalDescription:description,parametersDescription:parameters};
  if(record)void change("test-edit","tests/"+encodeURIComponent(record.testRef),
   "PATCH",{...fields,expectedVersion:record.revision,status:record.status},
   "Test details updated. Approved historical prices remain unchanged.",false);
  else void change("test-create","tests","POST",fields,
   "Diagnostic test created in the Foundation catalogue.",false);
 }
 function savePackage(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  void change("package","packages","POST",
   {packageCode:pkgCode,name:pkgName,description:pkgDescription,tests:pkgTests},
   "Package created with an immutable version of its included tests.",false);
 }
 function saveMapping(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!centerRef)return;
  void change("mapping","centers/"+encodeURIComponent(centerRef)+"/tests","POST",
   {kind,itemRef},"Test or package mapped to this verified lab.");
 }
 function savePrice(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const found=mappings.find(m=>m.mappingRef===mappingRef);
  if(!found||found.status!=="ACTIVE"){setError("Choose an active mapped test.");return;}
  try{
   const base=moneyMinor(basePrice),patient=moneyMinor(patientPrice);
   if(patient>base)throw Error("The patient commercial price cannot exceed the base price.");
   const effectiveFromUtc=localDateTimeToUtc(from,"start time");
   const effectiveToUtc=to?localDateTimeToUtc(to,"end time"):null;
   if(effectiveToUtc&&effectiveToUtc<=effectiveFromUtc)
    throw Error("The end time must be after the start time.");
   void change("price","centers/"+encodeURIComponent(centerRef)+"/test-prices","POST",
    {mappingRef,expectedMappingVersion:found.revision,effectiveFromUtc,effectiveToUtc,
     basePriceMinor:base,patientPriceMinor:patient,currency:"INR",discountReason},
    "Commercial price proposed. Another authorized reviewer must approve it.");
  }catch(e){setError(e instanceof Error?e.message:"Check the proposed price.");}
 }
 function approve(p:DiagnosticPrice){
  void change("approval:"+p.priceRef,
   "test-prices/"+encodeURIComponent(p.priceRef)+"/approve","POST",
   {expectedVersion:p.version},
   "Commercial price approved. No patient payment or Foundation contribution was recorded.");
 }
 function deactivate(){
  if(!selected||busy||uncertain||selected.status!=="ACTIVE")return;
  void change("deactivate:"+selected.testRef,
   "tests/"+encodeURIComponent(selected.testRef),"PATCH",
   {testCode:selected.code,name:selected.name,categoryRef:selected.categoryRef,
    sampleType:selected.sampleType,parametersDescription:selected.parametersDescription,
    clinicalDescription:selected.clinicalDescription,status:"INACTIVE",
    expectedVersion:selected.revision},
   "Test deactivated. Original approved price records remain preserved.");
 }
 async function exportVisible(){
  if(!visible.length||busy||uncertain)return;
  setBusy(true);setError("");
  try{
   const response=await diagnosticsCall<{tests:{
    testRef:string;code:string;name:string;category:string;
    sampleType:string;status:string
   }[];exportedCount:number}>("tests/export","POST",
    {testRefs:visible.map(t=>t.testRef)});
   if(!Array.isArray(response.tests)||response.tests.length!==visible.length)
    throw Error("Refresh this page before exporting the currently permitted tests.");
   const rows=[["Test code","Test name","Category","Sample type","Status"],
    ...response.tests.map(t=>[t.code,t.name,t.category,label(t.sampleType),t.status])];
   const blob=new Blob(["\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n")],
    {type:"text/csv;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   const link=document.createElement("a");
   link.href=url;link.download="diagnostic-tests-visible.csv";link.click();
   URL.revokeObjectURL(url);
   setNotice("Exported "+response.tests.length+" currently authorized diagnostic tests.");
  }catch(e){
   setError(e instanceof Error?e.message:"Test export could not be confirmed.");
  }finally{setBusy(false);}
 }
 return <section className="cg-health-workspace cg-diagnostics" aria-label="Lab Test Master & Pricing">
  <header className="topbar">
   <div><h1>Lab Test Master & Pricing</h1>
    <p>Maintain real tests, categories, packages and prices at approved laboratories.</p>
   </div>
   <div className="toolbar">
    <button type="button" onClick={()=>void reload().catch(e=>
     setError(e instanceof Error?e.message:"Catalogue cannot be refreshed."))}>Refresh</button>
    <button type="button" disabled={!visible.length||busy||uncertain} onClick={()=>void exportVisible()}>
     Export shown tests ({visible.length})</button>
    {canManage&&<button type="button" className="primary" onClick={()=>openForm()}>
     Add New Test</button>}
   </div>
  </header>
  {loading&&<p role="status" className="cg-module-loading">Checking original diagnostic records…</p>}
  {!!error&&<p role="alert" className="notice error">{error}</p>}
  {!!notice&&<p role="status" className="notice">{notice}</p>}
  {uncertain&&<div className="notice" role="alert">
   The result may already be saved. Refresh the original records before another change.
   <button type="button" disabled={busy} onClick={()=>void Promise.all([
    reload(),canViewPricing?reloadCenter(centerRef):Promise.resolve()
   ]).then(()=>{setUncertain(false);setError("");setNotice("Current records refreshed.");})
    .catch(e=>setError(e instanceof Error?e.message:"Records are unavailable."))}>
    Check current records</button></div>}
  {summary&&<div className="cg-diagnostics-kpis" aria-label="Current lab catalogue totals">
   {([["Total Tests",summary.totalTests],["Active Tests",summary.activeTests],
    ["Categories",summary.categories],["Active Packages",summary.packages]] as const)
    .map(([name,value])=><article key={name} className="cg-diagnostics-kpi">
     <span>{name}</span><strong>{value.toLocaleString("en-IN")}</strong></article>)}
  </div>}
  <div className="cg-diagnostics-layout">
   <section className="form-section">
    <h2>Lab Test Master List</h2>
    <label className="field">Search loaded tests
     <input type="search" value={search} maxLength={80}
      placeholder="Test name, code, category"
      onChange={e=>setSearch(e.target.value)}/></label>
    <p className="cg-diagnostics-note">Showing up to 100 source records. Export includes only the visible rows; import is not enabled.</p>
    {!loading&&!visible.length&&<p role="status" className="cg-module-empty">No matching lab tests were found.</p>}
    {!!visible.length&&<div className="table-wrap"><table className="role-table">
     <thead><tr><th>Test</th><th>Category</th><th>Sample</th><th>Status</th><th>Details</th></tr></thead>
     <tbody>{visible.map(t=><tr key={t.testRef}>
      <td><strong>{t.name}</strong><div>{t.code}</div></td>
      <td>{t.category}</td><td>{label(t.sampleType)}</td><td>{label(t.status)}</td>
      <td><button type="button" aria-pressed={selectedRef===t.testRef}
       onClick={()=>{setSelectedRef(t.testRef);setTab("Test Information");setShowForm(false);}}>
       View</button></td>
     </tr>)}</tbody></table></div>}
   </section>
   <section className="form-section cg-diagnostics-detail">
    <h2>Test Details</h2>
    {selected?<><div className="cg-diagnostics-selected"><strong>{selected.name}</strong>
     <span>{selected.code} · {label(selected.status)}</span></div>
     <div className="cg-diagnostics-tabs" role="group" aria-label="Test information sections">
      {["Test Information","Pricing & Discount","Lab Mapping","Report & Settings"].map(name=>
       <button key={name} type="button" aria-pressed={tab===name}
        onClick={()=>setTab(name)}>{name}</button>)}
     </div>
     {tab==="Test Information"&&<dl className="cg-diagnostics-facts">
      <div><dt>Category</dt><dd>{selected.category}</dd></div>
      <div><dt>Sample type</dt><dd>{label(selected.sampleType)}</dd></div>
      <div><dt>Clinical description</dt><dd>{selected.clinicalDescription||"Not recorded"}</dd></div>
      <div><dt>Parameters</dt><dd>{selected.parametersDescription||"Not recorded"}</dd></div>
     </dl>}
     {tab==="Pricing & Discount"&&<p>Select a verified lab below for its real commercial-price proposals and approval history. These are not Foundation benefits or paid invoices.</p>}
     {tab==="Lab Mapping"&&<p>Each verified lab independently maps the active tests it offers. Historical mappings remain preserved.</p>}
     {tab==="Report & Settings"&&<p>A test definition is not a patient clinical report. Sample processing and professional report release require separate approved Lab ERP readiness.</p>}
     {canManage&&<div className="toolbar">
      <button type="button" onClick={()=>openForm(selected)}>Edit details</button>
      <button type="button" onClick={()=>openForm(selected,true)}>Duplicate test</button>
      {selected.status==="ACTIVE"&&<button type="button" disabled={busy||uncertain}
       onClick={deactivate}>Deactivate</button>}
     </div>}</>:<p className="cg-module-empty">Choose a test to review its source-backed details.</p>}
   </section>
  </div>
  {canManage&&<div className="cg-diagnostics-layout">
   <section className="form-section">
    <h2>Category Master</h2>
    <form className="form-grid" onSubmit={saveCategory}>
     <label className="field">Category code<input required maxLength={24}
      value={catCode} onChange={e=>setCatCode(e.target.value)}/></label>
     <label className="field">Category name<input required maxLength={100}
      value={catName} onChange={e=>setCatName(e.target.value)}/></label>
     <button type="submit" className="primary" disabled={busy||uncertain}>
      {busy?"Saving…":"Add category"}</button>
    </form>
    {!categories.length?<p className="cg-module-empty">No categories have been recorded.</p>:
     <p>{categories.map(c=>c.name+" ("+c.code+")").join(" · ")}</p>}
   </section>
   <section className="form-section">
    <h2>Diagnostic Packages</h2>
    <p>Combine active tests into an immutable package version, without creating a lab booking.</p>
    <form onSubmit={savePackage}>
     <div className="form-grid">
      <label className="field">Package code<input required maxLength={24} value={pkgCode}
       onChange={e=>setPkgCode(e.target.value)}/></label>
      <label className="field">Package name<input required maxLength={160} value={pkgName}
       onChange={e=>setPkgName(e.target.value)}/></label>
      <label className="field">Description<input maxLength={2000} value={pkgDescription}
       onChange={e=>setPkgDescription(e.target.value)}/></label>
     </div>
     <div className="toolbar">
      <label className="field">Include an active test
       <select value={addTest} onChange={e=>setAddTest(e.target.value)}>
        <option value="">Select a test</option>
        {tests.filter(t=>t.status==="ACTIVE"&&!pkgTests.some(p=>p.testRef===t.testRef))
         .map(t=><option key={t.testRef} value={t.testRef}>{t.name} ({t.code})</option>)}
       </select></label>
      <button type="button" disabled={!addTest||busy} onClick={()=>{
       setPkgTests(prev=>[...prev,{testRef:addTest,quantity:1}]);setAddTest("");}}>
       Include test</button>
     </div>
     {pkgTests.map(p=><div key={p.testRef} className="cg-diagnostics-package-line">
      <span>{tests.find(t=>t.testRef===p.testRef)?.name??"Selected test"}</span>
      <label className="field">Quantity<input type="number" min={1} max={100}
       value={p.quantity} onChange={e=>setPkgTests(prev=>prev.map(x=>
        x.testRef===p.testRef?{...x,quantity:Number(e.target.value)}:x))}/></label>
      <button type="button" onClick={()=>setPkgTests(prev=>
       prev.filter(x=>x.testRef!==p.testRef))}>Remove</button>
     </div>)}
     <button type="submit" className="primary" disabled={!pkgTests.length||busy||uncertain}>
      Save package</button>
    </form>
    {!packages.length?<p className="cg-module-empty">No diagnostic packages recorded.</p>:
     <div className="table-wrap"><table><thead><tr><th>Package</th><th>Tests</th><th>Status</th></tr></thead>
      <tbody>{packages.map(p=><tr key={p.packageRef}>
       <td>{p.name} ({p.code})</td><td>{p.testCount}</td><td>{label(p.status)}</td>
      </tr>)}</tbody></table></div>}
   </section>
  </div>}
  {canManage&&showForm&&<section className="form-section">
   <h2>{editRef?"Edit diagnostic test":"Add diagnostic test"}</h2>
   <form onSubmit={saveTest}>
    <div className="form-grid">
     <label className="field">Test code<input required maxLength={24} value={testCode}
      disabled={!!editRef} onChange={e=>setTestCode(e.target.value)}/></label>
     <label className="field">Test name<input required maxLength={160} value={testName}
      onChange={e=>setTestName(e.target.value)}/></label>
     <label className="field">Category<select required value={categoryRef}
      onChange={e=>setCategoryRef(e.target.value)}>
       <option value="">Select an active category</option>
       {categories.filter(c=>c.status==="ACTIVE").map(c=>
        <option key={c.categoryRef} value={c.categoryRef}>{c.name}</option>)}
      </select></label>
     <label className="field">Sample type<select value={sampleType}
      onChange={e=>setSampleType(e.target.value)}>
       {samples.map(s=><option key={s} value={s}>{label(s)}</option>)}
      </select></label>
     <label className="field">General description<textarea maxLength={2000} value={description}
      onChange={e=>setDescription(e.target.value)}/></label>
     <label className="field">Test parameter information<textarea maxLength={2000}
      value={parameters} onChange={e=>setParameters(e.target.value)}/></label>
    </div>
    <div className="toolbar">
     <button className="primary" type="submit" disabled={busy||uncertain}>
      {busy?"Saving…":editRef?"Save test details":"Create test"}</button>
     <button type="button" onClick={()=>setShowForm(false)}>Cancel</button>
    </div>
   </form>
  </section>}
  {canViewPricing&&<section className="form-section">
   <h2>Center-Specific Lab Pricing</h2>
   <p>Commercial lab prices require independent approval. No payment is taken when saving a tariff.</p>
   <label className="field">Verified laboratory
    <select value={centerRef} disabled={busy||uncertain}
     onChange={e=>setCenterRef(e.target.value)}>
     <option value="">Select a current lab location</option>
     {centers.map(c=><option key={c.centerRef} value={c.centerRef}>
      {c.name} — {c.providerName} ({c.code})</option>)}
    </select></label>
   {!centerRef&&<p className="cg-module-empty">Select a lab to review mappings and prices.</p>}
   {!!centerRef&&<div className="cg-diagnostics-layout">
    <div><h3>Mapped Tests & Packages</h3>
     {!mappings.length?<p className="cg-module-empty">No tests mapped to this lab.</p>:
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Status</th></tr></thead>
       <tbody>{mappings.map(m=><tr key={m.mappingRef}>
        <td>{m.name} ({m.code})</td><td>{label(m.status)}</td>
       </tr>)}</tbody></table></div>}
     {canManage&&<form onSubmit={saveMapping}>
      <div className="form-grid">
       <label className="field">Item type<select value={kind}
        onChange={e=>{setKind(e.target.value as "TEST"|"PACKAGE");setItemRef("");}}>
         <option value="TEST">Individual test</option>
         <option value="PACKAGE">Package</option>
        </select></label>
       <label className="field">Active test or package<select required value={itemRef}
        onChange={e=>setItemRef(e.target.value)}>
         <option value="">Choose an item</option>
         {(kind==="TEST"?tests.filter(t=>t.status==="ACTIVE")
          .map(t=>({ref:t.testRef,name:t.name,code:t.code})):
          packages.filter(p=>p.status==="ACTIVE")
          .map(p=>({ref:p.packageRef,name:p.name,code:p.code})))
          .map(x=><option key={x.ref} value={x.ref}>{x.name} ({x.code})</option>)}
        </select></label>
       <button type="submit" className="primary" disabled={!itemRef||busy||uncertain}>
        Map to lab</button>
      </div>
     </form>}
     {canManagePricing&&<form onSubmit={savePrice}>
      <h3>Propose Commercial Price</h3>
      <div className="form-grid">
       <label className="field">Mapped item<select required value={mappingRef}
        onChange={e=>setMappingRef(e.target.value)}>
         <option value="">Select a mapped test</option>
         {mappings.filter(m=>m.status==="ACTIVE").map(m=>
          <option key={m.mappingRef} value={m.mappingRef}>{m.name} ({m.code})</option>)}
        </select></label>
       <label className="field">Base price (₹)<input required inputMode="decimal"
        value={basePrice} onChange={e=>setBasePrice(e.target.value)}/></label>
       <label className="field">Patient price (₹)<input required inputMode="decimal"
        value={patientPrice} onChange={e=>setPatientPrice(e.target.value)}/></label>
       <label className="field">Effective from<input required type="datetime-local" value={from}
        onChange={e=>setFrom(e.target.value)}/></label>
       <label className="field">Effective until (optional)<input type="datetime-local" value={to}
        onChange={e=>setTo(e.target.value)}/></label>
       <label className="field">Discount reason (optional)<input maxLength={240}
        value={discountReason} onChange={e=>setDiscountReason(e.target.value)}/></label>
      </div>
      <button type="submit" className="primary" disabled={busy||uncertain}>
       Propose price</button>
     </form>}
    </div>
    <div><h3>Actual Price Proposals</h3>
     {!prices.length?<p className="cg-module-empty">No price proposals for this lab yet.</p>:
      <div className="table-wrap"><table><thead><tr><th>Item</th><th>Price</th>
       <th>Period</th><th>Status</th><th>Review</th></tr></thead>
       <tbody>{prices.map(p=><tr key={p.priceRef}>
        <td>{mappings.find(m=>m.mappingRef===p.mappingRef)?.name??"Mapped item"}</td>
        <td>{formatRupees(p.patientPriceMinor)}<div>
         Base {formatRupees(p.basePriceMinor)}</div></td>
        <td>{new Date(p.effectiveFromUtc).toLocaleDateString("en-IN")}
         {p.effectiveToUtc?" – "+new Date(p.effectiveToUtc).toLocaleDateString("en-IN"):" onward"}</td>
        <td>{label(p.status)}</td><td>
         {canApprovePricing&&p.status==="PROPOSED"?
          <button type="button" disabled={busy||uncertain} onClick={()=>approve(p)}>
           Approve after review</button>:"—"}</td>
       </tr>)}</tbody></table></div>}
    </div>
   </div>}
  </section>}
  <p className="cg-diagnostics-note">The optional Lab ERP is separate. Catalogue changes do not create patient bookings, clinical reports or payment records.</p>
 </section>;
}
