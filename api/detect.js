import {
  forwardToUpstream, readRawBody, sendUpstream, sendError, TooLargeError,
} from "../lib/upstream.js";

// Body parser must be off: the raw multipart bytes are forwarded unchanged.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return res.status(415).json({ error: "send the image as multipart/form-data" });
  }
  try {
    const raw = await readRawBody(req);
    sendUpstream(res, await forwardToUpstream("/detect", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: raw,
    }, req));
  } catch (err) {
    if (err instanceof TooLargeError) {
      return res.status(413).json({ error: err.message });
    }
    sendError(res, err);
  }
}
