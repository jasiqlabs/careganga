import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaPublicTheme as t} from "../../../../../packages/design-tokens/src/index";
type Offer={serviceKind:"PHARMACY"|"NURSING"|"OT";name:string;
 description:string;indicativePriceMinor:string|null;currency:"INR"};
const base=process.env.EXPO_PUBLIC_API_URL;
const money=(minor:string)=>"₹"+(Number(BigInt(minor))/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
/** Same CG14 approved public source as Web, no inventory, booking or
 * guaranteed patient discount and no provider private file details.
 */
export function NativePublicPartnerOffers({centerSlug}:{centerSlug:string}){
 const [offers,setOffers]=useState<Offer[]>([]);
 const [state,setState]=useState<"LOADING"|"READY"|"UNAVAILABLE">("LOADING");
 const load=useCallback(async()=>{
  if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(centerSlug)||!base||
    !/^https?:\/\//.test(base)||
    (process.env.NODE_ENV==="production"&&!base.startsWith("https://")))
   throw Error("This approved partner listing is unavailable.");
  const res=await fetch(new URL(
   "/api/v1/public/health-network/partner-offers/"+encodeURIComponent(centerSlug),base),{
   cache:"no-store",signal:AbortSignal.timeout(12000)
  });
  if(!res.ok)throw Error("Current published partner information is unavailable.");
  const raw:unknown=await res.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    !("items" in raw)||!Array.isArray(raw.items)||raw.items.length>50)
   throw Error("Current published partner information is unavailable.");
  const list=raw.items as Offer[];
  if(!list.every(o=>o&&["PHARMACY","NURSING","OT"].includes(o.serviceKind)&&
    typeof o.name==="string"&&typeof o.description==="string"&&
    (o.indicativePriceMinor===null||
     typeof o.indicativePriceMinor==="string"&&
     /^[1-9][0-9]{0,10}$/.test(o.indicativePriceMinor))))
   throw Error("Current approved listing could not be verified.");
  return list;
 },[centerSlug]);
 useEffect(()=>{let active=true;setOffers([]);setState("LOADING");
  void load().then(items=>{if(active){setOffers(items);setState("READY");}})
   .catch(()=>{if(active)setState("UNAVAILABLE");});
  return()=>{active=false;};
 },[load]);
 if(state==="LOADING")return <ActivityIndicator accessibilityLabel="Checking published partner services"/>;
 if(state==="READY"&&offers.length===0)return null;
 return <View style={styles.panel}>
  <Text style={styles.title}>Approved partner medicine and services</Text>
  <Text style={styles.note}>Indicative medicine, nursing and procedure information
   only. Original invoice, performed service and CareGanga benefit eligibility
   are independently verified. No prescription or guaranteed discount.</Text>
  {state==="UNAVAILABLE"?<View>
   <Text accessibilityRole="alert" style={styles.note}>
    Current verified partner offers are unavailable.</Text>
   <Pressable accessibilityRole="button" style={styles.button}
    onPress={()=>{setState("LOADING");void load().then(x=>{setOffers(x);setState("READY");})
     .catch(()=>setState("UNAVAILABLE"));}}>
    <Text style={styles.note}>Refresh approved service listing</Text>
   </Pressable>
  </View>:offers.map((x,i)=><View style={styles.item}
   key={x.serviceKind+":"+x.name+":"+i}>
   <Text style={styles.label}>{x.name} · {
    x.serviceKind==="OT"?"Procedure":x.serviceKind==="PHARMACY"?"Pharmacy":"Nursing"}</Text>
   <Text style={styles.note}>{x.indicativePriceMinor?
    "Indicative price "+money(x.indicativePriceMinor):"Price on enquiry"}</Text>
   {!!x.description&&<Text style={styles.note}>{x.description}</Text>}
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,borderRadius:12,
  backgroundColor:t.surface,gap:10},
 title:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:12,lineHeight:19,color:t.mutedText},
 label:{fontSize:13,fontWeight:"600",color:t.text},
 item:{borderTopWidth:1,borderColor:t.border,paddingTop:8,gap:5},
 button:{padding:10,minHeight:44,justifyContent:"center",
  borderWidth:1,borderColor:t.border,borderRadius:8}
});
