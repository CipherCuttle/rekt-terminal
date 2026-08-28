import type { CareerState } from '@rekt-ink/career';

/**
 * Contextual Career feedback inside the terminal.
 *
 * Deliberately one strip, not a dashboard: current authorisation, the next
 * objective, and how far along it is. Everything else lives on the Career
 * screen.
 */
export function CareerStrip({ career }: { career: CareerState }) {
  const { objective } = career;
  const target = Math.max(1, objective.target);
  const ratio = Math.max(0, Math.min(1, objective.progress / target));
  const scaleUnlocked = career.unlockedSkills.includes('SCALE_CONTROL');

  return (
    <section className="panel career-strip" aria-label="Career progress">
      <div className="career-strip-head">
        <span className="career-skill">{scaleUnlocked ? 'SCALE_CONTROL' : 'SPOT_BASIC'}</span>
        <span className="career-count">
          {objective.progress}/{objective.target}
        </span>
      </div>
      <p className="career-objective">{objective.text}</p>
      <div
        className="career-meter"
        role="progressbar"
        aria-valuenow={objective.progress}
        aria-valuemin={0}
        aria-valuemax={objective.target}
        aria-label={objective.text}
      >
        <i style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </section>
  );
}
