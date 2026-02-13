// qa.view.js
// - 우측 패널(root)을 절대 초기화하지 않음
// - 내부 .aiqoo-qa-list에만 append/replace
// - Q/A는 "❓ / 💡" 이모지로 표시
// - 연속 개행/불필요 공백 정리

function normalizeText(input) {
  const t = (input ?? "").toString();
  return t
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // 과도한 빈 줄 제거
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

function getListContainer(containerEl) {
  if (!containerEl) return null;

  // containerEl이 리스트면 그대로
  if (containerEl.classList?.contains("aiqoo-qa-list")) return containerEl;

  // root에서 리스트 찾기
  let list = containerEl.querySelector?.(".aiqoo-qa-list");
  if (list) return list;

  // 없으면 생성
  list = document.createElement("div");
  list.className = "aiqoo-qa-list";
  containerEl.appendChild(list);
  return list;
}

export function clearQA(containerEl) {
  const list = getListContainer(containerEl);
  if (list) list.innerHTML = "";
}

export function renderQA(containerEl, { question, answer, mode = "append" }) {
  const list = getListContainer(containerEl);
  if (!list) return;

  const q = normalizeText(question);
  const a = normalizeText(answer);

  if (mode === "replace") {
    // ✅ root 전체가 아니라 list만 비움
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
