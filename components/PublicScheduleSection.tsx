import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useGymSite } from '@/components/GymSiteContext';
import { expandEvents, EventOccurrence, GymEvent } from '@/lib/events';
import { MonthCalendar } from '@/components/MonthCalendar';

const HORIZON_DAYS = 90;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  // Monday-start
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
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
  return d.toISOString().slice(0, 10);
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function PublicScheduleSection() {
  const site = useGymSite();
  const { session, profile } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [events, setEvents] = useState<GymEvent[] | null>(null);
  const [bookings, setBookings] = useState<
    { event_id: string; occurrence_date: string; count: number; mine: boolean }[]
  >([]);
  const [isMember, setIsMember] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [dayModal, setDayModal] = useState<Date | null>(null);

  async function load() {
    const horizonEnd = new Date(Date.now() + HORIZON_DAYS * 86400_000).toISOString();
    // Show shared events (location_id null) plus the current location's own.
    const locFilter = site.currentLocation
      ? `location_id.is.null,location_id.eq.${site.currentLocation.id}`
      : 'location_id.is.null';
    const { data: evs } = await supabase
      .from('gym_events')
      .select('*')
      .eq('gym_id', site.gym.id)
      .or(locFilter)
      .lt('starts_at', horizonEnd)
      .order('starts_at');
    setEvents((evs as GymEvent[]) ?? []);

    if (evs && evs.length > 0) {
      const ids = (evs as any[]).map((e) => e.id);
      const { data: bks } = await supabase
        .from('gym_event_bookings')
        .select('event_id, occurrence_date, member_id')
        .in('event_id', ids);
      const grouped: Record<string, { count: number; mine: boolean }> = {};
      const myId = profile?.id ?? null;
      (bks ?? []).forEach((b: any) => {
        const key = `${b.event_id}|${b.occurrence_date}`;
        if (!grouped[key]) grouped[key] = { count: 0, mine: false };
        grouped[key].count += 1;
        if (myId && b.member_id === myId) grouped[key].mine = true;
      });
      setBookings(
        Object.entries(grouped).map(([k, v]) => {
          const [event_id, occurrence_date] = k.split('|');
          return { event_id, occurrence_date, count: v.count, mine: v.mine };
        })
      );
    } else {
      setBookings([]);
    }

    if (profile?.id) {
      const { data: m } = await supabase
        .from('gym_memberships')
        .select('id')
        .eq('member_id', profile.id)
        .eq('gym_id', site.gym.id)
        .eq('status', 'active')
        .maybeSingle();
      setIsMember(!!m);
    } else {
      setIsMember(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.gym.id, profile?.id]);

  const occurrences = useMemo(() => {
    if (!events) return [];
    return expandEvents(events, HORIZON_DAYS);
  }, [events]);

  const occByDay = useMemo(() => {
    const m: Record<string, EventOccurrence[]> = {};
    occurrences.forEach((o) => {
      const k = dateKey(o.start);
      (m[k] ??= []).push(o);
    });
    return m;
  }, [occurrences]);

  const bookingsByKey = useMemo(() => {
    const m: Record<string, { count: number; mine: boolean }> = {};
    bookings.forEach((b) => {
      m[`${b.event_id}|${b.occurrence_date}`] = { count: b.count, mine: b.mine };
    });
    return m;
  }, [bookings]);

  // Month grid cells (always 6 rows × 7 cols = 42 days starting from the
  // Monday on or before the 1st of the displayed month)
  const monthCells = useMemo(() => {
    const first = startOfMonth(monthAnchor);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [monthAnchor]);

  const selectedWeekStart = useMemo(() => startOfWeek(selectedDay), [selectedDay]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(selectedWeekStart, i)),
    [selectedWeekStart]
  );

  async function book(o: EventOccurrence) {
    if (!profile?.id) return;
    setBusy(`${o.event.id}|${o.dateKey}`);
    setErr(null);
    const { error } = await supabase.from('gym_event_bookings').insert({
      event_id: o.event.id,
      occurrence_date: o.dateKey,
      member_id: profile.id,
    });
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }
  async function cancel(o: EventOccurrence) {
    if (!profile?.id) return;
    setBusy(`${o.event.id}|${o.dateKey}`);
    setErr(null);
    const { error } = await supabase
      .from('gym_event_bookings')
      .delete()
      .eq('event_id', o.event.id)
      .eq('occurrence_date', o.dateKey)
      .eq('member_id', profile.id);
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    load();
  }

  const primary = site.theme.primary_color;
  const accent = site.theme.accent_color;
  const bookingsEnabled = site.modules.bookings_enabled;

  function renderOcc(o: EventOccurrence) {
    const key = `${o.event.id}|${o.dateKey}`;
    const bk = bookingsByKey[key];
    const spotsLeft =
      o.event.capacity != null
        ? Math.max(0, o.event.capacity - (bk?.count ?? 0))
        : null;
    const canBook =
      bookingsEnabled &&
      o.event.capacity != null &&
      spotsLeft! > 0 &&
      isMember &&
      !bk?.mine;
    const canCancel = !!bk?.mine;
    return (
      <View key={key} style={styles.row}>
        <View style={styles.timeCol}>
          <Text style={styles.time}>
            {o.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Text style={styles.timeSub}>
            {o.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.bodyCol}>
          <Text style={styles.title}>{o.event.title}</Text>
          {o.event.description ? (
            <Text style={styles.desc}>{o.event.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={[styles.pill, { backgroundColor: accent + '22' }]}>
              <Text style={[styles.pillText, { color: accent }]}>
                {labelForType(o.event.event_type)}
              </Text>
            </View>
            {o.event.capacity != null ? (
              <Text style={styles.spots}>
                {spotsLeft === 0
                  ? 'Full'
                  : `${spotsLeft} of ${o.event.capacity} ${
                      spotsLeft === 1 ? 'spot' : 'spots'
                    } open`}
              </Text>
            ) : null}
          </View>
        </View>
        {canCancel ? (
          <Pressable
            onPress={() => cancel(o)}
            disabled={busy === key}
            style={[styles.actionBtn, styles.cancelBtn]}
          >
            <Text style={styles.cancelBtnText}>Cancel booking</Text>
          </Pressable>
        ) : canBook ? (
          <Pressable
            onPress={() => book(o)}
            disabled={busy === key}
            style={[styles.actionBtn, { backgroundColor: accent }]}
          >
            <Text style={styles.actionBtnText}>Book</Text>
          </Pressable>
        ) : bookingsEnabled && o.event.capacity != null && !session ? (
          <Text style={styles.muted}>Sign in to book</Text>
        ) : bookingsEnabled && o.event.capacity != null && !isMember ? (
          <Text style={styles.muted}>Members only</Text>
        ) : null}
      </View>
    );
  }

  if (events === null) return <ActivityIndicator color={primary} />;

  const monthLabel = monthAnchor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const weekRange = `${weekDays[0].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekDays[6].toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;

  // Feed: events in the selected week, grouped by day
  const feedDays = weekDays
    .map((d) => ({ day: d, occs: occByDay[dateKey(d)] ?? [] }))
    .filter((x) => x.occs.length > 0);

  return (
    <View style={styles.root}>
      {err ? <Text style={styles.err}>{err}</Text> : null}

      {/* Calendar grid */}
      <MonthCalendar
        monthAnchor={monthAnchor}
        onMonthChange={setMonthAnchor}
        today={today}
        selectedWeekStart={selectedWeekStart}
        countForDay={(d) => (occByDay[dateKey(d)] ?? []).length}
        onDayPress={(d) => setDayModal(d)}
        onWeekPress={(ws) => setSelectedDay(ws)}
        compact={!isWide}
        primary={primary}
        accent={accent}
      />

      {/* Week heading */}
      <View style={styles.weekBar}>
        <Text style={[styles.weekTitle, { color: primary }]}>Week of {weekRange}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable
            onPress={() => setSelectedDay((d) => addDays(d, -7))}
            style={styles.navBtnSmall}
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
            style={styles.navBtnSmall}
          >
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>
      </View>

      {feedDays.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Nothing scheduled this week.</Text>
        </View>
      ) : (
        feedDays.map(({ day, occs }) => (
          <View key={day.toISOString()} style={styles.daySection}>
            <Text style={[styles.dayHeading, { color: primary }]}>
              {day.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <View style={styles.dayList}>{occs.map((o) => renderOcc(o))}</View>
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
                <Text style={[styles.modalTitle, { color: primary }]}>
                  {dayModal.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <ScrollView style={{ maxHeight: 380 }}>
                  <View style={styles.dayList}>
                    {(occByDay[dateKey(dayModal)] ?? []).length === 0 ? (
                      <Text style={styles.muted}>Nothing scheduled on this day.</Text>
                    ) : (
                      (occByDay[dateKey(dayModal)] ?? []).map((o) => renderOcc(o))
                    )}
                  </View>
                </ScrollView>
                <Pressable
                  style={[styles.modalClose, { borderColor: accent }]}
                  onPress={() => setDayModal(null)}
                >
                  <Text style={[styles.modalCloseText, { color: accent }]}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function labelForType(t: string) {
  if (t === 'class') return 'Class';
  if (t === 'event') return 'Event';
  return 'Open slot';
}

const styles = StyleSheet.create({
  root: { gap: 20, maxWidth: 920, width: '100%', alignSelf: 'stretch' },
  err: { color: '#DC2626', fontSize: 13 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalClose: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCloseText: { fontSize: 14, fontWeight: '700' },

  calCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 12,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calTitle: { fontSize: 18, fontWeight: '800' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navBtnText: { fontSize: 18, color: '#0F172A', fontWeight: '700', lineHeight: 18 },

  dowRow: { flexDirection: 'row' },
  dowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingVertical: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
  },
  cellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 3,
  },
  cellNum: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  cellNumOutMonth: { color: '#cbd5e1' },
  dot: { width: 5, height: 5, borderRadius: 3 },

  weekBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  weekTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  empty: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 14, color: '#475569' },
  daySection: { gap: 8 },
  dayHeading: { fontSize: 16, fontWeight: '800' },
  dayList: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  timeCol: { width: 80 },
  time: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  timeSub: { fontSize: 12, color: '#94a3b8' },
  bodyCol: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  desc: { fontSize: 13, color: '#475569' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  spots: { fontSize: 12, color: '#475569' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtn: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  cancelBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
});
