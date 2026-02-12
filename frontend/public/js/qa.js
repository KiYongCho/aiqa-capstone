// js/qa.js (ENTRY MODULE) - 분리된 모듈 기반 “정상 동작용”
// ✅ 반드시 qa.html에서 <script type="module" ...> 로 로드해야 합니다.

import { createLectureStore } from "/js/core/store.js";
import { normalizeText, formatTime, snippet } from "/js/core/utils.js";
import { askLLM } from "/js/services/api.service.js";
import { createPlayerService } from "/js/services/player.service.js";
import { createSTTService } from "/js/services/stt.service.js";
import { renderQA } from "/js/ui/qa.view.js";
import { createModal } from "/js/ui/modal.view.js";
// share.service.js는 현재 UI에 버튼이 없어서(qa.html에 없음) 여기선 연결만 준비

(function () {
  "use strict";

  // --------------------------
  // DOM
  // --------------------------
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
  const resetBtn = $("resetBtn"); // UI는 있는데 resetModal은 여기선 미사용(원하시면 붙여드림)

  const toTopBtn = $("toTopBtn");

  // answer modal
  const answerModal = $("answerModal");
  const answerModalBody = $("answerModalBody");
  const answerModalMeta = $("answerModalMeta");
  const answerCopyBtn = $("answerCopyBtn");
  const answerCloseBtn = $("answerCloseBtn");

  const answerModalApi = createModal(answerModal, answerModalBody);

  // --------------------------
  // State
  // --------------------------
  const player = createPlayerService();

  let provider = "native";
  let youtubeId = "";
  let videoUrl = "";
  let videoKey = "default";

  let isPlaying = false; // 부모가 알려주는 재생 상태

  const store = createLectureStore(() => videoKey);

  let items = store.load(); // [{question, answer, t, tLabel, createdAt, ...}]

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
    // 빈 상태
    if (qaEmpty) qaEmpty.classList.toggle("hidden", items.length !== 0);

    // 목록 렌더(단순 렌더)
    renderQA(qaList, items);

    // reset 버튼 노출
    if (resetWrap) resetWrap.classList.toggle("hidden", items.length === 0);

    // TOP 버튼: 스크롤 있을 때만(간단 기준)
    if (toTopBtn) {
      const need = qaList && qaList.scrollHeight > qaList.clientHeight + 10;
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

  function getLastAnswerText() {
    const last = items[items.length - 1];
    return last?.answer || "";
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

      // videoKey가 바뀌면 강의별 저장 로딩
      items = store.load();
      render();
      return;
    }

    if (msg.type === "videoPlaying") {
      isPlaying = true;
      // 재생 중이면 잠금 + 오버레이 표시
      setInputsEnabled(false);
      setOverlayVisible(true);
      return;
    }

    if (msg.type === "videoPaused") {
      isPlaying = false;
      // 일시정지면 질문 가능
      setOverlayVisible(false);
      setInputsEnabled(true);
      return;
    }

    // timeInfo는 requestTime에 대한 응답이므로 여기서 직접 처리할 필요는 없음
  });

  // 부모에게 준비 완료 신호
  window.parent.postMessage({ type: "qaReady" }, "*");

  // --------------------------
  // Overlay: 클릭하면 부모에 "qaFocus" 보내서 pause 유도
  // --------------------------
  if (overlayBtn) {
    overlayBtn.addEventListener("click", () => {
      player.notifyPause();          // 부모가 pause 처리
      setOverlayVisible(false);      // UX 즉시 반영
      setInputsEnabled(true);        // UX 즉시 반영
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
  // Answer modal (현재 renderQA가 단순 텍스트라, “A 클릭 시 확대”는 여기서 간단히 구현)
  // - qa.view.js를 고도화하면 더 깔끔해집니다.
  // --------------------------
  if (qaList) {
    qaList.addEventListener("dblclick", (e) => {
      // 더블클릭 시 마지막 답변을 크게보기로 (간단 동작)
      const ans = getLastAnswerText();
      if (!ans) return;
      if (answerModalMeta) {
        const last = items[items.length - 1];
        answerModalMeta.textContent = `${last?.createdAt || ""} · ${last?.tLabel || "00:00"} · ${last?.provider || ""}`;
      }
      document.documentElement.classList.add("qa-modal-open");
      answerModalApi.open(ans);
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
        // 재생 중이면 먼저 멈추게 유도
        player.notifyPause();
        return;
      }

      if (!recording) {
        recording = true;
        voiceBtn.textContent = "⏹️ 녹음 종료";
        try {
          await stt.start();
        } catch (e) {
          recording = false;
          voiceBtn.textContent = "🎤 음성 질문";
          setVoiceStatus("❗ 마이크 권한 또는 녹음 시작 실패");
        }
      } else {
        recording = false;
        voiceBtn.textContent = "🎤 음성 질문";
        try {
          stt.stop();
        } catch (_) {}
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
      timeInfo = await player.requestTime(); // 부모에서 현재 시각 가져오기
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

  if (submitBtn) {
    submitBtn.addEventListener("click", submitQuestion);
  }
  if (questionInput) {
    questionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitQuestion();
      }
    });
  }

  // reset(간단 버전: confirm 없이 즉시 삭제) - 원하시면 resetModal과 연결해드릴게요.
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("현재 강의의 Q&A를 모두 삭제할까요?")) return;
      store.clear();
      items = [];
      render();
    });
  }

  // --------------------------
  // Init UI state
  // --------------------------
  syncLabels();

  // 최초에는 “paused”로 가정하면 안 되고, 부모가 videoPlaying/videoPaused를 반드시 보내줘야 함.
  // 다만 UX 안전장치로: 입력은 잠시 비활성 -> 부모 상태 오면 갱신.
  setInputsEnabled(false);
  setOverlayVisible(false);
  render();
})();
