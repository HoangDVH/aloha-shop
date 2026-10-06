import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import { PROFILES, type PlantProfile } from "./profiles/index.js";

/** Nhân viên duyệt hồ sơ loài trong admin; sửa nội dung hồ sơ trong code thì lượt duyệt cũ hết hiệu lực. */
export const PROFILE_REVIEWS_COL = "plant_doctor_profile_reviews";
const CACHE_MS = 15_000;

type ReviewDoc = { _id: string; hash: string; reviewedAt: Date; reviewedBy: string };
export type ProfileReview = { reviewedAt: Date; reviewedBy: string };

export function profileHash(p: PlantProfile): string {
  const { reviewed: _reviewed, ...content } = p;
  return createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 16);
}

const HASHES = new Map(PROFILES.map((p) => [p.id, profileHash(p)]));

let cache: { at: number; value: Map<string, ProfileReview> } | null = null;

export function resetProfileReviewsCache() {
  cache = null;
}

/** Lượt duyệt còn hiệu lực (hash khớp nội dung hiện tại), theo id hồ sơ. */
export async function loadProfileReviews(db: Db): Promise<Map<string, ProfileReview>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const docs = await db.collection<ReviewDoc>(PROFILE_REVIEWS_COL).find({}).toArray();
  const value = new Map<string, ProfileReview>();
  for (const d of docs) {
    if (HASHES.get(d._id) === d.hash) value.set(d._id, { reviewedAt: d.reviewedAt, reviewedBy: d.reviewedBy });
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function setProfileReviewed(db: Db, id: string, reviewed: boolean, by: string): Promise<boolean> {
  const hash = HASHES.get(id);
  if (!hash) return false;
  const col = db.collection<ReviewDoc>(PROFILE_REVIEWS_COL);
  if (reviewed) {
    await col.updateOne({ _id: id }, { $set: { hash, reviewedAt: new Date(), reviewedBy: by.slice(0, 120) } }, { upsert: true });
  } else {
    await col.deleteOne({ _id: id });
  }
  resetProfileReviewsCache();
  return true;
}

export function isProfileReviewed(p: PlantProfile, reviews: Map<string, ProfileReview>): boolean {
  return p.reviewed || reviews.has(p.id);
}
