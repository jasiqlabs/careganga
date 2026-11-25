import {useCallback,useEffect,useRef,useState} from "react";
import {ActivityIndicator,Alert,BackHandler,Pressable,ScrollView,
 StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {File,Paths} from "expo-file-system";
import * as Crypto from "expo-crypto";
import * as Sharing from "expo-sharing";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {diagnosticRequest,isUncertain,rupees,validateWindow,
 type Category,type Test,type Package,type Center,type Summary}
 from "./native-diagnostics-api";
import {NativeLabPricingPanel} from "./native-lab-pricing-panel";

type Props={token:string;canManage:boolean;canViewPricing:boolean;
 canManagePricing:boolean;canApprovePricing:boolean;onExit:()=>void;onExpired:()=>void};
type Tab="TESTS"|"CATEGORIES"|"PACKAGES"|"PRICING";
type Attempt={method:"POST"|"PATCH";path:string;requestKey:string;
 fields:Record<string,unknown>;label:string};
const SAMPLE_TYPES=["BLOOD","URINE","STOOL","SALIVA","SWAB","TISSUE","OTHER","NOT_APPLICABLE"];
const codeCsv=(s:unknown)=>{
 const str=String(s??"");
 return '"'+(/^\s*[=+\-@]/.test(str)?"'"+str:str).replaceAll('"','""')+'"';
};
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase();
export function NativeLabTestMasterScreen({token,canManage,canViewPricing,
 canManagePricing,canApprovePricing,onExit,onExpired}:Props){
 const [tab,setTab]=useState<Tab>("TESTS"),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true),[uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState(""),[search,setSearch]=useState("");
 const [filterCategory,setFilterCategory]=useState(""),[filterSample,setFilterSample]=useState(""),[filterStatus,setFilterStatus]=useState("");
 const [testOffset,setTestOffset]=useState(0),[nextTestOffset,setNextTestOffset]=useState<number|null>(null);
 const [testLoading,setTestLoading]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
 const testEpoch=useRef(0),appliedTests=useRef({q:"",categoryRef:"",sampleType:"",status:"",offset:0});
 const [categories,setCategories]=useState<Category[]>([]);
 const [tests,setTests]=useState<Test[]>([]),[packages,setPackages]=useState<Package[]>([]);
 const [centers,setCenters]=useState<Center[]>([]);
 const [summary,setSummary]=useState<Summary|null>(null),[center,setCenter]=useState("");
 const [selected,setSelected]=useState<Test|null>(null),[editing,setEditing]=useState(false);
 const [editOriginal,setEditOriginal]=useState<Test|null>(null);
 const [catCode,setCatCode]=useState(""),[catName,setCatName]=useState("");
 const [testCode,setTestCode]=useState(""),[testName,setTestName]=useState("");
 const [categoryRef,setCategoryRef]=useState(""),[sample,setSample]=useState("BLOOD");
 const [from,setFrom]=useState(""),[to,setTo]=useState("");
 const [description,setDescription]=useState(""),[parameters,setParameters]=useState("");
 const [packageCode,setPackageCode]=useState(""),[packageName,setPackageName]=useState("");
 const [packageDescription,setPackageDescription]=useState("");
 const [packageFrom,setPackageFrom]=useState(""),[packageTo,setPackageTo]=useState("");
 const [includeRef,setIncludeRef]=useState(""),[lines,setLines]=useState<
  {testRef:string;quantity:number}[]>([]);
 const command=useRef<Attempt|null>(null),epoch=useRef(0);
 const error=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setMessage(e instanceof Error?e.message:"Original diagnostics source could not be confirmed.");
 },[onExpired]);
 const loadTests=useCallback(async()=>{
  const version=++testEpoch.current,filter=appliedTests.current;setTestLoading(true);
  try{
   const query=new URLSearchParams({offset:String(filter.offset)});
   if(filter.q)query.set("q",filter.q);if(filter.categoryRef)query.set("categoryRef",filter.categoryRef);
   if(filter.sampleType)query.set("sampleType",filter.sampleType);if(filter.status)query.set("status",filter.status);
   const result=await diagnosticRequest<{tests:Test[];nextOffset:number|null}>(token,"tests?"+query.toString());
   if(version!==testEpoch.current)return;
   if(!Array.isArray(result.tests)||result.tests.length>100)throw Error("The test list could not be verified.");
   setTests(result.tests);setTestOffset(filter.offset);setNextTestOffset(result.nextOffset??null);
   setSelected(v=>v?result.tests.find(k=>k.testRef===v.testRef)??null:null);
  }catch(e){if(version===testEpoch.current){setTests([]);setNextTestOffset(null);setSelected(null);}throw e;}
  finally{if(version===testEpoch.current)setTestLoading(false);}
 },[token]);
 const refresh=useCallback(async()=>{
  const version=++epoch.current;
  const [a,b,,d,e]=await Promise.all([
   diagnosticRequest<Summary>(token,"catalog/admin"),
   diagnosticRequest<{categories:Category[]}>(token,"categories"),
   loadTests(),
   diagnosticRequest<{packages:Package[]}>(token,"packages"),
   canViewPricing?diagnosticRequest<{centers:Center[]}>(token,"centers/eligible"):
    Promise.resolve({centers:[]})
  ]);
  if(version!==epoch.current)return;
  if(!Array.isArray(b.categories)||
    !Array.isArray(d.packages)||!Array.isArray(e.centers)||
    b.categories.length>100||d.packages.length>100||
    e.centers.length>100)throw Error("Diagnostic list bounds could not be confirmed.");
  setSummary(a);setCategories(b.categories);
  setPackages(d.packages);setCenters(e.centers);
 },[token,canViewPricing,loadTests]);
 useEffect(()=>{
  let active=true;
  void refresh().catch(e=>{if(active)error(e);}).finally(()=>{if(active)setLoading(false)});
  return()=>{active=false;++epoch.current;++testEpoch.current;};
 },[refresh,error]);
 useEffect(()=>{
  const back=BackHandler.addEventListener("hardwareBackPress",()=>{
   if(editing){if(busy||uncertain)return true;Alert.alert("Discard unsaved test changes?","The saved test will not change.",[{text:"Keep editing",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>setEditing(false)}]);return true;}
   if(uncertain)return true;
   onExit();return true;
  });
  return()=>back.remove();
 },[onExit,editing,uncertain,busy]);
 const button=(text:string,fn:()=>void,disabled=false,active=false)=>
  <Pressable accessibilityRole="button" accessibilityLabel={text}
   accessibilityState={{disabled,selected:active}} disabled={disabled}
   onPress={fn} style={[s.button,active&&s.active,disabled&&s.disabled]}>
   <Text style={s.buttonText}>{text}</Text>
  </Pressable>;
 const field=(title:string,value:string,set:(x:string)=>void,
  placeholder="",max=200,secure=false)=><View style={s.field}>
   <Text style={s.label}>{title}</Text>
   <TextInput accessibilityLabel={title} value={value} onChangeText={set}
    placeholderTextColor={t.mutedText} placeholder={placeholder}
    maxLength={max} secureTextEntry={secure} editable={!busy&&!uncertain}
    style={s.input} multiline={max>500}/>
  </View>;
 async function save(what:Attempt,retry=false){
  if(busy||(!retry&&uncertain))return;
  setBusy(true);setMessage("");
  try{
   await diagnosticRequest(token,what.path,what.method,{
    requestKey:what.requestKey,...what.fields});
   command.current=null;setUncertain(false);setEditing(false);
   if(what.path==="categories"){setCatCode("");setCatName("");}
   if(what.path==="packages"){
    setPackageCode("");setPackageName("");setPackageDescription("");
    setPackageFrom("");setPackageTo("");setLines([]);setIncludeRef("");
   }
   setMessage(what.label);
   try{await refresh()}catch{
    setMessage(what.label+" Latest list unavailable; refresh before another action.");
   }
  }catch(e){
   command.current=isUncertain(e)?what:null;setUncertain(isUncertain(e));error(e);
  }finally{setBusy(false);}
 }
 function commit(path:string,method:"POST"|"PATCH",
  fields:Record<string,unknown>,label:string){
  if(uncertain||busy)return;
  const attempt={path,method,fields,label,requestKey:Crypto.randomUUID()};
  command.current=attempt;void save(attempt);
 }
 function openTest(test?:Test,duplicate=false){
  setEditing(true);setTab("TESTS");setSelected(test&&!duplicate?test:null);setEditOriginal(test&&!duplicate?test:null);
  setTestCode(test&&!duplicate?test.code:"");
  setTestName(test?(duplicate?test.name+" copy":test.name):"");
  setCategoryRef(test?.categoryRef??"");setSample(test?.sampleType??"BLOOD");
  setDescription(test?.clinicalDescription??"");setParameters(test?.parametersDescription??"");
  setFrom(test&&!duplicate?test.activeFromUtc:"");
  setTo(test&&!duplicate?test.activeToUtc??"":"");
 }
 function saveTest(){
  if(!canManage||!editing||!testName.trim()||!testCode.trim()||!categoryRef)return;
  try{
   const window=validateWindow(from,to);
   const fields={testCode,name:testName,categoryRef,sampleType:sample,
    clinicalDescription:description,parametersDescription:parameters,...window};
   const existing=editOriginal;
   if(existing&&(!selected||selected.testRef!==existing.testRef||selected.revision!==existing.revision||testCode!==existing.code))throw Error("The test has changed or is unavailable. Reopen the current record before saving.");
   if(existing){
    commit("tests/"+existing.testRef,"PATCH",{...fields,expectedVersion:existing.revision,
     status:existing.status},
     "Original test revised. Accepted historical test and prices remain immutable.");
   }else commit("tests","POST",fields,"Diagnostic test created.");
  }catch(e){error(e);}
 }
 function deactivate(test:Test){
  if(!canManage||test.status!=="ACTIVE")return;
  Alert.alert("Deactivate current test?","Previously accepted orders and price history remain preserved.",[
   {text:"Cancel",style:"cancel"},
   {text:"Deactivate",style:"destructive",onPress:()=>commit("tests/"+test.testRef,"PATCH",{
    testCode:test.code,name:test.name,categoryRef:test.categoryRef,
    sampleType:test.sampleType,parametersDescription:test.parametersDescription,
    clinicalDescription:test.clinicalDescription,status:"INACTIVE",
    expectedVersion:test.revision,activeFromUtc:test.activeFromUtc,
    activeToUtc:test.activeToUtc
   },"Test deactivated. Historical records remain unchanged.")}
  ]);
 }
 function savePackage(){
  if(!canManage||!packageCode.trim()||!packageName.trim()||lines.length===0)return;
  try{
   const window=validateWindow(packageFrom,packageTo);
   if(window.activeToUtc&&new Date(window.activeToUtc).getTime()<=Date.now())
    throw Error("Package end must be in the future.");
   if(lines.some(x=>!Number.isSafeInteger(x.quantity)||x.quantity<1||x.quantity>100))
    throw Error("Each package quantity must be 1–100.");
   commit("packages","POST",{packageCode,name:packageName,
    description:packageDescription,tests:lines,...window},
    "Immutable source-backed diagnostic test package created.");
  }catch(e){error(e);}
 }
 async function exportRows(){
  const visible=testLoading?[]:tests;
  if(!visible.length||busy||uncertain)return;
  setBusy(true);setMessage("");
  let local:File|null=null;
  try{
   const data=await diagnosticRequest<{tests:Array<{
    testRef:string;code:string;name:string;category:string;sampleType:string;status:string
   }>;exportedCount:number}>(token,"tests/export","POST",{
    testRefs:visible.map(x=>x.testRef)
   });
   if(!Array.isArray(data.tests)||data.tests.length!==visible.length||
      data.tests.some(x=>!visible.some(y=>y.testRef===x.testRef)))
    throw Error("The source export changed. Refresh the original test list.");
   const rows=[["Test code","Test name","Category","Sample type","Status"],
    ...data.tests.map(x=>[x.code,x.name,x.category,x.sampleType,x.status])];
   local=new File(Paths.cache,"careganga-lab-tests-"+Crypto.randomUUID()+".csv");
   local.create();await local.write("\uFEFF"+rows.map(x=>x.map(codeCsv).join(",")).join("\r\n"));
   if(!await Sharing.isAvailableAsync())throw Error("No compatible secure share sheet is available.");
   await Sharing.shareAsync(local.uri,{mimeType:"text/csv",dialogTitle:"Export permitted lab tests"});
   setMessage("Shared "+data.tests.length+" currently authorized test records.");
  }catch(e){error(e);}
  finally{try{local?.delete()}catch{}setBusy(false);}
 }
 const visible=testLoading?[]:tests;
 function searchTests(reset=false,offset=0,paging=false){
  if(busy||uncertain||editing||testLoading)return;
  appliedTests.current=paging?{...appliedTests.current,offset}:reset?{q:"",categoryRef:"",sampleType:"",status:"",offset:0}:{q:search.trim(),categoryRef:filterCategory,sampleType:filterSample,status:filterStatus,offset:0};
  setSelected(null);setTests([]);setNextTestOffset(null);setMessage("");
  void loadTests().catch(error);
 }
 return <SafeAreaView style={s.page} edges={["left","right"]}>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   {button("Back to Foundation home",onExit,busy||uncertain)}
   <Text accessibilityRole="header" style={s.title}>Lab Test Master & Pricing</Text>
   <Text style={s.note}>Original approved test, package and lab-price source.
    The optional Lab ERP does not gate this catalogue. No patient payment or report is created.</Text>
   {loading&&<ActivityIndicator accessibilityLabel="Loading original test master"/>}
   {!!message&&<Text accessibilityRole="alert" style={s.message}>{message}</Text>}
   {uncertain&&<View style={s.card}>
    <Text style={s.message}>The last write may already be saved. Do not create another record.</Text>
    {button("Retry exact original request",()=>{if(command.current)
     void save(command.current,true)},busy||!command.current)}
    {button("Refresh current records",()=>void refresh().then(()=>{
     setMessage("Original records refreshed. Confirm the previous result before another edit.");
    }).catch(error),busy)}
   </View>}
   <View style={s.row}>
    {(["TESTS","CATEGORIES","PACKAGES","PRICING"] as Tab[]).filter(x=>
      x!=="PRICING"||canViewPricing).map(x=>button(
      x==="TESTS"?"Tests":x==="CATEGORIES"?"Categories":
      x==="PACKAGES"?"Packages":"Center pricing",
      ()=>{setTab(x);setEditing(false)},busy||uncertain||editing,tab===x))}
   </View>
   {summary&&<View style={s.card}>
    <Text style={s.heading}>Current diagnostic catalogue</Text>
    <Text style={s.note}>Tests {summary.totalTests} · Active {summary.activeTests} ·
     Categories {summary.categories} · Packages {summary.packages}</Text>
    <Text style={s.note}>Published offers {summary.publishedOffers} · Average current
     patient price {summary.averagePublishedPatientPriceMinor===null?
      "No active price":rupees(summary.averagePublishedPatientPriceMinor)}</Text>
   </View>}
   {tab==="TESTS"&&<View style={s.card}>
    <Text style={s.heading}>Diagnostic tests</Text>
    {field("Search all tests",search,setSearch,"Test name or code",80)}
    {button(filtersOpen?"Hide filters":"More filters",()=>setFiltersOpen(v=>!v),busy||uncertain||editing,filtersOpen)}
    {filtersOpen&&<>
     <Text style={s.label}>Category</Text><View style={s.row}>{button("All categories",()=>setFilterCategory(""),busy||editing,!filterCategory)}{categories.map(c=><View key={c.categoryRef}>{button(c.name,()=>setFilterCategory(c.categoryRef),busy||editing,filterCategory===c.categoryRef)}</View>)}</View>
     <Text style={s.label}>Sample type</Text><View style={s.row}>{["",...SAMPLE_TYPES].map(v=><View key={v||"all"}>{button(v?label(v):"All samples",()=>setFilterSample(v),busy||editing,v===filterSample)}</View>)}</View>
     <Text style={s.label}>Status</Text><View style={s.row}>{["","ACTIVE","INACTIVE"].map(v=><View key={v||"all"}>{button(v?label(v):"All statuses",()=>setFilterStatus(v),busy||editing,v===filterStatus)}</View>)}</View>
    </>}
    <View style={s.row}>{button("Search / apply filters",()=>{setFiltersOpen(false);searchTests();},busy||uncertain||editing||testLoading)}{button("Reset",()=>{setSearch("");setFilterCategory("");setFilterSample("");setFilterStatus("");searchTests(true);},busy||uncertain||editing||testLoading)}</View>
    {button("Refresh list",()=>void refresh().catch(error),busy||uncertain||editing||testLoading)}
    {button("Export currently visible tests",()=>void exportRows(),
     busy||uncertain||visible.length===0)}
    <Text style={s.note}>Up to 100 tests per page. Export includes this page only.</Text>
    {testLoading&&<ActivityIndicator accessibilityLabel="Loading matching tests"/>}
    {visible.length===0&&!loading&&!testLoading&&!message&&<Text style={s.note}>No matching tests.</Text>}
    {visible.map(v=><View key={v.testRef} style={s.item}>
     <Text style={s.heading}>{v.name} · {v.code}</Text>
     <Text style={s.note}>{v.category} · {label(v.sampleType)} ·
      {label(v.status)}</Text>
     {button("View source details",()=>{setSelected(v);setEditing(false)},
      busy||uncertain||editing,selected?.testRef===v.testRef)}
    </View>)}
    <View style={s.row}>{button("Previous",()=>searchTests(false,Math.max(0,testOffset-100),true),busy||uncertain||editing||testLoading||testOffset===0)}<Text style={s.note}>Page {Math.floor(testOffset/100)+1}</Text>{button("Next",()=>{if(nextTestOffset!==null)searchTests(false,nextTestOffset,true);},busy||uncertain||editing||testLoading||nextTestOffset===null)}</View>
    {selected&&!editing&&<View style={s.item}>
     <Text style={s.heading}>{selected.name}</Text>
     <Text style={s.note}>Category {selected.category} ·
      Available {selected.activeFromUtc} — {selected.activeToUtc??"no expiry"}</Text>
     <Text style={s.note}>Clinical description: {selected.clinicalDescription||"Not recorded"}</Text>
     <Text style={s.note}>Test parameters: {selected.parametersDescription||"Not recorded"}</Text>
     <Text style={s.note}>Test metadata is not a reviewed patient medical report.</Text>
     {canManage&&<View style={s.row}>
      {button("Edit original test",()=>openTest(selected),busy||uncertain)}
      {button("Duplicate as new test",()=>openTest(selected,true),busy||uncertain)}
      {selected.status==="ACTIVE"&&button("Deactivate",()=>deactivate(selected),busy||uncertain)}
     </View>}
    </View>}
    {canManage&&!editing&&button("Add new diagnostic test",()=>openTest(),busy||uncertain)}
    {canManage&&editing&&<View style={s.item}>
     <Text style={s.heading}>Diagnostic test details</Text>
     {editOriginal?
      <View style={s.field}>
       <Text style={s.label}>Original test code (cannot be changed)</Text>
       <Text style={s.note}>{testCode}</Text>
      </View>:field("Unique test code",testCode,setTestCode,"Up to 24 letters/numbers",24)}
     {field("Test name",testName,setTestName,"Name",160)}
     <Text style={s.label}>Select current active category</Text>
     {categories.filter(x=>x.status==="ACTIVE").map(x=>button(x.name,
      ()=>setCategoryRef(x.categoryRef),busy||uncertain,categoryRef===x.categoryRef))}
     <Text style={s.label}>Sample type</Text>
     <View style={s.row}>{SAMPLE_TYPES.map(v=>button(label(v),
      ()=>setSample(v),busy||uncertain,sample===v))}</View>
     {field("Available from (ISO time and timezone, optional)",from,setFrom,
      "YYYY-MM-DDTHH:mm:ss+05:30")}
     {field("Available until (ISO time and timezone, optional)",to,setTo,
      "YYYY-MM-DDTHH:mm:ss+05:30")}
     {field("Clinical description",description,setDescription,"Informational only",2000)}
     {field("Test parameters",parameters,setParameters,"Not an analyzer result",2000)}
     {button("Save test",saveTest,busy||uncertain||!testCode||!testName||!categoryRef)}
     {button("Cancel form",()=>Alert.alert("Discard unsaved test changes?","The saved test will not change.",[{text:"Keep editing",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>setEditing(false)}]),busy||uncertain)}
    </View>}
   </View>}
   {tab==="CATEGORIES"&&<View style={s.card}>
    <Text style={s.heading}>Original test categories</Text>
    {categories.map(x=><Text key={x.categoryRef} style={s.note}>
     {x.name} ({x.code}) · {label(x.status)}</Text>)}
    {canManage&&<View style={s.item}>
     {field("Category code",catCode,setCatCode,"Unique code",24)}
     {field("Category name",catName,setCatName,"Category name",100)}
     {button("Create category",()=>commit("categories","POST",{
      code:catCode,name:catName},"Foundation test category created."),
      busy||uncertain||!catCode.trim()||!catName.trim())}
    </View>}
   </View>}
   {tab==="PACKAGES"&&<View style={s.card}>
    <Text style={s.heading}>Diagnostic test packages</Text>
    {packages.length===0&&!loading&&<Text style={s.note}>No test packages recorded.</Text>}
    {packages.map(p=><View key={p.packageRef} style={s.item}>
     <Text style={s.heading}>{p.name} · {p.code}</Text>
     <Text style={s.note}>{p.testCount} tests · {p.status} ·
      {p.activeFromUtc} — {p.activeToUtc??"no expiry"}</Text>
    </View>)}
    {canManage&&<View style={s.item}>
     <Text style={s.heading}>Create versioned package</Text>
     {field("Package code",packageCode,setPackageCode,"Unique code",24)}
     {field("Package name",packageName,setPackageName,"Name",160)}
     {field("Package description",packageDescription,setPackageDescription,"Optional",2000)}
     {field("Available from (ISO timezone, optional)",packageFrom,setPackageFrom,
      "YYYY-MM-DDTHH:mm:ss+05:30")}
     {field("Available until (ISO timezone, optional)",packageTo,setPackageTo,
      "YYYY-MM-DDTHH:mm:ss+05:30")}
     <Text style={s.label}>Add currently active tests</Text>
     {tests.filter(v=>v.status==="ACTIVE"&&!lines.some(x=>x.testRef===v.testRef))
      .map(v=>button(v.name+" · "+v.code,()=>setIncludeRef(v.testRef),
       busy||uncertain,includeRef===v.testRef))}
     {button("Include selected test",()=>{
      if(includeRef)setLines(x=>[...x,{testRef:includeRef,quantity:1}]);
      setIncludeRef("");
     },busy||uncertain||!includeRef)}
     {lines.map(v=><View key={v.testRef} style={s.item}>
      <Text style={s.note}>{tests.find(x=>x.testRef===v.testRef)?.name??"Selected test"}
       {" · Quantity "+v.quantity}</Text>
      <View style={s.row}>
       {button("Decrease",()=>setLines(x=>x.map(y=>y.testRef===v.testRef?
        {...y,quantity:Math.max(1,y.quantity-1)}:y)),busy||v.quantity<=1)}
       {button("Increase",()=>setLines(x=>x.map(y=>y.testRef===v.testRef?
        {...y,quantity:Math.min(100,y.quantity+1)}:y)),busy||v.quantity>=100)}
       {button("Remove",()=>setLines(x=>x.filter(y=>y.testRef!==v.testRef)),busy)}
      </View>
     </View>)}
     {button("Save new package",savePackage,
      busy||uncertain||!packageCode||!packageName||lines.length===0)}
    </View>}
   </View>}
   {tab==="PRICING"&&canViewPricing&&<View style={s.card}>
    <Text style={s.heading}>Verified laboratory location</Text>
    {centers.length===0&&!loading&&<Text style={s.note}>No eligible labs for this role.</Text>}
    {centers.map(c=>button(c.name+" · "+c.providerName,
     ()=>setCenter(c.centerRef),busy||uncertain,center===c.centerRef))}
    {!!center&&<NativeLabPricingPanel key={center} token={token}
     centerRef={center} own={false}
     canMap={canManage} canPropose={canManagePricing}
     canApprove={canApprovePricing} onExpired={onExpired}/>}
   </View>}
  </ScrollView>
 </SafeAreaView>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:t.adminCanvas},
 content:{padding:16,paddingBottom:110,gap:12},
 title:{fontSize:21,fontWeight:"700",color:t.text},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,lineHeight:19,color:t.mutedText},
 message:{fontSize:13,lineHeight:20,color:t.error},
 label:{fontSize:13,color:t.text,fontWeight:"500"},
 card:{padding:13,gap:10,borderRadius:14,backgroundColor:t.surface,
  borderColor:t.border,borderWidth:1},
 item:{padding:12,gap:9,borderRadius:12,borderColor:t.border,borderWidth:1},
 row:{flexDirection:"row",flexWrap:"wrap",gap:8},
 field:{gap:5},
 input:{minHeight:48,borderWidth:1,borderRadius:10,borderColor:t.border,
  padding:10,color:t.text,backgroundColor:t.surface},
 button:{minHeight:48,padding:11,borderWidth:1,borderColor:t.border,
  borderRadius:11,justifyContent:"center"},
 buttonText:{fontSize:14,fontWeight:"600",color:t.text},
 active:{backgroundColor:t.selectedSurface,borderColor:t.primary},
 disabled:{opacity:0.5}
});
