import { proxyCampaignOgImage } from "@/lib/campaign/ogProxy";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return proxyCampaignOgImage(req);
}
