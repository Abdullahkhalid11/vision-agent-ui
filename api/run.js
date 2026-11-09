import { forwardToUpstream, sendUpstream, sendError } from "../lib/upstream.js";

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Read-only trace of one run. The id is checked here and again by the backend.
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }
  const id = req.query && req.query.id;
  if (typeof id !== "string" || !RUN_ID.test(id)) {
    return res.status(400).json({ error: "invalid run id" });
  }
  try {
    sendUpstream(res, await forwardToUpstream(`/runs/${id}`, { method: "GET" }, req));
  } catch (err) {
    sendError(res, err);
  }
}
