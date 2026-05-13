import { Link } from 'expo-router';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { theme, SITE_LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';

export default function Portfolio() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Nav logoUrl={SITE_LOGO_URL} accent={theme.colors.siteRed} />

      <View style={styles.body}>
        <Text style={styles.eyebrow}>WyLD Site</Text>
        <Text style={styles.title}>Website Portfolio</Text>
        <Text style={styles.bodyText}>
          Coming soon — we're putting the
          first set together now. 
        </Text>
        <Link href="/site" asChild>
          <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
            <Text style={styles.ctaPrimaryText}>About WyLD Site</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
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
    color: theme.colors.siteRed,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
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
  ctaPrimary: {
    backgroundColor: theme.colors.siteRed,
    borderColor: theme.colors.siteRed,
  },
  ctaPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
