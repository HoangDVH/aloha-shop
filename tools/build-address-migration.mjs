import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = process.argv[2] || 'artifacts/address-data';
const hashes = {};
async function load(name) {
  const text = await readFile(`${root}/${name}.json`, 'utf8');
  hashes[name] = createHash('sha256').update(text).digest('hex');
  const json = JSON.parse(text);
  if (json.metadata?.license !== 'CC BY 4.0' || json.data?.length !== json.metadata.rows) throw new Error('Invalid source: ' + name);
  return json;
}
const legacyProvinces = await load('provinces-legacy'), districts = await load('districts-legacy');
const oldWards = await load('wards-legacy'), newProvinces = await load('provinces'), newWards = await load('wards'), mappings = await load('ward-merge-history');
const fullName = r => [r.type, r.name].filter(Boolean).join(' ');
const byProvince = new Map(legacyProvinces.data.map(r => [r.code, r]));
const byDistrict = new Map(districts.data.map(r => [r.code, r]));
const byOld = new Map(oldWards.data.map(r => [r.code, r]));
const byNew = new Map(newWards.data.map(r => [r.code, r]));
const groups = new Map();
for (const r of mappings.data) {
  const group = groups.get(r.old_ward_code) || [];
  group.push(r); groups.set(r.old_ward_code, group);
}
const legacy = [];
for (const [oldCode, old] of byOld) {
  const province = byProvince.get(old.province_code), district = byDistrict.get(old.district_code);
  if (!province || !district || district.province_code !== province.code) throw new Error('Invalid legacy parent: ' + oldCode);
  const links = groups.get(oldCode) || [];
  const targets = [...new Set(links.map(r => r.new_ward_code))];
  const certain = links.length > 0 && targets.length === 1 && links.every(r => r.scope === 'full'
    && r.old_province_code === old.province_code && r.old_district_code === old.district_code
    && byNew.get(r.new_ward_code)?.province_code === r.new_province_code);
  legacy.push([fullName(province), fullName(district), fullName(old), oldCode, targets.filter(code => byNew.has(code)), certain]);
}
const snapshot = { metadata: { publisher: 'tinhthanhpho.com', version: mappings.metadata.data_version,
  generatedAt: mappings.metadata.generated_at, license: 'CC BY 4.0', source: 'https://tinhthanhpho.com/api-docs', hashes },
  provinces: newProvinces.data.map(r => [r.code, fullName(r)]),
  wards: newWards.data.map(r => [r.code, r.province_code, fullName(r)]), legacy };
await mkdir('backend/shopShipping/addressMigration', { recursive: true });
await writeFile('backend/shopShipping/addressMigration/snapshot.json', JSON.stringify(snapshot) + '\n');
console.log(JSON.stringify({ legacy: legacy.length, current: snapshot.wards.length, certain: legacy.filter(r => r[5]).length }));
