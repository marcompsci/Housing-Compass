/**
 * iCalendar (.ics, RFC 5545) export for tours. Works with Apple Calendar, Google Calendar
 * and Outlook without calendar permissions: the user opens/imports the file themselves.
 */

export interface CalendarEvent {
  uid: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** All-day event on the date of startsAt (YYYY-MM-DD…); durationMinutes is ignored. */
  allDay?: boolean;
  /** RFC 5545 RRULE value, e.g. "FREQ=MONTHLY;BYMONTHDAY=1". */
  rrule?: string | null;
  /** Minutes before the start for a reminder; null = none. */
  alarmMinutesBefore?: number | null;
}

/** Escape TEXT values (RFC 5545 §3.3.11). */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1), never splitting a UTF-8 character. */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(events: CalendarEvent[], now: Date): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Housing Compass//Tours//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    const start = new Date(e.allDay ? `${e.startsAt.slice(0, 10)}T00:00:00Z` : e.startsAt);
    if (Number.isNaN(start.getTime())) throw new Error(`invalid start time for ${e.uid}`);
    const dateOnly = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:${e.uid.replace(/[^A-Za-z0-9@._-]/g, "")}@housingcompass`, `DTSTAMP:${stamp(now)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`, `DTEND;VALUE=DATE:${dateOnly(new Date(start.getTime() + 86_400_000))}`);
    } else {
      const end = new Date(start.getTime() + Math.max(5, e.durationMinutes) * 60_000);
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    }
    if (e.rrule && /^FREQ=[A-Z]+(;[A-Z]+=[-A-Z0-9,]+)*$/.test(e.rrule)) lines.push(`RRULE:${e.rrule}`);
    lines.push(`SUMMARY:${icsEscape(e.title)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.url && /^https:\/\//.test(e.url)) lines.push(`URL:${e.url}`);
    if (e.alarmMinutesBefore) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, `TRIGGER:-PT${Math.round(e.alarmMinutesBefore)}M`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

export const TOUR_SAFETY_NOTE =
  "Before you go: confirm the address matches the listing, bring a friend or share your location, and never pay a deposit or fee before you've seen the inside and confirmed who can rent the home.";

export function tourEvent(t: { id: string; startsAt: string; mode: "in_person" | "live_video" }, listing: { title: string; addressText: string | null }): CalendarEvent {
  return {
    uid: `tour-${t.id}`,
    title: `${t.mode === "in_person" ? "Home tour" : "Video tour"}: ${listing.title}`,
    startsAt: t.startsAt,
    durationMinutes: 30,
    location: t.mode === "in_person" ? listing.addressText : "Live video (link from the manager in Housing Compass)",
    description: TOUR_SAFETY_NOTE,
    alarmMinutesBefore: 60,
  };
}
