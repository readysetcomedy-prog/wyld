// Per-location schedule settings — required coverage hours and the
// "employees can view through" cutoff date. Saves directly to gym_locations.

import { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, TextInput,
  useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { Location } from './types';
import { DateTimeField } from '@/components/DateTimeField';

type Props = {
  visible: boolean;
  location: Location | null;
  onClose: (saved: boolean) => void;
};

export function LocationSettingsModal({ visible, location, onClose }: Props) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [requiredHours, setRequiredHours] = useState('0');
  const [visibleUntil, setVisibleUntil] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (location) {
      setRequiredHours(String(location.sched_required_hours ?? 0));
      setVisibleUntil(location.sched_visible_until_date ?? '');
    }
    setErr(null);
  }, [location, visible]);

  async function save() {
    if (!location) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from('gym_locations')
      .update({
        sched_required_hours: parseFloat(requiredHours) || 0,
        sched_visible_until_date: visibleUntil || null,
      })
      .eq('id', location.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onClose(true);
  }

  return (
    <Modal visible={visible} transparent animationType={isWide ? 'fade' : 'slide'}>
      <View style={[styles.overlay, isWide && styles.overlayWide]}>
        <View style={[styles.sheet, isWide && styles.sheetWide]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {location?.label ?? ''} — Schedule Settings
            </Text>
            <Pressable onPress={() => onClose(false)}><Text style={styles.x}>×</Text></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>Coverage</Text>
            <Text style={styles.fieldLabel}>Required Hours Per Day</Text>
            <TextInput
              style={styles.input}
              value={requiredHours}
              onChangeText={setRequiredHours}
              keyboardType="decimal-pad"
              placeholder="e.g. 24 for full-day coverage"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.hint}>
              Total scheduled hours per day needed to count as fully staffed.
              Coverage pills go green at or above this; otherwise they show
              the gap.
            </Text>

            <Text style={styles.sectionLabel}>Employee Visibility</Text>
            <Text style={styles.fieldLabel}>Employees can view schedule until</Text>
            <DateTimeField
              mode="date"
              value={visibleUntil ? new Date(visibleUntil + 'T00:00:00') : null}
              onChange={(d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setVisibleUntil(`${y}-${m}-${day}`);
              }}
              placeholder="No limit"
            />
            <Text style={styles.hint}>
              Employees will not see this location's shifts beyond this date.
              Leave blank to show all future dates.
            </Text>

            {err ? <Text style={styles.err}>{err}</Text> : null}

            <Pressable style={[styles.saveBtn, saving && styles.saveBtnBusy]} disabled={saving} onPress={save}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  overlayWide: { justifyContent: 'center', alignItems: 'center' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '85%',
  },
  sheetWide: { width: 460, borderRadius: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal, flex: 1, marginRight: 8 },
  x: { fontSize: 26, color: theme.colors.textSecondary, lineHeight: 26 },
  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.wyldPurple,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.charcoal,
    backgroundColor: '#fff', marginBottom: 6,
  },
  hint: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17, marginBottom: 12 },
  err: { color: theme.colors.danger, fontSize: 13, marginBottom: 8 },
  saveBtn: {
    backgroundColor: theme.colors.wyldPurple, borderRadius: theme.radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 8,
  },
  saveBtnBusy: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
