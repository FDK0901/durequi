import { OUTCOME_LABEL, type Outcome } from '../../util';

export function OutcomeLegend({ outcomes = ['succeeded', 'recovered', 'failed', 'running'], children }: {
  outcomes?: Outcome[];
  children?: React.ReactNode;
}) {
  return (
    <div className="chart-legend">
      {outcomes.map((o) => (
        <span key={o}>
          <i className={`swatch tone-${o}`} />
          {OUTCOME_LABEL[o]}
        </span>
      ))}
      {children}
    </div>
  );
}
