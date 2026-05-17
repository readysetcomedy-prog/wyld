import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { Select } from '@/components/Select';

// Cross-platform date / date-time picker. No DOM <input>, no native module —
// a Pressable that opens a Modal with a month grid and (for datetime) time
// selectors. Works on web and native.

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function gridStart(monthAnchor: Date) {
  const first = startOfMonth(monthAnchor);
  return addDays(first, -((first.getDay() + 6) % 7));
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DateTimeField({
  value,
  onChange,
  mode = 'datetime',
  placeholder = 'Pick a date',
}: {
  value: Date | null;
  onChange: (d: Date) => void;
  mode?: 'date' | 'datetime';
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? defaultDate());
  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(value ?? defaultDate()));

  useEffect(() => {
    if (open) {
      const v = value ?? defaultDate();
      setDraft(v);
      setMonthAnchor(startOfMonth(v));
    }
  }, [open, value]);

  const cells = useMemo(() => {
    const gs = gridStart(monthAnchor);
    return Array.from({ length: 42 }, (_, i) => addDays(gs, i));
  }, [monthAnchor]);

  const hour12 = ((draft.getHours() + 11) % 12) + 1;
  const ampm = draft.getHours() >= 12 ? 'PM' : 'AM';

  function setHour(h12: number, ap: string) {
    const h = ap === 'PM' ? (h12 % 12) + 12 : h12 % 12;
    const d = new Date(draft);
    d.setHours(h);
    setDraft(d);
  }
  function setMinute(m: number) {
    const d = new Date(draft);
    d.setMinutes(m);
    setDraft(d);
  }

  const label = value
    ? mode === 'datetime'
      ? value.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : value.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text style={[styles.triggerText, !value && styles.placeholder]}>{label}</Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.calHead}>
              <Pressable
                style={styles.navBtn}
                onPress={() => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              >
                <Text style={styles.navBtnText}>‹</Text>
              </Pressable>
              <Text style={styles.calTitle}>
                {MONTHS[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
              </Text>
              <Pressable
                style={styles.navBtn}
                onPress={() => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              >
                <Text style={styles.navBtnText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.dowRow}>
              {DOW.map((d, i) => (
                <Text key={i} style={styles.dowText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {cells.map((d) => {
                const inMonth = d.getMonth() === monthAnchor.getMonth();
                const selected = sameDay(d, draft);
                return (
                  <Pressable
                    key={d.toISOString()}
                    style={styles.cell}
                    onPress={() => {
                      const next = new Date(draft);
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setDraft(next);
                    }}
                  >
                    <View style={[styles.cellInner, selected && styles.cellSel]}>
                      <Text
                        style={[
                          styles.cellText,
                          !inMonth && styles.cellTextOut,
                          selected && styles.cellTextSel,
                        ]}
                      >
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'datetime' ? (
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Time</Text>
                <Select
                  value={String(hour12)}
                  onChange={(v) => setHour(parseInt(v, 10), ampm)}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i + 1),
                    label: String(i + 1),
                  }))}
                  ariaLabel="Hour"
                />
                <Select
                  value={String(draft.getMinutes() - (draft.getMinutes() % 5))}
                  onChange={(v) => setMinute(parseInt(v, 10))}
                  options={Array.from({ length: 12 }, (_, i) => ({
                    value: String(i * 5),
                    label: String(i * 5).padStart(2, '0'),
                  }))}
                  ariaLabel="Minute"
                />
                <Select
                  value={ampm}
                  onChange={(v) => setHour(hour12, v)}
                  options={[
                    { value: 'AM', label: 'AM' },
                    { value: 'PM', label: 'PM' },
                  ]}
                  ariaLabel="AM or PM"
                />
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.doneBtn}
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
              >
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function defaultDate() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  triggerText: { fontSize: 14, color: theme.colors.charcoal, flexShrink: 1 },
  placeholder: { color: '#94a3b8' },
  icon: { fontSize: 14 },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { fontSize: 18, fontWeight: '700', color: theme.colors.charcoal, lineHeight: 18 },
  dowRow: { flexDirection: 'row' },
  dowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellSel: { backgroundColor: theme.colors.wyldPurple },
  cellText: { fontSize: 13, fontWeight: '600', color: theme.colors.charcoal },
  cellTextOut: { color: '#cbd5e1' },
  cellTextSel: { color: '#fff', fontWeight: '900' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  timeLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },

  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: theme.colors.wyldPurple,
  },
  doneText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
