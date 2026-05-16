import { View, Text, Pressable, StyleSheet } from 'react-native';

// Date helpers (Monday-start weeks).
export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function dateKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthCalendar({
  monthAnchor,
  onMonthChange,
  today,
  selectedWeekStart,
  countForDay,
  onDayPress,
  onWeekPress,
  compact,
  primary = '#0F172A',
  accent = '#7C3AED',
}: {
  monthAnchor: Date;
  onMonthChange: (d: Date) => void;
  today: Date;
  selectedWeekStart: Date | null;
  countForDay: (d: Date) => number;
  onDayPress: (d: Date) => void;
  onWeekPress: (weekStart: Date) => void;
  compact?: boolean;
  primary?: string;
  accent?: string;
}) {
  const gridStart = startOfWeek(startOfMonth(monthAnchor));
  const rowStarts = Array.from({ length: 6 }, (_, r) => addDays(gridStart, r * 7));
  const monthLabel = monthAnchor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={() => onMonthChange(addMonths(monthAnchor, -1))} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </Pressable>
        <Text style={[styles.title, { color: primary }]}>{monthLabel}</Text>
        <Pressable onPress={() => onMonthChange(addMonths(monthAnchor, 1))} style={styles.navBtn}>
          <Text style={styles.navBtnText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.dowRow}>
        <View style={styles.weekCol} />
        {DOW.map((d) => (
          <Text key={d} style={styles.dowText}>
            {compact ? d[0] : d}
          </Text>
        ))}
      </View>

      {rowStarts.map((rowStart) => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(rowStart, i));
        const isSelWeek =
          selectedWeekStart != null && isSameDay(rowStart, selectedWeekStart);
        return (
          <View key={rowStart.toISOString()} style={styles.weekRow}>
            <Pressable
              onPress={() => onWeekPress(rowStart)}
              style={[
                styles.weekBtn,
                isSelWeek && { backgroundColor: accent, borderColor: accent },
              ]}
              accessibilityLabel="View this whole week"
            >
              <Text style={[styles.weekBtnText, isSelWeek && { color: '#fff' }]}>»</Text>
            </Pressable>
            {days.map((d) => {
              const inMonth = d.getMonth() === monthAnchor.getMonth();
              const isToday = isSameDay(d, today);
              const inSelWeek = isSelWeek;
              const count = countForDay(d);
              return (
                <Pressable
                  key={d.toISOString()}
                  onPress={() => onDayPress(d)}
                  style={[styles.cell, inSelWeek && styles.cellInWeek]}
                >
                  <View style={styles.cellInner}>
                    <Text
                      style={[
                        styles.cellNum,
                        !inMonth && styles.cellNumOut,
                        isToday && { color: primary, fontWeight: '900' },
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                    {count > 0 ? (
                      <View style={[styles.countPill, { backgroundColor: accent }]}>
                        <Text style={styles.countPillText}>{count}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const WEEK_COL = 30;

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '800' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navBtnText: { fontSize: 18, color: '#0F172A', fontWeight: '700', lineHeight: 18 },

  dowRow: { flexDirection: 'row' },
  weekCol: { width: WEEK_COL },
  dowText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    paddingVertical: 4,
  },

  weekRow: { flexDirection: 'row', alignItems: 'stretch' },
  weekBtn: {
    width: WEEK_COL,
    margin: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  weekBtnText: { fontSize: 16, fontWeight: '900', color: '#94a3b8' },

  cell: { flex: 1, aspectRatio: 1, padding: 3 },
  cellInWeek: { },
  cellInner: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellNum: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  cellNumOut: { color: '#cbd5e1' },
  countPill: { minWidth: 16, paddingHorizontal: 4, borderRadius: 999 },
  countPillText: { color: '#fff', fontSize: 9, fontWeight: '800', textAlign: 'center' },
});
