import { useEffect, useMemo, useRef, useState } from 'react';

type Skin = 'neutral' | 'rekt';

type MotionSample = {
  tMs: number;
  transport: number;
  leftReel: number;
  rightReel: number;
  pulse: number;
};

const W = 320;
const H = 150;
const PERIOD_MS = 2400;

function sampleMotion(tMs: number): MotionSample {
  const phase = ((tMs % PERIOD_MS) + PERIOD_MS) % PERIOD_MS / PERIOD_MS;
  const eased = phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2;
  return {
    tMs,
    transport: eased,
    leftReel: phase * Math.PI * 2,
    rightReel: -phase * Math.PI * 2,
    pulse: 0.5 - 0.5 * Math.cos(phase * Math.PI * 2),
  };
}

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

function MotionCanvas({ skin, running, timeMs }: { skin: Skin; running: boolean; timeMs: number }) {
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
      const t = running ? offsetRef.current + now - startRef.current : offsetRef.current;
      const sample = sampleMotion(t);
      if (skin === 'rekt') drawRekt(ctx, sample);
      else drawNeutral(ctx, sample);
      if (running) frame = requestAnimationFrame(paint);
    };

    paint(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [running, skin]);

  return <canvas ref={ref} width={W} height={H} className="motion-lab-canvas" aria-label={`${skin} motion scene`} />;
}

export function MotionLab() {
  const [running, setRunning] = useState(true);
  const [timeMs, setTimeMs] = useState(0);
  const checkpoints = useMemo(() => [0, 300, 600, 1200, 1800], []);

  return (
    <section className="motion-lab" aria-label="Instrument motion lab">
      <header className="motion-lab-head">
        <div>
          <p className="motion-lab-kicker">INSTRUMENT MOTION LAB · V0</p>
          <h2>Same motion, different actor.</h2>
        </div>
        <button type="button" onClick={() => setRunning((value) => !value)}>
          {running ? 'PAUSE' : 'PLAY'}
        </button>
      </header>

      <div className="motion-lab-grid">
        <article>
          <div className="motion-lab-label">NEUTRAL GRAMMAR</div>
          <MotionCanvas skin="neutral" running={running} timeMs={timeMs} />
        </article>
        <article>
          <div className="motion-lab-label">REKT SKIN</div>
          <MotionCanvas skin="rekt" running={running} timeMs={timeMs} />
        </article>
      </div>

      <div className="motion-lab-controls" aria-label="Motion checkpoints">
        {checkpoints.map((checkpoint) => (
          <button key={checkpoint} type="button" onClick={() => { setRunning(false); setTimeMs(checkpoint); }}>
            {checkpoint}ms
          </button>
        ))}
      </div>

      <p className="motion-lab-note">
        Both canvases use the same deterministic sample function. The REKT side may change artwork only; timing and trajectories stay shared.
      </p>
    </section>
  );
}
