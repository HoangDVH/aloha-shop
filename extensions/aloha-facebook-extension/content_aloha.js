/**
 * Aloha Auto Share - Content Script cho trang web Aloha
 */

// Đánh dấu để trang web Aloha biết tiện ích đã sẵn sàng
function notifyAlohaReady() {
  document.documentElement.setAttribute("data-aloha-extension-installed", "true");
  window.dispatchEvent(
    new CustomEvent("aloha-extension-ready", {
      detail: { installed: true, version: "1.0.0" },
    })
  );
}

notifyAlohaReady();
document.addEventListener("DOMContentLoaded", notifyAlohaReady);

// Lắng nghe yêu cầu đăng bài từ trang web Aloha
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.type !== "ALOHA_SHARE_TO_FB_EXTENSION") return;

  const payload = data.payload;
  chrome.runtime.sendMessage(
    {
      action: "STORE_AND_OPEN_FACEBOOK",
      payload,
    },
    (res) => {
      window.postMessage(
        {
          type: "ALOHA_EXTENSION_SHARE_STARTED",
          success: Boolean(res?.success),
        },
        "*"
      );
    }
  );
});
