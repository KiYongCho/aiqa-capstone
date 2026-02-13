/* qa.view.js
 * - QA UI 마운트 + show/hide + 상태/리스트/타이핑 출력 핸들 제공
 * - 최초 로딩에서 QA 레이어가 iframe 뒤로 깔리거나 display:none으로 안 보이는 문제 방지
 */

export function mountQA(rootEl, handlers = {}) {
  if (!rootEl) throw new Error("[qa.view] rootEl is required");

  // rootEl 내부에 이미 QA가 있으면 재사용
  let layer = rootEl.querySelector(".aiqoo-qa-layer");
  if (!layer) {
    layer = document.createElement("section");
    layer.className = "aiqoo-qa-layer";
    rootEl.appendChild(layer);
  }

  // ✅ 레이어가 “안 보이는 문제” 방지: fixed + 초고 z-index
  // - 유튜브 iframe은 종종 z-index 경쟁이 있어서 fixed + 큰 z-index가 안전합니다.
  Object.assign(layer.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    width: "min(520px, calc(100vw - 32px))",
    height: "min(640px, calc(100vh - 32px))",
    background: "rgba(17, 24, 39, 0.92)", // 다크 패널
    color: "#fff",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    overflow: "hidden",
    zIndex: "2147483647", // ✅ 매우 크게
    display: "none", // 기본은 숨김 (질문 시작하기로 show)
  });

  // 내부 레이아웃
  layer.innerHTML = `
    <div class="aiqoo-qa-wrap" style="display:flex; flex-direction:column; height:100%;">
      <header style="padding:12px 14px; border-bottom:1px solid rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="font-weight:700;">AIQOO Q&A</div>
          <div class="aiqoo-qa-status" style="font-size:12px; opacity:0.85;"></div>
        </div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="aiqoo-qa-min-btn"
            style="cursor:pointer; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff;">
            숨기기
          </button>
        </div>
      </header>

      <main class="aiqoo-qa-list"
        style="flex:1; padding:12px 14px; overflow:auto; display:flex; flex-direction:column; gap:10px;">
      </main>

      <footer style="padding:12px 14px; border-top:1px solid rgba(255,255,255,0.12);">
        <form class="aiqoo-qa-form" style="display:flex; gap:8px;">
          <textarea class="aiqoo-qa-input" rows="2" placeholder="질문을 입력하세요 (Enter=전송 / Shift+Enter=줄바꿈)"
            style="flex:1; resize:none; padding:10px 12px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff; outline:none;"></textarea>
          <button type="submit" class="aiqoo-qa-send"
            style="cursor:pointer; padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.12); color:#fff; font-weight:700;">
            전송
          </button>
        </form>

        <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
          <button type="button" class="aiqoo-qa-expand"
            style="cursor:pointer; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff;">
            답변 크게보기
          </button>
          <button type="button" class="aiqoo-qa-share-kakao"
            style="cursor:pointer; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff;">
            카카오 공유
          </button>
          <button type="button" class="aiqoo-qa-share-mail"
            style="cursor:pointer; padding:8px 10px; border-radius:10px; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06); color:#fff;">
            메일 공유
          </button>
        </div>
      </footer>
    </div>
  `;

  const listEl = layer.querySelector(".aiqoo-qa-list");
  const statusEl = layer.querySelector(".aiqoo-qa-status");
  const formEl = layer.querySelector(".aiqoo-qa-form");
  const inputEl = layer.querySelector(".aiqoo-qa-input");
  const sendBtn = layer.querySelector(".aiqoo-qa-send");
  const minBtn = layer.querySelector(".aiqoo-qa-min-btn");
  const expandBtn = layer.querySelector(".aiqoo-qa-expand");
  const kakaoBtn = layer.querySelector(".aiqoo-qa-share-kakao");
  const mailBtn = layer.querySelector(".aiqoo-qa-share-mail");

  let lastAnswerText = "";

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function clearQuestion() {
    inputEl.value = "";
  }

  function lock(locked) {
    inputEl.disabled = locked;
    sendBtn.disabled = locked;
    if (locked) {
      sendBtn.style.opacity = "0.65";
      sendBtn.style.cursor = "not-allowed";
    } else {
      sendBtn.style.opacity = "1";
      sendBtn.style.cursor = "pointer";
    }
  }

  function appendBubble(role, text) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = role === "user" ? "flex-end" : "flex-start";

    const bubble = document.createElement("div");
    bubble.style.maxWidth = "85%";
    bubble.style.whiteSpace = "pre-wrap";
    bubble.style.wordBreak = "break-word";
    bubble.style.padding = "10px 12px";
    bubble.style.borderRadius = "14px";
    bubble.style.border = "1px solid rgba(255,255,255,0.14)";
    bubble.style.background =
      role === "user" ? "rgba(59,130,246,0.28)" : "rgba(255,255,255,0.08)";
    bubble.textContent = text || "";

    row.appendChild(bubble);
    listEl.appendChild(row);
    listEl.scrollTop = listEl.scrollHeight;

    return bubble;
  }

  function appendQA({ questionText }) {
    appendBubble("user", questionText);

    const answerBubble = appendBubble("assistant", "");
    lastAnswerText = "";

    return {
      // 즉시 답변 출력
      setAnswerInstant(text) {
        lastAnswerText = String(text || "");
        answerBubble.textContent = lastAnswerText;
        listEl.scrollTop = listEl.scrollHeight;
      },

      // 타이핑 출력(시뮬레이션)
      async typeAnswer(text) {
        const full = String(text || "");
        lastAnswerText = full;

        answerBubble.textContent = "";
        for (let i = 0; i < full.length; i++) {
          answerBubble.textContent += full[i];
          // 너무 느리면 답답하니 8~12ms 정도
          await new Promise((r) => setTimeout(r, 10));
          if (i % 20 === 0) listEl.scrollTop = listEl.scrollHeight;
        }
        listEl.scrollTop = listEl.scrollHeight;
      },

      getAnswerText() {
        return lastAnswerText;
      },
    };
  }

  // submit 핸들
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (inputEl.value || "").trim();
    if (!text) return;

    lock(true);
    try {
      await handlers.onSend?.(text);
    } finally {
      lock(false);
      inputEl.focus();
    }
  });

  // Enter=전송 / Shift+Enter=줄바꿈
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formEl.requestSubmit?.();
    }
  });

  // 숨기기
  minBtn.addEventListener("click", () => {
    ui.hide();
  });

  // 크게보기
  expandBtn.addEventListener("click", () => {
    handlers.onExpand?.(lastAnswerText || "");
  });

  // 공유
  kakaoBtn.addEventListener("click", () => {
    handlers.onShareKakao?.(lastAnswerText || "");
  });
  mailBtn.addEventListener("click", () => {
    handlers.onShareMail?.(lastAnswerText || "");
  });

  const ui = {
    el: layer,
    show() {
      layer.style.display = "block";
      // 보이자마자 포커스
      setTimeout(() => inputEl.focus(), 0);
    },
    hide() {
      layer.style.display = "none";
    },
    setStatus,
    clearQuestion,
    appendQA,
  };

  return ui;
}
