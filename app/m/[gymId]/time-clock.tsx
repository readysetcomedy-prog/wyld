// Employee time clock for a specific gym. Clock in / out via RPC (which
// looks up the active employee row for the caller, refuses double
// punch-ins, and stamps the entry). When an open shift exists, the
// big button becomes a live timer; otherwise it's a picker + Clock In.
//
// Recent entries are paginated below — the same view the manager sees
// for this employee under Employees → Time Cards.

import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { LoadMoreSentinel } from '@/components/LoadMoreSentinel';

type Loc = { id: string; label: string | null };

type Entry = {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  location_id: string | null;
  notes: string | null;
  edited_at: string | null;
};

function fmtDuration(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function totalMs(e: Entry, now: number) {
  const start = new Date(e.clock_in_at).getTime();
  const end = e.clock_out_at ? new Date(e.clock_out_at).getTime() : now;
  return Math.max(0, end - start);
}

export default function TimeClock() {
  const { gymId } = useLocalSearchParams<{ gymId: string }>();
  const { session, profile } = useAuth();
  const [locations, setLocations] = useState<Loc[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<Entry | null>(null);
  const [chosenLoc, setChosenLoc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick once a second so the open-shift timer counts up live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Locations + this employee's id + any currently-open entry.
  const loadBase = useCallback(async () => {
    if (!gymId || !session || !profile?.email) return;
    const [{ data: locs }, { data: emp }] = await Promise.all([
      supabase
        .from('gym_locations')
        .select('id, label')
        .eq('gym_id', gymId)
        .eq('is_paused', false)
        .order('display_order'),
      supabase
        .from('gym_employees')
        .select('id, terminate_date')
        .eq('gym_id', gymId)
        .or(`user_id.eq.${session.user.id},email.eq.${profile.email}`)
        .maybeSingle(),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const empActive = emp && (!(emp as any).terminate_date || (emp as any).terminate_date > today);
    setLocations((locs as Loc[]) ?? []);
    setEmployeeId(empActive ? (emp as any).id : null);
    if (empActive) {
      const { data: open } = await supabase
        .from('time_card_entries')
        .select('id, clock_in_at, clock_out_at, location_id, notes, edited_at')
        .eq('employee_id', (emp as any).id)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setOpenEntry((open as Entry) ?? null);
      if (open && (open as any).location_id) setChosenLoc((open as any).location_id);
    }
  }, [gymId, session, profile?.email]);

  useEffect(() => { loadBase(); }, [loadBase]);

  // Paginated history for THIS employee at THIS gym.
  const loadHistory = useCallback(async (from: number, to: number) => {
    if (!employeeId) return [];
    const { data } = await supabase
      .from('time_card_entries')
      .select('id, clock_in_at, clock_out_at, location_id, notes, edited_at')
      .eq('employee_id', employeeId)
      .order('clock_in_at', { ascending: false })
      .range(from, to);
    return ((data as Entry[]) ?? []);
  }, [employeeId]);

  const { items: history, loading, hasMore, loadMore, reload: reloadHistory } =
    useInfiniteList<Entry>({ pageSize: 30, load: loadHistory, deps: [employeeId] });

  // Re-fetch the open entry directly from the table (don't trust the
  // RPC's return shape — keeps the timer state honest).
  const refetchOpen = useCallback(async () => {
    if (!employeeId) return;
    const { data } = await supabase
      .from('time_card_entries')
      .select('id, clock_in_at, clock_out_at, location_id, notes, edited_at')
      .eq('employee_id', employeeId)
      .is('clock_out_at', null)
      .order('clock_in_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setOpenEntry((data as Entry) ?? null);
  }, [employeeId]);

  // Realtime: any insert / update on this employee's own time card
  // refreshes both the open-shift card and the history below.
  useEffect(() => {
    if (!employeeId) return;
    const sub = supabase
      .channel(`tc-self-${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_card_entries',
          filter: `employee_id=eq.${employeeId}`,
        },
        () => { refetchOpen(); reloadHistory(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [employeeId, refetchOpen, reloadHistory]);

  async function clockIn() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.rpc('time_card_clock_in', {
      p_gym_id: gymId,
      p_location_id: chosenLoc,
    });
    setBusy(false);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[time-clock] clockIn failed', error);
      setErr(error.message);
      return;
    }
    // Don't trust the RPC return — re-fetch from the table.
    await refetchOpen();
    reloadHistory();
  }

  async function clockOut() {
    setErr(null);
    setBusy(true);
    const { error } = await supabase.rpc('time_card_clock_out', { p_gym_id: gymId });
    setBusy(false);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[time-clock] clockOut failed', error);
      setErr(error.message);
      return;
    }
    // Don't trust the RPC return — re-fetch from the table.
    await refetchOpen();
    reloadHistory();
  }

  if (!gymId) return null;
  if (employeeId === null && history === null) return <ActivityIndicator color={theme.colors.wyldPurple} />;
  if (!employeeId) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>Time Clock</Text>
        <Text style={styles.body}>
          You're not on this gym's staff roster, so there's nothing to clock
          in for here. If your manager just hired you, ask them to add your
          email to the roster.
        </Text>
      </View>
    );
  }

  const locLabel = (id: string | null) =>
    locations.find((l) => l.id === id)?.label || null;

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Time Clock</Text>
        <Text style={styles.sub}>
          Clock in when you start, out when you leave. Your manager sees
          the same hours under Employees → Time Cards.
        </Text>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={[styles.bigCard, openEntry && styles.bigCardOpen]}>
        {openEntry ? (
          <>
            <Text style={styles.bigLabel}>Clocked in</Text>
            <Text style={styles.timer}>{fmtDuration(totalMs(openEntry, now))}</Text>
            <Text style={styles.bigMeta}>
              Since {new Date(openEntry.clock_in_at).toLocaleString()}
              {locLabel(openEntry.location_id) ? `  ·  ${locLabel(openEntry.location_id)}` : ''}
            </Text>
            <Pressable
              style={[styles.clockOutBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={clockOut}
            >
              <Text style={styles.clockOutBtnText}>{busy ? 'Clocking out…' : 'Clock out'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.bigLabel}>Not clocked in</Text>
            {locations.length > 0 ? (
              <View style={styles.locPicker}>
                <Text style={styles.locPickerLabel}>Location (optional)</Text>
                <Select
                  ariaLabel="Pick a location"
                  value={chosenLoc ?? ''}
                  onChange={(v) => setChosenLoc(v || null)}
                  options={[
                    { value: '', label: 'No location' },
                    ...locations.map((l) => ({ value: l.id, label: l.label || 'Location' })),
                  ]}
                />
              </View>
            ) : null}
            <Pressable
              style={[styles.clockInBtn, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={clockIn}
            >
              <Text style={styles.clockInBtnText}>{busy ? 'Clocking in…' : 'Clock in'}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View>
        <Text style={styles.sectionLabel}>Recent shifts</Text>
        {history === null ? (
          <ActivityIndicator color={theme.colors.wyldPurple} />
        ) : history.length === 0 ? (
          <Text style={styles.dim}>Nothing logged yet — punch in to start.</Text>
        ) : (
          <View style={styles.list}>
            {history.map((e) => {
              const isOpen = !e.clock_out_at;
              const ms = totalMs(e, now);
              return (
                <View key={e.id} style={styles.row}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowDate}>
                      {new Date(e.clock_in_at).toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {new Date(e.clock_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {e.clock_out_at
                        ? new Date(e.clock_out_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                        : 'open'}
                      {locLabel(e.location_id) ? `  ·  ${locLabel(e.location_id)}` : ''}
                      {e.edited_at ? '  ·  edited' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.rowHours, isOpen && { color: '#15803D' }]}>
                    {fmtDuration(ms)}
                  </Text>
                </View>
              );
            })}
            <LoadMoreSentinel loading={loading} hasMore={hasMore} onLoadMore={loadMore} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16, maxWidth: 720 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  empty: { gap: 8, padding: 24 },
  body: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 21 },
  err: { color: theme.colors.danger, fontSize: 13 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },

  bigCard: {
    padding: 24, gap: 12,
    borderRadius: theme.radius.lg, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center',
  },
  bigCardOpen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#15803D',
  },
  bigLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  timer: { fontSize: 48, fontWeight: '900', color: '#15803D', fontVariant: ['tabular-nums'] as any },
  bigMeta: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' },

  locPicker: { width: '100%', maxWidth: 320, gap: 4 },
  locPickerLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  clockInBtn: {
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 999, backgroundColor: '#15803D',
    marginTop: 4,
  },
  clockInBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  clockOutBtn: {
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 999, backgroundColor: theme.colors.danger,
    marginTop: 4,
  },
  clockOutBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  list: { gap: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  rowDate: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  rowMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  rowHours: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal, fontVariant: ['tabular-nums'] as any },
});
