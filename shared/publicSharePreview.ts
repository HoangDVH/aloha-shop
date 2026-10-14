/** Anonymous, conditional retail offer for one unit; never a personal checkout quote. */
export type PublicSharePreview = {
  ma: string;
  price: number;
  reference: number;
  finalPrice: number;
  expiresAt: string;
  campaignName?: string;
  voucher?: { title: string; targetCustomer: string; claimRequired: boolean };
};
