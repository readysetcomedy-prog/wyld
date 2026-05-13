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
import { theme, LOGO_URL } from '@/lib/theme';

export default function Landing() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={[styles.nav, isWide && styles.navWide]}>
        <View style={styles.brand}>
          <Image source={{ uri: LOGO_URL }} style={styles.logoSmall} resizeMode="contain" />
        </View>
        <View style={styles.navLinks}>
          <Link href="/sign-in" asChild>
            <Pressable style={styles.navBtn}>
              <Text style={styles.navBtnText}>Sign in</Text>
            </Pressable>
          </Link>
          <Link href="/sign-up" asChild>
            <Pressable style={StyleSheet.flatten([styles.navBtn, styles.navBtnPrimary])}>
              <Text style={[styles.navBtnText, styles.navBtnTextPrimary]}>Get started</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>
            Turnkey gym access.{'\n'}No front desk needed.
          </Text>
          <Text style={styles.heroSub}>
            Members sign up, sign the waiver, and pay from their phone. The lock won't
            open until they do.
          </Text>
          <View style={styles.heroCtas}>
            <Link href="/sign-up" asChild>
              <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
                <Text style={styles.ctaPrimaryText}>Get your gym set up</Text>
              </Pressable>
            </Link>
            <Link href="#how-it-works" asChild>
              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>See how it works</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.trustStrip}>
            <Text style={styles.trustText}>No contract</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>Cancel anytime</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>$49/mo flat</Text>
          </View>
        </View>
        <View style={styles.heroVisual}>
          <Image source={{ uri: LOGO_URL }} style={styles.logoBig} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.section, isWide && styles.sectionWide]}>
        <Text style={styles.eyebrow}>How it works</Text>
        <Text style={styles.sectionTitle}>Three steps to a fully self-serve gym.</Text>
        <View style={[styles.steps, isWide && styles.stepsWide]}>
          <Step
            n="1"
            title="Install the lock"
            body="Pop a smart lock on your door and enter your lock ID in your dashboard."
          />
          <Step
            n="2"
            title="Go live in the app"
            body="Your gym is searchable by location, plus you get a unique QR code to put on the door, on social, on flyers."
          />
          <Step
            n="3"
            title="Members let themselves in"
            body="Sign the waiver, pay, walk in. No payment, no entry — the door enforces it for you."
          />
        </View>
      </View>

      <View style={[styles.mathBand, isWide && styles.mathBandWide]}>
        <Text style={styles.mathEyebrow}>Run your gym on autopilot.</Text>
        <Text style={styles.mathHeadline}>
          $49/mo.{'\n'}
          <Text style={styles.mathHeadlineAccent}>Saves the average gym $490/mo.</Text>
        </Text>
        <Text style={styles.mathSub}>Based on real numbers from a real gym.</Text>
        <View style={[styles.statGrid, isWide && styles.statGridWide]}>
          <Stat
            title="Stop chasing payments."
            body="No payment, no access. The door enforces it for you."
          />
          <Stat
            title="No more lost keys."
            body="Every member's access is digital, tied to their account, revocable in one tap."
          />
          <Stat
            title="No more shared codes."
            body="Friends can't piggyback in on a member's code — the waiver makes the member financially responsible if they do."
          />
        </View>
      </View>

      <View style={[styles.section, isWide && styles.sectionWide]}>
        <Text style={styles.eyebrow}>What you get</Text>
        <Text style={styles.sectionTitle}>Everything you need. Nothing you don't.</Text>
        <View style={[styles.features, isWide && styles.featuresWide]}>
          <Feature
            title="Your gym, in the app"
            body="Searchable directory plus a QR code unique to you. One scan and they're a member. Use it as 'Powered by WyLD Pass,' or link members straight from your existing website."
          />
          <Feature
            title="Liability handled"
            body="Built-in waiver makes the member responsible for anyone they let in. If a non-member gets hurt, it's on the member who let them through."
          />
          <Feature
            title="Tax-ready reports"
            body="Members, revenue, costs, net profit. Export at tax time, hand it to your accountant, done."
          />
        </View>
      </View>

      <View style={[styles.pricingBand, isWide && styles.pricingBandWide]}>
        <View style={styles.pricingCard}>
          <Text style={styles.pricingPrice}>$49</Text>
          <Text style={styles.pricingPeriod}>per month</Text>
          <Text style={styles.pricingTagline}>Everything. No contract. Cancel anytime.</Text>
          <Link href="/sign-up" asChild>
            <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary, styles.pricingCta])}>
              <Text style={styles.ctaPrimaryText}>Get your gym set up</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={[styles.finalCta, isWide && styles.finalCtaWide]}>
        <Text style={styles.finalCtaTitle}>Set up your gym in under an hour.</Text>
        <Link href="/sign-up" asChild>
          <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
            <Text style={styles.ctaPrimaryText}>Get your gym set up</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Pass</Text>
    </ScrollView>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{n}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepBody}>{body}</Text>
    </View>
  );
}

