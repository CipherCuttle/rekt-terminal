import {useEffect, useState} from 'react';

export function ReferenceOverlay() {
  const [src, setSrc] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [difference, setDifference] = useState(true);
  const enabled = new URLSearchParams(window.location.search).get('calibrate') === '1';

  useEffect(() => () => {
    if (src?.startsWith('blob:')) URL.revokeObjectURL(src);
  }, [src]);

  if (!enabled) return null;

  return (
    <>
      <div className="iv2-calibration-toolbar" role="region" aria-label="Art reference calibration controls">
        <strong>REFERENCE CALIBRATION</strong>
        <label className="iv2-calibration-file">
          LOAD PNG
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setSrc((previous) => {
                if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
                return URL.createObjectURL(file);
              });
            }}
          />
        </label>
        <label>
          OPACITY
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
          <span>{Math.round(opacity * 100)}%</span>
        </label>
        <button type="button" aria-pressed={difference} onClick={() => setDifference((value) => !value)}>
          {difference ? 'DIFFERENCE' : 'NORMAL'}
        </button>
        <button type="button" disabled={!src} onClick={() => setSrc(null)}>CLEAR</button>
      </div>
      {src ? (
        <img
          className="iv2-reference-overlay"
          data-difference={difference || undefined}
          src={src}
          alt="Loaded calibration reference"
          style={{opacity}}
        />
      ) : null}
    </>
  );
}
