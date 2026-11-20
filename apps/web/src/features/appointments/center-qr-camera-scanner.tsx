"use client";
import {useCallback,useEffect,useRef,useState} from "react";

/** Optional local browser reader for the ORIGINAL opaque CG19 QR token.
 * Camera frames never leave the device. Scanned tokens are NOT accepted here:
 * the caller must perform the existing CG15 currently assigned-center check.
 * Browser BarcodeDetector is not universally supported; manual entry remains.
 */
type Detector={
 detect:(frame:HTMLVideoElement)=>Promise<Array<{rawValue:string}>>;
};
type DetectorConstructor={
 new(options:{formats:string[]}):Detector;
 getSupportedFormats:()=>Promise<string[]>;
};
const OPAQUE=/^CGV-[A-F0-9]{24}$/;

export function CenterQrCameraScanner({disabled,resetKey,onCode}:{
 disabled:boolean;resetKey:string;onCode:(code:string)=>void
}){
 const video=useRef<HTMLVideoElement|null>(null);
 const stream=useRef<MediaStream|null>(null);
 const detector=useRef<Detector|null>(null);
 const generation=useRef(0);
 const onCodeRef=useRef(onCode);
 const [active,setActive]=useState(false);
 const [checking,setChecking]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{onCodeRef.current=onCode;},[onCode]);

 const release=useCallback(()=>{
  generation.current++;
  stream.current?.getTracks().forEach(track=>track.stop());
  stream.current=null;detector.current=null;
  if(video.current){video.current.pause();video.current.srcObject=null;}
 },[]);
 const stop=useCallback(()=>{release();setActive(false);setChecking(false);},[release]);
 useEffect(()=>()=>release(),[release]);
 useEffect(()=>{
  // A different center/date must never inherit an old live camera read.
  release();setActive(false);setChecking(false);setError("");
 },[resetKey,release]);
 useEffect(()=>{if(disabled)stop();},[disabled,stop]);

 async function start(){
  if(disabled||active||checking)return;
  const serial=++generation.current;
  setChecking(true);setError("");
  try{
   const API=(window as Window&{BarcodeDetector?:DetectorConstructor}).BarcodeDetector;
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!API){
    setError("Camera QR scan is not available in this browser. Enter the slip code instead.");
    return;
   }
   if(!(await API.getSupportedFormats()).includes("qr_code")){
    setError("This device cannot scan QR codes here. Enter the slip code instead.");
    return;
   }
   if(serial!==generation.current)return;
   // Construct decoder before acquiring the private camera stream:
   // a decoder failure must never leave a newly acquired camera running.
   const decoder=new API({formats:["qr_code"]});
   const camera=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{facingMode:{ideal:"environment"}}
   });
   if(serial!==generation.current||disabled){
    camera.getTracks().forEach(track=>track.stop());return;
   }
   detector.current=decoder;
   stream.current=camera;
   setActive(true);
  }catch{
   if(serial===generation.current)
    setError("Camera access was denied or is unavailable. Enter the code instead.");
  }finally{
   if(serial===generation.current)setChecking(false);
  }
 }
 useEffect(()=>{
  if(!active||!video.current||!stream.current||!detector.current)return;
  const element=video.current,serial=generation.current;
  let alive=true;
  let timer:ReturnType<typeof setTimeout>|null=null;
  element.srcObject=stream.current;
  async function inspect(){
   if(!alive||generation.current!==serial)return;
   try{
    if(element.readyState>=2){
     const codes=await detector.current!.detect(element);
     if(!alive||generation.current!==serial)return;
     const token=codes.map(x=>x.rawValue.trim().toUpperCase())
      .find(value=>OPAQUE.test(value));
     if(token){
      release();setActive(false);
      onCodeRef.current(token);
      return;
     }
    }
   }catch{
    if(alive&&generation.current===serial){
     release();setActive(false);
     setError("Camera scanning stopped. Enter the code manually or try again.");
    }
    return;
   }
   timer=setTimeout(()=>{void inspect();},220);
  }
  void element.play().then(()=>void inspect()).catch(()=>{
   if(alive&&generation.current===serial){
    release();setActive(false);
    setError("Unable to start camera preview. Enter the slip code instead.");
   }
  });
  return()=>{
   alive=false;
   if(timer!==null)clearTimeout(timer);
   element.pause();element.srcObject=null;
  };
 },[active,release]);
 return <div style={{display:"grid",gap:8,marginBlock:8}}>
  <div className="toolbar">
   {!active?<button type="button" disabled={disabled||checking}
    onClick={()=>void start()}>{checking?"Requesting camera…":"Scan QR with camera"}</button>:
    <button type="button" onClick={stop}>Stop camera scan</button>}
  </div>
  {active&&<video ref={video} muted playsInline
   aria-label="Camera preview for consultation QR scanning"
   style={{width:"min(100%,420px)",maxHeight:300,objectFit:"cover",
    borderRadius:10,background:"#18221f"}}/>}
  {active&&<p role="status">Point the camera at the consultation slip QR code.
   Only your selected assigned center can verify the result.</p>}
  {!!error&&<p role="status" aria-live="polite">{error}</p>}
 </div>;
}
