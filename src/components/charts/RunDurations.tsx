import { Bar, BarChart, CartesianGrid, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { JobRun } from '../../api';
import { formatMs, outcomeOf, tickTime } from '../../util';
import { OutcomeLegend } from './Legend';
import { runTip } from './runTip';

/** How long each of the last runs took, oldest first. */
export function RunDurations({ runs, onRun }: { runs: JobRun[]; onRun: (run: JobRun) => void }) {
  const data = [...runs].reverse().map((run) => ({ run, ms: run.duration / 1e6 }));
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="run.started_at" tickFormatter={tickTime} minTickGap={40} stroke="var(--ink-3)" fontSize={12} tickLine={false} />
          <YAxis width={56} tickFormatter={formatMs} stroke="var(--ink-3)" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: 'var(--raised)' }}
            content={({ active, payload }) => active && payload?.[0] ? <div className="chart-tip in-chart">{runTip(payload[0].payload.run)}</div> : null}
          />
          <Bar
            dataKey="ms"
            maxBarSize={24}
            isAnimationActive={false}
            onClick={(bar) => onRun((bar.payload as { run: JobRun }).run)}
            shape={(props: object) => {
              const { payload, ...rect } = props as { payload: { run: JobRun } };
              return <Rectangle {...rect} radius={[4, 4, 0, 0]} className={`tone-${outcomeOf(payload.run)}`} fill="var(--tone)" cursor="pointer" />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
      <OutcomeLegend outcomes={['succeeded', 'recovered', 'failed']} />
    </>
  );
}
