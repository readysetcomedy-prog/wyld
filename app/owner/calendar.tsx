import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { expandEvents, GymEvent, EventOccurrence } from '@/lib/events';
import { MonthCalendar } from '@/components/MonthCalendar';
import { DateTimeField } from '@/components/DateTimeField';
import { Select } from '@/components/Select';
import { useScrollToTop } from '@/lib/scrollContext';

const TYPE_OPTIONS: { value: 'class' | 'event' | 'open_slot'; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'event', label: 'Event' },
  { value: 'open_slot', label: 'Open slot' },
];

const HORIZON_DAYS = 365;

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
  starts_at: Date;
  ends_at: Date;
  capacity: string;
  recurring: boolean;
  recurrence_until: Date | null;
  location_id: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function toDateOnly(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const EMPTY_FORM = (seed?: Date, locationId?: string | null): FormState => {
  const start = new Date(seed ?? new Date());
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    title: '',
    description: '',
    event_type: 'class',
    starts_at: start,
    ends_at: end,
    capacity: '',
    recurring: false,
    recurrence_until: null,
    location_id: locationId ?? null,
  };
};

export default function OwnerCalendar() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [events, setEvents] = useState<GymEvent[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsEnabled, setBookingsEnabled] = useState(false);
  const [multiLocation, setMultiLocation] = useState(false);
  const [locations, setLocations] = useState<{ id: string; label: string | null }[]>([]);
  const [locFilter, setLocFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollDashboardToTop = useScrollToTop();
  // Set when the form is opened from the day popup — triggers a scroll once
  // the popup has closed and the form has mounted.
  const wantScroll = useRef(false);

  // Run the scroll after the render that mounts the form and closes the
  // day popup, otherwise that layout shift snaps the scroll position back.
  useEffect(() => {
    if (form && !dayModal && wantScroll.current) {
      wantScroll.current = false;
      const t = setTimeout(() => {
        scrollDashboardToTop();
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }, 220);
      return () => clearTimeout(t);
    }
  }, [form, dayModal, scrollDashboardToTop]);

  const load = useCallback(async () => {
    if (!gymId) return;
    const [{ data: m }, { data: evs }, { data: locs }] = await Promise.all([
      supabase
        .from('gym_modules')
        .select('bookings_enabled, multi_location_enabled')
        .eq('gym_id', gymId)
        .maybeSingle(),
      supabase.from('gym_events').select('*').eq('gym_id', gymId).order('starts_at'),
      supabase
        .from('gym_locations')
        .select('id, label')
        .eq('gym_id', gymId)
        .order('display_order'),
    ]);
    setBookingsEnabled(!!(m as any)?.bookings_enabled);
    setMultiLocation(!!(m as any)?.multi_location_enabled);
    setLocations((locs as any) ?? []);
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
    // When a location is selected, show that location's events plus shared.
    const visible = locFilter
      ? events.filter((e) => e.location_id === locFilter || e.location_id == null)
      : events;
    return expandEvents(visible, HORIZON_DAYS);
  }, [events, locFilter]);

  // Search across the whole horizon by title, description, type, or date.
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return occurrences.filter((o) => {
      const dateStr = o.start
        .toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
        .toLowerCase();
      return (
        o.event.title.toLowerCase().includes(q) ||
        (o.event.description ?? '').toLowerCase().includes(q) ||
        o.event.event_type.toLowerCase().includes(q) ||
        dateStr.includes(q)
      );
    });
  }, [occurrences, search]);

  const occByDay = useMemo(() => {
    const m: Record<string, EventOccurrence[]> = {};
    occurrences.forEach((o) => {
      (m[dateKey(o.start)] ??= []).push(o);
    });
    return m;
  }, [occurrences]);

  const bookingsByKey = useMemo(() => {
    const m: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      (m[`${b.event_id}|${b.occurrence_date}`] ??= []).push(b);
    });
    return m;
  }, [bookings]);

  const monthCells = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(monthAnchor));
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [monthAnchor]);

  const selectedWeekStart = useMemo(() => startOfWeek(selectedDay), [selectedDay]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i)),
    [selectedWeekStart]
  );

  async function saveEvent() {
    if (!form || !gymId) return;
    setErr(null);
    if (!form.title.trim()) {
      setErr('Title is required.');
      return;
    }
    const startsAt = form.starts_at;
    const endsAt = form.ends_at;
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
        form.recurring && form.recurrence_until ? toDateOnly(form.recurrence_until) : null,
      location_id: form.location_id,
    };

    setSaving(true);
    const res = form.id
      ? await supabase.from('gym_events').update(payload).eq('id', form.id)
      : await supabase.from('gym_events').insert(payload);
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setForm(null);
    load();
  }

  async function deleteEvent(id: string) {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Delete this event? Existing bookings will be removed.')
    ) {
      return;
    }
    const { error } = await supabase.from('gym_events').delete().eq('id', id);
    if (error) {
      setErr(error.message);
      return;
    }
    setForm(null);
    load();
  }

  function editEvent(e: GymEvent) {
    setForm({
      id: e.id,
      title: e.title,
      description: e.description ?? '',
      event_type: e.event_type,
      starts_at: new Date(e.starts_at),
      ends_at: new Date(e.ends_at),
      capacity: e.capacity == null ? '' : String(e.capacity),
      recurring: e.recurrence === 'weekly',
      recurrence_until: e.recurrence_until ? new Date(e.recurrence_until + 'T00:00:00') : null,
      location_id: e.location_id ?? null,
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

  const monthLabel = monthAnchor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const weekRange = `${weekDays[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  // Feed: search results when searching, otherwise the selected week.
  const feedDays = (() => {
    const source = searchResults
      ? (() => {
          const m: Record<string, EventOccurrence[]> = {};
          searchResults.forEach((o) => {
            (m[dateKey(o.start)] ??= []).push(o);
          });
          return Object.keys(m)
            .sort()
            .map((k) => ({ day: new Date(k + 'T00:00:00'), occs: m[k] }));
        })()
      : weekDays.map((d) => ({ day: d, occs: occByDay[dateKey(d)] ?? [] }));
    return source.filter((x) => x.occs.length > 0);
  })();

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.sub}>
          Add classes, events, and open slots.{' '}
          {bookingsEnabled
            ? 'Capacity slots are bookable by members — booked names show below.'
            : 'Bookings are off, so capacity is informational only.'}
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.controls}>
        {multiLocation && locations.length > 0 ? (
          <View style={styles.controlField}>
            <Text style={styles.controlLabel}>Location</Text>
            <Select
              ariaLabel="Filter calendar by location"
              value={locFilter ?? 'all'}
              onChange={(v) => setLocFilter(v === 'all' ? null : v)}
              options={[
                { value: 'all', label: 'All locations' },
                ...locations.map((l) => ({ value: l.id, label: l.label || 'Location' })),
              ]}
            />
          </View>
        ) : null}
        <View style={[styles.controlField, { flex: 1, minWidth: 200 }]}>
          <Text style={styles.controlLabel}>Search</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by class, type, or date…"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>
      </View>

      {!form ? (
        <Pressable
          style={styles.btn}
          onPress={() => setForm(EMPTY_FORM(selectedDay, locFilter))}
        >
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
                style={[styles.typePill, form.event_type === opt.value && styles.typePillActive]}
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
              <DateTimeField
                value={form.starts_at}
                onChange={(d) => {
                  // Keep the same duration when the start moves.
                  const dur = form.ends_at.getTime() - form.starts_at.getTime();
                  setForm({
                    ...form,
                    starts_at: d,
                    ends_at: new Date(d.getTime() + Math.max(dur, 0)),
                  });
                }}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.label}>Ends</Text>
              <DateTimeField
                value={form.ends_at}
                onChange={(d) => setForm({ ...form, ends_at: d })}
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
                  <DateTimeField
                    mode="date"
                    placeholder="No end date"
                    value={form.recurrence_until}
                    onChange={(d) => setForm({ ...form, recurrence_until: d })}
                  />
                </>
              ) : null}
            </View>
          </View>

          {multiLocation && locations.length > 0 ? (
            <View>
              <Text style={styles.label}>Location</Text>
              <Select
                ariaLabel="Event location"
                value={form.location_id ?? 'all'}
                onChange={(v) =>
                  setForm({ ...form, location_id: v === 'all' ? null : v })
                }
                options={[
                  { value: 'all', label: 'All locations (shared)' },
                  ...locations.map((l) => ({ value: l.id, label: l.label || 'Location' })),
                ]}
              />
            </View>
          ) : null}

          <View style={styles.formButtons}>
            <Pressable style={styles.btn} onPress={saveEvent} disabled={saving}>
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

      {/* Month calendar */}
      <MonthCalendar
        monthAnchor={monthAnchor}
        onMonthChange={setMonthAnchor}
        today={today}
        selectedWeekStart={selectedWeekStart}
        countForDay={(d) => (occByDay[dateKey(d)] ?? []).length}
        onDayPress={(d) => setDayModal(d)}
        onWeekPress={(ws) => setSelectedDay(ws)}
        compact={!isWide}
        primary={theme.colors.charcoal}
        accent={theme.colors.wyldPurple}
      />

      {/* Week heading (hidden while searching) */}
      {searchResults ? (
        <View style={styles.weekBar}>
          <Text style={styles.weekTitle}>
            {searchResults.length} result{searchResults.length === 1 ? '' : 's'} for
            &ldquo;{search.trim()}&rdquo;
          </Text>
        </View>
      ) : (
        <View style={styles.weekBar}>
          <Text style={styles.weekTitle}>Week of {weekRange}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={() => setSelectedDay((d) => addDays(d, -7))}
              style={styles.navBtnSm}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSelectedDay(today);
                setMonthAnchor(startOfMonth(today));
              }}
              style={styles.todayBtn}
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedDay((d) => addDays(d, 7))}
              style={styles.navBtnSm}
            >
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>
        </View>
      )}

      {feedDays.length === 0 ? (
        <Text style={styles.dim}>
          {searchResults ? 'No events match your search.' : 'Nothing scheduled this week.'}
        </Text>
      ) : (
        feedDays.map(({ day, occs }) => (
          <View key={day.toISOString()} style={styles.daySection}>
            <Text style={styles.dayHeading}>
              {day.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            {occs.map((o) => {
              const key = `${o.event.id}|${o.dateKey}`;
              const ev = o.event;
              const bl = bookingsByKey[key] ?? [];
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
                      {ev.capacity != null ? (
                        <Text style={styles.metaText}>
                          {bl.length}/{ev.capacity} booked
                        </Text>
                      ) : null}
                    </View>
                    {bl.length > 0 ? (
                      <View style={styles.bookedRow}>
                        {bl.map((b) => (
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

      <Modal
        visible={dayModal != null}
        transparent
        animationType="fade"
        onRequestClose={() => setDayModal(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDayModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation?.()}>
            {dayModal ? (
              <>
                <Text style={styles.modalTitle}>
                  {dayModal.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <ScrollView style={{ maxHeight: 320 }}>
                  {(occByDay[dateKey(dayModal)] ?? []).length === 0 ? (
                    <Text style={styles.dim}>Nothing scheduled on this day yet.</Text>
                  ) : (
                    (occByDay[dateKey(dayModal)] ?? []).map((o) => {
                      const bl = bookingsByKey[`${o.event.id}|${o.dateKey}`] ?? [];
                      return (
                        <View key={`${o.event.id}|${o.dateKey}`} style={styles.modalEvent}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.modalEventTime}>
                              {o.start.toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}{' '}
                              · {o.event.title}
                            </Text>
                            <Text style={styles.modalEventMeta}>
                              {o.event.event_type === 'open_slot'
                                ? 'Open slot'
                                : o.event.event_type}
                              {o.event.capacity != null
                                ? ` · ${bl.length}/${o.event.capacity} booked`
                                : ''}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              editEvent(o.event);
                              wantScroll.current = true;
                              setDayModal(null);
                            }}
                            style={styles.editBtn}
                          >
                            <Text style={styles.editBtnText}>Edit</Text>
                          </Pressable>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
                <View style={styles.modalButtons}>
                  <Pressable
                    style={styles.btn}
                    onPress={() => {
                      setForm(EMPTY_FORM(dayModal, locFilter));
                      setSelectedDay(dayModal);
                      wantScroll.current = true;
                      setDayModal(null);
                    }}
                  >
                    <Text style={styles.btnText}>+ Add to this day</Text>
                  </Pressable>
                  <Pressable style={styles.btnGhost} onPress={() => setDayModal(null)}>
                    <Text style={styles.btnGhostText}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 0, gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  err: { color: theme.colors.danger, fontSize: 13 },
  controls: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  controlField: { gap: 4 },
  controlLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },

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
  typePillActive: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  typePillText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },
  typePillTextActive: { color: '#fff' },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  flex: { flex: 1, flexBasis: 220, gap: 6, minWidth: 200 },
  toggleRowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },

  calCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 10,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navBtnSm: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  navBtnText: { fontSize: 18, color: theme.colors.charcoal, fontWeight: '700', lineHeight: 18 },
  dowRow: { flexDirection: 'row' },
  dowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    paddingVertical: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  cellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellNum: { fontSize: 13, fontWeight: '600', color: theme.colors.charcoal },
  cellNumOut: { color: '#cbd5e1' },
  countPill: {
    minWidth: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.wyldPurple,
  },
  countPillText: { color: '#fff', fontSize: 9, fontWeight: '800', textAlign: 'center' },

  weekBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  weekTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal, flex: 1 },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.charcoal,
  },
  todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  daySection: { gap: 6 },
  dayHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
  },
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
  eventTime: { width: 72 },
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
  kindPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338ca',
    textTransform: 'capitalize',
  },
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  modalEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalEventTime: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  modalEventMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  modalButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
