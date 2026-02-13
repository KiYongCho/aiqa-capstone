/* /js/util/markdown.util.js
 * - 경량 마크다운 렌더러(안전 우선)
 * - 지원(추가됨):
 *   - 코드 펜스 ```lang ... ```
 *   - 인라인 코드 `code`
 *   - 헤딩: # ~ ######
 *   - 굵게: **bold**
 *   - 기울임: *italic* (간단 처리)
 *   - 구분선: --- / ***
 *   - 리스트: - item / * item
 *   - 테이블: | a | b | (헤더 구분선 포함)
 *   - 줄바꿈: \n -> <br> (단, 블록 요소는 적절히 처리)
 * - NOTE:
 *   - HTML 입력은 모두 escape → XSS 방지
 *   - 생성하는 태그는 우리가 만든 것만 허용(콘텐츠는 escape)
 */

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInline(textEscaped = "") {
  // textEscaped는 이미 escape된 문자열이어야 합니다.
  let t = String(textEscaped);

  // 인라인 코드: `...` (가장 우선)
  t = t.replace(/`([^`]+?)`/g, (_, code) => {
    return `<code class="md-inline-code">${escapeHtml(code)}</code>`;
  });

  // 굵게: **...**
  t = t.replace(/\*\*([^*]+?)\*\*/g, (_, bold) => {
    return `<strong class="md-strong">${escapeHtml(bold)}</strong>`;
  });

  // 기울임: *...* (단순 처리; 굵게와 충돌 최소화)
  t = t.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, (_, pre, it) => {
    return `${pre}<em class="md-em">${escapeHtml(it)}</em>`;
  });

  return t;
}

function isHrLine(line) {
  const s = line.trim();
  return s === "---" || s === "***" || /^-{3,}$/.test(s) || /^\*{3,}$/.test(s);
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line);
}

function parseHeading(lineEscaped) {
  // lineEscaped는 escape된 상태지만 # 문자는 그대로 존재
  const raw = String(lineEscaped);
  const m = raw.match(/^(#{1,6})\s+(.*)$/);
  if (!m) return null;
  const level = m[1].length;
  const content = m[2] ?? "";
  return `<h${level} class="md-h md-h${level}">${renderInline(content)}</h${level}>`;
}

function isListItem(line) {
  return /^\s*[-*]\s+/.test(line);
}

function parseList(linesEscaped, startIdx) {
  // 연속된 list item들을 ul로 묶기
  const items = [];
  let i = startIdx;

  while (i < linesEscaped.length) {
    const line = linesEscaped[i];
    if (!isListItem(line)) break;

    const liText = line.replace(/^\s*[-*]\s+/, "");
    items.push(`<li class="md-li">${renderInline(liText)}</li>`);
    i++;
  }

  if (!items.length) return null;
  return {
    html: `<ul class="md-ul">${items.join("")}</ul>`,
    nextIdx: i,
  };
}

function looksLikeTableRow(line) {
  const s = line.trim();
  // 최소한 파이프 2개 이상 + 내용
  return s.includes("|") && s.replaceAll("|", "").trim().length > 0;
}

function isTableSeparator(line) {
  // |---|---|, ---|---, |:---|---:| 등 단순 처리
  const s = line.trim();
  if (!s.includes("-")) return false;
  // 파이프 제거 후 공백 제거
  const x = s.replaceAll("|", "").trim();
  // 콜론/하이픈/공백만으로 구성되어야 테이블 구분선으로 간주
  return /^[\s:-]+$/.test(x) && x.includes("-");
}

function splitTableCells(lineEscaped) {
  // 앞뒤 파이프 제거 후 split
  const s = lineEscaped.trim();
  const trimmed = s.replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function parseTable(linesEscaped, startIdx) {
  // 최소 2줄: header + separator + body...
  if (startIdx + 1 >= linesEscaped.length) return null;

  const headerLine = linesEscaped[startIdx];
  const sepLine = linesEscaped[startIdx + 1];

  if (!looksLikeTableRow(headerLine) || !isTableSeparator(sepLine)) return null;

  const headers = splitTableCells(headerLine).map(
    (h) => `<th class="md-th">${renderInline(h)}</th>`
  );

  const rows = [];
  let i = startIdx + 2;

  while (i < linesEscaped.length) {
    const line = linesEscaped[i];
    if (!looksLikeTableRow(line) || isHrLine(line) || isHeading(line) || isListItem(line)) break;

    const cells = splitTableCells(line).map(
      (c) => `<td class="md-td">${renderInline(c)}</td>`
    );
    rows.push(`<tr class="md-tr">${cells.join("")}</tr>`);
    i++;
  }

  const html = `
    <div class="md-table-wrap">
      <table class="md-table">
        <thead class="md-thead"><tr class="md-tr">${headers.join("")}</tr></thead>
        <tbody class="md-tbody">${rows.join("")}</tbody>
      </table>
    </div>
  `;

  return { html, nextIdx: i };
}

function renderParagraph(lineEscaped) {
  // 한 줄짜리 텍스트를 문단으로 처리
  const s = lineEscaped;
  if (!s || !s.trim()) return "";
  return `<div class="md-text">${renderInline(s)}</div>`;
}

function renderTextBlocks(textRaw = "") {
  // 일반 텍스트(코드펜스 제외 영역) 처리
  const src = String(textRaw ?? "");
  if (!src) return "";

  // 먼저 escape (안전)
  const escapedWhole = escapeHtml(src);

  // 줄 단위로 처리
  const lines = escapedWhole.split("\n");

  let out = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 공백 줄
    if (!line.trim()) {
      i++;
      continue;
    }

    // HR
    if (isHrLine(line)) {
      out += `<hr class="md-hr">`;
      i++;
      continue;
    }

    // Heading
    if (isHeading(line)) {
      const h = parseHeading(line);
      if (h) out += h;
      i++;
      continue;
    }

    // Table
    const tableParsed = parseTable(lines, i);
    if (tableParsed) {
      out += tableParsed.html;
      i = tableParsed.nextIdx;
      continue;
    }

    // List
    if (isListItem(line)) {
      const listParsed = parseList(lines, i);
      if (listParsed) {
        out += listParsed.html;
        i = listParsed.nextIdx;
        continue;
      }
    }

    // 일반 문단(여러 줄 연속을 한 덩어리로 묶어서 <br> 처리)
    // 다음 블록 요소 전까지 누적
    const paraLines = [];
    let j = i;

    while (j < lines.length) {
      const l = lines[j];
      if (!l.trim()) break;
      if (isHrLine(l) || isHeading(l) || isListItem(l)) break;
      if (parseTable(lines, j)) break;
      paraLines.push(l);
      j++;
    }

    const joined = paraLines.join("<br>");
    out += `<div class="md-text">${renderInline(joined)}</div>`;
    i = j;
  }

  return out;
}

/**
 * @param {string} md
 * @returns {string} safe HTML string
 */
export function renderMarkdownSafe(md = "") {
  const src = String(md ?? "");

  // 코드 펜스 분리
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let out = "";
  let lastIdx = 0;
  let match;

  while ((match = fenceRegex.exec(src)) !== null) {
    const [full, lang, codeBody] = match;
    const start = match.index;
    const end = start + full.length;

    // 펜스 이전 일반 텍스트
    const before = src.slice(lastIdx, start);
    out += renderTextBlocks(before);

    // 코드 블록
    const language = lang ? escapeHtml(lang) : "";
    const codeEscaped = escapeHtml(codeBody);

    out += `
      <div class="md-codeblock">
        <div class="md-codebar">
          <span class="md-lang">${language || "code"}</span>
          <button class="md-copy-btn" type="button" data-copy="${escapeHtml(codeBody)}">복사</button>
        </div>
        <pre class="md-pre"><code class="md-code">${codeEscaped}</code></pre>
      </div>
    `;

    lastIdx = end;
  }

  // 나머지 텍스트
  out += renderTextBlocks(src.slice(lastIdx));

  return out.trim();
}

/**
 * 코드블록 내 "복사" 버튼을 위해 이벤트 위임 처리 헬퍼
 * @param {HTMLElement} root
 */
export function bindMarkdownCopyButtons(root) {
  if (!root) return;

  root.addEventListener("click", async (e) => {
    const btn = e.target.closest(".md-copy-btn");
    if (!btn) return;

    const raw = btn.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(raw);
      const old = btn.textContent;
      btn.textContent = "복사됨";
      setTimeout(() => (btn.textContent = old), 900);
    } catch (err) {
      console.error("Clipboard error:", err);
      btn.textContent = "실패";
      setTimeout(() => (btn.textContent = "복사"), 900);
    }
  });
}
