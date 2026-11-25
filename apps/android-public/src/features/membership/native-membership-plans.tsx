import {usePublicIntro} from "../cms/use-public-intro";
import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,AppState,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import type {CG04PublicTier,CG04PublicTierPage} from "@careganga/api-contracts";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
const categories={ALL:"All tiers",ANNUAL:"Annual plans",LIFETIME:"Lifetime",HONORARY:"Honorary / Free",STUDENT:"Student plans",OTHER:"Other plans"} as const;
const colors:Record<string,string>={BLUE:"#285acb",GREEN:"#287b50",AMBER:"#ad7104",PURPLE:"#6840c9",TEAL:"#0c7b78",ROSE:"#be3866",SLATE:"#52657a"};
const icons:Record<string,string>={CARD:"▣",STAR:"★",HEART:"♥",CROWN:"♛",GRADUATION:"◆",SHIELD:"⬟",USERS:"♟"};
function amount(v:string){if(!/^\d{1,15}$/.test(v))return "Price unavailable";const n=BigInt(v),whole=n/100n,f=String(n%100n).padStart(2,"0");return "₹"+whole.toLocaleString("en-IN")+(f==="00"?"":"."+f);}
function duration(v:CG04PublicTier){return v.durationUnit==="LIFETIME"?"Lifetime":v.durationCount+" "+v.durationUnit.toLowerCase()+(v.durationCount===1?"":"s");}
function Button({title,onPress,selected=false,disabled=false}:{title:string;onPress:()=>void;selected?:boolean;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[s.button,selected&&s.selected,disabled&&{opacity:.5}]}><Text style={{color:selected?"#fff":"#174632",fontWeight:"600"}}>{title}</Text></Pressable>;}
function isPage(v:unknown):v is CG04PublicTierPage{if(!v||typeof v!=="object")return false;const p=v as CG04PublicTierPage;return Array.isArray(p.items)&&p.items.length<=50&&(p.nextCursor===null||typeof p.nextCursor==="string")&&p.items.every(x=>x&&typeof x.planCode==="string"&&Number.isSafeInteger(x.offerRevision)&&x.offerRevision>0&&typeof x.name==="string"&&typeof x.description==="string"&&typeof x.feeMinor==="string"&&/^\d{1,15}$/.test(x.feeMinor)&&x.currency==="INR"&&["DAY","MONTH","YEAR","LIFETIME"].includes(x.durationUnit)&&Number.isInteger(x.durationCount)&&Array.isArray(x.benefits)&&x.benefits.length<=20&&x.benefits.every(b=>b&&typeof b.title==="string"&&typeof b.description==="string"));}
export function NativeMembershipPlans({onApply}:{onApply:(planCode:string)=>void}){
 const intro=usePublicIntro("MEMBERSHIP");
 const [q,setQ]=useState(""),[category,setCategory]=useState("ALL"),[filter,setFilter]=useState({q:"",category:"ALL"}),[cursor,setCursor]=useState(""),[previous,setPrevious]=useState<CG04PublicTier[]>([]),[data,setData]=useState<CG04PublicTierPage|null>(null),[expanded,setExpanded]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[epoch,setEpoch]=useState(0);
 const [tab,setTab]=useState<"CARDS"|"VERIFY">("CARDS"),[verifyCode,setVerifyCode]=useState(""),[verifyState,setVerifyState]=useState<"IDLE"|"CHECKING"|"ACTIVE"|"NOT_VALID"|"UNAVAILABLE">("IDLE");
 const seq=useRef(0),verifySeq=useRef(0);
 useEffect(()=>{const n=++seq.current,controller=new AbortController();setData(null);setError("");setLoading(true);const base=process.env.EXPO_PUBLIC_API_URL;const timeout=setTimeout(()=>controller.abort(),10000);
  void (async()=>{if(!base||!/^https?:\/\//.test(base)||(process.env.NODE_ENV==="production"&&!base.startsWith("https://")))throw Error("Membership plans unavailable.");const url=new URL("/api/v1/public/membership/tiers",base);for(const [k,v] of Object.entries({...filter,cursor}))url.searchParams.set(k,v);const r=await fetch(url.toString(),{cache:"no-store",signal:controller.signal});if(!r.ok)throw Error("Membership plans could not be confirmed.");const payload:unknown=await r.json();if(!isPage(payload))throw Error("Membership plan information unavailable.");return payload;})().then(v=>{if(n===seq.current)setData(v);}).catch(()=>{if(n===seq.current){setPrevious([]);setError("Current membership plans are unavailable. Check your connection and retry.");}}).finally(()=>{clearTimeout(timeout);if(n===seq.current)setLoading(false);});
  return()=>{seq.current++;clearTimeout(timeout);controller.abort();};},[filter,cursor,epoch]);
 const refresh=()=>{setPrevious([]);setData(null);setCursor("");setExpanded(null);setEpoch(n=>n+1);};
 useEffect(()=>{const sub=AppState.addEventListener("change",state=>{if(state==="active")refresh();else{seq.current++;verifySeq.current++;setVerifyCode("");setVerifyState("IDLE");setPrevious([]);setData(null);setExpanded(null);}});return()=>sub.remove();},[]);
 function apply(c:string=category){setCategory(c);setFilter({q:q.trim(),category:c});setPrevious([]);setData(null);setCursor("");setExpanded(null);}
 const plans=[...previous,...(data?.items??[])].filter((p,i,a)=>a.findIndex(v=>v.planCode===p.planCode)===i);
 const verify=async()=>{
  if(verifyState==="CHECKING")return;
  const code=verifyCode.trim().toUpperCase(),seqId=++verifySeq.current;
  if(!/^CGV-[A-F0-9]{24}$/.test(code)){setVerifyState("NOT_VALID");return;}
  setVerifyState("CHECKING");
  try{
   const base=process.env.EXPO_PUBLIC_API_URL;
   if(!base||!/^https?:\/\//.test(base)||(process.env.NODE_ENV==="production"&&!base.startsWith("https://")))throw Error("unavailable");
   const url=new URL("/api/v1/public/membership/verify/"+encodeURIComponent(code),base);
   const response=await fetch(url.toString(),{cache:"no-store",signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error("unavailable");
   const value:unknown=await response.json();
   if(seqId===verifySeq.current)setVerifyState(value&&typeof value==="object"&&(value as {valid?:boolean}).valid===true&&(value as {status?:string}).status==="ACTIVE"?"ACTIVE":"NOT_VALID");
  }catch{if(seqId===verifySeq.current)setVerifyState("UNAVAILABLE");}
 };
 return <View style={s.section}>
 <View style={s.hero}>{!!intro?.eyebrow&&<Text style={{color:"#9de0b8",fontWeight:"700",letterSpacing:2}}>{intro.eyebrow}</Text>}<Text accessibilityRole="header" style={s.heroTitle}>{intro?.heading??"Membership"}</Text>{!!intro?.body&&<Text style={{color:"#fff",lineHeight:22}}>{intro.body}</Text>}{intro?.highlights.map((line,i)=><Text key={i} style={{color:"#fff"}}>{line}</Text>)}</View>
 <View style={s.row}>
  <Button title="Membership Cards" selected={tab==="CARDS"} onPress={()=>{setTab("CARDS");verifySeq.current++;setVerifyCode("");setVerifyState("IDLE");}}/>
  <Button title="Verify Membership" selected={tab==="VERIFY"} onPress={()=>setTab("VERIFY")}/>
 </View>
 {tab==="VERIFY"?<View style={s.panel}>
  <Text accessibilityRole="header" style={s.heading}>Verify Membership</Text>
  <Text style={s.muted}>Enter the original verification code printed on an officially issued CareGanga card or certificate. Only current eligibility is shown, never private applicant details.</Text>
  <TextInput accessibilityLabel="Official membership verification code" value={verifyCode} maxLength={28} autoCapitalize="characters" autoCorrect={false} style={s.input}
   placeholder="CGV-…" onChangeText={value=>{verifySeq.current++;setVerifyCode(value.toUpperCase());setVerifyState("IDLE");}} onSubmitEditing={()=>void verify()} returnKeyType="done"/>
  <Button title={verifyState==="CHECKING"?"Checking current eligibility…":"Verify current status"} disabled={verifyState==="CHECKING"} onPress={()=>void verify()}/>
  {verifyState==="ACTIVE"&&<Text accessibilityRole="text">Current official membership verification: Active.</Text>}
  {verifyState==="NOT_VALID"&&<Text accessibilityRole="text">This code does not verify a currently active official membership.</Text>}
  {verifyState==="UNAVAILABLE"&&<Text accessibilityRole="alert">Membership verification is temporarily unavailable. Retry before relying on the status.</Text>}
 </View>:<>
 <View style={s.panel}><Text accessibilityRole="header" style={s.heading}>Membership Cards</Text><Text style={s.muted}>Browse current approved plans and apply using your verified membership account.</Text><TextInput value={q} onChangeText={setQ} maxLength={100} placeholder="Search membership tiers" accessibilityLabel="Search membership tiers" style={s.input} onSubmitEditing={()=>apply()} returnKeyType="search"/><Button title="Search" onPress={()=>apply()}/><Button title="Reset filters" onPress={()=>{setQ("");setCategory("ALL");setFilter({q:"",category:"ALL"});setPrevious([]);setData(null);setCursor("");setExpanded(null);}}/><View style={s.row}>{Object.entries(categories).map(([k,v])=><Button key={k} title={v} selected={category===k} onPress={()=>apply(k)}/>)}</View></View>
 <Text accessibilityRole="header" style={s.heading}>Select Your Membership Card</Text>
 {loading&&<ActivityIndicator accessibilityLabel="Checking current membership plans"/>}
 {!!error&&<View style={s.panel}><Text accessibilityRole="alert" style={s.muted}>{error}</Text><Button title="Try again" onPress={refresh}/></View>}
 {!loading&&!error&&!plans.length&&<Text style={s.muted}>{filter.q||filter.category!=="ALL"?"No current membership plans match your search.":"Membership plans will appear here when published."}</Text>}
 {!error&&plans.map(p=><View key={p.planCode} style={s.panel}><View style={[s.art,{backgroundColor:colors[p.color]??"#174632"}]}><Text style={{color:"white",fontSize:26}}>{icons[p.icon]??"▣"}</Text><Text style={{color:"white",fontWeight:"700"}}>CareGanga Foundation</Text><Text style={{color:"white"}}>{p.name}</Text></View><Text style={s.heading}>{p.name}</Text><Text>{p.description}</Text><Text style={{color:"#247449",fontWeight:"700",fontSize:24}}>{amount(p.feeMinor)}</Text><Text style={s.muted}>{duration(p)}</Text>{expanded===p.planCode&&p.benefits.map((b,i)=><View key={i}><Text style={{fontWeight:"600"}}>✓ {b.title}</Text>{!!b.description&&<Text style={s.muted}>{b.description}</Text>}</View>)}<Button title={expanded===p.planCode?"Hide details":"View details"} selected={expanded===p.planCode} onPress={()=>setExpanded(expanded===p.planCode?null:p.planCode)}/><Button title={"Apply for "+p.name} onPress={()=>onApply(p.planCode)}/></View>)}
 {!!data?.nextCursor&&!error&&<Button title="More plans" disabled={loading} onPress={()=>{setPrevious(plans);setCursor(data.nextCursor??"");}}/>}</>}
 </View>;
}
const s=StyleSheet.create({section:{gap:14},hero:{backgroundColor:"#174632",padding:24,borderRadius:12,gap:10},heroTitle:{fontSize:32,fontWeight:"800",color:"white"},heading:{fontSize:19,fontWeight:"700",color:t.text},muted:{color:"#66788c",lineHeight:21},panel:{backgroundColor:"white",borderColor:"#dae4df",borderWidth:1,borderRadius:12,padding:14,gap:9},input:{borderWidth:1,borderColor:"#d5dfda",borderRadius:9,padding:12,color:t.text,minHeight:44},row:{flexDirection:"row",flexWrap:"wrap",gap:8},button:{borderColor:"#b6cfc2",borderWidth:1,borderRadius:8,paddingHorizontal:12,paddingVertical:10,minHeight:44,justifyContent:"center"},selected:{backgroundColor:"#174632",borderColor:"#174632"},art:{borderRadius:9,padding:20,alignItems:"center",gap:6}});
