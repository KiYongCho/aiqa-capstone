// services/stt.service.js

import { transcribeAudio } from "./api.service.js";

export function createSTTService(onStatus, setText) {

  let recorder;
  let chunks = [];

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");

      onStatus("🧠 전사 중...");
      try {
        const text = await transcribeAudio(fd);
        setText(text);
        onStatus("✅ 전사 완료");
      } catch (err) {
        onStatus("❗ 전사 실패");
      }
    };

    recorder.start();
    onStatus("🎙 녹음 중...");
  }

  function stop() {
    recorder?.stop();
  }

  return { start, stop };
}
