"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {blankCenter,CenterEditor,type CenterDraft} from "./center-editor";
import {HealthEvidenceUploader} from "./health-evidence-uploader";
import {CenterRepresentatives} from "./center-representatives";
type ProviderDraft={providerCode:string;legalName:string;providerType:string;
 contactName:string;contactPhone:string;contactEmail:string;registrationRef:string};
type Row={providerRef:string;code:string;name:string;type:string;
 status:string;version:number;centerCount:number};
type Detail={provider:{providerRef:string;code:string;name:string;status:string;version:number;
 type:string;contactName:string;contactPhone:string;
 contactEmail:string|null;registrationRef:string|null};centers:{
 centerRef:string;code:string;name:string;type:string;status:string;version:number}[]};
type Option={value:string;label:string};
type CenterDetail={centerRef:string;version:number;center:CenterDraft};
const types=[["HOSPITAL","Hospital"],["CLINIC","Clinic"],
 ["DIAGNOSTIC_LAB","Diagnostic lab"],["PHARMACY","Pharmacy"],
 ["NURSING","Nursing center"],["OTHER","Other provider"]] as const;
const emptyProvider=():ProviderDraft=>({providerCode:"",legalName:"",providerType:"CLINIC",
 contactName:"",contactPhone:"",contactEmail:"",registrationRef:""});
