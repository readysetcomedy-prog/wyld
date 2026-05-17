import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { TabPlaceholder } from '@/components/TabPlaceholder';
import { WaiversManager } from '@/components/WaiversManager';

const TABS = [
  { key: 'waivers', label: 'Waivers' },
  { key: 'forms', label: 'Forms' },
  { key: 'time-zone', label: 'Time Zone' },
];

export default function Settings() {
  const { profile } = useAuth();
  const gymId = profile?.gym_id ?? null;
  const [active, setActive] = useState('waivers');

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Configure your gym&apos;s account-level options.</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActive(t.key)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {active === 'waivers' ? (
        gymId ? (
          <WaiversManager gymId={gymId} />
        ) : (
          <Text style={styles.dim}>Your account isn&apos;t linked to a gym yet.</Text>
        )
      ) : null}

      {active === 'forms' ? (
        <View style={styles.body}>
          <TabPlaceholder
            title="Forms"
            body="Custom intake forms, member surveys, and post-class feedback."
          />
        </View>
      ) : null}

      {active === 'time-zone' ? (
        <View style={styles.body}>
          <TabPlaceholder
            title="Time Zone"
            body="Set the time zone used for your schedule, bookings, and exports."
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: theme.spacing.lg },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.charcoal },
  sub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  dim: { fontSize: 13, color: theme.colors.textSecondary, fontStyle: 'italic' },
  tabsRow: { flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: 4 },
  tab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  tabActive: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  tabTextActive: { color: '#fff' },
  body: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
});
