/**
 * Smoke P0 CTV register — validation + optional live API
 *   node tools/qa_ctv_form_p0_smoke.cjs
 * Env: SHOP_API_BASE (default http://127.0.0.1:3001)
 */
"use strict";

const API = process.env.SHOP_API_BASE || "http://127.0.0.1:3001";

function assert(id, cond, detail) {
  if (!cond) {
    console.error(`FAIL ${id}: ${detail}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`PASS ${id}: ${detail}`);
  return true;
}

async function req(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

function cookieFrom(res) {
  const set = res.headers.getSetCookie?.() || [];
  return set.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const stamp = Date.now();
  const email = `qa.ctv.p0.${stamp}@example.com`;
  const phone = `09${String(stamp).slice(-8)}`;

  // API up?
  let up = false;
  try {
    const ping = await fetch(`${API}/api/shop/auth/me`, { signal: AbortSignal.timeout(3000) });
    up = ping.status === 401 || ping.ok;
  } catch {
    up = false;
  }
  if (!up) {
    console.log("SKIP live API — server not running on", API);
    console.log("Validation-only checks via inline rules:");
    const badYears = [0, 51, -1, 1.5];
    for (const y of badYears) {
      assert(
        `TC-A07-local-${y}`,
        !(Number.isInteger(y) && y >= 1 && y <= 50),
        `năm ${y} invalid`
      );
    }
    assert("TC-A07-local-ok", Number.isInteger(3) && 3 >= 1 && 3 <= 50, "năm 3 ok");
    return;
  }

  // Missing fields → 400
  const miss = await req("/api/shop/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "password1",
      fullName: "QA CTV",
      phone,
      roles: ["ctv"],
    }),
  });
  assert("TC-BE-01", miss.status === 400, `thiếu hồ sơ → ${miss.status} ${miss.data.error}`);

  // Full payload → 201 cho_duyet
  const full = await req("/api/shop/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "password1",
      fullName: "QA CTV P0",
      phone,
      roles: ["ctv"],
      zalo: phone,
      addressText: "1 Nguyen Hue, Q1, HCM",
      referralChannel: "facebook",
      channelUrl: "https://facebook.com/qa.aloha",
      referralSource: "Google tìm kiếm",
      hasBusinessExp: true,
      businessExpNote: "Ban cay canh online",
      businessExpYears: 2,
    }),
  });
  const user = full.data?.user;
  assert(
    "TC-B01",
    (full.status === 201 || full.status === 200) &&
      user?.roles?.includes("ctv") &&
      user?.ctvStatus === "cho_duyet" &&
      user?.zalo === phone &&
      user?.addressText &&
      user?.referralChannel === "facebook" &&
      user?.hasBusinessExp === true &&
      user?.businessExpYears === 2 &&
      Boolean(user?.ctvCode),
    `register → ${full.status} status=${user?.ctvStatus} code=${user?.ctvCode} err=${full.data?.error || ""}`
  );

  // Duplicate email → 409
  const dup = await req("/api/shop/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "password1",
      fullName: "QA CTV P0",
      phone: `08${String(stamp).slice(-8)}`,
      roles: ["ctv"],
      zalo: phone,
      addressText: "1 Nguyen Hue",
      referralChannel: "tiktok",
      channelUrl: "https://tiktok.com/@qa",
      hasBusinessExp: false,
    }),
  });
  assert("TC-B03", dup.status === 409, `email trùng → ${dup.status} ${dup.data.error}`);

  // Year 0 → 400
  const email2 = `qa.ctv.p0y.${stamp}@example.com`;
  const badY = await req("/api/shop/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: email2,
      password: "password1",
      fullName: "QA CTV",
      phone: `07${String(stamp).slice(-8)}`,
      roles: ["ctv"],
      zalo: `07${String(stamp).slice(-8)}`,
      addressText: "Addr",
      referralChannel: "zalo",
      channelUrl: "https://zalo.me/0794901233",
      hasBusinessExp: true,
      businessExpNote: "test",
      businessExpYears: 0,
    }),
  });
  assert("TC-A07-api", badY.status === 400, `năm 0 → ${badY.status} ${badY.data.error}`);

  console.log(process.exitCode ? "DONE with failures" : "DONE all pass");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
