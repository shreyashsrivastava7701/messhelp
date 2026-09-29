// The mess runs on India time regardless of where the server is deployed.
const TZ = "Asia/Kolkata";

/** YYYY-MM-DD for the given instant in India time. */
export function isoDateIST(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function formatDateLong(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "07:30:00" -> "7:30 AM" */
export function formatTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function isValidIsoDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** The instant a meal starts: date + "HH:MM[:SS]" read as India time. */
export function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00+05:30`);
}

/** "10:30 AM" style time of an instant, in India time. */
export function formatClockIST(d: Date): string {
  return d.toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** "Mon 29 Sep, 5:04 PM" in India time. */
export function formatDateTimeIST(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
