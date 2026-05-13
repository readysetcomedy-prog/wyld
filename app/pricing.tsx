import { useState } from 'react';
import { Link, Redirect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme, LOGO_URL, SITE_LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';

const DOOR_SETUP = 199;
const DOOR_MONTHLY = 49;
const SITE_SETUP = 299;
const SITE_MONTHLY = 29;
const BUNDLE_SETUP_DISCOUNT = 100;
const BUNDLE_MONTHLY_DISCOUNT = 10;
const YEARLY_OFF = 0.2;
const LOCK_HARDWARE_COST = 70;

const BUNDLE_SETUP = DOOR_SETUP + SITE_SETUP - BUNDLE_SETUP_DISCOUNT;
const BUNDLE_MONTHLY = DOOR_MONTHLY + SITE_MONTHLY - BUNDLE_MONTHLY_DISCOUNT;

type Billing = 'monthly' | 'yearly';
type Brand = 'pass' | 'site' | 'bundle';

function fmt(n: number) {
  return '$' + (Number.isInteger(n) ? n.toString() : n.toFixed(2));
}

const bundleBorderStyle =
  Platform.OS === 'web'
    ? ({
        // CSS gradient passes through react-native-web as inline style on web only.
        backgroundImage: `linear-gradient(135deg, ${theme.colors.teal}, ${theme.colors.siteRed})`,
      } as object)
    : { backgroundColor: theme.colors.teal };

export default function Pricing() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [billing, setBilling] = useState<Billing>('monthly');

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Nav logoUrl={LOGO_URL} secondaryLogoUrl={SITE_LOGO_URL} />

      <View style={[styles.section, isWide && styles.sectionWide]}>
        <Text style={styles.eyebrow}>Pricing</Text>
        <Text style={styles.title}>One door. One website. Or both, at a discount.</Text>
        <Text style={styles.sub}>
          Pick what you need. Skip what you don't. No contract, cancel anytime, and
          everything is 20% off when you pay yearly — setup included.
        </Text>

        <View style={styles.billingToggle}>
          <Pressable
            style={[
              styles.billingOption,
              billing === 'monthly' && styles.billingOptionActive,
            ]}
            onPress={() => setBilling('monthly')}
          >
            <Text
              style={[
                styles.billingOptionText,
                billing === 'monthly' && styles.billingOptionTextActive,
              ]}
            >
              Monthly
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.billingOption,
              billing === 'yearly' && styles.billingOptionActive,
            ]}
            onPress={() => setBilling('yearly')}
          >
            <Text
              style={[
                styles.billingOptionText,
                billing === 'yearly' && styles.billingOptionTextActive,
              ]}
            >
              Yearly · Save 20%
            </Text>
          </Pressable>
        </View>

        <View style={[styles.plans, isWide && styles.plansWide]}>
          <PlanCard
            isWide={isWide}
            brand="pass"
            name="WyLD Pass"
            tagline="Self-serve gym access. The door does the front desk."
            setup={DOOR_SETUP}
            monthly={DOOR_MONTHLY}
            billing={billing}
            features={[
              'Smart-lock self-serve entry',
              'Built-in waiver',
              'Membership payments collected for you (merchant processor fees not included)',
              'Unique QR code + searchable in-app listing',
              'Tax-ready reports',
              `Plus a one-time ~${fmt(LOCK_HARDWARE_COST)} lock you buy once`,
            ]}
          />
          <PlanCard
            isWide={isWide}
            brand="bundle"
            name="Pass + Site"
            tagline="The whole stack at a discount. Pay from app or website."
            setup={BUNDLE_SETUP}
            monthly={BUNDLE_MONTHLY}
            billing={billing}
            savingsNote={`${fmt(BUNDLE_SETUP_DISCOUNT)} off setup · ${fmt(BUNDLE_MONTHLY_DISCOUNT)}/mo off`}
            features={[
              'Everything in WyLD Pass',
              'Everything in WyLD Site',
              'Members pay from the app OR your website — either unlocks the door',
              'One dashboard, one bill',
              `Plus a one-time ~${fmt(LOCK_HARDWARE_COST)} lock you buy once`,
            ]}
          />
          <PlanCard
            isWide={isWide}
            brand="site"
            name="WyLD Site"
            tagline="A website for your gym, designed by us, hosted by us."
            setup={SITE_SETUP}
            monthly={SITE_MONTHLY}
            billing={billing}
            features={[
              'Custom design or redesign of your site',
              'Hosting included',
              'Free .com domain — or we transfer your existing one for free',
              'Payment collection with built-in waiver at checkout (merchant processor fees not included)',
              'Class schedule & booking',
              'Online retail store (5% retail fee + merchant processor fees)',
              'Staff management with time cards',
              'Detailed analytics & reporting',
              'Turn any module on or off in your dashboard',
            ]}
          />
        </View>

        <Text style={styles.finePrint}>
          All prices in USD. Yearly billing is 20% off everything, setup included. No
          contract, cancel anytime.
        </Text>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
    </ScrollView>
  );
}

