import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { expandEvents, GymEvent, EventOccurrence } from '@/lib/events';

const TYPE_OPTIONS: { value: 'class' | 'event' | 'open_slot'; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'event', label: 'Event' },
  { value: 'open_slot', label: 'Open slot' },
];

type Booking = {
  id: string;
  event_id: string;
  occurrence_date: string;
  member_id: string;
  member_name?: string;
};

type FormState = {
  id?: string;
  title: string;
  description: string;
  event_type: 'class' | 'event' | 'open_slot';
  starts_at: string; // local datetime input value: YYYY-MM-DDTHH:MM
  ends_at: string;
  capacity: string; // '' means no booking; else integer >= 1
  recurring: boolean;
  recurrence_until: string; // YYYY-MM-DD or ''
};

const EMPTY_FORM = (): FormState => {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: '',
    description: '',
    event_type: 'class',
    starts_at: toLocalInput(start),
    ends_at: toLocalInput(end),
    capacity: '',
    recurring: false,
    recurrence_until: '',
  };
};

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string) {
  // Treat as local time.
  return new Date(s);
}

export default function OwnerCalendar() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [events, setEvents] = useState<GymEvent[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsEnabled, setBookingsEnabled] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: m }, { data: evs }] = await Promise.all([
      supabase
        .from('gym_modules')
        .select('bookings_enabled, calendar_enabled')
        .eq('gym_id', gymId)
        .maybeSingle(),
      supabase
        .from('gym_events')
        .select('*')
        .eq('gym_id', gymId)
        .order('starts_at'),
    ]);
    setBookingsEnabled(!!(m as any)?.bookings_enabled);
    setCalendarEnabled(!!(m as any)?.calendar_enabled);
    const eventRows = (evs as GymEvent[]) ?? [];
    setEvents(eventRows);

    if (eventRows.length > 0) {
      const ids = eventRows.map((e) => e.id);
      const { data: bks } = await supabase
        .from('gym_event_bookings')
        .select('id, event_id, occurrence_date, member_id')
        .in('event_id', ids);
      const memberIds = Array.from(new Set((bks ?? []).map((b: any) => b.member_id)));
      const { data: profiles } = memberIds.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
        : { data: [] as any[] };
      const nameMap = new Map<string, string>(
        (profiles ?? []).map((p: any) => [p.id, p.full_name || p.email])
      );
      setBookings(
        (bks ?? []).map((b: any) => ({
          ...b,
          member_name: nameMap.get(b.member_id) || 'Member',
        }))
      );
    } else {
      setBookings([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const occurrences = useMemo(() => {
    if (!events) return [];
    return expandEvents(events, 60);
  }, [events]);

  const bookingsByKey = useMemo(() => {
    const m: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      const key = `${b.event_id}|${b.occurrence_date}`;
      (m[key] ??= []).push(b);
    });
    return m;
  }, [bookings]);

  async function toggleBookings(v: boolean) {
    if (!gymId) return;
    setBookingsEnabled(v);
    const { error } = await supabase
      .from('gym_modules')
      .update({ bookings_enabled: v })
      .eq('gym_id', gymId);
    if (error) {
      setErr(error.message);
      setBookingsEnabled(!v);
    }
  }

  async function saveEvent() {
    if (!form || !gymId) return;
    setErr(null);
    if (!form.title.trim()) {
      setErr('Title is required.');
      return;
    }
    const startsAt = fromLocalInput(form.starts_at);
    const endsAt = fromLocalInput(form.ends_at);
    if (!(startsAt instanceof Date) || isNaN(startsAt.getTime())) {
      setErr('Invalid start time.');
      return;
    }
    if (endsAt <= startsAt) {
      setErr('End must be after start.');
      return;
    }
    const cap = form.capacity.trim() === '' ? null : parseInt(form.capacity, 10);
    if (cap !== null && (!Number.isFinite(cap) || cap < 1)) {
      setErr('Capacity must be a whole number >= 1, or blank.');
      return;
    }
    const payload: any = {
      gym_id: gymId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      capacity: cap,
      recurrence: form.recurring ? 'weekly' : null,
      recurrence_until:
        form.recurring && form.recurrence_until ? form.recurrence_until : null,
    };

    setSaving(true);
    if (form.id) {
      const { error } = await supabase.from('gym_events').update(payload).eq('id', form.id);
      setSaving(false);
      if (error) {
        setErr(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('gym_events').insert(payload);
      setSaving(false);
      if (error) {
        setErr(error.message);
        return;
      }
    }
    setForm(null);
    load();
  }

  async function deleteEvent(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this event? Existing bookings will be removed.')) {
      return;
    }
    const { error } = await supabase.from('gym_events').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  function editEvent(e: GymEvent) {
    setForm({
      id: e.id,
      title: e.title,
      description: e.description ?? '',
      event_type: e.event_type,
      starts_at: toLocalInput(new Date(e.starts_at)),
      ends_at: toLocalInput(new Date(e.ends_at)),
      capacity: e.capacity == null ? '' : String(e.capacity),
      recurring: e.recurrence === 'weekly',
      recurrence_until: e.recurrence_until ?? '',
    });
  }

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }

  if (events === null) {
    return <ActivityIndicator color={theme.colors.charcoal} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.sub}>
          Add classes, events, and open slots. Capacity makes a slot bookable when
          bookings are turned on.
        </Text>
      </View>

      {!calendarEnabled ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Heads up: the Schedule page on your public site is hidden until an admin turns
            on the Calendar module for your gym.
          </Text>
        </View>
      ) : null}

      <View style={styles.toggleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Member bookings</Text>
          <Text style={styles.toggleSub}>
            When on, members of your gym can book class/event slots that have a capacity.
            Member names show up in your calendar below — they&apos;re hidden on the public
            schedule for privacy.
          </Text>
        </View>
        <Switch value={bookingsEnabled} onValueChange={toggleBookings} />
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {!form ? (
        <Pressable style={styles.btn} onPress={() => setForm(EMPTY_FORM())}>
          <Text style={styles.btnText}>+ Add to calendar</Text>
        </Pressable>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{form.id ? 'Edit' : 'New'} entry</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={form.title}
            onChangeText={(v) => setForm({ ...form, title: v })}
            placeholder="Yoga, Bring-a-friend night, 1:1 training…"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            multiline
            numberOfLines={3}
            style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
          />

          <Text style={styles.label}>Type</Text>
          <View style={styles.pillRow}>
            {TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setForm({ ...form, event_type: opt.value })}
                style={[
                  styles.typePill,
                  form.event_type === opt.value && styles.typePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.typePillText,
                    form.event_type === opt.value && styles.typePillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>Starts</Text>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) =>
                  setForm({ ...form, starts_at: (e.target as HTMLInputElement).value })
                }
                style={dateInputStyle}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Ends</Text>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) =>
                  setForm({ ...form, ends_at: (e.target as HTMLInputElement).value })
                }
                style={dateInputStyle}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.label}>Capacity (leave blank if no booking)</Text>
              <TextInput
                value={form.capacity}
                onChangeText={(v) => setForm({ ...form, capacity: v.replace(/[^0-9]/g, '') })}
                placeholder="e.g. 20"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.flex}>
              <View style={styles.toggleRowInline}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Repeats weekly</Text>
                  <Text style={styles.dim}>Same weekday and time</Text>
                </View>
                <Switch
                  value={form.recurring}
                  onValueChange={(v) => setForm({ ...form, recurring: v })}
                />
              </View>
              {form.recurring ? (
                <>
                  <Text style={styles.label}>Until (optional)</Text>
                  <input
                    type="date"
                    value={form.recurrence_until}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        recurrence_until: (e.target as HTMLInputElement).value,
                      })
                    }
                    style={dateInputStyle}
                  />
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.formButtons}>
            <Pressable
              style={styles.btn}
              onPress={saveEvent}
              disabled={saving}
            >
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
            <Pressable style={styles.btnGhost} onPress={() => setForm(null)}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            {form.id ? (
              <Pressable style={styles.btnDanger} onPress={() => deleteEvent(form.id!)}>
                <Text style={styles.btnDangerText}>Delete</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      <View style={styles.eventsList}>
        <Text style={styles.sectionTitle}>Upcoming (next 60 days)</Text>
        {occurrences.length === 0 ? (
          <Text style={styles.dim}>Nothing scheduled. Add an entry above.</Text>
        ) : (
          groupByDay(occurrences).map(([day, list]) => (
            <View key={day} style={styles.daySection}>
              <Text style={styles.dayHeading}>
                {new Date(day + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              {list.map((o) => {
                const key = `${o.event.id}|${o.dateKey}`;
                const ev = o.event;
                const list = bookingsByKey[key] ?? [];
                const cap = ev.capacity;
                return (
                  <View key={key} style={styles.eventRow}>
                    <View style={styles.eventTime}>
                      <Text style={styles.eventTimeText}>
                        {o.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                      <Text style={styles.eventTimeSub}>
                        {o.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.eventTitle}>{ev.title}</Text>
                      <View style={styles.eventMeta}>
                        <View style={styles.kindPill}>
                          <Text style={styles.kindPillText}>
                            {ev.event_type === 'open_slot' ? 'Open slot' : ev.event_type}
                          </Text>
                        </View>
                        {ev.recurrence === 'weekly' ? (
                          <Text style={styles.metaText}>↻ Weekly</Text>
                        ) : null}
                        {cap != null ? (
                          <Text style={styles.metaText}>
                            {list.length}/{cap} booked
                          </Text>
                        ) : null}
                      </View>
                      {list.length > 0 ? (
                        <View style={styles.bookedRow}>
                          {list.map((b) => (
                            <View key={b.id} style={styles.bookedChip}>
                              <Text style={styles.bookedChipText}>{b.member_name}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                    <Pressable onPress={() => editEvent(ev)} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function groupByDay(occ: EventOccurrence[]) {
  const m: Record<string, EventOccurrence[]> = {};
  occ.forEach((o) => {
    (m[o.dateKey] ??= []).push(o);
  });
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
}

const dateInputStyle: any = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  background: '#fff',
  color: '#0F172A',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const styles = StyleSheet.create({
  root: { padding: 0, gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  notice: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  noticeText: { fontSize: 13, color: '#92400e' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  toggleRowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  toggleSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 18 },
  err: { color: theme.colors.danger, fontSize: 13 },
  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnGhostText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },
  btnDanger: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  btnDangerText: { color: '#dc2626', fontWeight: '700', fontSize: 14 },
  formCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 12,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  dim: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  typePillActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  typePillText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },
  typePillTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  flex: { flex: 1, flexBasis: 220, gap: 6 },
  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },

  eventsList: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  daySection: { gap: 6 },
  dayHeading: { fontSize: 14, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 8 },
  eventRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
  },
  eventTime: { width: 80 },
  eventTimeText: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  eventTimeSub: { fontSize: 12, color: theme.colors.textSecondary },
  eventTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  eventMeta: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  kindPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  kindPillText: { fontSize: 11, fontWeight: '800', color: '#4338ca', textTransform: 'capitalize' },
  metaText: { fontSize: 12, color: theme.colors.textSecondary },
  bookedRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  bookedChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  bookedChipText: { fontSize: 11, fontWeight: '700', color: theme.colors.charcoal },
  editBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
});
