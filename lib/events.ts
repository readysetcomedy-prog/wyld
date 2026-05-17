export type EventType = 'class' | 'event' | 'open_slot';

export type GymEvent = {
  id: string;
  gym_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  recurrence: 'weekly' | null;
  recurrence_until: string | null;
  location_id: string | null;
};

export type EventOccurrence = {
  event: GymEvent;
  start: Date;
  end: Date;
  dateKey: string; // YYYY-MM-DD
};

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function expandEvents(events: GymEvent[], horizonDays: number): EventOccurrence[] {
  const now = new Date();
  const horizonEnd = new Date(now.getTime() + horizonDays * 86400_000);
  const out: EventOccurrence[] = [];

  for (const ev of events) {
    const start = new Date(ev.starts_at);
    const end = new Date(ev.ends_at);
    const duration = end.getTime() - start.getTime();

    if (!ev.recurrence) {
      if (end >= now && start <= horizonEnd) {
        out.push({ event: ev, start, end, dateKey: dateKey(start) });
      }
      continue;
    }

    // weekly: same weekday + time of day as start, until recurrence_until or horizonEnd
    const lastDate = ev.recurrence_until
      ? new Date(ev.recurrence_until + 'T23:59:59')
      : horizonEnd;
    const limit = lastDate < horizonEnd ? lastDate : horizonEnd;

    // Start iterating from the original start; if that's in the past, advance to today's week.
    let cursor = new Date(start);
    // If the original starts_at is in the past, fast-forward by weeks until cursor >= now (or up to limit).
    while (cursor < now && cursor <= limit) {
      cursor = new Date(cursor.getTime() + 7 * 86400_000);
    }
    while (cursor <= limit) {
      const occStart = new Date(cursor);
      const occEnd = new Date(occStart.getTime() + duration);
      out.push({ event: ev, start: occStart, end: occEnd, dateKey: dateKey(occStart) });
      cursor = new Date(cursor.getTime() + 7 * 86400_000);
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}
