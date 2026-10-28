"use client";

import { useEffect, useRef, useState } from "react";
import { App, Modal, Input, Button, Tag, Spin, Tooltip, Select } from "antd";
import {
  Zap,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  Minus,
  CheckCircle2,
  Printer,
  ShoppingBag,
  User,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { siRequest } from "@/lib/siQueries";
import { QuickOrderVisualMatchSection } from "./QuickOrderVisualMatchSection";
import type {
  ParsedCustomer,
  QuickOrderItem,
  QuickOrderCandidate,
  QuickOrderVisualAnalysis,
  ParseApiResponse,
  CreateApiResponse,
} from "./quickOrderModalTypes";

export function QuickOrderModal({
  open,
  onClose,
  onOrderCreated,
}: {
  open: boolean;
  onClose: () => void;
  onOrderCreated?: (orderCode: string) => void;
}) {
  const { message } = App.useApp();

  // State nhập liệu ban đầu
  const [rawText, setRawText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // State sau khi bóc tách (Review)
  const [step, setStep] = useState<"input" | "review" | "success">("input");
  const [customer, setCustomer] = useState<ParsedCustomer>({
    name: "",
    phone: "",
    address: "",
    province: "",
    district: "",
    ward: "",
    street: "",
  });
  const [items, setItems] = useState<QuickOrderItem[]>([]);
  const [candidates, setCandidates] = useState<QuickOrderCandidate[]>([]);
  const [visualAnalysis, setVisualAnalysis] = useState<QuickOrderVisualAnalysis | null>(null);
  const [unmatchedItems, setUnmatchedItems] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Transfer">("Cash");

  // State tìm kiếm thêm sản phẩm
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<QuickOrderItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // State tạo đơn
  const [isCreating, setIsCreating] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreateApiResponse | null>(null);

  // Lắng nghe phím tắt Ctrl+V để dán ảnh trực tiếp từ clipboard
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              if (result) {
                const base64 = result.split(",")[1];
                setImageBase64(base64);
                setImagePreview(result);
                message.success("Đã dán ảnh từ clipboard!");
              }
            };
            reader.readAsDataURL(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open, message]);

  // Reset form
  const handleReset = () => {
    setRawText("");
    setImageBase64(null);
    setImagePreview(null);
    setStep("input");
    setCustomer({ name: "", phone: "", address: "", province: "", district: "", ward: "", street: "" });
    setItems([]);
    setCandidates([]);
    setVisualAnalysis(null);
    setUnmatchedItems([]);
    setNote("");
    setShippingFee(0);
    setDiscount(0);
    setCreatedOrder(null);
  };

  // Dán nội dung mẫu để test nhanh
  const fillSample = () => {
    setRawText(
      "Gửi chị Huỳnh Như - 0909123456, 2 chậu đá mài chữ nhật 60x20x20 màu xám với 1 bao đất dinh dưỡng 5kg. Giao về số 45 Đường số 7, P. Linh Trung, TP. Thủ Đức, HCM giùm chị nhé, ship COD nha."
    );
  };

  // Gọi API bóc tách AI
  const handleParse = async () => {
    if (!rawText.trim() && !imageBase64) {
      message.warning("Vui lòng nhập đoạn tin nhắn hoặc dán ảnh đơn hàng!");
      return;
    }

    setIsParsing(true);
    try {
      const res = await siRequest<ParseApiResponse>("/api/shop/admin/quick-order/parse", {
        text: rawText.trim(),
        imageBase64: imageBase64 || undefined,
        imageMime: "image/jpeg",
      });

      if (res?.ok && res.data) {
        setCustomer(res.data.customer);
        setItems(res.data.items);
        setCandidates(res.data.candidates || []);
        setVisualAnalysis(res.data.visualAnalysis || null);
        setUnmatchedItems(res.data.unmatchedItems || []);
        setNote(res.data.note || "");
        setStep("review");
        message.success("Bóc tách thông tin thành công!");
      } else {
        message.error("Không thể bóc tách thông tin từ nội dung này");
      }
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi phân tích bằng AI");
    } finally {
      setIsParsing(false);
    }
  };

  // Tìm kiếm sản phẩm thêm vào đơn
  const handleSearchProduct = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await siRequest<{ ok: boolean; data: QuickOrderItem[] }>(
        `/api/shop/admin/quick-order/search-products?q=${encodeURIComponent(q.trim())}`
      );
      if (res?.ok) {
        setSearchResults(res.data || []);
      }
    } catch {
      /* ignore */
    } finally {
      setIsSearching(false);
    }
  };

  const addItem = (item: QuickOrderItem) => {
    const existing = items.find((it) => it.productCode === item.productCode);
    if (existing) {
      setItems(
        items.map((it) =>
          it.productCode === item.productCode ? { ...it, quantity: it.quantity + 1 } : it
        )
      );
    } else {
      setItems([...items, { ...item, quantity: 1 }]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const removeItem = (code: string) => {
    setItems(items.filter((it) => it.productCode !== code));
  };

  const updateItemQty = (code: string, delta: number) => {
    setItems(
      items
        .map((it) => {
          if (it.productCode === code) {
            const next = it.quantity + delta;
            return next > 0 ? { ...it, quantity: next } : null;
          }
          return it;
        })
        .filter(Boolean) as QuickOrderItem[]
    );
  };

  const updateItemPrice = (code: string, newPrice: number) => {
    setItems(
      items.map((it) =>
        it.productCode === code ? { ...it, price: Math.max(0, newPrice) } : it
      )
    );
  };

  // Tính toán số tiền
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const grandTotal = Math.max(0, subtotal + shippingFee - discount);

  // Tạo đơn và đẩy KiotViet
  const handleCreateOrder = async () => {
    if (!customer.name.trim()) {
      message.warning("Vui lòng nhập họ tên người nhận");
      return;
    }
    if (!customer.phone.trim()) {
      message.warning("Vui lòng nhập số điện thoại người nhận");
      return;
    }
    if (!items.length) {
      message.warning("Đơn hàng phải có ít nhất 1 sản phẩm");
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        address: customer.address || [customer.street, customer.ward, customer.district, customer.province].filter(Boolean).join(", "),
        province: customer.province,
        district: customer.district,
        ward: customer.ward,
        ghnDistrictId: customer.ghnDistrictId,
        ghnWardCode: customer.ghnWardCode,
        items: items.map((it) => ({
          productCode: it.productCode,
          productName: it.productName,
          quantity: it.quantity,
          price: it.price,
        })),
        paymentMethod,
        shippingFee,
        discount,
        note,
      };

      const res = await siRequest<CreateApiResponse>("/api/shop/admin/quick-order/create", payload);
      if (res?.ok) {
        setCreatedOrder(res);
        setStep("success");
        message.success("Tạo đơn hàng & Đẩy KiotViet thành công!");
        onOrderCreated?.(res.orderCode);
      } else {
        message.error("Lỗi tạo đơn hàng");
      }
    } catch (err: any) {
      message.error(err?.message || "Lỗi tạo đơn hàng");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        handleReset();
        onClose();
      }}
      footer={null}
      width={step === "review" ? 850 : 640}
      centered
      destroyOnClose
      className="quick-order-modal"
    >
      {/* HEADER */}
      <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#2D5A27] flex items-center justify-center font-bold">
            <Zap size={20} className="fill-[#2D5A27]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              Tạo đơn nhanh từ Tin nhắn & Ảnh
              <Tag color="green" className="text-[10px] font-semibold border-0 px-2 py-0.5 rounded-full">
                Giá Web
              </Tag>
            </h3>
            <p className="text-xs text-slate-500">
              Bóc tách tự động bằng AI, tự khớp 2,144 sản phẩm & đẩy thẳng KiotViet
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: NHẬP TIN NHẮN / DÁN ẢNH */}
      {step === "input" && (
        <div className="space-y-4">
          <div className="relative">
            <Input.TextArea
              rows={6}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Dán toàn bộ tin nhắn chat từ Zalo, Messenger, SMS... (Ví dụ: Chị Lan 0912345678 lấy 2 chậu đá mài 60x20x20 xám ship về 123 Lê Lợi Q1 HCM...)"
              className="rounded-xl border-slate-200 text-sm p-3 font-normal"
            />
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
              <Button
                size="small"
                type="text"
                onClick={fillSample}
                className="text-[11px] text-slate-500 hover:text-[#2D5A27]"
              >
                Dán tin nhắn mẫu
              </Button>
            </div>
          </div>

          {/* VÙNG DÁN ẢNH HOẶC KÉO THẢ */}
          <div className="p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                <ImageIcon size={20} />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-slate-700">Dán ảnh màn hình / bill nháp</div>
                <div className="text-slate-400 text-[11px]">
                  Bấm <kbd className="px-1.5 py-0.5 bg-slate-200 rounded font-mono text-[10px]">Ctrl + V</kbd> bất kỳ đâu để dán ảnh
                </div>
              </div>
            </div>

            {imagePreview ? (
              <div className="flex items-center gap-2">
                <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                <Button
                  size="small"
                  danger
                  type="text"
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    setImageBase64(null);
                    setImagePreview(null);
                  }}
                />
              </div>
            ) : null}
          </div>

          {/* NÚT BẮT ĐẦU PHÂN TÍCH */}
          <div className="pt-2 flex justify-end gap-2">
            <Button onClick={onClose} className="rounded-xl h-9 text-xs">
              Hủy
            </Button>
            <Button
              type="primary"
              loading={isParsing}
              onClick={handleParse}
              icon={<Sparkles size={15} />}
              className="rounded-xl h-9 text-xs font-semibold bg-[#2D5A27] hover:bg-[#23471f] text-white flex items-center"
            >
              {isParsing ? "Đang phân tích..." : "Phân tích bằng AI"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW & CHỈNH SỬA & ĐẨY KIOTVIET */}
      {step === "review" && (
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* THÔNG TIN KHÁCH HÀNG */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} className="text-[#2D5A27]" />
              Thông tin người nhận
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Tên người nhận *</label>
                <Input
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Họ tên khách"
                  className="rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Số điện thoại *</label>
                <Input
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="0901234567"
                  className="rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Địa chỉ giao hàng đầy đủ *</label>
              <Input
                value={customer.address}
                onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành"
                className="rounded-lg text-xs"
              />
            </div>
          </div>

          {/* PHÂN TÍCH HÌNH ẢNH & GỢI Ý MẪU TƯƠNG ĐỒNG */}
          <QuickOrderVisualMatchSection
            imagePreview={imagePreview}
            visualAnalysis={visualAnalysis}
            candidates={candidates}
            items={items}
            onSelectCandidate={(c) => {
              setItems([
                {
                  productCode: c.productCode,
                  productName: c.productName,
                  quantity: 1,
                  price: c.price,
                  originalPrice: c.originalPrice,
                  stock: c.stock,
                  imageUrl: c.imageUrl,
                },
              ]);
              message.success(`Đã chọn: ${c.productName}`);
            }}
          />

          {/* DANH SÁCH SẢN PHẨM KHỚP ĐƯỢC */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-[#2D5A27]" />
                Sản phẩm đặt mua ({items.length})
              </div>
              <Tag color="cyan" className="text-[10px] m-0">
                Đơn giá mặc định là Giá Web
              </Tag>
            </div>

            {items.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-slate-100">
                Chưa có sản phẩm nào. Hãy tìm và chọn sản phẩm bên dưới.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 bg-white rounded-lg border border-slate-200 overflow-hidden">
                {items.map((it) => (
                  <div key={it.productCode} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt="" className="w-10 h-10 object-cover rounded-md border border-slate-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <ShoppingBag size={16} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{it.productName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span className="font-mono text-slate-600">{it.productCode}</span>
                          <span>•</span>
                          <span className={it.stock > 0 ? "text-emerald-600" : "text-amber-600 font-medium"}>
                            Tồn: {it.stock}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SỐ LƯỢNG */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateItemQty(it.productCode, -1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-200 rounded"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-7 text-center font-bold text-xs">{it.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateItemQty(it.productCode, 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-200 rounded"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* ĐƠN GIÁ (INLINE EDIT) */}
                    <div className="w-24 text-right shrink-0">
                      <Input
                        size="small"
                        value={it.price}
                        onChange={(e) => updateItemPrice(it.productCode, Number(e.target.value) || 0)}
                        className="text-right text-xs font-semibold text-slate-700 rounded"
                      />
                      <div className="text-[10px] text-slate-400">Giá Web</div>
                    </div>

                    {/* THÀNH TIỀN & XÓA */}
                    <div className="text-right w-24 shrink-0">
                      <div className="font-bold text-slate-800">
                        {(it.price * it.quantity).toLocaleString("vi-VN")} ₫
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(it.productCode)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* TÌM KIẾM THÊM SẢN PHẨM KHÁC */}
            <div className="relative pt-1">
              <Input
                placeholder="+ Thêm sản phẩm khác từ kho 2,144 mã (gõ tên hoặc mã SKU)..."
                value={searchQuery}
                onChange={(e) => handleSearchProduct(e.target.value)}
                className="rounded-lg text-xs"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-lg z-50 divide-y divide-slate-100">
                  {searchResults.map((p) => (
                    <div
                      key={p.productCode}
                      onClick={() => addItem(p)}
                      className="p-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{p.productName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.productCode}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600">{p.price.toLocaleString("vi-VN")} ₫</div>
                        <div className="text-[10px] text-slate-400">Tồn: {p.stock}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CẢNH BÁO MÓN CHƯA KHỚP */}
            {unmatchedItems.length > 0 && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Món khách dặn chưa khớp tự động: </span>
                  {unmatchedItems.join(", ")}. Hãy dùng ô tìm kiếm trên để thêm vào.
                </div>
              </div>
            )}
          </div>

          {/* TỔNG KẾT & PHÍ SHIP & THANH TOÁN */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Hình thức thanh toán</label>
                <Select
                  value={paymentMethod}
                  onChange={(val) => setPaymentMethod(val)}
                  className="w-full text-xs"
                  options={[
                    { value: "Cash", label: "💵 Thu tiền khi nhận hàng (COD)" },
                    { value: "Transfer", label: "🏦 Chuyển khoản (VietQR / KiotQR)" },
                  ]}
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Phí vận chuyển (₫)</label>
                <Input
                  type="number"
                  value={shippingFee}
                  onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">Ghi chú giao hàng</label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi đến..."
                className="rounded-lg text-xs"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Tạm tính: <strong className="text-slate-700">{subtotal.toLocaleString("vi-VN")} ₫</strong>
                {shippingFee > 0 && <span> + Ship: {shippingFee.toLocaleString("vi-VN")} ₫</span>}
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 mr-2">Tổng thanh toán:</span>
                <span className="text-lg font-extrabold text-[#2D5A27]">
                  {grandTotal.toLocaleString("vi-VN")} ₫
                </span>
              </div>
            </div>
          </div>

          {/* NÚT THAO TÁC FOOTER */}
          <div className="pt-2 flex items-center justify-between gap-2">
            <Button
              type="text"
              onClick={() => setStep("input")}
              icon={<RotateCcw size={14} />}
              className="text-xs text-slate-500"
            >
              Quay lại tin nhắn
            </Button>

            <div className="flex items-center gap-2">
              <Button onClick={onClose} className="rounded-xl h-9 text-xs">
                Hủy
              </Button>
              <Button
                type="primary"
                loading={isCreating}
                onClick={handleCreateOrder}
                icon={<Zap size={15} className="fill-current" />}
                className="rounded-xl h-9 text-xs font-semibold bg-[#2D5A27] hover:bg-[#23471f] text-white flex items-center"
              >
                {isCreating ? "Đang tạo đơn & Đẩy KiotViet..." : "Tạo đơn & Đẩy KiotViet"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS BANNER */}
      {step === "success" && createdOrder && (
        <div className="py-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#2D5A27] flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-800">Tạo đơn hàng thành công!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Đơn hàng đã được lưu vào hệ thống và đồng bộ trực tiếp sang KiotViet.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm mx-auto text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Mã đơn Shop:</span>
              <span className="font-mono font-bold text-slate-800">{createdOrder.orderCode}</span>
            </div>
            {createdOrder.kvOrderCode ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Mã KiotViet:</span>
                <span className="font-mono font-bold text-[#2D5A27]">{createdOrder.kvOrderCode}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500">Tổng tiền:</span>
              <span className="font-bold text-slate-800">{createdOrder.total.toLocaleString("vi-VN")} ₫</span>
            </div>
          </div>

          <div className="pt-4 flex justify-center gap-3">
            <Button
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="rounded-xl h-9 text-xs"
            >
              Đóng
            </Button>
            <Button
              type="primary"
              onClick={handleReset}
              className="rounded-xl h-9 text-xs font-semibold bg-[#2D5A27] hover:bg-[#23471f] text-white"
            >
              + Tạo tiếp đơn khác
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
