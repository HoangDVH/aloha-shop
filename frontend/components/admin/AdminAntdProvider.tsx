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
          Input: {
            controlHeight: 42,
            controlHeightSM: 36,
            borderRadius: 10,
            borderRadiusSM: 8,
            colorBorder: "#CBD5E1",
            hoverBorderColor: "#64748B",
            activeBorderColor: "#2D5A27",
            activeShadow: "0 0 0 3px rgba(45, 90, 39, 0.12)",
            paddingInline: 14,
            paddingInlineSM: 10,
          },
          InputNumber: {
            controlHeight: 42,
            controlHeightSM: 36,
            borderRadius: 10,
            borderRadiusSM: 8,
            colorBorder: "#CBD5E1",
            hoverBorderColor: "#64748B",
            activeBorderColor: "#2D5A27",
            activeShadow: "0 0 0 3px rgba(45, 90, 39, 0.12)",
            paddingInline: 12,
            paddingInlineSM: 10,
          },
          DatePicker: {
            controlHeight: 42,
            borderRadius: 10,
            colorBorder: "#E2E8F0",
            hoverBorderColor: "#94A3B8",
            activeBorderColor: "#2D5A27",
            activeShadow: "0 0 0 3px rgba(45, 90, 39, 0.12)",
          },
          Select: {
            controlHeight: 42,
            borderRadius: 10,
            colorBorder: "#E2E8F0",
            hoverBorderColor: "#94A3B8",
            activeBorderColor: "#2D5A27",
          },
          Button: {
            borderRadius: 10,
            borderRadiusSM: 8,
            controlHeight: 40,
            controlHeightSM: 36,
          },
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
          Radio: {
            colorPrimary: "#2D5A27",
          },
          Checkbox: {
            colorPrimary: "#2D5A27",
          },
          Switch: {
            colorPrimary: "#2D5A27",
          },
          Pagination: {
            itemActiveBg: "rgba(45, 90, 39, 0.1)",
            colorPrimary: "#2D5A27",
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
