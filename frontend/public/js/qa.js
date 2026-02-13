/* qa.js (ENTRY)
 * - qa.html 전용 엔트리 스크립트
 * - 오버레이(질문 시작하기) → 부모에게 pause 요청 → paused 신호 받으면 입력 활성화
 * - 질문 전송: /api/answer
 * - 음성 전사: /api/stt
 * - 답변 크게보기: qa.html 내장 모달(#answerModal) 사용
 */

import { askQA } from "/js/service/api.service.js";
import { shareKakao, shareMail } from "/js/service/share.service.js";
import { createPlayerService } from "/js/service/player.service.js";
import { createSTTService } from "/js/service/stt.service.js";
import { createLectureStore } from "/js/core/store.js";
import { normalizeText, formatTime, snippet } from "/js/core/utils.js";
import { renderMarkdownSafe, bindMarkdownCopyButtons } from "/js/util/markdown.util.js";

(function () {
  "use strict";

  /* =========================
   * DOM
   * ========================= */
  const playOverlay = document.getElementById("playOverlay");
  const overlayBtn = document.getElementById("overlayBtn");
  const overlaySub = document.getElementById("overlaySub");

  const hintLabel = document.getElementById("hintLabel");
  const voiceBtn = document.getElementById("voiceBtn");
  const submitBtn = document.getElementById("submitBtn");
  const voiceStatus = document.getElementById("voiceStatus");

  const questionInput = document.getElementById("questionInput");
  const qaList = document.getElementById("qaList");
  const qaEmpty = document.getElementById("qaEmpty");

  const videoKeyLabel = document.getElementById("videoKeyLabel");
  const providerLabel = document.getElementById("providerLabel");

  const exampleChips = document.getElementById("exampleChips");

  const resetWrap = document.getElementById("resetWrap");
  const resetBtn = document.getElementById("resetBtn");
  const resetModal = document.getElementById("resetModal");
  const resetModalCancel = document.getElementById("resetModalCancel");
  const resetModalConfirm = document.getElementById("resetModalConfirm");

  const toTopBtn = document.getElementById("toTopBtn");

  // 답변 크게보기 모달(qa.html 내장)
  const answerModal = document.getElementById("answerModal");
  const answerModalBody = document.getElementById("answerModalBody");
  const answerModalMeta = document.getElementById("answerModalMeta");
  const answerCopyBtn = document.getElementById("answerCopyBtn");
  const answerCloseBtn = document.getElementById("answerCloseBtn");

  /* =========================
   * 상태
   * ========================= */
  const player = createPlayerService();

  let videoKey = "default";
  let videoUrl = "";
  let provider = "";
  let youtubeId = "";
  let lastTimeInfo = { t: 0, tLabel: "00:00", provider: "", youtubeId: "" };

  let canAsk = false;
  let isRecording = false;

  const store = createLectureStore(() => videoKey);

  /* =========================
   * UI 헬퍼
   * ========================= */
  function setOverlayVisible(visible) {
    if (!playOverlay) return;
    playOverlay.style.display = visible ? "grid" : "none";
    playOverlay.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function setAskEnabled(enabled) {
    canAsk = !!enabled;
    questionInput.disabled = !canAsk;
    submitBtn.disabled = !canAsk;
    voiceBtn.disabled = !canAsk;

    // 예시 칩도 같이
    const chips = exampleChips?.querySelectorAll("button.qa-chip") || [];
    chips.forEach((b) => (b.disabled = !canAsk));

    if (canAsk) {
      hintLabel.textContent = "📢 AIQOO에게 질문하세요!";
      hintLabel.classList.remove("aiqa-hint-pulse");
      setTimeout(() => questionInput.focus(), 0);
    } else {
      hintLabel.textContent = "⏸️ 질문하려면 ‘질문 시작하기’를 누르세요.";
      hintLabel.classList.add("aiqa-hint-pulse");
    }
  }

  function setVoiceStatus(msg) {
    if (voiceStatus) voiceStatus.textContent = msg || "";
  }

  function ensureEmptyState() {
    const items = store.load();
    if (qaEmpty) qaEmpty.style.display = items.length ? "none" : "block";
    if (resetWrap) resetWrap.classList.toggle("hidden", !items.length);
  }

  function scrollToBottom() {
    qaList.scrollTop = qaList.scrollHeight;
  }

  function showToTopIfNeeded() {
    if (!toTopBtn) return;
    const show = qaList.scrollTop > 250;
    toTopBtn.classList.toggle("hidden", !show);
  }

  function escapeAttr(s) {
    return String(s || "").replace(/"/g, "&quot;");
  }

  function appendItemToUI(item) {
    // item: {id, q, a, at, tLabel}
    const wrap = document.createElement("div");
    wrap.className =
      "rounded-xl border border-white/10 bg-white/[0.03] p-3.5 shadow-sm";

    wrap.innerHTML = `
      <div class="text-[11px] text-zinc-500 mb-2 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <span class="font-semibold text-zinc-400">⏱ ${escapeAttr(item.tLabel || "00:00")}</span>
          <span class="ml-2">${escapeAttr(item.at || "")}</span>
        </div>
        <div class="flex gap-1.5 shrink-0">
          <button type="button" class="qa-pill-btn qa-answer-zoombtn" data-act="expand">🔍 크게</button>
          <button type="button" class="qa-pill-btn qa-share-kakao" data-act="kakao">카카오</button>
          <button type="button" class="qa-pill-btn qa-share-mail" data-act="mail">메일</button>
        </div>
      </div>

      <div class="text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap break-words">
        <div class="font-semibold text-zinc-200">Q.</div>
        <div class="mt-1 text-zinc-200">${escapeAttr(item.q)}</div>
      </div>

      <div class="mt-3 text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap break-words">
        <div class="font-semibold text-zinc-200">A.</div>
        <div class="mt-1 text-zinc-100" data-answer></div>
      </div>
    `;

    const ansEl = wrap.querySelector("[data-answer]");
    ansEl.innerHTML = renderMarkdownSafe(item.a || "");
    bindMarkdownCopyButtons(ansEl);

    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      if (act === "expand") openAnswerModal(item);
      if (act === "kakao") shareKakao(item.a || "", { title: "AIQOO 답변 공유" });
      if (act === "mail") shareMail(item.a || "", { subject: "AIQOO 답변 공유" });
    });

    qaList.appendChild(wrap);
  }

  function renderAll() {
    qaList.innerHTML = "";
    const items = store.load();
    items.forEach(appendItemToUI);
    ensureEmptyState();
    scrollToBottom();
  }

  async function typeAnswerIntoItem(itemId, fullText) {
    // UI 상에서 마지막 항목의 answer 영역을 찾아 타이핑
    const cards = qaList.querySelectorAll("div.rounded-xl");
    let target = null;
    for (const c of cards) {
      // Q 텍스트로 찾기보단, id를 dataset으로 심어도 되지만 지금은 단순화:
      // 가장 마지막 카드가 방금 추가된 카드라는 전제
      target = c;
    }
    if (!target) return;

    const ansEl = target.querySelector("[data-answer]");
    if (!ansEl) return;

    ansEl.innerHTML = ""; // 타이핑
    const t = String(fullText || "");
    for (let i = 0; i < t.length; i++) {
      ansEl.textContent += t[i];
      if (i % 24 === 0) scrollToBottom();
      await new Promise((r) => setTimeout(r, 10));
    }

    // 타이핑 후 마크다운 렌더
    ansEl.innerHTML = renderMarkdownSafe(t);
    bindMarkdownCopyButtons(ansEl);
    scrollToBottom();
  }

  /* =========================
   * 모달(답변 크게보기)
   * ========================= */
  function openAnswerModal(item) {
    if (!answerModal) return;

    const meta = [
      `강의키: ${videoKey}`,
      `시간: ${item.tLabel || "00:00"}`,
      provider ? `provider: ${provider}` : "",
      youtubeId ? `youtubeId: ${youtubeId}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    answerModalMeta.textContent = meta;
    answerModalBody.innerHTML = renderMarkdownSafe(item.a || "");
    bindMarkdownCopyButtons(answerModalBody);

    answerModal.classList.remove("hidden");
    answerModal.classList.add("flex");
    answerModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("qa-modal-open");
  }

  function closeAnswerModal() {
    if (!answerModal) return;
    answerModal.classList.add("hidden");
    answerModal.classList.remove("flex");
    answerModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("qa-modal-open");
  }

  async function copyAnswerModalText() {
    try {
      const txt = answerModalBody?.innerText || "";
      await navigator.clipboard.writeText(txt);
      const old = answerCopyBtn.textContent;
      answerCopyBtn.textContent = "복사됨";
      setTimeout(() => (answerCopyBtn.textContent = old), 900);
    } catch {
      const old = answerCopyBtn.textContent;
      answerCopyBtn.textContent = "실패";
      setTimeout(() => (answerCopyBtn.textContent = old), 900);
    }
  }

  /* =========================
   * 질문 전송
   * ========================= */
  async function sendQuestion(text) {
    const q = normalizeText(text);
    if (!q) return;

    // 항상 최신 시간 요청
    lastTimeInfo = await player.requestTime();

    const item = {
      id: String(Date.now()) + ":" + Math.random().toString(16).slice(2),
      q,
      a: "",
      at: formatTime(),
      tLabel: lastTimeInfo.tLabel || "00:00",
    };

    const items = store.load();
    items.push(item);
    store.save(items);

    appendItemToUI(item);
    ensureEmptyState();
    scrollToBottom();

    // 버튼 잠금(중복 전송 방지)
    setAskEnabled(false);
    submitBtn.textContent = "⏳ 생성 중...";

    try {
      const answer = await askQA({
        question: q,
        videoKey,
        videoUrl,
        provider,
        youtubeId,
        t: lastTimeInfo.t,
        tLabel: lastTimeInfo.tLabel,
      });

      item.a = String(answer || "").trim();
      const items2 = store.load().map((x) => (x.id === item.id ? item : x));
      store.save(items2);

      // 타이핑 출력
      await typeAnswerIntoItem(item.id, item.a);
    } catch (err) {
      console.error(err);
      item.a = `오류: ${err?.message || "답변 생성 실패"}`;
      const items2 = store.load().map((x) => (x.id === item.id ? item : x));
      store.save(items2);
      renderAll();
    } finally {
      submitBtn.textContent = "📄 텍스트 질문";
      setAskEnabled(true);
      questionInput.value = "";
      questionInput.focus();
    }
  }

  /* =========================
   * 음성(STT)
   * ========================= */
  const stt = createSTTService(
    (msg) => setVoiceStatus(msg),
    (text) => {
      // 전사 텍스트를 입력창에 넣되, 기존 내용이 있으면 줄바꿈으로 누적
      const cur = (questionInput.value || "").trim();
      questionInput.value = cur ? cur + "\n" + text : text;
      questionInput.focus();
    }
  );

  async function toggleRecording() {
    if (!canAsk) return;

    if (!isRecording) {
      isRecording = true;
      voiceBtn.textContent = "⏹️ 음성 종료";
      try {
        await stt.start();
      } catch (err) {
        console.error(err);
        setVoiceStatus("❗ 마이크 접근 실패");
        isRecording = false;
        voiceBtn.textContent = "🎤 음성 질문";
      }
    } else {
      isRecording = false;
      voiceBtn.textContent = "🎤 음성 질문";
      try {
        stt.stop();
      } catch (err) {
        console.error(err);
      }
    }
  }

  /* =========================
   * Reset
   * ========================= */
  function openResetModal() {
    if (!resetModal) return;
    resetModal.classList.remove("hidden");
    resetModal.classList.add("flex");
    resetModal.setAttribute("aria-hidden", "false");
  }
  function closeResetModal() {
    if (!resetModal) return;
    resetModal.classList.add("hidden");
    resetModal.classList.remove("flex");
    resetModal.setAttribute("aria-hidden", "true");
  }

  function doReset() {
    store.clear();
    renderAll();
    closeResetModal();
  }

  /* =========================
   * 부모(플레이어) 메시지 처리
   * ========================= */
  player.onMessage((msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === "videoInfo") {
      videoKey = msg.videoKey || "default";
      videoUrl = msg.videoUrl || "";
      provider = msg.provider || "";
      youtubeId = msg.youtubeId || "";

      if (videoKeyLabel) videoKeyLabel.textContent = videoKey;
      if (providerLabel)
        providerLabel.textContent = provider ? `· ${provider}${youtubeId ? `(${youtubeId})` : ""}` : "";

      renderAll();
      return;
    }

    if (msg.type === "videoPlaying") {
      // 재생 중에는 오버레이 보여주고, 질문 비활성화
      setOverlayVisible(true);
      setAskEnabled(false);
      overlaySub.textContent = "🏃 질문 시작하기";
      return;
    }

    if (msg.type === "videoPaused") {
      // 멈추면 오버레이 숨기고 질문 활성화
      setOverlayVisible(false);
      setAskEnabled(true);
      return;
    }
  });

  /* =========================
   * 이벤트 바인딩
   * ========================= */
  // 오버레이 클릭: 부모에게 pause 요청
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      overlaySub.textContent = "⏸️ 영상 멈추는 중...";
      player.notifyPause(); // 부모(index.js)가 pause 처리 후 videoPaused를 보내줌
      // 혹시 부모가 바로 못 보내는 경우 대비: 짧게 비활성 유지
      setAskEnabled(false);
    });
  }

  // 텍스트 질문 버튼
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      const t = (questionInput.value || "").trim();
      if (!t) return;
      sendQuestion(t);
    });
  }

  // Enter 전송 / Shift+Enter 줄바꿈
  if (questionInput) {
    questionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitBtn?.click();
      }
    });
  }

  // 예시 칩 클릭 → 입력창에 넣기
  if (exampleChips) {
    exampleChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-example]");
      if (!btn || !canAsk) return;
      const ex = btn.getAttribute("data-example") || "";
      questionInput.value = ex;
      questionInput.focus();
    });
  }

  // 음성 버튼
  if (voiceBtn) voiceBtn.addEventListener("click", toggleRecording);

  // TOP 버튼
  if (qaList) {
    qaList.addEventListener("scroll", showToTopIfNeeded);
  }
  if (toTopBtn) {
    toTopBtn.addEventListener("click", () => {
      qaList.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // reset
  if (resetBtn) resetBtn.addEventListener("click", openResetModal);
  if (resetModalCancel) resetModalCancel.addEventListener("click", closeResetModal);
  if (resetModalConfirm) resetModalConfirm.addEventListener("click", doReset);

  // 답변 크게보기 모달
  if (answerCloseBtn) answerCloseBtn.addEventListener("click", closeAnswerModal);
  if (answerCopyBtn) answerCopyBtn.addEventListener("click", copyAnswerModalText);
  if (answerModal) {
    answerModal.addEventListener("click", (e) => {
      if (e.target?.getAttribute("data-close") === "1") closeAnswerModal();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAnswerModal();
  });

  /* =========================
   * 초기화
   * ========================= */
  // 최초에는 “재생중”으로 간주해서 오버레이를 띄워두고 비활성
  setOverlayVisible(true);
  setAskEnabled(false);
  ensureEmptyState();

  // 부모에게 준비 완료 알림 (index.js가 videoInfo/state를 다시 보내게 됨)
  try {
    window.parent.postMessage({ type: "qaReady" }, "*");
  } catch (_) {}
})();
