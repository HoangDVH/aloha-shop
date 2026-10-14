// Browser audience tests must still work after the real marketing campaign ends.
function campaignFixture(newBuyer, now = Date.now()) {
  const endAt = new Date(now + 86400000).toISOString();
  return {
    ok: true, serverNow: now, state: 'live', upcoming: null,
    viewer: { loggedIn: true, newBuyer, retail: true, locked: false, canUse: true, lockReason: null, lockMessage: null },
    campaign: {
      id: 'qa-campaign', name: 'QA campaign', slug: 'qa-campaign', startAt: new Date(now - 86400000).toISOString(),
      endAt, phase: 'live', phaseEndsAt: endAt, teaserDays: 0, slots: [], products: [],
      voucherIds: ['qa-new_web', 'qa-returning_web'],
      display: {
        colors: { primary: '#15803d', accent: '#c2185b', cream: '#fff0f5' },
        announcement: { text: '' }, headerPill: { text: '' }, banners: [], tiles: [],
        hero: { title: 'QA campaign', subtitle: '', benefits: [], tags: [] },
        welcome: { enabled: false, title: '', body: '' },
      },
    },
    vouchers: ['new_web', 'returning_web'].map((targetCustomer, i) => ({
      id: `qa-${targetCustomer}`, title: `QA audience ${targetCustomer}`, description: '', type: 'auto',
      benefitType: 'goods', discountType: 'fixed', discountValue: 30000 + i * 10000,
      minOrderThreshold: 0, targetCustomer, claimRequired: false, claimLimitTotal: null,
      claimedCount: 0, claimStartDate: null,
    })),
  };
}
module.exports = { campaignFixture };
