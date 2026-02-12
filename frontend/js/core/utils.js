// core/utils.js

export function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }
  
  export function normalizeText(s) {
    return String(s || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  
  export function snippet(s, maxLen = 180) {
    const t = normalizeText(s).replace(/\s+/g, " ");
    return t.length <= maxLen ? t : t.slice(0, maxLen - 1) + "…";
  }
  
  export function formatTime() {
    const d = new Date();
    return (
      d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }
  