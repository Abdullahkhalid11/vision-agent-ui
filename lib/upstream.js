// Server-side helpers for the Vercel functions. The API key is read from environment
// variables and never sent to the browser.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel's function body limit is about 4.5 MB
export const UPSTREAM_TIMEOUT_MS = 28000;        // stay under the 30 s function limit

export class ConfigError extends Error {}
export class TooLargeError extends Error {}

export function upstreamConfig() {
  const base = (process.env.UPSTREAM_URL || "").replace(/\/+$/, "");
  const key = process.env.UPSTREAM_API_KEY || "";
  if (!base || !key) {
    throw new ConfigError("server is not configured");
  }
  return { base, key };
}

// The visitor's IP, so the backend can rate-limit each visitor separately. Vercel's own header
// is preferred. The last X-Forwarded-For entry is the one added by the platform, not the one a
// visitor typed. Verify this once on the deployed site before relying on it.
export function clientIp(req) {
  const vercel = req.headers["x-vercel-forwarded-for"];
  if (typeof vercel === "string" && vercel.trim()) {
    return vercel.split(",")[0].trim();
  }
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1];
  }
  return (req.socket && req.socket.remoteAddress) || "";
}

export async function readRawBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_UPLOAD_BYTES) {
      throw new TooLargeError("image is larger than 4 MB");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// init: fetch options. req: the incoming request, used only to pass the visitor's IP on.
export async function forwardToUpstream(path, init, req) {
  const { base, key } = upstreamConfig();
  const headers = { ...(init.headers || {}), "X-API-Key": key };
  if (req) {
    headers["X-Client-IP"] = clientIp(req);
  }
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  const text = await response.text();
  return { status: response.status, text };
}

export function sendUpstream(res, { status, text }) {
  res.status(status).setHeader("Content-Type", "application/json").send(text);
}

export function sendError(res, err) {
  if (err instanceof ConfigError) {
    return res.status(500).json({ error: "server is not configured" });
  }
  if (err instanceof TooLargeError) {
    return res.status(413).json({ error: err.message });
  }
  if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return res.status(504).json({ error: "the demo server took too long; try again" });
  }
  return res.status(502).json({ error: "the demo server is unreachable right now" });
}
