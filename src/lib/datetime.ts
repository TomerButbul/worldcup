// One tiny wrapper over Intl so date/time formatting is consistent and testable.
// The whole point of the timezone work: a match kickoff is an absolute instant
// (stored UTC); WHERE it's displayed decides the wall-clock shown. Pass a timeZone
// to pin it (e.g. for SSR/tests); omit it to use the runtime's local zone — which,
// in the browser, is the viewer's own timezone.
export const TOURNAMENT_TZ = "America/New_York";

export function formatInZone(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  timeZone?: string,
  locale: string = "en-US",
): string {
  return new Date(iso).toLocaleString(locale, timeZone ? { ...options, timeZone } : options);
}
