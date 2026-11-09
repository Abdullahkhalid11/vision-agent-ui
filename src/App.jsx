import { useEffect, useMemo, useRef, useState } from "react";
import BoxCanvas from "./components/BoxCanvas.jsx";
import SamplePicker from "./components/SamplePicker.jsx";
import Answer from "./components/Answer.jsx";
import { PROFILE, CONFIDENCE_FLOOR, MAX_IMAGE_BYTES } from "./config.js";
import {
  askQuestion, checkHealth, detectImage, loadSampleFile, loadSampleManifest,
} from "./api.js";

const EXAMPLES = [
  "How many cars are in this image?",
  "Is there a person in this image?",
  "Which objects are present?",
];

export default function App() {
  const [online, setOnline] = useState(null);
  const [samples, setSamples] = useState([]);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [upload, setUpload] = useState(null);
  const [minConfidence, setMinConfidence] = useState(CONFIDENCE_FLOOR);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    checkHealth().then(setOnline).catch(() => setOnline(false));
    loadSampleManifest().then(setSamples);
  }, []);

  useEffect(() => () => imageUrl && URL.revokeObjectURL(imageUrl), [imageUrl]);

  const counts = useMemo(() => {
    const out = {};
    for (const d of upload?.detections ?? []) {
      if (d.confidence >= minConfidence) out[d.label] = (out[d.label] || 0) + 1;
    }
    return out;
  }, [upload, minConfidence]);

  const step = answer ? 3 : upload ? 2 : 1;

  async function takePhoto(picked) {
    setError("");
    setAnswer(null);
    setUpload(null);
    if (!picked) return;
    if (!/^image\/(jpeg|png)$/.test(picked.type)) {
      setError("Please choose a JPEG or PNG image.");
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setError("That image is larger than 4 MB. Please choose a smaller one.");
      return;
    }
    setFile(picked);
    setImageUrl(URL.createObjectURL(picked));
    setBusy("Detecting objects…");
    try {
      setUpload(await detectImage(picked));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function pickSample(entry) {
    setBusy("Loading sample…");
    try {
      await takePhoto(await loadSampleFile(entry));
    } catch (err) {
      setBusy("");
      setError(err.message);
    }
  }

  async function ask(text) {
    const q = text.trim();
    if (!upload || !q) return;
    setError("");
    setAnswer(null);
    setBusy("The agent is calling its tools…");
    try {
      setAnswer({ ...(await askQuestion(upload.image_id, q)), question: q });
    } catch (err) {
      setError(err.status === 429
        ? "Too many questions in a minute. Wait a moment and try again."
        : err.message);
    } finally {
      setBusy("");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    takePhoto(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />

      <header className="hero fade-up">
        <div className="hero-top">
          <p className="eyebrow">Live demo · Vision Agent</p>
          <span className={`status ${online === true ? "up" : online === false ? "down" : ""}`}>
            <span className="dot" />
            {online === null && "Checking the demo server"}
            {online === true && "Demo server online"}
            {online === false && "Demo server offline"}
          </span>
        </div>
        <h1>
          Ask a question about a photo.<br />
          <span className="gradient-text">Watch the agent work.</span>
        </h1>
        <p className="lede">
          YOLOv8n detects the objects. A tool-calling LLM agent answers by calling tools over those
          detections. The model never sees the pixels, and every tool call is shown below.
        </p>
        <p className="byline">
          Built by <strong>{PROFILE.name}</strong>, {PROFILE.role}. {PROFILE.tagline}
        </p>
        <nav className="links">
          {PROFILE.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label} ↗</a>
          ))}
        </nav>
        {online === false && (
          <p className="notice">
            The model runs on a personal server, so the demo is sometimes unavailable. The source
            code and measured results are linked above.
          </p>
        )}
      </header>

      <ol className="stepper fade-up" style={{ animationDelay: "80ms" }} aria-label="Progress">
        {["Choose a photo", "Review detections", "Ask the agent"].map((label, i) => (
          <li key={label} className={i + 1 <= step ? "done" : ""}>
            <span className="step-num">{i + 1}</span>{label}
          </li>
        ))}
      </ol>

      <section className="card fade-up" style={{ animationDelay: "140ms" }}>
        <div
          className={`dropzone ${dragging ? "dragging" : ""} ${!online ? "disabled" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => online && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" && online) inputRef.current?.click(); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            hidden
            onChange={(e) => takePhoto(e.target.files?.[0])}
            disabled={!online}
          />
          <div className="drop-icon" aria-hidden="true">⬆</div>
          <strong>{file ? file.name : "Drop a JPEG or PNG here, or click to choose"}</strong>
          <span className="note">Up to 4 MB. The photo is not kept: only its hash and detections.</span>
        </div>
        <SamplePicker samples={samples} onPick={pickSample} disabled={!online || !!busy} />
        {busy && <p className="busy"><span className="spinner" />{busy}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {upload && (
        <section className="card fade-up two-col">
          <div className="photo-frame">
            <BoxCanvas
              imageUrl={imageUrl}
              detections={upload.detections}
              minConfidence={minConfidence}
              label={`Photo with ${Object.values(counts).reduce((a, b) => a + b, 0)} detected objects`}
            />
          </div>
          <div>
            <h2>What the detector sees</h2>
            <p className="note">
              {upload.cached
                ? "Cached: this exact photo was analysed before."
                : "New analysis by YOLOv8n."}
            </p>
            <label className="slider">
              <span>Boxes at confidence ≥ <strong>{Math.round(minConfidence * 100)}%</strong></span>
              <input
                type="range" min="0.1" max="0.9" step="0.05" value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </label>
            <ul className="counts">
              {Object.keys(counts).length === 0 && <li className="note">Nothing at this threshold.</li>}
              {Object.entries(counts).map(([label, n]) => (
                <li key={label}><span>{label}</span><strong>{n}</strong></li>
              ))}
            </ul>
            <p className="note">
              Green boxes are at 50% or higher, the threshold used in the evaluation. Amber boxes are
              below it.
            </p>
          </div>
        </section>
      )}

      {upload && (
        <section className="card fade-up">
          <h2>Ask about this photo</h2>
          <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="ask-form">
            <input
              className="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder="Ask a question about the photo"
              disabled={!!busy}
            />
            <button type="submit" className="primary" disabled={!!busy || !question.trim()}>
              Ask
            </button>
          </form>
          <div className="chips">
            {EXAMPLES.map((ex) => (
              <button
                key={ex} type="button" className="chip"
                onClick={() => { setQuestion(ex); ask(ex); }}
                disabled={!!busy}
              >
                {ex}
              </button>
            ))}
          </div>
          {answer && <Answer result={answer} />}
        </section>
      )}

      <footer className="footer">
        <p>
          <strong>{PROFILE.name}</strong> · {PROFILE.role} · {PROFILE.location}
        </p>
        <p className="note">
          FastAPI · ONNX Runtime (YOLOv8n) · SQLite · Groq (gpt-oss-120b) · React · Vercel.
          <br />
          Every run is stored with its tool calls, so you can audit any answer.
        </p>
      </footer>
    </div>
  );
}
