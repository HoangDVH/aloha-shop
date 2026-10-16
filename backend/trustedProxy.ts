import type { Express } from "express";

/** Only network peers under our control may supply forwarding headers. */
export function configureTrustedProxy(app: Express, cidrs = process.env.TRUST_PROXY_CIDRS) {
  const proxies = cidrs === undefined ? ["loopback"] : cidrs.split(",").map(s => s.trim()).filter(Boolean);
  // Express validates the addresses/CIDRs at startup; never accept boolean/hop-count trust.
  app.set("trust proxy", proxies);
}
