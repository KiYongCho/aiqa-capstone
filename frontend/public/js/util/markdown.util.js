/* markdown.util.js
 * - 경량 마크다운 렌더러(안전 우선)
 * - 지원:
 *   - 코드 펜스 ```lang ... ```
 *   - 인라인 코드 `code`
 *   - 줄바꿈(\n -> <br>)
 * - NOTE:
 *   - HTML 입력은 모두 escape → XSS 방지
 */

function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
  
  function renderInlineCode(text) {
    // `...` 처리 (중첩/복잡 케이스는 단순 처리)
    return text.replace(/`([^`]+?)`/g, (_, code) => {
      return `<code class="md-inline-code">${escapeHtml(code)}</code>`;
    });
  }
  
  /**
   * @param {string} md
   * @returns {string} HTML string (safe)
   */
  export function renderMarkdownSafe(md = "") {
    const src = String(md || "");
  
    // 코드 펜스 분리
    // 패턴: ```lang(optional)\n ... \n```
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
      out += renderTextBlock(before);
  
      // 코드 블록
      const language = lang ? escapeHtml(lang) : "";
      const codeEscaped = escapeHtml(codeBody).replaceAll("\n", "\n"); // 유지
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
    out += renderTextBlock(src.slice(lastIdx));
  
    return out.trim();
  }
  
  function renderTextBlock(text) {
    const t = String(text || "");
    if (!t) return "";
  
    // escape → inline code → 줄바꿈
    const escaped = escapeHtml(t);
    const withInline = renderInlineCode(escaped);
    const withBreaks = withInline.replaceAll("\n", "<br>");
  
    // 빈 텍스트면 패스
    if (!withBreaks.replaceAll("<br>", "").trim()) return "";
  
    return `<div class="md-text">${withBreaks}</div>`;
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
  