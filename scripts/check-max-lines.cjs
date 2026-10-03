#!/usr/bin/env node
/**
 * Chặn file mã nguồn vượt số dòng tối đa (mặc định 800).
 *
 *   node scripts/check-max-lines.cjs                 # quét phạm vi mặc định, exit 1 nếu có file vượt
 *   node scripts/check-max-lines.cjs --max 800 --report 500   # in thêm các file > 500 dòng
 *   node scripts/check-max-lines.cjs path/a.ts path/dir       # chỉ quét đường dẫn chỉ định
 *
 * File cũ chưa kịp tách liệt kê trong scripts/max-lines-allowlist.json (kèm số dòng hiện tại);
 * file trong danh sách chỉ được phép giảm, không được dài thêm.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_SCOPES = ["backend", "frontend/app", "frontend/components", "frontend/lib", "tests"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage", ".turbo"]);
const ALLOWLIST_FILE = path.join(__dirname, "max-lines-allowlist.json");

function parseArgs(argv) {
  const out = { max: 800, report: 0, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max") out.max = Number(argv[++i]);
    else if (a === "--report") out.report = Number(argv[++i]);
    else out.paths.push(a);
  }
  if (!Number.isFinite(out.max) || out.max < 1) throw new Error("--max phải là số dương");
  return out;
}

function walk(target, files) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    return;
  }
  if (stat.isFile()) {
    if (EXTENSIONS.has(path.extname(target))) files.push(target);
    return;
  }
  for (const name of fs.readdirSync(target)) {
    if (SKIP_DIRS.has(name)) continue;
    walk(path.join(target, name), files);
  }
}

function countLines(file) {
  const text = fs.readFileSync(file, "utf8");
  if (!text.length) return 0;
  const n = text.split(/\r?\n/).length;
  return text.endsWith("\n") ? n - 1 : n;
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_FILE)) return {};
  return JSON.parse(fs.readFileSync(ALLOWLIST_FILE, "utf8"));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scopes = args.paths.length ? args.paths : DEFAULT_SCOPES;
  const files = [];
  for (const s of scopes) walk(path.resolve(ROOT, s), files);
  const allow = loadAllowlist();
  const rows = files
    .map((f) => ({ rel: path.relative(ROOT, f).split(path.sep).join("/"), lines: countLines(f) }))
    .sort((a, b) => b.lines - a.lines);

  const errors = [];
  for (const r of rows) {
    if (r.lines <= args.max) continue;
    const allowed = allow[r.rel];
    if (typeof allowed === "number" && r.lines <= allowed) continue;
    errors.push(
      typeof allowed === "number"
        ? `${r.rel}: ${r.lines} dòng (danh sách cho phép tối đa ${allowed}, không được dài thêm)`
        : `${r.rel}: ${r.lines} dòng (tối đa ${args.max})`
    );
  }
  if (args.report > 0) {
    for (const r of rows.filter((x) => x.lines > args.report)) {
      console.log(`${String(r.lines).padStart(6)} ${r.rel}`);
    }
  }
  if (errors.length) {
    console.error(`\n[check-max-lines] ${errors.length} file vượt giới hạn:`);
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`[check-max-lines] OK: ${rows.length} file, không file nào vượt ${args.max} dòng.`);
}

main();
