// js/index.js (YouTube 초기 로딩 안정화 + QA 상태 동기화)
(function () {
  const videoUrlInput = document.getElementById("videoUrl");
  const videoApplyBtn = document.getElementById("videoApply");

  const nativeVideo = document.getElementById("nativeVideo");
  const youtubeWrap = document.getElementById("youtubeWrap");
  const ytPlayerEl = document.getElementById("ytPlayer");
  const placeholder = document.getElementById("videoPlaceholder");

  // ✅ qaFrame은 src 고정 문자열 매칭이 자주 깨지므로, id 우선 + qa.html 포함 iframe fallback
  const qaFrame =
    document.getElementById("qaFrame") ||
    document.querySelector('iframe[src$="qa.html"], iframe[src*="qa.html"]');

  function postToQA(msg) {
    if (!qaFrame || !qaFrame.contentWindow) return;
    qaFrame.contentWindow.postMessage(msg, "*");
  }

  let provider = "native"; // "youtube" | "native"
  let youtubeId = "";
  let videoUrl = "";
  let videoKey = "default";

  let ytPlayer = null;
  let ytReady = false;
  let pendingYoutubeId = "";
  let qaIsReady = false;

  function isYouTubeUrl(url) {
    return /youtube\.com|youtu\.be/.test(url);
  }

  function parseYouTubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "").trim();
      if (u.hostname.includes("youtube.com")) return u.searchParams.get("v") || "";
      return "";
    } catch {
      return "";
    }
  }

  function makeVideoKey(p, url, yid) {
    if (p === "youtube" && yid) return `yt:${yid}`;
    if (url) return `url:${encodeURIComponent(url)}`;
    return "default";
  }

  function formatTimeLabel(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds || 0)));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // ✅ DOM 없을 때도 안전하게 no-op
  function showPlaceholder(show) {
    if (!placeholder) return;
    placeholder.classList.toggle("hidden", !show);
  }
  function showNative(show) {
    if (!nativeVideo) return;
    nativeVideo.classList.toggle("hidden", !show);
  }
  function showYouTube(show) {
    if (!youtubeWrap) return;
    youtubeWrap.classList.toggle("hidden", !show);
  }

  function sendVideoInfo() {
    if (!qaIsReady) return;
    postToQA({ type: "videoInfo", videoKey, videoUrl, provider, youtubeId });
  }
  function sendPlaying() {
    if (!qaIsReady) return;
    postToQA({ type: "videoPlaying" });
  }
  function sendPaused() {
    if (!qaIsReady) return;
    postToQA({ type: "videoPaused" });
  }
  function sendTimeInfo() {
    if (!qaIsReady) return;
    const t = getCurrentTime();
    postToQA({ type: "timeInfo", t, tLabel: formatTimeLabel(t), provider, youtubeId });
  }

  function getCurrentTime() {
    if (provider === "youtube" && ytPlayer && typeof ytPlayer.getCurrentTime === "function") {
      return Number(ytPlayer.getCurrentTime() || 0);
    }
    if (provider === "native" && nativeVideo) return Number(nativeVideo.currentTime || 0);
    return 0;
  }

  function isCurrentlyPlaying() {
    if (provider === "youtube" && ytPlayer && typeof ytPlayer.getPlayerState === "function") {
      return ytPlayer.getPlayerState() === 1; // PLAYING
    }
    if (provider === "native" && nativeVideo) return !nativeVideo.paused && !nativeVideo.ended;
    return false;
  }

  function broadcastCurrentState() {
    if (!qaIsReady) return;
    if (isCurrentlyPlaying()) sendPlaying();
    else sendPaused();
  }

  function pauseVideoAndBroadcast() {
    // stateChange 누락 대비: paused를 직접 전파하는 safety net 포함
    if (provider === "youtube" && ytPlayer && typeof ytPlayer.pauseVideo === "function") {
      ytPlayer.pauseVideo();
      setTimeout(() => sendPaused(), 150);
      return;
    }
    if (provider === "native" && nativeVideo && !nativeVideo.paused) {
      nativeVideo.pause();
      setTimeout(() => sendPaused(), 50);
      return;
    }
    setTimeout(() => sendPaused(), 0);
  }

  // ✅ Native events (nativeVideo가 없는 페이지에서도 크래시 방지)
  if (nativeVideo) {
    nativeVideo.addEventListener("play", () => {
      provider = "native";
      sendPlaying();
    });
    nativeVideo.addEventListener("pause", () => {
      provider = "native";
      sendPaused();
    });
    nativeVideo.addEventListener("ended", () => {
      provider = "native";
      sendPaused();
    });
  }

  // YouTube API safe load
  function loadYouTubeApiOnce() {
    if (window.YT && window.YT.Player) return;

    // 콜백을 먼저 정의 → 콜백 누락(랜덤) 방지
    window.onYouTubeIframeAPIReady = function () {
      createYouTubePlayer();
    };

    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  }

  function createYouTubePlayer() {
    if (!(window.YT && window.YT.Player)) return;
    if (ytPlayer) return;

    // ✅ ytPlayerEl이 없으면 생성 불가(크래시 방지)
    if (!ytPlayerEl) return;

    ytPlayer = new YT.Player(ytPlayerEl, {
      videoId: "",
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          ytReady = true;

          if (pendingYoutubeId) {
            ytPlayer.loadVideoById(pendingYoutubeId);
            pendingYoutubeId = "";
          }

          // 최초 진입/QA 준비 이후 상태 누락 방지
          broadcastCurrentState();
        },
        onStateChange: (event) => {
          provider = "youtube";
          const s = event.data; // 1=PLAYING, 2=PAUSED, 0=ENDED
          if (s === 1) sendPlaying();
          else if (s === 2) sendPaused();
          else if (s === 0) sendPaused();
        }
      }
    });

    window.ytPlayer = ytPlayer;
  }

  // apply
  function applyVideo(url) {
    videoUrl = (url || "").trim();

    if (!videoUrl) {
      showPlaceholder(true);
      showNative(false);
      showYouTube(false);
      provider = "native";
      youtubeId = "";
      videoKey = "default";
      sendVideoInfo();
      sendPaused();
      return;
    }

    // nativeVideo가 null이어도 try/catch로 안전
    try { nativeVideo && nativeVideo.pause(); } catch (_) {}

    if (isYouTubeUrl(videoUrl)) {
      provider = "youtube";
      youtubeId = parseYouTubeId(videoUrl);
      videoKey = makeVideoKey(provider, videoUrl, youtubeId);

      showPlaceholder(false);
      showNative(false);
      showYouTube(true);

      loadYouTubeApiOnce();
      createYouTubePlayer();

      sendVideoInfo();

      if (youtubeId) {
        if (ytPlayer && ytReady) ytPlayer.loadVideoById(youtubeId);
        else pendingYoutubeId = youtubeId;
      }

      // 재생 전 상태는 paused에 가깝기 때문에 초기 질문 UX 안정화
      setTimeout(() => sendPaused(), 0);
    } else {
      provider = "native";
      youtubeId = "";
      videoKey = makeVideoKey(provider, videoUrl, "");

      showPlaceholder(false);
      showYouTube(false);
      showNative(true);

      // ✅ nativeVideo 없으면 여기서도 중단 방지
      if (nativeVideo) {
        nativeVideo.src = videoUrl;
        nativeVideo.load();
      }

      sendVideoInfo();
      setTimeout(() => sendPaused(), 0);
    }
  }

  // ✅ URL 입력 UI가 없는 페이지에서도 크래시 방지
  if (videoApplyBtn && videoUrlInput) {
    videoApplyBtn.addEventListener("click", () => applyVideo(videoUrlInput.value || ""));
    videoUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyVideo(videoUrlInput.value || "");
      }
    });
  }

  // QA messages
  window.addEventListener("message", (e) => {
    if (!e.data) return;

    if (e.data.type === "qaReady") {
      qaIsReady = true;
      sendVideoInfo();
      broadcastCurrentState();
      return;
    }

    if (e.data.type === "qaFocus") {
      pauseVideoAndBroadcast();
      return;
    }

    if (e.data.type === "requestTime") {
      sendTimeInfo();
      return;
    }
  });

  // init
  showPlaceholder(true);
  showNative(false);
  showYouTube(false);

  // ✅ videoUrlInput이 없으면 접근하면 안 됨
  const initialUrl = videoUrlInput ? (videoUrlInput.value || "").trim() : "";
  if (initialUrl) applyVideo(initialUrl);
})();
