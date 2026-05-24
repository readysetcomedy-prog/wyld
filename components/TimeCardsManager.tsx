// Manager-side time cards. Sits under Employees → Time Cards (in both
// the owner roster and /admin/employees for WyLD staff). Lists every
// employee at the gym with their hours in the current pay period, plus
// an expand-to-edit per-shift detail view.
//
// Edits stamp edited_by + edited_at on the row so payroll can audit
// "this entry was adjusted by manager X at time Y" later.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, TextInput, Modal, ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';

type Employee = { id: string; full_name: string; position: string | null };
type Entry = {
  id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  location_id: string | null;
  notes: string | null;
  edited_at: string | null;
};

type PeriodKey = 'this_week' | 'last_week' | 'this_month';

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Monday-start
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function fmtHours(ms: number) {
  return (ms / 3_600_000).toFixed(2);
}
function fmtRange(s: Date, e: Date) {
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${
    e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }`;
}
function isoLocal(dt: Date): string {
  // YYYY-MM-DDTHH:MM for use in a datetime-local input. Strips seconds + tz.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function TimeCardsManager({ gymId }: { gymId: string }) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('this_week');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Entry | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [periodStart, periodEnd] = useMemo(() => {
    const today = new Date();
    if (period === 'this_week') {
      const s = startOfWeek(today);
      return [s, addDays(s, 7)];
    }
    if (period === 'last_week') {
      const s = addDays(startOfWeek(today), -7);
      return [s, addDays(s, 7)];
    }
    const s = startOfMonth(today);
    return [s, new Date(today.getFullYear(), today.getMonth() + 1, 1)];
  }, [period]);

  const load = useCallback(async () => {
    if (!gymId) return;
    setErr(null);
    const [{ data: emps }, { data: ents, error: entErr }] = await Promise.all([
      supabase
        .from('gym_employees')
        .select('id, full_name, position, terminate_date')
        .eq('gym_id', gymId)
        .order('full_name'),
      supabase
        .from('time_card_entries')
        .select('id, employee_id, clock_in_at, clock_out_at, location_id, notes, edited_at')
        .eq('gym_id', gymId)
        .gte('clock_in_at', periodStart.toISOString())
        .lt('clock_in_at', periodEnd.toISOString())
        .order('clock_in_at', { ascending: false }),
    ]);
    if (entErr) setErr(entErr.message);
    const today = new Date().toISOString().slice(0, 10);
    setEmployees(
      (((emps as any[]) ?? []) as any[])
        .filter((e) => !e.terminate_date || e.terminate_date > today)
        .map((e) => ({ id: e.id, full_name: e.full_name, position: e.position })),
    );
    setEntries((ents as Entry[]) ?? []);
  }, [gymId, periodStart, periodEnd]);

  useEffect(() => { load(); }, [load]);

  const entriesByEmp = useMemo(() => {
    const m = new Map<string, Entry[]>();
    entries.forEach((e) => {
      const list = m.get(e.employee_id) ?? [];
      list.push(e);
      m.set(e.employee_id, list);
    });
    return m;
  }, [entries]);

  function durationMs(e: Entry): number {
    const start = new Date(e.clock_in_at).getTime();
    const end = e.clock_out_at ? new Date(e.clock_out_at).getTime() : now;
    return Math.max(0, end - start);
  }
  function totalForEmp(empId: string): number {
    return (entriesByEmp.get(empId) ?? []).reduce((s, e) => s + durationMs(e), 0);
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveEdit(updated: { id: string; clock_in_at: string; clock_out_at: string | null; notes: string | null }) {
    setErr(null);
    const { error } = await supabase
      .from('time_card_entries')
      .update({
        clock_in_at: updated.clock_in_at,
        clock_out_at: updated.clock_out_at,
        notes: updated.notes,
        edited_at: new Date().toISOString(),
      })
      .eq('id', updated.id);
    if (error) { setErr(error.message); return; }
    setEditing(null);
    load();
  }

  async function deleteEntry(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this shift?')) return;
    await supabase.from('time_card_entries').delete().eq('id', id);
    load();
  }

  if (employees === null) return <ActivityIndicator color={theme.colors.wyldPurple} />;

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Time Cards</Text>
        <Text style={styles.sub}>
          Clock-ins logged via the employee Time Clock. Click a name to see and edit individual shifts.
          {' '}Showing {fmtRange(periodStart, addDays(periodEnd, -1))}.
        </Text>
      </View>

      <View style={styles.chipRow}>
        {(['this_week', 'last_week', 'this_month'] as const).map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, period === p && styles.chipOn]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextOn]}>
              {p === 'this_week' ? 'This week' : p === 'last_week' ? 'Last week' : 'This month'}
            </Text>
          </Pressable>
        ))}
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      {employees.length === 0 ? (
        <Text style={styles.dim}>No active employees yet.</Text>
      ) : (
        <View style={styles.list}>
          {employees.map((emp) => {
            const empEntries = entriesByEmp.get(emp.id) ?? [];
            const totalMs = totalForEmp(emp.id);
            const isOpen = empEntries.some((e) => !e.clock_out_at);
            const open = expanded.has(emp.id);
            return (
              <View key={emp.id} style={styles.empCard}>
                <Pressable style={styles.empHeader} onPress={() => toggle(emp.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>
                      {emp.full_name}
                      {isOpen ? <Text style={styles.openBadge}>  ● currently clocked in</Text> : null}
                    </Text>
                    <Text style={styles.empMeta}>
                      {emp.position || '—'}  ·  {empEntries.length} shift{empEntries.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={styles.totalHours}>{fmtHours(totalMs)} h</Text>
                    <Text style={styles.expand}>{open ? '▾' : '▸'}</Text>
                  </View>
                </Pressable>
                {open ? (
                  <View style={styles.entriesList}>
                    {empEntries.length === 0 ? (
                      <Text style={styles.dim}>No shifts in this period.</Text>
                    ) : (
                      empEntries.map((e) => (
                        <View key={e.id} style={styles.entryRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.entryDate}>
                              {new Date(e.clock_in_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            <Text style={styles.entryMeta}>
                              {new Date(e.clock_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              {' – '}
                              {e.clock_out_at
                                ? new Date(e.clock_out_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                                : 'open'}
                              {e.edited_at ? '  ·  edited' : ''}
                              {e.notes ? `  ·  ${e.notes}` : ''}
                            </Text>
                          </View>
                          <Text style={styles.entryHours}>{fmtHours(durationMs(e))} h</Text>
                          <Pressable style={styles.linkBtn} onPress={() => setEditing(e)}>
                            <Text style={styles.linkBtnText}>Edit</Text>
                          </Pressable>
                          <Pressable style={styles.linkBtn} onPress={() => deleteEntry(e.id)}>
                            <Text style={[styles.linkBtnText, { color: theme.colors.danger }]}>Delete</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <EditEntryModal entry={editing} onClose={() => setEditing(null)} onSave={saveEdit} />
    </View>
  );
}

function EditEntryModal({
  entry, onClose, onSave,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSave: (e: { id: string; clock_in_at: string; clock_out_at: string | null; notes: string | null }) => Promise<void>;
}) {
  const [inStr, setInStr] = useState('');
  const [outStr, setOutStr] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setInStr(isoLocal(new Date(entry.clock_in_at)));
    setOutStr(entry.clock_out_at ? isoLocal(new Date(entry.clock_out_at)) : '');
    setNotes(entry.notes ?? '');
    setErr(null);
  }, [entry?.id]);

  if (!entry) return null;

  async function submit() {
    setErr(null);
    const inDate = new Date(inStr);
    if (isNaN(inDate.getTime())) { setErr('Clock-in date is invalid.'); return; }
    let outDate: Date | null = null;
    if (outStr) {
      outDate = new Date(outStr);
      if (isNaN(outDate.getTime())) { setErr('Clock-out date is invalid.'); return; }
      if (outDate.getTime() <= inDate.getTime()) { setErr('Clock-out must be after clock-in.'); return; }
    }
    setSaving(true);
    await onSave({
      id: entry!.id,
      clock_in_at: inDate.toISOString(),
      clock_out_at: outDate ? outDate.toISOString() : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Edit shift</Text>
            <Pressable onPress={onClose}><Text style={modalStyles.x}>×</Text></Pressable>
          </View>
          <ScrollView>
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Clock-in</Text>
              <TextInput
                value={inStr}
                onChangeText={setInStr}
                placeholder="YYYY-MM-DDTHH:MM"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </View>
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Clock-out (blank = still open)</Text>
              <TextInput
                value={outStr}
                onChangeText={setOutStr}
                placeholder="YYYY-MM-DDTHH:MM"
                placeholderTextColor={theme.colors.textSecondary}
                style={modalStyles.input}
              />
            </View>
            <View style={modalStyles.field}>
              <Text style={modalStyles.fieldLabel}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Why this was adjusted, missed punch, etc."
                placeholderTextColor={theme.colors.textSecondary}
                multiline
                style={[modalStyles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              />
            </View>
            {err ? <Text style={modalStyles.err}>{err}</Text> : null}
            <View style={modalStyles.actionRow}>
              <Pressable
                style={[modalStyles.saveBtn, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={submit}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
              <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
                <Text style={modalStyles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 },
  err: { color: theme.colors.danger, fontSize: 13 },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic', fontSize: 13 },

  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  chipTextOn: { color: '#fff' },

  list: { gap: 8 },
  empCard: {
    borderRadius: theme.radius.lg, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden',
  },
  empHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  empName: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  openBadge: { color: '#15803D', fontSize: 11, fontWeight: '700' },
  empMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  totalHours: { fontSize: 18, fontWeight: '900', color: theme.colors.charcoal, fontVariant: ['tabular-nums'] as any },
  expand: { color: theme.colors.textSecondary, fontSize: 16 },

  entriesList: {
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    padding: 8, gap: 4, backgroundColor: theme.colors.surface,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 10, borderRadius: 8, backgroundColor: '#fff',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  entryDate: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  entryMeta: { fontSize: 11, color: theme.colors.textSecondary },
  entryHours: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal, fontVariant: ['tabular-nums'] as any },
  linkBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  linkBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 22, width: '100%', maxWidth: 480, maxHeight: '92%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal, flex: 1 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },
  field: { gap: 4, marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 14,
    color: theme.colors.charcoal, backgroundColor: '#fff',
  },
  err: { color: theme.colors.danger, fontSize: 13, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  saveBtn: { flex: 1, backgroundColor: theme.colors.wyldPurple, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  cancelBtnText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 14 },
});
