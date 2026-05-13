import { Link } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { theme } from '@/lib/theme';
import { Nav } from '@/components/Nav';

export default function Portfolio() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Nav />

      <View style={styles.body}>
        <Text style={styles.eyebrow}>Portfolio</Text>
        <Text style={styles.title}>Coming soon.</Text>
        <Text style={styles.bodyText}>
          We're putting together gym sites and rollouts we've built. Check back shortly —
          or get in touch and we'll send you the latest set.
        </Text>
        <Link href="/" asChild>
          <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
            <Text style={styles.ctaPrimaryText}>Back to home</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: theme.spacing.xxl, minHeight: '100%' },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  eyebrow: {
    color: theme.colors.teal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.colors.charcoal,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 24,
  },
  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  ctaPrimary: { backgroundColor: theme.colors.teal, borderColor: theme.colors.teal },
  ctaPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
