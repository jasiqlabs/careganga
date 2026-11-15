import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
export default function PublicHome() {
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>CareGanga Foundation</Text>
    <Text>Foundation operations and healthcare assistance.</Text>
    <View style={styles.gap}/>
    <Text>Public features will become available as their owning modules are delivered.</Text>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1},
  content:{padding:24,gap:12,minHeight:"100%"},
  title:{fontSize:24,fontWeight:"700"},
  gap:{height:12}
});
