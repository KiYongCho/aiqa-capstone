/* share.service.js
 * - 공유 기능 전담
 * - named export: shareKakao, shareMail (qa.js import { shareKakao, shareMail } 대응)
 * - 기본 동작:
 *   1) Kakao SDK가 있으면 카카오 공유 시도
 *   2) 없으면 clipboard 복사로 폴백
 *   3) 메일 공유는 mailto 링크로 처리
 */

function ensureText(text) {
  return String(text || "").trim();
}

/**
 * 클립보드 복사 (폴백용)
 */
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

/**
 * 카카오 공유
 * - 전제: 카카오 SDK가 페이지에 로딩되어 있고, Kakao.init(APP_KEY)가 완료되어 있어야 정상 동작
 * - 미구성/미로딩이면 클립보드 복사로 폴백
 *
 * @param {string} answerText
 * @param {object} [opts]
 * @param {string} [opts.title] 공유 제목
 * @param {string} [opts.url] 공유 URL (기본: 현재 페이지)
 */
export async function shareKakao(answerText, opts = {}) {
  const text = ensureText(answerText);
  if (!text) return;

  const title = opts.title || "AIQOO 답변 공유";
  const url = opts.url || window.location.href;

  // Kakao SDK 존재 여부 체크
  const KakaoSDK = window.Kakao;

  if (!KakaoSDK || !KakaoSDK.Share || typeof KakaoSDK.Share.sendDefault !== "function") {
    // 폴백: 클립보드 복사
    const ok = await copyToClipboard(`${title}\n\n${text}\n\n${url}`);
    if (!ok) alert("카카오 SDK가 없어 공유를 진행할 수 없습니다. (클립보드 복사도 실패)");
    else alert("카카오 SDK가 없어 내용이 클립보드에 복사되었습니다.");
    return;
  }

  try {
    // 텍스트형 공유(Feed 템플릿)
    KakaoSDK.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description: text.length > 180 ? text.slice(0, 180) + "…" : text,
        imageUrl:
          opts.imageUrl ||
          "https://dummyimage.com/1200x630/000/fff.png&text=AIQOO", // 원하시면 실제 로고 URL로 교체
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
 * @param {string} [opts.to] 수신자(옵션)
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

/**
 * (선택) default export 호환
 * - 혹시 다른 파일에서 default로 import하는 경우를 대비
 */
export default {
  shareKakao,
  shareMail,
};
