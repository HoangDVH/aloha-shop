"use client";

import React, { useEffect, useState } from "react";
import { Button, Card, Col, Row, Spin } from "antd";
import { toast } from "@/components/admin/toast";
import { useCtvSettings, usePatchCtvSettings } from "../../ctvQueries";

export function FraudSettingsCard() {
  const { data, isLoading } = useCtvSettings();
  const patchM = usePatchCtvSettings();
  const settings = data?.settings;
  const [threshold, setThreshold] = useState(10);
  const [whitelist, setWhitelist] = useState("123456789, 0123456789");
  const [softWarn, setSoftWarn] = useState(true);

  useEffect(() => {
    if (!settings) return;
    setThreshold(Number(settings.addressMatchMaxHits) || 10);
    setWhitelist(
      Array.isArray(settings.phoneWhitelist)
        ? settings.phoneWhitelist.join(", ")
        : "123456789, 0123456789"
    );
    setSoftWarn(settings.phoneRepeatSoftWarn !== false);
  }, [settings]);

  if (isLoading) return <Spin />;
  return (
    <Card
      bordered={false}
      className="shadow-sm"
      title="Cấu hình chống gian"
      extra={
        <Button
          type="primary"
          loading={patchM.isPending}
          onClick={() => {
            patchM.mutate(
              {
                addressMatchMaxHits: threshold,
                phoneWhitelistText: whitelist,
                phoneRepeatSoftWarn: softWarn,
              },
              {
                onSuccess: () => toast.success("Đã lưu cấu hình chống gian"),
                onError: (e: unknown) => toast.error((e as Error).message),
              }
            );
          }}
        >
          Lưu
        </Button>
      }
    >
      <Row gutter={[16, 12]}>
        <Col xs={24} md={8}>
          <label className="block text-[12px] font-semibold text-slate-600">
            Ngưỡng cảnh báo trùng SĐT / 90 ngày
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 10)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-400">
            Chỉ cảnh báo mềm — không tự khóa hoa hồng (trừ khi tự mua).
          </p>
        </Col>
        <Col xs={24} md={10}>
          <label className="block text-[12px] font-semibold text-slate-600">
            Whitelist SĐT test / nội bộ (cách nhau dấu phẩy)
            <textarea
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </Col>
        <Col xs={24} md={6}>
          <label className="mt-6 flex items-center gap-2 text-[13px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={softWarn}
              onChange={(e) => setSoftWarn(e.target.checked)}
            />
            Bật cảnh báo mềm trùng SĐT
          </label>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            <b>Hard:</b> tự mua (SĐT/địa chỉ/TK trùng CTV) → khóa HH.
            <br />
            <b>Soft:</b> trùng SĐT nhiều → chỉ cảnh báo.
          </p>
        </Col>
      </Row>
    </Card>
  );
}
