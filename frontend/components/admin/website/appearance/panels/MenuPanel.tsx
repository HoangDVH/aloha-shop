"use client";

import React from "react";
import type { AppearanceLayout, NavConfig } from "../../api";
import { ShopNavPanel, type CatNode } from "../../nav/ShopWebNavEditor";

export function MenuPanel({
  draft,
  setNav,
  cats,
}: {
  draft: AppearanceLayout;
  setNav: (next: NavConfig) => void;
  cats: CatNode[];
}) {
  return (
    <ShopNavPanel
      nav={
        draft.nav || {
          hiddenCategoryPaths: [],
          customItems: [],
        }
      }
      setNav={setNav}
      cats={cats}
    />
  );
}
