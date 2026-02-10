(function () {
  const videoUrlInput = document.getElementById('videoUrl');
  const videoApplyBtn = document.getElementById('videoApply');

  const nativeVideo = document.getElementById('nativeVideo');
  const youtubeWrap = document.getElementById('youtubeWrap');
  const videoPlaceholder = document.getElementById('videoPlaceholder');

  const qaIframe = document.querySelector('iframe[title="강의 질문과 답변"]');

  // ✅ 같은 origin만 수신
  const ALLOWED_CHILD_ORIGINS = new Set([window.location.origin]);

  // === YouTube Player instance ===
  let ytPlayer = null;
  let ytReady = false;
  let currentYouTubeId = null;

  function getYouTubeVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const u = url.trim();
    const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function isYouTubeUrl(url) {
    return /youtube\.com|youtu\.be/i.test(url || '');
  }

  function formatHMS(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function notifyQa(type, payload) {
    try {
      if (qaIframe && qaIframe.contentWindow) {
        qaIframe.contentWindow.postMessage({ type, ...payload }, window.location.origin);
      }
    } catch (_) {}
  }

  function notifyQaVideoInfo() {
    const url = (videoUrlInput.value || '').trim();
    const id = getYouTubeVideoId(url);
    const videoKey = id || url || 'default';
    notifyQa('videoInfo', { videoKey, videoUrl: url, provider: id ? 'youtube' : 'native', youtubeId: id || '' });
  }

  function notifyQaVideoPlaying() { notifyQa('videoPlaying', {}); }
  function notifyQaVideoPaused() { notifyQa('videoPaused', {}); }

  function clearVideo() {
    nativeVideo.classList.add('hidden');
    nativeVideo.src = '';

    youtubeWrap.classList.add('hidden');
    if (ytPlayer && ytReady) {
      try { ytPlayer.stopVideo(); } catch (_) {}
    }
    currentYouTubeId = null;

    videoPlaceholder.classList.remove('hidden');
    notifyQaVideoPaused();
    notifyQaVideoInfo();
  }

  // === YouTube API callback (global) ===
  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('ytPlayer', {
      videoId: '',
      playerVars: {
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: function () { ytReady = true; },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.PLAYING) notifyQaVideoPlaying();
          if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) notifyQaVideoPaused();
        }
      }
    });
  };

  function applyVideo() {
    const url = (videoUrlInput.value || '').trim();
    if (!url) { clearVideo(); return; }

    videoPlaceholder.classList.add('hidden');

    if (isYouTubeUrl(url)) {
      const id = getYouTubeVideoId(url);
      if (!id) {
        videoPlaceholder.textContent = '올바른 YouTube URL을 입력해 주세요.';
        videoPlaceholder.classList.remove('hidden');
        notifyQaVideoPaused();
        notifyQaVideoInfo();
        return;
      }

      nativeVideo.classList.add('hidden');
      nativeVideo.src = '';

      youtubeWrap.classList.remove('hidden');

      currentYouTubeId = id;

      if (ytPlayer && ytReady) {
        try { ytPlayer.loadVideoById(id); } catch (_) {}
      } else {
        const t = setInterval(() => {
          if (ytPlayer && ytReady) {
            clearInterval(t);
            try { ytPlayer.loadVideoById(id); } catch (_) {}
          }
        }, 100);
        setTimeout(() => clearInterval(t), 3000);
      }

      notifyQaVideoInfo();
    } else {
      youtubeWrap.classList.add('hidden');
      if (ytPlayer && ytReady) {
        try { ytPlayer.stopVideo(); } catch (_) {}
      }
      currentYouTubeId = null;

      nativeVideo.src = url;
      nativeVideo.classList.remove('hidden');

      notifyQaVideoInfo();
      notifyQaVideoPaused();
    }
  }

  function pauseVideo() {
    if (!youtubeWrap.classList.contains('hidden')) {
      if (ytPlayer && ytReady) {
        try { ytPlayer.pauseVideo(); } catch (_) {}
      }
    } else if (!nativeVideo.classList.contains('hidden')) {
      nativeVideo.pause();
    }
  }

  nativeVideo.addEventListener('play', notifyQaVideoPlaying);
  nativeVideo.addEventListener('pause', notifyQaVideoPaused);

  function handleRequestTime() {
    let t = 0;
    if (!youtubeWrap.classList.contains('hidden')) {
      if (ytPlayer && ytReady) {
        try { t = Number(ytPlayer.getCurrentTime() || 0); } catch (_) { t = 0; }
      }
    } else if (!nativeVideo.classList.contains('hidden')) {
      t = Number(nativeVideo.currentTime || 0);
    }
    notifyQa('timeInfo', { t, tLabel: formatHMS(t), provider: currentYouTubeId ? 'youtube' : 'native', youtubeId: currentYouTubeId || '' });
  }

  window.addEventListener('message', function (e) {
    if (!ALLOWED_CHILD_ORIGINS.has(e.origin)) return;
    if (!e.data || !e.data.type) return;

    if (e.data.type === 'qaFocus') pauseVideo();
    if (e.data.type === 'qaReady') {
      notifyQaVideoInfo();
      if (!youtubeWrap.classList.contains('hidden')) {
        // stateChange에 맡김
      } else if (!nativeVideo.classList.contains('hidden') && !nativeVideo.paused) notifyQaVideoPlaying();
      else notifyQaVideoPaused();
    }
    if (e.data.type === 'requestTime') handleRequestTime();
  });

  videoApplyBtn.addEventListener('click', applyVideo);
  videoUrlInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') applyVideo();
  });

  applyVideo();
})();
