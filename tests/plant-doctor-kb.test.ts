import test from "node:test";
import assert from "node:assert/strict";
import { CONDITIONS } from "../backend/plantDoctor/card.js";
import { diagnosisCard, pickPlantCard, unknownPlantCard } from "../backend/plantDoctor/cards.js";
import { answeredProblem, diagnose, parsePick } from "../backend/plantDoctor/diagnose.js";
import { identityFromProfile, rankCandidates, resolvePlant } from "../backend/plantDoctor/identify.js";
import { parsePlantNetResults } from "../backend/plantDoctor/plantnet.js";
import { PROFILES, getProfile, matchScientific, matchText } from "../backend/plantDoctor/profiles/index.js";
import { LIGHT_LEVELS } from "../backend/plantDoctor/profiles/types.js";
import { HEALTHY_ID, UNSURE_ID } from "../backend/plantDoctor/prompt.js";
import { isProfileReviewed, loadProfileReviews, profileHash, resetProfileReviewsCache } from "../backend/plantDoctor/reviews.js";
import type { Db } from "mongodb";

const IMG = { mimeType: "image/jpeg", data: "QUJDRA==" };
const sci = (species: string, family = "") => ({ species, genus: species.split(" ")[0], family });
const kimTien = getProfile("kim_tien")!;

