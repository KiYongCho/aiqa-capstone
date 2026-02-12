// ui/modal.view.js

export function createModal(modalEl, bodyEl) {

    function open(content) {
      bodyEl.textContent = content;
      modalEl.classList.remove("hidden");
    }
  
    function close() {
      modalEl.classList.add("hidden");
    }
  
    return { open, close };
  }
  