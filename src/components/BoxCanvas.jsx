import { useEffect, useRef } from "react";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Draws the photo at its real pixel size, then reveals the boxes one by one.
// The CSS scales the canvas to fit the page, so the boxes stay aligned.
export default function BoxCanvas({ imageUrl, detections, minConfidence, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const img = new Image();

    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      const visible = detections.filter((d) => d.confidence >= minConfidence);
      const lineWidth = Math.max(2, Math.round(img.naturalWidth / 300));
      const fontSize = Math.max(12, Math.round(img.naturalWidth / 60));

      const draw = (count) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.lineWidth = lineWidth;
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        visible.slice(0, count).forEach((d) => {
          const [x1, y1, x2, y2] = d.bbox;
          const color = d.confidence >= 0.5 ? "#34d399" : "#fbbf24";
          const text = `${d.label} ${Math.round(d.confidence * 100)}%`;
          const textWidth = ctx.measureText(text).width;
          const tagY = Math.max(fontSize + 6, y1);
          ctx.strokeStyle = color;
          ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
          ctx.fillStyle = color;
          ctx.fillRect(x1, tagY - fontSize - 6, textWidth + 10, fontSize + 8);
          ctx.fillStyle = "#06120d";
          ctx.fillText(text, x1 + 5, tagY - 2);
        });
      };

      if (REDUCED_MOTION) {
        draw(visible.length);
        return;
      }
      const start = performance.now();
      const perBoxMs = 70;
      const step = (now) => {
        const count = Math.min(visible.length, Math.floor((now - start) / perBoxMs) + 1);
        draw(count);
        if (count < visible.length) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    img.src = imageUrl;
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [imageUrl, detections, minConfidence]);

  return <canvas ref={canvasRef} className="box-canvas" role="img" aria-label={label} />;
}
