// All calls go to the Vercel functions under /api. None of them carry a secret.

async function readJson(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    // non-JSON response: fall through to the generic message
  }
  if (!response.ok) {
    const err = new Error(data.error || `request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }
  return data;
}

export async function checkHealth() {
  const data = await readJson(await fetch("/api/health"));
  return data.status === "ok";
}

export async function detectImage(file) {
  const form = new FormData();
  form.append("file", file, file.name);
  return readJson(await fetch("/api/detect", { method: "POST", body: form }));
}

export async function askQuestion(imageId, question) {
  return readJson(await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_id: imageId, question }),
  }));
}

export async function getRunTrace(runId) {
  return readJson(await fetch(`/api/run?id=${encodeURIComponent(runId)}`));
}

export async function loadSampleManifest() {
  try {
    const response = await fetch("/samples/manifest.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data.filter((x) => x && typeof x.file === "string") : [];
  } catch {
    return [];
  }
}

export async function loadSampleFile(entry) {
  const response = await fetch(`/samples/${encodeURIComponent(entry.file)}`);
  if (!response.ok) throw new Error("the sample photo could not be loaded");
  const blob = await response.blob();
  return new File([blob], entry.file, { type: blob.type || "image/jpeg" });
}
