import { useRef } from 'react';
import { Link, Redirect } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  findNodeHandle,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme, SITE_LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';

const SITE_SETUP = 299;
const SITE_MONTHLY = 29;

export default function Site() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const scrollRef = useRef<ScrollView>(null);
  const howItWorksRef = useRef<View>(null);

  const scrollToHowItWorks = () => {
    const sv = scrollRef.current;
    const view = howItWorksRef.current;
    if (!sv || !view) return;
    const handle = findNodeHandle(sv);
    if (handle == null) return;
    view.measureLayout(
      handle,
      (_x, y) => sv.scrollTo({ y, animated: true }),
      () => undefined,
    );
  };

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.container}>
      <Nav logoUrl={SITE_LOGO_URL} accent={theme.colors.siteRed} />

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={[styles.heroText, isWide && styles.heroTextWide]}>
          <Text style={styles.brandEyebrow}>WyLD Site</Text>
          <Text style={styles.heroTitle}>
            A real website for your gym.{'\n'}We build it. We host it.
          </Text>
          <Text style={styles.heroSub}>
            Class schedule, booking, retail, staff time cards, payment collection — and a
            design that actually looks like your gym. Every module is toggleable, so you
            only see what you actually use.
          </Text>
          <View style={styles.heroCtas}>
            <Link href="/sign-up" asChild>
              <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
                <Text style={styles.ctaPrimaryText}>Start my site</Text>
              </Pressable>
            </Link>
            <Pressable style={styles.cta} onPress={scrollToHowItWorks}>
              <Text style={styles.ctaText}>See how it works</Text>
            </Pressable>
          </View>
          <View style={styles.trustStrip}>
            <Text style={styles.trustText}>
              {'$'}{SITE_SETUP} setup · {'$'}{SITE_MONTHLY}/mo hosting
            </Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>Free domain included</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>Cancel anytime</Text>
          </View>
        </View>
        <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
          <Image source={{ uri: SITE_LOGO_URL }} style={styles.logoBig} resizeMode="contain" />
        </View>
      </View>

      <View
        ref={howItWorksRef}
        nativeID="how-it-works"
        style={[styles.section, isWide && styles.sectionWide]}
      >
        <Text style={styles.eyebrow}>How it works</Text>
        <Text style={styles.sectionTitle}>From kickoff to live in days, not months.</Text>
        <View style={[styles.steps, isWide && styles.stepsWide]}>
          <Step
            n="1"
            title="Tell us about your gym"
            body="Logo, photos, schedule, pricing, the modules you want on. We turn it into a real, branded site."
          />
          <Step
            n="2"
            title="We design and ship"
            body="You get a draft to react to, we iterate, and we push it live on a free .com domain — or transfer the one you already own at no cost."
          />
          <Step
            n="3"
            title="Run it from your dashboard"
            body="Toggle modules on and off, update content, see analytics, run payroll. No website builder fiddling."
          />
        </View>
      </View>

      <View style={[styles.section, isWide && styles.sectionWide]}>
        <Text style={styles.eyebrow}>What's included</Text>
        <Text style={styles.sectionTitle}>Every module included. Use what you want, hide the rest.</Text>
        <View style={[styles.features, isWide && styles.featuresWide]}>
          <Feature title="Custom design" body="Real design or redesign of your site, not a template you fill in." />
          <Feature title="Hosting" body="Fast, reliable hosting included in the monthly. No separate bill, no upsell." />
          <Feature title="Free domain" body="Free .com — or we transfer the one you already own for free." />
          <Feature title="Payment collection" body="Take payments online, with a built-in waiver at checkout. Same waiver protection as WyLD Pass." />
          <Feature title="Schedule & booking" body="Classes, drop-ins, private sessions. Members book themselves." />
          <Feature title="Online retail" body="Sell shirts, gear, supplements, gift cards. Inventory and orders in your dashboard." />
          <Feature title="Staff & time cards" body="Add employees, set roles, track clock-ins and hours. Export for payroll." />
          <Feature title="Analytics & reporting" body="Revenue, members, top sellers, schedule fill rates. Export for taxes." />
        </View>
      </View>

      <View style={[styles.crossSell, isWide && styles.crossSellWide]}>
        <View style={styles.crossSellInner}>
          <Text style={styles.crossSellEyebrow}>Pairs with WyLD Pass</Text>
          <Text style={styles.crossSellTitle}>
            Add the door for a self-serve gym that runs itself.
          </Text>
          <Text style={styles.crossSellBody}>
            Bundle WyLD Site with WyLD Pass and members can pay from either the website or
            the app — both unlock the door. Save {'$'}100 on setup and {'$'}10/mo when you
            take both.
          </Text>
          <View style={styles.crossSellCtas}>
            <Link href="/pricing" asChild>
              <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
                <Text style={styles.ctaPrimaryText}>See bundle pricing</Text>
              </Pressable>
            </Link>
            <Link href="/" asChild>
              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>Learn about WyLD Pass</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      <View style={[styles.finalCta, isWide && styles.finalCtaWide]}>
        <Text style={styles.finalCtaTitle}>Get your gym a real website.</Text>
        <Link href="/sign-up" asChild>
          <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
            <Text style={styles.ctaPrimaryText}>Start my site</Text>
          </Pressable>
        </Link>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Site</Text>
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
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  heroText: { gap: theme.spacing.md, width: '100%' },
  heroTextWide: { flex: 1, width: 'auto' },
  heroVisual: { alignItems: 'center', width: '100%' },
  heroVisualWide: { flex: 1, width: 'auto' },
  logoBig: { width: '100%', maxWidth: 320, aspectRatio: 1 },
  brandEyebrow: {
    color: theme.colors.siteRed,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
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
  ctaPrimary: { backgroundColor: theme.colors.siteRed, borderColor: theme.colors.siteRed },
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
  sectionWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 72,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: theme.colors.siteRed,
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
    backgroundColor: theme.colors.siteRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.charcoal },
  stepBody: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },

  features: { gap: theme.spacing.md, marginTop: theme.spacing.lg },
  featuresWide: { flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' },
  feature: {
    flexGrow: 1,
    flexBasis: 260,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  featureTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.charcoal },
  featureBody: { fontSize: 15, color: theme.colors.textSecondary, lineHeight: 22 },

  crossSell: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.charcoal,
  },
  crossSellWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: 80 },
  crossSellInner: {
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    gap: theme.spacing.sm,
  },
  crossSellEyebrow: {
    color: theme.colors.teal,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  crossSellTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 36,
    maxWidth: 720,
  },
  crossSellBody: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, maxWidth: 720 },
  crossSellCtas: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    flexWrap: 'wrap',
  },

  finalCta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  finalCtaWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 72,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
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
