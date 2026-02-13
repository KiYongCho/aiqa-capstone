// qa.view.js
// - 우측 패널(root)을 건드리지 않고
// - 내부의 "목록 영역(.aiqoo-qa-list)"에만 Q/A 아이템을 추가합니다.
// - 따라서 "질문 시작하기 버튼" / "상단 헤더" 등 레이아웃이 사라지지 않습니다.

function normalizeText(input) {
  const t = (input ?? "").toString();
  return t
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHTML(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAnswerToHTML(answerText) {
  const safe = escapeHTML(answerText);
  return safe.replaceAll("\n", "<br>");
}

/**
 * containerEl: 우측 패널 전체(root) 또는 목록 영역 모두 가능
 * - root가 들어오면 내부에 .aiqoo-qa-list를 자동 생성/탐색해서 거기에만 append
 */
function getListContainer(containerEl) {
  if (!containerEl) return null;

  // 이미 목록 영역이면 그대로 사용
  if (containerEl.classList?.contains("aiqoo-qa-list")) return containerEl;

  // root 내부에서 목록 영역 탐색
  let list = containerEl.querySelector?.(".aiqoo-qa-list");
  if (list) return list;

  // 없으면 생성 (root 하단에 붙임)
  list = document.createElement("div");
  list.className = "aiqoo-qa-list";
  containerEl.appendChild(list);
  return list;
}

/**
 * 선택: 기존 목록을 비우고 새 Q/A만 보여주고 싶을 때 사용
 */
export function clearQA(containerEl) {
  const list = getListContainer(containerEl);
  if (list) list.innerHTML = "";
}

/**
 * Q/A 1개 렌더링(append)
 */
export function renderQA(containerEl, { question, answer, mode = "append" }) {
  const list = getListContainer(containerEl);
  if (!list) return;

  const q = normalizeText(question);
  const a = normalizeText(answer);

  if (mode === "replace") {
    // "목록 영역"만 초기화 (root 전체를 날리지 않음)
    list.innerHTML = "";
  }

  const wrapper = document.createElement("div");
  wrapper.className = "aiqoo-qa-item";

  const qRow = document.createElement("div");
  qRow.className = "aiqoo-qa-row aiqoo-qa-question";
  qRow.innerHTML = `
    <span class="aiqoo-qa-icon" aria-hidden="true">❓</span>
    <span class="aiqoo-qa-text">${escapeHTML(q)}</span>
  `;

  const aRow = document.createElement("div");
  aRow.className = "aiqoo-qa-row aiqoo-qa-answer";
  aRow.innerHTML = `
    <span class="aiqoo-qa-icon" aria-hidden="true">💡</span>
    <div class="aiqoo-qa-text aiqoo-qa-answer-text">${formatAnswerToHTML(a)}</div>
  `;

  wrapper.appendChild(qRow);
  wrapper.appendChild(aRow);

  list.appendChild(wrapper);

  return { q, a };
}
