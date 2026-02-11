// js/index.js (YouTube 초기 로딩 안정화 + QA 활성화 동기화 강화)
(function () {
  const videoUrlInput = document.getElementById("videoUrl");
  const videoApplyBtn = document.getElementById("videoApply");

  const nativeVideo = document.getElementById("nativeVideo");
  const youtubeWrap = document.getElementById("youtubeWrap");
  const ytPlayerEl = document.getElementById("ytPlayer");
  const placeholder = document.getElementById("videoPlaceholder");

  const qaFrame = document.querySelector('iframe[src="html/qa.html"]');

  function postToQA(msg) {
    if (!qaFrame || !qaFrame.contentWindow) return;
    qaFrame.contentWindow.postMessage(msg, "*");
  }

  // =========================
  // 상태
  // =========================
  let provider = "native"; // "youtube" | "native"
  let youtubeId = "";
  let videoUrl = "";
  let videoKey = "default";

  let ytPlayer = null;
  let ytReady = false;
  let pendingYoutubeId = "";
  let qaIsReady = false;

  // =========================
  // util
  // =========================
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

  function showPlaceholder(show) {
    placeholder.classList.toggle("hidden", !show);
  }
  function showNative(show) {
    nativeVideo.classList.toggle("hidden", !show);
  }
  function showYouTube(show) {
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
      const s = ytPlayer.getPlayerState();
      // 1=PLAYING
      return s === 1;
    }
    if (provider === "native" && nativeVideo) return !nativeVideo.paused && !nativeVideo.ended;
    return false;
  }

  function broadcastCurrentState() {
    // qaReady 이후에만 호출되며, 상태를 확실히 한 번 보내줌
    if (isCurrentlyPlaying()) sendPlaying();
    else sendPaused();
  }

  function pauseVideoAndBroadcast() {
    // ✅ pause 후 stateChange 누락 대비: paused를 직접 한 번 전파
    if (provider === "youtube" && ytPlayer && typeof ytPlayer.pauseVideo === "function") {
      ytPlayer.pauseVideo();
      // YouTube는 stateChange가 올 때도 있지만, 안전하게 150ms 뒤 강제 전파
      setTimeout(() => {
        provider = "youtube";
        sendPaused();
      }, 150);
      return;
    }

    if (provider === "native" && nativeVideo && !nativeVideo.paused) {
      nativeVideo.pause();
      setTimeout(() => {
        provider = "native";
        sendPaused();
      }, 50);
      return;
    }

    // 이미 멈춰있어도 질문 가능해야 하므로 paused 전파
    setTimeout(() => sendPaused(), 0);
  }

  // =========================
  // Native 이벤트
  // =========================
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

  // =========================
  // ✅ YouTube API 안전 로딩 (콜백 누락 방지)
  // =========================
  function loadYouTubeApiOnce() {
    if (window.YT && window.YT.Player) return;

    // 콜백 먼저 정의
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

    ytPlayer = new YT.Player(ytPlayerEl, {
      videoId: "",
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          ytReady = true;

          // ready 전에 apply된 경우 처리
          if (pendingYoutubeId) {
            ytPlayer.loadVideoById(pendingYoutubeId);
            pendingYoutubeId = "";
          }

          // YouTube player 준비만 되어도 “초기 paused 상태”를 전파해 질문 가능하게 만들 수 있음
          broadcastCurrentState();
        },
        onStateChange: (event) => {
          const s = event.data;
          provider = "youtube";

          // 1=PLAYING, 2=PAUSED, 0=ENDED
          if (s === 1) sendPlaying();
          else if (s === 2) sendPaused();
          else if (s === 0) sendPaused(); // ended도 질문 가능
        }
      }
    });

    window.ytPlayer = ytPlayer;
  }

  // =========================
  // apply video
  // =========================
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
      sendPaused(); // 아무 영상 없어도 질문 가능 UX를 원하면 유지
      return;
    }

    // 기존 native 정리
    try { nativeVideo.pause(); } catch (_) {}

    if (isYouTubeUrl(videoUrl)) {
      provider = "youtube";
      youtubeId = parseYouTubeId(videoUrl);
      videoKey = makeVideoKey(provider, videoUrl, youtubeId);

      showPlaceholder(false);
      showNative(false);
      showYouTube(true);

      // ✅ YouTube API/플레이어 생성 보장
      loadYouTubeApiOnce();
      createYouTubePlayer();

      // videoInfo는 qaReady 이후에만
      sendVideoInfo();

      // ✅ player 준비 전이면 pending
      if (youtubeId) {
        if (ytPlayer && ytReady) ytPlayer.loadVideoById(youtubeId);
        else pendingYoutubeId = youtubeId;
      }

      // ✅ 최초 로딩에서 “paused 상태”를 강제 전파 (질문 활성화를 위해)
      // (재생을 사용자가 누르기 전엔 paused가 맞음)
      setTimeout(() => sendPaused(), 0);
    } else {
      provider = "native";
      youtubeId = "";
      videoKey = makeVideoKey(provider, videoUrl, "");

      showPlaceholder(false);
      showYouTube(false);
      showNative(true);

      nativeVideo.src = videoUrl;
      nativeVideo.load();

      sendVideoInfo();

      // ✅ 로딩 직후는 기본 paused 상태이므로 전파
      setTimeout(() => sendPaused(), 0);
    }
  }

  videoApplyBtn.addEventListener("click", () => applyVideo(videoUrlInput.value || ""));
  videoUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyVideo(videoUrlInput.value || "");
    }
  });

  // =========================
  // QA iframe -> 부모 메시지 처리
  // =========================
  window.addEventListener("message", (e) => {
    if (!e.data) return;

    if (e.data.type === "qaReady") {
      qaIsReady = true;
      // qa가 준비된 순간 현재 videoInfo + 상태를 즉시 전파 (누락 방지)
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

  // =========================
  // 초기 상태
  // =========================
  showPlaceholder(true);
  showNative(false);
  showYouTube(false);

  // ✅ 최초 화면에서도 기본 URL이 있으면 바로 적용 (유튜브 랜덤 로딩 방지)
  const initialUrl = (videoUrlInput.value || "").trim();
  if (initialUrl) applyVideo(initialUrl);
})();
