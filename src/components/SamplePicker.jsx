export default function SamplePicker({ samples, onPick, disabled }) {
  if (!samples || samples.length === 0) return null;
  return (
    <div className="samples">
      <span className="samples-label">No photo handy? Try a sample:</span>
      <div className="samples-row">
        {samples.map((s) => (
          <button
            key={s.file}
            type="button"
            className="sample"
            onClick={() => onPick(s)}
            disabled={disabled}
          >
            {s.label || s.file}
          </button>
        ))}
      </div>
    </div>
  );
}
