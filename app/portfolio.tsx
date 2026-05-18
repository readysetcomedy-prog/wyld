import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { theme } from '@/lib/theme';
import { Nav } from '@/components/Nav';
import { QuoteButton } from '@/components/QuoteButton';

export default function Portfolio() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      stickyHeaderIndices={[0]}
    >
      <Nav />

      <View style={[styles.body, isWide && styles.bodyWide]}>
        <Text style={styles.eyebrow}>OUR WORK</Text>
        <Text style={[styles.title, isWide && styles.titleWide]}>Portfolio</Text>
        <Text style={styles.bodyText}>
          We&apos;re putting together a showcase of gyms running on WyLD — their websites,
          booking pages, and storefronts. Check back soon.
        </Text>
        <Text style={styles.bodyText}>
          Want yours to be one of them? Get a quote and we&apos;ll get you set up.
        </Text>
        <View style={styles.ctaRow}>
          <QuoteButton label="Get a Quote" variant="solid" big />
        </View>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.offWhite },
  container: { paddingBottom: theme.spacing.xxl, minHeight: '100%' },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  bodyWide: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: theme.colors.charcoal,
    textAlign: 'center',
  },
  titleWide: { fontSize: 52 },
  bodyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: 24,
  },
  ctaRow: { marginTop: theme.spacing.md, flexDirection: 'row' },
  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
