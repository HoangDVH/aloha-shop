# Suggested buying searches, reviewed 10 October 2026

The eight chips are curated suggestions, not a verified national ranking or Aloha search analytics. No search-volume numbers are available from the reviewed public sources. Google Trends requests returned HTTP 429; Google explains that Trends reports normalized interest rather than absolute search counts: https://support.google.com/trends/answer/4365533.

References reviewed:
- Web Cây Cảnh's “Cây Mua Nhiều”/“Cây Cảnh Ưa Chuộng” includes sen đá, kim tiền, kim ngân and lưỡi hổ, with a separate xương rồng category: https://webcaycanh.com/cay-canh-sen-da/.
- Tổ Xanh specializes in sen đá, xương rồng and desktop plants: https://toxanh.com/.
- An Nhiên offers plastic/ceramic pots and terracotta buying guidance: https://xuongchaucaycanh.com.vn/ and https://xuongchaucaycanh.com.vn/chau-dat-nung-trong-cay-co-tot-khong-uu-nhuoc-diem-chau-dat-nung/.

The selected labels are Sen đá, Xương rồng, Kim tiền, Kim ngân, Lưỡi hổ, Chậu đất nung, Chậu gốm and Chậu nhựa. Check each through the real public shop API with `inStock=1`, public price > 0, and a pot category for pot suggestions. Inventory changes over time; this is a dated validation, not a promise of permanent availability.

“Chậu đất nung” searches “Đất nung” because inventory names include shapes between those words. The former full phrase returned zero results. “Chậu men sứ” also returned zero; “Chậu sứ” matched “Chậu sứa”, which is not evidence for that material. “Chậu gốm” is supported by actual ceramic-category products and replaces that misleading suggestion. Separate sen đá and xương rồng queries replace the old combined ampersand phrase.

Run the read-only inventory integration check with `SHOP_TEST_API_BASE=http://127.0.0.1:3001` and `tsx --test tests/popular-search-stock.test.ts`.
