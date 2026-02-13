// share.service.js
// - 카카오 공유 길이 제한 대응 (요약 전송)
// - 필요하면 전체 답변을 클립보드로 복사(사용자가 카톡에 붙여넣기 가능)
// - shareKakao({ question, answer, shareUrl }) 형태로 사용
//
// 요구사항:
// 1) 모바일 확인 불필요 -> 브라우저 환경에서 안정 동작만 집중
// 2) 전체 문장 잘림 방지 -> 카카오에는 요약, 전체는 복사/URL

const KAKAO_DESC_MAX = 900; // 안전하게 900자(환경/템플릿에 따라 더 짧게 잡아도 됨)

function normalizeText(input) {
  return (input ?? "")
    .toString()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeSummary(text, maxLen) {
  const t = normalizeText(text);
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 3) + "...";
}

async function copyToClipboard(text) {
  const t = normalizeText(text);
  if (!t) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch (_) {
    // fallback 시도
  }

  // 구형 fallback
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

function assertKakaoReady() {
  if (!window.Kakao) throw new Error("Kakao SDK가 로드되지 않았습니다.");
  if (!window.Kakao.isInitialized?.()) throw new Error("Kakao SDK가 initialize되지 않았습니다.");
}

export async function shareKakao({ question, answer, shareUrl, autoCopyFullText = true }) {
  assertKakaoReady();

  const q = normalizeText(question);
  const a = normalizeText(answer);

  const fullText = `❓ 질문\n${q}\n\n💡 답변\n${a}`;
  const summary = makeSummary(fullText, KAKAO_DESC_MAX);

  // 카카오 전송 전에 전체를 클립보드로 복사(선택)
  let copied = false;
  if (autoCopyFullText) {
    copied = await copyToClipboard(fullText);
  }

  const url = shareUrl || window.location.href;

  // feed 타입이 가장 UI가 안정적
  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: "AIQOO Q&A",
      description: summary,
      // imageUrl은 필수인 경우가 있어 안전하게 기본 썸네일을 쓰거나 제거/대체하세요.
      // 프로젝트에 썸네일이 없다면 아래 라인은 지우고, 카카오 정책에 맞게 처리하세요.
      imageUrl: "https://dummyimage.com/1200x630/111827/e5e7eb&text=AIQOO",
      link: {
        webUrl: url,
        mobileWebUrl: url,
      },
    },
    buttons: [
      {
        title: "전체 보기",
        link: {
          webUrl: url,
          mobileWebUrl: url,
        },
      },
    ],
  });

  return { copied, summary, fullText };
}
