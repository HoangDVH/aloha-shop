/**
 * Prefetch chunk tab khi hover menu — chuyển tab mượt hơn.
 */
type PrefetchFn = () => Promise<unknown>;

const byKey: Record<string, PrefetchFn> = {
  // Thu mua
  tab1: () => import('../components/PurchaseProposal'),
  tab2: () => import('../components/PriceCompare'),
  tab3: () => import('../components/PurchaseOrder'),
  tab4: () => import('../components/PriceUpdate'),
  tab13: () => import('../components/PriceUpdate'),
  tab5: () => import('../components/Suppliers'),
  tab6: () => import('../components/History'),
  tab7: () => import('../components/Products'),
  tab12: () => import('../components/KiotVietConfig'),
  "kho-hang": () => import('../components/kho-hang/KhoHang'),
  "chuyen-hang": () => import('../components/kho-hang/KhoHang'),
  // Marketing / vận hành
  schedule: () => import('../components/CampaignIdeas'),
  saved: () => import('../components/SavedVocabulary'),
  operations: () => import('../components/OperationsDashboard'),
  staff: () => import('../components/StaffManagement'),
  doctor: () => import('../components/PlantDoctor'),
  projects: () => import('../components/ProjectManagementSuite'),
  "khach-hang": () => import('../components/khach-hang/KvCustomersAdmin'),
  "khach-hang-ctv": () => import('../components/ShopCtvAffiliateAdmin'),
  // Bán hàng / sổ quỹ (iframe + POS)
  cashbook: () => import('../components/CashFlowIframe'),
  sales: () => import('../components/CashFlowIframe'),
  salestest: () => import('../components/SalesTest'),
  online_store: () => import('../components/website-ban-hang/WebsiteBanHangShell'),
  'website-ban-hang': () => import('../components/website-ban-hang/WebsiteBanHangShell'),
  dashboard: () =>
    import('../components/OverviewPlantDoctorBoard').then((m) => ({
      default: m.OverviewPlantDoctorBoard,
    })),
};

const warmed = new Set<string>();

/** Prefetch theo mainTab / subTab (vd. thu-mua + tab3). */
export function prefetchTab(mainTab?: string, subTab?: string) {
  const keys = [subTab, mainTab].filter(Boolean) as string[];
  for (const key of keys) {
    const fn = byKey[key];
    if (!fn || warmed.has(key)) continue;
    warmed.add(key);
    void fn().catch(() => {
      warmed.delete(key);
    });
  }
}

/** Prefetch cả nhóm menu (vd. hover "Thu mua"). */
export function prefetchMenuGroup(groupId: string) {
  if (groupId === 'thu-mua') {
    ['tab1', 'tab2', 'tab3', 'tab7', 'tab5'].forEach((k) => prefetchTab('thu-mua', k));
  } else if (groupId === 'sales') {
    prefetchTab('sales');
    prefetchTab('sales', 'salestest');
    prefetchTab('online_store');
  } else if (groupId === 'cashbook') {
    prefetchTab('cashbook');
  } else if (groupId === 'hang-hoa' || groupId === 'kho-hang') {
    prefetchTab('thu-mua', 'tab7');
    prefetchTab('kho-hang', 'chuyen-hang');
  } else if (groupId === 'van-hanh') {
    prefetchTab('projects');
    prefetchTab('operations');
    prefetchTab('khach-hang');
    prefetchTab('khach-hang-ctv');
    prefetchTab('staff');
    prefetchTab('thu-mua', 'tab12');
  } else {
    prefetchTab(groupId);
  }
}

/**
 * Prefetch ngay khi mở/reload app — chuẩn TMĐT:
 * - Ưu tiên đúng tab đang mở (link ?order=&tab= hoặc tab lần trước)
 * - Rồi idle mới tải sẵn vài tab hay dùng
 */
export function prefetchBootCritical(opts?: {
  activeTab?: string;
  thuMuaSubTab?: string;
}) {
  try {
    const q = new URLSearchParams(window.location.search);
    const order = (q.get('order') || '').trim();
    const tabQ = (q.get('tab') || '').trim();
    const sub =
      tabQ ||
      opts?.thuMuaSubTab ||
      localStorage.getItem('aloha_thumua_subtab') ||
      '';
    const main = opts?.activeTab || localStorage.getItem('aloha_active_tab') || '';

    if (order || sub === 'tab4' || sub === 'tab13') {
      prefetchTab('thu-mua', 'tab4');
      if (sub === 'tab13') prefetchTab('thu-mua', 'tab13');
    } else if (sub) {
      prefetchTab(main === 'thu-mua' || !main ? 'thu-mua' : main, sub);
    } else if (main) {
      prefetchTab(main);
    }

    const idle = () => {
      // Tab hay dùng — So giá + Hàng hóa
      prefetchTab('thu-mua', 'tab2');
      prefetchTab('thu-mua', 'tab7');
      if (!order) prefetchTab('thu-mua', 'tab4');
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(idle, { timeout: 3500 });
    } else {
      setTimeout(idle, 1500);
    }
  } catch {
    /* ignore */
  }
}