/** Giả Pl@ntNet trả `results`; status 404 = ảnh không có cây. Trả về hàm khôi phục và số lần gọi. */
function stubPlantNet(results: { species: string; family?: string; score: number }[] | 404) {
  const saved = { fetch: globalThis.fetch, key: process.env.PLANTNET_API_KEY, gem: process.env.GEMINI_API_KEY };
  process.env.PLANTNET_API_KEY = "test-key";
  delete process.env.GEMINI_API_KEY;
  const calls = { n: 0 };
  globalThis.fetch = (async () => {
    calls.n++;
    if (results === 404) return new Response("{}", { status: 404 });
    const body = {
      results: results.map((r) => ({
        score: r.score,
        species: {
          scientificNameWithoutAuthor: r.species,
          genus: { scientificNameWithoutAuthor: r.species.split(" ")[0] },
          family: { scientificNameWithoutAuthor: r.family ?? "" },
          commonNames: [],
        },
      })),
    };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const restore = () => {
    globalThis.fetch = saved.fetch;
    if (saved.key === undefined) delete process.env.PLANTNET_API_KEY;
    else process.env.PLANTNET_API_KEY = saved.key;
    if (saved.gem === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved.gem;
  };
  return { restore, calls };
}

test("KB1: hồ sơ loài đủ nội dung, mã không trùng, tên khoa học không trỏ hai hồ sơ", () => {
  assert.equal(new Set(PROFILES.map((p) => p.id)).size, PROFILES.length);
  const seen = new Map<string, string>();
  for (const p of PROFILES) {
    assert.ok(p.nameVi && p.scientific, p.id);
    assert.ok(p.source.name && /^https:\/\/\S+$/.test(p.source.url), `${p.id}: một nguồn có link`);
    const b = p.basics;
    assert.ok(b.lightLevel in LIGHT_LEVELS && b.light && b.water && b.soil && b.toxic && b.note, `${p.id}: thẻ chăm 5 dòng`);
    assert.ok(p.problems.length >= 3 && p.problems.length <= 5, `${p.id}: 3–5 vấn đề`);
    assert.equal(new Set(p.problems.map((x) => x.id)).size, p.problems.length, p.id);
    assert.equal(new Set(p.problems.map((x) => x.title.toLowerCase())).size, p.problems.length, `${p.id}: tiêu đề trùng`);
    for (const pr of p.problems) {
      assert.ok(![HEALTHY_ID, UNSURE_ID].includes(pr.id), `${p.id}/${pr.id}`);
      assert.ok(CONDITIONS.includes(pr.condition), `${p.id}/${pr.id}`);
      assert.ok(pr.title && pr.signs && pr.summary && pr.why && pr.steps.length && pr.care.length, `${p.id}/${pr.id}`);
      assert.ok(!pr.title.includes("→"), `${p.id}/${pr.id}`);
    }
    const keys = [...(p.match.species ?? []), ...(p.match.genera ?? []), ...(p.match.families ?? [])];
    for (const k of keys.map((x) => x.toLowerCase())) {
      assert.ok(!seen.has(k), `${k} ở cả ${seen.get(k)} và ${p.id}`);
      seen.set(k, p.id);
    }
  }
  assert.equal(PROFILES.filter((p) => p.alohaDoc).length, 14, "14 loài có bài hướng dẫn Aloha trên Drive");
});

test("KB2: khớp tên khoa học: loài trước chi, chi trước họ", () => {
  assert.equal(matchScientific(sci("Zamioculcas zamiifolia"))?.id, "kim_tien");
  assert.equal(matchScientific(sci("Dracaena trifasciata"))?.id, "luoi_ho", "lưỡi hổ nay xếp vào chi Dracaena");
  assert.equal(matchScientific(sci("Dracaena sanderiana"))?.id, "truc_phat_tai");
  assert.equal(matchScientific(sci("Dracaena fragrans"))?.id, "phat_tai");
  assert.equal(matchScientific(sci("Kalanchoe blossfeldiana", "Crassulaceae"))?.id, "song_doi");
  assert.equal(matchScientific(sci("Echeveria elegans", "Crassulaceae"))?.id, "sen_da");
  assert.equal(matchScientific(sci("Mammillaria elongata", "Cactaceae"))?.id, "xuong_rong");
  assert.equal(matchScientific(sci("Euphorbia pulcherrima", "Euphorbiaceae")), null, "trạng nguyên không phải bát tiên");
  assert.equal(matchScientific(sci("Rosa chinensis", "Rosaceae")), null);
});

test("KB3: khớp tên cây khách gõ, không nhầm từ thường", () => {
  assert.equal(matchText("Cây kim tiền nhà tôi bị vàng lá")?.id, "kim_tien");
  assert.equal(matchText("cay luoi ho bi thoi goc")?.id, "luoi_ho");
  assert.equal(matchText("Cây của tôi là Trúc phát tài.")?.id, "truc_phat_tai");
  assert.equal(matchText("Tôi có câu hỏi về cây"), null, "câu ≠ cau");
  assert.equal(matchText("Nhờ bác sĩ xem giúp"), null);
  assert.equal(matchText("tôi muốn bổ sung phân"), null);
  assert.equal(matchText("cây kim ngân lượng bị rụng lá"), null, "kim ngân lượng chưa có hồ sơ, không lấy kim ngân");
});

test("KB4: gộp kết quả Pl@ntNet theo hồ sơ và cộng điểm", () => {
  const ranked = rankCandidates([
    { ...sci("Echeveria elegans", "Crassulaceae"), commonNames: [], score: 0.3 },
    { ...sci("Graptopetalum paraguayense", "Crassulaceae"), commonNames: [], score: 0.25 },
    { ...sci("Rosa chinensis", "Rosaceae"), commonNames: ["China rose"], score: 0.1 },
    { ...sci("Citrus microcarpa", "Rutaceae"), commonNames: [], score: 0.001 },
  ]);
  assert.equal(ranked[0].profileId, "sen_da");
  assert.equal(ranked[0].score, 0.55);
  assert.deepEqual(ranked[1], { profileId: null, name: "China rose", scientificName: "Rosa chinensis", score: 0.1 });
  assert.equal(ranked.length, 2, "loài gần 0% không đưa cho khách chọn");
  assert.deepEqual(parsePlantNetResults({ results: [{ score: 9, species: {} }] }), [], "bỏ kết quả thiếu tên loài");
});

test("KB5: Pl@ntNet chắc chắn thì dùng luôn; điểm thấp thì hỏi khách; ảnh không có cây thì báo", async () => {
  let s = stubPlantNet([{ species: "Zamioculcas zamiifolia", score: 0.82 }]);
  try {
    const r = await resolvePlant({ ref: null, images: [IMG], userTexts: ["cây bị vàng lá"] });
    assert.equal(r.kind, "known");
    if (r.kind === "known") assert.deepEqual([r.identity.profileId, r.identity.source, r.identity.score], ["kim_tien", "plantnet", 0.82]);
  } finally {
    s.restore();
  }

  s = stubPlantNet([{ species: "Rosa chinensis", family: "Rosaceae", score: 0.9 }]);
  try {
    const card = await diagnose({ messages: [{ role: "user", content: "lá đốm" }], images: [IMG], plant: null, contents: [] });
    assert.equal(card.kind, "unknown_plant", "cây chưa có hồ sơ: nói thật, không bịa cách chữa");
    assert.ok(card.needHelp);
    assert.equal(card.problemId, null);
  } finally {
    s.restore();
  }

  s = stubPlantNet([
    { species: "Zamioculcas zamiifolia", score: 0.12 },
    { species: "Epipremnum aureum", score: 0.1 },
  ]);
  try {
    const card = await diagnose({ messages: [{ role: "user", content: "xem giúp" }], images: [IMG], plant: null, contents: [] });
    assert.equal(card.kind, "pick_plant");
    assert.deepEqual(card.plant?.candidates.map((c) => c.profileId), ["kim_tien", "trau_ba"]);
    const typed = await resolvePlant({ ref: null, images: [IMG], userTexts: ["cây trầu bà bị vàng lá"] });
    assert.ok(typed.kind === "known" && typed.identity.profileId === "trau_ba", "Pl@ntNet chưa chắc thì tin tên khách gõ");
  } finally {
    s.restore();
  }

  s = stubPlantNet(404);
  try {
    const card = await diagnose({ messages: [{ role: "user", content: "xem giúp" }], images: [IMG], plant: null, contents: [] });
    assert.equal(card.kind, "off_topic");
  } finally {
    s.restore();
  }
});

test("KB6: khách đã chọn cây thì không gọi Pl@ntNet; gõ tên cây khác thì đổi theo", async () => {
  const s = stubPlantNet([{ species: "Epipremnum aureum", score: 0.95 }]);
  try {
    const ref = { profileId: "kim_tien", name: "Kim tiền", confirmed: true, source: "customer" as const, score: null };
    const kept = await resolvePlant({ ref, images: [IMG], userTexts: ["Cây của tôi là Kim tiền."] });
    assert.ok(kept.kind === "known" && kept.identity.profileId === "kim_tien");
    assert.equal(s.calls.n, 0);
    const answer = await resolvePlant({ ref, images: [], userTexts: ["Dấu hiệu nào giống cây của bạn nhất? → Thối củ"] });
    assert.ok(answer.kind === "known" && answer.identity.profileId === "kim_tien", "câu trả lời nhanh không đổi cây");
    const changed = await resolvePlant({ ref, images: [], userTexts: ["còn cây lưỡi hổ thì sao"] });
    assert.ok(changed.kind === "known" && changed.identity.profileId === "luoi_ho");
  } finally {
    s.restore();
  }
});

test("KB7: không có AI thì khách tự chọn dấu hiệu; bấm đáp án thì lấy đúng nội dung hồ sơ", async () => {
  const s = stubPlantNet([]);
  delete process.env.PLANTNET_API_KEY;
  try {
    const ref = { profileId: "kim_tien", name: "Kim tiền", confirmed: true, source: "customer" as const, score: null };
    const pick = await diagnose({ messages: [{ role: "user", content: "lá vàng" }], images: [], plant: ref, contents: [] });
    assert.equal(pick.kind, "pick_problem");
    assert.deepEqual(pick.followUps[0].options, kimTien.problems.map((p) => p.title));

    const problem = kimTien.problems[0];
    const answer = `${pick.followUps[0].question} → ${problem.title}`;
    assert.equal(answeredProblem(kimTien, answer)?.id, problem.id);
    const card = await diagnose({ messages: [{ role: "user", content: answer }], images: [], plant: ref, contents: [] });
    assert.equal(card.kind, "diagnosis");
    assert.deepEqual([card.title, card.steps, card.care, card.whyDetail], [problem.title, problem.steps, problem.care, problem.why]);
    assert.equal(card.plantName, "Kim tiền");

    const none = await diagnose({ messages: [{ role: "user", content: "cây bị héo" }], images: [], plant: null, contents: [] });
    assert.equal(none.kind, "pick_plant", "chưa biết cây thì hỏi tên cây trước, không đoán");
  } finally {
    s.restore();
  }
});

test("KB8: câu trả lời AI chỉ giữ mã có trong hồ sơ; độ chắc chắn không vượt độ chắc nhận diện", () => {
  const p = parsePick({ problemId: "benh_bia", confidence: "rất cao", alternatives: ["ung_re", "x", 3], observed: " a ".repeat(400) }, kimTien);
  assert.ok(p);
  assert.equal(p?.problemId, "");
  assert.equal(p?.confidence, "thap");
  assert.deepEqual(p?.alternatives, ["ung_re"]);
  assert.ok((p?.observed.length ?? 0) <= 300);
  assert.equal(parsePick({ problemId: HEALTHY_ID }, kimTien)?.problemId, HEALTHY_ID);

  const weak = identityFromProfile(kimTien, "plantnet", 0.3);
  const card = diagnosisCard({ profile: kimTien, plant: weak, problem: kimTien.problems[0], confidence: "cao" });
  assert.equal(card.confidence, "vua");
  assert.equal(diagnosisCard({ profile: kimTien, plant: identityFromProfile(kimTien, "customer"), problem: kimTien.problems[0], confidence: "cao" }).confidence, "cao");

  const unknown = unknownPlantCard({ profileId: null, name: "Hoa hồng", scientificName: "Rosa chinensis", source: "plantnet", score: 0.9, candidates: [] });
  assert.ok(unknown.steps.length && unknown.needHelp && !unknown.basics && !unknown.source);
  assert.deepEqual([card.source, card.careByAloha], [kimTien.source, true]);
  assert.deepEqual(pickPlantCard([{ profileId: null, name: "X", scientificName: "X y", score: 0.5 }], true).plant?.candidates, []);
});

test("KB9: duyệt hồ sơ trong admin; sửa nội dung hồ sơ thì lượt duyệt cũ hết hiệu lực", async () => {
  assert.equal(profileHash({ ...kimTien, reviewed: true }), profileHash(kimTien));
  const edited = { ...kimTien, basics: { ...kimTien.basics, water: kimTien.basics.water + " (sửa)" } };
  assert.notEqual(profileHash(edited), profileHash(kimTien));

  const docs = [
    { _id: "kim_tien", hash: profileHash(kimTien), reviewedAt: new Date(), reviewedBy: "ql" },
    { _id: "luoi_ho", hash: "noi-dung-cu", reviewedAt: new Date(), reviewedBy: "ql" },
  ];
  const db = { collection: () => ({ find: () => ({ toArray: async () => docs }) }) } as unknown as Db;
  resetProfileReviewsCache();
  const reviews = await loadProfileReviews(db);
  resetProfileReviewsCache();
  assert.deepEqual([...reviews.keys()], ["kim_tien"]);
  assert.equal(isProfileReviewed(kimTien, reviews), true);
  assert.equal(isProfileReviewed(getProfile("luoi_ho")!, reviews), false);
});
