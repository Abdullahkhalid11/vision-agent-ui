// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../src/markdown.js";

test("bold is split out from surrounding text", () => {
  assert.deepEqual(tokenize("There is **1 person** in the image."), [
    { type: "text", value: "There is " },
    { type: "bold", value: "1 person" },
    { type: "text", value: " in the image." },
  ]);
});

test("inline code is recognised", () => {
  assert.deepEqual(tokenize("Use `count_labels`."), [
    { type: "text", value: "Use " },
    { type: "code", value: "count_labels" },
    { type: "text", value: "." },
  ]);
});

test("plain text passes through unchanged", () => {
  assert.deepEqual(tokenize("No formatting here."), [{ type: "text", value: "No formatting here." }]);
});

test("unclosed markers are left as text", () => {
  assert.deepEqual(tokenize("a ** b"), [{ type: "text", value: "a ** b" }]);
});

test("HTML is never interpreted, only returned as text", () => {
  const tokens = tokenize("<img src=x onerror=alert(1)> **ok**");
  assert.equal(tokens[0].type, "text");
  assert.equal(tokens[0].value, "<img src=x onerror=alert(1)> ");
  assert.equal(tokens[1].type, "bold");
});

test("empty input gives no tokens", () => {
  assert.deepEqual(tokenize(""), []);
});
