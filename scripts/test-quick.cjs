const { spawn } = require("node:child_process");
const path = require("node:path");
const groups = require("./test-groups.cjs");

function plan(args) {
  const names = args.filter(a => a !== "--dry-run");
  if (!names.length || names.includes("--help")) return null;
  for (const name of names) if (!Object.hasOwn(groups, name)) throw new Error(`Unknown test group: ${name}`);
  return [...new Set(names.flatMap(name => groups[name]))].map(name => `tests/${name}.test.ts`);
}

function main(args) {
  let files;
  try { files = plan(args); } catch (error) { console.error(error.message); process.exitCode = 1; return; }
  if (!files) {
    console.log(`Usage: npm run test:quick -- <${Object.keys(groups).join("| ")}> [--dry-run]\nSelect one or more groups. No browser tests, downloads or automatic retries.`);
    return;
  }
  console.log(`Selected ${files.length} test files:\n${files.join("\n")}`);
  if (args.includes("--dry-run")) return;
  const child = spawn(process.execPath, ["--import", "tsx", "--test", "--test-timeout=30000", ...files], {
    cwd: path.resolve(__dirname, ".."), stdio: "inherit",
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { plan };
