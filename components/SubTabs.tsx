import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { TabPlaceholder } from '@/components/TabPlaceholder';

export type SubTab = {
  key: string;
  label: string;
  body: string;
};

export function SubTabsPage({
  title,
  blurb,
  tabs,
}: {
  title: string;
  blurb: string;
  tabs: SubTab[];
}) {
  const [active, setActive] = useState(tabs[0].key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <View style={styles.root}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{blurb}</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {tabs.map((t) => {
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

      <View style={styles.body}>
        <TabPlaceholder title={activeTab.label} body={activeTab.body} />
      </View>
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
