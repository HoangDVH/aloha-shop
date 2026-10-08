"use client";

import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  message,
  Popconfirm,
  Tag,
} from "antd";
import { Plus, Edit2, Trash2, Image as ImageIcon, UploadCloud, RefreshCw, Sparkles } from "lucide-react";
import { GiftProductPicker } from "./GiftProductPicker";
import { GiftImageLibrary } from "./GiftImageLibrary";

interface GiftItem {
  _id?: string;
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  recipientType: string;
  image: string;
  quote: string;
  includedItems: string;
  linkedProductCodes: string[];
  order: number;
  isActive: boolean;
}

const RECIPIENT_OPTIONS = [
  { value: "nguoi-thuong", label: "🌸 Dành Cho Nàng / Người Thương (20/10)" },
  { value: "gia-dinh", label: "🏡 Quà Tặng Gia Đình & Mẹ" },
  { value: "khai-truong", label: "🏢 Quà Khai Trương & Thăng Chức" },
  { value: "ban-lam-viec", label: "🌿 Quà Bàn Làm Việc & Đồng Nghiệp" },
  { value: "doanh-nghiep", label: "💼 Quà Tặng Doanh Nghiệp (B2B)" },
];

export function ShopGiftsAdmin() {
  const [items, setItems] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<GiftItem | null>(null);
  const [form] = Form.useForm();

  // State quản lý ảnh
  const [imagePreview, setImagePreview] = useState<string>("");
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shop/admin/gifts");
      const json = await res.json();
      if (json.ok) {
        setItems(json.data || []);
      } else {
        message.error(json.error || "Không thể tải danh sách quà tặng");
      }
    } catch {
      message.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setImagePreview("");
    form.setFieldsValue({
      order: (items.length + 1),
      isActive: true,
      recipientType: "nguoi-thuong",
      includedItems: "Chậu gốm + Nơ ruy băng + Thiệp viết tay + Túi quai trong",
      tag: "Gợi ý chọn quà",
      linkedProductCodes: [],
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item: GiftItem) => {
    setEditingItem(item);
    form.resetFields();
    form.setFieldsValue({
      slug: item.slug,
      title: item.title,
      subtitle: item.subtitle,
      tag: item.tag,
      recipientType: item.recipientType,
      image: item.image,
      quote: item.quote,
      includedItems: item.includedItems,
      linkedProductCodes: item.linkedProductCodes || [],
      order: item.order,
      isActive: item.isActive,
    });
    setImagePreview(item.image);
    setModalOpen(true);
  };

  const handleDelete = async (item: GiftItem) => {
    try {
      const targetId = item._id || item.slug;
      const res = await fetch(`/api/shop/admin/gifts/${targetId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        message.success("Đã xóa thẻ quà tặng");
        fetchItems();
      } else {
        message.error(json.error || "Không thể xóa");
      }
    } catch {
      message.error("Lỗi kết nối khi xóa");
    }
  };

  // Upload file từ máy tính
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      message.error("File quá lớn! Vui lòng chọn ảnh dưới 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const hide = message.loading("Đang tải ảnh lên máy chủ...", 0);
      try {
        const res = await fetch("/api/shop/admin/gifts/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, base64Data }),
        });
        const json = await res.json();
        hide();
        if (json.ok && json.url) {
          form.setFieldValue("image", json.url);
          setImagePreview(json.url);
          message.success("Tải ảnh từ máy lên thành công!");
        } else {
          message.error(json.error || "Tải ảnh thất bại");
        }
      } catch {
        hide();
        message.error("Lỗi mạng khi tải ảnh");
      }
    };
    reader.readAsDataURL(file);
  };

  // Chọn ảnh có sẵn từ Aloha
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let res: Response;
      if (editingItem) {
        const targetId = editingItem._id || editingItem.slug;
        res = await fetch(`/api/shop/admin/gifts/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
      } else {
        res = await fetch("/api/shop/admin/gifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
      }
      const json = await res.json();
      if (json.ok) {
        message.success(editingItem ? "Cập nhật thành công!" : "Tạo mới thành công!");
        setModalOpen(false);
        fetchItems();
      } else {
        message.error(json.error || "Không thể lưu quà tặng");
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "errorFields" in error)) {
        message.error("Không thể lưu. Vui lòng kiểm tra kết nối và thử lại.");
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: "Ảnh",
      dataIndex: "image",
      key: "image",
      width: 85,
      render: (img: string) => (
        <div className="h-14 w-14 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="h-full w-full object-cover" />
        </div>
      ),
    },
    {
      title: "Tiêu đề & Nhóm đối tượng",
      key: "title",
      render: (_: any, r: GiftItem) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-900">{r.title}</span>
            <Tag color="cyan">{r.tag}</Tag>
          </div>
          <p className="mt-0.5 text-xs text-stone-500 italic line-clamp-1">{r.subtitle}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
            <span>Slug: <strong className="text-emerald-700">/qua-tang/{r.slug}</strong></span>
            <span>·</span>
            <span>Đối tượng: {r.recipientType}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Sản phẩm",
      key: "products",
      width: 135,
      render: (_: unknown, r: GiftItem) => (
        <Button size="small" onClick={() => handleOpenEdit(r)}>
          {r.linkedProductCodes?.length || 0} sản phẩm
        </Button>
      ),
    },
    {
      title: "Thứ tự",
      dataIndex: "order",
      key: "order",
      width: 80,
      align: "center" as const,
      render: (o: number) => <Tag color="blue">{o}</Tag>,
    },
    {
      title: "Hiển thị",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
      render: (active: boolean, r: GiftItem) => (
        <Switch
          checked={active}
          onChange={async (checked) => {
            const targetId = r._id || r.slug;
            await fetch(`/api/shop/admin/gifts/${targetId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: checked }),
            });
            fetchItems();
          }}
        />
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 120,
      render: (_: any, r: GiftItem) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<Edit2 size={15} className="text-stone-600" />}
            onClick={() => handleOpenEdit(r)}
          />
          <Popconfirm
            title="Xóa thẻ quà tặng này?"
            description="Bạn có chắc chắn muốn xóa? Thao tác này không thể hoàn tác."
            onConfirm={() => handleDelete(r)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<Trash2 size={15} />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Thanh công cụ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <span>Quản Lý Thẻ Quà Tặng (Gift Concierge Hub)</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Tùy biến các thẻ quà tặng hiển thị ngoài trang chủ và trang đích chuyên đề cho từng đối tượng.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button icon={<RefreshCw size={14} />} onClick={fetchItems} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={15} />}
            onClick={handleOpenAdd}
            className="!bg-[#0E5242] hover:!bg-[#156e59]"
          >
            Thêm thẻ quà tặng
          </Button>
        </div>
      </div>

      {/* Bảng dữ liệu */}
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-2xs">
        <Table
          rowKey={(r) => r._id || r.slug}
          dataSource={items}
          columns={columns}
          loading={loading}
          pagination={false}
        />
      </div>

      {/* Modal Thêm / Sửa Thẻ Quà Tặng */}
      <Modal
        title={editingItem ? "Chỉnh sửa thẻ quà tặng" : "Thêm mới thẻ quà tặng"}
        zIndex={1000}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Lưu thông tin"
        cancelText="Đóng"
        width={720}
        confirmLoading={saving}
        destroyOnHidden
        okButtonProps={{ className: "!bg-[#0E5242] hover:!bg-[#156e59]" }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="title"
              label="Tiêu đề chính"
              rules={[{ required: true, message: "Vui lòng nhập tiêu đề" }]}
            >
              <Input placeholder="VD: Chậu Cây Màu Hồng Dành Cho Nàng" />
            </Form.Item>

            <Form.Item
              name="slug"
              label="Đường dẫn tĩnh (Slug URL)"
              rules={[{ required: true, message: "Vui lòng nhập slug" }]}
            >
              <Input placeholder="VD: nguoi-thuong (sẽ tạo link /qua-tang/nguoi-thuong)" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Form.Item name="recipientType" label="Nhóm đối tượng">
              <Select options={RECIPIENT_OPTIONS} />
            </Form.Item>

            <Form.Item name="tag" label="Tag nổi bật (Góc ảnh)">
              <Input placeholder="VD: 20/10, Khai trương, Best-seller" />
            </Form.Item>

            <Form.Item name="order" label="Thứ tự hiển thị">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
          </div>

          <Form.Item name="subtitle" label="Lời tựa ngắn (Gợi cảm xúc)">
            <Input placeholder="VD: Gửi chút ngọt ngào và năng lượng tích cực đến người phụ nữ bạn thương." />
          </Form.Item>

          <Form.Item name="quote" label="Trích dẫn cảm xúc (Hiển thị chi tiết)">
            <Input.TextArea
              rows={2}
              placeholder="VD: Có những món quà không cần nói thay quá nhiều điều..."
            />
          </Form.Item>

          <Form.Item name="includedItems" label="Chi tiết đóng gói quà kèm theo">
            <Input placeholder="VD: Chậu gốm + Nơ ruy băng + Thiệp viết tay + Túi quai trong" />
          </Form.Item>

          <Form.Item name="linkedProductCodes" label="Sản phẩm hiển thị trong hạng mục quà tặng">
            <GiftProductPicker />
          </Form.Item>

          {/* KHU VỰC QUẢN LÝ ẢNH (2 TÙY CHỌN: TẢI TỪ MÁY HOẶC CHỌN ẢNH CÓ SẴN CỦA ALOHA) */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 mb-4">
            <span className="block text-xs font-bold text-stone-800 uppercase tracking-wide mb-2">
              🖼️ Ảnh Thẻ Quà Tặng (Chọn từ máy tính HOẶC lấy ảnh có sẵn của shop)
            </span>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              {/* Preview ảnh hiện tại */}
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-stone-300 bg-white shadow-2xs">
                {imagePreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview("");
                        form.setFieldValue("image", "");
                      }}
                      className="absolute top-1 right-1 rounded-full bg-rose-600 p-1 text-white shadow-xs hover:bg-rose-700"
                      title="Xóa ảnh này"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-stone-400">
                    <ImageIcon size={24} />
                    <span className="text-[10px] mt-1">Chưa có ảnh</span>
                  </div>
                )}
              </div>

              {/* 2 Nút lựa chọn */}
              <div className="flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Lựa chọn 1: Tải từ máy */}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50">
                    <UploadCloud size={14} className="text-emerald-700" />
                    <span>Tải ảnh từ máy tính</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>

                  {/* Lựa chọn 2: Chọn từ thư viện cây Aloha */}
                  <Button
                    icon={<ImageIcon size={14} className="text-amber-600" />}
                    onClick={() => {
                      setLibraryModalOpen(true);
                    }}
                    className="text-xs font-semibold"
                  >
                    Chọn ảnh cây thật của Aloha
                  </Button>
                </div>

                <Form.Item
                  name="image"
                  noStyle
                  rules={[{ required: true, message: "Vui lòng chọn hoặc tải ảnh lên" }]}
                >
                  <Input
                    placeholder="Đường dẫn ảnh (/banners/... hoặc https://...)"
                    value={imagePreview}
                    onChange={(e) => {
                      setImagePreview(e.target.value);
                      form.setFieldValue("image", e.target.value);
                    }}
                    className="text-xs text-stone-600 font-mono"
                  />
                </Form.Item>
                <p className="text-[11px] text-stone-500">
                  Hệ thống tự động canh chỉnh tỉ lệ 4:3 đẹp mắt, bảo toàn tính thẩm mỹ.
                </p>
              </div>
            </div>
          </div>

          <Form.Item name="isActive" label="Bật hiển thị thẻ này trên website" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <GiftImageLibrary
        open={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        onSelect={(image) => {
          form.setFieldValue("image", image);
          setImagePreview(image);
          setLibraryModalOpen(false);
        }}
      />
    </div>
  );
}
