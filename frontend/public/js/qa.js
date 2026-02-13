/* qa.js
 * - 단발 응답을 타이핑 스트리밍처럼 표시
 */

import { mountQA } from "/js/ui/qa.view.js";
import { askQA } from "/js/service/api.service.js";
import { openAnswerModal } from "/js/ui/modal.view.js";
import { shareKakao, shareMail } from "/js/service/share.service.js";

export function initQA({ rootEl, autoShow = false } = {}) {
  const ui = mountQA(rootEl, {
    async onSend(text) {
      ui.setStatus("요청 중...");

      const answerHandle = ui.appendQA({ questionText: text });

      try {
        const answer = await askQA(text);
        ui.setStatus("타이핑 출력 중...");

        // ✅ 타이핑 스트리밍(시뮬레이션)
        await answerHandle.typeAnswer(answer || "");

        ui.setStatus("완료");
        ui.clearQuestion();
      } catch (err) {
        console.error(err);
        answerHandle.setAnswerInstant(
          "답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
        );
        ui.setStatus("오류");
      }
    },

    onExpand(answerText) {
      openAnswerModal(answerText);
    },

    onShareKakao(answerText) {
      shareKakao(answerText);
    },

    onShareMail(answerText) {
      shareMail(answerText);
    },
  });

  // ✅ 초기 표시 옵션
  if (autoShow) ui.show();

  return ui;
}
