// qa.js
// UI + 이벤트 총괄(우측 패널 토글 / 중앙 모달 숨김 / Q&A 렌더 연결)
// ✅ 핵심: DOM이 재렌더/교체되어도 클릭이 죽지 않도록 "이벤트 위임" 사용
//
// 기대하는 DOM (없어도 동작하도록 fallback 있음):
// - 중앙 모달:  #aiqooCenterModal  (없으면 .aiqoo-center-modal)
// - 우측 패널:  #aiqooRightPanel   (없으면 .aiqoo-right-panel)
// - 시작 버튼:   [data-action="aiqoo-start"]
//
// 사용:
// import { initQA } from "./qa.js";
// initQA();
//
// Q&A 렌더는 필요 시:
// import { renderQA } from "./qa.view.js";
// renderQA(rightPanelRootOrList, { question, answer });

import { renderQA, clearQA } from "./qa.view.js";

const SELECTORS = {
  centerModal: "#aiqooCenterModal, .aiqoo-center-modal",
  rightPanel: "#aiqooRightPanel, .aiqoo-right-panel",
  startBtn: '[data-action="aiqoo-start"]',
  closeBtn: '[data-action="aiqoo-close"]',
  qaList: ".aiqoo-qa-list",
};

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function show(el) {
  if (!el) return;
  el.classList.remove("hidden");
  // 혹시 display:none이 inline으로 박혀있던 케이스 복구
  el.style.display = "";
  // 안전: 강제로 보이게
  el.style.visibility = "visible";
  el.style.opacity = "1";
}

function hide(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.style.display = "none";
}

function ensureHiddenRule() {
  // hidden이 Tailwind가 아닌 경우를 대비해 강제 주입
  if (document.getElementById("aiqoo-hidden-style")) return;

  const style = document.createElement("style");
  style.id = "aiqoo-hidden-style";
  style.textContent = `
    .hidden { display:none !important; }
  `;
  document.head.appendChild(style);
}

function ensureRightPanelStyle(panelEl) {
  // z-index/overlay 문제를 예방하기 위한 최소 보정
  if (!panelEl) return;

  // 이미 position이 잘 잡혀 있으면 건드리지 않음
  const cs = window.getComputedStyle(panelEl);
  const pos = cs.position;

  if (pos === "static") {
    panelEl.style.position = "fixed";
    panelEl.style.top = "0";
    panelEl.style.right = "0";
    panelEl.style.height = "100vh";
  }

  // width가 0 또는 auto인데 안 보이는 상황을 대비
  if (!panelEl.style.width) {
    panelEl.style.width = "420px";
  }

  panelEl.style.zIndex = "999999";
}

function getCenterModalEl() {
  return qs(SELECTORS.centerModal);
}

function getRightPanelEl() {
  return qs(SELECTORS.rightPanel);
}

function onStartQuestion() {
  ensureHiddenRule();

  const centerModal = getCenterModalEl();
  const rightPanel = getRightPanelEl();

  // 디버깅용(실서비스에서도 치명적 부작용 없음)
  console.log("[AIQOO] start click", {
    centerModal: !!centerModal,
    rightPanel: !!rightPanel,
  });

  // 1) 중앙 모달 숨김
  hide(centerModal);

  // 2) 우측 패널 표시
  show(rightPanel);
  ensureRightPanelStyle(rightPanel);
}

function onClosePanel() {
  ensureHiddenRule();

  const rightPanel = getRightPanelEl();
  const centerModal = getCenterModalEl();

  console.log("[AIQOO] close click", {
    centerModal: !!centerModal,
    rightPanel: !!rightPanel,
  });

  hide(rightPanel);
  show(centerModal);
}

function bindDelegatedEvents() {
  // ✅ DOM이 교체되어도 살아남는 위임 이벤트
  document.addEventListener(
    "click",
    (e) => {
      const startBtn = e.target.closest(SELECTORS.startBtn);
      if (startBtn) {
        e.preventDefault();
        e.stopPropagation();
        onStartQuestion();
        return;
      }

      const closeBtn = e.target.closest(SELECTORS.closeBtn);
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        onClosePanel();
        return;
      }
    },
    true
  );
}

function ensureQaListExists() {
  const rightPanel = getRightPanelEl();
  if (!rightPanel) return null;

  let list = qs(SELECTORS.qaList, rightPanel);
  if (!list) {
    list = document.createElement("div");
    list.className = "aiqoo-qa-list";
    rightPanel.appendChild(list);
  }
  return list;
}

/**
 * 초기화 함수
 */
export function initQA() {
  ensureHiddenRule();
  bindDelegatedEvents();

  // 우측 패널이 존재하면 리스트 영역 확보
  ensureQaListExists();

  // 최초 상태 정리:
  // - 중앙 모달이 있으면 보여주고
  // - 우측 패널이 있으면 숨겨둠 (프로젝트 정책에 맞게 수정 가능)
  const centerModal = getCenterModalEl();
  const rightPanel = getRightPanelEl();

  if (centerModal) show(centerModal);
  if (rightPanel) hide(rightPanel);
}

/**
 * 외부에서 Q/A 결과를 추가 렌더하고 싶을 때 사용하는 헬퍼
 */
export function appendQA(question, answer) {
  const rightPanel = getRightPanelEl();
  if (!rightPanel) return;

  // 우측 패널이 숨김이어도 Q/A가 들어오면 보여주고 싶다면:
  // show(rightPanel);

  renderQA(rightPanel, { question, answer, mode: "append" });
}

/**
 * 외부에서 Q/A 목록을 초기화하고 싶을 때
 */
export function resetQA() {
  const rightPanel = getRightPanelEl();
  if (!rightPanel) return;

  clearQA(rightPanel);
}
