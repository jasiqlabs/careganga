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
 centerRef:string;code:string;name:string;type:string;status:string;version:number;
 accessState:string;publicationState:string;publicSlug:string|null;publicationGeneration:number}[]};
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
  const [listStatus,setListStatus]=useState("ALL");
  const [listSearch,setListSearch]=useState("");
  const [appliedListSearch,setAppliedListSearch]=useState("");
  const [nextListOffset,setNextListOffset]=useState<number|null>(null);
  const [listPageLoading,setListPageLoading]=useState(false);
  const listRequest=useRef(0),detailRequest=useRef(0);
  const [detailLoading,setDetailLoading]=useState(false);
  const activeProvider=useRef("");
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
  const [suspensionPassword,setSuspensionPassword]=useState("");
  const [publicSlug,setPublicSlug]=useState("");
  const reviewRequestKeys=useRef<Record<string,string>>({});
  const [existingBankProof,setExistingBankProof]=useState("");
  const [maskedLabel,setMaskedLabel]=useState("");
  const [bankVersion,setBankVersion]=useState(0);
  const key=useRef("");
  const loadList=useCallback(async(offset=0)=>{
    const requestId=++listRequest.current;
    const query=new URLSearchParams({
      offset:String(offset),status:listStatus,q:appliedListSearch
    });
    const rows=await api<{providers:Row[];nextOffset:number|null}>(
      "providers?"+query.toString());
    if(requestId!==listRequest.current)return;
    if(!Array.isArray(rows.providers))throw Error("Healthcare list is incomplete");
    if(offset===0)setList(rows.providers);
    else setList(previous=>{
      const seen=new Set(previous.map(x=>x.providerRef));
      return [...previous,...rows.providers.filter(x=>!seen.has(x.providerRef))];
    });
    setNextListOffset(Number.isSafeInteger(rows.nextOffset)?rows.nextOffset:null);
  },[listStatus,appliedListSearch]);
  const loadDetail=useCallback(async(ref:string)=>{
    const details=await api<Detail>("providers/"+encodeURIComponent(ref));
    if(details?.provider?.providerRef!==ref||!Array.isArray(details.centers))
      throw Error("Provider source is not available");
    if(activeProvider.current===ref)setSelected(details);
    return details;
  },[]);
  useEffect(()=>{
    detailRequest.current++;activeProvider.current="";setDetailLoading(false);
    setLoading(true);setList([]);setNextListOffset(null);setSelected(null);
    void loadList().catch(e=>setError(e instanceof Error?e.message:"Providers unavailable."))
      .finally(()=>setLoading(false));
  },[loadList]);
  async function loadMoreProviders(){
    if(nextListOffset===null||loading||listPageLoading)return;
    setListPageLoading(true);
    try{await loadList(nextListOffset);}
    catch(e){setError(e instanceof Error?e.message:"Additional providers are unavailable.");}
    finally{setListPageLoading(false);}
  }
  async function open(ref:string){
    const turn=++detailRequest.current;activeProvider.current=ref;
    setDetailLoading(true);setSelected(null);setMaskedLabel("");setBankVersion(0);
    setError("");setNotice("");setCenterEditor(null);setBankProof("");setExistingBankProof("");
    setEditingProvider(false);setProviderProof("");setCenterProofs({});
    setAccessPassword("");setPublicationPassword("");setSuspensionPassword("");
    try{
      await loadDetail(ref);
      if(turn!==detailRequest.current)return;
      if(canViewFinance){
        const result=await api<{reference:{maskedLabel:string;fileRef:string;version:number}|null}>(
          "providers/"+encodeURIComponent(ref)+"/finance-reference");
        if(turn!==detailRequest.current)return;
        setMaskedLabel(result.reference?.maskedLabel??"");
        setExistingBankProof(result.reference?.fileRef??"");
        setBankVersion(result.reference?.version??0);
      }
    }catch(e){if(turn===detailRequest.current){activeProvider.current="";setSelected(null);setError(e instanceof Error?e.message:"Provider unavailable");}}
    finally{if(turn===detailRequest.current)setDetailLoading(false);}
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
      const center=selected?.centers.find(c=>c.centerRef===centerRef);
      setNotice(center?.status==="VERIFIED"?
        center.accessState==="ENABLED"?
          "Representative assigned to this active center only.":
          "Representative recorded. Center access remains disabled until Foundation activation.":
        "Staff member assigned to edit this pending center only.");
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
  async function suspendOriginal(kind:"providers"|"centers",ref:string,version:number){
    if(!canVerify||busy||uncertain||suspensionPassword.length<8)return;
    setBusy(true);setError("");setNotice("");
    const stable="suspend:"+kind+":"+ref;
    if(!reviewRequestKeys.current[stable])
      reviewRequestKeys.current[stable]=crypto.randomUUID();
    try{
      await api(kind+"/"+encodeURIComponent(ref)+"/suspend","POST",{
        requestKey:reviewRequestKeys.current[stable],expectedVersion:version,
        currentPassword:suspensionPassword
      });
      delete reviewRequestKeys.current[stable];
      setSuspensionPassword("");
      if(selected)await loadDetail(selected.provider.providerRef);
      await loadList();
      setNotice(kind==="providers"?
        "Provider suspended. Its centers are no longer publicly visible or active.":
        "Center suspended. Its access and public listing have been withdrawn.");
    }catch(e){
      setError(e instanceof Error?e.message:"Suspension outcome could not be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function reopenOriginal(kind:"providers"|"centers",ref:string,version:number){
    if(!canVerify||busy||uncertain||suspensionPassword.length<8)return;
    setBusy(true);setError("");setNotice("");
    const stable="reopen:"+kind+":"+ref;
    if(!reviewRequestKeys.current[stable])
      reviewRequestKeys.current[stable]=crypto.randomUUID();
    try{
      await api(kind+"/"+encodeURIComponent(ref)+"/reopen","POST",{
        requestKey:reviewRequestKeys.current[stable],expectedVersion:version,
        currentPassword:suspensionPassword
      });
      delete reviewRequestKeys.current[stable];
      setSuspensionPassword("");
      if(selected)await loadDetail(selected.provider.providerRef);
      await loadList();
      setNotice(kind==="providers"?
        "Provider reopened as a draft. A new secure proof and independent review are mandatory.":
        "Center reopened as a draft. New license verification is required; it is not active or published.");
    }catch(e){
      setError(e instanceof Error?e.message:"Reopening cannot be confirmed.");
      if(!(e&&typeof e==="object"&&"status" in e&&
        typeof e.status==="number"&&e.status<500))setUncertain(true);
    }finally{setBusy(false);}
  }
  async function saveBank(){
    if(!selected||!bankProof||!canManageFinance||busy||uncertain)return;
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
      <div className="toolbar cg-module-header-actions">
      {canVerify&&<Link href="/admin/health-network/reviews">Review submitted registrations</Link>}
      {canManage&&<button className="primary" type="button" disabled={busy||uncertain||detailLoading||mode==="create"} onClick={()=>{
        detailRequest.current++;activeProvider.current="";setMode("create");setSelected(null);setCenterEditor(null);
        setProvider(emptyProvider());setCenters([blankCenter()]);
        setError("");setNotice("");setUncertain(false);key.current="";
      }}>Add provider</button>}
      </div>
    </header>
    {loading&&<p role="status" className="cg-module-loading">Loading current providers…</p>}
    {!!error&&<p role="alert" className="notice error">{error}</p>}
    {!!notice&&<p role="status" className="notice">{notice}</p>}
    {uncertain&&<div role="alert" className="notice">
      A change may have been saved. Check the original provider list before submitting it again.
      <button type="button" onClick={()=>{setUncertain(false);void loadList();}}>Refresh original records</button>
    </div>}
    {mode==="create"&&canManage&&<form onSubmit={event=>void submitCreate(event)} className="form">
      <h2>Provider registration</h2>
      <p className="muted">Enter the organization details, then add each operating center. Verification is a separate step.</p>
      <fieldset className="form-section" disabled={busy||uncertain}>
        <legend>1. Organization and contact details</legend>
        <ProviderFields value={provider} onChange={setProvider}/>
      </fieldset>
      <h3>2. Operating centers ({centers.length})</h3>
      {centers.map((center,index)=><section key={index} className="form-section">
        <h3>{index+1}. {center.displayName.trim()||"New operating center"}</h3>
        <CenterEditor value={center} disabled={busy||uncertain} onChange={value=>
          setCenters(prev=>prev.map((x,i)=>i===index?value:x))}/>
        {centers.length>1&&<button type="button" disabled={busy||uncertain}
          onClick={()=>{if(window.confirm("Remove this unsaved center?"))setCenters(prev=>prev.filter((_,i)=>i!==index));}}>Remove center</button>}
      </section>)}
      <div className="toolbar">
        <button type="button" disabled={busy||uncertain||centers.length>=10}
          onClick={()=>setCenters(prev=>[...prev,blankCenter()])}>Add another center</button>
        <button type="submit" className="primary" disabled={busy||uncertain}>
          {busy?"Saving…":"Save pending provider"}</button>
        <button type="button" disabled={busy||uncertain} onClick={()=>{if(window.confirm("Discard this unsaved provider registration?"))setMode("list");}}>Cancel</button>
      </div>
    </form>}
    {mode==="list"&&<>
      <form className="form-section" onSubmit={e=>{
        e.preventDefault();if(!busy&&!uncertain&&!detailLoading)setAppliedListSearch(listSearch.trim());
      }}>
        <h2>Find healthcare providers</h2>
        <div className="form-grid">
          <label className="field">Organization name or provider code
            <input type="search" maxLength={80} value={listSearch}
              onChange={e=>setListSearch(e.target.value)}
              placeholder="Search registered organizations"/>
          </label>
          <label className="field">Registration status
            <select value={listStatus} disabled={busy||uncertain||detailLoading} onChange={e=>setListStatus(e.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending draft</option>
              <option value="SUBMITTED">Submitted for review</option>
              <option value="RETURNED">Returned for corrections</option>
              <option value="REJECTED">Rejected</option>
              <option value="VERIFIED">Verified</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </label>
        </div>
        <div className="toolbar">
          <button type="submit" className="primary" disabled={busy||uncertain||detailLoading}>Apply search</button>
          <button type="button" disabled={busy||uncertain||detailLoading} onClick={()=>{
            setListStatus("ALL");setListSearch("");setAppliedListSearch("");
          }}>Reset filters</button>
        </div>
        {!loading&&<p role="status" className="muted">
          {list.length} matching providers loaded{nextListOffset!==null?" — more available":""}.
        </p>}
      </form>
      {!loading&&list.length===0&&
        <p className="cg-module-empty" role="status">No providers match the current filters. Reset filters or register a provider.</p>}
      <div className="table-wrap"><table><thead><tr><th>Organization</th><th>Type</th>
        <th>Centers</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {list.map(x=><tr key={x.providerRef}><td>{x.name}</td><td>{x.type}</td>
          <td>{x.centerCount}</td><td>{x.status.replaceAll("_"," ")}</td><td>
            <button type="button" disabled={busy||uncertain||detailLoading||loading} onClick={()=>void open(x.providerRef)}>View draft</button>
          </td></tr>)}
      </tbody></table></div>
      {nextListOffset!==null&&<div className="toolbar">
        <button type="button" disabled={listPageLoading||loading}
          onClick={()=>void loadMoreProviders()}>
          {listPageLoading?"Loading more…":"Load more providers"}</button>
      </div>}
      {detailLoading&&<p role="status">Loading provider details…</p>}
      {selected&&!detailLoading&&<section key={selected.provider.providerRef} className="form-section">
        <h2>{selected.provider.name}</h2><p>Provider status: {selected.provider.status.replaceAll("_"," ")}.
          {selected.provider.status!=="VERIFIED"?" Centers cannot be publicly published.":""}</p>
        <p>Contact: {selected.provider.contactName} · {selected.provider.contactPhone}</p>
        {canVerify&&selected.provider.status==="VERIFIED"&&
          <div className="form-section">
            <h3>Independent suspension</h3>
            <p>Suspension withdraws all provider center access and public listings.
              Restoration requires a fresh Foundation review.</p>
            <label className="field">Confirm your password
              <input type="password" minLength={8} autoComplete="current-password"
                value={suspensionPassword} disabled={busy||uncertain}
                onChange={e=>{setSuspensionPassword(e.target.value);
                  delete reviewRequestKeys.current["suspend:providers:"+selected.provider.providerRef];}}/>
            </label>
            <button type="button" disabled={busy||uncertain||suspensionPassword.length<8}
              onClick={()=>void suspendOriginal("providers",selected.provider.providerRef,
                selected.provider.version)}>Suspend provider and its centers</button>
          </div>}
        {canVerify&&selected.provider.status==="SUSPENDED"&&
          <div className="form-section">
            <h3>Reopen for a new independent review</h3>
            <p>The original approval is not restored. Centers remain disabled and unpublished.</p>
            <label className="field">Confirm your current password
              <input type="password" minLength={8} autoComplete="current-password"
                value={suspensionPassword} disabled={busy||uncertain}
                onChange={e=>setSuspensionPassword(e.target.value)}/>
            </label>
            <button type="button" disabled={busy||uncertain||suspensionPassword.length<8}
              onClick={()=>void reopenOriginal("providers",selected.provider.providerRef,
                selected.provider.version)}>Reopen provider as pending</button>
          </div>}
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
        <div className="toolbar">{canManage&&["PENDING","VERIFIED"].includes(selected.provider.status)&&
          <button type="button" onClick={()=>{
          key.current="";setCenterEditor({centerRef:null,version:0,value:blankCenter()});
        }}>Add pending location</button>}</div>
        {selected.centers.map(center=><section key={center.centerRef} className="form-section">
          <h3>{center.name}</h3>
          <p>{center.type.replaceAll("_"," ")} · {center.status.replaceAll("_"," ")}</p>
          {canVerify&&center.status==="SUSPENDED"&&<div className="form-section">
            <p>This center is suspended, not approved for new access or public listing.</p>
            <label className="field">Confirm your current password
              <input type="password" minLength={8} autoComplete="current-password"
                value={suspensionPassword} disabled={busy||uncertain}
                onChange={e=>setSuspensionPassword(e.target.value)}/>
            </label>
            <button type="button" disabled={busy||uncertain||suspensionPassword.length<8}
              onClick={()=>void reopenOriginal("centers",center.centerRef,center.version)}>
              Reopen center for new licence review
            </button>
          </div>}
          {canManage&&center.status==="PENDING"&&<button type="button" onClick={()=>void editCenter(center.centerRef)}>
            Edit pending center</button>}
          {canSelectAccounts&&canManage&&["PENDING","VERIFIED"].includes(center.status)&&<div className="toolbar">
            <label className="field">Eligible representative
              <select value={account} onChange={e=>setAccount(e.target.value)}>
                <option value="">Choose active staff</option>
                {options.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={!account||busy||uncertain}
              onClick={()=>void assign(center.centerRef)}>Assign to this center</button>
          </div>}
          {center.status==="VERIFIED"&&
            <div className="form-section">
              <p><strong>Current center status:</strong> verified.
                Access: {center.accessState==="ENABLED"?"Enabled":"Disabled"}.
                Public listing: {center.publicationState==="PUBLISHED"?"Published":"Not published"}.
              </p>
              {center.publicationState==="PUBLISHED"&&center.publicSlug&&
                <p><Link href={"/healthcare/centers/"+encodeURIComponent(center.publicSlug)}>
                  View current public center page</Link></p>}
              {canActivate&&<div className="form">
                <label className="field">Confirm password for center access
                  <input type="password" minLength={8} autoComplete="current-password"
                    value={accessPassword} disabled={busy||uncertain}
                    onChange={e=>{setAccessPassword(e.target.value);
                      delete reviewRequestKeys.current["access:"+center.centerRef];}}/>
                </label>
                <button type="button" disabled={busy||uncertain||accessPassword.length<8}
                  onClick={()=>void changeAccess(center.centerRef,center.version,
                    center.accessState!=="ENABLED")}>
                  {center.accessState==="ENABLED"?"Disable center access":"Enable verified center access"}
                </button>
              </div>}
              {canPublish&&center.accessState==="ENABLED"&&<div className="form">
                <label className="field">Public page address
                  <input value={publicSlug} maxLength={80}
                    placeholder={center.publicSlug??"clinic-location"}
                    disabled={busy||uncertain}
                    onChange={e=>{setPublicSlug(e.target.value.toLowerCase());
                      delete reviewRequestKeys.current["publish:"+center.centerRef];}}/>
                </label>
                <label className="field">Confirm password for publication
                  <input type="password" minLength={8} autoComplete="current-password"
                    value={publicationPassword} disabled={busy||uncertain}
                    onChange={e=>{setPublicationPassword(e.target.value);
                      delete reviewRequestKeys.current["publish:"+center.centerRef];}}/>
                </label>
                <button type="button" disabled={busy||uncertain||
                  publicationPassword.length<8||
                  (center.publicationState!=="PUBLISHED"&&!publicSlug.trim())}
                  onClick={()=>void changePublication(center.centerRef,center.version,
                    center.publicationState!=="PUBLISHED")}>
                  {center.publicationState==="PUBLISHED"?"Withdraw public listing":
                    "Publish verified center"}
                </button>
              </div>}
              {canVerify&&<div className="form">
                <label className="field">Confirm password to suspend center
                  <input type="password" minLength={8} autoComplete="current-password"
                    value={suspensionPassword} disabled={busy||uncertain}
                    onChange={e=>{setSuspensionPassword(e.target.value);
                      delete reviewRequestKeys.current["suspend:centers:"+center.centerRef];}}/>
                </label>
                <button type="button" disabled={busy||uncertain||suspensionPassword.length<8}
                  onClick={()=>void suspendOriginal("centers",center.centerRef,center.version)}>
                  Suspend this center
                </button>
              </div>}
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
            onVerified={fileRef=>{if(activeProvider.current===selected.provider.providerRef)setProviderProof(fileRef);}}/>
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
            onVerified={ref=>{if(activeProvider.current===selected.provider.providerRef)setBankProof(ref);}}/>
          <div className="toolbar">
            <label className="field">Masked bank label
              <input value={maskedLabel} maxLength={60} placeholder="Bank ****1234"
                onChange={e=>setMaskedLabel(e.target.value)}/>
            </label>
            <button type="button" disabled={!bankProof||busy||uncertain}
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
