import {
  parseCtvApplicationBody,
  isValidPhoneVn,
  isValidZalo,
} from "../backend/shopAuth/ctvApplication.ts";

function ok(id: string, cond: boolean, detail: string) {
  if (!cond) {
    console.error(`FAIL ${id}: ${detail}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${id}: ${detail}`);
  }
}

ok("phone", isValidPhoneVn("0901234567"), "090");
ok("phone84", isValidPhoneVn("+84901234567"), "+84");
ok("phone-bad", !isValidPhoneVn("abc"), "abc");
ok("zalo-link", isValidZalo("https://zalo.me/0794901233"), "link");
ok("miss-zalo", !parseCtvApplicationBody({}).ok, "empty");

const good = parseCtvApplicationBody({
  zalo: "0901234567",
  addressText: "Addr",
  referralChannel: "facebook",
  channelUrl: "https://fb.com/x",
  hasBusinessExp: false,
});
ok(
  "good-no-exp",
  good.ok === true && good.fields.hasBusinessExp === false,
  JSON.stringify(good)
);

const y0 = parseCtvApplicationBody({
  zalo: "0901234567",
  addressText: "Addr",
  referralChannel: "facebook",
  channelUrl: "https://fb.com/x",
  hasBusinessExp: true,
  businessExpNote: "x",
  businessExpYears: 0,
});
ok("year0", y0.ok === false, y0.ok ? "" : y0.error);

const y2 = parseCtvApplicationBody({
  zalo: "0901234567",
  addressText: "Addr",
  referralChannel: "tiktok",
  channelUrl: "https://tiktok.com/@a",
  hasBusinessExp: true,
  businessExpNote: "cay",
  businessExpYears: 2,
});
ok(
  "year2",
  y2.ok === true && y2.fields.businessExpYears === 2,
  JSON.stringify(y2)
);

console.log(process.exitCode ? "DONE fail" : "DONE pass");
