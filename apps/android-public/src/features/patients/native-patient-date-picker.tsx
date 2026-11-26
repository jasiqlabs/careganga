import {useState} from "react";
import {Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View}
 from "react-native";
import {careGangaPublicTheme as theme}
 from "../../../../../packages/design-tokens/src/index";

const MONTHS=["January","February","March","April","May","June",
 "July","August","September","October","November","December"] as const;
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"] as const;
const YYYY_MM_DD=/^\d{4}-\d{2}-\d{2}$/;
const isoDay=(y:number,m:number,d:number)=>String(y).padStart(4,"0")+
 "-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
type Props={value:string;onChange:(date:string)=>void;disabled?:boolean};
export function NativePatientDatePicker({value,onChange,disabled=false}:Props){
 const current=new Date().toISOString().slice(0,10);
 const original=YYYY_MM_DD.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"))?
  value:"";
 const initial=original||current;
 const [open,setOpen]=useState(false);
 const [yearText,setYearText]=useState(initial.slice(0,4));
 const [month,setMonth]=useState(Number(initial.slice(5,7))-1);
 const year=Number(yearText);
 const validYear=/^\d{4}$/.test(yearText)&&year>=1900&&
  year<=Number(current.slice(0,4));
 const days=validYear?new Date(Date.UTC(year,month+1,0)).getUTCDate():0;
 const leading=validYear?new Date(Date.UTC(year,month,1)).getUTCDay():0;
 const cells=Array.from({length:validYear?
  Math.ceil((leading+days)/7)*7:0},(_,i)=>i-leading+1);
 const action=(label:string,press:()=>void,inactive=false)=>(
  <Pressable accessibilityRole="button" accessibilityLabel={label}
   accessibilityState={{disabled:inactive}} disabled={inactive}
   onPress={press} style={[styles.action,inactive&&styles.disabled]}>
   <Text style={styles.actionText}>{label}</Text>
  </Pressable>);
 return <View style={styles.field}>
  <Text style={styles.label}>Date of birth (optional)</Text>
  {action(original?"Date of birth: "+original+". Change date":
   "Choose date of birth",()=>{
    const date=original||current;
    setYearText(date.slice(0,4));setMonth(Number(date.slice(5,7))-1);
    setOpen(true);
   },disabled)}
  <Modal visible={open} transparent animationType="fade"
   onRequestClose={()=>setOpen(false)}>
   <View style={styles.backdrop}>
    <View style={styles.modal} accessibilityViewIsModal>
     <Text accessibilityRole="header" style={styles.heading}>Choose date of birth</Text>
     <Text style={styles.hint}>Choose a birth year, month and day.
      Dates after today are unavailable. You may leave this empty.</Text>
     <View style={styles.yearRow}>
      {action("Previous year",()=>setYearText(String(year-1)),!validYear||year<=1900)}
      <View style={{flex:1}}>
       <Text style={styles.label}>Birth year</Text>
       <TextInput value={yearText} onChangeText={setYearText}
        accessibilityLabel="Four digit year of birth"
        keyboardType="number-pad" maxLength={4} style={styles.yearInput}/>
      </View>
      {action("Next year",()=>setYearText(String(year+1)),
       !validYear||year>=Number(current.slice(0,4)))}
     </View>
     {!validYear&&<Text accessibilityRole="alert" style={styles.error}>
      Enter a four-digit year between 1900 and the current year.
     </Text>}
     <ScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Birth month</Text>
      <View style={styles.monthGrid}>
       {MONTHS.map((label,index)=><Pressable key={label}
        accessibilityRole="button"
        accessibilityLabel={"Choose "+label+" "+yearText}
        accessibilityState={{selected:month===index,disabled:!validYear}}
        disabled={!validYear}
        style={[styles.month,month===index&&styles.selected,
         !validYear&&styles.disabled]}
        onPress={()=>setMonth(index)}>
        <Text style={styles.label}>{label.slice(0,3)}</Text>
       </Pressable>)}
      </View>
      <Text style={styles.label}>{MONTHS[month]} {validYear?year:""} — choose day</Text>
      <View style={styles.days}>
       {DAYS.map(d=><Text key={d} style={styles.dayName}>{d}</Text>)}
       {cells.map((day,i)=>day<1||day>days?
        <View key={"blank-"+i} style={styles.day}/>:
        <Pressable key={"day-"+day} accessibilityRole="button"
         accessibilityLabel={String(day)+" "+MONTHS[month]+" "+yearText}
         accessibilityState={{selected:isoDay(year,month,day)===original,
          disabled:isoDay(year,month,day)>current}}
         disabled={isoDay(year,month,day)>current}
         style={[styles.day,isoDay(year,month,day)===original&&styles.selected,
          isoDay(year,month,day)>current&&styles.disabled]}
         onPress={()=>{
          const chosen=isoDay(year,month,day);
          if(chosen>="1900-01-01"&&chosen<=current){
           onChange(chosen);setOpen(false);
          }
         }}>
         <Text style={styles.label}>{day}</Text>
        </Pressable>)}
      </View>
     </ScrollView>
     <View style={styles.footer}>
      {action("Clear date",()=>{onChange("");setOpen(false);})}
      {action("Back without changing",()=>setOpen(false))}
     </View>
    </View>
   </View>
  </Modal>
 </View>;
}
const styles=StyleSheet.create({
 field:{gap:8},
 label:{fontSize:14,color:theme.text,fontWeight:"600"},
 action:{borderWidth:1,borderColor:theme.border,
  backgroundColor:theme.surface,borderRadius:9,
  minHeight:48,padding:10,justifyContent:"center",alignItems:"center"},
 actionText:{fontSize:14,color:theme.text,fontWeight:"600"},
 disabled:{opacity:0.4},
 backdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",
  padding:12,justifyContent:"center"},
 modal:{alignSelf:"center",width:"100%",maxWidth:520,maxHeight:"92%",
  backgroundColor:theme.surface,borderRadius:14,padding:16,gap:12},
 heading:{fontSize:20,fontWeight:"700",color:theme.text},
 hint:{fontSize:13,color:theme.mutedText},
 error:{fontSize:13,color:theme.error},
 yearRow:{flexDirection:"row",alignItems:"center",gap:8},
 yearInput:{borderWidth:1,borderColor:theme.border,borderRadius:8,
  minHeight:48,padding:9,color:theme.text},
 monthGrid:{flexDirection:"row",flexWrap:"wrap",gap:5,marginVertical:12},
 month:{width:"23%",borderWidth:1,borderColor:theme.border,
  padding:8,alignItems:"center",borderRadius:8,minHeight:44,
  justifyContent:"center"},
 selected:{borderColor:theme.primary,borderWidth:2},
 days:{flexDirection:"row",flexWrap:"wrap",marginTop:8},
 dayName:{width:"14.28%",textAlign:"center",fontSize:12,color:theme.mutedText},
 day:{width:"14.28%",height:46,alignItems:"center",justifyContent:"center",
  borderWidth:1,borderColor:theme.border},
 footer:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8}
});
