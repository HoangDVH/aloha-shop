"use client";

/**
 * CategoryNavMenu - Re-exports modularized components & helpers.
 * See: frontend/components/category-nav/*
 */

export {
  foldKey,
  navBarLabel,
  navBarIcon,
  nameMatchesAny,
  toTitleCaseVi,
} from "./category-nav/navLabels";

export { CategoryNavBar } from "./category-nav/DesktopNav";
export { CategoryMobileNav } from "./category-nav/MobileNav";
