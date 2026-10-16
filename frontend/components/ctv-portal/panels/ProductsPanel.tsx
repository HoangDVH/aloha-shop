"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Avatar, Button, Card, Input, Table, Tag } from "antd";
import { Link2 } from "lucide-react";
import { useShopAuth } from "@/components/ShopAuthProvider";
import { buildProductShareUrl } from "@/lib/ctv";
import { useCtvCatalogProducts } from "../ctvPortalQueries";
import { formatVnd } from "../shared/format";

type ProductRow = {
  key: string;
  ma: string;
  name: string;
  imageUrl: string;
  giaWeb: number;
  status: string;
  path: string;
  ton?: number;
};

const PAGE_SIZE = 24;

export function ProductsPanel() {
  const { message } = App.useApp();
  const { user } = useShopAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const catalogQ = useCtvCatalogProducts({
    q: debouncedQ,
    page,
    limit: PAGE_SIZE,
  });

  const rows: ProductRow[] = useMemo(() => {
    const items = catalogQ.data?.items || [];
    return items.map((p) => ({
      key: p.ma,
      ma: p.ma,
      name: p.ten,
      imageUrl: p.anh || p.images?.[0] || "",
      giaWeb: Number(p.gia) || 0,
      status: p.isActive === false ? "Ngừng bán" : "Đang bán",
      path: p.path || `/sp/${encodeURIComponent(p.ma)}`,
      ton: Number(p.ton) || 0,
    }));
  }, [catalogQ.data]);

  const total = catalogQ.data?.total || 0;

  async function copyLink(row: ProductRow) {
    const code = user?.ctvCode || "";
    const url = buildProductShareUrl(row.path || `/sp/${row.ma}`, code, row.ma);
    try {
      await navigator.clipboard.writeText(url);
      message.success(`Đã copy link · CTV ${code}`);
    } catch {
      message.error("Không copy được link");
    }
  }

  return (
    <div className="ctv-page-flow flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">
            Danh sách sản phẩm
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Lấy link tiếp thị liên kết và chia sẻ sản phẩm nhận hoa hồng
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        {/* Thanh công cụ tìm kiếm */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4 sm:px-5">
          <Input.Search
            allowClear
            placeholder="Tìm tên sản phẩm, mã sản phẩm..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={(v) => {
              setSearchInput(v);
              setDebouncedQ(v.trim());
              setPage(1);
            }}
            enterButton="Tìm"
            className="w-full sm:max-w-md"
          />
          <span className="text-xs font-medium text-slate-500">
            Tìm thấy <span className="font-bold text-[#163A2A]">{total.toLocaleString("vi-VN")}</span> sản phẩm
          </span>
        </div>

        <Table
          loading={catalogQ.isFetching}
          rowKey="key"
          dataSource={rows}
          locale={{
            emptyText: debouncedQ
              ? `Không có sản phẩm khớp «${debouncedQ}»`
              : "Chưa có sản phẩm",
          }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            showTotal: (t) => `${t.toLocaleString("vi-VN")} sản phẩm`,
          }}
          scroll={{ x: 900 }}
          columns={[
            {
              title: "#",
              width: 56,
              render: (_: unknown, __: ProductRow, i: number) =>
                (page - 1) * PAGE_SIZE + i + 1,
            },
            {
              title: "Ảnh",
              width: 72,
              render: (_: unknown, r: ProductRow) =>
                r.imageUrl ? (
                  <Avatar src={r.imageUrl} shape="square" size={44} />
                ) : (
                  <Avatar shape="square" size={44}>
                    ?
                  </Avatar>
                ),
            },
            {
              title: "Tên sản phẩm",
              dataIndex: "name",
              render: (v: string, r: ProductRow) => (
                <div>
                  <div className="font-semibold text-[#163A2A]">{v}</div>
                  <div className="text-[11px] text-slate-500">{r.ma}</div>
                </div>
              ),
            },
            {
              title: "Giá bán",
              dataIndex: "giaWeb",
              align: "right",
              render: (v: number) => (v > 0 ? formatVnd(v) : "—"),
            },
            {
              title: "Trạng thái",
              dataIndex: "status",
              render: (v: string) => (
                <Tag color={v === "Đang bán" ? "green" : "default"}>{v}</Tag>
              ),
            },
            {
              title: "Lấy link",
              key: "link",
              width: 120,
              render: (_: unknown, r: ProductRow) => (
                <Button
                  type="primary"
                  size="small"
                  icon={<Link2 className="h-3.5 w-3.5" />}
                  onClick={() => void copyLink(r)}
                >
                  Copy
                </Button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
