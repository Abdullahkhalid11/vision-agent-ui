import { tokenize } from "./markdown.js";

export default function Markdown({ text }) {
  return (
    <>
      {tokenize(String(text ?? "")).map((t, i) => {
        if (t.type === "bold") return <strong key={i}>{t.value}</strong>;
        if (t.type === "code") return <code key={i}>{t.value}</code>;
        return <span key={i}>{t.value}</span>;
      })}
    </>
  );
}
