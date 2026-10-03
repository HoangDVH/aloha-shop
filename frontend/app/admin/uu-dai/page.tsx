"use client";

import { Suspense, useEffect, useState, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Table, Button, Input, Badge, Spin, App } from "antd";
import {
  Plus,
  Ticket,
  RefreshCw,
  Search,
  Sparkles,
  BarChart3,
  Store,
  Download,
  CalendarHeart,
  ChevronRight,
} from "lucide-react";
import { CampaignTab } from "@/components/admin/promotions/campaigns/CampaignTab";
import {
  PromotionFormModal,
  type PromotionItem,
} from "@/components/admin/promotions/PromotionFormModal";
import { PromotionCodeModal } from "@/components/admin/promotions/PromotionCodeModal";
import { VoucherDetailRow } from "@/components/admin/promotions/page/VoucherDetailRow";
import { KiotVietTab } from "@/components/admin/promotions/page/KiotVietTab";
import {
  allCodesColumns,
  promotionColumns,
  redemptionColumns,
} from "@/components/admin/promotions/page/columns";
import { exportPromotionsToCsv } from "@/components/admin/promotions/page/exportPromotionsCsv";
import type {
  AllCodeItem,
  RedemptionLog,
  ReportOverview,
} from "@/components/admin/promotions/page/types";

function SearchToolbar(props: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onRefresh: () => void;
  onPressEnter?: () => void;
  loading: boolean;
  spinIcon?: boolean;
  summary: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
      <div className="flex items-center gap-2 flex-1 w-full sm:max-w-md">
        <Input
          placeholder={props.placeholder}
          prefix={<Search size={14} className="text-slate-400" />}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onPressEnter={props.onPressEnter}
          allowClear
          className="!h-9 !rounded-lg text-xs"
        />
        <Button
          icon={<RefreshCw size={13} className={props.spinIcon && props.loading ? "animate-spin" : ""} />}
          onClick={props.onRefresh}
          loading={props.loading}
          className="!h-9 !rounded-lg text-xs shrink-0"
        >
          Làm mới
        </Button>
      </div>
      <div className="text-xs text-slate-500 font-medium shrink-0">{props.summary}</div>
    </div>
  );
}

function includesQuery(q: string, ...fields: (string | undefined)[]) {
  return fields.some((f) => (f || "").toLowerCase().includes(q));
}

