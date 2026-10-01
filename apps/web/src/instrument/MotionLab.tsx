import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  DEFAULT_REFERENCE_FPS,
  TAPE_GEOMETRY,
  predictMotionLandmark,
  sampleInstrumentMotion,
  stepReferenceTimeMs,
  type MotionLandmark,
  type MotionSample,
} from './motion';

type Skin = 'neutral' | 'rekt';

type LandmarkMeasurement = {
  id: string;
  referenceTimeMs: number;
  landmark: MotionLandmark;
  x: number;
  y: number;
};

const W = TAPE_GEOMETRY.width;
const H = TAPE_GEOMETRY.height;
const LANDMARKS: readonly MotionLandmark[] = ['transport', 'left-reel-center', 'right-reel-center', 'left-spoke-tip', 'right-spoke-tip'];

function drawNeutral(ctx: CanvasRenderingContext2D, s: MotionSample) {
  const g = TAPE_GEOMETRY;
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f4f4ef';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(g.leftReelX, g.y, g.reelRadius, 0, Math.PI * 2);
  ctx.arc(g.rightReelX, g.y, g.reelRadius, 0, Math.PI * 2);
  ctx.stroke();

  drawSpoke(ctx, g.leftReelX, g.y, g.spokeRadius, s.leftReel);
  drawSpoke(ctx, g.rightReelX, g.y, g.spokeRadius, s.rightReel);

  ctx.beginPath();
  ctx.moveTo(g.leftReelX + g.reelRadius, g.y);
  ctx.lineTo(g.rightReelX - g.reelRadius, g.y);
  ctx.stroke();

  const point = predictMotionLandmark(s, 'transport');
  ctx.fillRect(Math.round(point.x) - 2, point.y - 5, 4, 10);
}

