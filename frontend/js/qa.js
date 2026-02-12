/* qa.js (NO IMPORT / 안정판)
 * - 정적 파일(public)에서 그대로 동작
 * - 초기화 실패하면 console에 원인 로그 남김
 * - 모달 자동 생성 + 클릭 시 영상 pause + QA 활성화
 */

(function () {
  "use strict";

  // =========================
  // Config
  // =========================
  const CFG = {
    qaRootId: "qa-root",
    ytIframeId: "yt-iframe",
    brandText: ":: 모두의 Q&A AIQA ::",
  };

  // =========================
  // Utils
  // =========================
  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function safeLog(...args) {
    console.log("[AIQA]", ...args);
  }

  function safeWarn(...args) {
    console.warn("[AIQA]", ...args);
  }

  function safeErr(...args) {
    console.error("[AIQA]", ...args);
  }

  // YouTube pause: enablejsapi=1 + postMessage
  function pauseYouTube() {
    const iframe = document.getElementById(CFG.ytIframeId);
    if (!iframe) {
      safeWarn("YouTube iframe not found:", CFG.ytIframeId);
      return false;
    }
    try {
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
        "*"
      );
      return true;
    } catch (e) {
      safeErr("pauseYouTube failed:", e);
      return false;
    }
  }

  // =========================
  // UI Builders
  // =========================
  function injectBaseStyles() {
    if (document.getElementById("aiqa-style")) return;

    const style = document.createElement("style");
    style.id = "aiqa-style";
    style.textContent = `
      /* Panel */
      .aiqa-panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #ffffff;
      }
      .aiqa-header {
        padding: 14px 14px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .aiqa-title {
        font-weight: 800;
        letter-spacing: -0.2px;
      }
      .aiqa-body {
        flex: 1;
        overflow: auto;
        padding: 14px;
      }
      .aiqa-footer {
        border-top: 1px solid #e5e7eb;
        padding: 12px;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }
      .aiqa-input {
        width: 100%;
        min-height: 44px;
        max-height: 140px;
        resize: vertical;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        outline: none;
        font-size: 14px;
      }
      .aiqa-btn {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        font-weight: 700;
        cursor: pointer;
        background: #111827;
        color: #fff;
      }
      .aiqa-btn:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }
      .aiqa-msg {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 10px;
        background: #fafafa;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 14px;
        line-height: 1.5;
      }
      .aiqa-msg.me { background: #eef2ff; border-color: #c7d2fe; }
      .aiqa-msg.ai { background: #ecfeff; border-color: #a5f3fc; }

      /* Modal */
      .aiqa-modal-backdrop {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(0,0,0,0.55);
        z-index: 99999;
      }
      .aiqa-modal {
        width: min(520px, 92vw);
        border-radius: 18px;
        background: rgba(255,255,255,0.92);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.55);
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        padding: 22px 18px;
        text-align: center;
        cursor: pointer;
        user-select: none;
      }
      .aiqa-modal h2 {
        margin: 0 0 8px 0;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: -0.3px;
        color: #111827;
      }
      .aiqa-modal p {
        margin: 0;
        font-size: 14px;
        color: #374151;
      }
      .aiqa-badge {
        display: inline-flex;
        margin-top: 12px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #111827;
        color: #fff;
        font-weight: 800;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  function buildPanel(root) {
    root.innerHTML = `
      <div class="aiqa-panel">
        <div class="aiqa-header">
          <div class="aiqa-title">AIQOO Q&A</div>
          <div style="font-size:12px;color:#6b7280;">상태: <span id="aiqa-state">대기</span></div>
        </div>
        <div class="aiqa-body" id="aiqa-chat"></div>
        <div class="aiqa-footer">
          <textarea class="aiqa-input" id="aiqa-input" placeholder="질문을 입력하세요 (모달을 눌러 영상이 멈춘 후 질문 가능)"></textarea>
          <button class="aiqa-btn" id="aiqa-send" disabled>전송</button>
        </div>
      </div>
    `;
  }

  function showModal() {
    // 이미 떠 있으면 중복 생성 방지
    if (document.getElementById("aiqa-modal-backdrop")) return;

    const backdrop = document.createElement("div");
    backdrop.className = "aiqa-modal-backdrop";
    backdrop.id = "aiqa-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "aiqa-modal";
    modal.innerHTML = `
      <h2>${CFG.brandText}</h2>
      <p>여기를 클릭하면 강의가 멈추고 질문이 활성화됩니다.</p>
      <div class="aiqa-badge">CLICK TO ASK</div>
    `;

    modal.addEventListener("click", () => {
      const paused = pauseYouTube(); // 가능하면 pause
      safeLog("Modal clicked. pauseYouTube:", paused);

      hideModal();
      setQAEnabled(true);
      setState("질문 활성화");
      appendMsg("ai", "질문을 입력해 주세요. (현재는 데모 UI입니다)\nRAG/응답 API 연결은 다음 단계에서 붙이면 됩니다.");
    });

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    setState("재생 중 (모달 표시)");
  }

  function hideModal() {
    const el = document.getElementById("aiqa-modal-backdrop");
    if (el) el.remove();
  }

  function setState(text) {
    const el = document.getElementById("aiqa-state");
    if (el) el.textContent = text;
  }

  function setQAEnabled(enabled) {
    const input = document.getElementById("aiqa-input");
    const btn = document.getElementById("aiqa-send");
    if (input) input.disabled = !enabled;
    if (btn) btn.disabled = !enabled;
  }

  function appendMsg(who, text) {
    const chat = document.getElementById("aiqa-chat");
    if (!chat) return;
    const div = document.createElement("div");
    div.className = `aiqa-msg ${who === "me" ? "me" : "ai"}`;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  // =========================
  // Wire events
  // =========================
  function wireEvents() {
    const btn = document.getElementById("aiqa-send");
    const input = document.getElementById("aiqa-input");

    if (!btn || !input) return;

    btn.addEventListener("click", () => {
      const q = (input.value || "").trim();
      if (!q) return;

      appendMsg("me", q);
      input.value = "";

      // TODO: 여기에 기존 /api/ask 등 연결하면 됨
      // 지금은 데모 응답
      appendMsg("ai", `데모 응답: "${q}"\n(여기에 서버 호출 코드를 붙이시면 됩니다.)`);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        btn.click();
      }
    });
  }

  // =========================
  // Bootstrap
  // =========================
  function bootstrap() {
    try {
      injectBaseStyles();

      const root = document.getElementById(CFG.qaRootId);
      if (!root) {
        safeErr("qa root not found:", CFG.qaRootId);
        return;
      }

      buildPanel(root);
      wireEvents();

      // 초기에는 질문 비활성, 모달 표시
      setQAEnabled(false);
      showModal();

      safeLog("bootstrapped");
    } catch (e) {
      safeErr("bootstrap error:", e);
    }
  }

  // DOM ready 보장
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
