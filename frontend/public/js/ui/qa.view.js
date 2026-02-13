// qa.view.js
// - Q/A 표시를 "❓/💡" 이모지로 구성
// - 불필요한 빈 줄 제거 (연속 개행 정리)
// - 카드/행 간격을 타이트하게 유지
// - 외부에서 renderQA(container, { question, answer }) 형태로 호출

function normalizeText(input) {
  const t = (input ?? "").toString();

  // 1) 앞뒤 공백 제거
  // 2) \r\n -> \n 통일
  // 3) 3개 이상 연속 개행은 2개로 축소 (너무 긴 공백 방지)
  // 4) 각 줄 끝 공백 제거
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
  // markdown 렌더러가 없다면, 최소한 개행만 <br>로 처리
  // (필요시 marked/markdown-it로 교체 가능)
  const safe = escapeHTML(answerText);
  return safe.replaceAll("\n", "<br>");
}

export function renderQA(containerEl, { question, answer }) {
  if (!containerEl) return;

  const q = normalizeText(question);
  const a = normalizeText(answer);

  // 기존 내용 초기화(원하면 append 방식으로 바꾸세요)
  containerEl.innerHTML = "";

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

  containerEl.appendChild(wrapper);

  return { q, a };
}
