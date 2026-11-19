import {useEffect,useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";

/** Native React Native calendar, no WebView, extra SDK plugin or keyboard-only
 * YYYY-MM-DD entry. Uses UTC exclusively to avoid timezone shifting DOB.
 * Explicit day/year controls are accessible to TalkBack and device Back.
 */
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July",
 "August","September","October","November","December"];
const MIN="1900-01-01";
const iso=(year:number,month:number,day:number)=>
 String(year).padStart(4,"0")+"-"+String(month).padStart(2,"0")+"-"+
 String(day).padStart(2,"0");
const valid=(s:string)=>/^\d{4}-\d\d-\d\d$/.test(s)&&s>=MIN&&
 s<=today()&&Number.isFinite(Date.parse(s+"T12:00:00Z"))&&
 new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s;
const today=()=>{const n=new Date();return iso(n.getFullYear(),n.getMonth()+1,n.getDate());};
export function NativeBirthDatePicker({value,onChange,disabled=false}:{
 value:string;onChange:(value:string)=>void;disabled?:boolean
}){
 const [open,setOpen]=useState(false);
 const [displayYear,setDisplayYear]=useState(new Date().getFullYear());
 const [displayMonth,setDisplayMonth]=useState(1);
 const [draft,setDraft]=useState("");
 function show(){
  if(disabled)return;
  const base=valid(value)?value:today();
  setDisplayYear(Number(base.slice(0,4)));
  setDisplayMonth(Number(base.slice(5,7)));
  setDraft(valid(value)?value:"");
  setOpen(true);
 }
 function monthMove(delta:number){
  const current=new Date(Date.UTC(displayYear,displayMonth-1+delta,1));
  const year=current.getUTCFullYear(),month=current.getUTCMonth()+1;
  if(year<1900||year>Number(today().slice(0,4)))return;
  setDisplayYear(year);setDisplayMonth(month);
 }
 function yearMove(delta:number){
  setDisplayYear(y=>Math.max(1900,Math.min(Number(today().slice(0,4)),y+delta)));
 }
 const first=new Date(Date.UTC(displayYear,displayMonth-1,1)).getUTCDay();
 const days=new Date(Date.UTC(displayYear,displayMonth,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((first+days)/7)*7},(_,i)=>{
  const n=i-first+1;return n>0&&n<=days?n:0;
 });
 const choose=(day:number)=>{
  const d=iso(displayYear,displayMonth,day);
  if(valid(d))setDraft(d);
 };
 // Clear draft whenever profile source changes after external refresh.
 useEffect(()=>{if(!open)setDraft(valid(value)?value:"");},[value,open]);
 return <View style={styles.field}>
  <Text style={styles.label}>Date of birth (optional)</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={
   value?"Date of birth "+value+". Open calendar":"Choose date of birth in calendar"}
   accessibilityState={{disabled}} disabled={disabled} onPress={show}
   style={[styles.input,disabled&&styles.disabled]}>
   <Text style={styles.text}>{value||"Choose date of birth"}</Text>
  </Pressable>
  {value!==""&&<Pressable accessibilityRole="button"
   accessibilityLabel="Clear date of birth" disabled={disabled}
   onPress={()=>onChange("")} style={styles.clear}>
   <Text style={styles.link}>Clear date of birth</Text>
  </Pressable>}
  <Modal transparent visible={open} onRequestClose={()=>setOpen(false)}
   animationType="slide">
   <View style={styles.overlay} accessibilityViewIsModal>
    <View style={styles.calendar}>
     <Text accessibilityRole="header" style={styles.heading}>Choose date of birth</Text>
     <Text style={styles.hint}>Select the correct year, month and day.
      No date after today is allowed.</Text>
     <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous ten years"
       onPress={()=>yearMove(-10)} style={styles.control}><Text style={styles.text}>−10y</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous year"
       onPress={()=>yearMove(-1)} style={styles.control}><Text style={styles.text}>−1y</Text></Pressable>
      <Text style={styles.current}>{displayYear}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next year"
       onPress={()=>yearMove(1)} style={styles.control}><Text style={styles.text}>+1y</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Next ten years"
       onPress={()=>yearMove(10)} style={styles.control}><Text style={styles.text}>+10y</Text></Pressable>
     </View>
     <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous month"
       onPress={()=>monthMove(-1)} style={styles.control}>
       <Text style={styles.text}>‹</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.month}>
       {MONTHS[displayMonth-1]} {displayYear}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next month"
       onPress={()=>monthMove(1)} style={styles.control}>
       <Text style={styles.text}>›</Text>
      </Pressable>
     </View>
     <ScrollView style={styles.calendarScroll} contentContainerStyle={styles.grid}>
      {DAYS.map(day=><View key={day} style={styles.cell}>
       <Text style={styles.dayName}>{day}</Text></View>)}
      {cells.map((day,i)=>{
       if(!day)return <View key={"blank:"+i} style={styles.cell}/>;
       const date=iso(displayYear,displayMonth,day);
       const available=valid(date),selected=draft===date;
       return <Pressable key={date} accessibilityRole="button"
        accessibilityLabel={new Date(date+"T12:00:00Z").toLocaleDateString("en-IN",{
         weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}
        accessibilityState={{selected,disabled:!available}}
        disabled={!available} onPress={()=>choose(day)}
        style={[styles.cell,styles.dateCell,selected&&styles.selected,
         !available&&styles.disabled]}>
        <Text style={styles.text}>{day}</Text>
       </Pressable>;
      })}
     </ScrollView>
     <Text style={styles.hint} accessibilityLiveRegion="polite">
      {draft?"Selected "+draft:"No date selected"}</Text>
     <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={()=>setOpen(false)}
       style={styles.actionSecondary}><Text style={styles.text}>Cancel</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={()=>{onChange("");setOpen(false);}}
       style={styles.actionSecondary}><Text style={styles.text}>Not provided</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={!valid(draft)}
       accessibilityState={{disabled:!valid(draft)}}
       onPress={()=>{onChange(draft);setOpen(false);}}
       style={[styles.action,(!valid(draft))&&styles.disabled]}>
       <Text style={styles.actionText}>Use date</Text></Pressable>
     </View>
    </View>
   </View>
  </Modal>
 </View>;
}
const styles=StyleSheet.create({
 field:{gap:8},label:{color:t.text,fontWeight:"600"},
 input:{borderWidth:1,borderColor:t.border,borderRadius:8,minHeight:48,
  padding:12,justifyContent:"center"},
 text:{fontSize:14,color:t.text},
 clear:{minHeight:44,justifyContent:"center"},
 link:{color:t.primary,fontWeight:"600"},
 disabled:{opacity:0.4},
 overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"center",padding:14},
 calendar:{backgroundColor:t.surface,borderRadius:16,padding:16,maxHeight:"92%",gap:10},
 heading:{fontSize:19,fontWeight:"700",color:t.text},
 hint:{fontSize:13,color:t.mutedText},
 controls:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:4},
 control:{minHeight:44,minWidth:40,alignItems:"center",justifyContent:"center",
  borderWidth:1,borderColor:t.border,borderRadius:8,paddingHorizontal:6},
 current:{fontSize:17,fontWeight:"700",color:t.text},
 month:{fontSize:16,fontWeight:"600",color:t.text},
 calendarScroll:{maxHeight:360},
 grid:{flexDirection:"row",flexWrap:"wrap"},
 cell:{width:"14.2857%",minHeight:43,alignItems:"center",justifyContent:"center"},
 dayName:{fontSize:12,fontWeight:"700",color:t.mutedText},
 dateCell:{borderRadius:9},
 selected:{borderWidth:2,borderColor:t.primary,backgroundColor:t.background},
 actions:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:8},
 action:{padding:12,minHeight:48,backgroundColor:t.primary,
  borderRadius:8,justifyContent:"center"},
 actionText:{fontWeight:"700",color:t.primaryText},
 actionSecondary:{padding:12,minHeight:48,borderWidth:1,borderColor:t.border,
  borderRadius:8,justifyContent:"center"}
});
