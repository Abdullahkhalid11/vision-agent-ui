// All calls go to the Vercel functions under /api. None of them carry a secret.

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const CONFIDENCE_FLOOR = 0.5; // the threshold the eval used

async function readJson(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    // non-JSON response: fall through to the generic message
  }
  if (!response.ok) {
    const message = data.error || `request failed (${response.status})`;
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function checkHealth() {
  const response = await fetch("/api/health");
  const data = await readJson(response);
  return data.status === "ok";
}

export async function detectImage(file) {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch("/api/detect", { method: "POST", body: form });
  return readJson(response);
}

export async function askQuestion(imageId, question) {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, question }),
  });
  return readJson(response);
}
