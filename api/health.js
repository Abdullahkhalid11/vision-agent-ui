import { forwardToUpstream, sendUpstream, sendError } from "../lib/upstream.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }
  try {
    sendUpstream(res, await forwardToUpstream("/health", { method: "GET" }));
  } catch (err) {
    sendError(res, err);
  }
}
