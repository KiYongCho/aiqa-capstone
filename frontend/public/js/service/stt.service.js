// services/stt.service.js
import { transcribeAudio } from "/js/service/api.service.js";

export function createSTTService(onStatus, setText) {
  let recorder = null;
  let chunks = [];
  let stream = null;

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    recorder = new MediaRecorder(stream);
    chunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const fd = new FormData();
        fd.append("audio", blob, "speech.webm");

        onStatus?.("🧠 전사 중...");
        const text = await transcribeAudio(fd);
        setText?.(String(text || "").trim());
        onStatus?.("✅ 전사 완료");
      } catch (err) {
        console.error(err);
        onStatus?.("❗ 전사 실패");
      } finally {
        // 마이크 스트림 정리
        try {
          stream?.getTracks()?.forEach((t) => t.stop());
        } catch (_) {}
        stream = null;
      }
    };

    recorder.start();
    onStatus?.("🎙 녹음 중...");
  }

  function stop() {
    try {
      recorder?.stop();
    } catch (_) {}
  }

  return { start, stop };
}
