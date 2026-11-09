import { forwardToUpstream, sendUpstream, sendError } from "../lib/upstream.js";

// Only these two fields are forwarded. The backend validates them again.
function validate(body) {
  if (!body || typeof body !== "object") return "send a JSON object";
  const { image_id, question } = body;
  if (typeof image_id !== "string" || image_id.length < 1 || image_id.length > 64) {
    return "image_id is required";
  }
  if (typeof question !== "string" || question.trim().length < 1 || question.length > 500) {
    return "question must be 1 to 500 characters";
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  const problem = validate(req.body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }
  try {
    sendUpstream(res, await forwardToUpstream("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_id: req.body.image_id, question: req.body.question }),
    }, req));
  } catch (err) {
    sendError(res, err);
  }
}
