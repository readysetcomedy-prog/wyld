// Bulk-create shifts on an N-on / N-off rotation (e.g. 4-on / 4-off) over
// a date range. Skips dates where the chosen employee already has a
// conflicting shift.

import { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, TextInput,
  useWindowDimensions, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/lib/theme';
import { TimePicker } from './TimePicker';
import { DateTimeField } from '@/components/DateTimeField';
import { detectNextDay, hasConflict, toDateStr } from './utils';
import { EmployeeOption, Location, ScheduleShift } from './types';

interface PatternRow { daysOn: string; daysOff: string }

type Props = {
  visible: boolean;
  employees: EmployeeOption[];
  locations: Location[];
  gymId: string;
  allShifts: ScheduleShift[];
  currentUserId: string;
  onCreated: (
    newShifts: Omit<ScheduleShift, 'id' | 'created_at' | 'updated_at'>[]
  ) => Promise<void>;
  onClose: () => void;
};

export function RotationModal({
  visible, employees, locations, gymId, allShifts, currentUserId, onCreated, onClose,
}: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('20:00');
  const [isNextDay, setIsNextDay] = useState(false);
  const [patterns, setPatterns] = useState<PatternRow[]>([{ daysOn: '4', daysOff: '4' }]);
  const [empSearch, setEmpSearch] = useState('');
  const [locSearch, setLocSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneSummary, setDoneSummary] = useState<{ created: number; skipped: number } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('wyld_sched_default_times').then((raw) => {
      if (!raw) return;
      try {
        const v = JSON.parse(raw);
        if (v.start) setStartTime(v.start);
        if (v.end) setEndTime(v.end);
        if (typeof v.nextDay === 'boolean') setIsNextDay(v.nextDay);
      } catch {}
    });
  }, []);

  function saveDefaultTimes(s: string, e: string, nd: boolean) {
    AsyncStorage.setItem('wyld_sched_default_times', JSON.stringify({ start: s, end: e, nextDay: nd }));
  }

  function reset() {
    setSelectedLocation(null);
    setSelectedEmployee(null);
    setStartDate(''); setEndDate('');
    setPatterns([{ daysOn: '4', daysOff: '4' }]);
    setEmpSearch(''); setLocSearch('');
    setError(''); setDoneSummary(null);
  }

  function buildDates(): string[] {
    const out: string[] = [];
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;

    const totalDays = patterns.reduce(
      (sum, r) => sum + (parseInt(r.daysOn) || 0) + (parseInt(r.daysOff) || 0), 0,
    );
    if (totalDays === 0) return out;

    let cursor = new Date(start);
    let cyclePos = 0;
    while (cursor <= end) {
      let pos = cyclePos % totalDays;
      let workDay = false;
      for (const row of patterns) {
        const on = parseInt(row.daysOn) || 0;
        const off = parseInt(row.daysOff) || 0;
        if (pos < on) { workDay = true; break; }
        pos -= (on + off);
        if (pos < 0) break;
      }
      if (workDay) out.push(toDateStr(cursor));
      cursor = new Date(cursor.getTime() + 86400000);
      cyclePos++;
    }
    return out;
  }

  async function handleCreate() {
    setError('');
    if (!selectedLocation) { setError('Pick a location first.'); return; }
    if (!selectedEmployee) { setError('Pick an employee.'); return; }
    if (!startDate || !endDate) { setError('Pick start and end dates.'); return; }
    if (startDate > endDate) { setError('Start must be on or before end.'); return; }
    const dates = buildDates();
    if (dates.length === 0) { setError('No work days generated with this pattern.'); return; }

    setSaving(true);
    const nd = isNextDay || detectNextDay(startTime, endTime);
    const newShifts: Omit<ScheduleShift, 'id' | 'created_at' | 'updated_at'>[] = [];
    let skipped = 0;
    for (const d of dates) {
      if (hasConflict(allShifts, selectedEmployee.id, d, startTime, endTime, nd)) {
        skipped++;
        continue;
      }
      newShifts.push({
        gym_id: gymId,
        location_id: selectedLocation.id,
        employee_id: selectedEmployee.id,
        shift_date: d,
        start_time: startTime,
        end_time: endTime,
        is_next_day: nd,
        created_by: currentUserId,
      });
    }

    await onCreated(newShifts);
    setSaving(false);
    setDoneSummary({ created: newShifts.length, skipped });
  }

  const filteredLocations = locSearch.trim()
    ? locations.filter((l) => l.label.toLowerCase().includes(locSearch.toLowerCase()))
    : locations.slice(0, 8);

  const filteredEmployees = empSearch.trim()
    ? employees.filter((e) => e.full_name.toLowerCase().includes(empSearch.toLowerCase())).slice(0, 8)
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Rotation</Text>
            <Pressable onPress={() => { reset(); onClose(); }}><Text style={styles.x}>×</Text></Pressable>
          </View>

          {doneSummary ? (
            <View style={styles.doneBox}>
              <Text style={styles.doneTitle}>Rotation Created</Text>
              <Text style={styles.doneText}>
                {doneSummary.created} shifts added, {doneSummary.skipped} skipped due to conflicts.
              </Text>
              <Pressable style={styles.doneBtn} onPress={() => { reset(); onClose(); }}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
              <Text style={styles.sectionLabel}>Location</Text>
              {selectedLocation ? (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{selectedLocation.label}</Text>
                  <Pressable onPress={() => { setSelectedLocation(null); setSelectedEmployee(null); }}>
                    <Text style={styles.chipX}>×</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.searchInput}
                    value={locSearch}
                    onChangeText={setLocSearch}
                    placeholder="Search locations..."
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={styles.listBox}>
                    {filteredLocations.map((l) => (
                      <Pressable
                        key={l.id}
                        style={styles.listItem}
                        onPress={() => { setSelectedLocation(l); setLocSearch(''); }}
                      >
                        <Text style={styles.listItemText}>{l.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>Employee</Text>
              {!selectedLocation ? (
                <Text style={styles.hint}>Pick a location first.</Text>
              ) : selectedEmployee ? (
                <View style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{selectedEmployee.full_name}</Text>
                  <Pressable onPress={() => setSelectedEmployee(null)}><Text style={styles.chipX}>×</Text></Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.searchInput}
                    value={empSearch}
                    onChangeText={setEmpSearch}
                    placeholder="Search employees..."
                    placeholderTextColor="#94a3b8"
                  />
                  {filteredEmployees.length > 0 && (
                    <View style={styles.listBox}>
                      {filteredEmployees.map((e) => (
                        <Pressable
                          key={e.id}
                          style={styles.listItem}
                          onPress={() => { setSelectedEmployee(e); setEmpSearch(''); }}
                        >
                          <Text style={styles.listItemText}>{e.full_name}</Text>
                          {e.position ? <Text style={styles.listItemSub}>{e.position}</Text> : null}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {empSearch.trim().length === 0 && (
                    <Text style={styles.hint}>Type to search employees.</Text>
                  )}
                </>
              )}

              <Text style={styles.sectionLabel}>Date Range</Text>
              <View style={styles.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Start</Text>
                  <DateTimeField
                    mode="date"
                    value={startDate ? new Date(startDate + 'T00:00:00') : null}
                    onChange={(d) => setStartDate(toDateStr(d))}
                    placeholder="Pick start"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>End</Text>
                  <DateTimeField
                    mode="date"
                    value={endDate ? new Date(endDate + 'T00:00:00') : null}
                    onChange={(d) => setEndDate(toDateStr(d))}
                    placeholder="Pick end"
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Shift Times</Text>
              <View style={styles.timesRow}>
                <View style={{ flex: 1 }}>
                  <TimePicker label="Start" value={startTime} onChange={(t) => {
                    const nd = detectNextDay(t, endTime) || isNextDay;
                    setStartTime(t); setIsNextDay(nd);
                    saveDefaultTimes(t, endTime, nd);
                  }} />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePicker label="End" value={endTime} onChange={(t) => {
                    const nd = detectNextDay(startTime, t) || isNextDay;
                    setEndTime(t); setIsNextDay(nd);
                    saveDefaultTimes(startTime, t, nd);
                  }} />
                </View>
              </View>
              <Pressable
                style={[styles.overnightToggle, isNextDay && styles.overnightToggleActive]}
                onPress={() => { const nd = !isNextDay; setIsNextDay(nd); saveDefaultTimes(startTime, endTime, nd); }}
              >
                <Text style={[styles.overnightToggleText, isNextDay && styles.overnightToggleTextActive]}>
                  {isNextDay ? '🌙 Overnight (end is next day)' : '☀️ Same day'}
                </Text>
              </Pressable>

              <Text style={styles.sectionLabel}>Rotation Pattern</Text>
              <Text style={styles.hint}>Each row is one cycle block. The full cycle repeats over the date range.</Text>
              {patterns.map((row, i) => (
                <View key={i} style={styles.patternRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Days On</Text>
                    <TextInput
                      style={styles.input}
                      value={row.daysOn}
                      onChangeText={(v) => setPatterns((p) => p.map((r, idx) => idx === i ? { ...r, daysOn: v } : r))}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Days Off</Text>
                    <TextInput
                      style={styles.input}
                      value={row.daysOff}
                      onChangeText={(v) => setPatterns((p) => p.map((r, idx) => idx === i ? { ...r, daysOff: v } : r))}
                      keyboardType="numeric"
                    />
                  </View>
                  {patterns.length > 1 && (
                    <Pressable
                      style={styles.removeRow}
                      onPress={() => setPatterns((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Text style={styles.removeRowText}>−</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable style={styles.addRow} onPress={() => setPatterns((p) => [...p, { daysOn: '4', daysOff: '4' }])}>
                <Text style={styles.addRowText}>+ Add Pattern Row</Text>
              </Pressable>

              {error ? <Text style={styles.err}>{error}</Text> : null}

              <Pressable style={[styles.createBtn, saving && styles.btnDisabled]} disabled={saving} onPress={handleCreate}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Rotation</Text>}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 24, paddingHorizontal: 24, width: '100%', flex: 1, maxHeight: '92%',
  },
  sheetWide: { maxWidth: 520, borderRadius: 20, maxHeight: '88%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },
  hint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17, marginBottom: 6 },

  selectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F3FF', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, marginBottom: 4, alignSelf: 'flex-start',
  },
  selectedChipText: { fontWeight: '700', color: theme.colors.wyldPurple, fontSize: 14 },
  chipX: { color: theme.colors.wyldPurple, fontSize: 18, lineHeight: 18 },

  searchInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.colors.charcoal,
    marginBottom: 4, backgroundColor: '#fff',
  },
  listBox: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  listItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  listItemText: { fontSize: 14, color: theme.colors.charcoal },
  listItemSub: { fontSize: 11, color: theme.colors.textSecondary },

  dateRow: { flexDirection: 'row', gap: 12 },
  timesRow: { flexDirection: 'row', gap: 12 },

  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.charcoal,
    backgroundColor: '#fff', marginBottom: 8,
  },

  patternRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginBottom: 4 },
  removeRow: { width: 36, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  removeRowText: { color: theme.colors.danger, fontSize: 22, fontWeight: '800' },
  addRow: { paddingVertical: 8, marginBottom: 4 },
  addRowText: { color: theme.colors.wyldPurple, fontWeight: '700', fontSize: 13 },

  overnightToggle: {
    marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    alignItems: 'center', marginBottom: 4,
  },
  overnightToggleActive: { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.charcoal },
  overnightToggleText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  overnightToggleTextActive: { color: '#fff' },

  err: { color: theme.colors.danger, fontSize: 13, marginTop: 8 },

  createBtn: {
    backgroundColor: theme.colors.wyldPurple, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 12, marginBottom: 4,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  doneBox: { alignItems: 'center', paddingVertical: 32 },
  doneTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.tealDark, marginBottom: 8 },
  doneText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  doneBtn: {
    backgroundColor: theme.colors.wyldPurple, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  doneBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
