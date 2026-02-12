// public/js/qa.js (ENTRY MODULE)
// - 카톡 공유/메일 공유/크게보기 버튼 복구
// - 절대경로 import (public 기준)

import { createLectureStore } from "/js/core/store.js";
import { normalizeText, formatTime, snippet } from "/js/core/utils.js";
import { askLLM } from "/js/services/api.service.js";
import { createPlayerService } from "/js/services/player.service.js";
import { createSTTService } from "/js/services/stt.service.js";
import { createShareService } from "/js/services/share.service.js";
import { renderQA } from "/js/ui/qa.view.js";
import { createModal } from "/js/ui/modal.view.js";

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const playOverlay = $("playOverlay");
  const overlayBtn = $("overlayBtn");

  const voiceBtn = $("voiceBtn");
  const submitBtn = $("submitBtn");
  const voiceStatus = $("voiceStatus");

  const questionInput = $("questionInput");
  const qaList = $("qaList");
  const qaEmpty = $("qaEmpty");

  const videoKeyLabel = $("videoKeyLabel");
  const providerLabel = $("providerLabel");

  const resetWrap = $("resetWrap");
  const resetBtn = $("resetBtn");
  const toTopBtn = $("toTopBtn");

  // answer modal
  const answerModal = $("answerModal");
  const answerModalBody = $("answerModalBody");
  const answerModalMeta = $("answerModalMeta");
  const answerCopyBtn = $("answerCopyBtn");
  const answerCloseBtn = $("answerCloseBtn");

  const answerModalApi = createModal(answerModal, answerModalBody);

  // --------------------------
  // Kakao key (여기서 설정)
  // --------------------------
  // ✅ 1) 가장 쉬운 방법: qa.html <body data-kakao-key="YOUR_KEY">
  // ✅ 2) 또는 localStorage "AIQOO_KAKAO_KEY"
  const kakaoKey =
    document.body?.dataset?.kakaoKey ||
    localStorage.getItem("AIQOO_KAKAO_KEY") ||
    "";

  const share = createShareService(kakaoKey);

  // --------------------------
  // State
  // --------------------------
  const player = createPlayerService();

  let provider = "native";
  let youtubeId = "";
  let videoUrl = "";
  let videoKey = "default";
  let isPlaying = false;

  const store = createLectureStore(() => videoKey);
  let items = store.load();

  // --------------------------
  // Helpers
  // --------------------------
  function setOverlayVisible(show) {
    if (!playOverlay) return;
    playOverlay.classList.toggle("hidden", !show);
    playOverlay.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function setInputsEnabled(enabled) {
    if (questionInput) questionInput.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
    if (voiceBtn) voiceBtn.disabled = !enabled;
  }

  function setVoiceStatus(text) {
    if (voiceStatus) voiceStatus.textContent = text || "";
  }

  function syncLabels() {
    if (videoKeyLabel) videoKeyLabel.textContent = videoKey || "default";
    if (providerLabel) {
      const extra = provider === "youtube" ? `YouTube${youtubeId ? ` (${youtubeId})` : ""}` : "Native";
      providerLabel.textContent = `(${extra})`;
    }
  }

  function render() {
    if (qaEmpty) qaEmpty.classList.toggle("hidden", items.length !== 0);
    renderQA(qaList, items);
    if (resetWrap) resetWrap.classList.toggle("hidden", items.length === 0);

    if (toTopBtn && qaList) {
      const need = qaList.scrollHeight > qaList.clientHeight + 10;
      toTopBtn.classList.toggle("hidden", !need);
    }
  }

  function safePushItem(q, a, timeInfo) {
    const it = {
      question: q,
      answer: a,
      t: timeInfo?.t ?? 0,
      tLabel: timeInfo?.tLabel ?? "00:00",
      provider: timeInfo?.provider ?? provider,
      youtubeId: timeInfo?.youtubeId ?? youtubeId,
      createdAt: formatTime(),
    };
    items.push(it);
    store.save(items);
    render();
  }

  function getItemByIndex(index) {
    const i = Number(index);
    if (!Number.isFinite(i) || i < 0 || i >= items.length) return null;
    return items[i];
  }

  function getParentUrlSafe() {
    try {
      return window.parent?.location?.href || window.location.href;
    } catch {
      return window.location.href;
    }
  }

  function makeShareText(item) {
    const head = `AIQOO Q&A (${item.tLabel || "00:00"})`;
    const q = normalizeText(item.question || "");
    const a = normalizeText(item.answer || "");
    // 카톡은 너무 길면 전송이 불안정할 수 있어 요약
    return `${head}\n\nQ) ${snippet(q, 140)}\n\nA) ${snippet(a, 220)}`;
  }

  function makeMailBody(item) {
    const url = getParentUrlSafe();
    const q = normalizeText(item.question || "");
    const a = normalizeText(item.answer || "");
    return `AIQOO Q&A 공유\n\n- 시각: ${item.tLabel || "00:00"}\n- 생성: ${item.createdAt || ""}\n- 영상키: ${videoKey}\n- 링크: ${url}\n\n[Q]\n${q}\n\n[A]\n${a}\n`;
  }

  // --------------------------
  // Parent <-> iframe messaging
  // --------------------------
  player.onMessage((msg) => {
    if (msg.type === "videoInfo") {
      videoKey = msg.videoKey || "default";
      videoUrl = msg.videoUrl || "";
      provider = msg.provider || "native";
      youtubeId = msg.youtubeId || "";
      syncLabels();

      items = store.load();
      render();
      return;
    }

    if (msg.type === "videoPlaying") {
      isPlaying = true;
      setInputsEnabled(false);
      setOverlayVisible(true);
      return;
    }

    if (msg.type === "videoPaused") {
      isPlaying = false;
      setOverlayVisible(false);
      setInputsEnabled(true);
      return;
    }
  });

  window.parent.postMessage({ type: "qaReady" }, "*");

  // --------------------------
  // Overlay
  // --------------------------
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      player.notifyPause();
      setOverlayVisible(false);
      setInputsEnabled(true);
      setTimeout(() => questionInput?.focus(), 0);
    });
  }

  // --------------------------
  // Example chips
  // --------------------------
  const exampleWrap = $("exampleChips");
  if (exampleWrap) {
    exampleWrap.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-example]");
      if (!btn) return;
      const text = btn.getAttribute("data-example") || "";
      if (questionInput) questionInput.value = text;
      questionInput?.focus();
    });
  }

  // --------------------------
  // TOP button
  // --------------------------
  if (toTopBtn && qaList) {
    toTopBtn.addEventListener("click", () => {
      qaList.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // --------------------------
  // ✅ Q&A item action buttons (zoom/kakao/mail)
  // --------------------------
  if (qaList) {
    qaList.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const index = btn.getAttribute("data-index");
      const item = getItemByIndex(index);
      if (!item) return;

      if (action === "zoom") {
        if (answerModalMeta) {
          answerModalMeta.textContent = `${item.createdAt || ""} · ${item.tLabel || "00:00"} · ${item.provider || ""}`;
        }
        document.documentElement.classList.add("qa-modal-open");
        answerModalApi.open(item.answer || "");
        return;
      }

      if (action === "kakao") {
        const link = getParentUrlSafe();
        const text = makeShareText(item);
        await share.shareKakao(text, link);
        return;
      }

      if (action === "mail") {
        const subject = `AIQOO Q&A 공유 (${item.tLabel || "00:00"})`;
        const body = makeMailBody(item);
        share.shareMail(subject, body);
        return;
      }
    });
  }

  if (answerCloseBtn) {
    answerCloseBtn.addEventListener("click", () => {
      document.documentElement.classList.remove("qa-modal-open");
      answerModalApi.close();
    });
  }
  if (answerModal) {
    answerModal.addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") {
        document.documentElement.classList.remove("qa-modal-open");
        answerModalApi.close();
      }
    });
  }
  if (answerCopyBtn) {
    answerCopyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(answerModalBody?.textContent || "");
        alert("복사되었습니다.");
      } catch {
        alert("복사 실패");
      }
    });
  }

  // --------------------------
  // STT (voice)
  // --------------------------
  const stt = createSTTService(
    (status) => setVoiceStatus(status),
    (text) => {
      if (questionInput) questionInput.value = text || "";
      questionInput?.focus();
    }
  );

  if (voiceBtn) {
    let recording = false;

    voiceBtn.addEventListener("click", async () => {
      if (isPlaying) {
        player.notifyPause();
        return;
      }

      if (!recording) {
        recording = true;
        voiceBtn.textContent = "⏹️ 녹음 종료";
        try {
          await stt.start();
        } catch {
          recording = false;
          voiceBtn.textContent = "🎤 음성 질문";
          setVoiceStatus("❗ 마이크 권한 또는 녹음 시작 실패");
        }
      } else {
        recording = false;
        voiceBtn.textContent = "🎤 음성 질문";
        try { stt.stop(); } catch {}
      }
    });
  }

  // --------------------------
  // Ask (text)
  // --------------------------
  async function submitQuestion() {
    if (isPlaying) {
      player.notifyPause();
      return;
    }

    const q = normalizeText(questionInput?.value || "");
    if (!q) return;

    setInputsEnabled(false);
    submitBtn.textContent = "⏳ 응답 생성중...";
    setVoiceStatus("");

    let timeInfo;
    try {
      timeInfo = await player.requestTime();
    } catch {
      timeInfo = { t: 0, tLabel: "00:00", provider, youtubeId };
    }

    try {
      const answer = await askLLM({
        question: q,
        t: timeInfo.t,
        tLabel: timeInfo.tLabel,
        videoKey,
        videoUrl,
        provider,
        youtubeId,
      });

      safePushItem(q, answer, timeInfo);
      if (questionInput) questionInput.value = "";
    } catch (e) {
      safePushItem(q, `❗ 오류: ${e?.message || "요청 실패"}`, timeInfo);
    } finally {
      submitBtn.textContent = "📄 텍스트 질문";
      setInputsEnabled(true);
      questionInput?.focus();
    }
  }

  if (submitBtn) submitBtn.addEventListener("click", submitQuestion);

  if (questionInput) {
    questionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitQuestion();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("현재 강의의 Q&A를 모두 삭제할까요?")) return;
      store.clear();
      items = [];
      render();
    });
  }

  // init
  syncLabels();
  setInputsEnabled(false);
  setOverlayVisible(false);
  render();
})();
