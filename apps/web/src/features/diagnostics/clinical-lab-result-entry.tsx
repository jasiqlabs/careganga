"use client";
import {useEffect,useRef,useState} from "react";
type Entry={lineRef:string;value:string;unit:string;observation:string};
type Data={canEnter:boolean;canCorrect?:boolean;
 previousReleaseRef?:string|null;correctionDraft?:Entry[]|null;resumeCorrection?:{
 previousReleaseRef:string;reason:string}|null;
 reportReady:boolean;resume:null|{
 requestKey:string;results:Entry[]};tests:{lineRef:string;name:string}[]};
type Response={state:"RESULT_READY"|"UNKNOWN";generated:boolean};
type Props={centerRef:string;orderRef:string;onVerified:()=>Promise<void>};
const endpoint=(center:string,order:string,kind:string)=>
 "/api/lab-clinical/centers/"+center+"/orders/"+order+"/results/"+kind;
async function request<T>(path:string,body?:object):Promise<T>{
 const r=await fetch(path,{method:body?"POST":"GET",
  credentials:"same-origin",cache:"no-store",
  ...(body?{headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Object.assign(new Error(r.status===409?
  "The original test, patient permission or report changed. Refresh first.":
  r.status===403?"Your current role cannot record these laboratory results.":
  "Lab results could not be saved. Check the original entry."),{status:r.status});
 return await r.json() as T;
}
/** The simple primary lab path: enter values once, generate CG19 private PDF,
 * independent clinician reviews, then releases. No uploaded file required.
 */
export function ClinicalLabResultEntry({centerRef,orderRef,onVerified}:Props){
 const [source,setSource]=useState<Data|null>(null);
 const [rows,setRows]=useState<Entry[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState("");
 const [correctionReason,setCorrectionReason]=useState("");
 const key=useRef<string|null>(null);
 useEffect(()=>{
  let live=true;
  void request<Data>(endpoint(centerRef,orderRef,"entry")).then(v=>{
   if(!live)return;
   if(!Array.isArray(v.tests)||v.tests.length<1||v.tests.length>50)
    throw Error("Original ordered tests are unavailable.");
   setSource(v);
   setCorrectionReason(v.resumeCorrection?.reason??"");
   key.current=v.resume?.requestKey??null;
   const known=new Map((v.resume?.results??v.correctionDraft??[])
    .map(x=>[x.lineRef,x]));
   setRows(v.tests.map(t=>known.get(t.lineRef)??{
    lineRef:t.lineRef,value:"",unit:"",observation:""
   }));
  }).catch(e=>{if(live)setMessage(e instanceof Error?e.message:
   "Original test results are unavailable.");})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false;};
 },[centerRef,orderRef]);
 const isCorrection=Boolean(source?.canCorrect||source?.resumeCorrection);
 const edit=(id:string,field:"value"|"unit"|"observation",value:string)=>{
  if(uncertain)return;
  key.current=null;
  setRows(v=>v.map(x=>x.lineRef===id?{...x,[field]:value}:x));
 };
 async function submit(){
  if(!source?.canEnter||busy||rows.some(x=>!x.value.trim())||
   (isCorrection&&correctionReason.trim().length<8)||
   !rows.length)return;
  if(!window.confirm("Generate one private laboratory PDF from the entered "+
   "test results? An authorized clinician must still review it before release."))
   return;
  key.current??=crypto.randomUUID();
  setBusy(true);setMessage("");
  try{
   const originalRelease=source.resumeCorrection?.previousReleaseRef??
    source.previousReleaseRef;
   if(isCorrection&&!originalRelease)
    throw new Error("A prior released report is required for correction.");
   const result=await request<Response>(
    endpoint(centerRef,orderRef,"generate"),
    {requestKey:key.current,results:rows,
     ...(isCorrection?{correction:{previousReleaseRef:originalRelease,
      reason:correctionReason.trim()}}:{})});
   if(result.state==="RESULT_READY"&&result.generated){
    setUncertain(false);key.current=null;
    setMessage(isCorrection?
     "Corrected PDF version generated. The earlier report remains in history. Clinician review is required again.":
     "PDF generated from recorded test results. Awaiting clinician review.");
    await onVerified();
   }else{
    setUncertain(true);
    setMessage("The private PDF status is uncertain. Retry the same original "+
     "entry; do not make a second report.");
   }
  }catch(e){
   const status=e&&typeof e==="object"&&"status" in e&&
    typeof e.status==="number"?e.status:503;
   setUncertain(status>=500);
   if(status<500)key.current=null;
   setMessage(e instanceof Error?e.message:"Results could not be confirmed.");
  }finally{setBusy(false);}
 }
 return <section className="cg-diagnostics-card" aria-label="Enter laboratory test results">
  <h3>{isCorrection?"Correct released lab report":"Enter test results"}</h3>
  <p>Enter the actual observations for each ordered test.
   CareGanga automatically generates the PDF. Do not enter guessed
   readings or clinical interpretations.</p>
  {loading&&<p role="status">Checking original tests and samples…</p>}
  {!!message&&<p role="status">{message}</p>}
  {source&&!source.canEnter&&<p>
   A result is already being recorded or is ready for clinical review.
   Check its existing status rather than creating a second report.</p>}
  {source?.canEnter&&source.tests.map(t=>{
   const row=rows.find(x=>x.lineRef===t.lineRef);
   if(!row)return null;
   return <fieldset key={t.lineRef} disabled={busy||uncertain}>
    <legend>{t.name}</legend>
    <label className="field">Recorded result
     <input required maxLength={120} value={row.value}
      onChange={e=>edit(t.lineRef,"value",e.target.value)}/>
    </label>
    <label className="field">Unit (if applicable)
     <input maxLength={32} value={row.unit}
      onChange={e=>edit(t.lineRef,"unit",e.target.value)}/>
    </label>
    <label className="field">Observation (optional)
     <textarea maxLength={500} value={row.observation}
      onChange={e=>edit(t.lineRef,"observation",e.target.value)}/>
    </label>
   </fieldset>;
  })}
  {source?.canEnter&&isCorrection&&<label className="field">
   Reason for report correction (required)
   <textarea value={correctionReason} maxLength={500}
    disabled={busy||uncertain} onChange={e=>{
     key.current=null;setCorrectionReason(e.target.value);
    }}/>
   <p>The earlier released PDF remains unchanged. The corrected PDF needs new clinical approval and release.</p>
  </label>}
  {source?.canEnter&&<button type="button" className="primary"
   disabled={busy||loading||rows.some(x=>!x.value.trim())||
    (isCorrection&&correctionReason.trim().length<8)}
   onClick={()=>void submit()}>{busy?"Generating…":uncertain?
    "Retry original PDF generation":isCorrection?
    "Generate corrected PDF":"Generate report PDF"}</button>}
  {uncertain&&<p role="alert">
   Keep the same entered values and request. This will recover the
   original report rather than create a duplicate.</p>}
 </section>;
}
