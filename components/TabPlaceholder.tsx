import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

export function TabPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={styles.soon}>
        <Text style={styles.soonText}>Coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.sm },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  body: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    maxWidth: 720,
  },
  soon: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  soonText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
