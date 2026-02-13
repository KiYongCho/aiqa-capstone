/* share.service.js
 * - 카카오/메일 공유 전담
 * - named export: shareKakao, shareMail
 *
 * ✅ 개선:
 *  1) Kakao SDK 자동 로드(없을 경우)
 *  2) Kakao.init 자동 수행(미초기화인 경우)
 *  3) 키가 없으면 "어디에 넣어야 하는지" 메시지 안내
 *
 * ✅ 키 우선순위:
 *  - localStorage: AIQOO_KAKAO_KEY
 *  - <body data-kakao-key="...">
 */

function ensureText(text) {
  return String(text || "").trim();
}

function getKakaoKey() {
  const fromLS = (localStorage.getItem("AIQOO_KAKAO_KEY") || "").trim();
  if (fromLS) return fromLS;

  const fromAttr = (document.body?.dataset?.kakaoKey || "").trim();
  if (fromAttr) return fromAttr;

  return "";
}

/** 클립보드 복사 (폴백) */
async function copyToClipboard(text) {
  const t = ensureText(text);
  if (!t) return false;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch (_) {}

  // 구형 폴백
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (_) {
    return false;
  }
}

/** Kakao SDK 로드 */
function loadKakaoSdkOnce() {
  // 이미 있으면 OK
  if (window.Kakao) return Promise.resolve(true);

  // 이미 로딩 중이면 그 Promise 재사용
  if (window.__AIQOO_KAKAO_SDK_LOADING__) return window.__AIQOO_KAKAO_SDK_LOADING__;

  window.__AIQOO_KAKAO_SDK_LOADING__ = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return window.__AIQOO_KAKAO_SDK_LOADING__;
}

/** Kakao.init 보장 */
async function ensureKakaoReady() {
  const ok = await loadKakaoSdkOnce();
  if (!ok || !window.Kakao) return { ok: false, reason: "sdk_load_failed" };

  const KakaoSDK = window.Kakao;
  const key = getKakaoKey();

  if (!key) return { ok: false, reason: "missing_key" };

  try {
    // SDK는 로드됐는데 init 안된 경우가 대부분
    if (typeof KakaoSDK.isInitialized === "function") {
      if (!KakaoSDK.isInitialized()) {
        KakaoSDK.init(key);
      }
    } else {
      // 구버전 대비
      KakaoSDK.init?.(key);
    }
  } catch (e) {
    console.error("[share.service] Kakao.init failed:", e);
    return { ok: false, reason: "init_failed" };
  }

  // Share API 존재 체크
  if (!KakaoSDK.Share || typeof KakaoSDK.Share.sendDefault !== "function") {
    return { ok: false, reason: "share_api_missing" };
  }

  return { ok: true, KakaoSDK };
}

/**
 * 카카오 공유
 * @param {string} answerText
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.url]
 * @param {string} [opts.imageUrl]
 */
export async function shareKakao(answerText, opts = {}) {
  const text = ensureText(answerText);
  if (!text) return;

  const title = opts.title || "AIQOO 답변 공유";
  const url = opts.url || window.location.href;

  // ✅ 핵심: SDK + init 보장
  const ready = await ensureKakaoReady();

  if (!ready.ok) {
    // 폴백: 클립보드 복사
    const ok = await copyToClipboard(`${title}\n\n${text}\n\n${url}`);

    // 에러 원인별 안내 (현장에서 진단이 빨라집니다)
    if (ready.reason === "missing_key") {
      alert(
        "카카오 공유를 사용하려면 '카카오 JavaScript 키'가 필요합니다.\n\n" +
          "설정 방법:\n" +
          "1) qa.html <body data-kakao-key=\"...\">에 키 넣기 (현재 구조)\n" +
          "또는\n" +
          "2) 개발자도구 콘솔에서 localStorage AIQOO_KAKAO_KEY로 저장\n\n" +
          "지금은 임시로 내용이 클립보드에 복사되었습니다."
      );
      return;
    }

    if (ready.reason === "init_failed") {
      alert(
        "카카오 SDK 초기화(Kakao.init)에 실패했습니다.\n" +
          "대부분 '키가 REST 키'이거나, 카카오 개발자 콘솔에 웹 도메인이 등록되지 않은 경우입니다.\n\n" +
          "지금은 임시로 내용이 클립보드에 복사되었습니다."
      );
      return;
    }

    if (ready.reason === "share_api_missing") {
      alert(
        "카카오 SDK는 로드됐지만 Share API를 사용할 수 없습니다.\n" +
          "SDK 버전/로딩 문제일 수 있습니다.\n\n" +
          "지금은 임시로 내용이 클립보드에 복사되었습니다."
      );
      return;
    }

    if (!ok) alert("카카오 공유를 진행할 수 없습니다. (클립보드 복사도 실패)");
    else alert("카카오 공유를 사용할 수 없어 내용이 클립보드에 복사되었습니다.");
    return;
  }

  const KakaoSDK = ready.KakaoSDK;

  // 공유 썸네일(HTTPS 필수, 카카오에서 막히면 공유 실패할 수 있음)
  const imageUrl =
    opts.imageUrl ||
    // favicon 같은 작은 이미지도 되긴 하지만, 카카오 정책상 대표 이미지 권장
    `${window.location.origin}/favicon.ico`;

  try {
    KakaoSDK.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: text.length > 180 ? text.slice(0, 180) + "…" : text,
        imageUrl,
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: "페이지 열기",
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  } catch (err) {
    console.error("Kakao share error:", err);

    // 폴백: 클립보드
    const ok = await copyToClipboard(`${title}\n\n${text}\n\n${url}`);
    if (!ok) alert("카카오 공유 중 오류가 발생했습니다.");
    else alert("카카오 공유 오류로 내용이 클립보드에 복사되었습니다.");
  }
}

/**
 * 이메일 공유 (mailto)
 * @param {string} answerText
 * @param {object} [opts]
 * @param {string} [opts.subject]
 * @param {string} [opts.to]
 */
export function shareMail(answerText, opts = {}) {
  const text = ensureText(answerText);
  if (!text) return;

  const subject = opts.subject || "AIQOO 답변 공유";
  const to = opts.to || "";
  const url = window.location.href;

  const body = `${text}\n\n---\n공유 링크: ${url}`;
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  window.location.href = mailto;
}

export default {
  shareKakao,
  shareMail,
};
