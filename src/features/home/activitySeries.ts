/** Events per day over the last `days` days (UTC), oldest first; used by the Home activity chart. */
export function dailyCounts(timestamps: readonly string[], days: number, now: Date = new Date()): { days: Date[]; values: number[] } {
  const startOfDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const today = startOfDay(now);
  const day = 86_400_000;
  const values = new Array<number>(days).fill(0);
  for (const stamp of timestamps) {
    const time = new Date(stamp).getTime();
    if (!Number.isFinite(time)) continue;
    const index = days - 1 - Math.floor((today - startOfDay(new Date(time))) / day);
    if (index >= 0 && index < days) values[index]! += 1;
  }
  return { days: values.map((_, index) => new Date(today - (days - 1 - index) * day)), values };
}
