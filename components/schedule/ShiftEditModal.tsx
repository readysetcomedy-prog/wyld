// Edit / delete one shift. Delete requires a reason; non-"Error in Entry"
// reasons are also recorded as absences so the schedule shows what happened.

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { theme } from '@/lib/theme';
import { TimePicker } from './TimePicker';
import { calcShiftHours, detectNextDay, hasConflict } from './utils';
import {
  ScheduleShift, EmployeeOption, Location, DeleteReason, DELETE_REASONS,
} from './types';

type Props = {
  visible: boolean;
  shift: ScheduleShift | null;
  location: Location | null;
  employee: EmployeeOption | null;
  allShifts: ScheduleShift[];
  onSave: (updated: Partial<ScheduleShift>) => Promise<void>;
  onDelete: (shiftId: string, reason: DeleteReason) => Promise<void>;
  onClose: () => void;
};

export function ShiftEditModal({
  visible, shift, location, employee, allShifts, onSave, onDelete, onClose,
}: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('20:00');
  const [isNextDay, setIsNextDay] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState<DeleteReason | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [conflict, setConflict] = useState('');

  useEffect(() => {
    if (shift) {
      setStartTime(shift.start_time.substring(0, 5));
      setEndTime(shift.end_time.substring(0, 5));
      setIsNextDay(shift.is_next_day);
      setShowDelete(false);
      setDeleteReason(null);
      setConflict('');
    }
  }, [shift]);

  if (!shift || !visible) return null;

  const hours = calcShiftHours(startTime, endTime, isNextDay);

  async function handleSave() {
    if (!shift) return;
    const conflicted = hasConflict(allShifts, shift.employee_id, shift.shift_date, startTime, endTime, isNextDay, shift.id);
    if (conflicted) { setConflict('This employee already has an overlapping shift on this date.'); return; }
    setSaving(true);
    await onSave({ id: shift.id, start_time: startTime, end_time: endTime, is_next_day: isNextDay });
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!shift || !deleteReason) return;
    setDeleting(true);
    await onDelete(shift.id, deleteReason);
    setDeleting(false);
    onClose();
  }

  return (
    <Modal visible transparent animationType={isWide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.overlay, isWide && styles.overlayWide]}>
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Edit Shift</Text>
              {location ? <Text style={styles.sub}>{location.label}</Text> : null}
            </View>
            <Pressable onPress={onClose}><Text style={styles.x}>×</Text></Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.empCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{employee?.full_name ?? 'Unknown'}</Text>
                {employee?.position ? <Text style={styles.empPos}>{employee.position}</Text> : null}
              </View>
              <Text style={styles.shiftDate}>{shift.shift_date}</Text>
            </View>

            <Text style={styles.sectionLabel}>Shift Times</Text>
            <View style={styles.timesRow}>
              <View style={{ flex: 1 }}>
                <TimePicker label="Start" value={startTime} onChange={(t) => {
                  setStartTime(t); setConflict('');
                  if (detectNextDay(t, endTime)) setIsNextDay(true);
                }} />
              </View>
              <View style={{ flex: 1 }}>
                <TimePicker label="End" value={endTime} onChange={(t) => {
                  setEndTime(t); setConflict('');
                  if (detectNextDay(startTime, t)) setIsNextDay(true);
                }} />
              </View>
            </View>

            <Text style={styles.hoursText}>{hours.toFixed(1)} hrs</Text>

            <Pressable
              style={[styles.overnightToggle, isNextDay && styles.overnightToggleActive]}
              onPress={() => setIsNextDay((v) => !v)}
            >
              <Text style={[styles.overnightToggleText, isNextDay && styles.overnightToggleTextActive]}>
                {isNextDay ? '🌙 Overnight (end is next day)' : '☀️ Same day'}
              </Text>
            </Pressable>

            {conflict ? <Text style={styles.err}>{conflict}</Text> : null}

            {!showDelete ? (
              <Pressable style={styles.deleteToggle} onPress={() => setShowDelete(true)}>
                <Text style={styles.deleteToggleText}>Delete Shift</Text>
              </Pressable>
            ) : (
              <View style={styles.deletePanel}>
                <Text style={styles.deletePanelLabel}>Select Reason</Text>
                {DELETE_REASONS.map((r) => (
                  <Pressable key={r} style={styles.reasonRow} onPress={() => setDeleteReason(r)}>
                    <View style={[styles.radio, deleteReason === r && styles.radioActive]} />
                    <Text style={[styles.reasonText, deleteReason === r && styles.reasonTextActive]}>{r}</Text>
                  </Pressable>
                ))}
                <View style={styles.deleteActions}>
                  <Pressable
                    style={styles.cancelDelBtn}
                    onPress={() => { setShowDelete(false); setDeleteReason(null); }}
                  >
                    <Text style={styles.cancelDelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmDelBtn, (!deleteReason || deleting) && styles.btnDisabled]}
                    disabled={!deleteReason || deleting}
                    onPress={handleDelete}
                  >
                    {deleting ? <ActivityIndicator color="#fff" /> : (
                      <Text style={styles.confirmDelText}>Confirm Delete</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          {!showDelete && (
            <View style={styles.footer}>
              <Pressable style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleSave}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  overlayWide: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  sheetWide: { width: 480, borderRadius: 24, maxHeight: '85%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },
  body: { paddingHorizontal: 20 },

  empCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F5F3FF', borderRadius: 12, padding: 14, marginTop: 16,
  },
  empName: { fontSize: 16, fontWeight: '800', color: theme.colors.charcoal },
  empPos: { fontSize: 12, color: theme.colors.wyldPurpleDark, marginTop: 2 },
  shiftDate: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },

  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 10,
  },
  timesRow: { flexDirection: 'row', gap: 12 },
  hoursText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 10 },

  overnightToggle: {
    marginTop: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff',
    alignItems: 'center',
  },
  overnightToggleActive: { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.charcoal },
  overnightToggleText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  overnightToggleTextActive: { color: '#fff' },

  err: { color: theme.colors.danger, fontSize: 13, marginTop: 10 },

  deleteToggle: { marginTop: 20, paddingVertical: 10, alignSelf: 'flex-start' },
  deleteToggleText: { color: theme.colors.danger, fontWeight: '700', fontSize: 14 },

  deletePanel: { marginTop: 20, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16 },
  deletePanelLabel: { fontSize: 14, fontWeight: '800', color: theme.colors.danger, marginBottom: 12 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#FECACA',
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: theme.colors.border },
  radioActive: { borderColor: theme.colors.danger, backgroundColor: theme.colors.danger },
  reasonText: { fontSize: 14, color: theme.colors.charcoal, flex: 1 },
  reasonTextActive: { fontWeight: '800', color: theme.colors.danger },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelDelBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  cancelDelText: { fontWeight: '700', color: theme.colors.charcoal },
  confirmDelBtn: { flex: 2, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.colors.danger, alignItems: 'center' },
  confirmDelText: { color: '#fff', fontWeight: '800' },

  footer: {
    flexDirection: 'row', gap: 12, padding: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', color: theme.colors.charcoal },
  saveBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: theme.colors.wyldPurple, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },

  btnDisabled: { opacity: 0.5 },
});
