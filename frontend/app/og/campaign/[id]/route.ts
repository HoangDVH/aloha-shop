import { proxyCampaignOgImage } from "@/lib/campaign/ogProxy";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const cid = decodeURIComponent(rawId || "").replace(/\.jpg$/i, "").trim();
  return proxyCampaignOgImage(req, cid);
}
