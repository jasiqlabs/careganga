import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const suites = [
  { name: "04-qa-cg14-network.mjs", title: "CG-14 Healthcare Network" },
  { name: "05-qa-cg15-appointments.mjs", title: "CG-15 Patients & Appointments" },
  { name: "06-qa-cg17-assistance-settlements.mjs", title: "CG-17 Assistance & Settlements" },
  { name: "07-qa-cg16-diagnostics.mjs", title: "CG-16 Diagnostics" }
];

async function runSuite(suite) {
  console.log(`\n>>> RUNNING SUITE: ${suite.title} (${suite.name})`);
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn("node", [resolve(__dirname, suite.name)], { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`COMPLETED: ${suite.title} finished successfully.`);
        resolvePromise();
      } else {
        rejectPromise(new Error(`FAILED: ${suite.title} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log("=== EXECUTING ALL CAREGANGA HEALTHCARE MANUAL QA WALKTHROUGHS ===");
  for (const s of suites) {
    await runSuite(s);
  }
  console.log("\nALL 4 HEALTHCARE MODULE QA SUITES COMPLETED WITH 100% PASS!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
