// ui/qa.view.js
import { escapeHtml } from "../core/utils.js";

export function renderQA(container, items) {

  container.innerHTML = "";

  items.slice().reverse().forEach((item, i) => {

    const div = document.createElement("div");
    div.className = "qa-item";

    div.innerHTML =
      `<div><strong>Q</strong> ${escapeHtml(item.question)}</div>
       <div><strong>A</strong> ${escapeHtml(item.answer || "")}</div>`;

    container.appendChild(div);
  });
}
