import test from "node:test";
import assert from "node:assert/strict";
import { CONDITIONS } from "../backend/plantDoctor/card.js";
import { diagnosisCard, pickPlantCard, unknownPlantCard } from "../backend/plantDoctor/cards.js";
import { answeredProblem, diagnose, parsePick, parsePlantGuess, withAiGuess } from "../backend/plantDoctor/diagnose.js";
import { resetGeminiCooldowns } from "../backend/plantDoctor/gemini.js";
import { identityFromProfile, rankCandidates, resolvePlant } from "../backend/plantDoctor/identify.js";
import { parsePlantNetResults } from "../backend/plantDoctor/plantnet.js";
import { BONSAI_PROFILES, PROFILES, getProfile, matchScientific, matchText, mentionsBonsai } from "../backend/plantDoctor/profiles/index.js";
import { LIGHT_LEVELS } from "../backend/plantDoctor/profiles/types.js";
import { HEALTHY_ID, UNSURE_ID } from "../backend/plantDoctor/prompt.js";
import { parsePlantDoctorBody } from "../backend/plantDoctor/routes.js";
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

test("KB10: gửi ảnh cây khác sau khi đã có cây thì nhận diện lại, không dùng cây cũ", async () => {
  const xuongRong = { profileId: "xuong_rong", name: "Xương rồng", confirmed: true, source: "customer" as const, score: null };
  let s = stubPlantNet([{ species: "Zamioculcas zamiifolia", score: 0.82 }]);
  try {
    const r = await resolvePlant({ ref: xuongRong, images: [IMG], userTexts: ["cây này bị gì"], newPhotos: true });
    assert.ok(r.kind === "known" && r.identity.profileId === "kim_tien", "ảnh mới thắng cây khách chọn ở lượt trước");
    assert.equal(s.calls.n, 1);
    const resent = await resolvePlant({ ref: xuongRong, images: [IMG], userTexts: ["Cây của tôi là Xương rồng."] });
    assert.ok(resent.kind === "known" && resent.identity.profileId === "xuong_rong", "gửi lại ảnh cũ kèm cây vừa chọn thì giữ");
  } finally {
    s.restore();
  }

  s = stubPlantNet([{ species: "Epipremnum aureum", score: 0.1 }]);
  try {
    const old = { ...xuongRong, confirmed: false, source: "plantnet" as const, score: 0.35 };
    const r = await resolvePlant({ ref: old, images: [IMG], userTexts: ["cây kim tiền nhà tôi", "xem giúp cây này"], newPhotos: true });
    assert.equal(r.kind, "uncertain", "không lấy cây lượt trước hay tên cây trong tin cũ");
    if (r.kind === "uncertain") assert.deepEqual(r.candidates.map((c) => [c.profileId, c.score]), [["trau_ba", 0.1], ["xuong_rong", 0]]);
  } finally {
    s.restore();
  }

  s = stubPlantNet(404);
  try {
    const r = await resolvePlant({ ref: xuongRong, images: [IMG], userTexts: ["xem giúp"], newPhotos: true });
    assert.equal(r.kind, "not_plant");
  } finally {
    s.restore();
  }

  const body = (extra: object) => ({
    messages: [
      { role: "user", content: "cây xương rồng bị rệp" },
      { role: "assistant", content: "Cây: Xương rồng" },
      { role: "user", content: "còn cây này" },
    ],
    images: [IMG],
    ...extra,
  });
  const fresh = parsePlantDoctorBody(body({ plant: xuongRong, newPhotos: true }));
  assert.ok(!("error" in fresh) && fresh.newPhotos && fresh.messages.length === 1, "ảnh mới: bỏ hội thoại về cây trước");
  const picked = parsePlantDoctorBody(body({ plant: xuongRong, newPhotos: false }));
  assert.ok(!("error" in picked) && !picked.newPhotos && picked.messages.length === 3);
  const oldClient = parsePlantDoctorBody(body({ plant: { ...xuongRong, confirmed: false, source: "plantnet" } }));
  assert.ok(!("error" in oldClient) && oldClient.newPhotos, "trình duyệt cũ không gửi cờ: ảnh + cây chưa xác nhận = ảnh mới");
});

