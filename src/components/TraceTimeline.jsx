export default function TraceTimeline({ trace }) {
  if (!trace) return null;
  if (trace.tool_calls.length === 0) {
    return (
      <p className="note">
        No tools were called. The guard or the model answered without looking at the detections.
      </p>
    );
  }
  return (
    <ol className="trace">
      {trace.tool_calls.map((c, i) => (
        <li
          key={`${c.step}-${i}`}
          className={c.ok ? "trace-step ok" : "trace-step failed"}
          style={{ animationDelay: `${i * 140}ms` }}
        >
          <div className="trace-head">
            <span className="trace-index">{c.step}</span>
            <strong className="trace-tool">{c.tool_name}</strong>
            <span className="trace-ms">{c.latency_ms} ms</span>
          </div>
          <code className="trace-args">{c.args ? JSON.stringify(c.args) : "no arguments"}</code>
          <div className="trace-result">
            {c.ok ? <code>{c.result_summary}</code> : <span className="trace-error">{c.error}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
