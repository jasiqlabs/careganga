import {useCallback,useEffect,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Claim={claimCode:string;serviceKind:string;invoiceNumber:string;
 serviceDate:string;quotedGrossMinor:string;estimatedFoundationMinor:string;
 state:"PENDING_VERIFICATION"};
type List={claims:Claim[];pendingCount:number;foundationPaymentVerified:false;
 approvedFoundationMinor:"0";guidance:string};
const money=(minor:string)=>"₹"+(Number(BigInt(minor))/100).toLocaleString("en-IN",{
 minimumFractionDigits:2,maximumFractionDigits:2});
export function NativePendingPartnerServiceClaims({token,centerRef,mode,onExpired}:{
 token:string;centerRef:string;mode:"foundation"|"partner";onExpired:()=>void
}){
 const [data,setData]=useState<List|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  const res=await identityRequest(
   "/api/v1/healthcare-assistance/partner-claims/"+mode+"/centers/"+
   encodeURIComponent(centerRef),{method:"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+token}});
  if(res.status===401){onExpired();throw Error("Sign in again to check partner claims.");}
  if(!res.ok)throw Error(res.status===403||res.status===404?
   "Your role cannot view this partner's private claims.":
   "Pending claim source is unavailable. Try again.");
  const payload:unknown=await res.json();
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||
    !("claims" in payload)||!Array.isArray(payload.claims)||
    !("foundationPaymentVerified" in payload)||
    payload.foundationPaymentVerified!==false)
   throw Error("Original pending claims could not be verified.");
  return payload as List;
 },[token,centerRef,mode,onExpired]);
 useEffect(()=>{
  let live=true;setData(null);setError("");
  if(!centerRef)return;
  void load().then(v=>{if(live)setData(v);})
   .catch(e=>{if(live)setError(e instanceof Error?e.message:"Pending claims unavailable.");});
  return()=>{live=false;};
 },[load,centerRef]);
 if(!centerRef)return null;
 return <View style={styles.panel}>
  <Text style={styles.heading}>Partner invoices awaiting verification</Text>
  <Text style={styles.note}>Scanned invoice or service evidence only. This does
   not confirm payment, performed care, an approved Foundation obligation or payout.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.note}>{error}</Text>}
  <Pressable accessibilityRole="button" accessibilityState={{disabled:busy}}
   disabled={busy} style={[styles.button,busy&&styles.disabled]} onPress={()=>{
    setBusy(true);setError("");
    void load().then(setData).catch(e=>setError(e instanceof Error?e.message:
     "Claim status unavailable.")).finally(()=>setBusy(false));
   }}>
   <Text style={styles.buttonText}>{busy?"Checking…":"Refresh partner submissions"}</Text>
  </Pressable>
  {data&&<><Text accessibilityLiveRegion="polite" style={styles.note}>
   {data.pendingCount} pending claims. Approved/paid from these submissions: ₹0.</Text>
   {data.claims.length===0&&<Text style={styles.note}>No pending partner invoices.</Text>}
   {data.claims.map(c=><View key={c.claimCode} style={styles.item}>
    <Text style={styles.heading}>{c.claimCode}</Text>
    <Text style={styles.note}>{c.serviceKind} · {c.invoiceNumber} · {c.serviceDate}</Text>
    <Text style={styles.note}>Unverified bill {money(c.quotedGrossMinor)};
     estimated Foundation contribution {money(c.estimatedFoundationMinor)}</Text>
    <Text style={styles.note}>Pending independent review — not payable.</Text>
   </View>)}
   <Text style={styles.note}>{data.guidance}</Text>
  </>}
 </View>;
}
const styles=StyleSheet.create({
 panel:{padding:12,borderWidth:1,borderColor:t.border,borderRadius:10,
  backgroundColor:t.surface,gap:10},
 heading:{fontSize:15,fontWeight:"700",color:t.text},
 note:{fontSize:12,color:t.mutedText},
 item:{padding:10,borderWidth:1,borderColor:t.border,borderRadius:8,gap:6},
 button:{minHeight:44,justifyContent:"center",padding:10,borderWidth:1,
  borderColor:t.border,borderRadius:8},
 buttonText:{fontSize:13,fontWeight:"600",color:t.text},
 disabled:{opacity:0.5}
});
