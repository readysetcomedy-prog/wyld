// Account-level settings for regular members. Hosts Notifications and
// will collect any future per-member account toggles (privacy, password,
// linked accounts, etc.) so the Profile tab stays focused on the public
// "who I am" surface and Settings owns the private knobs.

import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { TabPlaceholder } from '@/components/TabPlaceholder';

const TABS = [
  { key: 'notifications', label: 'Notifications' },
];

export default function MemberSettings() {
  const [active, setActive] = useState('notifications');

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Account-level preferences for your WyLD profile.</Text>
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

      {active === 'notifications' ? (
        <View style={styles.body}>
          <TabPlaceholder
            title="Notifications"
            body="Pick which alerts you want — class reminders, new messages from your gyms, billing notices, job-application updates, waiver requests, and product updates. Per-channel (email / push / in-app) toggles will land here once we wire the notification pipeline."
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
