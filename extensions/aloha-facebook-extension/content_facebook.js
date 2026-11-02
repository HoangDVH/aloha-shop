/**
 * Aloha Auto Share - Content Script cho Facebook (facebook.com)
 */

(function () {
  const CHECK_STORAGE_KEY = "alohaPendingShare";

  chrome.storage.local.get([CHECK_STORAGE_KEY], (res) => {
    const payload = res[CHECK_STORAGE_KEY];
    if (!payload || !payload.timestamp) return;

    // Chỉ thực hiện nếu yêu cầu được tạo trong vòng 2 phút trở lại
    if (Date.now() - payload.timestamp > 120_000) {
      chrome.storage.local.remove(CHECK_STORAGE_KEY);
      return;
    }

    // Xóa ngay để không bị lặp lại khi tải lại trang
    chrome.storage.local.remove(CHECK_STORAGE_KEY);

    // Bắt đầu quá trình nạp tự động
    initAlohaFacebookAutoShare(payload);
  });

  function initAlohaFacebookAutoShare(payload) {
    console.log("[Aloha Extension] Nhận bài đăng cho sản phẩm:", payload.name);

    // 1. Tạo thanh công cụ nổi (Floating Aloha Widget) trên Facebook
    const widget = createAlohaFloatingWidget(payload);
    document.body.appendChild(widget);

    // 2. Tự động kích hoạt nạp vào khung bài viết
    autoInjectIntoFacebook(payload, widget);
  }

  // Chuyển DataURL thành File
  function dataUrlToFile(dataUrl, filename, mimeType) {
    const arr = dataUrl.split(",");
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mimeType });
  }

  const EXT_MAP = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };

  function getMediaExtension(mimeType, kind) {
    if (EXT_MAP[mimeType]) return EXT_MAP[mimeType];
    if (kind === "video" || (mimeType && mimeType.startsWith("video/"))) return "mp4";
    return "jpg";
  }

  // Tải file thông qua Background Service Worker (bypass CORS)
  async function fetchFiles(mediaItems, prefix) {
    const files = [];
    for (let i = 0; i < mediaItems.length; i++) {
      const item = mediaItems[i];
      const url = typeof item === "string" ? item : item.src;
      const kind =
        typeof item === "object" && item.kind
          ? item.kind
          : /\.(mp4|webm|mov)(\?|$)/i.test(url)
          ? "video"
          : "image";

      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: "FETCH_MEDIA_BASE64", url, kind },
            resolve
          );
        });
        if (response && response.success) {
          const ext = getMediaExtension(response.mimeType, kind);
          const file = dataUrlToFile(
            response.dataUrl,
            `${prefix}-${i + 1}.${ext}`,
            response.mimeType
          );
          files.push(file);
        }
      } catch (err) {
        console.warn("[Aloha] Lỗi tải media:", url, err);
      }
    }

    // Đưa video lên đầu để Facebook xử lý pipeline đính kèm tốt nhất
    return [
      ...files.filter((f) => f.type.startsWith("video/")),
      ...files.filter((f) => !f.type.startsWith("video/")),
    ];
  }

  // Quy trình nạp tự động vào Facebook
  async function autoInjectIntoFacebook(payload, widget, preferKind = "auto", forceClean = false) {
    const statusText = widget.querySelector("#aloha-status-text");
    if (statusText) statusText.innerText = "Đang chuẩn bị ảnh & video...";

    // Bước 1: Tải các file ảnh & video (Lọc trùng lặp URL tuyệt đối)
    const rawItems = payload.media || payload.images || [];
    const seenUrls = new Set();
    const mediaItems = [];
    for (const item of rawItems) {
      const u = typeof item === "string" ? item : item?.src;
      if (!u || seenUrls.has(u)) continue;
      seenUrls.add(u);
      mediaItems.push(item);
    }

    const files = await fetchFiles(mediaItems, "aloha-sp");
    const videoFiles = files.filter((f) => f.type.startsWith("video/"));
    const photoFiles = files.filter((f) => !f.type.startsWith("video/"));

    // Nạp toàn bộ media (video đứng đầu, theo sau là toàn bộ ảnh đã chọn)
    const targetFiles = files;
    const modeDesc =
      videoFiles.length > 0 && photoFiles.length > 0
        ? `${videoFiles.length} video & ${photoFiles.length} ảnh`
        : videoFiles.length > 0
        ? `${videoFiles.length} video`
        : `${photoFiles.length} ảnh`;

    if (statusText) statusText.innerText = "Đang mở khung tạo bài viết Facebook...";

    // Bước 2: Tìm nút "Bạn đang nghĩ gì thế?" để mở dialog
    let dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) {
      const openButtons = Array.from(
        document.querySelectorAll('div[role="button"]')
      );
      const postBtn = openButtons.find((el) => {
        const txt = el.innerText || "";
        return (
          txt.includes("Bạn đang nghĩ gì thế") ||
          txt.includes("What's on your mind") ||
          txt.includes("Tạo bài viết") ||
          txt.includes("Create a post")
        );
      });

      if (postBtn) {
        postBtn.click();
        // Chờ dialog xuất hiện
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 200));
          dialog = document.querySelector('div[role="dialog"]');
          if (dialog) break;
        }
      }
    }

    if (!dialog) {
      if (statusText)
        statusText.innerText =
          "Hãy bấm vào 'Bạn đang nghĩ gì thế?', sau đó bấm 'Điền vào bài viết'!";
      return;
    }

    // KIỂM TRA CHỐNG LẶP: Nếu khung dialog này đã được Aloha nạp thành công rồi và người dùng không yêu cầu làm mới
    const alreadyInjected = dialog.getAttribute("data-aloha-injected") === "true";
    if (alreadyInjected && !forceClean) {
      if (statusText) {
        statusText.innerHTML = `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 10px; margin-bottom: 6px;">
            <div style="color: #065f46; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span>✅ Bài viết đã sẵn sàng!</span>
            </div>
            <div style="color: #047857; font-size: 11px; margin-top: 4px; line-height: 1.4;">
              Nội dung và ảnh/video của bạn đã được nạp đầy đủ rồi. Tiện ích tự động khóa để không chèn đè hoặc nhân đôi chữ. Bạn chỉ cần bấm <b>"Đăng"</b> thôi nhé!
            </div>
          </div>
        `;
      }
      updateWidgetUI(widget, payload, videoFiles.length, photoFiles.length, true);
      return;
    }

    // Nếu người dùng yêu cầu làm mới bài viết
    if (forceClean) {
      dialog.removeAttribute("data-aloha-injected");
    }

    // Bước 3: Nạp media (cả video và ảnh) vào file input của dialog
    if (targetFiles.length > 0) {
      if (statusText)
        statusText.innerText = `Đang đính kèm ${modeDesc} vào bài...`;

      // CHỈ tìm input file BÊN TRONG dialog
      let fileInput = dialog.querySelector('input[type="file"]');

      // Nếu dialog chưa có input file, bấm nút "Ảnh/video" của dialog
      if (!fileInput) {
        const photoBtn = Array.from(dialog.querySelectorAll('div[role="button"]')).find(
          (b) =>
            (b.getAttribute("aria-label") || "").includes("Ảnh/video") ||
            (b.innerText || "").includes("Ảnh/video") ||
            (b.innerText || "").includes("Photo/video")
        );
        if (photoBtn) {
          photoBtn.click();
          for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 200));
            fileInput = dialog.querySelector('input[type="file"]');
            if (fileInput) break;
          }
        }
      }

      if (fileInput) {
        const dt = new DataTransfer();
        targetFiles.forEach((f) => dt.items.add(f));
        try {
          fileInput.value = "";
        } catch {}
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    // Bước 4: Nạp văn bản vào ô soạn thảo
    if (statusText) statusText.innerText = "Đang điền nội dung bài viết...";
    const textbox = dialog.querySelector('div[role="textbox"][contenteditable="true"]');
    if (textbox) {
      textbox.focus();

      // Nếu làm mới, xóa sạch chữ cũ
      if (forceClean) {
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(textbox);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("delete", false, null);
        } catch {}
      }

      // Điền văn bản từng dòng với insertText và insertParagraph (Facebook Lexical hiển thị xuống dòng chuẩn 100%)
      const lines = (payload.caption || "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line) {
          document.execCommand("insertText", false, line);
        }
        if (i < lines.length - 1) {
          const ok = document.execCommand("insertParagraph", false, null);
          if (!ok) {
            document.execCommand("insertLineBreak", false, null);
          }
        }
      }
    }

    // Đánh dấu dialog này đã được nạp thành công 1 lần duy nhất
    dialog.setAttribute("data-aloha-injected", "true");

    // Luôn sao chép sẵn nội dung chuẩn vào clipboard để người dùng có thể Ctrl+V bất cứ lúc nào
    try {
      await navigator.clipboard.writeText(payload.caption);
    } catch {}

    // Cập nhật giao diện thanh tiện ích nổi
    updateWidgetUI(widget, payload, videoFiles.length, photoFiles.length, false);
  }

  // Cập nhật nút bấm trên Widget nổi
  function updateWidgetUI(
    widget,
    payload,
    videoCount,
    photoCount,
    alreadyReady = false
  ) {
    const statusText = widget.querySelector("#aloha-status-text");
    const actionContainer = widget.querySelector("#aloha-action-buttons");

    if (statusText && !alreadyReady) {
      const activeText =
        videoCount > 0 && photoCount > 0
          ? `🎉 Đã nạp ${videoCount} video & ${photoCount} ảnh!`
          : videoCount > 0
          ? `🎉 Đã nạp ${videoCount} video!`
          : `🎉 Đã nạp ${photoCount} ảnh!`;
      statusText.innerHTML = `
        <span style="color: #2D5A27; font-weight: bold;">
          ${activeText}
        </span>
        <br/><span style="font-size: 11px; color: #555;">Bạn chỉ cần xem lại và bấm nút "Đăng" của Facebook!</span>
      `;
    }

    if (actionContainer) {
      actionContainer.innerHTML = `
        <button id="aloha-btn-clean-reload" style="flex: 1; background: #2D5A27; color: white; border: none; padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          🔄 Làm mới bài
        </button>
        <button id="aloha-btn-copy" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
          Chép bài
        </button>
      `;

      const cleanReloadBtn = widget.querySelector("#aloha-btn-clean-reload");
      if (cleanReloadBtn) {
        cleanReloadBtn.onclick = () => {
          autoInjectIntoFacebook(payload, widget, "auto", true);
        };
      }

      const copyBtn = widget.querySelector("#aloha-btn-copy");
      if (copyBtn) {
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(payload.caption);
            copyBtn.innerText = "Đã chép!";
            setTimeout(() => (copyBtn.innerText = "Chép bài"), 2000);
          } catch {}
        };
      }
    }
  }

  // Tạo Floating Widget nổi trên Facebook
  function createAlohaFloatingWidget(payload) {
    const wrap = document.createElement("div");
    wrap.id = "aloha-fb-share-helper";
    wrap.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      width: 320px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      animation: alohaSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    // Style animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes alohaSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    wrap.innerHTML = `
      <div style="background: #2D5A27; color: white; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🌿</span>
          <span style="font-weight: bold; font-size: 13px; letter-spacing: -0.2px;">Aloha Auto Share</span>
        </div>
        <button id="aloha-btn-close" style="background: transparent; border: none; color: white; cursor: pointer; font-size: 16px; padding: 0 4px; opacity: 0.8;">✕</button>
      </div>

      <div style="padding: 14px;">
        <div style="font-weight: 600; font-size: 12px; margin-bottom: 4px; line-height: 1.4; color: #0f172a;" id="aloha-product-title">
          ${payload.name || "Sản phẩm Aloha"}
        </div>
        <div id="aloha-status-text" style="font-size: 12px; color: #475569; margin-bottom: 12px; min-height: 32px;">
          Đang chuẩn bị...
        </div>

        <div id="aloha-action-buttons" style="display: flex; gap: 8px;">
          <button id="aloha-btn-retry" style="flex: 1; background: #2D5A27; color: white; border: none; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Điền lại vào bài
          </button>
          <button id="aloha-btn-copy" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Chép bài
          </button>
        </div>
      </div>
    `;

    // Sự kiện nút đóng
    wrap.querySelector("#aloha-btn-close").onclick = () => wrap.remove();

    // Sự kiện sao chép bài
    wrap.querySelector("#aloha-btn-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(payload.caption);
        const btn = wrap.querySelector("#aloha-btn-copy");
        btn.innerText = "Đã chép!";
        setTimeout(() => (btn.innerText = "Chép bài"), 2000);
      } catch {}
    };

    // Sự kiện điền lại (xóa sạch bài viết cũ bị lặp và điền mới 1 lần duy nhất)
    wrap.querySelector("#aloha-btn-retry").onclick = () => {
      autoInjectIntoFacebook(payload, wrap, "auto", true);
    };

    return wrap;
  }
})();
