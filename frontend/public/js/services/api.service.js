// services/api.service.js

export const API_BASE = "https://aiqa-capstone.onrender.com";

async function safeJson(res) {
  try { return await res.json(); }
  catch { return {}; }
}

export async function askLLM(payload) {
  const res = await fetch(API_BASE + "/api/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeJson(res);

  if (!res.ok) {
    throw new Error(data?.error || "LLM 요청 실패");
  }

  return data.answer || "";
}

export async function transcribeAudio(formData) {
  const res = await fetch(API_BASE + "/api/stt", {
    method: "POST",
    body: formData,
  });

  const data = await safeJson(res);

  if (!res.ok) {
    throw new Error(data?.error || "STT 실패");
  }

  return data.text || "";
}
