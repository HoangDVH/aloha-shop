"use client";

import { useEffect } from "react";

/**
 * Tự động cuộn mượt xuống danh sách sản phẩm khi URL có hash #san-pham
 * Hỗ trợ chuyển trang từ Chatbot hoặc click trực tiếp vào bộ sưu tập quà tặng.
 */
export function GiftHashScroller() {
  useEffect(() => {
    const scrollToProducts = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === "#san-pham") {
        const el = document.getElementById("san-pham");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    // Thử cuộn ở các mốc thời gian để đảm bảo DOM & layout đã hoàn tất
    const t1 = setTimeout(scrollToProducts, 100);
    const t2 = setTimeout(scrollToProducts, 350);
    const t3 = setTimeout(scrollToProducts, 700);
    window.addEventListener("hashchange", scrollToProducts);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("hashchange", scrollToProducts);
    };
  }, []);

  return null;
}