function drawRekt(ctx: CanvasRenderingContext2D, s: MotionSample) {
  const g = TAPE_GEOMETRY;
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#f4f4ef';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(g.leftReelX, g.y, g.reelRadius, 0, Math.PI * 2);
  ctx.arc(g.rightReelX, g.y, g.reelRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#b68cff';
  drawTentacleSpoke(ctx, g.leftReelX, g.y, g.reelRadius - 4, s.leftReel);
  drawTentacleSpoke(ctx, g.rightReelX, g.y, g.reelRadius - 4, s.rightReel);

  ctx.strokeStyle = '#f4f4ef';
  ctx.beginPath();
  ctx.moveTo(g.leftReelX + g.reelRadius, g.y);
  const mid = W / 2;
  ctx.quadraticCurveTo(mid, g.y + 8 * Math.sin(s.leftReel * 2), g.rightReelX - g.reelRadius, g.y);
  ctx.stroke();

  const point = predictMotionLandmark(s, 'transport');
  const bob = Math.sin(s.leftReel * 2) * 2;
  drawSquid(ctx, point.x, g.y - 17 + bob, s.pulse);
}

function drawSpoke(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.stroke();
  ctx.restore();
}

function drawTentacleSpoke(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(r * 0.55, -5, r, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSquid(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number) {
  const squash = 1 + pulse * 0.04;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / squash, squash);
  ctx.fillStyle = '#f4f4ef';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4f4ef';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, 4);
  ctx.quadraticCurveTo(-8, 11, -11, 13);
  ctx.moveTo(0, 5);
  ctx.quadraticCurveTo(0, 12, 2, 14);
  ctx.moveTo(4, 4);
  ctx.quadraticCurveTo(9, 9, 11, 12);
  ctx.stroke();
  ctx.fillStyle = '#050507';
  ctx.fillRect(-3, -1, 1.5, 1.5);
  ctx.fillRect(2, -1, 1.5, 1.5);
  ctx.restore();
}

function MotionCanvas({
  skin,
  running,
  timeMs,
  playbackRate = 1,
  className = '',
  decorative = false,
}: {
  skin: Skin;
  running: boolean;
  timeMs: number;
  playbackRate?: number;
  className?: string;
  decorative?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    const startedAt = performance.now();

    const paint = (now: number) => {
      const elapsed = (now - startedAt) * playbackRate;
      const t = running ? timeMs + elapsed : timeMs;
      const sample = sampleInstrumentMotion(t);
      if (skin === 'rekt') drawRekt(ctx, sample);
      else drawNeutral(ctx, sample);
      if (running) frame = requestAnimationFrame(paint);
    };

    paint(startedAt);
    return () => cancelAnimationFrame(frame);
  }, [playbackRate, running, skin, timeMs]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className={`motion-lab-canvas ${className}`.trim()}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${skin} motion scene`}
    />
  );
}

function ReferenceAnalyzer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState('NO LOCAL REFERENCE LOADED');
  const [referenceTimeMs, setReferenceTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [fps, setFps] = useState(DEFAULT_REFERENCE_FPS);
  const [motionOffsetMs, setMotionOffsetMs] = useState(0);
  const [overlayOpacity, setOverlayOpacity] = useState(0.55);
  const [playbackRate, setPlaybackRate] = useState(0.5);
  const [captureMode, setCaptureMode] = useState(false);
  const [selectedLandmark, setSelectedLandmark] = useState<MotionLandmark>('transport');
  const [measurements, setMeasurements] = useState<LandmarkMeasurement[]>([]);

  useEffect(() => {
    return () => {
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    };
  }, [referenceUrl]);

  const loadReference = (file: File | undefined) => {
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setReferenceUrl(nextUrl);
    setReferenceName(file.name);
    setReferenceTimeMs(0);
    setDurationMs(0);
    setMeasurements([]);
    setCaptureMode(false);
  };

  const syncReferenceClock = () => {
    const video = videoRef.current;
    if (!video) return;
    setReferenceTimeMs(video.currentTime * 1000);
  };

  const stepFrame = (direction: -1 | 1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const nextMs = stepReferenceTimeMs(referenceTimeMs, direction, fps, durationMs || Number.POSITIVE_INFINITY);
    video.currentTime = nextMs / 1000;
    setReferenceTimeMs(nextMs);
  };

  const setRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const captureMeasurement = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!captureMode || !referenceUrl) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.min(W, Math.max(0, ((event.clientX - rect.left) / rect.width) * W));
    const y = Math.min(H, Math.max(0, ((event.clientY - rect.top) / rect.height) * H));
    setMeasurements((current) => [
      ...current,
      {
        id: `${selectedLandmark}:${referenceTimeMs.toFixed(3)}:${current.length}`,
        referenceTimeMs,
        landmark: selectedLandmark,
        x,
        y,
      },
    ]);
  };

  const evaluatedMeasurements = useMemo(() => measurements.map((measurement) => {
    const motionTimeMs = measurement.referenceTimeMs + motionOffsetMs;
    const predicted = predictMotionLandmark(sampleInstrumentMotion(motionTimeMs), measurement.landmark);
    const errorPx = Math.hypot(measurement.x - predicted.x, measurement.y - predicted.y);
    return { ...measurement, motionTimeMs, predicted, errorPx };
  }), [measurements, motionOffsetMs]);

  const rmsePx = evaluatedMeasurements.length > 0
    ? Math.sqrt(evaluatedMeasurements.reduce((sum, measurement) => sum + measurement.errorPx ** 2, 0) / evaluatedMeasurements.length)
    : null;

  const frameHalfWidthMs = 500 / Math.max(1, fps);
  const visibleMeasurements = evaluatedMeasurements.filter((measurement) => Math.abs(measurement.referenceTimeMs - referenceTimeMs) <= frameHalfWidthMs);

  const exportMeasurements = () => {
    if (evaluatedMeasurements.length === 0) return;
    const payload = {
      schema: 'REKT_INSTRUMENT_MOTION_MEASUREMENTS_V1',
      referenceName,
      fps,
      motionOffsetMs,
      viewport: { width: W, height: H },
      rmsePx,
      measurements: evaluatedMeasurements,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rekt-motion-measurements-v1.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const motionTimeMs = referenceTimeMs + motionOffsetMs;
  const sample = sampleInstrumentMotion(motionTimeMs);

  return (
    <section className="motion-lab-reference" aria-label="Reference analyzer">
      <div className="motion-lab-reference-head">
        <div>
          <div className="motion-lab-label">REFERENCE ANALYZER · LOCAL-ONLY</div>
          <p className="motion-lab-reference-name">{referenceName}</p>
        </div>
        <label className="motion-lab-file">
          LOAD CROPPED DISPLAY VIDEO
          <input type="file" accept="video/*" onChange={(event) => loadReference(event.target.files?.[0])} />
        </label>
      </div>

      <div
        className={`motion-lab-reference-stage ${captureMode ? 'is-capturing' : ''}`.trim()}
        onClick={captureMeasurement}
        aria-label="Reference comparison stage"
      >
        {referenceUrl ? (
          <video
            ref={videoRef}
            src={referenceUrl}
            controls={!captureMode}
            muted
            playsInline
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              video.playbackRate = playbackRate;
              setDurationMs(Number.isFinite(video.duration) ? video.duration * 1000 : 0);
              syncReferenceClock();
            }}
            onTimeUpdate={syncReferenceClock}
            onSeeked={syncReferenceClock}
            aria-label="Local reference video"
          />
        ) : (
          <div className="motion-lab-reference-empty">LOAD A CROPPED 320×150-ISH DISPLAY CAPTURE. THE FILE NEVER LEAVES THIS BROWSER SESSION.</div>
        )}
        <div className="motion-lab-reference-overlay" style={{ opacity: overlayOpacity }} aria-hidden="true">
          <MotionCanvas skin="neutral" running={false} timeMs={motionTimeMs} className="motion-lab-overlay-canvas" decorative />
        </div>
        <div className="motion-lab-landmarks" aria-hidden="true">
          {visibleMeasurements.map((measurement) => (
            <span
              key={`${measurement.id}:reference`}
              className="motion-lab-landmark motion-lab-landmark-reference"
              style={{ left: `${(measurement.x / W) * 100}%`, top: `${(measurement.y / H) * 100}%` }}
            />
          ))}
          {visibleMeasurements.map((measurement) => (
            <span
              key={`${measurement.id}:predicted`}
              className="motion-lab-landmark motion-lab-landmark-predicted"
              style={{ left: `${(measurement.predicted.x / W) * 100}%`, top: `${(measurement.predicted.y / H) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="motion-lab-analysis-controls">
        <div className="motion-lab-control-group" aria-label="Frame stepping">
          <button type="button" onClick={() => stepFrame(-1)} disabled={!referenceUrl}>−1 FRAME</button>
          <span className="motion-lab-readout">{referenceTimeMs.toFixed(1)} ms</span>
          <button type="button" onClick={() => stepFrame(1)} disabled={!referenceUrl}>+1 FRAME</button>
        </div>

        <label>
          FPS
          <input
            type="number"
            min="1"
            max="240"
            step="1"
            value={fps}
            onChange={(event) => setFps(Math.min(240, Math.max(1, Number(event.target.value) || DEFAULT_REFERENCE_FPS)))}
          />
        </label>

        <label>
          MOTION OFFSET MS
          <input type="number" step="1" value={motionOffsetMs} onChange={(event) => setMotionOffsetMs(Number(event.target.value) || 0)} />
        </label>

        <label>
          OVERLAY {Math.round(overlayOpacity * 100)}%
          <input type="range" min="0" max="1" step="0.05" value={overlayOpacity} onChange={(event) => setOverlayOpacity(Number(event.target.value))} />
        </label>

        <div className="motion-lab-control-group" aria-label="Reference playback rate">
          {[0.25, 0.5, 1].map((rate) => (
            <button key={rate} type="button" aria-pressed={playbackRate === rate} onClick={() => setRate(rate)}>{rate}×</button>
          ))}
        </div>
      </div>

      <div className="motion-lab-analysis-controls">
        <label>
          LANDMARK
          <select value={selectedLandmark} onChange={(event) => setSelectedLandmark(event.target.value as MotionLandmark)}>
            {LANDMARKS.map((landmark) => <option key={landmark} value={landmark}>{landmark}</option>)}
          </select>
        </label>
        <button type="button" disabled={!referenceUrl} aria-pressed={captureMode} onClick={() => setCaptureMode((value) => !value)}>
          MARK {captureMode ? 'ON' : 'OFF'}
        </button>
        <button type="button" disabled={measurements.length === 0} onClick={() => setMeasurements([])}>CLEAR MARKS</button>
        <button type="button" disabled={measurements.length === 0} onClick={exportMeasurements}>EXPORT JSON</button>
        <span className="motion-lab-readout">N {measurements.length}</span>
        <span className="motion-lab-readout">RMSE {rmsePx === null ? '—' : `${rmsePx.toFixed(2)} px`}</span>
      </div>

      {evaluatedMeasurements.length > 0 && (
        <ol className="motion-lab-measurements" aria-label="Recent landmark measurements">
          {evaluatedMeasurements.slice(-6).map((measurement) => (
            <li key={measurement.id}>
              <span>{measurement.referenceTimeMs.toFixed(1)} ms</span>
              <span>{measurement.landmark}</span>
              <span>REF {measurement.x.toFixed(1)},{measurement.y.toFixed(1)}</span>
              <span>PRED {measurement.predicted.x.toFixed(1)},{measurement.predicted.y.toFixed(1)}</span>
              <span>ERR {measurement.errorPx.toFixed(2)} px</span>
            </li>
          ))}
        </ol>
      )}

      <div className="motion-lab-sample" aria-label="Motion sample readout">
        <span>T+OFFSET {motionTimeMs.toFixed(1)} ms</span>
        <span>TRANSPORT {sample.transport.toFixed(4)}</span>
        <span>L {sample.leftReel.toFixed(4)} rad</span>
        <span>R {sample.rightReel.toFixed(4)} rad</span>
        <span>PULSE {sample.pulse.toFixed(4)}</span>
      </div>
    </section>
  );
}

export function MotionLab() {
  const [running, setRunning] = useState(true);
  const [timeMs, setTimeMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const checkpoints = useMemo(() => [0, 300, 600, 1200, 1800], []);

  return (
    <section className="motion-lab" aria-label="Instrument motion lab">
      <header className="motion-lab-head">
        <div>
          <p className="motion-lab-kicker">INSTRUMENT MOTION LAB · V0.2</p>
          <h2>Same motion, different actor.</h2>
        </div>
        <button type="button" onClick={() => setRunning((value) => !value)}>
          {running ? 'PAUSE' : 'PLAY'}
        </button>
      </header>

      <ReferenceAnalyzer />

      <div className="motion-lab-grid">
        <article>
          <div className="motion-lab-label">NEUTRAL GRAMMAR</div>
          <MotionCanvas skin="neutral" running={running} timeMs={timeMs} playbackRate={playbackRate} />
        </article>
        <article>
          <div className="motion-lab-label">REKT SKIN</div>
          <MotionCanvas skin="rekt" running={running} timeMs={timeMs} playbackRate={playbackRate} />
        </article>
      </div>

      <div className="motion-lab-controls" aria-label="Motion checkpoints">
        {checkpoints.map((checkpoint) => (
          <button key={checkpoint} type="button" onClick={() => { setRunning(false); setTimeMs(checkpoint); }}>
            {checkpoint}ms
          </button>
        ))}
        {[0.25, 0.5, 1].map((rate) => (
          <button key={rate} type="button" aria-pressed={playbackRate === rate} onClick={() => setPlaybackRate(rate)}>
            MOTION {rate}×
          </button>
        ))}
      </div>

      <p className="motion-lab-note">
        Both generated canvases use the same deterministic sample function. The REKT side may change artwork only; timing and trajectories stay shared. Reference footage is loaded from the operator's local device and is never committed or uploaded by this lab.
      </p>
    </section>
  );
}