function AdminPromotionsContent() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");

  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState<string>(tabParam || "campaigns");
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PromotionItem | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalItem, setCodeModalItem] = useState<PromotionItem | null>(null);

  const [allCodes, setAllCodes] = useState<AllCodeItem[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeSearchQuery, setCodeSearchQuery] = useState("");

  const [kvStatus, setKvStatus] = useState<any>(null);

  const [, setReport] = useState<ReportOverview | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<RedemptionLog[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [redemptionSearchQuery, setRedemptionSearchQuery] = useState("");

  // Sync tab with URL search parameter
  useEffect(() => {
    if (tabParam && ["campaigns", "programs", "codes", "reports", "kiotviet"].includes(tabParam)) {
      setActiveTabKey(tabParam);
    }
  }, [tabParam]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/shop/admin/promotions?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Lỗi tải danh sách (${res.status})`);
      }
      const data = await res.json();
      if (data.ok) setPromotions(data.items || []);
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải danh sách chương trình ưu đãi");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCodes = async () => {
    try {
      setLoadingCodes(true);
      const res = await fetch("/api/shop/admin/promotion-codes");
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Lỗi tải mã (${res.status})`);
      }
      const data = await res.json();
      if (data.ok) setAllCodes(data.codes || []);
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải danh sách mã khuyến mại");
    } finally {
      setLoadingCodes(false);
    }
  };

  const fetchKvStatus = async () => {
    try {
      const res = await fetch("/api/shop/admin/promotions/kiotviet/status");
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Lỗi tải KiotViet (${res.status})`);
      }
      const data = await res.json();
      if (data.ok) setKvStatus(data);
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải trạng thái Voucher KiotViet");
    }
  };

  const fetchReport = async () => {
    try {
      setLoadingReport(true);
      const res = await fetch("/api/shop/admin/promotions/reports/overview");
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error(`Lỗi tải báo cáo (${res.status})`);
      }
      const data = await res.json();
      if (data.ok) {
        setReport(data.stats || null);
        setRecentRedemptions(data.recentRedemptions || []);
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải báo cáo ưu đãi");
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    fetchPromotions();
    fetchReport();
  }, []);

  useEffect(() => {
    if (activeTabKey === "codes" && allCodes.length === 0) fetchAllCodes();
    if (activeTabKey === "kiotviet" && !kvStatus) fetchKvStatus();
    if (activeTabKey === "reports" && recentRedemptions.length === 0) fetchReport();
  }, [activeTabKey, allCodes.length, kvStatus, recentRedemptions.length]);

  const handleDuplicate = async (item: PromotionItem) => {
    try {
      const res = await fetch(`/api/shop/admin/promotions/${item.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        message.success(`Đã nhân bản thành bản nháp: "${data.item.name}"`);
        fetchPromotions();
      } else {
        message.error(data.error || "Không nhân bản được");
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi nhân bản");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    message.success(`Đã sao chép mã: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const displayedPromotions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return promotions;
    return promotions.filter((p) => includesQuery(q, p.name, p.title, p.id));
  }, [promotions, searchQuery]);

  const displayedCodes = useMemo(() => {
    const q = codeSearchQuery.toLowerCase().trim();
    if (!q) return allCodes;
    return allCodes.filter((c) => includesQuery(q, c.code, c.promotionName, c.assignedBuyerPhone));
  }, [allCodes, codeSearchQuery]);

  const displayedRedemptions = useMemo(() => {
    const q = redemptionSearchQuery.toLowerCase().trim();
    if (!q) return recentRedemptions;
    return recentRedemptions.filter((r) => includesQuery(q, r.orderCode, r.promotionId, r.buyerPhone));
  }, [recentRedemptions, redemptionSearchQuery]);

  const handleExport = () => {
    if (!exportPromotionsToCsv(displayedPromotions)) {
      message.warning("Không có dữ liệu để xuất file");
      return;
    }
    message.success("Đã xuất danh sách đợt phát hành & voucher thành công");
  };

  const openCodeModal = (rec: PromotionItem) => {
    setCodeModalItem(rec);
    setCodeModalOpen(true);
  };

  const programsTab = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Đợt phát hành voucher</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#2D5A27] border border-emerald-200/80">
              KiotViet Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý các đợt phát hành voucher giảm giá, chiết khấu và liên kết đồng bộ KiotViet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<Download size={14} />}
            onClick={handleExport}
            className="!h-9 !rounded-lg text-xs text-slate-700 border-slate-300 hover:!text-[#2D5A27] hover:!border-[#2D5A27]"
          >
            Xuất file
          </Button>
          <Button
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            onClick={fetchPromotions}
            loading={loading}
            className="!h-9 !rounded-lg text-xs"
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            className="!h-9 !rounded-lg !bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-xs shadow-xs text-white"
            icon={<Plus size={15} />}
            onClick={() => {
              setEditingItem(null);
              setFormOpen(true);
            }}
          >
            + Đợt phát hành voucher
          </Button>
        </div>
      </div>

      <SearchToolbar
        placeholder="Theo mã, tên đợt phát hành"
        value={searchQuery}
        onChange={setSearchQuery}
        onPressEnter={fetchPromotions}
        onRefresh={fetchPromotions}
        loading={loading}
        spinIcon
        summary={
          <>
            Hiển thị <strong>{displayedPromotions.length}</strong> đợt phát hành
          </>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200/80">
        <Table
          columns={promotionColumns(expandedRowKeys)}
          dataSource={displayedPromotions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          expandable={{
            expandedRowKeys,
            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
            expandedRowRender: (record) => (
              <VoucherDetailRow
                record={record}
                onEdit={(rec) => {
                  setEditingItem(rec);
                  setFormOpen(true);
                }}
                onDuplicate={handleDuplicate}
                onManageCodes={openCodeModal}
                allRedemptions={recentRedemptions}
              />
            ),
            showExpandColumn: false,
          }}
          onRow={(record) => ({
            onClick: (e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest("button") ||
                target.closest("a") ||
                target.closest(".ant-popconfirm") ||
                target.closest("input")
              ) {
                return;
              }
              setExpandedRowKeys((prev) => (prev.includes(record.id) ? [] : [record.id]));
            },
            className: `cursor-pointer transition-colors ${
              expandedRowKeys.includes(record.id) ? "!bg-[#F4F8F3]" : "hover:bg-slate-50/80"
            }`,
          })}
        />
      </div>
    </div>
  );

  const codesTab = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Danh sách mã Voucher</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#2D5A27] border border-emerald-200/80">
              {displayedCodes.length} mã
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tra cứu và kiểm soát từng mã voucher cụ thể, mã cấp cho khách hàng và mã dùng chung.
          </p>
        </div>
        <Button
          icon={<RefreshCw size={14} className={loadingCodes ? "animate-spin" : ""} />}
          onClick={fetchAllCodes}
          loading={loadingCodes}
          className="!h-9 !rounded-lg text-xs"
        >
          Làm mới
        </Button>
      </div>

      <SearchToolbar
        placeholder="Tìm mã voucher, SĐT khách..."
        value={codeSearchQuery}
        onChange={setCodeSearchQuery}
        onRefresh={fetchAllCodes}
        loading={loadingCodes}
        summary={
          <>
            Hiển thị <strong>{displayedCodes.length}</strong> mã voucher
          </>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200/80">
        <Table
          columns={allCodesColumns(copiedCode, copyToClipboard)}
          dataSource={displayedCodes}
          rowKey="code"
          loading={loadingCodes}
          pagination={{ pageSize: 15 }}
        />
      </div>
    </div>
  );

  const reportsTab = (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Lịch sử sử dụng & Đối soát</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              {displayedRedemptions.length} giao dịch
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhật ký sử dụng mã giảm giá trên các đơn hàng thực tế, phục vụ đối soát doanh thu.
          </p>
        </div>
        <Button
          icon={<RefreshCw size={14} className={loadingReport ? "animate-spin" : ""} />}
          onClick={fetchReport}
          loading={loadingReport}
          className="!h-9 !rounded-lg text-xs"
        >
          Làm mới
        </Button>
      </div>

      <SearchToolbar
        placeholder="Tìm theo mã đơn hàng, SĐT khách..."
        value={redemptionSearchQuery}
        onChange={setRedemptionSearchQuery}
        onRefresh={fetchReport}
        loading={loadingReport}
        summary={
          <>
            Hiển thị <strong>{displayedRedemptions.length}</strong> giao dịch
          </>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200/80">
        <Table
          columns={redemptionColumns}
          dataSource={displayedRedemptions}
          rowKey="_id"
          loading={loadingReport}
          pagination={{ pageSize: 15 }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Main Content (Navigated cleanly from Admin Sidebar) */}
      {activeTabKey === "campaigns" ? (
        <CampaignTab />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-xs">
          {activeTabKey === "programs" && programsTab}
          {activeTabKey === "codes" && codesTab}
          {activeTabKey === "reports" && reportsTab}
          {activeTabKey === "kiotviet" && <KiotVietTab />}
        </div>
      )}

      {/* Voucher Form Modal */}
      <PromotionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          setFormOpen(false);
          fetchPromotions();
          fetchReport();
        }}
        onSuccessAndCreateCode={(createdPromo) => {
          setFormOpen(false);
          fetchPromotions();
          fetchReport();
          openCodeModal(createdPromo);
        }}
        editingItem={editingItem}
      />

      {/* Promotion Code Modal */}
      <PromotionCodeModal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        promotion={codeModalItem}
      />
    </div>
  );
}

export default function AdminPromotionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <AdminPromotionsContent />
    </Suspense>
  );
}
