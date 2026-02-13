/* qa.view.js
 * - 타이핑 스트리밍(시뮬레이션) 반영
 * - 타이핑 중: plain text(pre-wrap)
 * - 타이핑 완료: markdown 렌더링(코드블록 스타일)
 */

import { renderMarkdownSafe, bindMarkdownCopyButtons } from "/js/util/markdown.util.js";

const ICONS = {
  question: `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16v12H7l-3 3V4z" fill="currentColor" opacity="0.9"></path>
      <path d="M9 8h6v2H9V8zm0 4h9v2H9v-2z" fill="white" opacity="0.95"></path>
    </svg>
  `,
  answer: `
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a8 8 0 0 0-8 8v4a6 6 0 0 0 6 6h7l3 2v-4a8 8 0 0 0 0-16h-8z" fill="currentColor" opacity="0.9"></path>
      <path d="M8.5 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="white" opacity="0.95"></path>
    </svg>
  `,
  expand: `
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 14H5v5h5v-2H7v-3zm12 5v-5h-2v3h-3v2h5zM7 7h3V5H5v5h2V7zm12 3V5h-5v2h3v3h2z" fill="currentColor"></path>
    </svg>
  `,
  kakao: `
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3C6.7 3 2.4 6.4 2.4 10.6c0 2.6 1.6 5 4.1 6.4l-.9 3.3c-.1.4.3.7.7.5l3.8-2.5c.6.1 1.2.2 1.9.2 5.3 0 9.6-3.4 9.6-7.6S17.3 3 12 3z" fill="currentColor"></path>
    </svg>
  `,
  mail: `
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" fill="currentColor"></path>
    </svg>
  `,
};

