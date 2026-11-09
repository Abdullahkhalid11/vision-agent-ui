import { useState } from "react";
import Markdown from "../Markdown.jsx";
import TraceTimeline from "./TraceTimeline.jsx";
import { getRunTrace } from "../api.js";

export default function Answer({ result }) {
  const [trace, setTrace] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [traceError, setTraceError] = useState("");

  async function toggleTrace() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (trace) return;
    setLoading(true);
    setTraceError("");
    try {
      setTrace(await getRunTrace(result.run_id));
    } catch (err) {
      setTraceError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="answer fade-up">
      <p className="answer-text"><Markdown text={result.answer} /></p>
      <div className="answer-meta">
        <span className={`pill ${result.status === "ok" ? "pill-ok" : "pill-warn"}`}>
          {result.status}
        </span>
        <span className="note">run {result.run_id.slice(0, 8)} · {result.steps} tool round(s)</span>
        <button type="button" className="ghost" onClick={toggleTrace}>
          {open ? "Hide tool trace" : "Show tool trace"}
        </button>
      </div>
      {open && (
        <div className="trace-wrap">
          {loading && <p className="shimmer">Loading the trace…</p>}
          {traceError && <p className="error">{traceError}</p>}
          {trace && <TraceTimeline trace={trace} />}
        </div>
      )}
    </div>
  );
}
