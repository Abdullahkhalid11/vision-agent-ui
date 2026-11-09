import { useEffect, useMemo, useState } from "react";
import BoxCanvas from "./BoxCanvas.jsx";
import { askQuestion, checkHealth, detectImage, MAX_IMAGE_BYTES, CONFIDENCE_FLOOR } from "./api.js";

const EXAMPLES = [
  "How many cars are in this image?",
  "Is there a person in this image?",
  "Which objects are present?",
];

export default function App() {
  const [online, setOnline] = useState(null);
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [upload, setUpload] = useState(null); // { image_id, cached, detections }
  const [minConfidence, setMinConfidence] = useState(CONFIDENCE_FLOOR);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null); // { answer, run_id, status, steps }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    checkHealth().then(setOnline).catch(() => setOnline(false));
  }, []);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const counts = useMemo(() => {
    if (!upload) return {};
    const out = {};
    for (const d of upload.detections) {
      if (d.confidence >= minConfidence) out[d.label] = (out[d.label] || 0) + 1;
    }
    return out;
  }, [upload, minConfidence]);

  async function onPick(e) {
    const picked = e.target.files?.[0];
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

  async function onAsk(text) {
    const q = text.trim();
    if (!upload || !q) return;
    setError("");
    setAnswer(null);
    setBusy("Asking the agent…");
    try {
      setAnswer(await askQuestion(upload.image_id, q));
    } catch (err) {
      setError(
        err.status === 429
          ? "Too many questions in a minute. Wait a moment and try again."
          : err.message
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Vision Agent</h1>
        <p className="lede">
          Upload a photo. YOLOv8 detects the objects, then an LLM agent answers your
          questions by calling tools over those detections. It never sees the pixels.
        </p>
        <p className={`status ${online ? "up" : online === false ? "down" : ""}`}>
          {online === null && "Checking demo server…"}
          {online === true && "Demo server online"}
          {online === false &&
            "Demo server offline. It runs on a personal machine, so it is sometimes unavailable."}
        </p>
      </header>

      <section className="panel">
        <label className="file-pick">
          <input type="file" accept="image/jpeg,image/png" onChange={onPick} disabled={!online} />
          <span>{file ? file.name : "Choose a JPEG or PNG (max 4 MB)"}</span>
        </label>
        {busy && <p className="busy">{busy}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>

      {upload && (
        <section className="panel two-col">
          <div>
            <BoxCanvas imageUrl={imageUrl} detections={upload.detections} minConfidence={minConfidence} />
          </div>
          <div>
            <h2>Detections</h2>
            <p className="note">
              {upload.cached ? "Cached result: this exact image was seen before." : "New result from the model."}
            </p>
            <label className="slider">
              Show boxes at confidence ≥ {Math.round(minConfidence * 100)}%
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </label>
            <ul className="counts">
              {Object.entries(counts).length === 0 && <li>Nothing above this threshold.</li>}
              {Object.entries(counts).map(([label, n]) => (
                <li key={label}>
                  <strong>{label}</strong>: {n}
                </li>
              ))}
            </ul>
            <p className="note">Green boxes are at 50% or higher, the threshold used in the evaluation.</p>
          </div>
        </section>
      )}

      {upload && (
        <section className="panel">
          <h2>Ask about this image</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onAsk(question);
            }}
          >
            <input
              className="question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder="Ask a question about the image"
              disabled={!!busy}
            />
            <button type="submit" disabled={!!busy || !question.trim()}>Ask</button>
          </form>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="chip" onClick={() => { setQuestion(ex); onAsk(ex); }} disabled={!!busy}>
                {ex}
              </button>
            ))}
          </div>
          {answer && (
            <div className="answer">
              <p>{answer.answer}</p>
              <p className="note">
                Run {answer.run_id.slice(0, 8)} · status {answer.status} · {answer.steps} tool round(s)
              </p>
            </div>
          )}
        </section>
      )}

      <footer>
        <p>
          Built with FastAPI, onnxruntime (YOLOv8n), SQLite, and Groq. Uploads are not
          kept on the server: only a hash, the image size, and its detections are stored.
        </p>
      </footer>
    </div>
  );
}
