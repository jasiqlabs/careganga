// Local developer-only source gate. No CI or GitHub Actions.
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const pkg=JSON.parse(readFileSync(resolve(root,"package.json"),"utf8"));
const exclude=new Set(["verify:local-source-preflight","verify:local-build",
 "verify:all-source"]);
const scripts=Object.keys(pkg.scripts).filter(name=>
 name.startsWith("verify:")&&!exclude.has(name));
const order=(name)=>name==="verify:design-approvals"?"0"+name:
 name==="verify:migration-history-source"?"1"+name:"2"+name;
scripts.sort((a,b)=>order(a).localeCompare(order(b)));
if(!scripts.includes("verify:design-approvals")||
 !scripts.includes("verify:migration-history-source")||
 !scripts.includes("verify:cg17-us006-source"))
 throw Error("Mandatory current source gates unavailable");
for(const name of scripts){
 process.stdout.write("\n[CareGanga source] "+name+"\n");
 const run=spawnSync(process.platform==="win32"?"npm.cmd":"npm",
  ["run",name],{cwd:root,stdio:"inherit",shell:process.platform==="win32"});
 if(run.error||run.status!==0){
  process.stderr.write("Source gate failed: "+name+"\n");
  process.exit(run.status??1);
 }
}
process.stdout.write("\nAll "+scripts.length+" local source checks exited successfully.\n"+
 "This is NOT a Web/Android/PG/provider/device runtime QA pass.\n");
