/** Halifax, Nova Scotia — America/Halifax (Atlantic: AST/ADT) */

const HALIFAX_TZ = "America/Halifax";

/**
 * Format a UTC hour (and optional minute) as local time in Halifax (Atlantic).
 * Uses a reference date so the result reflects current DST (AST vs ADT).
 */
export function formatUtcTimeInHalifax(utcHour: number, utcMinute = 0): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      utcHour,
      utcMinute,
      0,
      0
    )
  );
  return d.toLocaleTimeString("en-CA", {
    timeZone: HALIFAX_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}
