/**
 * AvatarCropper
 * ─────────────────────────────────────────────────────────────────
 * A Facebook / Zalo–style avatar cropper.
 *
 * UX:
 *  • The image moves freely under the fixed circle (like FB).
 *  • Scroll / pinch to zoom; slider or ± buttons for fine control.
 *  • Soft constraint: image can't be dragged so far that the circle
 *    is entirely uncovered (at least 1 px of image must cover any
 *    edge of the circle).
 *
 * Output: 500 × 500 JPEG blob passed to onConfirm().
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// ─── Props ────────────────────────────────────────────────────────
interface AvatarCropperProps {
  src: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  accentColor?: string;
  title?: string;
}

// ─── Constants ────────────────────────────────────────────────────
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6.0;
const CIRCLE_FRAC = 0.80;   // circle diameter / frame size
const OUTPUT_PX = 500;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

// ─── Component ────────────────────────────────────────────────────
export default function AvatarCropper({
  src,
  onConfirm,
  onCancel,
  accentColor = "#0d9488",
  title = "Cắt ảnh đại diện",
}: AvatarCropperProps) {
  // ── frame ref (the square viewing window) ──────────────────────
  const frameRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement>(null);

  // ── live pan / zoom stored in refs for smooth dragging ─────────
  const panRef  = useRef({ x: 0, y: 0 });   // top-left of image in frame px
  const zoomRef = useRef(1);

  // ── React state only for the slider / % display ────────────────
  const [zoom, setZoomState]   = useState(1);
  const [ready, setReady]      = useState(false);
  const [saving, setSaving]    = useState(false);

  // frame size (square) – resolved after first layout
  const frameSize = useRef(0);

  // ── drag tracking ───────────────────────────────────────────────
  const dragging   = useRef(false);
  const lastPt     = useRef({ x: 0, y: 0 });

  // ── apply transform to the img element directly (no re-render) ──
  const applyTransform = useCallback(() => {
    const img = imgElRef.current;
    if (!img) return;
    const { x, y } = panRef.current;
    const z = zoomRef.current;
    img.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  }, []);

  // ── constrain pan: image should cover at least 1 px of circle ───
  const constrainPan = useCallback(
    (px: number, py: number, z: number, natW: number, natH: number) => {
      const fs = frameSize.current;
      const cr = (fs * CIRCLE_FRAC) / 2;   // circle radius in px
      const cx = fs / 2;
      const cy = fs / 2;

      const iw = natW * z;
      const ih = natH * z;

      // Image must cover at least the circle boundaries (1 px of slack)
      const slack = 1;
      const minX = cx + cr - iw + slack;    // right edge of image >= circle right
      const maxX = cx - cr - slack;          // left edge of image <= circle left
      const minY = cy + cr - ih + slack;
      const maxY = cy - cr - slack;

      // If image is smaller than circle in one axis, centre it on that axis
      const rx = iw >= cr * 2 ? clamp(px, minX, maxX) : cx - iw / 2;
      const ry = ih >= cr * 2 ? clamp(py, minY, maxY) : cy - ih / 2;

      return { x: rx, y: ry };
    },
    [],
  );

  // ── initialise when the image loads ─────────────────────────────
  const handleImgLoad = useCallback(() => {
    const img = imgElRef.current;
    const frame = frameRef.current;
    if (!img || !frame) return;

    frameSize.current = frame.getBoundingClientRect().width;
    const fs = frameSize.current;
    const cr = (fs * CIRCLE_FRAC) / 2;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    // Fit zoom: image fills the circle exactly
    const fitZoom = Math.max((cr * 2) / natW, (cr * 2) / natH);
    const initZoom = clamp(fitZoom * 1.05, MIN_ZOOM, MAX_ZOOM); // tiny extra so user can pan

    const iw = natW * initZoom;
    const ih = natH * initZoom;
    const initPan = { x: fs / 2 - iw / 2, y: fs / 2 - ih / 2 };

    panRef.current  = initPan;
    zoomRef.current = initZoom;
    applyTransform();
    setZoomState(initZoom);
    setReady(true);
  }, [applyTransform]);

  // Re-initialise if src changes
  useEffect(() => {
    setReady(false);
    panRef.current  = { x: 0, y: 0 };
    zoomRef.current = 1;
  }, [src]);

  // ── zoom utility (zoom towards a point in frame coordinates) ────
  const applyZoom = useCallback(
    (newZoom: number, focalX?: number, focalY?: number) => {
      const img = imgElRef.current;
      if (!img) return;
      const fs   = frameSize.current;
      const fx   = focalX ?? fs / 2;
      const fy   = focalY ?? fs / 2;
      const z    = zoomRef.current;
      const ratio = newZoom / z;

      const nx = fx - (fx - panRef.current.x) * ratio;
      const ny = fy - (fy - panRef.current.y) * ratio;

      const clamped = constrainPan(
        nx, ny, newZoom,
        img.naturalWidth, img.naturalHeight,
      );
      panRef.current  = clamped;
      zoomRef.current = newZoom;
      applyTransform();
      setZoomState(newZoom);
    },
    [applyTransform, constrainPan],
  );

  // ── wheel: zoom towards cursor ───────────────────────────────────
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!imgElRef.current) return;
      const rect    = frame.getBoundingClientRect();
      const focalX  = e.clientX - rect.left;
      const focalY  = e.clientY - rect.top;
      const delta   = e.deltaY < 0 ? 0.1 : -0.1;
      const newZoom = clamp(
        zoomRef.current + delta * zoomRef.current,
        MIN_ZOOM,
        MAX_ZOOM,
      );
      applyZoom(newZoom, focalX, focalY);
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  // ── pointer drag ─────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    lastPt.current   = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).style.cursor = "grabbing";
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !imgElRef.current) return;
    const dx = e.clientX - lastPt.current.x;
    const dy = e.clientY - lastPt.current.y;
    lastPt.current = { x: e.clientX, y: e.clientY };

    const img = imgElRef.current;
    const raw = {
      x: panRef.current.x + dx,
      y: panRef.current.y + dy,
    };
    const clamped = constrainPan(
      raw.x, raw.y,
      zoomRef.current,
      img.naturalWidth,
      img.naturalHeight,
    );
    panRef.current = clamped;
    applyTransform();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).style.cursor = "grab";
  };

  // ── ± buttons ────────────────────────────────────────────────────
  const nudgeZoom = (delta: number) => {
    const nz = clamp(zoomRef.current + delta, MIN_ZOOM, MAX_ZOOM);
    applyZoom(nz);
  };

  // ── crop & export ────────────────────────────────────────────────
  const handleConfirm = () => {
    const frame = frameRef.current;
    const img   = imgElRef.current;
    if (!frame || !img) return;
    setSaving(true);

    const fs   = frameSize.current || frame.getBoundingClientRect().width;
    const cr   = (fs * CIRCLE_FRAC) / 2;
    const cx   = fs / 2;
    const cy   = fs / 2;

    const canvas = document.createElement("canvas");
    canvas.width  = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext("2d")!;

    // Circular clip
    ctx.beginPath();
    ctx.arc(OUTPUT_PX / 2, OUTPUT_PX / 2, OUTPUT_PX / 2, 0, Math.PI * 2);
    ctx.clip();

    // Scale: output is OUTPUT_PX wide, circle is cr*2 wide in frame
    const scale  = OUTPUT_PX / (cr * 2);
    const offX   = (panRef.current.x - (cx - cr)) * scale;
    const offY   = (panRef.current.y - (cy - cr)) * scale;
    const drawW  = img.naturalWidth  * zoomRef.current * scale;
    const drawH  = img.naturalHeight * zoomRef.current * scale;

    // Fill background white (for transparent PNGs)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);
    ctx.drawImage(img, offX, offY, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) onConfirm(blob);
      },
      "image/jpeg",
      0.92,
    );
  };

  // ── circle size for the SVG overlay (responsive) ─────────────────
  const [circlePx, setCirclePx] = useState(0);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () =>
      setCirclePx(frame.getBoundingClientRect().width * CIRCLE_FRAC);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  const zoomPct = Math.round(zoom * 100);

  // ── render ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors text-lg"
          >✕</button>
        </div>

        <p className="px-6 pb-3 text-[11px] text-slate-400 leading-relaxed">
          Kéo ảnh vào đúng vị trí · Cuộn chuột để phóng to / thu nhỏ
        </p>

        {/* ── Viewing frame ── */}
        <div
          ref={frameRef}
          className="relative w-full aspect-square bg-[#0a0f1e] overflow-hidden select-none"
          style={{ cursor: "grab" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* The image — positioned with CSS transform via ref */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgElRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={handleImgLoad}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "top left",
              maxWidth: "none",
              pointerEvents: "none",
              userSelect: "none",
              opacity: ready ? 1 : 0,
              transition: "opacity 0.2s",
            }}
          />

          {/* Dark overlay with circle cut-out — SVG */}
          {circlePx > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width="100%"
              height="100%"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <mask id="cropHole">
                  <rect width="100%" height="100%" fill="white" />
                  <circle cx="50%" cy="50%" r={circlePx / 2} fill="black" />
                </mask>
              </defs>
              {/* Dark overlay */}
              <rect
                width="100%"
                height="100%"
                fill="rgba(10,15,30,0.68)"
                mask="url(#cropHole)"
              />
              {/* Circle border */}
              <circle
                cx="50%"
                cy="50%"
                r={circlePx / 2}
                fill="none"
                stroke="rgba(255,255,255,0.88)"
                strokeWidth="2"
              />
              {/* Rule-of-thirds lines inside circle */}
              <clipPath id="circleClip">
                <circle cx="50%" cy="50%" r={circlePx / 2} />
              </clipPath>
              <g clipPath="url(#circleClip)" stroke="rgba(255,255,255,0.14)" strokeWidth="1">
                <line x1={`calc(50% - ${circlePx / 6}px)`} y1="0" x2={`calc(50% - ${circlePx / 6}px)`} y2="100%" />
                <line x1={`calc(50% + ${circlePx / 6}px)`} y1="0" x2={`calc(50% + ${circlePx / 6}px)`} y2="100%" />
                <line x1="0" y1={`calc(50% - ${circlePx / 6}px)`} x2="100%" y2={`calc(50% - ${circlePx / 6}px)`} />
                <line x1="0" y1={`calc(50% + ${circlePx / 6}px)`} x2="100%" y2={`calc(50% + ${circlePx / 6}px)`} />
              </g>
            </svg>
          )}

          {/* Loading spinner */}
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
              Đang tải ảnh…
            </div>
          )}
        </div>

        {/* ── Zoom controls ── */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={() => nudgeZoom(-0.12)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-all text-base font-bold shadow-sm flex-shrink-0"
            title="Thu nhỏ"
          >−</button>

          <input
            type="range"
            min={Math.round(MIN_ZOOM * 100)}
            max={Math.round(MAX_ZOOM * 100)}
            step={1}
            value={zoomPct}
            onChange={(e) => {
              const nz = clamp(Number(e.target.value) / 100, MIN_ZOOM, MAX_ZOOM);
              applyZoom(nz);
            }}
            className="flex-1 h-1.5 rounded-full cursor-pointer appearance-none bg-slate-200"
            style={{ accentColor }}
          />

          <button
            type="button"
            onClick={() => nudgeZoom(0.12)}
            className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-all text-base font-bold shadow-sm flex-shrink-0"
            title="Phóng to"
          >＋</button>

          <span
            className="text-xs font-bold w-10 text-right flex-shrink-0 tabular-nums"
            style={{ color: accentColor }}
          >
            {zoomPct}%
          </span>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-5 py-2.5 rounded-full border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !ready}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-white shadow-md transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            style={{ background: accentColor, boxShadow: `0 4px 16px ${accentColor}50` }}
          >
            {saving ? "Đang xử lý…" : "Cắt & Chọn ảnh"}
          </button>
        </div>

      </div>
    </div>
  );
}
