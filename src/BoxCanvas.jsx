import { useEffect, useRef } from "react";

// Draws the image and its detection boxes at the image's real pixel size.
// The CSS scales the canvas down to fit the page, so the boxes stay aligned.
export default function BoxCanvas({ imageUrl, detections, minConfidence }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const lineWidth = Math.max(2, Math.round(img.naturalWidth / 300));
      const fontSize = Math.max(12, Math.round(img.naturalWidth / 60));
      ctx.lineWidth = lineWidth;
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;

      for (const d of detections) {
        if (d.confidence < minConfidence) continue;
        const [x1, y1, x2, y2] = d.bbox;
        const strong = d.confidence >= 0.5;
        ctx.strokeStyle = strong ? "#22c55e" : "#f59e0b";
        ctx.fillStyle = ctx.strokeStyle;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        const label = `${d.label} ${Math.round(d.confidence * 100)}%`;
        const labelY = Math.max(fontSize, y1);
        ctx.fillText(label, x1 + 2, labelY - 4);
      }
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, detections, minConfidence]);

  return <canvas ref={canvasRef} className="box-canvas" aria-label="Image with detected objects" />;
}