test("KB11: Pl@ntNet không chắc thì AI đoán trong 32 hồ sơ, khách phải bấm xác nhận", async () => {
  assert.equal(parsePlantGuess({ plantInImage: true, profileId: "kim_tien", confidence: "thap" }).kind, "none", "độ chắc thấp thì không gợi ý");
  assert.equal(parsePlantGuess({ plantInImage: true, profileId: "hoa_hong", confidence: "cao" }).kind, "none", "mã ngoài hồ sơ bị loại");
  assert.equal(parsePlantGuess({ plantInImage: false, profileId: "khac", confidence: "cao" }).kind, "no_plant");
  const g = parsePlantGuess({ plantInImage: true, profileId: "kim_tien", confidence: "vua" });
  assert.ok(g.kind === "plant" && g.candidate.byAi && g.candidate.score === 0);

  const listed = [
    { profileId: "trau_ba", name: "Trầu bà", scientificName: "Epipremnum aureum", score: 0.12 },
    { profileId: "kim_tien", name: "Kim tiền", scientificName: "Zamioculcas zamiifolia", score: 0.05 },
  ];
  if (g.kind === "plant") {
    const merged = withAiGuess(listed, g.candidate);
    assert.deepEqual(merged.map((c) => [c.profileId, c.score, Boolean(c.byAi)]), [["kim_tien", 0.05, true], ["trau_ba", 0.12, false]]);
    const card = pickPlantCard(merged, true);
    assert.equal(card.kind, "pick_plant", "AI đoán không tự chẩn đoán");
    assert.match(card.summary, /Trợ lý AI đoán đây có thể là cây Kim tiền/);
  }

  const saved = { fetch: globalThis.fetch, pn: process.env.PLANTNET_API_KEY, gem: process.env.GEMINI_API_KEY };
  process.env.PLANTNET_API_KEY = "test-key";
  process.env.GEMINI_API_KEY = "test-gemini-key-0123456789";
  resetGeminiCooldowns();
  let geminiReply = { plantInImage: true, profileId: "kim_tien", confidence: "cao" };
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("plantnet")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiReply) }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const card = await diagnose({ messages: [{ role: "user", content: "cây bị gì" }], images: [IMG], plant: null, contents: [{ role: "user", parts: [{ text: "x" }] }] });
    assert.equal(card.kind, "pick_plant", "Pl@ntNet không ra kết quả nhưng AI thấy kim tiền: hỏi khách xác nhận");
    assert.deepEqual(card.plant?.candidates.map((c) => [c.profileId, Boolean(c.byAi)]), [["kim_tien", true]]);
    geminiReply = { plantInImage: false, profileId: "khac", confidence: "cao" };
    const off = await diagnose({ messages: [{ role: "user", content: "cây bị gì" }], images: [IMG], plant: null, contents: [{ role: "user", parts: [{ text: "x" }] }] });
    assert.equal(off.kind, "off_topic", "cả Pl@ntNet và AI đều không thấy cây");
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.pn === undefined) delete process.env.PLANTNET_API_KEY;
    else process.env.PLANTNET_API_KEY = saved.pn;
    if (saved.gem === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = saved.gem;
  }
});

test("KB12: khách chỉ nói \"bonsai\" thì hỏi lại loài, gợi ý các hồ sơ cây gỗ làm bonsai", async () => {
  const bonsaiIds = ["ficus", "tung", "bach_tuyet_mai", "tac_chanh"];
  assert.deepEqual(BONSAI_PROFILES.map((p) => p.id).sort(), [...bonsaiIds].sort());
  assert.ok(mentionsBonsai("Cây Bonsai nhà tôi bị vàng lá") && mentionsBonsai("cay bon sai bi rung la"));
  assert.ok(!mentionsBonsai("cây thế này bị sao") && !mentionsBonsai("bonsaii"));

  const s = stubPlantNet([]);
  delete process.env.PLANTNET_API_KEY;
  try {
    const card = await diagnose({ messages: [{ role: "user", content: "cây bonsai bị vàng lá" }], images: [], plant: null, contents: [] });
    assert.equal(card.kind, "pick_plant");
    assert.equal(card.title, "Bonsai của bạn là cây gì?");
    assert.deepEqual(card.plant?.candidates.map((c) => c.profileId).sort(), [...bonsaiIds].sort());

    const named = await resolvePlant({ ref: null, images: [], userTexts: ["bonsai tùng la hán bị vàng lá"] });
    assert.ok(named.kind === "known" && named.identity.profileId === "tung", "gõ kèm tên loài thì dùng luôn");
    const ref = { profileId: "ficus", name: "Ficus", confirmed: true, source: "customer" as const, score: null };
    const kept = await resolvePlant({ ref, images: [], userTexts: ["bonsai của tôi rụng lá"] });
    assert.ok(kept.kind === "known" && kept.identity.profileId === "ficus", "đã chọn loài thì không hỏi lại");
  } finally {
    s.restore();
  }

  const p = stubPlantNet([{ species: "Epipremnum aureum", score: 0.1 }]);
  try {
    const r = await resolvePlant({ ref: null, images: [IMG], userTexts: ["bonsai này bị gì"] });
    assert.ok(r.kind === "uncertain" && r.bonsai);
    if (r.kind === "uncertain") assert.deepEqual(r.candidates.map((c) => c.profileId), ["trau_ba", "ficus", "tung", "bach_tuyet_mai", "tac_chanh"]);
  } finally {
    p.restore();
  }
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
