// public/js/ui/qa.view.js
import { escapeHtml, snippet } from "/js/core/utils.js";

export function renderQA(container, items) {
  container.innerHTML = "";

  // 최신이 위로
  items.slice().reverse().forEach((item, idxFromTop) => {
    // items.reverse()를 썼으므로, 실제 원본 인덱스는:
    const originalIndex = items.length - 1 - idxFromTop;

    const q = escapeHtml(item.question || "");
    const a = escapeHtml(item.answer || "");
    const tLabel = escapeHtml(item.tLabel || "00:00");
    const createdAt = escapeHtml(item.createdAt || "");
    const provider = escapeHtml(item.provider || "");

    const div = document.createElement("div");
    div.className =
      "mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 text-sm leading-relaxed text-zinc-100";

    div.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs text-zinc-400 mb-1">
            ⏱ ${tLabel} <span class="mx-1 text-zinc-600">·</span> ${createdAt}
            ${provider ? `<span class="mx-1 text-zinc-600">·</span> ${provider}` : ``}
          </div>

          <div class="mb-2">
            <div class="text-[12px] font-extrabold text-zinc-300 mb-1">Q</div>
            <div class="text-zinc-100 whitespace-pre-wrap break-words">${q}</div>
          </div>

          <div>
            <div class="text-[12px] font-extrabold text-zinc-300 mb-1">A</div>
            <div class="text-zinc-100 whitespace-pre-wrap break-words">${a}</div>
          </div>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="qa-pill-btn"
          data-action="zoom"
          data-index="${originalIndex}"
          title="답변 크게보기"
        >🔎 크게보기</button>

        <button
          type="button"
          class="qa-pill-btn qa-share-kakao"
          data-action="kakao"
          data-index="${originalIndex}"
          title="카카오톡 공유"
        >💬 카톡 공유</button>

        <button
          type="button"
          class="qa-pill-btn qa-share-mail"
          data-action="mail"
          data-index="${originalIndex}"
          title="메일로 보내기"
        >✉️ 메일</button>

        <span class="ml-auto text-[11px] text-zinc-500">
          ${escapeHtml(snippet(item.answer || "", 60))}
        </span>
      </div>
    `;

    container.appendChild(div);
  });
}
