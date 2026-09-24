export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "never";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.34524, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let duration = seconds;
  let unitValue = abs;
  for (const [amount, unit] of divisions) {
    if (unitValue < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration = duration / amount;
    unitValue = unitValue / amount;
  }
  return rtf.format(Math.round(duration), "year");
}
