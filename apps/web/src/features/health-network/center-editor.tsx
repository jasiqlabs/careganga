"use client";
import {useEffect,useState} from "react";

export type CenterDraft={
  centerCode:string;displayName:string;centerType:string;addressLine:string;
  stateRef:string;districtRef:string;blockRef:string|null;pinCode:string;
  latitude:number|null;longitude:number|null;timeZone:string;publicPhone:string|null;
  diagnosticLicenseValidThrough:string|null;
  hours:{weekday:number;openLocal:string;closeLocal:string;serviceType:string}[];
  capabilities:string[];
};
type Option={value:string;label:string;level:string};
const types=[
  ["HOSPITAL","Hospital"],["CLINIC","Clinic"],["DIAGNOSTIC_LAB","Diagnostic lab"],
  ["PHARMACY","Pharmacy"],["NURSING","Nursing center"],["OTHER","Other facility"],
  ["POLYCLINIC","Polyclinic"],["DIAGNOSTIC_CENTER","Diagnostic center"],
  ["DENTAL_CLINIC","Dental clinic"],["MEDICAL_LABORATORY","Medical laboratory"],
  ["NURSING_HOME","Nursing home"],["ORTHOPEDIC_CLINIC","Orthopedic clinic"],
  ["HOMEOPATHY_CLINIC","Homeopathy clinic"],["AYURVEDIC_CLINIC","Ayurvedic clinic"]
] as const;
const services=[
  ["CONSULTATION","Consultations"],["DIAGNOSTICS","Diagnostics"],
  ["PHARMACY","Pharmacy"],["NURSING","Nursing"],["SURGERY","Surgery"],
  ["EMERGENCY","Emergency care"]
] as const;
const days=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export function blankCenter():CenterDraft{
  return {centerCode:"",displayName:"",centerType:"CLINIC",addressLine:"",
    stateRef:"",districtRef:"",blockRef:null,pinCode:"",
    latitude:null,longitude:null,timeZone:"Asia/Kolkata",publicPhone:null,
    diagnosticLicenseValidThrough:null,hours:[],capabilities:[]};
}
async function fetchAreas(level:string,parentRef?:string):Promise<Option[]>{
  const params=new URLSearchParams({level,...(parentRef?{parentRef}:{})});
  const res=await fetch("/api/health-network/geography?"+params.toString(),{cache:"no-store"});
  const data:unknown=await res.json().catch(()=>null);
  if(!res.ok||!data||typeof data!=="object"||!("options" in data)||
    !Array.isArray(data.options))
    throw Error("Current geography options are unavailable.");
  return data.options.filter((x:unknown):x is Option=>
    !!x&&typeof x==="object"&&"value" in x&&"label" in x&&
    typeof x.value==="string"&&typeof x.label==="string"&&
    "level" in x&&typeof x.level==="string");
}
export function CenterEditor({value,onChange,disabled=false,identityLocked=false}:{
  value:CenterDraft;onChange:(next:CenterDraft)=>void;
  disabled?:boolean;identityLocked?:boolean
}){
  const [states,setStates]=useState<Option[]>([]);
  const [districts,setDistricts]=useState<Option[]>([]);
  const [blocks,setBlocks]=useState<Option[]>([]);
  const [geoError,setGeoError]=useState("");
  useEffect(()=>{
    let live=true;
    void fetchAreas("STATE").then(x=>{if(live)setStates(x);})
      .catch(e=>{if(live)setGeoError(e instanceof Error?e.message:"Geography unavailable.");});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    let live=true;
    setDistricts([]);
    if(!value.stateRef)return;
    void fetchAreas("DISTRICT",value.stateRef).then(x=>{if(live)setDistricts(x);})
      .catch(e=>{if(live)setGeoError(e instanceof Error?e.message:"Districts unavailable.");});
    return()=>{live=false;};
  },[value.stateRef]);
  useEffect(()=>{
    let live=true;
    setBlocks([]);
    if(!value.districtRef)return;
    void fetchAreas("BLOCK",value.districtRef)
      .then(options=>{if(live)setBlocks(options);})
      .catch(e=>{if(live)setGeoError(e instanceof Error?e.message:"Blocks unavailable.");});
    return()=>{live=false;};
  },[value.districtRef]);
  const set=<K extends keyof CenterDraft,>(field:K,v:CenterDraft[K])=>onChange({...value,[field]:v});
  return <div className="form">
    {geoError&&<p role="alert" className="notice">{geoError}</p>}
    <div className="form-grid">
      <label className="field">Center code
        <input required value={value.centerCode} disabled={disabled||identityLocked}
          maxLength={24} placeholder="E.g. CENTRAL-CLINIC"
          onChange={e=>set("centerCode",e.target.value.toUpperCase())}/>
      </label>
      <label className="field">Center name
        <input required value={value.displayName} disabled={disabled} maxLength={160}
          onChange={e=>set("displayName",e.target.value)}/>
      </label>
      <label className="field">Facility type
        <select value={value.centerType} disabled={disabled||identityLocked}
          onChange={e=>set("centerType",e.target.value)}>
          {types.map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="field">Address
        <input required value={value.addressLine} disabled={disabled} maxLength={500}
          onChange={e=>set("addressLine",e.target.value)}/>
      </label>
      <label className="field">State
        <select required value={value.stateRef} disabled={disabled||identityLocked}
          onChange={e=>onChange({...value,stateRef:e.target.value,districtRef:"",blockRef:null})}>
          <option value="">Choose a state</option>
          {states.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </label>
      <label className="field">District
        <select required value={value.districtRef} disabled={disabled||identityLocked||!value.stateRef}
          onChange={e=>onChange({...value,districtRef:e.target.value,blockRef:null})}>
          <option value="">Choose a district</option>
          {districts.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </label>
      <label className="field">Block (optional)
        <select value={value.blockRef??""} disabled={disabled||identityLocked||!value.districtRef}
          onChange={e=>set("blockRef",e.target.value||null)}>
          <option value="">Not specified</option>
          {blocks.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </label>
      <label className="field">PIN code
        <input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6}
          value={value.pinCode} disabled={disabled}
          onChange={e=>set("pinCode",e.target.value)}/>
      </label>
      <label className="field">Time zone
        <input required value={value.timeZone} disabled={disabled} maxLength={64}
          onChange={e=>set("timeZone",e.target.value)}/>
      </label>
      <label className="field">Public contact (optional)
        <input type="tel" value={value.publicPhone??""} disabled={disabled}
          maxLength={16} onChange={e=>set("publicPhone",e.target.value||null)}/>
      </label>
      {value.capabilities.includes("DIAGNOSTICS")&&
       <label className="field">Diagnostic licence valid through
        <input type="date" value={value.diagnosticLicenseValidThrough??""}
         disabled={disabled} onChange={e=>set("diagnosticLicenseValidThrough",
          e.target.value||null)}/>
        <small>Use the actual date on the diagnostic licence.
         It must be supported by the uploaded licence and independently
         verified before laboratory prices can be published.</small>
       </label>}
      <label className="field">Latitude (optional)
        <input type="number" step="0.000001" min="-90" max="90" disabled={disabled}
          value={value.latitude??""}
          onChange={e=>set("latitude",e.target.value===""?null:Number(e.target.value))}/>
      </label>
      <label className="field">Longitude (optional)
        <input type="number" step="0.000001" min="-180" max="180" disabled={disabled}
          value={value.longitude??""}
          onChange={e=>set("longitude",e.target.value===""?null:Number(e.target.value))}/>
      </label>
    </div>
    <fieldset disabled={disabled}><legend>Services offered (declared, not yet verified)</legend>
      <div className="toolbar">
        {services.map(([key,label])=><label key={key} className="check-label">
          <input type="checkbox" checked={value.capabilities.includes(key)}
            onChange={e=>set("capabilities",
              e.target.checked?[...value.capabilities,key]:value.capabilities.filter(x=>x!==key))}/>
          {label}
        </label>)}
      </div>
    </fieldset>
    <fieldset disabled={disabled}><legend>Operating hours</legend>
      {value.hours.map((h,i)=><div key={i} className="toolbar">
        <label className="field">Day
          <select value={h.weekday}
            onChange={e=>set("hours",value.hours.map((x,j)=>
              i===j?{...x,weekday:Number(e.target.value)}:x))}>
            {days.map((d,j)=><option key={d} value={j}>{d}</option>)}
          </select>
        </label>
        <label className="field">Opens
          <input type="time" value={h.openLocal}
            onChange={e=>set("hours",value.hours.map((x,j)=>
              i===j?{...x,openLocal:e.target.value}:x))}/>
        </label>
        <label className="field">Closes
          <input type="time" value={h.closeLocal}
            onChange={e=>set("hours",value.hours.map((x,j)=>
              i===j?{...x,closeLocal:e.target.value}:x))}/>
        </label>
        <label className="field">Service
          <select value={h.serviceType}
            onChange={e=>set("hours",value.hours.map((x,j)=>
              i===j?{...x,serviceType:e.target.value}:x))}>
            <option value="GENERAL">General hours</option>
            {services.slice(0,4).map(([key,label])=><option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <button type="button" onClick={()=>set("hours",value.hours.filter((_,j)=>j!==i))}>
          Remove hours</button>
      </div>)}
      <button type="button" disabled={value.hours.length>=42}
        onClick={()=>set("hours",[...value.hours,{
          weekday:1,openLocal:"09:00",closeLocal:"17:00",serviceType:"GENERAL"
        }])}>Add operating hours</button>
    </fieldset>
    <p className="muted">These details remain pending until the Foundation verifies the provider and center.</p>
  </div>;
}