function ensureBaseStyles() {
  if (document.getElementById("aiqoo-qa-style")) return;

  const style = document.createElement("style");
  style.id = "aiqoo-qa-style";
  style.textContent = `
    .aiqoo-qa { font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans KR", sans-serif; }
    .aiqoo-qa .row { display:flex; gap:10px; align-items:center; }
    .aiqoo-qa .col { display:flex; flex-direction:column; gap:10px; }
    .aiqoo-qa .card { background:#111827; color:#e5e7eb; border:1px solid #1f2937; border-radius:14px; padding:12px; }
    .aiqoo-qa .muted { color:#9ca3af; font-size:12px; }
    .aiqoo-qa .btn { cursor:pointer; border:1px solid #374151; background:#0b1220; color:#e5e7eb; border-radius:12px; padding:8px 10px; font-size:13px; }
    .aiqoo-qa .btn:hover { background:#0f1a33; }
    .aiqoo-qa .btn.small { padding:6px 8px; font-size:12px; border-radius:10px; }
    .aiqoo-qa .btn.ghost { background:transparent; }
    .aiqoo-qa .chips { display:flex; flex-wrap:wrap; gap:8px; }
    .aiqoo-qa textarea { width:100%; min-height:84px; resize:vertical; border-radius:12px; border:1px solid #374151; background:#0b1220; color:#e5e7eb; padding:10px; font-size:14px; outline:none; }
    .aiqoo-qa textarea:focus { border-color:#60a5fa; box-shadow:0 0 0 3px rgba(96,165,250,0.15); }
    .aiqoo-qa .msg { display:flex; gap:10px; align-items:flex-start; }
    .aiqoo-qa .icon { width:28px; height:28px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:#0b1220; border:1px solid #374151; color:#93c5fd; flex:0 0 auto; }
    .aiqoo-qa .bubble { flex:1; }
    .aiqoo-qa .bubble .header { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; }
    .aiqoo-qa .bubble .actions { display:flex; gap:6px; align-items:center; }
    .aiqoo-qa .divider { height:1px; background:#1f2937; margin:10px 0; }
    .aiqoo-qa .topline { display:flex; justify-content:space-between; align-items:center; gap:10px; }
    .aiqoo-qa .title { font-weight:700; font-size:14px; color:#f3f4f6; }

    /* 타이핑 중 텍스트(plain) */
    .aiqoo-qa .typing-text{
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.55;
      font-size: 14px;
      color:#e5e7eb;
    }
    .aiqoo-qa .caret{
      display:inline-block;
      width: 8px;
      margin-left: 2px;
      opacity: 0.9;
      animation: aiqoo-blink 1s step-end infinite;
    }
    @keyframes aiqoo-blink { 50% { opacity: 0; } }

    /* 마크다운 스타일 */
    .aiqoo-qa .md-text { line-height: 1.6; font-size: 14px; color:#e5e7eb; word-break: break-word; }
    .aiqoo-qa .md-inline-code{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 0.92em;
      background: rgba(148,163,184,0.15);
      border: 1px solid rgba(148,163,184,0.25);
      padding: 2px 6px;
      border-radius: 8px;
      color:#f3f4f6;
    }
    .aiqoo-qa .md-codeblock{
      border:1px solid #374151;
      border-radius: 12px;
      overflow:hidden;
      background:#0b1220;
      margin: 10px 0;
    }
    .aiqoo-qa .md-codebar{
      display:flex;
      justify-content:space-between;
      align-items:center;
      padding: 8px 10px;
      border-bottom:1px solid #1f2937;
      background: rgba(17,24,39,0.65);
    }
    .aiqoo-qa .md-lang{ font-size: 12px; color:#9ca3af; }
    .aiqoo-qa .md-copy-btn{
      cursor:pointer;
      border:1px solid #374151;
      background: transparent;
      color:#e5e7eb;
      border-radius:10px;
      padding: 6px 8px;
      font-size: 12px;
    }
    .aiqoo-qa .md-copy-btn:hover{ background:#0f1a33; }
    .aiqoo-qa .md-pre{ margin:0; padding: 10px; overflow:auto; }
    .aiqoo-qa .md-code{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.5;
      color:#e5e7eb;
    }
  `;
  document.head.appendChild(style);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 단발 응답을 “타이핑처럼” 출력하는 시뮬레이션
 * - 너무 빠르지 않게, 너무 느리지 않게
 * - 공백/줄바꿈은 약간 빠르게
 */
async function typewriter({
  fullText,
  onChunk,
  onDone,
  signal,
}) {
  const text = String(fullText || "");
  let i = 0;

  // 튜닝 파라미터
  const baseDelay = 8;     // 기본 지연(ms)
  const spaceDelay = 0;    // 공백은 더 빠르게
  const newlineDelay = 0;  // 줄바꿈도 빠르게
  const burst = 3;         // 한 번에 몇 글자씩 출력할지(성능/자연스러움 균형)

  while (i < text.length) {
    if (signal?.aborted) return;

    const next = text.slice(i, i + burst);
    i += burst;

    onChunk(next);

    // 마지막 글자 기준 지연 가중치
    const lastChar = next[next.length - 1];
    let delay = baseDelay;

    if (lastChar === " ") delay += spaceDelay;
    else if (lastChar === "\n") delay += newlineDelay;
    else if (/[.,!?]/.test(lastChar)) delay += 35; // 문장 부호는 약간 멈춤

    // 가끔씩 랜덤 흔들림
    delay += Math.floor(Math.random() * 12);

    await sleep(delay);
  }

  onDone?.();
}

export function mountQA(rootEl, handlers = {}) {
  ensureBaseStyles();

  rootEl.innerHTML = `
    <div class="aiqoo-qa">
      <div class="card col">
        <div class="topline">
          <div class="title">AI Q&A</div>
          <div class="muted" id="aiqoo-status">대기</div>
        </div>

        <textarea id="aiqoo-question" placeholder="질문을 입력하세요..."></textarea>

        <div class="chips" id="aiqoo-presets">
          <button class="btn small ghost" data-preset="concept">개념 요약</button>
          <button class="btn small ghost" data-preset="daily">일상 예시</button>
          <button class="btn small ghost" data-preset="terms">용어 5개</button>
          <button class="btn small ghost" data-preset="code">예제 코드</button>
        </div>

        <div class="row" style="justify-content:flex-end;">
          <button class="btn" id="aiqoo-send">질문하기</button>
        </div>

        <div class="divider"></div>

        <div class="col" id="aiqoo-thread"></div>
      </div>
    </div>
  `;

  const $status = rootEl.querySelector("#aiqoo-status");
  const $question = rootEl.querySelector("#aiqoo-question");
  const $send = rootEl.querySelector("#aiqoo-send");
  const $thread = rootEl.querySelector("#aiqoo-thread");
  const $presets = rootEl.querySelector("#aiqoo-presets");

  $presets.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-preset]");
    if (!btn) return;

    const type = btn.getAttribute("data-preset");
    const templates = {
      concept: "지금 강의 내용 기준으로 핵심 개념을 5줄 이내로 요약해 주세요.",
      daily: "지금 강의 개념을 현실/일상에서 비유로 쉽게 설명해 주세요.",
      terms: "지금 강의에서 등장한 핵심 용어 5개를 뽑아 정의와 함께 정리해 주세요.",
      code: "지금 강의 개념을 이해할 수 있는 최소 예제 코드를 작성해 주세요. (주석 포함)",
    };

    const toInsert = templates[type] || "";
    if (!toInsert) return;

    const cur = $question.value.trim();
    $question.value = cur ? `${cur}\n\n${toInsert}` : toInsert;
    $question.focus();
    $question.selectionStart = $question.selectionEnd = $question.value.length;
  });

  $send.addEventListener("click", () => {
    const text = ($question.value || "").trim();
    if (!text) return;
    handlers.onSend?.(text);
  });

  $question.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $send.click();
    }
  });

  return {
    setStatus(text) {
      $status.textContent = text || "대기";
    },

    clearQuestion() {
      $question.value = "";
    },

    appendQA({ questionText }) {
      // Q
      const q = document.createElement("div");
      q.className = "msg";
      q.innerHTML = `
        <div class="icon" title="질문">${ICONS.question}</div>
        <div class="bubble">
          <div class="md-text"></div>
        </div>
      `;
      q.querySelector(".md-text").textContent = questionText || "";
      $thread.appendChild(q);

      // A
      const a = document.createElement("div");
      a.className = "msg";
      a.__answerText = "";
      a.__typingController = null;

      a.innerHTML = `
        <div class="icon" title="답변" style="color:#a7f3d0;">${ICONS.answer}</div>
        <div class="bubble">
          <div class="header">
            <div class="muted">AI 답변</div>
            <div class="actions" data-role="actions" style="display:none;">
              <button class="btn small ghost" data-act="expand" title="크게보기">${ICONS.expand}</button>
              <button class="btn small ghost" data-act="kakao" title="카톡 공유">${ICONS.kakao}</button>
              <button class="btn small ghost" data-act="mail" title="메일">${ICONS.mail}</button>
            </div>
          </div>

          <!-- 타이핑 표시 영역 -->
          <div class="typing-text" data-role="typing"></div>

          <!-- 최종 마크다운 렌더 영역 -->
          <div class="md-render" data-role="render" style="display:none;"></div>
        </div>
      `;

      const $typing = a.querySelector('[data-role="typing"]');
      const $render = a.querySelector('[data-role="render"]');
      const $actions = a.querySelector('[data-role="actions"]');

      // 액션 핸들러
      $actions.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const act = btn.getAttribute("data-act");
        const currentText = a.__answerText || "";

        if (act === "expand") handlers.onExpand?.(currentText);
        if (act === "kakao") handlers.onShareKakao?.(currentText);
        if (act === "mail") handlers.onShareMail?.(currentText);
      });

      $thread.appendChild(a);
      $thread.scrollTop = $thread.scrollHeight;

      function stopTyping() {
        if (a.__typingController) {
          a.__typingController.abort();
          a.__typingController = null;
        }
      }

      function showCaret() {
        // 캐럿 표시(타이핑 느낌)
        if (!$typing.querySelector(".caret")) {
          const caret = document.createElement("span");
          caret.className = "caret";
          caret.textContent = "▍";
          $typing.appendChild(caret);
        }
      }

      function hideCaret() {
        const c = $typing.querySelector(".caret");
        if (c) c.remove();
      }

      return {
        // 타이핑 시작/진행/완료
        async typeAnswer(answerText) {
          stopTyping();

          a.__answerText = String(answerText || "");
          $actions.style.display = "none";

          // 타이핑용 영역 표시
          $typing.style.display = "block";
          $render.style.display = "none";

          // 초기화
          $typing.textContent = "";
          showCaret();

          const controller = new AbortController();
          a.__typingController = controller;

          let buffer = "";

          await typewriter({
            fullText: a.__answerText,
            signal: controller.signal,
            onChunk(chunk) {
              buffer += chunk;

              // caret 유지하면서 텍스트 갱신
              const caret = $typing.querySelector(".caret");
              if (caret) caret.remove();
              $typing.textContent = buffer;
              showCaret();

              $thread.scrollTop = $thread.scrollHeight;
            },
            onDone() {
              hideCaret();

              // 최종: 마크다운 렌더로 스왑
              $render.innerHTML = renderMarkdownSafe(a.__answerText);
              bindMarkdownCopyButtons($render);

              $typing.style.display = "none";
              $render.style.display = "block";

              $actions.style.display = "flex";
              $thread.scrollTop = $thread.scrollHeight;

              a.__typingController = null;
            },
          });
        },

        // 오류 등 즉시 표시가 필요할 때(타이핑 없이)
        setAnswerInstant(answerText) {
          stopTyping();
          a.__answerText = String(answerText || "");

          hideCaret();
          $typing.style.display = "none";
          $render.style.display = "block";

          $render.innerHTML = renderMarkdownSafe(a.__answerText);
          bindMarkdownCopyButtons($render);

          $actions.style.display = "flex";
          $thread.scrollTop = $thread.scrollHeight;
        },

        cancelTyping() {
          stopTyping();
          hideCaret();
        },
      };
    },
  };
}
