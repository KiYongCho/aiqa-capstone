(function () {
  const questionInput = document.getElementById('questionInput');
  const submitBtn = document.getElementById('submitBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const voiceStatus = document.getElementById('voiceStatus');

  const resetBtn = document.getElementById('resetBtn');
  const qaList = document.getElementById('qaList');
  const qaEmpty = document.getElementById('qaEmpty');
  const videoKeyLabel = document.getElementById('videoKeyLabel');
  const providerLabel = document.getElementById('providerLabel');

  // =========================
  // ✅ origin 처리(수정 핵심)
  // =========================

  function safeParseUrl(u) {
    try { return new URL(u); } catch (_) { return null; }
  }

  // 부모 URL은 iframe 안에서 document.referrer로 잡히는 게 일반적입니다.
  const ref = safeParseUrl(document.referrer);
  const parentOriginFromReferrer = ref ? ref.origin : '';

  // 현재 origin 기준으로 localhost/127.0.0.1 둘 다 허용 (같은 포트)
  const here = new URL(window.location.href);
  const port = here.port || (here.protocol === 'https:' ? '443' : '80');

  const samePortLocalhost = `${here.protocol}//localhost:${port}`;
  const samePortLoopback = `${here.protocol}//127.0.0.1:${port}`;

  // 최종 parentOrigin: referrer가 있으면 그걸 우선 사용, 없으면 현재 origin
  const PARENT_ORIGIN = parentOriginFromReferrer || window.location.origin;

  // 허용 origin: referrer origin + 현재 origin + localhost/127 양쪽
  const ALLOWED_PARENT_ORIGINS = new Set(
    [PARENT_ORIGIN, window.location.origin, samePortLocalhost, samePortLoopback].filter(Boolean)
  );

  // postMessage targetOrigin: 가능한 한 parentOrigin을 쓰되,
  // 예외 상황(리퍼러 없음/파일 프로토콜 등)에서는 '*'로 fallback
  function getPostTargetOrigin() {
    if (PARENT_ORIGIN && PARENT_ORIGIN.startsWith('http')) return PARENT_ORIGIN;
    return '*';
  }

  // =========================
  // 기존 로직(그대로) + 일부 보강
  // =========================

  let videoKey = 'default';
  let videoUrl = '';
  let provider = 'native';
  let youtubeId = '';

  let speechSupported = false;
  let questionMode = false;

  function storageKey() {
    return 'lecture-qa:' + (videoKey || 'default');
  }

  function loadQA() {
    try {
      const raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function saveQA(items) {
    localStorage.setItem(storageKey(), JSON.stringify(items));
  }

  function formatTime() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function render() {
    videoKeyLabel.textContent = videoKey || 'default';
    providerLabel.textContent = provider === 'youtube' ? ('YouTube · ' + (youtubeId || '')) : 'Native';

    const items = loadQA();
    qaEmpty.style.display = items.length ? 'none' : 'block';
    qaList.querySelectorAll('.qa-item').forEach(el => el.remove());

    const total = items.length;
    items.slice().reverse().forEach(function (item, revIdx) {
      const originalIndex = total - 1 - revIdx;

      const div = document.createElement('div');
      div.className = 'qa-item mb-3.5 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]';

      const meta = [];
      if (item.videoKey) meta.push('key=' + item.videoKey);
      if (item.tLabel) meta.push('t=' + item.tLabel);
      if (item.captionSnippet) meta.push('caption=ON');

      let answerHtml = '';
      if (item.answer) {
        answerHtml =
          '<div class="border-t border-white/[0.05] bg-black/20 px-3.5 py-3">' +
            '<div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">답변 (LLM)</div>' +
            '<div class="max-h-[240px] overflow-y-auto overflow-x-hidden pr-1.5 text-[13px] leading-relaxed text-zinc-300 whitespace-pre-wrap">' +
              escapeHtml(item.answer) +
            '</div>' +
          '</div>';
      } else if (item.error) {
        answerHtml =
          '<div class="border-t border-white/[0.05] bg-black/20 px-3.5 py-3">' +
            '<div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">답변</div>' +
            '<div class="text-[13px] leading-normal text-red-400">' + escapeHtml(item.error) + '</div>' +
          '</div>';
      } else {
        answerHtml =
          '<div class="border-t border-white/[0.05] bg-black/20 px-3.5 py-3">' +
            '<div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">답변</div>' +
            '<div class="text-[13px] italic text-zinc-500">답변 스트리밍 중...</div>' +
          '</div>';
      }

      let captionHtml = '';
      if (item.captionSnippet) {
        captionHtml =
          '<div class="border-t border-white/[0.05] bg-white/[0.02] px-3.5 py-3">' +
            '<div class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">자막 스니펫</div>' +
            '<div class="text-[12px] leading-relaxed text-zinc-400 whitespace-pre-wrap">' +
              escapeHtml(item.captionSnippet) +
            '</div>' +
          '</div>';
      }

      div.innerHTML =
        '<div class="flex items-center gap-2.5 px-3.5 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">' +
          '<strong class="text-xs font-semibold text-violet-400">Q' + (originalIndex + 1) + '</strong> ' +
          (item.time || '') +
          (meta.length ? '<span class="ml-auto text-[10px] text-zinc-600">' + escapeHtml(meta.join(' · ')) + '</span>' : '') +
        '</div>' +
        '<div class="px-3.5 pb-3.5 text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">' + escapeHtml(item.question) + '</div>' +
        captionHtml +
        answerHtml;

      qaList.appendChild(div);
    });
  }

  function getApiBase() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') return window.location.origin;
    return 'http://localhost:3000';
  }

  function setQuestionUIEnabled(enabled) {
    questionInput.disabled = !enabled;
    submitBtn.disabled = !enabled;
    voiceBtn.disabled = !(enabled && speechSupported);
    questionInput.placeholder = enabled ? '이 강의에 대해 질문을 입력하세요...' : '강의 재생 중에만 질문할 수 있습니다.';
  }

  function notifyParentPause() {
    try { window.parent.postMessage({ type: 'qaFocus' }, getPostTargetOrigin()); } catch (_) {}
  }

  async function requestTimeFromParent() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve({ t: 0, tLabel: '00:00', provider: provider, youtubeId: youtubeId }), 400);

      function onMsg(e) {
        if (!ALLOWED_PARENT_ORIGINS.has(e.origin)) return;
        if (!e.data || e.data.type !== 'timeInfo') return;

        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);

        resolve({
          t: Number(e.data.t || 0),
          tLabel: String(e.data.tLabel || '00:00'),
          provider: String(e.data.provider || provider),
          youtubeId: String(e.data.youtubeId || youtubeId)
        });
      }

      window.addEventListener('message', onMsg);
      try { window.parent.postMessage({ type: 'requestTime' }, getPostTargetOrigin()); } catch (_) {
        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);
        resolve({ t: 0, tLabel: '00:00', provider: provider, youtubeId: youtubeId });
      }
    });
  }

  async function streamAnswer({ question, t, tLabel, provider, youtubeId, videoUrl }) {
    const base = getApiBase();
    const url = base + '/api/answer';

    const payload = { question, videoKey, videoUrl, provider, youtubeId, t, tLabel };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify(payload)
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || ('답변 생성 실패 (HTTP ' + res.status + ')'));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buf = '';
    let done = false;
    let answerText = '';

    while (!done) {
      const chunk = await reader.read();
      done = !!chunk.done;
      buf += decoder.decode(chunk.value || new Uint8Array(), { stream: !done });

      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        const lines = frame.split('\n');
        let eventName = '';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;

        let data;
        try { data = JSON.parse(dataStr); } catch (_) { data = { text: dataStr }; }

        if (eventName === 'context') {
          const captionSnippet = String(data.captionSnippet || '');
          updateItem({ captionSnippet });
        } else if (eventName === 'token') {
          const token = String(data.token || '');
          answerText += token;
          updateItem({ answer: answerText });
        } else if (eventName === 'done') {
          updateItem({ answer: answerText });
          return;
        } else if (eventName === 'error') {
          throw new Error(String(data.error || '서버 오류'));
        }
      }
    }
  }

  function updateItem(patch) {
    const items = loadQA();
    const idx = items.length - 1;
    if (!items[idx]) return;
    Object.assign(items[idx], patch);
    saveQA(items);
    render();
  }

  async function submitQuestion(text) {
    if (!text || !(text = text.trim())) return;

    const timeInfo = await requestTimeFromParent();

    const items = loadQA();
    items.push({
      question: text,
      time: formatTime(),
      videoKey,
      videoUrl,
      provider: timeInfo.provider,
      youtubeId: timeInfo.youtubeId,
      t: timeInfo.t,
      tLabel: timeInfo.tLabel,
      captionSnippet: '',
      answer: '',
      error: ''
    });
    saveQA(items);

    questionInput.value = '';
    submitBtn.disabled = true;
    voiceBtn.disabled = true;
    render();

    try {
      await streamAnswer({
        question: text,
        t: timeInfo.t,
        tLabel: timeInfo.tLabel,
        provider: timeInfo.provider,
        youtubeId: timeInfo.youtubeId,
        videoUrl: videoUrl
      });
    } catch (err) {
      updateItem({ error: err && err.message ? err.message : '연결 실패' });
    } finally {
      submitBtn.disabled = false;
      render();
    }
  }

  window.addEventListener('message', function (e) {
    if (!ALLOWED_PARENT_ORIGINS.has(e.origin)) return;

    if (e.data && e.data.type === 'videoPlaying') {
      questionMode = false;
      setQuestionUIEnabled(true);
    } else if (e.data && e.data.type === 'videoPaused') {
      setQuestionUIEnabled(questionMode ? true : false);
    }

    if (e.data && e.data.type === 'videoInfo' && e.data.videoKey) {
      videoKey = String(e.data.videoKey);
      videoUrl = String(e.data.videoUrl || '');
      provider = String(e.data.provider || 'native');
      youtubeId = String(e.data.youtubeId || '');
      render();
    }
  });

  if (window.parent !== window) {
    try { window.parent.postMessage({ type: 'qaReady' }, getPostTargetOrigin()); } catch (_) {}
  }

  submitBtn.addEventListener('click', function () {
    const v = (questionInput.value || '').trim();
    if (!v) {
      questionMode = true;
      setQuestionUIEnabled(true);
      notifyParentPause();
      questionInput.focus();
      return;
    }
    submitQuestion(questionInput.value);
  });

  questionInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuestion(questionInput.value);
    }
  });

  questionInput.addEventListener('focus', function () {
    questionMode = true;
    setQuestionUIEnabled(true);
    notifyParentPause();
  });

  voiceBtn.addEventListener('focus', function () {
    questionMode = true;
    setQuestionUIEnabled(true);
    notifyParentPause();
  });

  // SpeechRecognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'ko-KR';
  }

  if (recognition) {
    speechSupported = true;

    voiceBtn.addEventListener('click', function () {
      if (voiceBtn.disabled) return;

      questionMode = true;
      setQuestionUIEnabled(true);
      notifyParentPause();

      if (voiceBtn.classList.contains('listening')) {
        try { recognition.stop(); } catch (_) {}
        return;
      }

      voiceStatus.textContent = '듣는 중...';
      voiceBtn.classList.add('listening', '!border-red-500/30', '!bg-red-500/15', '!text-red-300');
      voiceBtn.textContent = '⏹️ 끝내기';

      let finalTranscript = '';

      recognition.onresult = function (e) {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTranscript += transcript;
          else voiceStatus.textContent = transcript || '듣는 중...';
        }
      };

      recognition.onend = function () {
        voiceBtn.classList.remove('listening', '!border-red-500/30', '!bg-red-500/15', '!text-red-300');
        voiceBtn.textContent = '🎤 음성 질문';
        voiceStatus.textContent = '';
        if (finalTranscript) submitQuestion(finalTranscript);
      };

      recognition.onerror = function (e) {
        voiceBtn.classList.remove('listening', '!border-red-500/30', '!bg-red-500/15', '!text-red-300');
        voiceBtn.textContent = '🎤 음성 질문';
        voiceStatus.textContent = e.error === 'no-speech' ? '음성이 없습니다.' : '음성 인식 오류. 다시 시도하세요.';
      };

      try { recognition.start(); } catch (err) {
        voiceBtn.classList.remove('listening', '!border-red-500/30', '!bg-red-500/15', '!text-red-300');
        voiceBtn.textContent = '🎤 음성 질문';
        voiceStatus.textContent = '마이크를 사용할 수 없습니다.';
      }
    });
  } else {
    speechSupported = false;
    voiceBtn.disabled = true;
    voiceStatus.textContent = '이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome 권장)';
  }

  // Reset modal
  const resetModal = document.getElementById('resetModal');
  const resetModalCancel = document.getElementById('resetModalCancel');
  const resetModalConfirm = document.getElementById('resetModalConfirm');

  function openResetModal() {
    if (loadQA().length === 0) return;
    resetModal.classList.remove('hidden');
    resetModal.classList.add('flex');
    resetModal.setAttribute('aria-hidden', 'false');
  }
  function closeResetModal() {
    resetModal.classList.add('hidden');
    resetModal.classList.remove('flex');
    resetModal.setAttribute('aria-hidden', 'true');
  }

  resetBtn.addEventListener('click', openResetModal);
  resetModalCancel.addEventListener('click', closeResetModal);
  resetModalConfirm.addEventListener('click', function () {
    localStorage.removeItem(storageKey());
    closeResetModal();
    render();
  });
  resetModal.addEventListener('click', function (e) {
    if (e.target === resetModal) closeResetModal();
  });

  render();
  setQuestionUIEnabled(false);
})();
