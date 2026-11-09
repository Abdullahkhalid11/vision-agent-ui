// A small, safe inline renderer for **bold** and `code`. It returns tokens. The React layer
// turns them into elements, so no HTML is ever injected into the page.
export function tokenize(text) {
  const tokens = [];
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: "text", value: text.slice(last, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith("**")) {
      tokens.push({ type: "bold", value: raw.slice(2, -2) });
    } else {
      tokens.push({ type: "code", value: raw.slice(1, -1) });
    }
    last = match.index + raw.length;
  }
  if (last < text.length) {
    tokens.push({ type: "text", value: text.slice(last) });
  }
  return tokens;
}