async function api<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:object):Promise<T>{
  const response=await fetch("/api/health-network/"+path,{
    method,credentials:"same-origin",cache:"no-store",
    ...(body?{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})
  });
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error(
    raw&&typeof raw==="object"&&"message" in raw&&typeof raw.message==="string"?
      raw.message:"Healthcare request cannot be confirmed."),{status:response.status});
  return raw as T;
}
function ProviderFields({value,onChange}:{value:ProviderDraft;
 onChange:(next:ProviderDraft)=>void}){
  const provider=value,setProvider=onChange;
  return <div className="form-grid">
        <label className="field">Provider code
          <input required maxLength={24} value={provider.providerCode}
            onChange={e=>setProvider({...provider,providerCode:e.target.value.toUpperCase()})}/>
        </label>
        <label className="field">Legal organization name
          <input required maxLength={180} value={provider.legalName}
            onChange={e=>setProvider({...provider,legalName:e.target.value})}/>
        </label>
        <label className="field">Organization type
          <select value={provider.providerType} onChange={e=>setProvider({
            ...provider,providerType:e.target.value})}>
            {types.map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="field">Contact person
          <input required maxLength={120} value={provider.contactName}
            onChange={e=>setProvider({...provider,contactName:e.target.value})}/>
        </label>
        <label className="field">Registered contact number
          <input required type="tel" maxLength={16} value={provider.contactPhone}
            onChange={e=>setProvider({...provider,contactPhone:e.target.value})}/>
        </label>
        <label className="field">Email (optional)
          <input type="email" maxLength={180} value={provider.contactEmail}
            onChange={e=>setProvider({...provider,contactEmail:e.target.value})}/>
        </label>
        <label className="field">Registration reference (optional)
          <input maxLength={120} value={provider.registrationRef}
            onChange={e=>setProvider({...provider,registrationRef:e.target.value})}/>
        </label>
      </div>;
}
export function ProviderOnboarding({canManage,canSelectAccounts,canViewFinance,canManageFinance,
 canVerify,canActivate,canPublish}:{
 canManage:boolean;canSelectAccounts:boolean;canViewFinance:boolean;canManageFinance:boolean;
 canVerify:boolean;canActivate:boolean;canPublish:boolean
}){
  const [list,setList]=useState<Row[]>([]);
  const [selected,setSelected]=useState<Detail|null>(null);
  const [provider,setProvider]=useState(emptyProvider);
  const [centers,setCenters]=useState<CenterDraft[]>([blankCenter()]);
  const [mode,setMode]=useState<"list"|"create">("list");
  const [editingProvider,setEditingProvider]=useState(false);
  const [centerEditor,setCenterEditor]=useState<{
    centerRef:string|null;version:number;value:CenterDraft}|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [notice,setNotice]=useState(""),[error,setError]=useState("");
  const [uncertain,setUncertain]=useState(false);
  const [options,setOptions]=useState<Option[]>([]);
  const [representativeRefresh,setRepresentativeRefresh]=useState(0);
  const [account,setAccount]=useState("");
  const [bankProof,setBankProof]=useState("");
  const [providerProof,setProviderProof]=useState("");
  const [centerProofs,setCenterProofs]=useState<Record<string,string>>({});
  const [accessPassword,setAccessPassword]=useState("");
  const [publicationPassword,setPublicationPassword]=useState("");
  const [publicSlug,setPublicSlug]=useState("");
  const reviewRequestKeys=useRef<Record<string,string>>({});
  const [existingBankProof,setExistingBankProof]=useState("");
  const [maskedLabel,setMaskedLabel]=useState("");
  const [bankVersion,setBankVersion]=useState(0);
  const key=useRef("");
  const initial=useRef(true);
  const loadList=useCallback(async()=>{
    const rows=await api<{providers:Row[]}>("providers");
    if(!Array.isArray(rows.providers))throw Error("Healthcare list is incomplete");
    setList(rows.providers);
  },[]);
  const loadDetail=useCallback(async(ref:string)=>{
    const details=await api<Detail>("providers/"+encodeURIComponent(ref));
    if(!details?.provider||!Array.isArray(details.centers))
      throw Error("Provider source is not available");
    setSelected(details);
    return details;
  },[]);
  useEffect(()=>{
    if(!initial.current)return;
    initial.current=false;
    void loadList().catch(e=>setError(e instanceof Error?e.message:"Providers unavailable."))
      .finally(()=>setLoading(false));
  },[loadList]);
  async function open(ref:string){
    setError("");setNotice("");setCenterEditor(null);setBankProof("");setExistingBankProof("");
    setEditingProvider(false);setProviderProof("");setCenterProofs({});
    setAccessPassword("");setPublicationPassword("");
    try{
      await loadDetail(ref);
      if(canViewFinance){
        const result=await api<{reference:{maskedLabel:string;fileRef:string;version:number}|null}>(
          "providers/"+encodeURIComponent(ref)+"/finance-reference");
        setMaskedLabel(result.reference?.maskedLabel??"");
        setExistingBankProof(result.reference?.fileRef??"");
        setBankVersion(result.reference?.version??0);
      }
    }catch(e){setSelected(null);setError(e instanceof Error?e.message:"Provider unavailable");}
  }
  async function submitCreate(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!canManage||busy||uncertain)return;
    setBusy(true);setError("");setNotice("");
    if(!key.current)key.current=crypto.randomUUID();
    try{
      const saved=await api<{providerRef:string;status:string}>("providers","POST",{
        requestKey:key.current,
        provider:{...provider,contactEmail:provider.contactEmail||null,
          registrationRef:provider.registrationRef||null},
        centers
      });
      if(!saved.providerRef)throw Error("Provider creation was not confirmed.");
      setMode("list");setProvider(emptyProvider());setCenters([blankCenter()]);
      key.current="";setUncertain(false);
      await loadList();await open(saved.providerRef);
      setNotice("Provider and pending centers saved. Verification is a separate step.");
    }catch(e){
      setError(e instanceof Error?e.message:"Provider save outcome uncertain.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status>=400&&e.status<500))
        setUncertain(true);
    }finally{setBusy(false);}
  }
  async function saveProvider(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!selected||!canManage||busy||uncertain)return;
    setBusy(true);setError("");setNotice("");
    if(!key.current)key.current=crypto.randomUUID();
    try{
      await api("providers/"+encodeURIComponent(selected.provider.providerRef),"PATCH",{
        requestKey:key.current,expectedVersion:selected.provider.version,
        provider:{...provider,contactEmail:provider.contactEmail||null,
          registrationRef:provider.registrationRef||null}
      });
      key.current="";setEditingProvider(false);
      await loadDetail(selected.provider.providerRef);await loadList();
      setNotice("Pending provider details saved. Verification is still required.");
    }catch(e){
      setError(e instanceof Error?e.message:"Provider correction result cannot be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
         typeof e.status==="number"&&e.status>=400&&e.status<500))
        setUncertain(true);
    }finally{setBusy(false);}
  }
  async function saveCenter(){
    if(!selected||!centerEditor||busy||uncertain)return;
    setBusy(true);setError("");setNotice("");
    if(!key.current)key.current=crypto.randomUUID();
    try{
      if(centerEditor.centerRef){
        await api("centers/"+encodeURIComponent(centerEditor.centerRef),"PATCH",{
          requestKey:key.current,expectedVersion:centerEditor.version,center:centerEditor.value
        });
      }else{
        await api("providers/"+encodeURIComponent(selected.provider.providerRef)+"/centers","POST",{
          requestKey:key.current,expectedVersion:selected.provider.version,center:centerEditor.value
        });
      }
      const ref=selected.provider.providerRef;
      setCenterEditor(null);key.current="";
      await loadDetail(ref);await loadList();
      setNotice("Pending center saved without approval or public publication.");
    }catch(e){
      setError(e instanceof Error?e.message:"Center save unconfirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status>=400&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function editCenter(ref:string){
    setError("");setNotice("");setCenterEditor(null);
    try{
      const item=await api<CenterDetail>("centers/"+encodeURIComponent(ref));
      if(!item?.center)throw Error("Pending center unavailable");
      setCenterEditor({centerRef:ref,version:item.version,value:item.center});
      key.current="";
    }catch(e){setError(e instanceof Error?e.message:"Center unavailable.");}
  }
  useEffect(()=>{
    if(!selected||!canSelectAccounts)return;
    let live=true;
    void fetch("/api/health-network/representatives/options",{cache:"no-store"})
      .then(async r=>{
        if(!r.ok)throw Error("Eligible staff options unavailable");
        return r.json() as Promise<{options:Option[]}>;
      }).then(r=>{if(live)setOptions(Array.isArray(r.options)?r.options:[]);})
      .catch(()=>{if(live)setOptions([]);});
    return()=>{live=false;};
  },[selected?.provider.providerRef,canSelectAccounts]);
  async function assign(centerRef:string){
    if(!canManage||!canSelectAccounts||busy||!account)return;
    setBusy(true);setError("");setNotice("");
    try{
      await api("centers/"+encodeURIComponent(centerRef)+"/representatives","POST",{
        requestKey:crypto.randomUUID(),accountRef:account
      });
      setNotice("Staff member assigned to edit this pending center only.");
      setRepresentativeRefresh(previous=>previous+1);
      setAccount("");
    }catch(e){setError(e instanceof Error?e.message:"Staff assignment was not confirmed.");}
    finally{setBusy(false);}
  }
  async function submitProviderForReview(){
    if(!selected||busy||uncertain||!canManage||!providerProof||selected.provider.status!=="PENDING")
      return;
    const ref=selected.provider.providerRef;
    const key="provider:"+ref;
    if(!reviewRequestKeys.current[key])reviewRequestKeys.current[key]=crypto.randomUUID();
    setBusy(true);setError("");setNotice("");
    try{
      await api("providers/"+encodeURIComponent(ref)+"/submit","POST",{
        requestKey:reviewRequestKeys.current[key],
        expectedVersion:selected.provider.version,proofFileRef:providerProof
      });
      delete reviewRequestKeys.current[key];
      setProviderProof("");
      await loadDetail(ref);await loadList();
      setNotice("Provider evidence submitted for independent approval. No center access was enabled.");
    }catch(e){
      setError(e instanceof Error?e.message:"Provider submission result cannot be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function submitCenterForReview(centerRef:string,expectedVersion:number){
    if(!selected||busy||uncertain||!canManage||!centerProofs[centerRef]||
      selected.provider.status!=="VERIFIED")return;
    const key="center:"+centerRef;
    if(!reviewRequestKeys.current[key])reviewRequestKeys.current[key]=crypto.randomUUID();
    setBusy(true);setError("");setNotice("");
    try{
      await api("centers/"+encodeURIComponent(centerRef)+"/submit","POST",{
        requestKey:reviewRequestKeys.current[key],expectedVersion,
        proofFileRef:centerProofs[centerRef]
      });
      delete reviewRequestKeys.current[key];
      setCenterProofs(old=>({...old,[centerRef]:""}));
      await loadDetail(selected.provider.providerRef);await loadList();
      setNotice("Center licence submitted for independent review. Public listing remains disabled.");
    }catch(e){
      setError(e instanceof Error?e.message:"Center submission result cannot be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function changeAccess(centerRef:string,version:number,enabled:boolean){
    if(!canActivate||busy||uncertain||!accessPassword)return;
    setBusy(true);setError("");setNotice("");
    const key="access:"+centerRef;
    if(!reviewRequestKeys.current[key])reviewRequestKeys.current[key]=crypto.randomUUID();
    try{
      await api("centers/"+encodeURIComponent(centerRef)+"/access","POST",{
        requestKey:reviewRequestKeys.current[key],expectedVersion:version,
        enabled,currentPassword:accessPassword
      });
      delete reviewRequestKeys.current[key];setAccessPassword("");
      if(selected)await loadDetail(selected.provider.providerRef);
      setNotice(enabled?"Verified center access enabled. Publication remains a separate action.":
        "Center access disabled and public listing withdrawn.");
    }catch(e){
      setError(e instanceof Error?e.message:"Access change outcome cannot be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function changePublication(centerRef:string,version:number,published:boolean){
    if(!canPublish||busy||uncertain||!publicationPassword)return;
    setBusy(true);setError("");setNotice("");
    const key="publish:"+centerRef;
    if(!reviewRequestKeys.current[key])reviewRequestKeys.current[key]=crypto.randomUUID();
    try{
      await api("centers/"+encodeURIComponent(centerRef)+"/publication","POST",{
        requestKey:reviewRequestKeys.current[key],expectedVersion:version,
        published,slug:published?publicSlug:null,currentPassword:publicationPassword
      });
      delete reviewRequestKeys.current[key];setPublicationPassword("");
      if(selected)await loadDetail(selected.provider.providerRef);
      setNotice(published?
        "Verified center listing published. Booking and payment remain unavailable.":
        "Center public listing withdrawn.");
    }catch(e){
      setError(e instanceof Error?e.message:"Publication outcome cannot be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function saveBank(){
    if(!selected||!bankProof||!canManageFinance||busy)return;
    setBusy(true);setError("");
    try{
      const result=await api<{version:number}>(
        "providers/"+encodeURIComponent(selected.provider.providerRef)+"/finance-reference","POST",{
          requestKey:crypto.randomUUID(),expectedVersion:bankVersion,
          fileRef:bankProof,maskedLabel
        });
      setBankVersion(result.version);setExistingBankProof(bankProof);setBankProof("");
      setNotice("Masked settlement reference saved with verified private document.");
    }catch(e){setError(e instanceof Error?e.message:"Private bank reference could not be confirmed.");}
    finally{setBusy(false);}
  }
  return <div className="role-workspace">
    <header className="topbar"><div><h1>Healthcare providers</h1>
      <p>Register organizations and centers, review private evidence and publish only independently verified services.</p></div>
      {canVerify&&<Link href="/admin/health-network/reviews">Review submitted registrations</Link>}
      {canManage&&<button className="primary" type="button" onClick={()=>{
        setMode("create");setSelected(null);setCenterEditor(null);
        setProvider(emptyProvider());setCenters([blankCenter()]);
        setError("");setNotice("");setUncertain(false);key.current="";
      }}>Add provider</button>}
    </header>
    {loading&&<p role="status">Loading current providers…</p>}
    {!!error&&<p role="alert" className="notice error">{error}</p>}
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {uncertain&&<div role="alert" className="notice">
      A change may have been saved. Check the original provider list before submitting it again.
      <button type="button" onClick={()=>{setUncertain(false);void loadList();}}>Refresh original records</button>
    </div>}
    {mode==="create"&&canManage&&<form onSubmit={event=>void submitCreate(event)} className="form">
      <h2>Provider registration</h2>
      <ProviderFields value={provider} onChange={setProvider}/>
      {centers.map((center,index)=><section key={index} className="form-section">
        <h3>Operating center {index+1}</h3>
        <CenterEditor value={center} disabled={busy} onChange={value=>
          setCenters(prev=>prev.map((x,i)=>i===index?value:x))}/>
        {centers.length>1&&<button type="button" disabled={busy}
          onClick={()=>setCenters(prev=>prev.filter((_,i)=>i!==index))}>Remove center</button>}
      </section>)}
      <div className="toolbar">
        <button type="button" disabled={busy||centers.length>=10}
          onClick={()=>setCenters(prev=>[...prev,blankCenter()])}>Add another center</button>
        <button type="submit" className="primary" disabled={busy||uncertain}>
          {busy?"Saving…":"Save pending provider"}</button>
        <button type="button" disabled={busy} onClick={()=>setMode("list")}>Cancel</button>
      </div>
    </form>}
    {mode==="list"&&<>
      {!loading&&list.length===0&&<p>No provider applications yet. Add a provider to begin.</p>}
      <div className="table-wrap"><table><thead><tr><th>Organization</th><th>Type</th>
        <th>Centers</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {list.map(x=><tr key={x.providerRef}><td>{x.name}</td><td>{x.type}</td>
          <td>{x.centerCount}</td><td>{x.status.replaceAll("_"," ")}</td><td>
            <button type="button" onClick={()=>void open(x.providerRef)}>View draft</button>
          </td></tr>)}
      </tbody></table></div>
      {selected&&<section className="form-section">
        <h2>{selected.provider.name}</h2><p>Provider status: {selected.provider.status.replaceAll("_"," ")}.
          {selected.provider.status!=="VERIFIED"?" Centers cannot be publicly published.":""}</p>
        <p>Contact: {selected.provider.contactName} · {selected.provider.contactPhone}</p>
        {canManage&&selected.provider.status==="PENDING"&&<button type="button" onClick={()=>{
          setProvider({providerCode:selected.provider.code,legalName:selected.provider.name,
            providerType:selected.provider.type,contactName:selected.provider.contactName,
            contactPhone:selected.provider.contactPhone,
            contactEmail:selected.provider.contactEmail??"",
            registrationRef:selected.provider.registrationRef??""});
          key.current="";setEditingProvider(true);
        }}>Edit pending provider</button>}
        {editingProvider&&canManage&&<form className="form-section"
          onSubmit={event=>void saveProvider(event)}>
          <h3>Correct pending provider details</h3>
          <ProviderFields value={provider} onChange={setProvider}/>
          <div className="toolbar">
            <button type="submit" className="primary" disabled={busy||uncertain}>
              Save corrections</button>
            <button type="button" onClick={()=>setEditingProvider(false)}>Cancel</button>
          </div>
        </form>}
        <div className="toolbar">{canManage&&selected.provider.status==="PENDING"&&<button type="button" onClick={()=>{
          key.current="";setCenterEditor({centerRef:null,version:0,value:blankCenter()});
        }}>Add location</button>}</div>
        {selected.centers.map(center=><section key={center.centerRef} className="form-section">
          <h3>{center.name}</h3>
          <p>{center.type.replaceAll("_"," ")} · {center.status.replaceAll("_"," ")}</p>
          {canManage&&center.status==="PENDING"&&<button type="button" onClick={()=>void editCenter(center.centerRef)}>
            Edit pending center</button>}
          {canSelectAccounts&&canManage&&center.status==="PENDING"&&<div className="toolbar">
            <label className="field">Eligible representative
              <select value={account} onChange={e=>setAccount(e.target.value)}>
                <option value="">Choose active staff</option>
                {options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={!account||busy}
              onClick={()=>void assign(center.centerRef)}>Assign to this center</button>
          </div>}
          {canManage&&<CenterRepresentatives centerRef={center.centerRef}
            canRevoke={canManage} refresh={representativeRefresh}/>}
          {canManage&&center.status==="PENDING"&&
            <HealthEvidenceUploader providerRef={selected.provider.providerRef}
            centerRef={center.centerRef} sourceVersion={center.version}
            classification="HEALTH_CENTER_LICENSE"
            onVerified={fileRef=>setCenterProofs(prev=>({...prev,
              [center.centerRef]:fileRef}))}/>}
          {canManage&&center.status==="PENDING"&&selected.provider.status==="VERIFIED"&&
            <button type="button" className="primary" disabled={busy||uncertain||
              !centerProofs[center.centerRef]}
              onClick={()=>void submitCenterForReview(center.centerRef,center.version)}>
              Submit center licence for review</button>}
        </section>)}
        {centerEditor&&canManage&&<div className="form-section">
          <h3>{centerEditor.centerRef?"Edit current center":"Add pending center"}</h3>
          <CenterEditor value={centerEditor.value} disabled={busy}
            onChange={value=>setCenterEditor(prev=>prev?{...prev,value}:null)}/>
          <div className="toolbar">
            <button type="button" className="primary" disabled={busy||uncertain}
              onClick={()=>void saveCenter()}>Save center</button>
            <button type="button" onClick={()=>setCenterEditor(null)}>Cancel</button>
          </div>
        </div>}
        {canManage&&selected.provider.status==="PENDING"&&<section>
          <h3>Private provider proof</h3>
          <HealthEvidenceUploader providerRef={selected.provider.providerRef}
            sourceVersion={selected.provider.version}
            classification="HEALTH_PROVIDER_REGISTRATION"
            onVerified={fileRef=>setProviderProof(fileRef)}/>
          <button type="button" className="primary"
            disabled={busy||uncertain||!providerProof}
            onClick={()=>void submitProviderForReview()}>
            Submit provider for independent verification</button>
        </section>}
        {canManageFinance&&<section className="form-section"><h3>Protected settlement reference</h3>
          <p>Enter only a masked display label. The full bank document stays in CG-19 private storage.</p>
          {!!existingBankProof&&<p>
            <a href={"/api/documents/health-draft/files/"+encodeURIComponent(existingBankProof)+"/download"}>
              View current private bank proof</a></p>}
          <HealthEvidenceUploader providerRef={selected.provider.providerRef}
            sourceVersion={selected.provider.version} classification="HEALTH_BANK_PROOF"
            onVerified={ref=>setBankProof(ref)}/>
          <div className="toolbar">
            <label className="field">Masked bank label
              <input value={maskedLabel} maxLength={60} placeholder="Bank ****1234"
                onChange={e=>setMaskedLabel(e.target.value)}/>
            </label>
            <button type="button" disabled={!bankProof||busy}
              onClick={()=>void saveBank()}>Save protected reference</button>
          </div>
        </section>}
        {!canManageFinance&&canViewFinance&&<p>
          {existingBankProof?<>
            Masked settlement reference: {maskedLabel}.{" "}
            <a href={"/api/documents/health-draft/files/"+encodeURIComponent(existingBankProof)+"/download"}>
              View private verified proof</a>
          </>:"No current protected settlement reference is available."}
        </p>}
      </section>}
    </>}
  </div>;
}
