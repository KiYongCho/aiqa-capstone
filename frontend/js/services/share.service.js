// services/share.service.js

export function createShareService(kakaoKey) {

    function initKakao() {
      if (!window.Kakao) return false;
      if (!kakaoKey) return false;
      if (!window.Kakao.isInitialized()) {
        window.Kakao.init(kakaoKey);
      }
      return true;
    }
  
    async function shareKakao(text, link) {
      if (!initKakao()) {
        alert("카카오 초기화 실패");
        return;
      }
  
      await window.Kakao.Share.sendDefault({
        objectType: "text",
        text: text,
        link: { mobileWebUrl: link, webUrl: link }
      });
    }
  
    function shareMail(subject, body) {
      const s = encodeURIComponent(subject);
      const b = encodeURIComponent(body);
      window.location.href = `mailto:?subject=${s}&body=${b}`;
    }
  
    return { shareKakao, shareMail };
  }
  