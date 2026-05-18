import { Link, Redirect } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';
import { QuoteButton } from '@/components/QuoteButton';

const FEATURES: { icon: string; tint: string; title: string; body: string }[] = [
  {
    icon: '🌐',
    tint: '#7C3AED',
    title: 'Your own website',
    body: 'A polished public site for your gym on your own domain — no web designer needed.',
  },
  {
    icon: '📅',
    tint: '#2563EB',
    title: 'Scheduling & booking',
    body: 'Publish classes, events, and open slots that members can book in seconds.',
  },
  {
    icon: '🔑',
    tint: '#0F766E',
    title: 'Smart-lock entry',
    body: 'Self-serve door access that checks membership and waivers before it opens.',
  },
  {
    icon: '💳',
    tint: '#16A34A',
    title: 'Memberships & offerings',
    body: 'Sell memberships, day passes, and prepaid plans with automatic discounts.',
  },
  {
    icon: '🛍️',
    tint: '#D97706',
    title: 'Retail store',
    body: 'Sell merch and add-ons online and at the front desk, inventory included.',
  },
  {
    icon: '👥',
    tint: '#E11D48',
    title: 'Staff & time cards',
    body: 'Manage employees and roles, track clock-ins, and export payroll-ready hours.',
  },
  {
    icon: '📣',
    tint: '#9333EA',
    title: 'Marketing materials',
    body: 'Flyers, social posts, and signage ready to share — on brand, every time.',
  },
  {
    icon: '📊',
    tint: '#0891B2',
    title: 'Analytics & reporting',
    body: 'See revenue and attendance at a glance, with tax-ready exports.',
  },
  {
    icon: '🏢',
    tint: '#475569',
    title: 'Multi-location',
    body: 'Run every location from one dashboard, each with its own site and pricing.',
  },
];

export default function Home() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Nav />

      {/* Hero */}
      <View style={[styles.hero, isWide && styles.heroWide]}>
        <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.eyebrow}>ONE COMPLETE PLATFORM FOR YOUR GYM</Text>
        <Text style={[styles.heroTitle, isWide && styles.heroTitleWide]}>
          Everything your gym needs.{' '}
          <Text style={styles.heroTitleAccent}>One platform.</Text>
        </Text>
        <Text style={styles.heroSub}>
          Website, scheduling, memberships, smart-lock entry, retail, staff, and reporting —
          connected and built to run your whole gym, from one place.
        </Text>
        <View style={styles.heroCtas}>
          <QuoteButton label="Get a Quote" variant="solid" big />
          <Link href="/portfolio" asChild>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>See our work</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {/* Highlights strip */}
      <View style={[styles.strip, isWide && styles.stripWide]}>
        {[
          { k: 'One login', v: 'Run the whole gym from a single dashboard.' },
          { k: 'Only what you need', v: 'Turn features on as your gym grows.' },
          { k: 'One team to call', v: 'Real support from the people who built it.' },
        ].map((s) => (
          <View key={s.k} style={[styles.stripItem, isWide && styles.stripItemWide]}>
            <Text style={styles.stripKey}>{s.k}</Text>
            <Text style={styles.stripVal}>{s.v}</Text>
          </View>
        ))}
      </View>

      {/* Feature grid */}
      <View style={styles.featureBand}>
        <View style={[styles.featureInner, isWide && styles.featureInnerWide]}>
          <Text style={styles.sectionEyebrow}>WHAT&apos;S INSIDE</Text>
          <Text style={[styles.sectionTitle, isWide && styles.sectionTitleWide]}>
            Every part of your gym, working together.
          </Text>
          <Text style={styles.sectionSub}>
            No more stitching six different tools together. It&apos;s all one product.
          </Text>
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.card, isWide && styles.cardWide]}>
                <View style={[styles.iconChip, { backgroundColor: f.tint }]}>
                  <Text style={styles.iconText}>{f.icon}</Text>
                </View>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardBody}>{f.body}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* CTA band */}
      <View style={[styles.cta, isWide && styles.ctaWide]}>
        <View style={styles.ctaInner}>
          <Text style={styles.ctaEyebrow}>READY WHEN YOU ARE</Text>
          <Text style={[styles.ctaTitle, isWide && styles.ctaTitleWide]}>
            Let&apos;s build pricing around your gym.
          </Text>
          <Text style={styles.ctaSub}>
            Tell us your locations, members, and what you need — we&apos;ll send a quote.
          </Text>
          <QuoteButton label="Get a Quote" variant="light" big />
        </View>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: 0 },

  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: theme.spacing.xl,
    paddingBottom: 72,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  heroLogo: { width: 140, height: 140 },
  eyebrow: {
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.charcoal,
    textAlign: 'center',
    lineHeight: 42,
    maxWidth: 760,
  },
  heroTitleWide: { fontSize: 54, lineHeight: 60 },
  heroTitleAccent: { color: theme.colors.wyldPurple },
  heroSub: {
    fontSize: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 620,
    lineHeight: 27,
  },
  heroCtas: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  secondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryBtnText: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },

  strip: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  stripWide: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xxl,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
    gap: theme.spacing.lg,
  },
  stripItem: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.wyldPurple,
    paddingLeft: theme.spacing.md,
    gap: 2,
  },
  stripItemWide: { flex: 1 },
  stripKey: { fontSize: 17, fontWeight: '800', color: theme.colors.charcoal },
  stripVal: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },

  featureBand: {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  featureInner: { gap: theme.spacing.sm },
  featureInnerWide: {
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  sectionEyebrow: {
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.charcoal,
    lineHeight: 34,
    maxWidth: 640,
  },
  sectionTitleWide: { fontSize: 36, lineHeight: 42 },
  sectionSub: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    maxWidth: 560,
    marginBottom: theme.spacing.md,
  },
  grid: { gap: theme.spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  cardWide: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 260,
    marginHorizontal: '1%',
    marginBottom: theme.spacing.md,
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 24 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  cardBody: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 21 },

  cta: {
    backgroundColor: theme.colors.charcoal,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  ctaWide: { paddingVertical: 80 },
  ctaInner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ctaEyebrow: {
    color: '#a78bfa',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  ctaTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 36,
  },
  ctaTitleWide: { fontSize: 40, lineHeight: 46 },
  ctaSub: {
    fontSize: 16,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 520,
    marginBottom: theme.spacing.sm,
  },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    paddingVertical: theme.spacing.lg,
    fontSize: 13,
  },
});
