import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { useGymTheme } from '@/lib/gymTheme';
import { expandEvents, GymEvent, EventOccurrence } from '@/lib/events';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

type Booking = {
  id: string;
  event_id: string;
  occurrence_date: string;
  member_id: string;
  created_at: string;
  member_name: string;
  member_email: string;
};

type Row = {
  occ: EventOccurrence;
  bookings: Booking[];
};

const HORIZON_DAYS = 60;

export default function OwnerBookings() {
  const { profile } = useAuth();
  const gymTheme = useGymTheme();
  const gymId = profile?.gym_id ?? null;
  const [events, setEvents] = useState<GymEvent[] | null>(null);
  const [bookingsEnabled, setBookingsEnabled] = useState<boolean | null>(null);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);
  // Stat counts come from head-only count queries so they reflect totals
  // across the full bookings table, not just the loaded page.
  const [stats, setStats] = useState<{ total: number; today: number; uniqueMembers: number }>({
    total: 0, today: 0, uniqueMembers: 0,
  });

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilter(filter.trim()), 250);
    return () => clearTimeout(id);
  }, [filter]);

  // Bounded data — module flag + event definitions for this gym.
  useEffect(() => {
    if (!gymId) return;
    Promise.all([
      supabase.from('gym_modules').select('bookings_enabled').eq('gym_id', gymId).maybeSingle(),
      supabase.from('gym_events').select('*').eq('gym_id', gymId).order('starts_at'),
    ]).then(([{ data: m }, { data: evs }]) => {
      setBookingsEnabled(!!(m as any)?.bookings_enabled);
      setEvents((evs as GymEvent[]) ?? []);
    });
  }, [gymId]);

  // Server-side paginated bookings query, scoped to upcoming
  // occurrences (today onwards) and ordered by occurrence date so the
  // soonest items show first. Profile names are joined in per-page.
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const loadPage = useCallback(async (from: number, to: number) => {
    if (!gymId || !events) return [];
    const ids = events.map((e) => e.id);
    if (ids.length === 0) return [];
    const { data: bks } = await supabase
      .from('gym_event_bookings')
      .select('id, event_id, occurrence_date, member_id, created_at')
      .in('event_id', ids)
      .gte('occurrence_date', todayKey)
      .order('occurrence_date', { ascending: true })
      .range(from, to);
    const rows = ((bks as any[]) ?? []);
    const memberIds = Array.from(new Set(rows.map((b) => b.member_id)));
    const { data: profiles } = memberIds.length
      ? await supabase.from('profiles').select('id, full_name, email').in('id', memberIds)
      : { data: [] as any[] };
    const nameMap = new Map<string, { name: string; email: string }>(
      ((profiles as any[]) ?? []).map((p) => [p.id, { name: p.full_name || p.email, email: p.email }])
    );
    return rows.map((b) => ({
      ...b,
      member_name: nameMap.get(b.member_id)?.name || 'Member',
      member_email: nameMap.get(b.member_id)?.email || '',
    })) as Booking[];
  }, [gymId, events, todayKey]);

  const { items: bookings, loading, hasMore, loadMore, reload } = useInfiniteList<Booking>({
    pageSize: 200,
    load: loadPage,
    deps: [gymId, events?.length ?? 0, todayKey],
  });

  // Stats are aggregate over the full bookings table for this gym,
  // computed via head-only count queries (cheap) rather than from the
  // paginated rows.
  useEffect(() => {
    if (!gymId || !events) return;
    const ids = events.map((e) => e.id);
    if (ids.length === 0) {
      setStats({ total: 0, today: 0, uniqueMembers: 0 });
      return;
    }
    Promise.all([
      supabase.from('gym_event_bookings').select('id', { count: 'exact', head: true })
        .in('event_id', ids).gte('occurrence_date', todayKey),
      supabase.from('gym_event_bookings').select('id', { count: 'exact', head: true })
        .in('event_id', ids).eq('occurrence_date', todayKey),
      supabase.from('gym_event_bookings').select('member_id')
        .in('event_id', ids).gte('occurrence_date', todayKey),
    ]).then(([total, today, members]) => {
      const unique = new Set(((members.data as any[]) ?? []).map((r) => r.member_id)).size;
      setStats({
        total: total.count ?? 0,
        today: today.count ?? 0,
        uniqueMembers: unique,
      });
    });
  }, [gymId, events, todayKey, bookings?.length]);

  async function cancelBooking(b: Booking) {
    if (typeof window !== 'undefined' && !window.confirm(`Cancel ${b.member_name}'s booking?`)) {
      return;
    }
    setErr(null);
    const { error } = await supabase.from('gym_event_bookings').delete().eq('id', b.id);
    if (error) { setErr(error.message); return; }
    reload();
  }

  const rows = useMemo<Row[]>(() => {
    if (!events || !bookings) return [];
    const occ = expandEvents(events, HORIZON_DAYS);
    const byKey = new Map<string, EventOccurrence>();
    occ.forEach((o) => byKey.set(`${o.event.id}|${o.dateKey}`, o));

    const grouped = new Map<string, Booking[]>();
    bookings.forEach((b) => {
      const key = `${b.event_id}|${b.occurrence_date}`;
      if (!byKey.has(key)) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(b);
    });

    const result: Row[] = [];
    grouped.forEach((bks, key) => {
      const o = byKey.get(key)!;
      result.push({ occ: o, bookings: bks });
    });
    result.sort((a, b) => a.occ.start.getTime() - b.occ.start.getTime());
    return result;
  }, [events, bookings]);

  // Client-side filter applies to whatever pages are currently loaded
  // — typing a name with thousands of bookings still works because the
  // initial 200-row page loads instantly and the sentinel pulls more
  // as the user scrolls past the in-memory matches.
  const filtered = useMemo(() => {
    const q = debouncedFilter.toLowerCase();
    if (!q) return rows;
    return rows
      .map((r) => ({
        ...r,
        bookings: r.bookings.filter(
          (b) =>
            b.member_name.toLowerCase().includes(q) ||
            b.member_email.toLowerCase().includes(q) ||
            r.occ.event.title.toLowerCase().includes(q)
        ),
      }))
      .filter((r) => r.bookings.length > 0);
  }, [rows, debouncedFilter]);

  const byDay = useMemo(() => {
    const m: Record<string, Row[]> = {};
    filtered.forEach((r) => {
      (m[r.occ.dateKey] ??= []).push(r);
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (!gymId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
      </View>
    );
  }

  if (events === null || bookingsEnabled === null) {
    return <ActivityIndicator color={theme.colors.charcoal} />;
  }

  if (!bookingsEnabled) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.dim}>Bookings aren&apos;t enabled for your gym yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <View>
        <Text style={styles.title}>Bookings</Text>
        <Text style={styles.sub}>
          Every member booking from your calendar shows up here so you can see who&apos;s
          coming and when.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Upcoming" value={stats.total} />
        <Stat label="Today" value={stats.today} />
        <Stat label="Unique members" value={stats.uniqueMembers} />
      </View>

      <TextInput
        value={filter}
        onChangeText={setFilter}
        placeholder="Filter by member name, email, or class title…"
        placeholderTextColor="#94a3b8"
        style={styles.filter}
      />

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {byDay.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.dim}>
            {filter
              ? 'No bookings match that filter.'
              : "No bookings yet. As members book slots from your schedule, they'll appear here."}
          </Text>
        </View>
      ) : (
        byDay.map(([day, list]) => (
          <View key={day} style={styles.daySection}>
            <Text style={styles.dayHeading}>
              {new Date(day + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              {day === todayKey ? '  ·  Today' : ''}
            </Text>
            {list.map((r) => (
              <View key={`${r.occ.event.id}|${r.occ.dateKey}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.timeBlock}>
                    <Text style={styles.time}>
                      {r.occ.start.toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.timeSub}>
                      {r.occ.end.toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.eventTitle}>{r.occ.event.title}</Text>
                    <Text style={styles.eventMeta}>
                      {r.bookings.length}
                      {r.occ.event.capacity != null ? ` / ${r.occ.event.capacity}` : ''}{' '}
                      booked
                      {r.occ.event.event_type === 'open_slot'
                        ? ' · Open slot'
                        : r.occ.event.event_type === 'event'
                        ? ' · Event'
                        : ' · Class'}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookingList}>
                  {r.bookings.map((b) => (
                    <View key={b.id} style={styles.bookingRow}>
                      <View style={[styles.avatar, { backgroundColor: gymTheme.primary }]}>
                        <Text style={styles.avatarText}>
                          {(b.member_name || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>{b.member_name}</Text>
                        {b.member_email ? (
                          <Text style={styles.memberMeta}>{b.member_email}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.bookedAt}>
                        Booked {new Date(b.created_at).toLocaleDateString()}
                      </Text>
                      <Pressable onPress={() => cancelBooking(b)} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
      <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  empty: { padding: theme.spacing.lg, gap: 8 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 14, color: theme.colors.textSecondary, fontStyle: 'italic' },
  err: { color: theme.colors.danger, fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  stat: {
    flexGrow: 1,
    flexBasis: 140,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  statValue: { fontSize: 26, fontWeight: '800', color: theme.colors.charcoal },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },

  filter: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },

  emptyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#f8fafc',
  },

  daySection: { gap: 8 },
  dayHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timeBlock: { width: 80 },
  time: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  timeSub: { fontSize: 12, color: theme.colors.textSecondary },
  eventTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.charcoal },
  eventMeta: { fontSize: 12, color: theme.colors.textSecondary },

  bookingList: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
    gap: 6,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.wyldPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  memberName: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  memberMeta: { fontSize: 12, color: theme.colors.textSecondary },
  bookedAt: { fontSize: 12, color: theme.colors.textSecondary },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  cancelBtnText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
});
