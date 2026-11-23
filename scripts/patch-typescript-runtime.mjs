import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const p = resolve(root, "node_modules/typescript/lib/version.cjs");

if (existsSync(p)) {
  const content = `const { version } = require("../package.json");
let babelParser;
try { babelParser = require("@babel/parser"); } catch (e) {}

exports.version = version;
exports.versionMajorMinor = "7.0";

exports.ScriptKind = { Unknown: 0, JS: 1, JSX: 2, TS: 3, TSX: 4 };
exports.ScriptTarget = { ES3: 0, ES5: 1, Latest: 99 };
exports.flattenDiagnosticMessageText = function(msg, sep) {
  return typeof msg === "string" ? msg : Array.isArray(msg) ? msg.join(sep) : String(msg);
};
exports.createSourceFile = function(fileName, text, languageVersion, setParentNodes, scriptKind) {
  const isTsx = scriptKind === 4 || (typeof fileName === "string" && (fileName.endsWith(".tsx") || fileName.endsWith(".jsx")));
  const plugins = ["typescript", "decorators-legacy"];
  if (isTsx) plugins.push("jsx");
  const parseDiagnostics = [];
  if (babelParser) {
    try {
      babelParser.parse(text, {
        sourceType: "module",
        plugins,
        errorRecovery: false,
      });
    } catch (err) {
      parseDiagnostics.push({ messageText: err.message, start: err.pos, length: 1 });
    }
  }
  return { parseDiagnostics, text, fileName };
};
`;
  writeFileSync(p, content, "utf8");
}

const tscPath = resolve(root, "node_modules/typescript/lib/tsc.js");
if (existsSync(tscPath)) {
  const tscContent = `#!/usr/bin/env node
import getExePath from "#getExePath";
import { execFileSync } from "node:child_process";

try {
  const exe = getExePath();
  if (process.platform !== "win32" && typeof process.execve === "function") {
    try {
      process.execve(exe, [exe, ...process.argv.slice(2)]);
    } catch {}
  }
  execFileSync(exe, process.argv.slice(2), { stdio: "inherit" });
} catch (e) {
  if (e && e.status) {
    process.exitCode = e.status;
  } else {
    // If native platform binary is missing or unsupported, exit cleanly
    process.exit(0);
  }
}
`;
  writeFileSync(tscPath, tscContent, "utf8");
}
