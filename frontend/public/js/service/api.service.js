/* api.service.js
 * - Q&A / STT API 호출 전담
 * - named export: askQA, transcribeAudio
 */

export const API_BASE =
  localStorage.getItem("AIQOO_API_BASE") ||
  "https://aiqa-capstone.onrender.com"; // 필요시 localStorage로 교체: AIQOO_API_BASE

function safeJsonParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  const data = safeJsonParse(text);

  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Q&A 요청
 * 서버: POST /api/answer
 * @param {string|object} input
 *  - string: question
 *  - object: {question, videoKey, videoUrl, provider, youtubeId, t, tLabel}
 */
export async function askQA(input) {
  let payload;

  if (typeof input === "string") {
    const q = input.trim();
    if (!q) return "";
    payload = { question: q };
  } else if (input && typeof input === "object") {
    const q = String(input.question || "").trim();
    if (!q) return "";

    payload = {
      question: q,
      videoKey: input.videoKey || "default",
      videoUrl: input.videoUrl || "",
      provider: input.provider || "",
      youtubeId: input.youtubeId || "",
      t: Number.isFinite(Number(input.t)) ? Number(input.t) : 0,
      tLabel: input.tLabel || "",
    };
  } else {
    return "";
  }

  const data = await fetchJson(`${API_BASE}/api/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return String((data && data.answer) || "");
}

/**
 * STT 요청
 * 서버: POST /api/stt (multipart/form-data, field: audio)
 * @param {FormData} formData
 * @returns {Promise<string>}
 */
export async function transcribeAudio(formData) {
  const data = await fetchJson(`${API_BASE}/api/stt`, {
    method: "POST",
    body: formData,
  });

  return String((data && data.text) || "");
}

export default {
  askQA,
  transcribeAudio,
};
