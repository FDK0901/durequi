function priorityLabel(p: number): string {
  if (p >= 10) return 'critical';
  if (p >= 8) return 'high';
  if (p >= 3) return 'normal';
  return 'low';
}

export function PriorityBadge({ priority }: { priority?: number }) {
  if (priority == null) return <span className="badge badge-priority-normal">normal</span>;
  const label = priorityLabel(priority);
  return <span className={`badge badge-priority-${label}`}>{label}</span>;
}
