/**
 * Aloha Auto Share - Background Service Worker (Manifest V3)
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Nhận lệnh lưu bài đăng và mở Facebook
  if (message.action === "STORE_AND_OPEN_FACEBOOK") {
    const payload = {
      ...message.payload,
      timestamp: Date.now(),
    };

    chrome.storage.local.set({ alohaPendingShare: payload }, () => {
      chrome.tabs.create({ url: "https://www.facebook.com/" }, (tab) => {
        sendResponse({ success: true, tabId: tab?.id });
      });
    });
    return true; // Phản hồi bất đồng bộ
  }

  // 2. Chuyển đổi link ảnh/video thành base64 blob để bypass rào cản CORS
  if (message.action === "FETCH_MEDIA_BASE64") {
    const { url, kind } = message;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          let mimeType = (blob.type || "").split(";")[0].toLowerCase();
          if (!mimeType || mimeType === "application/octet-stream") {
            if (kind === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
              mimeType = "video/mp4";
            } else {
              mimeType = "image/jpeg";
            }
          }
          sendResponse({
            success: true,
            dataUrl: reader.result,
            mimeType,
            kind: kind || (mimeType.startsWith("video/") ? "video" : "image"),
          });
        };
        reader.onerror = () => sendResponse({ success: false, error: "read_error" });
        reader.readAsDataURL(blob);
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // Phản hồi bất đồng bộ
  }
});
