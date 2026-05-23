// Audit-log view of every create/update/delete/swap/rotation event on this
// gym's schedule. Searchable by employee name; optionally filtered to a
// single day when opened from a calendar cell.

import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, FlatList,
} from 'react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { EmployeeOption, Location } from './types';
import { formatTimeDisplay } from './utils';

type HistoryRow = {
  id: string;
  shift_id: string | null;
  action_type: string;
  employee_id: string | null;
  location_id: string | null;
  gym_id: string;
  changed_by_user_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
};

type Props = {
  visible: boolean;
  gymId: string;
  employees: EmployeeOption[];
  locations: Location[];
  filterDate?: string | null;
  onClose: () => void;
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  swapped: 'Swapped',
  rotation_created: 'Rotation',
};

const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  created: { bg: '#ECFDF5', fg: '#15803D' },
  updated: { bg: '#F5F3FF', fg: theme.colors.wyldPurpleDark },
  deleted: { bg: '#FEF2F2', fg: theme.colors.danger },
  swapped: { bg: '#FFFBEB', fg: '#B45309' },
  rotation_created: { bg: '#ECFEFF', fg: '#0E7490' },
};

function fmtTime(v: unknown): string {
  if (typeof v !== 'string') return '';
  return formatTimeDisplay(v.substring(0, 5));
}
function fmtTimeRange(start: unknown, end: unknown, nd?: unknown): string {
  const s = fmtTime(start);
  const e = fmtTime(end);
  if (!s || !e) return '';
  return `${s} – ${e}${nd ? ' (+1)' : ''}`;
}
function fmtTs(ts: string): string {
  const d = new Date(ts);
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const y0 = new Date(t0.getTime() - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (dDay.getTime() === t0.getTime()) return `Today at ${time}`;
  if (dDay.getTime() === y0.getTime()) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
}

export function ScheduleHistoryPanel({
  visible, gymId, employees, locations, filterDate, onClose,
}: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!gymId) return;
    setLoading(true);
    const { data } = await supabase
      .from('schedule_history')
      .select('*')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(300);
    let list = (data as HistoryRow[]) ?? [];
    if (filterDate) {
      list = list.filter((r) => {
        const nvDate = (r.new_values as any)?.shift_date as string | undefined;
        const ovDate = (r.old_values as any)?.shift_date as string | undefined;
        return nvDate === filterDate || ovDate === filterDate;
      });
    }
    setRows(list);
    setLoading(false);
  }, [gymId, filterDate]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const getEmp = (id: string | null) => id ? employees.find((e) => e.id === id) : null;
  const getLoc = (id: string | null) => id ? locations.find((l) => l.id === id) : null;

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const e = getEmp(r.employee_id);
    return e?.full_name.toLowerCase().includes(search.toLowerCase());
  });

  function renderDetail(row: HistoryRow) {
    const { action_type, old_values: ov, new_values: nv, notes } = row;
    switch (action_type) {
      case 'created':
      case 'rotation_created':
        if (!nv) return null;
        return <Text style={styles.detail}>{fmtTimeRange(nv.start_time, nv.end_time, nv.is_next_day)}</Text>;
      case 'updated':
        if (!ov || !nv) return null;
        return (
          <View>
            <Text style={styles.detailOld}>{fmtTimeRange(ov.start_time, ov.end_time, ov.is_next_day)}</Text>
            <Text style={styles.detail}>{fmtTimeRange(nv.start_time, nv.end_time, nv.is_next_day)}</Text>
          </View>
        );
      case 'deleted':
        return (
          <View>
            {ov ? <Text style={styles.detailOld}>{fmtTimeRange(ov.start_time, ov.end_time, ov.is_next_day)}</Text> : null}
            {notes ? <Text style={styles.detailReason}>Reason: {notes}</Text> : null}
          </View>
        );
      case 'swapped':
        if (!ov || !nv) return null;
        return <Text style={styles.detail}>Employee swap (with another shift)</Text>;
      default:
        return null;
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Schedule History</Text>
              {filterDate ? (
                <Text style={styles.titleSub}>
                  {new Date(filterDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose}><Text style={styles.x}>×</Text></Pressable>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by employee name..."
              placeholderTextColor="#94a3b8"
            />
          </View>

          {loading ? (
            <View style={styles.center}><ActivityIndicator color={theme.colors.wyldPurple} /></View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}><Text style={styles.empty}>No history found.</Text></View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => {
                const emp = getEmp(item.employee_id);
                const loc = getLoc(item.location_id);
                const cfg = ACTION_COLORS[item.action_type] ?? ACTION_COLORS.updated;
                const lbl = ACTION_LABELS[item.action_type] ?? item.action_type;
                return (
                  <View style={styles.row}>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.badgeText, { color: cfg.fg }]}>{lbl}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowEmp}>{emp?.full_name ?? 'Unknown'}</Text>
                        {emp?.position ? <Text style={styles.rowPos}>· {emp.position}</Text> : null}
                      </View>
                      {loc ? <Text style={styles.rowLoc}>{loc.label}</Text> : null}
                      {renderDetail(item)}
                      <Text style={styles.rowTs}>{fmtTs(item.created_at)}</Text>
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={styles.list}
            />
          )}

          <View style={styles.footer}>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  titleSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: theme.colors.charcoal,
    backgroundColor: theme.colors.surface,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { color: theme.colors.textSecondary, fontStyle: 'italic' },

  list: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    minWidth: 70, alignItems: 'center',
  },
  badgeText: { fontWeight: '800', fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' },
  rowEmp: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  rowPos: { fontSize: 12, color: theme.colors.textSecondary },
  rowLoc: { fontSize: 12, color: theme.colors.wyldPurple, fontWeight: '700', marginTop: 1 },
  detail: { fontSize: 13, fontWeight: '600', color: theme.colors.charcoal, marginTop: 2 },
  detailOld: { fontSize: 12, color: theme.colors.textSecondary, textDecorationLine: 'line-through', marginTop: 2 },
  detailReason: { fontSize: 12, color: theme.colors.danger, fontStyle: 'italic', marginTop: 2 },
  rowTs: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  closeBtn: { backgroundColor: theme.colors.surface, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  closeBtnText: { fontWeight: '800', color: theme.colors.charcoal },
});
