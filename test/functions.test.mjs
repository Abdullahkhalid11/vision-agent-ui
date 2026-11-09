// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

process.env.UPSTREAM_URL = "https://upstream.example";
process.env.UPSTREAM_API_KEY = "secret-key-123";

const { default: askHandler } = await import("../api/ask.js");
const { default: healthHandler } = await import("../api/health.js");
const { default: detectHandler } = await import("../api/detect.js");
const { default: runHandler } = await import("../api/run.js");
const { clientIp } = await import("../lib/upstream.js");

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.json = (b) => { res.body = JSON.stringify(b); return res; };
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
  await askHandler({ method: "POST", body: { image_id: "abc" }, headers: {} }, res);
  assert.equal(res.statusCode, 400);
});

test("ask rejects question over 500 characters", async () => {
  const res = mockRes();
  await askHandler({ method: "POST", body: { image_id: "abc", question: "a".repeat(501) }, headers: {} }, res);
  assert.equal(res.statusCode, 400);
});

test("ask forwards only two fields, the key, and the visitor IP", async () => {
  const calls = mockFetch(200, '{"status":"ok","answer":"1 person"}');
  const res = mockRes();
  await askHandler({
    method: "POST",
    headers: { "x-vercel-forwarded-for": "203.0.113.9" },
    body: { image_id: "abc", question: "How many?", extra: "should-not-forward" },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url, "https://upstream.example/ask");
  assert.equal(calls[0].init.headers["X-API-Key"], "secret-key-123");
  assert.equal(calls[0].init.headers["X-Client-IP"], "203.0.113.9");
  const forwarded = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(forwarded).sort(), ["image_id", "question"]);
  assert.ok(!res.body.includes("secret-key-123"), "the key must never appear in a response");
});

test("upstream 429 is passed through unchanged", async () => {
  mockFetch(429, '{"detail":"too many questions"}');
  const res = mockRes();
  await askHandler({ method: "POST", headers: {}, body: { image_id: "abc", question: "q" } }, res);
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
  const req = Readable.from([Buffer.alloc(4 * 1024 * 1024 + 1, 1)]);
  req.method = "POST";
  req.headers = { "content-type": "multipart/form-data; boundary=x" };
  const res = mockRes();
  await detectHandler(req, res);
  assert.equal(res.statusCode, 413);
});

test("detect forwards the raw multipart body, boundary, and visitor IP", async () => {
  const calls = mockFetch(200, '{"image_id":"id1","cached":false,"detections":[]}');
  const body = Buffer.from("--x\r\nContent-Disposition: form-data; name=\"file\"\r\n\r\nDATA\r\n--x--\r\n");
  const req = Readable.from([body]);
  req.method = "POST";
  req.headers = { "content-type": "multipart/form-data; boundary=x", "x-forwarded-for": "198.51.100.7" };
  const res = mockRes();
  await detectHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].init.headers["Content-Type"], "multipart/form-data; boundary=x");
  assert.equal(calls[0].init.headers["X-Client-IP"], "198.51.100.7");
  assert.equal(Buffer.compare(Buffer.from(calls[0].init.body), body), 0);
});

test("run trace rejects a malformed id without calling the backend", async () => {
  const calls = mockFetch(200, "{}");
  const res = mockRes();
  await runHandler({ method: "GET", headers: {}, query: { id: "../../secrets" } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("run trace forwards a valid id to the read-only backend route", async () => {
  const id = "a1b5102d-2a81-45e0-b4c3-1581b4ebf915";
  const calls = mockFetch(200, '{"run":{}, "tool_calls":[]}');
  const res = mockRes();
  await runHandler({ method: "GET", headers: { "x-forwarded-for": "192.0.2.5" }, query: { id } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url, `https://upstream.example/runs/${id}`);
  assert.equal(calls[0].init.headers["X-Client-IP"], "192.0.2.5");
});

test("run trace rejects non-GET", async () => {
  const res = mockRes();
  await runHandler({ method: "POST", headers: {}, query: {} }, res);
  assert.equal(res.statusCode, 405);
});

test("clientIp prefers Vercel's header, then the last forwarded entry", () => {
  assert.equal(clientIp({ headers: { "x-vercel-forwarded-for": "1.1.1.1, 2.2.2.2" } }), "1.1.1.1");
  assert.equal(clientIp({ headers: { "x-forwarded-for": "spoofed, 3.3.3.3" } }), "3.3.3.3");
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: "4.4.4.4" } }), "4.4.4.4");
});
