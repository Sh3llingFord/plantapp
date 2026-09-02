export const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

export function currentMonthNameDe(date: Date = new Date()): string {
  return MONTHS_DE[date.getMonth()];
}
