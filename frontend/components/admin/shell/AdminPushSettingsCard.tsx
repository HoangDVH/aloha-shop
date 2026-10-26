"use client";

import { useEffect, useState } from "react";
import { Button, Switch } from "antd";
import { toast } from "sonner";
import { BellRing, CheckCircle2, AlertCircle, Send, Smartphone } from "lucide-react";
import {
  isWebPushSupported,
  getWebPushSubscription,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  sendTestWebPush,
} from "./adminWebPush";

export function AdminPushSettingsCard() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const isSup = isWebPushSupported();
    setSupported(isSup);
    if (!isSup) return;

    void getWebPushSubscription().then((sub) => {
      setSubscribed(!!sub);
    });
  }, []);

  const handleToggle = async (checked: boolean) => {
    setLoading(true);
    try {
      if (checked) {
        const res = await subscribeToWebPush();
        if (res.ok) {
          setSubscribed(true);
          toast.success("Đã bật thông báo đẩy Web Push!", {
            description: "Bạn sẽ nhận được thông báo ngay cả khi đóng trình duyệt hoặc khoá màn hình.",
          });
        } else {
          toast.error("Không thể bật thông báo đẩy", {
            description: res.error,
          });
        }
      } else {
        const res = await unsubscribeFromWebPush();
        if (res.ok) {
          setSubscribed(false);
          toast.info("Đã tắt thông báo đẩy trên thiết bị này.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await sendTestWebPush();
      if (res.ok) {
        toast.success("Đã phát lệnh thông báo test!", {
          description: "Hãy quan sát màn hình hoặc khay thông báo trên thiết bị của bạn.",
        });
      } else {
        toast.error("Lỗi khi gửi thông báo test", {
          description: res.message,
        });
      }
    } finally {
      setTesting(false);
    }
  };

  if (!supported) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Thiết bị hoặc trình duyệt không hỗ trợ Web Push</span>
        </div>
        <p className="mt-1 text-amber-700 leading-relaxed">
          Trên iPhone, vui lòng dùng <strong>Safari</strong> và chọn <strong>"Thêm vào MH chính"</strong> (yêu cầu iOS 16.4 trở lên).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#2D5A27]">
            <BellRing className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">
                Thông báo đẩy Web Push
              </h4>
              {subscribed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" />
                  Đang hoạt động
                </span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  Chưa bật
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Nhận thông báo đơn mới ngay cả khi <strong>đã đóng trình duyệt</strong> hoặc <strong>khoá màn hình điện thoại</strong>.
            </p>
          </div>
        </div>
        <Switch
          checked={subscribed}
          loading={loading}
          onChange={handleToggle}
          className="shrink-0"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-100/80 pt-2.5">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Smartphone className="h-3.5 w-3.5 text-slate-400" />
          <span>Hỗ trợ cả máy tính Windows/Mac & iPhone (iOS 16.4+)</span>
        </div>
        {subscribed && (
          <Button
            size="small"
            icon={<Send className="h-3 w-3" />}
            onClick={handleTest}
            loading={testing}
            className="text-xs font-semibold text-emerald-800 border-emerald-300 hover:bg-emerald-100/70"
          >
            Gửi thông báo test
          </Button>
        )}
      </div>
    </div>
  );
}
