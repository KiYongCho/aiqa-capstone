// services/player.service.js

export function createPlayerService() {

    function post(msg) {
      try { window.parent.postMessage(msg, "*"); }
      catch {}
    }
  
    function notifyPause() {
      post({ type: "qaFocus" });
    }
  
    function requestTime() {
      return new Promise((resolve) => {
  
        const timeout = setTimeout(() => resolve({
          t: 0,
          tLabel: "00:00",
          provider: "native",
          youtubeId: ""
        }), 500);
  
        function onMsg(e) {
          if (!e.data || e.data.type !== "timeInfo") return;
          clearTimeout(timeout);
          window.removeEventListener("message", onMsg);
          resolve(e.data);
        }
  
        window.addEventListener("message", onMsg);
        post({ type: "requestTime" });
      });
    }
  
    function onMessage(cb) {
      window.addEventListener("message", (e) => {
        if (!e.data?.type) return;
        cb(e.data);
      });
    }
  
    return { notifyPause, requestTime, onMessage };
  }
  