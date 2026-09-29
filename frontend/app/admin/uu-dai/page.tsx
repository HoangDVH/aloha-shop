"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Card,
  Tabs,
  Modal,
  message,
  Popconfirm,
  Badge,
  Tooltip,
} from "antd";
import {
  Plus,
  Ticket,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  Archive,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Store,
  Check,
  Layers,
  Truck,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import dayjs from "dayjs";
import { formatVnd } from "@/lib/api";
import {
  PromotionFormModal,
  shippingRegionLabel,
  type PromotionItem,
} from "@/components/admin/promotions/PromotionFormModal";
import { PromotionCodeModal } from "@/components/admin/promotions/PromotionCodeModal";

interface RedemptionLog {
  _id: string;
  orderCode: string;
  promotionId: string;
  discountAmount: number;
  status: "held" | "used" | "released";
  buyerPhone?: string;
  createdAt: string;
}

interface ReportOverview {
  activePromotionsCount: number;
  totalDiscountGiven: number;
  totalOrdersUsingDiscount: number;
}

interface AllCodeItem {
  code: string;
  promotionId: string;
  promotionName: string;
  promotionTitle?: string;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  maxDiscountVnd?: number;
  maxUses?: number;
  usedCount: number;
  heldCount: number;
  assignedBuyerPhone?: string;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

// Chi tiết đợt phát hành KiotViet bung ngay dưới dòng
interface VoucherDetailRowProps {
  record: PromotionItem;
  onEdit: (record: PromotionItem) => void;
  onDuplicate: (record: PromotionItem) => void;
  onManageCodes: (record: PromotionItem) => void;
  allRedemptions: RedemptionLog[];
}

function KiotVietVoucherDetailRow({
  record,
  onEdit,
  onDuplicate,
  onManageCodes,
  allRedemptions,
}: VoucherDetailRowProps) {
  const [activeSubTab, setActiveSubTab] = useState<"info" | "codes" | "orders">("info");
  const [collapseCondition, setCollapseCondition] = useState(false);
  const [codes, setCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubTab === "codes" && record.id) {
      fetchCodes();
    }
  }, [activeSubTab, record.id]);

  const fetchCodes = async () => {
    try {
      setLoadingCodes(true);
      const res = await fetch(`/api/shop/admin/promotions/${record.id}/codes`);
      const data = await res.json();
      if (data.ok) {
        setCodes(data.codes || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingCodes(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    message.success(`Đã sao chép mã: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const matchingRedemptions = useMemo(() => {
    return allRedemptions.filter((r) => r.promotionId === record.id);
  }, [allRedemptions, record.id]);

  return (
    <div className="bg-white p-5 rounded-lg border border-slate-200/90 shadow-xs space-y-4 text-xs my-1">
      {/* Sub tabs chuẩn KiotViet */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-sm">
        <button
          type="button"
          onClick={() => setActiveSubTab("info")}
          className={`pb-2.5 font-medium cursor-pointer transition-colors ${
            activeSubTab === "info"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-600 hover:text-blue-600"
          }`}
        >
          Thông tin
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("codes")}
          className={`pb-2.5 font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeSubTab === "codes"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-600 hover:text-blue-600"
          }`}
        >
          <span>Danh sách voucher</span>
          {codes.length > 0 && (
            <span className="text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-full font-semibold">
              {codes.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("orders")}
          className={`pb-2.5 font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
            activeSubTab === "orders"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-600 hover:text-blue-600"
          }`}
        >
          <span>Đơn hàng dùng voucher</span>
          {matchingRedemptions.length > 0 && (
            <span className="text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded-full font-semibold">
              {matchingRedemptions.length}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === "info" && (
        <div className="space-y-4">
          {/* Header row: Tên, Mã, Trạng thái */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-base font-bold text-slate-900">{record.name}</span>
            <span className="text-sm font-semibold text-slate-600 font-mono">{record.id}</span>
            {record.status === "active" ? (
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#e6f4ff] text-[#1677ff] border border-[#91caff] font-medium">
                Đang kích hoạt
              </span>
            ) : record.status === "paused" ? (
              <span className="text-xs px-2.5 py-0.5 rounded bg-[#fffbe6] text-[#faad14] border border-[#ffe58f] font-medium">
                Tạm dừng
              </span>
            ) : (
              <span className="text-xs px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                Bản nháp
              </span>
            )}
          </div>

          {/* Top summary box như trong ảnh 1 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <span className="text-slate-500">Số lượng voucher: </span>
              <strong className="text-slate-900">
                {record.usageLimitTotal != null ? record.usageLimitTotal.toLocaleString("vi-VN") : "∞"}
              </strong>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-500">Đã phát hành: </span>
              <strong className="text-slate-900">
                {((record.usedCount || 0) + (record.heldCount || 0)).toLocaleString("vi-VN")}
              </strong>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-500">Đã sử dụng: </span>
              <strong className="text-slate-900">
                {(record.usedCount || 0).toLocaleString("vi-VN")}
              </strong>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-500">Giá trị sử dụng: </span>
              <strong className="text-slate-900 font-mono">
                {record.budgetUsed != null
                  ? record.budgetUsed.toLocaleString("vi-VN")
                  : ((record.usedCount || 0) * (record.discountValue || 0)).toLocaleString("vi-VN")}
              </strong>
            </div>
          </div>

          {/* 4 Cột chi tiết như trong ảnh 1 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-1">
            <div>
              <div className="text-slate-500">Hiệu lực</div>
              <div className="mt-1 font-medium text-slate-800">
                {record.startDate ? dayjs(record.startDate).format("DD/MM/YYYY") : "—"}
                {" - "}
                {record.endDate ? dayjs(record.endDate).format("DD/MM/YYYY") : "Vô thời hạn"}
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mệnh giá</div>
              <div className="mt-1 font-semibold text-slate-800">
                {record.discountType === "percentage"
                  ? `${record.discountValue}%`
                  : (record.discountValue || 0).toLocaleString("vi-VN")}
              </div>
            </div>

            <div>
              <div className="text-slate-500">Chi nhánh</div>
              <div className="mt-1 font-medium text-slate-800">
                {record.benefitType === "shipping" && record.regionId
                  ? shippingRegionLabel(record.regionId)
                  : "Toàn hệ thống"}
              </div>
            </div>

            <div>
              <div className="text-slate-500">Nhóm khách hàng</div>
              <div className="mt-1 font-medium text-slate-800">
                {record.targetCustomer === "new_web"
                  ? "Khách mới web"
                  : record.targetCustomer === "wholesale"
                    ? "Khách sỉ"
                    : record.targetCustomer === "retail"
                      ? "Khách lẻ"
                      : "Tất cả nhóm khách hàng"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-slate-500">Người tạo giao dịch</div>
              <div className="mt-1 font-medium text-slate-800">Tất cả người tạo giao dịch</div>
            </div>
          </div>

          {/* Hộp Điều kiện mua hàng (Collapsible) như ảnh 1 & 2 */}
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
            <div
              className="flex items-center justify-between font-bold text-slate-800 cursor-pointer select-none"
              onClick={() => setCollapseCondition(!collapseCondition)}
            >
              <span>Điều kiện mua hàng</span>
              <span className="text-slate-400">
                {collapseCondition ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </span>
            </div>
            {!collapseCondition && (
              <div className="text-slate-600 space-y-1.5 pt-1">
                <div>
                  {record.minOrderThreshold ? (
                    <span>
                      Tổng tiền hàng tối thiểu từ{" "}
                      <strong>{(record.minOrderThreshold || 0).toLocaleString("vi-VN")}</strong>
                    </span>
                  ) : (
                    <span>Không yêu cầu giá trị đơn hàng tối thiểu</span>
                  )}
                </div>
                {record.maxDiscountVnd ? (
                  <div>
                    Mức giảm tối đa: <strong>{formatVnd(record.maxDiscountVnd)}</strong>
                  </div>
                ) : null}
                <div>
                  Phạm vi áp dụng:{" "}
                  <strong>
                    {record.scope === "product"
                      ? `${record.productMas?.length || 0} sản phẩm chỉ định`
                      : "Toàn bộ hàng hóa"}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Ghi chú như ảnh 1 */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Edit size={13} className="text-slate-400" />
            <span>{record.description || record.title || "Chưa có ghi chú"}</span>
          </div>

          {/* Bottom actions như ảnh 2: Sao chép bên trái, Chỉnh sửa bên phải */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => onDuplicate(record)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-colors"
            >
              <Copy size={13} className="text-slate-500" />
              <span>Sao chép</span>
            </button>

            <button
              type="button"
              onClick={() => onEdit(record)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0070f4] text-white text-xs font-semibold hover:bg-[#005bb5] cursor-pointer shadow-xs transition-colors"
            >
              <Edit size={13} />
              <span>Chỉnh sửa</span>
            </button>
          </div>
        </div>
      )}

      {activeSubTab === "codes" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600 font-medium">
              Danh sách mã voucher phát hành cho đợt này ({codes.length} mã)
            </div>
            <Button
              type="primary"
              size="small"
              className="bg-blue-600 hover:!bg-blue-700 text-xs font-semibold"
              icon={<Plus size={13} />}
              onClick={() => onManageCodes(record)}
            >
              + Tạo mã voucher
            </Button>
          </div>

          {loadingCodes ? (
            <div className="py-6 text-center text-slate-400">Đang tải mã voucher...</div>
          ) : codes.length === 0 ? (
            <div className="py-6 text-center text-slate-400 bg-white rounded border border-dashed border-slate-200">
              Chưa có mã voucher nào được tạo cho đợt này.
            </div>
          ) : (
            <Table
              size="small"
              dataSource={codes}
              rowKey="code"
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: "Mã voucher",
                  dataIndex: "code",
                  key: "code",
                  render: (v: string) => (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {v}
                      </span>
                      <Button
                        size="small"
                        type="text"
                        icon={
                          copiedCode === v ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )
                        }
                        onClick={() => copyCode(v)}
                      />
                    </div>
                  ),
                },
                {
                  title: "Khách gán",
                  dataIndex: "assignedBuyerPhone",
                  key: "assignedBuyerPhone",
                  render: (v?: string) => v || <span className="text-slate-400">Dùng chung</span>,
                },
                {
                  title: "Lượt dùng",
                  key: "usage",
                  render: (_: any, r: any) => (
                    <span>
                      {r.usedCount || 0} / {r.maxUses || "∞"}
                    </span>
                  ),
                },
                {
                  title: "Hạn dùng",
                  dataIndex: "expiresAt",
                  key: "expiresAt",
                  render: (v?: string) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "Vô thời hạn"),
                },
                {
                  title: "Trạng thái",
                  dataIndex: "active",
                  key: "active",
                  render: (active: boolean) =>
                    active ? (
                      <span className="text-emerald-600 font-semibold text-[11px]">Sẵn sàng</span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Đã khóa</span>
                    ),
                },
              ]}
            />
          )}
        </div>
      )}

      {activeSubTab === "orders" && (
        <div className="space-y-3">
          <div className="text-xs text-slate-600 font-medium">
            Đơn hàng đã áp dụng voucher của đợt này ({matchingRedemptions.length} đơn)
          </div>
          {matchingRedemptions.length === 0 ? (
            <div className="py-6 text-center text-slate-400 bg-white rounded border border-dashed border-slate-200">
              Chưa có đơn hàng nào sử dụng voucher của đợt này.
            </div>
          ) : (
            <Table
              size="small"
              dataSource={matchingRedemptions}
              rowKey="_id"
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: "Mã đơn hàng",
                  dataIndex: "orderCode",
                  key: "orderCode",
                  render: (v: string) => <strong className="font-mono text-blue-600">{v}</strong>,
                },
                {
                  title: "Tiền giảm",
                  dataIndex: "discountAmount",
                  key: "discountAmount",
                  render: (v: number) => (
                    <strong className="text-emerald-700">-{formatVnd(v || 0)}</strong>
                  ),
                },
                {
                  title: "Khách hàng",
                  dataIndex: "buyerPhone",
                  key: "buyerPhone",
                  render: (v: string) => v || "Khách lẻ",
                },
                {
                  title: "Thời gian",
                  dataIndex: "createdAt",
                  key: "createdAt",
                  render: (d: string) => dayjs(d).format("DD/MM/YYYY HH:mm"),
                },
                {
                  title: "Trạng thái",
                  dataIndex: "status",
                  key: "status",
                  render: (st: string) =>
                    st === "used" ? "Đã thanh toán" : st === "held" ? "Đang giữ" : "Giải phóng",
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState<string>("programs");

  // Dòng đang được bung chi tiết (như ảnh KiotViet)
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  // Search input state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PromotionItem | null>(null);

  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalItem, setCodeModalItem] = useState<PromotionItem | null>(null);

  // Tab 2: All Codes
  const [allCodes, setAllCodes] = useState<AllCodeItem[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [codeSearchQuery, setCodeSearchQuery] = useState("");

  // Tab 3: KiotViet status
  const [kvStatus, setKvStatus] = useState<any>(null);
  const [loadingKv, setLoadingKv] = useState(false);

  // Tab 4: Reports
  const [report, setReport] = useState<ReportOverview | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<RedemptionLog[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [redemptionSearchQuery, setRedemptionSearchQuery] = useState("");

  // Load promotions
  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/shop/admin/promotions?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setPromotions(data.items || []);
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải danh sách chương trình ưu đãi");
    } finally {
      setLoading(false);
    }
  };

  // Load all codes
  const fetchAllCodes = async () => {
    try {
      setLoadingCodes(true);
      const res = await fetch("/api/shop/admin/promotion-codes");
      const data = await res.json();
      if (data.ok) {
        setAllCodes(data.codes || []);
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải danh sách mã khuyến mại");
    } finally {
      setLoadingCodes(false);
    }
  };

  // Load KiotViet status
  const fetchKvStatus = async () => {
    try {
      setLoadingKv(true);
      const res = await fetch("/api/shop/admin/promotions/kiotviet/status");
      const data = await res.json();
      if (data.ok) {
        setKvStatus(data);
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi tải trạng thái Voucher KiotViet");
    } finally {
      setLoadingKv(false);
    }
  };

  // Load Report
  const fetchReport = async () => {
    try {
      setLoadingReport(true);
      const res = await fetch("/api/shop/admin/promotions/reports/overview");
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

  const handleTabChange = (key: string) => {
    setActiveTabKey(key);
    if (key === "codes" && allCodes.length === 0) fetchAllCodes();
    if (key === "kiotviet" && !kvStatus) fetchKvStatus();
    if (key === "reports" && recentRedemptions.length === 0) fetchReport();
  };

  const handleDuplicate = async (item: PromotionItem) => {
    try {
      const res = await fetch(`/api/shop/admin/promotions/${item.id}/duplicate`, {
        method: "POST",
      });
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

  // Search filter
  const displayedPromotions = useMemo(() => {
    if (!searchQuery) return promotions;
    const q = searchQuery.toLowerCase().trim();
    return promotions.filter((p) => {
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.title || "").toLowerCase().includes(q) ||
        (p.id || "").toLowerCase().includes(q)
      );
    });
  }, [promotions, searchQuery]);

  const displayedCodes = useMemo(() => {
    if (!codeSearchQuery) return allCodes;
    const q = codeSearchQuery.toLowerCase().trim();
    return allCodes.filter((c) => {
      return (
        c.code.toLowerCase().includes(q) ||
        (c.promotionName || "").toLowerCase().includes(q) ||
        (c.assignedBuyerPhone || "").toLowerCase().includes(q)
      );
    });
  }, [allCodes, codeSearchQuery]);

  const displayedRedemptions = useMemo(() => {
    if (!redemptionSearchQuery) return recentRedemptions;
    const q = redemptionSearchQuery.toLowerCase().trim();
    return recentRedemptions.filter((r) => {
      return (
        (r.orderCode || "").toLowerCase().includes(q) ||
        (r.promotionId || "").toLowerCase().includes(q) ||
        (r.buyerPhone || "").toLowerCase().includes(q)
      );
    });
  }, [recentRedemptions, redemptionSearchQuery]);

  // Export to CSV function (KiotViet style)
  const exportPromotionsToCsv = () => {
    if (displayedPromotions.length === 0) {
      message.warning("Không có dữ liệu để xuất file");
      return;
    }
    const headers = [
      "Mã đợt phát hành",
      "Tên đợt phát hành",
      "Từ ngày",
      "Đến ngày",
      "Số lượng",
      "Mệnh giá",
      "Trạng thái",
    ];
    const rows = displayedPromotions.map((p) => [
      `"${p.id}"`,
      `"${(p.name || "").replace(/"/g, '""')}"`,
      p.startDate ? dayjs(p.startDate).format("DD/MM/YYYY") : "—",
      p.endDate ? dayjs(p.endDate).format("DD/MM/YYYY") : "Vô thời hạn",
      p.usageLimitTotal != null ? p.usageLimitTotal : "∞",
      p.discountType === "percentage" ? `${p.discountValue}%` : p.discountValue,
      p.status === "active" ? "Đang kích hoạt" : p.status === "paused" ? "Tạm dừng" : "Bản nháp",
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `kiotviet_voucher_${dayjs().format("YYYYMMDD_HHmmss")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("Đã xuất danh sách đợt phát hành & voucher thành công");
  };

  // Cột bảng chính khớp 100% với giao diện KiotViet trong ảnh của user
  const promotionColumns = [
    {
      title: "Mã đợt phát hành",
      key: "id",
      width: 160,
      render: (_: any, record: PromotionItem) => (
        <span className="font-mono font-medium text-xs text-slate-800">{record.id}</span>
      ),
    },
    {
      title: "Tên đợt phát hành",
      key: "name",
      render: (_: any, record: PromotionItem) => (
        <span className="font-medium text-slate-800 text-xs">{record.name}</span>
      ),
    },
    {
      title: "Từ ngày",
      key: "startDate",
      width: 130,
      render: (_: any, record: PromotionItem) => (
        <span className="text-xs text-slate-600">
          {record.startDate ? dayjs(record.startDate).format("DD/MM/YYYY") : "—"}
        </span>
      ),
    },
    {
      title: "Đến ngày",
      key: "endDate",
      width: 130,
      render: (_: any, record: PromotionItem) => (
        <span className="text-xs text-slate-600">
          {record.endDate ? dayjs(record.endDate).format("DD/MM/YYYY") : "—"}
        </span>
      ),
    },
    {
      title: "Số lượng",
      key: "quantity",
      width: 110,
      align: "center" as const,
      render: (_: any, record: PromotionItem) => (
        <span className="text-xs font-semibold text-slate-800">
          {record.usageLimitTotal != null ? record.usageLimitTotal.toLocaleString("vi-VN") : "∞"}
        </span>
      ),
    },
    {
      title: "Mệnh giá",
      key: "discountValue",
      width: 130,
      align: "right" as const,
      render: (_: any, record: PromotionItem) => (
        <span className="text-xs font-semibold text-slate-800">
          {record.discountType === "percentage"
            ? `${record.discountValue}%`
            : (record.discountValue || 0).toLocaleString("vi-VN")}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 140,
      render: (_: any, record: PromotionItem) => {
        if (record.status === "active") {
          return (
            <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-[#e6f4ff] text-[#1677ff] border border-[#91caff]">
              Đang kích hoạt
            </span>
          );
        }
        if (record.status === "paused") {
          return (
            <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-[#fffbe6] text-[#faad14] border border-[#ffe58f]">
              Tạm dừng
            </span>
          );
        }
        return (
          <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Chưa kích hoạt
          </span>
        );
      },
    },
    {
      title: "",
      key: "toggle",
      width: 48,
      align: "center" as const,
      render: (_: any, record: PromotionItem) => (
        <span className="text-slate-400">
          {expandedRowKeys.includes(record.id) ? (
            <ChevronUp size={16} className="text-blue-600" />
          ) : (
            <ChevronDown size={16} />
          )}
        </span>
      ),
    },
  ];

  // Tab 2 Columns: All Codes
  const allCodesColumns = [
    {
      title: "Mã giảm giá",
      key: "code",
      render: (_: any, record: AllCodeItem) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-dashed border-slate-300">
            {record.code}
          </span>
          <Tooltip title={copiedCode === record.code ? "Đã sao chép" : "Sao chép mã"}>
            <Button
              size="small"
              type="text"
              icon={
                copiedCode === record.code ? (
                  <Check size={13} className="text-emerald-600" />
                ) : (
                  <Copy size={13} className="text-slate-400 hover:text-slate-700" />
                )
              }
              onClick={() => copyToClipboard(record.code)}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Đợt phát hành / Chương trình",
      key: "promotion",
      render: (_: any, record: AllCodeItem) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">{record.promotionName}</div>
          {record.promotionTitle ? (
            <div className="text-[11px] text-slate-400">{record.promotionTitle}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Mức giảm",
      key: "discount",
      render: (_: any, record: AllCodeItem) => (
        <div className="font-bold text-[var(--aloha-green)] text-xs">
          {record.discountType === "percentage"
            ? `${record.discountValue}%`
            : formatVnd(record.discountValue || 0)}
          {record.maxDiscountVnd ? (
            <span className="block text-[10px] font-normal text-slate-400">
              Tối đa {formatVnd(record.maxDiscountVnd)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: "Lượt dùng",
      key: "usage",
      render: (_: any, record: AllCodeItem) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{record.usedCount || 0}</span>
          {record.heldCount ? (
            <span className="text-amber-600"> (+{record.heldCount} giữ)</span>
          ) : null}
          <span className="text-slate-400"> / {record.maxUses ? record.maxUses : "∞"}</span>
        </div>
      ),
    },
    {
      title: "Khách chỉ định",
      key: "buyer",
      render: (_: any, record: AllCodeItem) =>
        record.assignedBuyerPhone ? (
          <Tag color="cyan" className="font-mono text-xs">
            {record.assignedBuyerPhone}
          </Tag>
        ) : (
          <span className="text-slate-400 text-xs">Dùng chung</span>
        ),
    },
    {
      title: "Hạn dùng",
      key: "expiresAt",
      render: (_: any, record: AllCodeItem) =>
        record.expiresAt ? (
          <span className="text-xs text-slate-600">
            {dayjs(record.expiresAt).format("DD/MM/YYYY HH:mm")}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Vô thời hạn</span>
        ),
    },
    {
      title: "Trạng thái",
      key: "active",
      render: (_: any, record: AllCodeItem) =>
        record.active ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Sẵn sàng
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Tạm khóa
          </span>
        ),
    },
  ];

  // Tab 4 Columns: Redemptions
  const redemptionColumns = [
    {
      title: "Mã đơn hàng",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (v: string) => <span className="font-mono font-bold text-blue-600">{v}</span>,
    },
    {
      title: "Số tiền đã giảm",
      dataIndex: "discountAmount",
      key: "discountAmount",
      render: (v: number) => (
        <span className="font-bold text-[var(--aloha-green)]">-{formatVnd(v || 0)}</span>
      ),
    },
    {
      title: "Mã chương trình",
      dataIndex: "promotionId",
      key: "promotionId",
      render: (v: string) => <span className="text-xs font-mono text-slate-600">{v}</span>,
    },
    {
      title: "Khách hàng",
      dataIndex: "buyerPhone",
      key: "buyerPhone",
      render: (v: string) => v || <span className="text-slate-400 text-xs">Khách vãng lai</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => {
        if (st === "used")
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Đã hoàn tất
            </span>
          );
        if (st === "held")
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Đang giữ đơn
            </span>
          );
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Đã giải phóng
          </span>
        );
      },
    },
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (d: string) => (
        <span className="text-xs text-slate-500">
          {dayjs(d).format("DD/MM/YYYY HH:mm:ss")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header KiotViet Style */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Voucher</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              KiotViet Sync
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Quản lý đợt phát hành voucher, chương trình ưu đãi và mã chiết khấu Aloha Shop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            icon={<Download size={14} />}
            onClick={exportPromotionsToCsv}
            className="text-slate-700 border-slate-300 hover:text-blue-700 hover:border-blue-600"
          >
            Xuất file
          </Button>

          <Button
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            onClick={() => {
              fetchPromotions();
              if (activeTabKey === "codes") fetchAllCodes();
              if (activeTabKey === "kiotviet") fetchKvStatus();
              if (activeTabKey === "reports") fetchReport();
            }}
            loading={loading}
          >
            Làm mới
          </Button>

          <Button
            type="primary"
            className="bg-[#0070f4] hover:!bg-[#005bb5] font-bold shadow-xs"
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

      {/* Main Full-width Content View */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <Tabs
          activeKey={activeTabKey}
          onChange={handleTabChange}
          items={[
            {
              key: "programs",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <Sparkles size={15} className="text-blue-600" />
                  <span>Đợt phát hành voucher</span>
                  <Badge
                    count={displayedPromotions.length}
                    style={{ backgroundColor: "#e6f4ff", color: "#1677ff" }}
                  />
                </span>
              ),
              children: (
                <div className="space-y-3 pt-2">
                  {/* Search Bar & Counter Toolbar chuẩn KiotViet */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
                      <Input
                        placeholder="Theo mã, tên đợt phát hành"
                        prefix={<Search size={14} className="text-slate-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onPressEnter={fetchPromotions}
                        allowClear
                        className="rounded-lg text-xs py-1.5"
                      />
                      <Button
                        icon={<RefreshCw size={13} className={loading ? "animate-spin" : ""} />}
                        onClick={fetchPromotions}
                        loading={loading}
                        className="text-xs"
                      >
                        Làm mới
                      </Button>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                      Hiển thị <strong>{displayedPromotions.length}</strong> đợt phát hành
                    </div>
                  </div>

                  {/* Main Promotions Table: Bấm vào dòng là bung thông tin ngay dưới dòng như 2 ảnh KiotViet */}
                  <Table
                    columns={promotionColumns}
                    dataSource={displayedPromotions}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                    expandable={{
                      expandedRowKeys,
                      onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
                      expandedRowRender: (record) => (
                        <KiotVietVoucherDetailRow
                          record={record}
                          onEdit={(rec) => {
                            setEditingItem(rec);
                            setFormOpen(true);
                          }}
                          onDuplicate={handleDuplicate}
                          onManageCodes={(rec) => {
                            setCodeModalItem(rec);
                            setCodeModalOpen(true);
                          }}
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
                        setExpandedRowKeys((prev) =>
                          prev.includes(record.id) ? [] : [record.id]
                        );
                      },
                      className: `cursor-pointer transition-colors ${
                        expandedRowKeys.includes(record.id)
                          ? "!bg-blue-50/50"
                          : "hover:bg-slate-50/80"
                      }`,
                    })}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
            {
              key: "codes",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <Ticket size={15} className="text-blue-600" />
                  <span>Danh sách mã Voucher</span>
                  {allCodes.length > 0 && (
                    <Badge
                      count={displayedCodes.length}
                      style={{ backgroundColor: "#dbeafe", color: "#1e40af" }}
                    />
                  )}
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Search Bar for Codes */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
                      <Input
                        placeholder="Tìm mã voucher, SĐT khách..."
                        prefix={<Search size={14} className="text-slate-400" />}
                        value={codeSearchQuery}
                        onChange={(e) => setCodeSearchQuery(e.target.value)}
                        allowClear
                        className="rounded-lg text-xs py-1.5"
                      />
                      <Button
                        icon={<RefreshCw size={13} />}
                        onClick={fetchAllCodes}
                        loading={loadingCodes}
                        className="text-xs"
                      >
                        Làm mới
                      </Button>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                      Hiển thị <strong>{displayedCodes.length}</strong> mã voucher
                    </div>
                  </div>

                  <Table
                    columns={allCodesColumns}
                    dataSource={displayedCodes}
                    rowKey="code"
                    loading={loadingCodes}
                    pagination={{ pageSize: 15 }}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
            {
              key: "reports",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <BarChart3 size={15} className="text-purple-600" />
                  <span>Lịch sử sử dụng & Đối soát</span>
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Search Bar for Redemptions */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
                      <Input
                        placeholder="Tìm theo mã đơn hàng, SĐT khách..."
                        prefix={<Search size={14} className="text-slate-400" />}
                        value={redemptionSearchQuery}
                        onChange={(e) => setRedemptionSearchQuery(e.target.value)}
                        allowClear
                        className="rounded-lg text-xs py-1.5"
                      />
                      <Button
                        icon={<RefreshCw size={13} />}
                        onClick={fetchReport}
                        loading={loadingReport}
                        className="text-xs"
                      >
                        Làm mới
                      </Button>
                    </div>

                    <div className="text-xs text-slate-500 font-medium">
                      Hiển thị <strong>{displayedRedemptions.length}</strong> giao dịch
                    </div>
                  </div>

                  <Table
                    columns={redemptionColumns}
                    dataSource={displayedRedemptions}
                    rowKey="_id"
                    loading={loadingReport}
                    pagination={{ pageSize: 15 }}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
            {
              key: "kiotviet",
              label: (
                <span className="flex items-center gap-2 font-semibold">
                  <Store size={15} className="text-amber-600" />
                  <span>Đồng bộ KiotViet</span>
                </span>
              ),
              children: (
                <div className="space-y-5 pt-2">
                  {/* Status Banner */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-emerald-600 p-2 text-white">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-950">
                          Kiến trúc tích hợp ưu đãi web với KiotViet
                        </h4>
                        <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                          Hệ thống ưu đãi Aloha tính toán độc lập tại web và phân bổ chính xác vào
                          từng dòng sản phẩm (<strong>orderDetails[i].discount</strong>). Khi đơn
                          hàng đẩy sang KiotViet (KiotViet Push), giá trị chiết khấu và tổng thanh toán
                          được đồng bộ hoàn toàn khớp, không gây phát sinh thuế/phí chênh lệch.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Requirements & Checklist Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      title={
                        <span className="text-sm font-bold text-slate-800">
                          Quy tắc đối soát tài chính
                        </span>
                      }
                      size="small"
                      className="border-slate-200"
                    >
                      <ul className="space-y-3 text-xs text-slate-600">
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-emerald-600">✓</span>
                          <span>
                            <strong>Phân bổ tỷ trọng:</strong> Giảm giá toàn đơn được chia theo giá
                            trị từng món để phục vụ tính hoàn trả từng phần và hoa hồng CTV chính xác.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-emerald-600">✓</span>
                          <span>
                            <strong>Hoa hồng CTV:</strong> CTV nhận hoa hồng theo giá thực thu của
                            dòng sau giảm (<strong>lineNet = price * qty - discount</strong>).
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-bold text-emerald-600">✓</span>
                          <span>
                            <strong>Đồng bộ KiotViet Invoice:</strong> Trường{" "}
                            <code>discount</code> cấp đơn và dòng được mapping khớp với KiotViet API.
                          </span>
                        </li>
                      </ul>
                    </Card>

                    <Card
                      title={
                        <span className="text-sm font-bold text-slate-800">
                          Trạng thái Voucher KiotViet (Mục 9 & 18)
                        </span>
                      }
                      size="small"
                      className="border-slate-200"
                    >
                      <div className="space-y-3 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Chế độ vận hành:</span>
                          <Tag color="cyan">Khảo sát & Đối soát (Read-only)</Tag>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">API Đợt phát hành:</span>
                          <span className="font-mono text-slate-700">GET /vouchercampaign</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Phương thức thanh toán:</span>
                          <Tag color="blue">Payments: Voucher</Tag>
                        </div>
                        <p className="mt-2 text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          Theo tài liệu thiết kế, voucher thanh toán của KiotViet cần qua giai đoạn
                          kiểm thử đồng thời giữa POS và Website trước khi kích hoạt nhập mã tại quầy
                          thu ngân online để đảm bảo tính duy nhất và không bị dùng trùng mã.
                        </p>
                      </div>
                    </Card>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Modals */}
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
          setCodeModalItem(createdPromo);
          setCodeModalOpen(true);
        }}
        editingItem={editingItem}
      />

      <PromotionCodeModal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        promotion={codeModalItem}
      />
    </div>
  );
}