function Stat({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statBody}>{body}</Text>
    </View>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: theme.spacing.xxl },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  navWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: theme.spacing.lg },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logoSmall: { width: 48, height: 48 },
  navLinks: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  navBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  navBtnText: { color: theme.colors.charcoal, fontWeight: '600' },
  navBtnPrimary: { backgroundColor: theme.colors.charcoal },
  navBtnTextPrimary: { color: '#fff' },

  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 80,
    gap: theme.spacing.xxl,
  },
  heroText: { flex: 1, gap: theme.spacing.md },
  heroVisual: { flex: 1, alignItems: 'center' },
  logoBig: { width: 280, height: 280 },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.colors.charcoal,
    lineHeight: 48,
  },
  heroSub: { fontSize: 18, color: theme.colors.textSecondary, lineHeight: 28 },
  heroCtas: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    flexWrap: 'wrap',
  },
  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  ctaText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 16 },
  ctaPrimary: { backgroundColor: theme.colors.teal, borderColor: theme.colors.teal },
  ctaPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  trustText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  trustDot: { color: theme.colors.border, fontSize: 13 },

  section: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  sectionWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: 72 },
  eyebrow: {
    color: theme.colors.teal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: theme.colors.charcoal,
    lineHeight: 38,
    maxWidth: 720,
  },

  steps: { gap: theme.spacing.md, marginTop: theme.spacing.lg },
  stepsWide: { flexDirection: 'row', gap: theme.spacing.lg },
  step: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.charcoal },
  stepBody: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },

  mathBand: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.charcoal,
    gap: theme.spacing.sm,
  },
  mathBandWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: 80 },
  mathEyebrow: {
    color: theme.colors.teal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mathHeadline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 44,
    maxWidth: 720,
  },
  mathHeadlineAccent: { color: theme.colors.teal },
  mathSub: { color: '#94a3b8', fontSize: 14, marginBottom: theme.spacing.md },
  statGrid: { gap: theme.spacing.md, marginTop: theme.spacing.md },
  statGridWide: { flexDirection: 'row', gap: theme.spacing.lg },
  stat: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: theme.spacing.xs,
  },
  statTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statBody: { color: '#cbd5e1', fontSize: 14, lineHeight: 21 },

  features: { gap: theme.spacing.md, marginTop: theme.spacing.lg },
  featuresWide: { flexDirection: 'row', gap: theme.spacing.lg },
  feature: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  featureTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.charcoal },
  featureBody: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },

  pricingBand: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  pricingBandWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: 72 },
  pricingCard: {
    width: '100%',
    maxWidth: 440,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  pricingPrice: {
    fontSize: 64,
    fontWeight: '800',
    color: theme.colors.charcoal,
    lineHeight: 68,
  },
  pricingPeriod: { color: theme.colors.textSecondary, fontSize: 15 },
  pricingTagline: {
    color: theme.colors.charcoal,
    fontSize: 15,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  pricingCta: { width: '100%', alignItems: 'center' },

  finalCta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  finalCtaWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: 72 },
  finalCtaTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.charcoal,
    textAlign: 'center',
    maxWidth: 640,
  },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
