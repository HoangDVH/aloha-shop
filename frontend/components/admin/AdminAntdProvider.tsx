"use client";

import type { ReactNode } from "react";
import { ConfigProvider, App as AntdApp } from "antd";
import viVN from "antd/locale/vi_VN";

/** Theme Antd sát mockup sage/ALOHA — chỉ dùng trong AdminShell. */
export function AdminAntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: "#2D5A27",
          colorInfo: "#2D5A27",
          colorSuccess: "#2D5A27",
          colorBgLayout: "#F7F8FA",
          colorBgContainer: "#ffffff",
          borderRadius: 12,
          fontFamily: "inherit",
          fontSize: 13,
        },
        components: {
          Layout: {
            siderBg: "#ffffff",
            bodyBg: "#F7F8FA",
          },
          Menu: {
            itemSelectedBg: "rgba(45, 90, 39, 0.12)",
            itemSelectedColor: "#2D5A27",
          },
          Table: {
            headerBg: "#f3f7f2",
            headerColor: "#334155",
            rowHoverBg: "#f6faf5",
          },
          Card: {
            borderRadiusLG: 14,
          },
          Tabs: {
            inkBarColor: "#2D5A27",
            itemSelectedColor: "#2D5A27",
            itemHoverColor: "#3d7a45",
          },
          Tag: {
            borderRadiusSM: 6,
          },
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
