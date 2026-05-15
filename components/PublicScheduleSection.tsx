import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useGymSite } from '@/components/GymSiteContext';
import { expandEvents, EventOccurrence, GymEvent } from '@/lib/events';

const HORIZON_DAYS = 30;

export function PublicScheduleSection() {
  const site = useGymSite();
  const { session, profile } = useAuth();
  const [events, setEvents] = useState<GymEvent[] | null>(null);
  const [bookings, setBookings] = useState<
    { event_id: string; occurrence_date: string; count: number; mine: boolean }[]
  >([]);
  const [isMember, setIsMember] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const horizonEnd = new Date(Date.now() + HORIZON_DAYS * 86400_000).toISOString();
    const { data: evs } = await supabase
      .from('gym_events')
      .select('*')
      .eq('gym_id', site.gym.id)
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
  }, [site.gym.id, profile?.id]);

  const occurrences = useMemo(() => {
    if (!events) return [];
    return expandEvents(events, HORIZON_DAYS);
  }, [events]);

  const bookingsByKey = useMemo(() => {
    const m: Record<string, { count: number; mine: boolean }> = {};
    bookings.forEach((b) => {
      m[`${b.event_id}|${b.occurrence_date}`] = { count: b.count, mine: b.mine };
    });
    return m;
  }, [bookings]);

  const grouped = useMemo(() => {
    const byDay: Record<string, EventOccurrence[]> = {};
    occurrences.forEach((o) => {
      const day = o.start.toISOString().slice(0, 10);
      (byDay[day] ??= []).push(o);
    });
    return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
  }, [occurrences]);

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

  if (events === null) return <ActivityIndicator color={primary} />;
  if (occurrences.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          No upcoming classes or events in the next {HORIZON_DAYS} days. Check back soon.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {grouped.map(([day, list]) => {
        const d = new Date(day + 'T00:00:00');
        return (
          <View key={day} style={styles.daySection}>
            <Text style={[styles.dayHeading, { color: primary }]}>
              {d.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
            <View style={styles.dayList}>
              {list.map((o) => {
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
                        {o.start.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text style={styles.timeSub}>
                        {o.end.toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
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
                    ) : bookingsEnabled &&
                      o.event.capacity != null &&
                      !session ? (
                      <Text style={styles.muted}>Sign in to book</Text>
                    ) : bookingsEnabled &&
                      o.event.capacity != null &&
                      !isMember ? (
                      <Text style={styles.muted}>Members only</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function labelForType(t: string) {
  if (t === 'class') return 'Class';
  if (t === 'event') return 'Event';
  return 'Open slot';
}

const styles = StyleSheet.create({
  root: { gap: 28 },
  empty: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  emptyText: { fontSize: 14, color: '#475569' },
  err: { color: '#DC2626', fontSize: 13 },
  daySection: { gap: 10 },
  dayHeading: { fontSize: 18, fontWeight: '800' },
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
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelBtn: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  cancelBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
});
