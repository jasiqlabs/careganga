"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Center={centerRef:string;centerName:string};
type Item={appointmentRef:string;bookingId:string;doctorRef:string;
 patientName:string;startAt:string;bookingStatus:string;bookingVersion:number;
 visitRef:string|null;queueToken:string|null;visitStatus:string|null;visitVersion:number|null};
type Queue={day:string;items:Item[]};
type VerifiedSlip={valid:boolean;bookingRef?:string;bookingId?:string;
 patientName?:string;doctorName?:string;bookingStatus?:string;
 startAt?:string;timeZone?:string;canCheckIn?:boolean};
async function get<T>(path:string,method="GET",body?:Record<string,unknown>):Promise<T>{
 const r=await fetch("/api/appointments/queue/"+path,{
  method,credentials:"same-origin",cache:"no-store",
  headers:body?{"Content-Type":"application/json"}:undefined,
  body:body?JSON.stringify(body):undefined});
 const raw:unknown=await r.json().catch(()=>null);
 if(!r.ok){
  const text=raw&&typeof raw==="object"&&"message" in raw&&
   typeof raw.message==="string"?raw.message:"The queue result is uncertain. Refresh first.";
  throw Error(text);
 }
 return raw as T;
}
const isoToday=()=>new Date().toISOString().slice(0,10);
export function CenterVisitQueue(){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(""),[day,setDay]=useState(isoToday());
 const [items,setItems]=useState<Item[]>([]);
 const [qrToken,setQrToken]=useState("");
 const [verifiedSlip,setVerifiedSlip]=useState<VerifiedSlip|null>(null);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(""),[uncertain,setUncertain]=useState(false);
 const keys=useRef<Map<string,string>>(new Map());
 const requestSerial=useRef(0),selectedCenterRef=useRef("");
 const load=useCallback(async(c:string,d:string)=>{
  const serial=++requestSerial.current;
  if(!c){setItems([]);return;}
  const rows=await get<Queue>("my-centers/"+encodeURIComponent(c)+"?date="+encodeURIComponent(d));
  if(serial!==requestSerial.current||c!==selectedCenterRef.current)return;
  setItems(rows.items);setUncertain(false);
 },[]);
 useEffect(()=>{
  let alive=true;
  void get<{centers:Center[]}>("my-centers").then(data=>{
   if(!alive)return;
   const valid=data.centers.filter(x=>x&&typeof x.centerRef==="string"&&
    typeof x.centerName==="string");
    setCenters(valid);if(valid.length===1){selectedCenterRef.current=valid[0].centerRef;setCenter(valid[0].centerRef);}
  }).catch(e=>{if(alive)setMessage(e instanceof Error?e.message:"Access cannot be confirmed.");})
  .finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[]);
 useEffect(()=>{
  if(!center){requestSerial.current++;setItems([]);return;}
  let active=true;
  void load(center,day).catch(e=>{
   if(active&&center===selectedCenterRef.current){setItems([]);setMessage(e instanceof Error?e.message:"Queue unavailable.");}
  });
  return()=>{active=false;requestSerial.current++;};
 },[center,day,load]);
 async function verifySlip(){
  if(busy||uncertain||!center||!/^CGV-[A-F0-9]{24}$/.test(qrToken))return;
  setBusy(true);setMessage("");setVerifiedSlip(null);
  try{
   const result=await get<VerifiedSlip>("my-centers/"+
    encodeURIComponent(center)+"/verify-slip","POST",{token:qrToken});
   if(center!==selectedCenterRef.current)return;
   if(!result.valid){setMessage("The slip does not belong to an active appointment at this center.");return;}
   setVerifiedSlip(result);
   if(result.startAt&&result.timeZone){
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
     timeZone:result.timeZone,year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date(result.startAt)).map(x=>[x.type,x.value]));
    setDay(parts.year+"-"+parts.month+"-"+parts.day);
   }
   setMessage("This slip matches a current appointment at your authorized center. Confirm the booking in today's queue before checking in.");
  }catch(e){setMessage(e instanceof Error?e.message:"The QR lookup could not be confirmed.");}
  finally{setBusy(false);}
 }
 async function command(item:Item,next:"CHECK_IN"|"WAITING"|"IN_CONSULTATION"|"COMPLETED"|"NO_SHOW"){
  if(busy||uncertain||!center)return;
  const reference=item.appointmentRef+":"+next+":"+
   (item.visitRef??"")+":"+(item.visitVersion??item.bookingVersion);
  let key=keys.current.get(reference);
  if(!key){key=crypto.randomUUID();keys.current.set(reference,key);}
  setBusy(true);setMessage("");
  try{
   if(next==="CHECK_IN"){
    await get("my-centers/"+encodeURIComponent(center)+"/check-in","POST",{
     appointmentRef:item.appointmentRef,requestKey:key,expectedVersion:item.bookingVersion
    });
   }else{
    if(!item.visitRef||!item.visitVersion)throw Error("Visit status unavailable. Refresh.");
    await get("my-centers/"+encodeURIComponent(center)+"/visits/"+
     encodeURIComponent(item.visitRef)+"/transition","POST",{
      requestKey:key,expectedVersion:item.visitVersion,nextState:next
     });
   }
   keys.current.delete(reference);await load(center,day);
   setMessage("The visit status was saved for this healthcare center.");
  }catch(e){
   setUncertain(true);
   setMessage((e instanceof Error?e.message:"The result is uncertain.")+
    " Refresh the current queue before doing another action.");
  }finally{setBusy(false);}
 }
 return <section className="form-section" aria-label="My healthcare center consultation queue">
  <h2>Consultation check-in & queue</h2>
  <p>Only bookings at the selected assigned center appear here. Queue tokens are
   center-specific; no other center's patient history is shown.</p>
  {!!message&&<p role="alert" aria-live="polite">{message}</p>}
  {loading?<p>Checking current center permissions…</p>:<>
   <div className="toolbar">
    <label>Assigned healthcare center
     <select value={center} onChange={e=>{selectedCenterRef.current=e.target.value;requestSerial.current++;
      setItems([]);setVerifiedSlip(null);setQrToken("");setCenter(e.target.value);setUncertain(false);}}>
      <option value="">Select center</option>
      {centers.map(x=><option key={x.centerRef} value={x.centerRef}>
       {x.centerName}</option>)}
     </select></label>
    <label>Consultation date
     <input type="date" value={day} onChange={e=>{requestSerial.current++;setItems([]);setVerifiedSlip(null);setDay(e.target.value);setUncertain(false);}}/>
    </label>
    <button type="button" disabled={busy||!center}
     onClick={()=>void load(center,day).catch(e=>setMessage(String(e)))}>
     Refresh current queue</button>
   </div>
   {center&&<section aria-label="Verify an appointment QR at my center"
    style={{border:"1px solid #d7dfdb",borderRadius:12,padding:12}}>
    <h3>Verify a consultation QR code</h3>
    <p>Enter the opaque status code from the actual patient's slip. A code for another
     center will not reveal that center's patient or booking.</p>
    <label>Slip QR code
     <input type="text" maxLength={28} value={qrToken} autoCapitalize="characters"
      onChange={e=>{setQrToken(e.target.value.toUpperCase());setVerifiedSlip(null);}}
      placeholder="CGV-XXXXXXXXXXXXXXXXXXXXXXXX"/>
    </label>
    <button type="button" disabled={busy||!/^CGV-[A-F0-9]{24}$/.test(qrToken)}
     onClick={()=>void verifySlip()}>Verify for my center</button>
    {verifiedSlip?.valid&&<p role="status">
     Original booking: {verifiedSlip.bookingId}, {verifiedSlip.patientName},
     status {verifiedSlip.bookingStatus}. Use the current source row below to check in.
    </p>}
   </section>}
   {!centers.length&&<p>No current assigned, enabled healthcare center is available.</p>}
   {center&&items.length===0&&<p>No booked consultation for this center and date.</p>}
   {items.map(item=><article className="card" key={item.appointmentRef}
    style={{border:"1px solid #d7dfdb",padding:14,marginBlock:8,borderRadius:12}}>
    <h3>{item.patientName}</h3>
    <p>Booking: {item.bookingId} · {new Date(item.startAt).toLocaleString("en-IN")}</p>
    <p>Status: {item.bookingStatus} · Queue: {item.queueToken??"Not checked in"}</p>
    <div className="toolbar">
     {item.bookingStatus==="CONFIRMED"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"CHECK_IN")}>Check in</button>}
     {item.visitStatus==="ARRIVED"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"WAITING")}>Move to waiting</button>}
     {item.visitStatus==="WAITING"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"IN_CONSULTATION")}>In consultation</button>}
     {item.visitStatus==="IN_CONSULTATION"&&<button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"COMPLETED")}>Complete visit</button>}
     {["ARRIVED","WAITING"].includes(item.visitStatus??"")&&
      <button type="button" disabled={busy||uncertain}
       onClick={()=>void command(item,"NO_SHOW")}>Mark no-show</button>}
    </div>
   </article>)}
  </>}
 </section>;
}
