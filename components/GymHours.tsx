import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

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
  return (
    <View style={styles.container}>
      <Text style={[styles.title, primaryColor ? { color: primaryColor } : null]}>Hours</Text>
      <View style={styles.table}>
        {DAY_KEYS.map((k) => (
          <View key={k} style={styles.row}>
            <Text style={styles.day}>{DAY_LABELS[k]}</Text>
            <Text style={styles.time}>{hours[k]?.trim() || 'Closed'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, maxWidth: 460 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  table: { gap: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  day: { fontSize: 15, color: '#0F172A', fontWeight: '600' },
  time: { fontSize: 15, color: '#475569' },
});
