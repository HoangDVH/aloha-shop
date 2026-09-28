"use client";

import React from "react";
import type { AppearanceLayout } from "../../api";
import { WbField, WbSectionLabel, wbInput } from "../../ui";

export function FooterPanel({
  draft,
  setDraft,
}: {
  draft: AppearanceLayout;
  setDraft: React.Dispatch<React.SetStateAction<AppearanceLayout | null>>;
}) {
  return (
    <div className="space-y-3">
      <WbSectionLabel>Thông tin liên hệ</WbSectionLabel>
      {(
        [
          ["phone", "Số điện thoại"],
          ["zalo", "Zalo"],
          ["email", "Email"],
          ["address", "Địa chỉ"],
        ] as const
      ).map(([k, label]) => (
        <WbField key={k} label={label}>
          <input
            className={wbInput}
            value={(draft.theme.footer as any)?.[k] || ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                theme: {
                  ...draft.theme,
                  footer: { ...draft.theme.footer, [k]: e.target.value },
                },
              })
            }
          />
        </WbField>
      ))}
    </div>
  );
}
