"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, InputNumber, Modal, Select, App } from "antd";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type {
  CampaignContentAdmin,
  CampaignProductAdmin,
  CampaignSlotUI,
  FieldError,
  ProductFacts,
} from "@/lib/campaign/campaignAdminApi";
import { slotOptions, slotRangeText } from "@/lib/campaign/flashSlots";
import { DEFAULT_GIFT_MA, withDefaultGift } from "@/lib/campaign/defaultGift";
import { ProductPicker } from "@/components/admin/website/shared/ProductPicker";
import { fieldErrorsFor, newProductRow, parsePastedRows, saleFromPercent, withPriceInput } from "../wizardModel";
import { FileSpreadsheet, Gift, Sparkles, Search, Filter } from "lucide-react";
import { LockedNote } from "./StepBits";
import { ProductRow } from "./ProductRow";
import { SlotsEditor } from "./SlotsEditor";

type Props = {
  content: CampaignContentAdmin;
  update: (fn: (c: CampaignContentAdmin) => CampaignContentAdmin) => void;
  locked: boolean;
  errors: FieldError[];
  facts: Record<string, ProductFacts>;
  onNeedFacts: (mas: string[]) => void;
};

function rowIds(products: CampaignProductAdmin[]): string[] {
  const seen = new Map<string, number>();
  return products.map((p) => {
    const base = `${p.ma}|${p.slotKey || ""}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  });
}

function assignSlotToAll(products: CampaignProductAdmin[], slotKey: string | undefined) {
  const moved = new Set<string>();
  let kept = 0;
  const next = products.map((p) => {
    if (moved.has(p.ma)) {
      kept++;
      return p;
    }
    moved.add(p.ma);
    return { ...p, slotKey };
  });
  return { next, kept };
}

function BulkTools({
  locked,
  update,
  facts,
  onNeedFacts,
  onAdded,
  products,
  slots,
}: Pick<Props, "locked" | "update" | "facts" | "onNeedFacts"> & {
  onAdded: (mas: string[]) => void;
  products: CampaignProductAdmin[];
  slots: CampaignSlotUI[];
}) {
  const { message, modal } = App.useApp();
  const [pct, setPct] = useState<number>(20);
  const [slot, setSlot] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState("");

  if (locked) return null;

  const applyPct = () =>
    update((c) => ({
      ...c,
      products: c.products.map((p) =>
        facts[p.ma]?.listPrice && !p.compareAtPrice ? { ...p, salePrice: saleFromPercent(facts[p.ma].listPrice, pct) } : p
      ),
    }));

  const applySlot = () => {
    const { next, kept } = assignSlotToAll(products, slot || undefined);
    update((c) => ({ ...c, products: next }));
    const name = slots.find((s) => s.key === slot);
    message.success(`Đã đặt ${next.length - kept} sản phẩm vào ${name ? `khung ${slotRangeText(name)}` : '"Cả ngày"'}`);
    if (kept) message.info(`${kept} dòng trùng sản phẩm giữ nguyên khung cũ`);
  };

  const applyDefaultGift = () => {
    let n = 0;
    const next = products.map((p) => {
      const r = withDefaultGift(p, facts[p.ma]?.nhomPath);
      if (r !== p) n++;
      return r;
    });
    if (!n) return void message.info("Không có sản phẩm cây thành phẩm nào đang thiếu quà");
    onNeedFacts([DEFAULT_GIFT_MA]);
    update((c) => ({ ...c, products: next }));
    message.success(`Đã gán túi giấy ${DEFAULT_GIFT_MA} cho ${n} sản phẩm`);
  };

  const importRows = () => {
    const { rows, errors } = parsePastedRows(text);
    if (errors.length) {
      modal.warning({
        title: `${errors.length} dòng lỗi — chưa nhập dòng nào`,
        content: (
          <div className="text-[12px]">{errors.slice(0, 20).map((e) => <div key={e}>{e}</div>)}</div>
        ),
      });
      return;
    }
    const had = new Set(products.filter((p) => !p.slotKey).map((p) => p.ma));
    onAdded(rows.map((r) => r.ma).filter((ma) => !had.has(ma)));
    update((c) => {
      const existing = new Set(c.products.map((p) => `${p.ma}|${p.slotKey || ""}`));
      const add = rows
        .filter((r) => !existing.has(`${r.ma}|`))
        .map((r) => withPriceInput({ ...newProductRow(r.ma, 0), quota: r.quota }, r.salePrice, facts[r.ma]?.listPrice || 0));
      return { ...c, products: [...c.products, ...add] };
    });
    message.success(`Đã nhập ${rows.length} dòng`);
    setPasteOpen(false);
    setText("");
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0 mr-1">
          <Sparkles size={14} className="text-[#2D5A27]" />
          <span>Áp dụng nhanh:</span>
        </div>

        {/* Thiết lập giảm giá % */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-600 font-medium">Giảm</span>
          <InputNumber
            min={1}
            max={90}
            value={pct}
            onChange={(v) => setPct(Number(v) || 0)}
            suffix={<span className="text-xs font-bold text-slate-400 select-none">%</span>}
            className="!w-20 font-bold text-slate-800 !h-9 !rounded-lg text-center [&_.ant-input-number-input]:!h-[34px] [&_.ant-input-number-input]:!text-xs"
          />
          <Button
            type="primary"
            onClick={applyPct}
            className="!bg-[#2D5A27] hover:!bg-[#23481e] font-bold text-xs !h-9 !rounded-lg px-3.5 whitespace-nowrap text-white"
          >
            Áp dụng
          </Button>
        </div>

        {/* Thiết lập khung giờ (chỉ hiện khi có khung giờ) */}
        {slots.length ? (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <span className="text-xs text-slate-600 font-medium">Khung</span>
            <Select
              value={slot}
              onChange={setSlot}
              options={slotOptions(slots)}
              popupMatchSelectWidth={false}
              className="!w-48 sm:!w-56 [&_.ant-select-selector]:!h-9 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[34px] [&_.ant-select-selection-item]:!text-xs [&_.ant-select-selection-item]:!font-medium"
            />
            <Button
              onClick={applySlot}
              className="font-bold text-xs !h-9 !rounded-lg px-3 border-[#2D5A27] text-[#2D5A27] hover:!bg-emerald-50 whitespace-nowrap"
            >
              Đặt
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
        <Button
          icon={<Gift size={14} className="text-amber-600" />}
          onClick={applyDefaultGift}
          title={`Gán túi giấy ${DEFAULT_GIFT_MA} cho SP cây thành phẩm đang chưa có quà`}
          className="text-xs font-medium border-slate-300 hover:border-amber-500 !h-9 !rounded-lg px-3 flex items-center gap-1.5"
        >
          Gán túi giấy
        </Button>
        <Button
          icon={<FileSpreadsheet size={14} className="text-emerald-700" />}
          onClick={() => setPasteOpen(true)}
          className="text-xs font-medium border-slate-300 hover:border-emerald-600 !h-9 !rounded-lg px-3 flex items-center gap-1.5"
        >
          Dán từ Excel
        </Button>
      </div>

      <Modal
        open={pasteOpen}
        title="Dán danh sách từ Excel"
        okText="Nhập"
        onOk={importRows}
        onCancel={() => setPasteOpen(false)}
      >
        <p className="mb-2 text-[12px] text-slate-500">
          Mỗi dòng: mã sản phẩm, giá sale, số lượng (cách nhau bởi dấu Tab).
        </p>
        <Input.TextArea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"SP_A\t124000\t10\nSP_B\t89000\t5"}
        />
      </Modal>
    </div>
  );
}

export function ProductsStep({ content, update, locked, errors, facts, onNeedFacts }: Props) {
  const { message } = App.useApp();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => rowIds(content.products), [content.products]);

  const [searchFilter, setSearchFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");

  const setRow = (i: number, row: CampaignProductAdmin) =>
    update((c) => ({ ...c, products: c.products.map((p, j) => (j === i ? row : p)) }));

  const onDragEnd = (e: DragEndEvent) => {
    const from = ids.indexOf(String(e.active.id));
    const to = e.over ? ids.indexOf(String(e.over.id)) : -1;
    if (from < 0 || to < 0 || from === to) return;
    update((c) => ({ ...c, products: arrayMove(c.products, from, to) }));
  };

  const pendingGift = useRef(new Set<string>());
  const markAdded = (mas: string[]) => {
    for (const m of mas) pendingGift.current.add(m.toUpperCase());
    onNeedFacts([...mas, DEFAULT_GIFT_MA]);
  };

  useEffect(() => {
    const ready = [...pendingGift.current].filter((m) => facts[m]);
    if (!ready.length) return;
    ready.forEach((m) => pendingGift.current.delete(m));
    const apply = (p: CampaignProductAdmin) =>
      ready.includes(p.ma) && !p.slotKey ? withDefaultGift(p, facts[p.ma].nhomPath) : p;
    if (content.products.some((p) => apply(p) !== p)) update((c) => ({ ...c, products: c.products.map(apply) }));
  }, [facts, content.products, update]);

  const add = (ma: string, listPrice: number) => {
    const code = ma.toUpperCase();
    if (content.products.some((p) => p.ma === code && !p.slotKey))
      return void message.info(`${code} đã có trong danh sách`);
    markAdded([code]);
    update((c) => ({ ...c, products: [...c.products, newProductRow(code, listPrice)] }));
  };

  const slotUsage = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of content.products) if (p.slotKey) out[p.slotKey] = (out[p.slotKey] || 0) + 1;
    return out;
  }, [content.products]);

  const changeSlots = (slots: CampaignSlotUI[], removed: string[]) =>
    update((c) => ({
      ...c,
      slots,
      products: removed.length
        ? c.products.map((p) => (p.slotKey && removed.includes(p.slotKey) ? { ...p, slotKey: undefined } : p))
        : c.products,
    }));

  // Lọc sản phẩm theo tìm kiếm và khung giờ
  const filteredIndices = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return content.products
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => {
        if (slotFilter !== "all") {
          const matchSlot = slotFilter === "allDay" ? !p.slotKey : p.slotKey === slotFilter;
          if (!matchSlot) return false;
        }
        if (q) {
          const name = (facts[p.ma]?.ten || "").toLowerCase();
          const ma = p.ma.toLowerCase();
          if (!ma.includes(q) && !name.includes(q)) return false;
        }
        return true;
      })
      .map(({ idx }) => idx);
  }, [content.products, searchFilter, slotFilter, facts]);

  const isFiltering = !!searchFilter || slotFilter !== "all";

  return (
    <div className="space-y-6 max-w-5xl">
      {locked ? <LockedNote /> : null}

      {/* Card 1: Khung giờ Flash Sale */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Hình thức áp dụng &amp; Khung giờ</h3>
            <p className="text-xs text-slate-500">Mặc định bán giá sale cả ngày, hoặc tạo các khung giờ Flash Sale theo giờ</p>
          </div>
        </div>

        <SlotsEditor
          slots={content.slots}
          locked={locked}
          errors={errors}
          usage={slotUsage}
          onChange={changeSlots}
        />
      </div>

      {/* Card 2: Danh sách sản phẩm khuyến mãi */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Sản phẩm khuyến mãi</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#2D5A27] border border-emerald-200">
                  {content.products.length} sản phẩm
                </span>
              </div>
              <p className="text-xs text-slate-500">Nhập mã SKU để thêm sản phẩm, điều chỉnh mức giá sale và số lượng</p>
            </div>
          </div>
        </div>

        {/* Ô tìm kiếm thêm sản phẩm */}
        <ProductPicker
          disabled={locked}
          placeholder="Tìm sản phẩm theo mã SKU hoặc tên để thêm vào chương trình…"
          onPick={(p) => add(p.ma, Number((p as any).gia) || p.giaBan || 0)}
        />

        {content.products.length > 0 ? (
          <div className="space-y-3.5 pt-2">
            {/* Thanh công cụ hàng loạt */}
            <BulkTools
              locked={locked}
              update={update}
              facts={facts}
              onNeedFacts={onNeedFacts}
              onAdded={markAdded}
              products={content.products}
              slots={content.slots}
            />

            {/* Thanh lọc & tìm kiếm trong bảng sản phẩm đã thêm (khi có từ 4 sản phẩm) */}
            {content.products.length >= 4 && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <Input
                    prefix={<Search size={13} className="text-slate-400" />}
                    placeholder="Tìm theo mã SKU hoặc tên..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    allowClear
                    className="!h-8 !rounded-lg text-xs bg-white"
                  />
                </div>

                {content.slots.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Filter size={13} className="text-slate-400" />
                    <Select
                      value={slotFilter}
                      onChange={setSlotFilter}
                      className="!w-44 [&_.ant-select-selector]:!h-8 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selection-item]:!leading-[30px] [&_.ant-select-selection-item]:!text-xs"
                      options={[
                        { label: "Tất cả khung giờ", value: "all" },
                        { label: "Cả ngày (toàn chiến dịch)", value: "allDay" },
                        ...content.slots.map((s) => ({
                          label: `Khung ${s.key} (${slotRangeText(s)})`,
                          value: s.key,
                        })),
                      ]}
                    />
                  </div>
                )}

                <div className="text-[11px] text-slate-500 font-medium ml-auto">
                  {isFiltering ? (
                    <span>
                      Khớp <b>{filteredIndices.length}</b> / {content.products.length} SP
                    </span>
                  ) : (
                    <span>Có thể kéo thả để đổi vị trí</span>
                  )}
                </div>
              </div>
            )}

            {/* Tiêu đề bảng cột (Desktop) */}
            <div className="hidden md:grid md:grid-cols-[28px_minmax(180px,1.8fr)_140px_90px_100px_130px_70px] items-center gap-3 px-4 py-2.5 bg-slate-100/90 rounded-xl border border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <span />
              <span>Sản phẩm</span>
              <span title="Thấp hơn giá web = giá sale; cao hơn giá web = giá trước KM (gạch ngang)">Giá sale / gạch (₫)</span>
              <span>% Giảm</span>
              <span>Số lượng sale</span>
              <span className="text-center">Lãi dự kiến</span>
              <span className="text-center">Thao tác</span>
            </div>

            {/* Danh sách sản phẩm */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={isFiltering}>
                <div className="space-y-2">
                  {filteredIndices.map((i) => {
                    const p = content.products[i];
                    return (
                      <ProductRow
                        key={ids[i]}
                        id={ids[i]}
                        row={p}
                        facts={facts[p.ma]}
                        factsByMa={facts}
                        slots={content.slots}
                        locked={locked}
                        serverErrors={fieldErrorsFor(errors, `products.${i}`)}
                        onChange={(row) => setRow(i, row)}
                        onRemove={() =>
                          update((c) => ({ ...c, products: c.products.filter((_, j) => j !== i) }))
                        }
                        onNeedFacts={onNeedFacts}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 mt-3">
            <p className="text-xs text-slate-500 font-medium">
              Chưa có sản phẩm nào. Hãy tìm sản phẩm ở ô phía trên để thêm vào chương trình.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
