// qa.js
import { createLectureStore } from "./core/store.js";
import { formatTime } from "./core/utils.js";
import { askLLM } from "./services/api.service.js";
import { createPlayerService } from "./services/player.service.js";
import { createSTTService } from "./services/stt.service.js";
import { createShareService } from "./services/share.service.js";
import { renderQA } from "./ui/qa.view.js";

const player = createPlayerService();
const store = createLectureStore(() => videoKey);
const share = createShareService("4632c8134c3d32664cbef8f20b497882"); // kako api key

let videoKey = "default";

const qaList = document.getElementById("qaList");
const questionInput = document.getElementById("questionInput");
const submitBtn = document.getElementById("submitBtn");
const voiceBtn = document.getElementById("voiceBtn");
const voiceStatus = document.getElementById("voiceStatus");

const stt = createSTTService(
  (msg) => voiceStatus.textContent = msg,
  (text) => questionInput.value = text
);

submitBtn.addEventListener("click", async () => {

  player.notifyPause();

  const question = questionInput.value.trim();
  if (!question) return;

  const items = store.load();

  items.push({
    question,
    time: formatTime(),
    answer: ""
  });

  store.save(items);
  renderQA(qaList, items);

  const timeInfo = await player.requestTime();

  try {
    const answer = await askLLM({
      question,
      t: timeInfo.t
    });

    items[items.length - 1].answer = answer;
    store.save(items);
    renderQA(qaList, items);

  } catch {
    items[items.length - 1].answer = "❗ 답변 실패";
    store.save(items);
    renderQA(qaList, items);
  }
});

voiceBtn.addEventListener("click", () => {
  if (voiceBtn.dataset.rec === "1") {
    stt.stop();
    voiceBtn.dataset.rec = "0";
  } else {
    stt.start();
    voiceBtn.dataset.rec = "1";
  }
});

renderQA(qaList, store.load());
