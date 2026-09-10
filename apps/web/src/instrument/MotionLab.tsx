import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_REFERENCE_FPS, sampleInstrumentMotion, stepReferenceTimeMs, type MotionSample } from './motion';

type Skin = 'neutral' | 'rekt';

const W = 320;
const H = 150;

function drawNeutral(ctx: CanvasRenderingContext2D, s: MotionSample) {
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f4f4ef';
  ctx.lineWidth = 2;

  const y = 74;
  const left = 78;
  const right = 242;
  const reelR = 22;

  ctx.beginPath();
  ctx.arc(left, y, reelR, 0, Math.PI * 2);
  ctx.arc(right, y, reelR, 0, Math.PI * 2);
  ctx.stroke();

  drawSpoke(ctx, left, y, reelR - 5, s.leftReel);
  drawSpoke(ctx, right, y, reelR - 5, s.rightReel);

  ctx.beginPath();
  ctx.moveTo(left + reelR, y);
  ctx.lineTo(right - reelR, y);
  ctx.stroke();

  const x = left + reelR + s.transport * (right - left - reelR * 2);
  ctx.fillRect(Math.round(x) - 2, y - 5, 4, 10);
}

function drawRekt(ctx: CanvasRenderingContext2D, s: MotionSample) {
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, W, H);

  const y = 74;
  const left = 78;
  const right = 242;
  const reelR = 22;

  ctx.strokeStyle = '#f4f4ef';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(left, y, reelR, 0, Math.PI * 2);
  ctx.arc(right, y, reelR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#b68cff';
  drawTentacleSpoke(ctx, left, y, reelR - 4, s.leftReel);
  drawTentacleSpoke(ctx, right, y, reelR - 4, s.rightReel);

  ctx.strokeStyle = '#f4f4ef';
  ctx.beginPath();
  ctx.moveTo(left + reelR, y);
  const mid = 160;
  ctx.quadraticCurveTo(mid, y + 8 * Math.sin(s.leftReel * 2), right - reelR, y);
  ctx.stroke();

  const x = left + reelR + s.transport * (right - left - reelR * 2);
  const bob = Math.sin(s.leftReel * 2) * 2;
  drawSquid(ctx, x, y - 17 + bob, s.pulse);
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
}: {
  skin: Skin;
  running: boolean;
  timeMs: number;
  playbackRate?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const startRef = useRef<number | null>(null);
  const offsetRef = useRef(timeMs);

  useEffect(() => {
    offsetRef.current = timeMs;
    startRef.current = null;
  }, [timeMs]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;

    const paint = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) * playbackRate;
      const t = running ? offsetRef.current + elapsed : offsetRef.current;
      const sample = sampleInstrumentMotion(t);
      if (skin === 'rekt') drawRekt(ctx, sample);
      else drawNeutral(ctx, sample);
      if (running) frame = requestAnimationFrame(paint);
    };

    paint(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [playbackRate, running, skin]);

  return <canvas ref={ref} width={W} height={H} className={`motion-lab-canvas ${className}`.trim()} aria-label={`${skin} motion scene`} />;
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

      <div className="motion-lab-reference-stage">
        {referenceUrl ? (
          <video
            ref={videoRef}
            src={referenceUrl}
            controls
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
          <MotionCanvas skin="neutral" running={false} timeMs={motionTimeMs} className="motion-lab-overlay-canvas" />
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
          <p className="motion-lab-kicker">INSTRUMENT MOTION LAB · V0.1</p>
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
