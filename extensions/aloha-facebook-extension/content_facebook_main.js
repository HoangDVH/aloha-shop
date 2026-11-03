/**
 * Aloha Auto Share - Main World Script cho Facebook
 * Chạy trực tiếp trong ngữ cảnh V8 chính (MAIN world) của Facebook
 * Tích hợp 5 chiến lược nạp bài độc quyền: Lexical AST, Native Events, React Fiber, DOM Reconciler & Draft.js
 */

(function () {
  if (window.__alohaMainInjected) return;
  window.__alohaMainInjected = true;

  console.log("[Aloha Main World v2.3] Đã khởi tạo thành công trên Facebook context.");

  // Đánh dấu marker để Content Script nhận biết
  const marker = document.createElement("div");
  marker.id = "aloha-main-world-ready";
  marker.style.display = "none";
  document.documentElement.appendChild(marker);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Chuyển văn bản thuần thành cấu trúc Lexical AST JSON chuẩn của Meta
  function textToLexicalJSON(text) {
    const lines = String(text).replace(/\r\n/g, "\n").split("\n");
    const children = lines.map((line) => {
      if (!line) {
        return {
          children: [],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        };
      }
      return {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: line,
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      };
    });

    return JSON.stringify({
      root: {
        children,
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    });
  }

  // Tìm đối tượng Lexical Editor thông qua DOM hoặc React Fiber
  function findLexicalEditorInstance(root = document) {
    const elements = Array.from(
      root.querySelectorAll('[data-lexical-editor], [contenteditable="true"]')
    );
    for (const el of elements) {
      if (el.__lexicalEditor) return el.__lexicalEditor;
    }
    // Quét React Fiber tree nếu Meta không gán trực tiếp lên DOM node
    for (const el of elements) {
      const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (fiberKey && el[fiberKey]) {
        let fiber = el[fiberKey];
        for (let i = 0; i < 20 && fiber; i++) {
          if (fiber.memoizedProps?.editor) return fiber.memoizedProps.editor;
          if (fiber.stateNode?.__lexicalEditor) return fiber.stateNode.__lexicalEditor;
          fiber = fiber.return;
        }
      }
    }
    return null;
  }

  // Tìm ô soạn thảo (Textbox) Facebook
  function findFacebookComposerTextbox() {
    // 1. Quét theo các dialogs đang mở
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
    for (const d of dialogs) {
      const tb = d.querySelector(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"][contenteditable="true"], div[contenteditable="true"]'
      );
      if (tb) return tb;
    }

    // 2. Quét theo placeholder nhận diện tiếng Việt & tiếng Anh
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

  // Giả lập tương tác Click & Focus thực tế
  function focusEditor(textbox) {
    if (!textbox) return;
    try {
      textbox.scrollIntoView({ block: "center", behavior: "instant" });
    } catch {}

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

    try {
      textbox.dispatchEvent(new PointerEvent("pointerdown", clickOpts));
      textbox.dispatchEvent(new MouseEvent("mousedown", clickOpts));
      textbox.focus();
      textbox.dispatchEvent(new PointerEvent("pointerup", clickOpts));
      textbox.dispatchEvent(new MouseEvent("mouseup", clickOpts));
      textbox.dispatchEvent(new MouseEvent("click", clickOpts));
    } catch {
      textbox.focus();
    }
  }

  // Trực tiếp bơm cấu trúc DOM Lexical và kích hoạt MutationObserver
  function injectDOMNodes(textbox, text) {
    try {
      focusEditor(textbox);
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
      console.warn("[Aloha Main] injectDOMNodes error:", e);
      return false;
    }
  }

  // Nạp văn bản vào Lexical / Draft.js bằng chuỗi 5 chiến lược lũy tiến
  function injectTextIntoEditor(textbox, text) {
    if (!textbox || !text) return false;

    focusEditor(textbox);
    const cleanText = String(text).replace(/\r\n/g, "\n");

    // CHIẾN LƯỢC 1: Cập nhật trực tiếp State của Lexical Editor (Nhanh và Chuẩn nhất)
    try {
      const editor = findLexicalEditorInstance(textbox.closest('div[role="dialog"]') || document);
      if (editor && typeof editor.parseEditorState === "function" && typeof editor.setEditorState === "function") {
        const stateJSON = textToLexicalJSON(cleanText);
        const parsedState = editor.parseEditorState(stateJSON);
        editor.setEditorState(parsedState);
        console.log("[Aloha Main] ✅ Chiến lược 1 (Lexical AST State) thành công!");
      }
    } catch (err) {
      console.warn("[Aloha Main] Chiến lược 1 warn:", err);
    }

    if (textbox.innerText && textbox.innerText.trim().length > 10) {
      return true;
    }

    // CHIẾN LƯỢC 2: Atomic InputEvent 'beforeinput' (Chuẩn DOM Level 3 cho Lexical)
    try {
      focusEditor(textbox);
      const beforeInputEvt = new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: "insertText",
        data: cleanText,
      });
      textbox.dispatchEvent(beforeInputEvt);
      if (textbox.innerText && textbox.innerText.trim().length > 10) {
        console.log("[Aloha Main] ✅ Chiến lược 2 (Atomic beforeinput) thành công!");
        return true;
      }
    } catch (err) {}

    // CHIẾN LƯỢC 3: ClipboardEvent('paste') với DataTransfer chuẩn
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", cleanText);
      const htmlContent = cleanText
        .split("\n")
        .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : `<p><br></p>`))
        .join("");
      dt.setData("text/html", htmlContent);

      const pasteEvt = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        composed: true,
        clipboardData: dt,
      });

      textbox.dispatchEvent(pasteEvt);
      if (textbox.innerText && textbox.innerText.trim().length > 10) {
        console.log("[Aloha Main] ✅ Chiến lược 3 (ClipboardEvent) thành công!");
        return true;
      }
    } catch (err) {}

    // CHIẾN LƯỢC 4: Trực tiếp cấu trúc DOM Node Lexical (<p><span data-lexical-text="true">)
    injectDOMNodes(textbox, cleanText);
    if (textbox.innerText && textbox.innerText.trim().length > 10) {
      console.log("[Aloha Main] ✅ Chiến lược 4 (DOM Reconciler) thành công!");
      return true;
    }

    // CHIẾN LƯỢC 5: document.execCommand (Dành riêng cho tài khoản dùng Draft.js cũ)
    try {
      focusEditor(textbox);
      const ok = document.execCommand("insertText", false, cleanText);
      if (!ok) {
        const lines = cleanText.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]) document.execCommand("insertText", false, lines[i]);
          if (i < lines.length - 1) document.execCommand("insertParagraph", false, null);
        }
      }
    } catch (err) {}

    return Boolean(textbox.innerText && textbox.innerText.trim().length > 10);
  }

  // Lắng nghe lệnh nạp bài từ Content Script
  window.addEventListener("ALOHA_TRIGGER_MAIN_INJECT", async (e) => {
    const rawCaption =
      e?.detail?.caption ||
      document.documentElement.getAttribute("data-aloha-pending-caption") ||
      "";

    if (!rawCaption) return;

    let textbox = findFacebookComposerTextbox();
    if (!textbox) {
      // Đợi tối đa 1.5s nếu Facebook đang hiển thị hiệu ứng mở hộp thoại
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 100));
        textbox = findFacebookComposerTextbox();
        if (textbox) break;
      }
    }

    let success = false;
    if (textbox) {
      success = injectTextIntoEditor(textbox, rawCaption);
    }

    document.documentElement.setAttribute(
      "data-aloha-caption-injected",
      success ? "true" : "false"
    );

    window.dispatchEvent(
      new CustomEvent("ALOHA_MAIN_INJECT_COMPLETED", {
        detail: {
          success,
          charCount: textbox ? (textbox.innerText || "").trim().length : 0,
        },
      })
    );
  });
})();
