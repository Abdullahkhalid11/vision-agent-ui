// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

process.env.UPSTREAM_URL = "https://upstream.example";
process.env.UPSTREAM_API_KEY = "secret-key-123";

const { default: askHandler } = await import("../api/ask.js");
const { default: healthHandler } = await import("../api/health.js");
const { default: detectHandler } = await import("../api/detect.js");

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.json = (b) => { res.body = JSON.stringify(b); res.headers["content-type"] = "application/json"; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

function mockFetch(status, text) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(text, { status, headers: { "content-type": "application/json" } });
  };
  return calls;
}

test("ask rejects non-POST", async () => {
  const res = mockRes();
  await askHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 405);
});

test("ask rejects missing question", async () => {
  const res = mockRes();
  await askHandler({ method: "POST", body: { image_id: "abc" } }, res);
  assert.equal(res.statusCode, 400);
});

test("ask rejects question over 500 characters", async () => {
  const res = mockRes();
  await askHandler({ method: "POST", body: { image_id: "abc", question: "a".repeat(501) } }, res);
  assert.equal(res.statusCode, 400);
});

test("ask forwards only two fields and attaches the key server-side", async () => {
  const calls = mockFetch(200, '{"status":"ok","answer":"1 person"}');
  const res = mockRes();
  await askHandler({
    method: "POST",
    body: { image_id: "abc", question: "How many?", extra: "should-not-forward" },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url, "https://upstream.example/ask");
  assert.equal(calls[0].init.headers["X-API-Key"], "secret-key-123");
  const forwarded = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(forwarded).sort(), ["image_id", "question"]);
  assert.ok(!res.body.includes("secret-key-123"), "the key must never appear in a response");
});

test("upstream 429 is passed through unchanged", async () => {
  mockFetch(429, '{"detail":"rate limit exceeded"}');
  const res = mockRes();
  await askHandler({ method: "POST", body: { image_id: "abc", question: "q" } }, res);
  assert.equal(res.statusCode, 429);
});

test("health returns upstream body without the key", async () => {
  const calls = mockFetch(200, '{"status":"ok","model_file_present":true}');
  const res = mockRes();
  await healthHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url, "https://upstream.example/health");
  assert.ok(!res.body.includes("secret-key-123"));
});

test("upstream unreachable returns 502, not a stack trace", async () => {
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  const res = mockRes();
  await healthHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.statusCode, 502);
  assert.ok(!res.body.includes("TypeError"));
});

test("detect refuses non-multipart content", async () => {
  const res = mockRes();
  await detectHandler({ method: "POST", headers: { "content-type": "application/json" } }, res);
  assert.equal(res.statusCode, 415);
});

test("detect refuses bodies over 4 MB", async () => {
  const big = Buffer.alloc(4 * 1024 * 1024 + 1, 1);
  const req = Readable.from([big]);
  req.method = "POST";
  req.headers = { "content-type": "multipart/form-data; boundary=x" };
  const res = mockRes();
  await detectHandler(req, res);
  assert.equal(res.statusCode, 413);
});

test("detect forwards the raw multipart body with its boundary", async () => {
  const calls = mockFetch(200, '{"image_id":"id1","cached":false,"detections":[]}');
  const body = Buffer.from("--x\r\nContent-Disposition: form-data; name=\"file\"\r\n\r\nDATA\r\n--x--\r\n");
  const req = Readable.from([body]);
  req.method = "POST";
  req.headers = { "content-type": "multipart/form-data; boundary=x" };
  const res = mockRes();
  await detectHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].init.headers["Content-Type"], "multipart/form-data; boundary=x");
  assert.equal(Buffer.compare(Buffer.from(calls[0].init.body), body), 0);
});
