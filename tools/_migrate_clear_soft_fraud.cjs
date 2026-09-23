const { MongoClient } = require("mongodb");

(async () => {
  const c = new MongoClient("mongodb://127.0.0.1:27018");
  await c.connect();
  const db = c.db("aloha_shop_db");
  const now = new Date().toISOString();
  const rows = await db
    .collection("aloha_shop_commissions")
    .find({ status: "flagged" })
    .toArray();
  let n = 0;
  for (const row of rows) {
    const flags = Array.isArray(row.fraudFlags)
      ? row.fraudFlags.map(String)
      : [];
    const onlySoft =
      flags.length > 0 &&
      flags.every(
        (f) =>
          f === "address_match_threshold" ||
          f === "phone_repeat_soft" ||
          f.startsWith("phone_repeat")
      );
    const hasSelf = flags.some((f) => f.startsWith("self_buy"));
    if (!onlySoft || hasSelf) continue;
    const next =
      row.eligibleAt && row.eligibleAt <= now ? "eligible" : "held";
    await db.collection("aloha_shop_commissions").updateOne(
      { _id: row._id },
      {
        $set: {
          status: next,
          fraudFlags: [],
          fraudClearedAt: now,
          fraudClearedBy: "system_migrate",
          fraudClearNote: "bulk_clear_soft_phone_repeat",
          updatedAt: now,
        },
      }
    );
    n += 1;
  }
  await db.collection("aloha_shop_settings").updateOne(
    { _id: "ctv" },
    {
      $set: {
        addressMatchMaxHits: 10,
        phoneWhitelist: ["123456789", "0123456789", "0987654321"],
        phoneRepeatSoftWarn: true,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const one = await db
    .collection("aloha_shop_commissions")
    .findOne({ orderCode: "WEB-260917-5YQP" });
  console.log(
    JSON.stringify(
      {
        cleared: n,
        HD022055: one
          ? { status: one.status, fraudFlags: one.fraudFlags }
          : null,
      },
      null,
      2
    )
  );
  await c.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
