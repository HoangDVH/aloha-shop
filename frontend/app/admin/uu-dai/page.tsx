"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
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
  Play,
  Pause,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  Archive,
  BarChart3,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Clock,
  DollarSign,
  Users,
  Eye,
  Store,
} from "lucide-react";
import dayjs from "dayjs";
import { AdminCard, AdminPageHeader } from "@/components/admin/shell/AdminUi";
import { formatVnd } from "@/lib/api";
import {
  PromotionFormModal,
  type PromotionItem,
} from "@/components/admin/promotions/PromotionFormModal";
import { PromotionCodeModal } from "@/components/admin/promotions/PromotionCodeModal";
import { PromotionPreviewModal } from "@/components/admin/promotions/PromotionPreviewModal";

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

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PromotionItem | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<PromotionItem | null>(null);

  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [codeModalItem, setCodeModalItem] = useState<PromotionItem | null>(null);

  // Tab 2: All Codes
  const [allCodes, setAllCodes] = useState<AllCodeItem[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Tab 3: KiotViet status
  const [kvStatus, setKvStatus] = useState<any>(null);
  const [loadingKv, setLoadingKv] = useState(false);

  // Tab 4: Reports
  const [report, setReport] = useState<ReportOverview | null>(null);
  const [recentRedemptions, setRecentRedemptions] = useState<RedemptionLog[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // Load promotions
  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
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
  }, [statusFilter, typeFilter]);

  // Actions
  const handleToggleStatus = async (item: PromotionItem) => {
    const nextStatus = item.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/shop/admin/promotions/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.ok) {
        message.success(
          nextStatus === "active"
            ? `Đã kích hoạt chương trình "${item.name}"`
            : `Đã tạm dừng chương trình "${item.name}"`
        );
        fetchPromotions();
      } else {
        message.error(data.error || "Không cập nhật được trạng thái");
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi cập nhật trạng thái");
    }
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

  const handleArchive = async (item: PromotionItem) => {
    try {
      const res = await fetch(`/api/shop/admin/promotions/${item.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await res.json();
      if (data.ok) {
        message.success(`Đã chuyển vào lưu trữ: "${item.name}"`);
        fetchPromotions();
      } else {
        message.error(data.error || "Không lưu trữ được");
      }
    } catch (e: any) {
      message.error(e?.message || "Lỗi lưu trữ");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    message.success(`Đã sao chép mã: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Promotion columns
  const promotionColumns = [
    {
      title: "Chương trình",
      key: "name",
      render: (_: any, record: PromotionItem) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 text-sm">{record.name}</span>
            {record.isPublic === false ? (
              <Tag color="purple" className="text-[10px] leading-tight px-1 py-0">
                Ẩn
              </Tag>
            ) : null}
          </div>
          <div className="text-xs text-slate-500 line-clamp-1">{record.title}</div>
          <div className="text-[11px] font-mono text-slate-400">ID: {record.id}</div>
        </div>
      ),
    },
    {
      title: "Loại & Mức giảm",
      key: "discount",
      render: (_: any, record: PromotionItem) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {record.type === "auto" ? (
              <Tag color="cyan" className="text-xs font-semibold">
                Tự động
              </Tag>
            ) : (
              <Tag color="blue" className="text-xs font-semibold">
                Mã giảm giá
              </Tag>
            )}
          </div>
          <div className="font-bold text-emerald-700 text-sm">
            {record.discountType === "percentage"
              ? `${record.discountValue}%`
              : formatVnd(record.discountValue)}
            {record.maxDiscountVnd ? (
              <span className="block text-[11px] font-normal text-slate-500">
                Tối đa {formatVnd(record.maxDiscountVnd)}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      title: "Điều kiện áp dụng",
      key: "condition",
      render: (_: any, record: PromotionItem) => (
        <div className="space-y-1 text-xs">
          <div>
            <span className="text-slate-500">Đơn hàng: </span>
            {record.minOrderThreshold ? (
              <span className="font-semibold text-slate-700">
                {record.thresholdOperator === ">=" ? "Từ" : "Trên"}{" "}
                {formatVnd(record.minOrderThreshold)}
              </span>
            ) : (
              <span className="text-slate-600">Không yêu cầu</span>
            )}
          </div>
          <div>
            <span className="text-slate-500">Khách: </span>
            <span className="font-medium text-slate-700">
              {record.targetCustomer === "new_web"
                ? "Khách mới web"
                : record.targetCustomer === "wholesale"
                  ? "Khách sỉ"
                  : "Khách lẻ"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Phạm vi: </span>
            <span className="text-slate-700">
              {record.scope === "product"
                ? `${record.productMas?.length || 0} SP chỉ định`
                : "Toàn bộ hàng"}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: "Lượt dùng & Ngân sách",
      key: "usage",
      render: (_: any, record: PromotionItem) => (
        <div className="space-y-1 text-xs">
          <div>
            <span className="text-slate-500">Lượt: </span>
            <span className="font-semibold text-slate-800">
              {record.usedCount || 0}
              {record.heldCount ? (
                <span className="text-amber-600 font-normal"> (+{record.heldCount} giữ)</span>
              ) : null}
            </span>
            <span className="text-slate-400">
              {" "}
              / {record.usageLimitTotal ? record.usageLimitTotal : "∞"}
            </span>
          </div>
          {record.budgetTotal ? (
            <div>
              <span className="text-slate-500">Ngân sách: </span>
              <span className="font-medium text-slate-700">
                {formatVnd(record.budgetUsed || 0)} / {formatVnd(record.budgetTotal)}
              </span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: any, record: PromotionItem) => {
        if (record.status === "active") {
          return <Tag color="success">Đang áp dụng</Tag>;
        }
        if (record.status === "paused") {
          return <Tag color="warning">Tạm dừng</Tag>;
        }
        if (record.status === "archived") {
          return <Tag color="default">Lưu trữ</Tag>;
        }
        return <Tag color="processing">Bản nháp</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: any, record: PromotionItem) => (
        <Space size="small" wrap>
          <Tooltip title="Chỉnh sửa chương trình">
            <Button
              size="small"
              icon={<Edit size={13} />}
              onClick={() => {
                setEditingItem(record);
                setFormOpen(true);
              }}
            />
          </Tooltip>

          <Tooltip title="Mô phỏng tính tiền với giỏ mẫu">
            <Button
              size="small"
              icon={<Eye size={13} />}
              onClick={() => {
                setPreviewItem(record);
                setPreviewOpen(true);
              }}
            />
          </Tooltip>

          {record.status === "active" ? (
            <Tooltip title="Tạm dừng áp dụng">
              <Button
                size="small"
                icon={<Pause size={13} className="text-amber-600" />}
                onClick={() => handleToggleStatus(record)}
              />
            </Tooltip>
          ) : record.status === "paused" || record.status === "draft" ? (
            <Tooltip title="Kích hoạt áp dụng">
              <Button
                size="small"
                icon={<Play size={13} className="text-emerald-600" />}
                onClick={() => handleToggleStatus(record)}
              />
            </Tooltip>
          ) : null}

          {record.type === "code" ? (
            <Tooltip title="Quản lý mã giảm giá">
              <Button
                size="small"
                icon={<Ticket size={13} className="text-blue-600" />}
                onClick={() => {
                  setCodeModalItem(record);
                  setCodeModalOpen(true);
                }}
              />
            </Tooltip>
          ) : null}

          <Tooltip title="Nhân bản thành bản nháp">
            <Button
              size="small"
              icon={<Copy size={13} />}
              onClick={() => handleDuplicate(record)}
            />
          </Tooltip>

          {record.status !== "archived" ? (
            <Popconfirm
              title="Lưu trữ chương trình này?"
              description="Chương trình đã lưu trữ sẽ ngừng áp dụng và ẩn khỏi danh sách chính."
              onConfirm={() => handleArchive(record)}
              okText="Lưu trữ"
              cancelText="Hủy"
            >
              <Button size="small" icon={<Archive size={13} className="text-slate-400" />} />
            </Popconfirm>
          ) : null}
        </Space>
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
          <span className="font-mono font-bold text-sm text-[var(--aloha-ink)] bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {record.code}
          </span>
          <Button
            size="small"
            type="text"
            icon={<Copy size={13} className={copiedCode === record.code ? "text-emerald-600" : ""} />}
            onClick={() => copyToClipboard(record.code)}
          />
        </div>
      ),
    },
    {
      title: "Chương trình ưu đãi",
      key: "promotion",
      render: (_: any, record: AllCodeItem) => (
        <div>
          <div className="font-semibold text-slate-800 text-sm">{record.promotionName}</div>
          <div className="text-xs text-slate-500">{record.promotionTitle}</div>
        </div>
      ),
    },
    {
      title: "Mức giảm",
      key: "discount",
      render: (_: any, record: AllCodeItem) => (
        <div className="font-bold text-emerald-700">
          {record.discountType === "percentage"
            ? `${record.discountValue}%`
            : formatVnd(record.discountValue || 0)}
          {record.maxDiscountVnd ? (
            <span className="block text-[11px] font-normal text-slate-500">
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
          <Tag color="cyan">{record.assignedBuyerPhone}</Tag>
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
          <Tag color="success">Sẵn sàng</Tag>
        ) : (
          <Tag color="default">Tạm khóa</Tag>
        ),
    },
  ];

  // Tab 4 Columns: Redemptions
  const redemptionColumns = [
    {
      title: "Mã đơn hàng",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (v: string) => <span className="font-mono font-bold text-slate-800">{v}</span>,
    },
    {
      title: "Số tiền đã giảm",
      dataIndex: "discountAmount",
      key: "discountAmount",
      render: (v: number) => (
        <span className="font-bold text-emerald-700">-{formatVnd(v || 0)}</span>
      ),
    },
    {
      title: "Chương trình",
      dataIndex: "promotionId",
      key: "promotionId",
      render: (v: string) => <span className="text-xs font-mono text-slate-600">{v}</span>,
    },
    {
      title: "Khách hàng",
      dataIndex: "buyerPhone",
      key: "buyerPhone",
      render: (v: string) => v || <span className="text-slate-400 text-xs">Chưa rõ</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (st: string) => {
        if (st === "used") return <Tag color="success">Đã hoàn tất thanh toán</Tag>;
        if (st === "held") return <Tag color="warning">Đang giữ đơn</Tag>;
        return <Tag color="default">Đã giải phóng</Tag>;
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
    <div className="space-y-6">
      <AdminPageHeader
        title="Ưu đãi & Voucher"
        description="Quản lý chính sách ưu đãi tự động, chiến dịch mã giảm giá và cơ chế phân bổ chiết khấu trên website Aloha."
        actions={
          <Space>
            <Button
              icon={<Play size={14} className="text-emerald-700" />}
              onClick={() => {
                setPreviewItem(promotions[0] || null);
                setPreviewOpen(true);
              }}
            >
              Mô phỏng tính tiền
            </Button>
            <Button
              type="primary"
              className="bg-[var(--aloha-green)] hover:!bg-[var(--aloha-green-hover)]"
              icon={<Plus size={15} />}
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
            >
              Tạo ưu đãi mới
            </Button>
          </Space>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Chương trình đang chạy</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {report?.activePromotionsCount ?? 0}
              </h3>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Tổng tiền đã giảm</p>
              <h3 className="text-xl font-bold text-emerald-700 mt-0.5">
                {formatVnd(report?.totalDiscountGiven ?? 0)}
              </h3>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Ticket size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Đơn hàng dùng ưu đãi</p>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                {report?.totalOrdersUsingDiscount ?? 0}
              </h3>
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Store size={20} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Đồng bộ KiotViet</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                <span className="text-sm font-bold text-slate-900">Chiết khấu kết nối</span>
              </div>
            </div>
          </div>
        </AdminCard>
      </div>

      {/* Main Tabs */}
      <AdminCard>
        <Tabs
          defaultActiveKey="programs"
          onChange={(key) => {
            if (key === "codes") fetchAllCodes();
            if (key === "kiotviet") fetchKvStatus();
            if (key === "reports") fetchReport();
          }}
          items={[
            {
              key: "programs",
              label: (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Sparkles size={15} /> Chương trình ưu đãi
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Filters & Search */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Tìm tên hoặc ID ưu đãi..."
                        prefix={<Search size={14} className="text-slate-400" />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onPressEnter={fetchPromotions}
                        className="w-64"
                        allowClear
                      />
                      <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        className="w-36"
                        options={[
                          { label: "Tất cả trạng thái", value: "all" },
                          { label: "Đang áp dụng", value: "active" },
                          { label: "Tạm dừng", value: "paused" },
                          { label: "Bản nháp", value: "draft" },
                          { label: "Lưu trữ", value: "archived" },
                        ]}
                      />
                      <Select
                        value={typeFilter}
                        onChange={setTypeFilter}
                        className="w-36"
                        options={[
                          { label: "Tất cả loại", value: "all" },
                          { label: "Tự động", value: "auto" },
                          { label: "Mã giảm giá", value: "code" },
                        ]}
                      />
                      <Button icon={<RefreshCw size={14} />} onClick={fetchPromotions}>
                        Làm mới
                      </Button>
                    </div>

                    <div className="text-xs text-slate-500">
                      Hiển thị <strong>{promotions.length}</strong> chương trình
                    </div>
                  </div>

                  {/* Promotions Table */}
                  <Table
                    columns={promotionColumns}
                    dataSource={promotions}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
            {
              key: "codes",
              label: (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Ticket size={15} /> Mã giảm giá
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        Danh sách mã giảm giá phát hành
                      </h4>
                      <p className="text-xs text-slate-500">
                        Tổng hợp mã chung và mã cá nhân cho các chương trình dạng Nhập mã.
                      </p>
                    </div>
                    <Button
                      icon={<RefreshCw size={14} />}
                      onClick={fetchAllCodes}
                      loading={loadingCodes}
                    >
                      Làm mới
                    </Button>
                  </div>

                  <Table
                    columns={allCodesColumns}
                    dataSource={allCodes}
                    rowKey="code"
                    loading={loadingCodes}
                    pagination={{ pageSize: 15 }}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
            {
              key: "kiotviet",
              label: (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Store size={15} /> Voucher KiotViet & Đối soát
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
            {
              key: "reports",
              label: (
                <span className="flex items-center gap-1.5 font-semibold">
                  <BarChart3 size={15} /> Báo cáo & Lịch sử
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        Nhật ký sử dụng ưu đãi gần đây
                      </h4>
                      <p className="text-xs text-slate-500">
                        Lịch sử các lần giữ quyền (held), áp dụng thanh toán thành công (used) và
                        giải phóng (released).
                      </p>
                    </div>
                    <Button
                      icon={<RefreshCw size={14} />}
                      onClick={fetchReport}
                      loading={loadingReport}
                    >
                      Làm mới
                    </Button>
                  </div>

                  <Table
                    columns={redemptionColumns}
                    dataSource={recentRedemptions}
                    rowKey="_id"
                    loading={loadingReport}
                    pagination={{ pageSize: 15 }}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
          ]}
        />
      </AdminCard>

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

      <PromotionPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        promotion={previewItem}
      />

      <PromotionCodeModal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        promotion={codeModalItem}
      />
    </div>
  );
}
