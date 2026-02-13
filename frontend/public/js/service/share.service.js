// /js/service/share.service.js

function ensureKakaoReady() {
  if (!window.Kakao) throw new Error("Kakao SDK가 로드되지 않았습니다.");
  if (typeof window.Kakao.isInitialized === "function") {
    if (!window.Kakao.isInitialized()) {
      const key = (document.body?.dataset?.kakaoKey || "").trim();
      if (!key) throw new Error("Kakao key가 없습니다. (body[data-kakao-key])");
      window.Kakao.init(key);
    }
  }
}

function safeUrl(url) {
  try {
    return new URL(url).toString();
  } catch {
    return window.location.href;
  }
}

// ✅ 카카오 텍스트가 너무 길면 실패/절삭 리스크가 있어 안전하게 컷
function safeText(s, maxLen = 900) {
  const t = String(s ?? "");
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + "…";
}

export async function shareKakao({
  question,
  answer,
  shareUrl,
  autoCopyFullText = true,
}) {
  ensureKakaoReady();

  const q = String(question || "").trim();
  const a = String(answer || "").trim();

  const url = safeUrl(shareUrl || window.location.href);

  // ✅ 카카오 링크는 텍스트 길이 제한이 있어서 요약 텍스트로 전송
  const title = "AIQOO 답변 공유";

  // 요약 A 길이 (너무 길면 카카오 실패 가능)
  const A_SNIPPET = 200;

  const description =
    (q ? `Q: ${q}\n` : "") +
    (a ? `A: ${a.slice(0, A_SNIPPET)}${a.length > A_SNIPPET ? "…" : ""}` : "");

  // ✅ “전체보기 링크”를 카톡 본문에 명시적으로 포함(가장 확실)
  // - 사용자에게 보이는 텍스트에 url 문자열을 그대로 넣음
  const messageText = safeText(
    `${title}\n\n${description}\n\n전체보기 링크:\n${url}`,
    900
  );

  // 요구사항 반영: UI의 답변 이모지(💡) 제거에 맞춰 공유 텍스트도 통일
  // ✅ 클립보드 복사에는 "전체 답변 + 링크" 포함
  const fullTextRaw = `❓ 질문\n${q}\n\n답변\n${a}\n\n전체보기 링크: ${url}`;

  // ✅ 자동 복사 옵션 (카카오는 요약 전송 + 전체 문장을 클립보드에 복사)
  let copied = false;
  if (autoCopyFullText) {
    try {
      await navigator.clipboard.writeText(fullTextRaw);
      copied = true;
    } catch {
      copied = false;
    }
  }

  // ✅ Kakao 공유
  try {
    window.Kakao.Share.sendDefault({
      objectType: "text",
      text: messageText,
      link: {
        mobileWebUrl: url,
        webUrl: url,
      },
      buttons: [
        {
          title: "전체보기",
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
  } catch (e) {
    console.error("[shareKakao] sendDefault failed:", e);
    throw e;
  }

  return { copied };
}
