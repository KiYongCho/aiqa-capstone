// qa.view.js
// - ❓/💡 이모지 + 불필요 빈 줄 제거
// - ✅ 질문/답변이 비어있으면 카드 자체를 렌더링하지 않음(초기 쓸데없는 레이어 제거)
// - 각 카드에: 🔎 크게보기 / 💬 카카오 / 📋 복사 버튼

function normalizeText(input) {
  return String(input ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAnswerToHTML(answerText) {
  return escapeHTML(answerText).replaceAll("\n", "<br>");
}

function getListContainer(containerEl) {
  if (!containerEl) return null;

  let list = containerEl.querySelector?.(".aiqoo-qa-list");
  if (!list) {
    list = document.createElement("div");
    list.className = "aiqoo-qa-list";
    containerEl.appendChild(list);
  }
  return list;
}

export function clearQA(containerEl) {
  const list = getListContainer(containerEl);
  if (list) list.innerHTML = "";
}

/**
 * ✅ 빈 Q/A는 렌더링하지 않습니다.
 */
export function renderQA(containerEl, item) {
  const list = getListContainer(containerEl);
  if (!list) return false;

  const q = normalizeText(item?.question);
  const a = normalizeText(item?.answer);

  // ✅ 스샷처럼 아이콘/버튼만 뜨는 "빈 카드" 방지
  if (!q || !a) return false;

  const tLabel = item?.meta?.tLabel ? `⏱ ${item.meta.tLabel}` : "";
  const createdAt = item?.createdAt ? item.createdAt : "";
  const metaText = [createdAt, tLabel].filter(Boolean).join(" · ");

  const wrapper = document.createElement("div");
  wrapper.className = "aiqoo-qa-item";

  wrapper.innerHTML = `
    <div class="aiqoo-qa-row aiqoo-qa-question">
      <span class="aiqoo-qa-icon" aria-hidden="true">❓</span>
      <span class="aiqoo-qa-text">${escapeHTML(q)}</span>
    </div>

    <div class="aiqoo-qa-row aiqoo-qa-answer">
      <span class="aiqoo-qa-icon" aria-hidden="true">💡</span>
      <div class="aiqoo-qa-text aiqoo-qa-answer-text">${formatAnswerToHTML(a)}</div>
    </div>

    <div class="mt-3 flex flex-wrap gap-2 items-center">
      <button type="button" class="qa-pill-btn qa-answer-zoombtn"
        data-act="zoom"
        data-a="${escapeHTML(a)}"
        data-meta="${escapeHTML(metaText)}">🔎 크게보기</button>

      <button type="button" class="qa-pill-btn qa-share-kakao"
        data-act="kakao"
        data-q="${escapeHTML(q)}"
        data-a="${escapeHTML(a)}">💬 카카오</button>

      <button type="button" class="qa-pill-btn"
        data-act="copy"
        data-full="${escapeHTML(`❓ 질문\n${q}\n\n💡 답변\n${a}`)}">📋 복사</button>

      <span class="ml-auto text-[11px] font-semibold text-zinc-500 whitespace-nowrap">
        ${escapeHTML(metaText)}
      </span>
    </div>
  `;

  list.appendChild(wrapper);
  return true;
}

export function renderQAList(containerEl, items = []) {
  clearQA(containerEl);

  for (const it of items) {
    renderQA(containerEl, it); // renderQA에서 빈 항목은 자동 skip
  }
}
