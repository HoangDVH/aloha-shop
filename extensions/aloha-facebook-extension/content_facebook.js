/**
 * Aloha Auto Share - Content Script cho Facebook (facebook.com)
 * Phiên bản 2.3: Tự động nạp 1-Click 100% đầy đủ cả Nội dung, Ảnh & Video cho mọi tài khoản Facebook (cũ & mới)
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

  // Đảm bảo Main World Script được nạp
  function ensureMainWorldScriptInjected() {
    if (document.getElementById("aloha-main-world-ready")) return;
    try {
      const s = document.createElement("script");
      s.src = chrome.runtime.getURL("content_facebook_main.js");
      s.onload = () => s.remove();
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {}
  }

  function initAlohaFacebookAutoShare(payload) {
    console.log("[Aloha Extension v2.3] Bắt đầu xử lý cho sản phẩm:", payload.name);
    ensureMainWorldScriptInjected();

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

    return [
      ...files.filter((f) => f.type.startsWith("video/")),
      ...files.filter((f) => !f.type.startsWith("video/")),
    ];
  }

  // Kích hoạt chuỗi sự kiện chuột hoàn chỉnh
  function triggerFullClick(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.click();
    } catch {
      el.click();
    }
  }

  // Tìm nút Ảnh/Video trong Facebook Dialog
  function findFacebookPhotoButton(dialog) {
    // 1. Quét thanh "Thêm vào bài viết của bạn" / "Add to your post"
    const allDivs = Array.from(dialog.querySelectorAll("div"));
    const toolbar = allDivs.find((d) => {
      const txt = (d.innerText || "").toLowerCase();
      return (
        txt.includes("thêm vào bài viết") ||
        txt.includes("thêm vào bài") ||
        txt.includes("add to your post")
      );
    });

    if (toolbar) {
      const btns = Array.from(
        toolbar.querySelectorAll('div[role="button"], span[role="button"], button')
      );
      if (btns.length > 0) {
        return btns[0]; // Nút ảnh luôn là nút đầu tiên
      }
    }

    // 2. Quét theo aria-label đa ngôn ngữ
    const allButtons = Array.from(
      dialog.querySelectorAll('div[role="button"], span[role="button"], button')
    );
    const byLabel = allButtons.find((b) => {
      const l = (b.getAttribute("aria-label") || "").toLowerCase();
      const t = (b.getAttribute("title") || "").toLowerCase();
      const txt = (b.innerText || "").toLowerCase();
      return (
        l.includes("ảnh/video") ||
        l.includes("thêm ảnh") ||
        l.includes("photo/video") ||
        l.includes("photo") ||
        t.includes("ảnh/video") ||
        t.includes("photo/video") ||
        txt.includes("ảnh/video") ||
        txt.includes("photo/video")
      );
    });
    if (byLabel) return byLabel;

    // 3. Quét theo icon ảnh
    const photoIcon = dialog.querySelector(
      'img[src*="photo"], svg[aria-label*="Ảnh"], svg[aria-label*="Photo"]'
    );
    if (photoIcon) {
      const parentBtn = photoIcon.closest('div[role="button"], span[role="button"], button');
      if (parentBtn) return parentBtn;
    }

    return null;
  }

  // Tìm ô soạn thảo (Textbox) đang hiển thị
  function findFacebookTextbox(dialog = null) {
    const dialogs = dialog
      ? [dialog]
      : Array.from(document.querySelectorAll('div[role="dialog"]'));

    // 1. Quét trong danh sách dialogs
    for (const d of dialogs) {
      const tb = d.querySelector(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"][contenteditable="true"], div[contenteditable="true"]'
      );
      if (tb) return tb;
    }

    // 2. Quét theo placeholder nhận diện
    const allEls = Array.from(document.querySelectorAll('*'));
    const placeholder = allEls.find((el) => {
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const txt = (el.innerText || "").toLowerCase();
      return (
        aria.includes("bạn đang nghĩ gì thế") ||
        aria.includes("what's on your mind") ||
        txt.includes("bạn đang nghĩ gì thế") ||
        txt.includes("what's on your mind")
      );
    });

    if (placeholder) {
      const tb =
        placeholder.closest('div[contenteditable="true"]') ||
        placeholder.querySelector('div[contenteditable="true"]') ||
        placeholder.parentElement?.querySelector('div[contenteditable="true"]');
      if (tb) return tb;
    }

    // 3. Quét toàn trang
    return (
      document.querySelector('div[role="dialog"] div[role="textbox"]') ||
      document.querySelector('div[data-lexical-editor="true"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]')
    );
  }

  // Kích hoạt Focus & Click thực tế trên Textbox
  function focusAndActivateEditor(textbox) {
    if (!textbox) return;
    try {
      textbox.scrollIntoView({ block: "center", behavior: "instant" });
      const rect = textbox.getBoundingClientRect();
      const x = rect.left + Math.min(25, rect.width / 2);
      const y = rect.top + Math.min(20, rect.height / 2);
      const clickOpts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      };

      textbox.dispatchEvent(new PointerEvent("pointerdown", clickOpts));
      textbox.dispatchEvent(new MouseEvent("mousedown", clickOpts));
      textbox.focus();
      textbox.dispatchEvent(new PointerEvent("pointerup", clickOpts));
      textbox.dispatchEvent(new MouseEvent("mouseup", clickOpts));
      textbox.dispatchEvent(new MouseEvent("click", clickOpts));
    } catch (e) {
      textbox.focus();
    }
  }

  // Trực tiếp nạp DOM Node chuẩn Lexical vào Textbox
  function directDOMInject(textbox, text) {
    try {
      focusAndActivateEditor(textbox);
      textbox.innerHTML = "";
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const p = document.createElement("p");
        p.className = "xdj266r x11i5rnm xat24cr x1mh8g0r x16tdsg8";
        if (line) {
          const span = document.createElement("span");
          span.setAttribute("data-lexical-text", "true");
          span.textContent = line;
          p.appendChild(span);
        } else {
          p.appendChild(document.createElement("br"));
        }
        textbox.appendChild(p);
      }
      textbox.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      textbox.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Thực thi Nạp Văn Bản Siêu Mạnh Mẽ
  async function executeRobustTextInjection(dialog, caption, maxWaitMs = 2000) {
    const fullCaption = String(caption || "").replace(/\r\n/g, "\n");
    let textbox = findFacebookTextbox(dialog);
    if (!textbox) {
      textbox = findFacebookTextbox(document);
    }

    // Đợi nếu hộp thoại chưa mở xong
    if (!textbox) {
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 100));
        textbox = findFacebookTextbox(document);
        if (textbox) break;
      }
    }

    if (!textbox) {
      console.warn("[Aloha] Không tìm thấy bất kỳ textbox nào!");
      return false;
    }

    // Luôn ghi sẵn vào Clipboard hệ thống làm bảo hiểm
    try {
      await navigator.clipboard.writeText(fullCaption);
    } catch {}

    // BƯỚC 1: Kích hoạt Main World Script (vượt qua mọi rào cản sandbox của Chromium)
    document.documentElement.setAttribute("data-aloha-pending-caption", fullCaption);
    document.documentElement.removeAttribute("data-aloha-caption-injected");

    window.dispatchEvent(
      new CustomEvent("ALOHA_TRIGGER_MAIN_INJECT", {
        detail: { caption: fullCaption },
      })
    );

    // Chờ tín hiệu phản hồi từ Main World
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const res = document.documentElement.getAttribute("data-aloha-caption-injected");
      if (res === "true") {
        return true;
      }
      textbox = findFacebookTextbox(dialog) || findFacebookTextbox(document);
      if (textbox && textbox.innerText && textbox.innerText.trim().length > 10) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    // BƯỚC 2: Fallback trực tiếp trong Content Script
    if (textbox) {
      focusAndActivateEditor(textbox);

      // Thử atomic beforeinput
      try {
        textbox.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: "insertText",
            data: fullCaption,
          })
        );
      } catch (e) {}

      if (textbox.innerText && textbox.innerText.trim().length > 10) {
        return true;
      }

      // Thử trực tiếp chèn DOM Nodes
      directDOMInject(textbox, fullCaption);
      if (textbox.innerText && textbox.innerText.trim().length > 10) {
        return true;
      }

      // Thử execCommand insertText
      try {
        const ok = document.execCommand("insertText", false, fullCaption);
        if (!ok) {
          const lines = fullCaption.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (lines[i]) document.execCommand("insertText", false, lines[i]);
            if (i < lines.length - 1) document.execCommand("insertParagraph", false, null);
          }
        }
      } catch (e) {}
    }

    textbox = findFacebookTextbox(dialog) || findFacebookTextbox(document);
    return Boolean(textbox && textbox.innerText && textbox.innerText.trim().length > 10);
  }

  // Quy trình nạp tự động vào Facebook: NẠP VĂN BẢN TRƯỚC ➔ SAU ĐÓ NẠP ẢNH & VIDEO ➔ KIỂM TRA LẠI VĂN BẢN
  async function autoInjectIntoFacebook(
    payload,
    widget,
    preferKind = "auto",
    forceClean = false
  ) {
    const statusText = widget.querySelector("#aloha-status-text");
    if (statusText) statusText.innerText = "Đang chuẩn bị ảnh & bài viết...";

    // BƯỚC 1: Tải các file ảnh & video
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
    const targetFiles = files;

    if (statusText) statusText.innerText = "Đang tìm khung tạo bài viết Facebook...";

    // BƯỚC 2: Tìm hoặc mở dialog "Tạo bài viết"
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
        triggerFullClick(postBtn);
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 200));
          dialog = document.querySelector('div[role="dialog"]');
          if (dialog) break;
        }
      }
    }

    if (!dialog) {
      dialog = document.body;
    }

    const fullCaption = String(payload.caption || "").replace(/\r\n/g, "\n");

    // BƯỚC 3: NẠP VĂN BẢN TRƯỚC (Khi khung soạn thảo vừa mở)
    if (statusText) statusText.innerText = "Đang tự động điền bài viết...";
    let textSuccess = await executeRobustTextInjection(dialog, fullCaption, 1500);

    await new Promise((r) => setTimeout(r, 400));

    // BƯỚC 4: NẠP MEDIA (ẢNH & VIDEO)
    let photoSuccess = false;
    if (targetFiles.length > 0) {
      if (statusText) statusText.innerText = "Đang đính kèm ảnh & video...";

      let fileInput = dialog.querySelector('input[type="file"]');

      // Nếu chưa có fileInput, bấm nút Ảnh/Video
      if (!fileInput) {
        const photoBtn = findFacebookPhotoButton(dialog);
        if (photoBtn) {
          triggerFullClick(photoBtn);
          // Chờ input file xuất hiện sau khi bấm nút ảnh
          for (let i = 0; i < 20; i++) {
            await new Promise((r) => setTimeout(r, 150));
            fileInput = dialog.querySelector('input[type="file"]');
            if (fileInput) break;
          }
        }
      }

      // Quét toàn trang nếu dialog chưa render kịp
      if (!fileInput) {
        fileInput = document.querySelector('input[type="file"][accept*="image"]');
      }

      if (fileInput) {
        const dt = new DataTransfer();
        targetFiles.forEach((f) => dt.items.add(f));
        try {
          fileInput.value = "";
        } catch {}
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event("change", { bubbles: true }));
        fileInput.dispatchEvent(new Event("input", { bubbles: true }));
        photoSuccess = true;
      }
    } else {
      photoSuccess = true;
    }

    // Chờ 1.2 giây để Facebook hoàn tất render và điều chỉnh layout ảnh
    await new Promise((r) => setTimeout(r, 1200));

    // BƯỚC 5: KIỂM TRA LẠI VĂN BẢN (Sau khi ảnh render, bù bài viết ngay lập tức nếu bị reset)
    let currentTextbox = findFacebookTextbox(dialog) || findFacebookTextbox(document);
    const currentLength = currentTextbox ? (currentTextbox.innerText || "").trim().length : 0;
    console.log("[Aloha] Kiểm tra lại nội dung sau nạp ảnh. Độ dài chữ:", currentLength);

    if (!currentTextbox || currentLength <= 10) {
      console.log("[Aloha] Bổ sung lại bài viết sau khi ảnh hiển thị...");
      textSuccess = await executeRobustTextInjection(dialog, fullCaption, 2000);
      if (!textSuccess && currentTextbox) {
        directDOMInject(currentTextbox, fullCaption);
        textSuccess = Boolean(currentTextbox.innerText && currentTextbox.innerText.trim().length > 10);
      }
    } else {
      textSuccess = true;
    }

    // Đánh dấu dialog đã nạp hoàn tất
    if (dialog && dialog.setAttribute) {
      dialog.setAttribute("data-aloha-injected", "true");
    }

    // BƯỚC 6: Cập nhật giao diện thanh tiện ích nổi
    updateWidgetUI(
      widget,
      payload,
      videoFiles.length,
      photoFiles.length,
      textSuccess,
      photoSuccess,
      false
    );
  }

  // Cập nhật giao diện thanh tiện ích nổi Aloha
  function updateWidgetUI(
    widget,
    payload,
    videoCount,
    photoCount,
    textSuccess = true,
    photoSuccess = true,
    alreadyReady = false
  ) {
    const statusText = widget.querySelector("#aloha-status-text");
    const actionContainer = widget.querySelector("#aloha-action-buttons");

    if (statusText) {
      if (alreadyReady || (textSuccess && photoSuccess)) {
        statusText.innerHTML = `
          <div style="color: #1b5e20; font-weight: bold; font-size: 13px; margin-bottom: 4px;">
            🎉 Đã tự động nạp thành công 100%!
          </div>
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 10px; font-size: 11.5px; color: #065f46; line-height: 1.45;">
            ✅ Đã đính kèm <b>${photoCount} ảnh</b> & <b>toàn bộ bài viết</b>.<br/>
            Bạn chỉ cần bấm nút <b>"Đăng"</b> màu xanh của Facebook!
          </div>
        `;
      } else if (photoSuccess && !textSuccess) {
        statusText.innerHTML = `
          <div style="color: #1b5e20; font-weight: bold; font-size: 12.5px; margin-bottom: 2px;">
            🎉 Đã tự động nạp ${photoCount} ảnh thành công!
          </div>
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 7px 9px; margin-top: 4px; font-size: 11.5px; color: #92400e;">
            👉 Bấm nút <b>"Điền bài ngay"</b> bên dưới để nạp tức thì bài viết nhé!
          </div>
        `;
      } else {
        statusText.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 7px 9px; font-size: 11.5px; color: #166534;">
            💡 Bài viết đã sẵn sàng. Bạn hãy bấm <b>"Nạp lại"</b> nếu cần!
          </div>
        `;
      }
    }

    if (actionContainer) {
      if (textSuccess && photoSuccess) {
        actionContainer.innerHTML = `
          <button id="aloha-btn-highlight-post" style="flex: 1.3; background: #1877f2; color: white; border: none; padding: 9px 12px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(24,119,242,0.35);">
            🚀 Sẵn sàng đăng bài!
          </button>
          <button id="aloha-btn-clean-reload" style="flex: 0.9; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 9px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
            🔄 Nạp lại
          </button>
        `;

        const highlightBtn = widget.querySelector("#aloha-btn-highlight-post");
        if (highlightBtn) {
          highlightBtn.onclick = () => {
            const submitBtn = Array.from(
              document.querySelectorAll('div[role="button"], span[role="button"], button')
            ).find((b) => {
              const txt = (b.innerText || "").trim().toLowerCase();
              return txt === "đăng" || txt === "post";
            });
            if (submitBtn) {
              submitBtn.scrollIntoView({ behavior: "smooth", block: "center" });
              submitBtn.style.outline = "4px solid #16a34a";
              submitBtn.style.outlineOffset = "2px";
              setTimeout(() => {
                submitBtn.style.outline = "";
              }, 2500);
            }
          };
        }
      } else {
        actionContainer.innerHTML = `
          <button id="aloha-btn-paste-now" style="flex: 1.2; background: #1b5e20; color: white; border: none; padding: 9px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
            📝 Điền bài ngay
          </button>
          <button id="aloha-btn-clean-reload" style="flex: 1; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 9px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
            🔄 Nạp lại
          </button>
        `;

        const pasteNowBtn = widget.querySelector("#aloha-btn-paste-now");
        if (pasteNowBtn) {
          pasteNowBtn.onclick = async () => {
            pasteNowBtn.innerText = "Đang điền...";
            const ok = await executeRobustTextInjection(null, payload.caption, 2000);
            if (ok) {
              pasteNowBtn.innerText = "✅ Đã điền xong!";
              setTimeout(() => {
                updateWidgetUI(widget, payload, videoCount, photoCount, true, photoSuccess);
              }, 300);
            } else {
              // Thử trực tiếp chèn DOM
              const tb = findFacebookTextbox();
              if (tb) {
                directDOMInject(tb, payload.caption);
                pasteNowBtn.innerText = "✅ Đã điền xong!";
                setTimeout(() => {
                  updateWidgetUI(widget, payload, videoCount, photoCount, true, photoSuccess);
                }, 300);
              } else {
                pasteNowBtn.innerText = "📝 Điền bài ngay";
              }
            }
          };
        }
      }

      const cleanReloadBtn = widget.querySelector("#aloha-btn-clean-reload");
      if (cleanReloadBtn) {
        cleanReloadBtn.onclick = () => {
          autoInjectIntoFacebook(payload, widget, "auto", true);
        };
      }
    }
  }

  // Tạo Floating Widget nổi trên Facebook
  function createAlohaFloatingWidget(payload) {
    const old = document.getElementById("aloha-fb-share-helper");
    if (old) old.remove();

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

    const style = document.createElement("style");
    style.textContent = `
      @keyframes alohaSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    wrap.innerHTML = `
      <div style="background: #1b5e20; color: white; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
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
          <button id="aloha-btn-retry" style="flex: 1; background: #1b5e20; color: white; border: none; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Điền lại bài
          </button>
          <button id="aloha-btn-copy" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Chép bài
          </button>
        </div>
      </div>
    `;

    wrap.querySelector("#aloha-btn-close").onclick = () => wrap.remove();

    wrap.querySelector("#aloha-btn-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(payload.caption);
        const btn = wrap.querySelector("#aloha-btn-copy");
        btn.innerText = "Đã chép!";
        setTimeout(() => (btn.innerText = "Chép bài"), 2000);
      } catch {}
    };

    wrap.querySelector("#aloha-btn-retry").onclick = () => {
      autoInjectIntoFacebook(payload, wrap, "auto", true);
    };

    return wrap;
  }
})();
