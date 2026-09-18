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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-xl font-extrabold text-[#163A2A]">
          Danh sách sản phẩm
        </h1>
        <span className="text-sm text-slate-500">
          {total.toLocaleString("vi-VN")} sản phẩm
        </span>
      </div>

      <Card className="shadow-sm">
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
          className="max-w-md"
        />
      </Card>

      <Card
        className="overflow-hidden shadow-sm"
        styles={{ body: { padding: 0 } }}
      >
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
      </Card>
    </div>
  );
}
