import {ReactNode} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
export type Choice={ref:string;label:string};
export async function financeNativeRequest<T>(token:string,path:string,
 method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>):Promise<T>{
 let res:Response;
 try{
  res=await identityRequest(path,{method,cache:"no-store",headers:{
   Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});
 }catch{throw Error("UNKNOWN");}
 if(res.status===401)throw Error("SESSION_EXPIRED");
 if(!res.ok){
  const raw:unknown=await res.json().catch(()=>null);
  if(raw&&typeof raw==="object"&&!Array.isArray(raw)&&
    "message" in raw&&typeof raw.message==="string"&&raw.message.length<=300&&
    "code" in raw&&typeof raw.code==="string"&&raw.code.startsWith("FINANCE_"))
   throw Error("FIELD:"+raw.message);
  throw Error(res.status===403?"DENIED":res.status===409?"CHANGED":
   res.status===400?"BAD_REQUEST":"UNKNOWN");
 }
 return await res.json() as T;
}
export function financeNativeProblem(e:unknown):string{
 const s=e instanceof Error?e.message:"UNKNOWN";
 return s.startsWith("FIELD:")?s.slice(6):
  s==="SESSION_EXPIRED"?"Your session expired. Sign in again.":
  s==="DENIED"?"This action is not available to your current Foundation role.":
  s==="CHANGED"?"The original finance record has changed. Refresh it before trying again.":
  s==="BAD_REQUEST"?"Correct the required finance fields and retry the same request.":
  "The original finance request cannot be confirmed. Check its status before retrying.";
}
export const formatFinanceMoney=(n:string|null|undefined)=>{
 if(n==null)return "Not recorded";
 try{const x=BigInt(n),abs=x<0n?-x:x;return (x<0n?"-":"")+"₹"+
  (abs/100n).toLocaleString("en-IN")+"."+(abs%100n).toString().padStart(2,"0");
 }catch{return "Not recorded";}
};
export const minorToRupees=(n:string|null|undefined)=>{
 if(n==null)return "";
 try{const x=BigInt(n),abs=x<0n?-x:x;return (x<0n?"-":"")+
  (abs/100n).toString()+"."+(abs%100n).toString().padStart(2,"0");
 }catch{return "";}
};
export const financeNativeStyles=StyleSheet.create({
 screen:{flex:1,backgroundColor:t.adminCanvas},header:{
  flexDirection:"row",alignItems:"center",gap:12,padding:14,
  backgroundColor:t.surface,borderBottomWidth:1,borderBottomColor:t.border},
 back:{color:t.primary,fontSize:15,fontWeight:"700"},title:{
  color:t.text,fontSize:21,fontWeight:"800"},scroll:{padding:15,gap:14,paddingBottom:96},
 card:{padding:16,gap:12,borderRadius:14,backgroundColor:t.surface,
  borderWidth:1,borderColor:t.border,
  shadowColor:t.sidebar,shadowOpacity:0.05,shadowOffset:{width:0,height:2},
  shadowRadius:8,elevation:1},heading:{fontSize:16,fontWeight:"700",color:t.text},
 text:{color:t.text,fontSize:13,lineHeight:19},
 muted:{color:t.mutedText,fontSize:13,lineHeight:19},
 alert:{fontSize:13,color:t.error,lineHeight:20},field:{gap:5},label:{
  color:t.text,fontSize:13,fontWeight:"600"},input:{minHeight:48,
  borderWidth:1,borderColor:t.border,borderRadius:10,padding:10,
  backgroundColor:t.surface,color:t.text,fontSize:14},
 area:{minHeight:85,textAlignVertical:"top"},optionList:{flexDirection:"row",
  flexWrap:"wrap",gap:6},option:{borderWidth:1,borderColor:t.border,
  backgroundColor:t.surface,padding:9,minHeight:44,borderRadius:10,
  justifyContent:"center"},selected:{borderColor:t.primary,
  backgroundColor:t.selectedSurface},optionText:{color:t.mutedText,fontSize:12},
 selectedText:{color:t.primary,fontWeight:"700"},action:{
  backgroundColor:t.primary,borderRadius:12,minHeight:48,paddingHorizontal:14,
  paddingVertical:12,justifyContent:"center",alignItems:"center"},
 actionText:{color:t.primaryText,fontSize:13,fontWeight:"700"},
 secondary:{backgroundColor:t.surface,borderColor:t.border,borderWidth:1},
 secondaryText:{color:t.primary},disabled:{opacity:.5},
 row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}
});
const s=financeNativeStyles;
export function NativeFinanceAction({label,onPress,disabled=false,secondary=false}:{
 label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
  style={[s.action,secondary&&s.secondary,disabled&&s.disabled]}>
  <Text style={[s.actionText,secondary&&s.secondaryText]}>{label}</Text>
 </Pressable>;
}
export function NativeFinanceField({label,value,onChange,placeholder,
 secure=false,multiline=false,keyboardType="default"}:{
 label:string;value:string;onChange:(v:string)=>void;placeholder?:string;
 secure?:boolean;multiline?:boolean;keyboardType?:"default"|"decimal-pad"|"number-pad"}){
 return <View style={s.field}><Text style={s.label}>{label}</Text>
  <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
   placeholder={placeholder} secureTextEntry={secure} multiline={multiline}
   placeholderTextColor={t.mutedText} keyboardType={keyboardType}
   autoCapitalize="sentences" style={[s.input,multiline&&s.area]}/></View>;
}
export function NativeFinanceOptions({label,value,options,onChange}:{
 label:string;value:string;options:Choice[];onChange:(v:string)=>void}){
 return <View style={s.field}><Text style={s.label}>{label}</Text>
  <View style={s.optionList}>{options.map(x=><Pressable key={x.ref||"empty"}
   accessibilityRole="button" accessibilityState={{selected:value===x.ref}}
   onPress={()=>onChange(x.ref)}
   style={[s.option,value===x.ref&&s.selected]}>
   <Text style={[s.optionText,value===x.ref&&s.selectedText]}>{x.label}</Text>
  </Pressable>)}</View></View>;
}
export function NativeFinanceCard({children,title}:{children:ReactNode;title?:string}){
 return <View style={s.card}>{title&&<Text style={s.heading}>{title}</Text>}{children}</View>;
}
