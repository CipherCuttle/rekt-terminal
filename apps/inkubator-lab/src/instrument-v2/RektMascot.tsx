import {useState} from 'react';

// Neutral identity only: the current caller has no live observation/proof input.
// The original supplied art is used intact. Never substitute another creature.
export function RektMascot({state = 'idle', size = 'standard'}: {state?: 'idle'; size?: 'compact' | 'standard'}) {
  const [failed, setFailed] = useState(false);
  return <div className="iv2-mascot" data-state={state} data-size={size}>
    {!failed && <img src={`${import.meta.env.BASE_URL}assets/rekt-mascot.png`} alt="" onError={() => setFailed(true)} />}
    {failed && <span className="iv2-mascot-pending"><span>REKT</span><small>ART UNAVAILABLE</small></span>}
  </div>;
}
