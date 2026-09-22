import dayjs from "dayjs";
import "dayjs/locale/it";

dayjs.locale("it");

export { dayjs };

export function todayStr(): string {
  return dayjs().format("YYYY-MM-DD");
}

// Build a rolling range of days centered a few days back from today.
export function dayRange(before = 3, after = 21): { key: string; d: dayjs.Dayjs }[] {
  const start = dayjs().subtract(before, "day");
  const total = before + after;
  return Array.from({ length: total }).map((_, i) => {
    const d = start.add(i, "day");
    return { key: d.format("YYYY-MM-DD"), d };
  });
}

export function isToday(key: string): boolean {
  return key === todayStr();
}

export function longDate(key: string): string {
  const d = dayjs(key);
  if (key === todayStr()) return "Oggi";
  if (key === dayjs().add(1, "day").format("YYYY-MM-DD")) return "Domani";
  return d.format("dddd D MMMM");
}
