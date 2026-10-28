import { Button, Dropdown, Input } from "antd";
import {
  Calendar,
  Check,
  ChevronDown,
  Download,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import {
  DATE_OPTIONS,
  SEARCH_TABS,
  type DateFilterKey,
  type SearchTabKey,
} from "./orderTypes";

export function WebOrdersDesktopToolbar({
  q,
  setQ,
  search,
  setSearch,
  searchType,
  setSearchType,
  dateFilter,
  setDateFilter,
  payment,
  setPayment,
  priceMode,
  setPriceMode,
  setPage,
  hasActiveFilters,
  setFilterDrawerOpen,
  exportCsv,
  onRefresh,
  isFetching,
  onOpenQuickOrder,
}: {
  q: string;
  setQ: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  searchType: SearchTabKey;
  setSearchType: (v: SearchTabKey) => void;
  dateFilter: DateFilterKey;
  setDateFilter: (v: DateFilterKey) => void;
  payment: string;
  setPayment: (v: string) => void;
  priceMode: string;
  setPriceMode: (v: string) => void;
  setPage: (v: number) => void;
  hasActiveFilters: boolean;
  setFilterDrawerOpen: (v: boolean) => void;
  exportCsv: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  onOpenQuickOrder?: () => void;
}) {
  const currentSearchTab = SEARCH_TABS.find((t) => t.key === searchType) || SEARCH_TABS[0];
  const currentDateOption = DATE_OPTIONS.find((o) => o.key === dateFilter) || DATE_OPTIONS[4];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Cụm tìm kiếm theo phạm vi */}
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <Dropdown
            menu={{
              items: SEARCH_TABS.map((t) => ({
                key: t.key,
                label: t.label,
                onClick: () => setSearchType(t.key),
              })),
            }}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition shrink-0"
            >
              <span>{currentSearchTab.label}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </Dropdown>

          <div className="relative flex-1">
            <Input
              prefix={<Search size={15} className="text-slate-400 mr-1.5 shrink-0" />}
              allowClear
              placeholder={currentSearchTab.placeholder}
              value={q}
              onChange={(e) => {
                const val = e.target.value;
                setQ(val);
                if (!val) {
                  setSearch("");
                  setPage(1);
                }
              }}
              onPressEnter={() => {
                setSearch(q.trim());
                setPage(1);
              }}
              suffix={
                q.trim() && q.trim() !== search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch(q.trim());
                      setPage(1);
                    }}
                    className="text-[11px] font-bold text-[#2D5A27] hover:underline px-1 py-0.5 rounded cursor-pointer"
                  >
                    Tìm
                  </button>
                ) : null
              }
              className="h-9 rounded-xl border-slate-200 bg-slate-50/70 text-xs focus:bg-white"
            />
          </div>
        </div>

        {/* Các nút thao tác xuất file, làm mới, tạo đơn nhanh */}
        <div className="flex items-center gap-2">
          {onOpenQuickOrder && (
            <Button
              type="primary"
              icon={<Zap size={14} className="fill-amber-300 text-amber-300" />}
              onClick={onOpenQuickOrder}
              className="font-bold text-xs h-9 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white flex items-center shadow-xs"
            >
              ⚡ Tạo đơn nhanh
            </Button>
          )}

          <Button
            icon={<Download size={14} />}
            onClick={exportCsv}
            className="font-medium text-xs h-9 rounded-xl"
          >
            Xuất file
          </Button>

          <Button
            icon={<RefreshCw size={14} className={isFetching ? "animate-spin text-[#2D5A27]" : ""} />}
            onClick={onRefresh}
            loading={isFetching}
            className="font-medium text-xs h-9 rounded-xl"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* DÒNG BỘ LỌC NGANG NHỎ GỌN */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        {/* Lọc thời gian */}
        <Dropdown
          menu={{
            items: DATE_OPTIONS.map((opt) => ({
              key: opt.key,
              label: opt.label,
              icon: dateFilter === opt.key ? <Check size={14} className="text-[#2D5A27]" /> : null,
              onClick: () => {
                setDateFilter(opt.key);
                setPage(1);
              },
            })),
          }}
        >
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              dateFilter !== "thisMonth"
                ? "bg-[#2D5A27]/10 text-[#2D5A27] border-[#2D5A27]/30"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Calendar size={13} className="text-slate-400" />
            <span>Thời gian: {currentDateOption.label}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </Dropdown>

        {/* Lọc trạng thái thanh toán */}
        <Dropdown
          menu={{
            items: [
              { label: "Tất cả trạng thái", value: "" },
              { label: "Phiếu tạm (Chưa thanh toán)", value: "unpaid,cod,expired,failed" },
              { label: "Hoàn thành (Đã thanh toán)", value: "paid" },
              { label: "Đã huỷ", value: "cancelled" },
            ].map((s) => ({
              key: s.value,
              label: s.label,
              icon: payment === s.value ? <Check size={14} className="text-[#2D5A27]" /> : null,
              onClick: () => {
                setPayment(s.value);
                setPage(1);
              },
            })),
          }}
        >
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              payment
                ? "bg-[#2D5A27]/10 text-[#2D5A27] border-[#2D5A27]/30"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>
              Trạng thái:{" "}
              {payment === "paid"
                ? "Hoàn thành"
                : payment === "cancelled"
                ? "Đã huỷ"
                : payment
                ? "Phiếu tạm"
                : "Tất cả"}
            </span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </Dropdown>

        {/* Lọc Bảng giá */}
        <Dropdown
          menu={{
            items: [
              { label: "Tất cả bảng giá", value: "" },
              { label: "Bảng giá Web", value: "le" },
              { label: "Bảng giá sỉ", value: "si" },
            ].map((m) => ({
              key: m.value,
              label: m.label,
              icon: priceMode === m.value ? <Check size={14} className="text-[#2D5A27]" /> : null,
              onClick: () => {
                setPriceMode(m.value);
                setPage(1);
              },
            })),
          }}
        >
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              priceMode
                ? "bg-[#2D5A27]/10 text-[#2D5A27] border-[#2D5A27]/30"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>
              Bảng giá: {priceMode === "si" ? "Bảng giá sỉ" : priceMode === "le" ? "Bảng giá Web" : "Tất cả"}
            </span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </Dropdown>

        {/* Nút xoá nhanh bộ lọc khi có lọc đang kích hoạt */}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setPayment("");
              setPriceMode("");
              setDateFilter("thisMonth");
              setSearch("");
              setQ("");
              setPage(1);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <X size={13} />
            <span>Xoá bộ lọc</span>
          </button>
        ) : null}

        {/* Nút Bộ lọc nâng cao */}
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
        >
          <SlidersHorizontal size={13} />
          <span>Lọc nâng cao</span>
        </button>
      </div>
    </div>
  );
}
