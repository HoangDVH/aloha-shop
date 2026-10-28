import { Drawer } from "antd";
import { DATE_OPTIONS, type DateFilterKey } from "./orderTypes";

export function WebOrdersFilterDrawer({
  open,
  onClose,
  dateFilter,
  setDateFilter,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
  payment,
  setPayment,
  priceMode,
  setPriceMode,
  setPage,
}: {
  open: boolean;
  onClose: () => void;
  dateFilter: DateFilterKey;
  setDateFilter: (v: DateFilterKey) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  payment: string;
  setPayment: (v: string) => void;
  priceMode: string;
  setPriceMode: (v: string) => void;
  setPage: (v: number) => void;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={300}
      destroyOnHidden
      title={<span className="font-bold text-sm text-slate-900">Bộ lọc nâng cao</span>}
    >
      <div className="space-y-5 text-xs">
        {/* Thời gian */}
        <div>
          <div className="font-bold text-slate-700 uppercase tracking-wider mb-2">
            Khoảng thời gian
          </div>
          <div className="space-y-1">
            {DATE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  setDateFilter(opt.key);
                  setPage(1);
                }}
                className={`w-full text-left p-2 rounded-lg font-medium transition ${
                  dateFilter === opt.key
                    ? "bg-[#2D5A27]/10 text-[#2D5A27] font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" ? (
            <div className="pt-2 space-y-2 border-t border-slate-100 mt-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Từ ngày</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-[#2D5A27] outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-0.5">Đến ngày</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-[#2D5A27] outline-none"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Trạng thái thanh toán */}
        <div className="border-t border-slate-100 pt-3">
          <div className="font-bold text-slate-700 uppercase tracking-wider mb-2">
            Trạng thái thanh toán
          </div>
          <div className="space-y-1">
            {[
              { label: "Tất cả", value: "" },
              { label: "Phiếu tạm (Chưa thanh toán)", value: "unpaid,cod,expired,failed" },
              { label: "Hoàn thành (Đã thanh toán)", value: "paid" },
              { label: "Đã huỷ", value: "cancelled" },
            ].map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  setPayment(s.value);
                  setPage(1);
                }}
                className={`w-full text-left p-2 rounded-lg font-medium transition ${
                  payment === s.value
                    ? "bg-[#2D5A27]/10 text-[#2D5A27] font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bảng giá */}
        <div className="border-t border-slate-100 pt-3">
          <div className="font-bold text-slate-700 uppercase tracking-wider mb-2">Bảng giá</div>
          <div className="space-y-1">
            {[
              { label: "Tất cả", value: "" },
              { label: "Bảng giá Web", value: "le" },
              { label: "Bảng giá sỉ", value: "si" },
            ].map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => {
                  setPriceMode(m.value);
                  setPage(1);
                }}
                className={`w-full text-left p-2 rounded-lg font-medium transition ${
                  priceMode === m.value
                    ? "bg-[#2D5A27]/10 text-[#2D5A27] font-bold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
