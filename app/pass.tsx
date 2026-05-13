import { useRef, useState } from 'react';
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
import { theme, LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';

const BASE_SAVINGS = 490;
const PER_EMPLOYEE_SAVINGS = 4500;
const DOOR_MONTHLY = 49;
const LOCK_HARDWARE_COST = 70;

function fmt(n: number) {
  return '$' + (Number.isInteger(n) ? n.toString() : n.toFixed(2));
}

export default function Pass() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [employees, setEmployees] = useState(0);
  const monthlySavings = BASE_SAVINGS + employees * PER_EMPLOYEE_SAVINGS;

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
      (_x, y) => {
        sv.scrollTo({ y, animated: true });
      },
      () => undefined,
    );
  };

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.container}>
      <Nav />

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={[styles.heroText, isWide && styles.heroTextWide]}>
          <Text style={styles.brandEyebrow}>WyLD Pass</Text>
          <Text style={styles.heroTitle}>
            Turnkey gym access.{'\n'}No front desk needed.
          </Text>
          <Text style={styles.heroSub}>
            Members sign up, sign the waiver, and pay you from their phone — we handle the
            payment processing and drop the money in your account. The lock won't open
            until they're paid.
          </Text>
          <View style={styles.heroCtas}>
            <Link href="/sign-up" asChild>
              <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
                <Text style={styles.ctaPrimaryText}>Get your gym set up</Text>
              </Pressable>
            </Link>
            <Pressable style={styles.cta} onPress={scrollToHowItWorks}>
              <Text style={styles.ctaText}>See how it works</Text>
            </Pressable>
          </View>
          <View style={styles.trustStrip}>
            <Text style={styles.trustText}>No contract</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>Cancel anytime</Text>
            <Text style={styles.trustDot}>·</Text>
            <Text style={styles.trustText}>Pay monthly or save 20% yearly</Text>
          </View>
        </View>
        <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
          <Image source={{ uri: LOGO_URL }} style={styles.logoBig} resizeMode="contain" />
        </View>
      </View>

      <View style={[styles.gymTypes]}>
        <View style={styles.gymTypesInner}>
          <Text style={styles.gymTypesLabel}>Built for any kind of gym</Text>
          <View style={styles.gymTypesPills}>
            {[
              'Martial arts',
              'Rock climbing',
              'CrossFit',
              'Weight lifting',
              'Yoga',
              'Pilates',
              'Dance',
              'Boxing',
              'Jiu-jitsu',
              'Functional fitness',
              'and more',
            ].map((g) => (
              <View key={g} style={styles.gymPill}>
                <Text style={styles.gymPillText}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View
        ref={howItWorksRef}
        nativeID="how-it-works"
        style={[styles.section, isWide && styles.sectionWide]}
      >
        <Text style={styles.eyebrow}>How it works</Text>
        <Text style={styles.sectionTitle}>Three steps to a fully self-serve gym.</Text>
        <View style={[styles.steps, isWide && styles.stepsWide]}>
          <Step
            n="1"
            title="Install the lock"
            body={`Pop a smart lock on your door (about $${LOCK_HARDWARE_COST} one-time hardware) and enter your lock ID in your dashboard.`}
          />
          <Step
            n="2"
            title="Go live in the app"
            body="Your gym is searchable by location, plus you get a unique QR code to put on the door, on social, on flyers."
          />
          <Step
            n="3"
            title="Members let themselves in"
            body="Sign the waiver, pay you through the app, walk in. No payment, no entry — the door enforces it for you."
          />
        </View>
      </View>

      <View style={[styles.mathBand, isWide && styles.mathBandWide]}>
        <View style={styles.mathInner}>
        <Text style={styles.mathEyebrow}>Run your gym on autopilot.</Text>
        <Text style={styles.mathHeadline}>
          {fmt(DOOR_MONTHLY)}/mo.{'\n'}
          <Text style={styles.mathHeadlineAccent}>
            Saves the average gym {fmt(BASE_SAVINGS)}/mo.
          </Text>
        </Text>
        <Text style={styles.mathSub}>Based on real averages from real gyms.</Text>

        <View style={[styles.calculator, isWide && styles.calculatorWide]}>
          <View style={styles.calcLeft}>
            <Text style={styles.calcLabel}>How many employees do you have?</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => setEmployees((n) => Math.max(0, n - 1))}
                accessibilityLabel="Decrease employees"
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{employees}</Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={() => setEmployees((n) => n + 1)}
                accessibilityLabel="Increase employees"
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>
            <Text style={styles.calcHint}>
              We assume ~{fmt(PER_EMPLOYEE_SAVINGS)}/mo per employee in fully-loaded cost.
              Drop them all, or just the front-desk shift.
            </Text>
          </View>
          <View style={styles.calcRight}>
            <Text style={styles.calcResultLabel}>Estimated monthly savings</Text>
            <Text style={styles.calcResultValue}>{fmt(monthlySavings)}</Text>
            <Text style={styles.calcResultSub}>after {fmt(DOOR_MONTHLY)}/mo for WyLD Pass</Text>
          </View>
        </View>

        <Text style={styles.whyTitle}>Where the savings come from</Text>
        <View style={[styles.statGrid, isWide && styles.statGridWide]}>
          <Stat
            title="Stop chasing payments."
            body="No payment, no access. The door enforces it for you — no awkward texts, no excuses."
          />
          <Stat
            title="Lapsed members re-up faster."
            body="When the door actually locks them out, 'I'll catch up next week' turns into a payment today."
          />
          <Stat
            title="Piggybackers become members."
            body="The waiver makes a member financially liable for anyone they let in. Most of them just buy their own membership instead."
          />
          <Stat
            title="Sign-ups happen 24/7."
            body="No more 'come back when we're open.' Someone walks up at 11pm, scans the QR, signs the waiver, pays, walks in."
          />
          <Stat
            title="No lost keys, no rekeying."
            body="Access is digital and tied to the account. Cancel a member, the door stops opening for them."
          />
          <Stat
            title="Fewer (or zero) employees."
            body="Self-serve signup, payment, and access means you don't need someone behind a desk. Use the calculator above."
          />
        </View>
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
            title="We handle the payments"
            body="Members pay you in-app. We collect membership dues, deposit them to your account, and chase no one — if they don't pay, the door doesn't open."
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

      <View style={[styles.finalCta, isWide && styles.finalCtaWide]}>
        <Text style={styles.finalCtaTitle}>Set up your gym in under an hour.</Text>
        <View style={styles.finalCtas}>
          <Link href="/sign-up" asChild>
            <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPrimary])}>
              <Text style={styles.ctaPrimaryText}>Get your gym set up</Text>
            </Pressable>
          </Link>
          <Link href="/pricing" asChild>
            <Pressable style={styles.cta}>
              <Text style={styles.ctaText}>See pricing</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
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
  brandEyebrow: {
    color: theme.colors.teal,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  heroText: { gap: theme.spacing.md, width: '100%' },
  heroTextWide: { flex: 1, width: 'auto' },
  heroVisual: { alignItems: 'center', width: '100%' },
  heroVisualWide: { flex: 1, width: 'auto' },
  logoBig: { width: '100%', maxWidth: 280, aspectRatio: 1 },
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
  sectionWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 72,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
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
  mathInner: { maxWidth: 1240, width: '100%', alignSelf: 'center', gap: theme.spacing.sm },
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

  calculator: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: theme.spacing.lg,
  },
  calculatorWide: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xl },
  calcLeft: { flex: 1, gap: theme.spacing.sm },
  calcRight: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(20,184,166,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.30)',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  calcLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  stepperValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'center',
  },
  calcHint: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginTop: theme.spacing.xs },
  calcResultLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  calcResultValue: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 50,
  },
  calcResultSub: { color: '#cbd5e1', fontSize: 13 },

  whyTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: theme.spacing.xl,
  },
  statGrid: { gap: theme.spacing.md, marginTop: theme.spacing.md },
  statGridWide: { flexDirection: 'row', gap: theme.spacing.lg, flexWrap: 'wrap' },
  stat: {
    flexGrow: 1,
    flexBasis: 260,
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

  finalCtas: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
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

  gymTypes: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  gymTypesInner: {
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  gymTypesLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  gymTypesPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    maxWidth: 880,
  },
  gymPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gymPillText: { color: theme.colors.charcoal, fontSize: 13, fontWeight: '600' },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
