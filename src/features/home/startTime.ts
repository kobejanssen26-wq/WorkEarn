/**
 * Resolve a time-of-day picked for a running shift's start. The shift's start date is kept, except when the
 * result would lie in the future (e.g. it is 00:10 and the user picks 23:00): then it means "yesterday".
 */
export function setActiveShiftStartLocal(currentStartMs: number, hours: number, minutes: number, nowMs: number): number {
  const base = new Date(currentStartMs);
  let candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0).getTime();
  if (candidate > nowMs) {
    candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1, hours, minutes, 0, 0).getTime();
  }
  return candidate;
}
