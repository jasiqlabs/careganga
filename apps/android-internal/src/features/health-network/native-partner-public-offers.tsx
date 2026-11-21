import {useCallback,useEffect,useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Mode="partner"|"foundation";
type Center={centerRef:string;centerName?:string;name?:string};
type Kind="PHARMACY"|"NURSING"|"OT";
type Offer={offerCode:string;serviceKind:Kind;name:string;description:string;
 indicativePriceMinor:string|null;status:string};
type Props={token:string;mode:Mode;centerRef?:string;onExpired:()=>void};
const API="/api/v1/health-network/partner-offers/";
const amount=(v:string|null)=>v===null?"Price on enquiry":
 "₹"+(Number(BigInt(v))/100).toFixed(2);
const paise=(v:string)=>{
 if(!v.trim())return null;
 const m=/^([1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/.exec(v.trim());
 if(!m)throw Error("Enter a valid indicative rupee amount or leave it blank.");
 return (BigInt(m[1])*100n+BigInt((m[2]??"").padEnd(2,"0"))).toString();
};
async function call<T>(token:string,path:string,body?:object):Promise<T>{
 const res=await identityRequest(API+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(res.status===401?"Session expired. Sign in again.":
  res.status===403?"Your role cannot manage these verified partner services.":
  res.status===409?"The original offer changed. Refresh first.":
  "The original partner information could not be confirmed."),{status:res.status});
 const payload:unknown=await res.json();
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  throw Error("Current original partner source is unavailable.");
 return payload as T;
}
/** Original verified center only. Foundation independently publishes.
 * Never an inventory, prescription, booking, procedure or checkout.
 */
export function NativePartnerPublicOffers({token,mode,centerRef,onExpired}:Props){
 const [centers,setCenters]=useState<Center[]>([]);
 const [center,setCenter]=useState(centerRef??"");
 const [rows,setRows]=useState<Offer[]>([]);
 const [kind,setKind]=useState<Kind>("PHARMACY");
 const [name,setName]=useState(""),[description,setDescription]=useState("");
 const [price,setPrice]=useState(""),[reason,setReason]=useState("");
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const original=useRef<{fingerprint:string;key:string}|null>(null);
 const query=useCallback(async<T,>(path:string,body?:object)=>{
  try{return await call<T>(token,path,body);}
  catch(e){if(e&&typeof e==="object"&&"status" in e&&e.status===401)
   onExpired();throw e;}
 },[token,onExpired]);
 const refresh=useCallback(async(c:string)=>{
  if(!c){setRows([]);return;}
  const path=mode==="partner"?"my-centers/"+encodeURIComponent(c):
   "foundation/centers/"+encodeURIComponent(c);
  const list=await query<{offers:Offer[]}>(path);
  if(!Array.isArray(list.offers)||list.offers.length>50)
   throw Error("Published service information could not be confirmed.");
  setRows(list.offers);
 },[mode,query]);
 useEffect(()=>{setCenter(centerRef??"");},[centerRef]);
 useEffect(()=>{
  let live=true;
  if(centerRef)return;
  const path=mode==="partner"?"my-centers/eligible":"foundation/centers";
  void query<{centers:Center[]}>(path).then(x=>{
   if(!live)return;
   if(!Array.isArray(x.centers)||x.centers.length>50)
    throw Error("Verified partner center options are unavailable.");
   setCenters(x.centers);
   if(x.centers.length===1)setCenter(x.centers[0].centerRef);
  }).catch(e=>{if(live)setError(e instanceof Error?e.message:
   "Current verified center list is unavailable.");});
  return()=>{live=false;};
 },[centerRef,mode,query]);
 useEffect(()=>{let live=true;setRows([]);setError("");
  void refresh(center).catch(e=>{if(live)setError(e instanceof Error?e.message:
   "Original service information unavailable.");});
  return()=>{live=false;};
 },[center,refresh]);
 const button=(label:string,fn:()=>void,disabled=false,active=false)=>(
  <Pressable accessibilityRole="button" onPress={fn}
   disabled={busy||disabled}
   accessibilityState={{disabled:busy||disabled,selected:active}}
   style={[styles.button,active&&styles.active,(busy||disabled)&&styles.disabled]}>
   <Text style={styles.label}>{label}</Text>
  </Pressable>);
 const changed=(setter:(v:string)=>void,v:string)=>{
  if(busy||uncertain)return;
  setter(v);original.current=null;setError("");setNotice("");
 };
 async function save(action:"PROPOSE"|"APPROVE"|"REJECT"|"WITHDRAW",row?:Offer){
  if(!center||busy||uncertain)return;setBusy(true);setError("");setNotice("");
  try{
   const payload=action==="PROPOSE"?
    {serviceKind:kind,name:name.trim(),description:description.trim(),
     indicativePriceMinor:paise(price)}:
    {action,reason:reason.trim(),currentPassword:password};
   if(action!=="PROPOSE"&&(reason.trim().length<12||password.length<8))
    throw Error("Enter an independent review reason and your current password.");
   const fingerprint=JSON.stringify([action,center,row?.offerCode??"",payload]);
   if(original.current?.fingerprint!==fingerprint)
    original.current={fingerprint,key:Crypto.randomUUID()};
   const route=action==="PROPOSE"?"my-centers/"+encodeURIComponent(center):
    "foundation/centers/"+encodeURIComponent(center)+"/offers/"+
    encodeURIComponent(row?.offerCode??"")+"/decision";
   const confirmed=await query<Offer>(route,{...payload,requestKey:original.current.key});
   if(!confirmed||typeof confirmed.offerCode!=="string")
    throw Error("The independent original result could not be verified.");
   original.current=null;setPassword("");
   await refresh(center);setUncertain(false);
   setNotice(action==="PROPOSE"?
    "Service information submitted; private until independent Foundation approval.":
    "Protected original Foundation publication decision recorded.");
  }catch(e){setUncertain(true);
   setError(e instanceof Error?e.message:
    "Source outcome uncertain. Check original status before retrying.");
  }finally{setBusy(false);}
 }
 return <View style={styles.panel}>
  <Text style={styles.title}>{mode==="partner"?
   "My medicine, nursing and procedure information":
   "Approve public partner services"}</Text>
  <Text style={styles.note}>Indicative names and prices only. No ERP, inventory,
   prescriptions, billing or guaranteed Foundation discount.</Text>
  {!centerRef&&centers.map(c=>button(c.centerName??c.name??"Verified center",
   ()=>{setCenter(c.centerRef);original.current=null;},
   uncertain,center===c.centerRef))}
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  {!!notice&&<Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text>}
  {!!center&&button("Refresh current original offers",()=>{
   setBusy(true);setError("");
   void refresh(center).then(()=>setUncertain(false)).catch(e=>
    setError(e instanceof Error?e.message:"Original source unavailable."))
    .finally(()=>setBusy(false));
  })}
  {mode==="partner"&&!!center&&!uncertain&&<View style={styles.block}>
   <Text style={styles.heading}>Propose indicative public service information</Text>
   {(["PHARMACY","NURSING","OT"] as Kind[]).map(x=>button(
    x==="OT"?"Procedure / OT":x,()=>{setKind(x);original.current=null;},
    busy,kind===x))}
   <Text style={styles.note}>Medicine or service name</Text>
   <TextInput accessibilityLabel="Partner service name" style={styles.input}
    maxLength={120} value={name} onChangeText={v=>changed(setName,v)}/>
   <Text style={styles.note}>Description (optional)</Text>
   <TextInput accessibilityLabel="Service description" style={styles.input}
    maxLength={500} multiline value={description}
    onChangeText={v=>changed(setDescription,v)}/>
   <Text style={styles.note}>Indicative price in rupees (optional)</Text>
   <TextInput accessibilityLabel="Indicative rupee price" style={styles.input}
    keyboardType="decimal-pad" maxLength={13} value={price}
    onChangeText={v=>changed(setPrice,v)}/>
   {button("Submit for independent publication approval",()=>void save("PROPOSE"),
    busy||name.trim().length<3)}
  </View>}
  {mode==="foundation"&&!!center&&!uncertain&&<View style={styles.block}>
   <Text style={styles.heading}>Independent Foundation publication review</Text>
   <Text style={styles.note}>Reason for decision (12+ characters)</Text>
   <TextInput accessibilityLabel="Independent publication reason"
    multiline style={styles.input} maxLength={500} value={reason}
    onChangeText={v=>changed(setReason,v)}/>
   <Text style={styles.note}>Current protected Foundation password</Text>
   <TextInput accessibilityLabel="Foundation current password" secureTextEntry
    style={styles.input} value={password}
    onChangeText={v=>changed(setPassword,v)}/>
  </View>}
  {!!center&&rows.length===0&&<Text style={styles.note}>No partner services submitted.</Text>}
  {rows.map(row=><View key={row.offerCode} style={styles.item}>
   <Text style={styles.heading}>{row.name} · {
    row.serviceKind==="OT"?"Procedure":row.serviceKind}</Text>
   <Text style={styles.note}>{row.description}</Text>
   <Text style={styles.note}>{amount(row.indicativePriceMinor)} · {
    row.status.replaceAll("_"," ").toLowerCase()}</Text>
   {mode==="foundation"&&row.status==="PENDING_REVIEW"&&<>
    {button("Approve and publish information",()=>void save("APPROVE",row),
     uncertain||reason.trim().length<12||password.length<8)}
    {button("Reject unsupported information",()=>void save("REJECT",row),
     uncertain||reason.trim().length<12||password.length<8)}
   </>}
   {mode==="foundation"&&row.status==="APPROVED"&&
    button("Withdraw published information",()=>void save("WITHDRAW",row),
     uncertain||reason.trim().length<12||password.length<8)}
  </View>)}
  {uncertain&&<Text accessibilityRole="alert" style={styles.note}>Previous
   action may have succeeded. Check original status before a new request.</Text>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,borderRadius:12,
  backgroundColor:t.surface,gap:10},
 title:{fontSize:16,fontWeight:"700",color:t.text},
 heading:{fontSize:14,fontWeight:"700",color:t.text},
 note:{fontSize:12,lineHeight:19,color:t.mutedText},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 input:{borderWidth:1,borderColor:t.border,borderRadius:8,padding:10,
  minHeight:44,color:t.text},
 button:{borderWidth:1,borderColor:t.border,borderRadius:8,minHeight:44,
  justifyContent:"center",padding:10},
 active:{borderColor:t.primary,borderWidth:2},
 disabled:{opacity:0.5},
 item:{borderTopWidth:1,borderColor:t.border,paddingVertical:9,gap:5},
 block:{gap:8}
});
