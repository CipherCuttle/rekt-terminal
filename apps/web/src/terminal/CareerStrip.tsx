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
  // Highest skill actually authorized, so the strip keeps naming the current
  // desk as new tiers unlock instead of freezing at SCALE_CONTROL.
  const SKILL_ORDER = ['SPOT_BASIC', 'SCALE_CONTROL', 'STOP_LOSS', 'RISK_SIZING'] as const;
  const currentSkill = SKILL_ORDER.filter((skill) => career.unlockedSkills.includes(skill)).at(-1) ?? 'SPOT_BASIC';

  return (
    <section className="panel career-strip" aria-label="Career progress">
      <div className="career-strip-head">
        <span className="career-skill">{currentSkill}</span>
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
