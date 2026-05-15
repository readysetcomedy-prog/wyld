import { View, Text, StyleSheet } from 'react-native';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const JS_DAY_TO_KEY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type HoursMap = Partial<Record<DayKey, string>>;

export function hasAnyHours(hours: HoursMap | null | undefined) {
  if (!hours) return false;
  return DAY_KEYS.some((k) => (hours[k] ?? '').trim().length > 0);
}

export function GymHours({
  hours,
  primaryColor,
}: {
  hours: HoursMap;
  primaryColor?: string;
}) {
  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, primaryColor ? { color: primaryColor } : null]}>Hours</Text>
      <View style={styles.table}>
        {DAY_KEYS.map((k) => {
          const value = hours[k]?.trim();
          const isToday = k === todayKey;
          const isClosed = !value;
          return (
            <View
              key={k}
              style={[styles.row, isToday && { backgroundColor: '#f8fafc' }]}
            >
              <View style={styles.dayWrap}>
                <Text style={[styles.day, isToday && { color: primaryColor || '#0F172A' }]}>
                  {DAY_LABELS[k]}
                </Text>
                {isToday ? (
                  <View style={[styles.todayPill, { backgroundColor: primaryColor || '#0F172A' }]}>
                    <Text style={styles.todayPillText}>Today</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.time, isClosed && styles.timeClosed, isToday && styles.timeBold]}>
                {value || 'Closed'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, width: '100%' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', letterSpacing: 0.2 },
  table: { gap: 2 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dayWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  day: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayPillText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  time: { fontSize: 15, color: '#334155', fontVariant: ['tabular-nums'] },
  timeBold: { fontWeight: '700', color: '#0F172A' },
  timeClosed: { color: '#94a3b8', fontStyle: 'italic' },
});
