// public/js/services/share.service.js

export function createShareService(kakaoKey) {

  function initKakao() {
    if (!window.Kakao) return false;
    if (!kakaoKey) return false;
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(kakaoKey);
    }
    return true;
  }

  // ✅ mobileWebUrl 제거 (요청사항 3)
  async function shareKakao(text, link) {
    if (!initKakao()) {
      alert("카카오 초기화 실패 (Kakao JS Key 확인 필요)");
      return;
    }

    await window.Kakao.Share.sendDefault({
      objectType: "text",
      text: text,
      link: { webUrl: link }
    });
  }

  function shareMail(subject, body) {
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(body);
    window.location.href = `mailto:?subject=${s}&body=${b}`;
  }

  return { shareKakao, shareMail };
}
