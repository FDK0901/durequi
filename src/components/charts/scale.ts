const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400].map((s) => s * 1000);

/** timeTicks returns round points in time between from and to, at most count of them. */
export function timeTicks(from: number, to: number, count: number): number[] {
  const step = STEPS.find((s) => (to - from) / s <= count) ?? STEPS[STEPS.length - 1];
  // Round in local time, so that a six hour step falls on 06:00 and not on 09:00.
  const shift = new Date(from).getTimezoneOffset() * 60_000;
  const ticks: number[] = [];
  for (let t = Math.ceil((from - shift) / step) * step + shift; t <= to; t += step) ticks.push(t);
  return ticks;
}

export function tickLabel(t: number, span: number): string {
  return new Date(t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: span < 10 * 60_000 ? '2-digit' : undefined,
    hour12: false,
  });
}
