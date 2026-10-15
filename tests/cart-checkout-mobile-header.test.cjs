const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SiteChrome implements minimalist mobile header for Cart and Checkout', () => {
  const siteChromePath = path.join(__dirname, '..', 'frontend', 'components', 'SiteChrome.tsx');
  const siteChromeSrc = fs.readFileSync(siteChromePath, 'utf8');

  // Verify route detection
  assert.ok(
    siteChromeSrc.includes('const isCart = pathname.startsWith("/gio-hang");'),
    'Should identify Cart path'
  );
  assert.ok(
    siteChromeSrc.includes('const isCheckout = pathname.startsWith("/xac-nhan-don-hang");'),
    'Should identify Checkout path'
  );
  assert.ok(
    siteChromeSrc.includes('const isMinimalMobileHeader = isCart || isCheckout;'),
    'Should flag minimal mobile header mode'
  );

  // Verify navigation buttons (ArrowLeft and Home)
  assert.ok(
    siteChromeSrc.includes('handleMobileBack'),
    'Should have back handler for mobile'
  );
  assert.ok(
    siteChromeSrc.includes('<ArrowLeft'),
    'Should render back button with ArrowLeft icon'
  );
  assert.ok(
    siteChromeSrc.includes('<Home'),
    'Should render Home button on mobile header'
  );

  // Verify desktop header elements hidden on mobile in minimal mode
  assert.ok(
    siteChromeSrc.includes('isMinimalMobileHeader ? "hidden md:block" : ""'),
    'Should hide announcement/preview/logo/search on mobile when isMinimalMobileHeader is true'
  );
});

test('Cart and Checkout pages hide duplicate desktop titles on mobile', () => {
  const cartPath = path.join(__dirname, '..', 'frontend', 'app', '(storefront)', 'gio-hang', 'page.tsx');
  const cartSrc = fs.readFileSync(cartPath, 'utf8');
  assert.ok(
    cartSrc.includes('hidden md:flex flex-wrap items-center justify-between gap-3'),
    'Cart desktop header row should be hidden on mobile'
  );
  assert.ok(
    cartSrc.includes('<div className="md:hidden">\n        <SiCartNotice />\n      </div>') ||
    cartSrc.includes('<div className="md:hidden"><SiCartNotice /></div>') ||
    cartSrc.includes('<SiCartNotice />'),
    'SiCartNotice must still be rendered for mobile'
  );

  const checkoutPath = path.join(__dirname, '..', 'frontend', 'app', '(storefront)', 'xac-nhan-don-hang', 'page.tsx');
  const checkoutSrc = fs.readFileSync(checkoutPath, 'utf8');
  assert.ok(
    checkoutSrc.includes('hidden md:flex flex-wrap items-end justify-between gap-2'),
    'Checkout desktop header row should be hidden on mobile'
  );
  assert.ok(
    checkoutSrc.includes('px-0 sm:px-4 py-0 sm:py-6 space-y-2 sm:space-y-5'),
    'Checkout page uses edge-to-edge seamless mobile layout'
  );
});

test('Mobile checkout sections are unified in TikTok Shop style', () => {
  const addressPath = path.join(__dirname, '..', 'frontend', 'components', 'checkout', 'CheckoutAddressSection.tsx');
  const addressSrc = fs.readFileSync(addressPath, 'utf8');
  assert.ok(
    !addressSrc.includes('repeating-linear-gradient'),
    'Address section removed dashed envelope line as requested'
  );
  assert.ok(
    addressSrc.includes('w-full bg-white px-4 py-2.5 sm:rounded-2xl'),
    'Address section has tight full-bleed mobile container'
  );

  const linesPath = path.join(__dirname, '..', 'frontend', 'components', 'checkout', 'CheckoutLineItems.tsx');
  const linesSrc = fs.readFileSync(linesPath, 'utf8');
  assert.ok(
    linesSrc.includes('w-full bg-white sm:rounded-[var(--aloha-radius-lg)]'),
    'Line items section has tight full-bleed mobile container'
  );
  assert.ok(
    linesSrc.includes('bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600'),
    'Variants use TikTok Shop tag styling'
  );

  const summaryPath = path.join(__dirname, '..', 'frontend', 'components', 'checkout', 'OrderPaymentSummary.tsx');
  const summarySrc = fs.readFileSync(summaryPath, 'utf8');
  assert.ok(
    summarySrc.includes('Tóm tắt đơn hàng'),
    'Summary section title matches TikTok Shop'
  );
  assert.ok(
    summarySrc.includes('w-full bg-white px-4 py-3 sm:p-5 sm:rounded-[var(--aloha-radius-lg)]'),
    'Summary section has tight full-bleed mobile container'
  );
});

test('Mobile Cart sections are unified in TikTok Shop style', () => {
  const cartPath = path.join(__dirname, '..', 'frontend', 'app', '(storefront)', 'gio-hang', 'page.tsx');
  const cartSrc = fs.readFileSync(cartPath, 'utf8');
  assert.ok(
    cartSrc.includes('px-0 sm:px-4 py-0 sm:py-6 space-y-2 sm:space-y-4'),
    'Cart page uses edge-to-edge seamless mobile layout'
  );
  assert.ok(
    cartSrc.includes('w-full bg-white rounded-none sm:rounded-xl shadow-none sm:shadow-sm ring-0 sm:ring-1'),
    'Cart items section has full-bleed mobile container'
  );
  assert.ok(
    cartSrc.includes('rounded-none sm:rounded-2xl border-x-0 sm:border-x'),
    'SmartFreeshipBar has full-bleed mobile container'
  );
  assert.ok(
    cartSrc.includes('bg-stone-100 px-1.5 py-0.5 text-[11px] font-medium text-stone-600'),
    'Cart items use TikTok Shop variant tag styling'
  );
});

test('SmartFreeshipBar aligns milestone labels smartly to prevent text clipping', () => {
  const freeshipBarPath = path.join(__dirname, '..', 'frontend', 'components', 'cart', 'SmartFreeshipBar.tsx');
  const freeshipBarSrc = fs.readFileSync(freeshipBarPath, 'utf8');

  assert.ok(
    freeshipBarSrc.includes('right-0 translate-x-1 text-right'),
    'Last milestone label must align right to stay within bounds'
  );
  assert.ok(
    freeshipBarSrc.includes('left-0 -translate-x-1 text-left'),
    'First milestone label must align left to stay within bounds'
  );
  assert.ok(
    freeshipBarSrc.includes('left-0 -translate-x-1/2 text-center'),
    'Intermediate milestone labels should be centered'
  );
  assert.ok(
    freeshipBarSrc.includes('pb-4 sm:pb-4.5'),
    'Track wrapper must have sufficient bottom padding for descending characters'
  );
});