function PlanCard({
  name,
  tagline,
  setup,
  monthly,
  billing,
  features,
  savingsNote,
  brand,
  isWide,
}: {
  name: string;
  tagline: string;
  setup: number;
  monthly: number;
  billing: Billing;
  features: string[];
  savingsNote?: string;
  brand: Brand;
  isWide: boolean;
}) {
  const isYearly = billing === 'yearly';
  const displayedMonthly = isYearly ? monthly * (1 - YEARLY_OFF) : monthly;
  const displayedSetup = isYearly ? setup * (1 - YEARLY_OFF) : setup;
  const yearlyTotal = monthly * 12 * (1 - YEARLY_OFF);

  const accent =
    brand === 'pass'
      ? theme.colors.teal
      : brand === 'site'
        ? theme.colors.siteRed
        : theme.colors.charcoal;

  const isBundle = brand === 'bundle';

  const card = (
    <View
      style={[
        styles.plan,
        isWide ? styles.planWide : styles.planMobile,
        isBundle && styles.planBundle,
      ]}
    >
      {isBundle ? (
        <View style={styles.bundleBadge}>
          <View style={[styles.bundleBadgeHalf, { backgroundColor: theme.colors.teal }]}>
            <Text style={styles.bundleBadgeText}>Pass</Text>
          </View>
          <View
            style={[styles.bundleBadgeHalf, { backgroundColor: theme.colors.siteRed }]}
          >
            <Text style={styles.bundleBadgeText}>Site</Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.planName, isBundle && styles.planNameLight]}>{name}</Text>
      <Text style={[styles.planTagline, isBundle && styles.planTaglineLight]}>
        {tagline}
      </Text>

      <View style={styles.planPriceRow}>
        <Text style={[styles.planPrice, isBundle && styles.planPriceLight]}>
          {fmt(displayedMonthly)}
        </Text>
        <Text style={[styles.planPriceUnit, isBundle && styles.planPriceUnitLight]}>
          {isYearly ? '/mo, billed yearly' : '/month'}
        </Text>
      </View>
      <Text style={[styles.planSetup, isBundle && styles.planSetupLight]}>
        + {fmt(displayedSetup)} one-time setup
      </Text>
      {isYearly ? (
        <Text style={[styles.planYearTotal, isBundle && styles.planYearTotalLight]}>
          {fmt(yearlyTotal)} billed once a year
        </Text>
      ) : null}
      {savingsNote ? (
        <Text style={[styles.planSavings, { color: accent === theme.colors.charcoal ? theme.colors.teal : accent }]}>
          {savingsNote}
        </Text>
      ) : null}

      <View style={styles.planDivider} />

      {features.map((f) => (
        <View key={f} style={styles.planFeatureRow}>
          <Text style={[styles.planFeatureCheck, { color: accent === theme.colors.charcoal ? theme.colors.teal : accent }]}>
            ✓
          </Text>
          <Text style={[styles.planFeature, isBundle && styles.planFeatureLight]}>{f}</Text>
        </View>
      ))}

      <Link href="/sign-up" asChild>
        <Pressable
          style={StyleSheet.flatten([
            styles.cta,
            { backgroundColor: accent === theme.colors.charcoal ? theme.colors.teal : accent, borderColor: accent === theme.colors.charcoal ? theme.colors.teal : accent },
            styles.planCta,
          ])}
        >
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
      </Link>
    </View>
  );

  if (!isBundle) return card;

  return (
    <View
      style={[
        styles.bundleWrap,
        isWide ? styles.planWide : styles.planMobile,
        bundleBorderStyle,
      ]}
    >
      {card}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: theme.spacing.xxl },

  section: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.sm,
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
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.charcoal,
    lineHeight: 40,
    maxWidth: 760,
  },
  sub: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    maxWidth: 720,
  },

  billingToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  billingOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  billingOptionActive: { backgroundColor: theme.colors.charcoal },
  billingOptionText: { fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary },
  billingOptionTextActive: { color: '#fff' },

  plans: { gap: theme.spacing.md, marginTop: theme.spacing.lg },
  plansWide: { flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.lg },

  plan: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.xs,
  },
  planBundle: {
    backgroundColor: theme.colors.charcoal,
    borderWidth: 0,
  },
  planMobile: { width: '100%' },
  planWide: { flex: 1, flexBasis: 0, minWidth: 0 },

  bundleWrap: {
    padding: 2,
    borderRadius: theme.radius.lg + 2,
  },

  bundleBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  bundleBadgeHalf: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  bundleBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },

  planName: { fontSize: 22, fontWeight: '800', color: theme.colors.charcoal },
  planNameLight: { color: '#fff' },
  planTagline: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  planTaglineLight: { color: '#cbd5e1' },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: theme.spacing.md,
    gap: 6,
  },
  planPrice: { fontSize: 44, fontWeight: '800', color: theme.colors.charcoal, lineHeight: 48 },
  planPriceLight: { color: '#fff' },
  planPriceUnit: { color: theme.colors.textSecondary, fontSize: 14, paddingBottom: 6 },
  planPriceUnitLight: { color: '#cbd5e1' },
  planSetup: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  planSetupLight: { color: '#cbd5e1' },
  planYearTotal: { color: theme.colors.textSecondary, fontSize: 12 },
  planYearTotalLight: { color: '#94a3b8' },
  planSavings: { fontSize: 13, fontWeight: '700', marginTop: 4 },

  planDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  planFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  planFeatureCheck: { fontWeight: '800', fontSize: 14, lineHeight: 20 },
  planFeature: { color: theme.colors.charcoal, fontSize: 14, lineHeight: 20, flex: 1 },
  planFeatureLight: { color: '#cbd5e1' },

  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  planCta: { marginTop: theme.spacing.md, alignItems: 'center' },

  finePrint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: theme.spacing.md,
  },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
