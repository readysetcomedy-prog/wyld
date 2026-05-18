import { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';
import { QuoteForm } from '@/components/QuoteForm';
import { AnimatedPressable } from '@/components/AnimatedPressable';

type Feature = { icon: string; tint: string; title: string; body: string };

const FEATURES: Feature[] = [
  { icon: '🌐', tint: '#7C3AED', title: 'Your own website', body: 'A polished public site for your gym on your own domain — no web designer needed.' },
  { icon: '📅', tint: '#2563EB', title: 'Scheduling & booking', body: 'Publish classes, events, and open slots that members can book in seconds.' },
  { icon: '🔑', tint: '#0F766E', title: 'Smart-lock entry', body: 'Self-serve door access that checks membership and waivers before it opens.' },
  { icon: '💳', tint: '#16A34A', title: 'Memberships & offerings', body: 'Sell memberships, day passes, and prepaid plans with automatic discounts.' },
  { icon: '🛍️', tint: '#D97706', title: 'Retail store', body: 'Sell merch and add-ons online and at the front desk, inventory included.' },
  { icon: '👥', tint: '#E11D48', title: 'Staff & time cards', body: 'Manage employees and roles, track clock-ins, and export payroll-ready hours.' },
  { icon: '📣', tint: '#9333EA', title: 'Marketing materials', body: 'Flyers, social posts, and signage ready to share — on brand, every time.' },
  { icon: '📊', tint: '#0891B2', title: 'Analytics & reporting', body: 'See revenue and attendance at a glance, with tax-ready exports.' },
  { icon: '🏢', tint: '#475569', title: 'Multi-location', body: 'Run every location from one dashboard, each with its own site and pricing.' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How much does WyLD cost?',
    a: 'Pricing is built around your gym — your locations, your member count, and the features you actually turn on. Request a quote and we’ll send specifics.',
  },
  {
    q: 'Do I have to use every feature?',
    a: 'No. Turn on only what you need and add more as your gym grows — you’re never paying for things you don’t use.',
  },
  {
    q: 'Can I run more than one location?',
    a: 'Yes. Each location gets its own public site and its own pricing, all managed from a single dashboard.',
  },
  {
    q: 'Can members book classes online?',
    a: 'Yes — members can browse your site, book classes and events, and manage their membership online.',
  },
  {
    q: 'How does smart-lock entry work?',
    a: 'Members let themselves in through self-serve access that checks their membership and waiver first — wherever your gym has door hardware.',
  },
  {
    q: 'How do I get started?',
    a: 'Request a quote below. We’ll put together pricing and get your gym set up alongside you.',
  },
];

// Fades and lifts a section in once it scrolls into view.
function Reveal({
  children,
  scrollY,
  viewportH,
  onMeasure,
}: {
  children: React.ReactNode;
  scrollY: Animated.Value;
  viewportH: number;
  onMeasure?: (y: number) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const top = useRef<number | null>(null);
  const shown = useRef(false);

  const reveal = useCallback(() => {
    if (shown.current) return;
    shown.current = true;
    Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: false }).start();
  }, [anim]);

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      if (top.current != null && value + viewportH > top.current + 40) reveal();
    });
    // Safety net: never leave a section permanently hidden.
    const t = setTimeout(reveal, 2500);
    return () => {
      scrollY.removeListener(id);
      clearTimeout(t);
    };
  }, [scrollY, viewportH, reveal]);

  return (
    <Animated.View
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        top.current = y;
        onMeasure?.(y);
        if (y < viewportH) reveal();
      }}
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// Feature card that springs up and lights its border on hover.
function FeatureCard({ f, wide }: { f: Feature; wide: boolean }) {
  const h = useRef(new Animated.Value(0)).current;
  const to = (v: number) =>
    Animated.spring(h, { toValue: v, useNativeDriver: false, friction: 7, tension: 80 }).start();

  return (
    <Animated.View
      style={[
        styles.card,
        wide && styles.cardWide,
        {
          borderColor: h.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.border, f.tint],
          }),
          shadowOpacity: h.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.22] }),
          shadowRadius: h.interpolate({ inputRange: [0, 1], outputRange: [8, 28] }),
          transform: [
            { translateY: h.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
            { scale: h.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        },
      ]}
    >
      <Pressable onHoverIn={() => to(1)} onHoverOut={() => to(0)} style={styles.cardInner}>
        <View style={[styles.iconChip, { backgroundColor: f.tint }]}>
          <Text style={styles.iconText}>{f.icon}</Text>
        </View>
        <Text style={styles.cardTitle}>{f.title}</Text>
        <Text style={styles.cardBody}>{f.body}</Text>
      </Pressable>
    </Animated.View>
  );
}

// FAQ row that expands its answer on tap, with a rotating + indicator.
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  function toggle() {
    const next = !open;
    setOpen(next);
    Animated.timing(spin, { toValue: next ? 1 : 0, duration: 200, useNativeDriver: false }).start();
    if (next) {
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    }
  }

  return (
    <View style={styles.faqItem}>
      <Pressable onPress={toggle} style={styles.faqQRow}>
        <Text style={styles.faqQ}>{q}</Text>
        <Animated.Text
          style={[
            styles.faqPlus,
            {
              transform: [
                { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] }) },
              ],
            },
          ]}
        >
          +
        </Animated.Text>
      </Pressable>
      {open ? (
        <Animated.View style={{ opacity: fade }}>
          <Text style={styles.faqA}>{a}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function Home() {
  const { session, loading } = useAuth();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 768;
  const router = useRouter();

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const quoteY = useRef(0);

  const scrollToQuote = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, quoteY.current - 12), animated: true });
  }, []);

  // Hero entrance animation.
  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 600, useNativeDriver: false }).start();
  }, [intro]);

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={styles.container}
      stickyHeaderIndices={[0]}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      )}
    >
      <Nav onQuotePress={scrollToQuote} />

      {/* Hero */}
      <Animated.View
        style={[
          styles.hero,
          isWide && styles.heroWide,
          {
            opacity: intro,
            transform: [
              { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            ],
          },
        ]}
      >
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
          <AnimatedPressable onPress={scrollToQuote} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>Get a Quote</Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={() => router.push('/portfolio')}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>See our work</Text>
          </AnimatedPressable>
        </View>
      </Animated.View>

      {/* Highlights strip */}
      <Reveal scrollY={scrollY} viewportH={height}>
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
      </Reveal>

      {/* Feature grid */}
      <Reveal scrollY={scrollY} viewportH={height}>
        <View style={styles.featureBand}>
          <View style={[styles.sectionInner, isWide && styles.sectionInnerWide]}>
            <Text style={styles.sectionEyebrow}>WHAT&apos;S INSIDE</Text>
            <Text style={[styles.sectionTitle, isWide && styles.sectionTitleWide]}>
              Every part of your gym, working together.
            </Text>
            <Text style={styles.sectionSub}>
              No more stitching six different tools together. It&apos;s all one product.
            </Text>
            <View style={[styles.grid, isWide && styles.gridWide]}>
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} f={f} wide={isWide} />
              ))}
            </View>
          </View>
        </View>
      </Reveal>

      {/* FAQ */}
      <Reveal scrollY={scrollY} viewportH={height}>
        <View style={styles.faqBand}>
          <View style={[styles.sectionInner, isWide && styles.sectionInnerWide]}>
            <Text style={styles.sectionEyebrow}>QUESTIONS</Text>
            <Text style={[styles.sectionTitle, isWide && styles.sectionTitleWide]}>
              Frequently asked.
            </Text>
            <View style={styles.faqList}>
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </View>
          </View>
        </View>
      </Reveal>

      {/* Quote section */}
      <Reveal scrollY={scrollY} viewportH={height} onMeasure={(y) => (quoteY.current = y)}>
        <View style={[styles.quoteBand, isWide && styles.quoteBandWide]}>
          <View style={styles.quoteInner}>
            <Text style={styles.quoteEyebrow}>GET A QUOTE</Text>
            <Text style={[styles.quoteTitle, isWide && styles.quoteTitleWide]}>
              Let&apos;s build your quote.
            </Text>
            <Text style={styles.quoteSub}>
              Fill in a few details about your gym and we&apos;ll send back pricing built
              around it — usually within a day.
            </Text>
            <View style={styles.quoteCard}>
              <QuoteForm />
            </View>
          </View>
        </View>
      </Reveal>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.offWhite },
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
  primaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: theme.colors.wyldPurple,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  secondaryBtn: {
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
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
    backgroundColor: theme.colors.offWhite,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  faqBand: {
    backgroundColor: '#fff',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  sectionInner: { gap: theme.spacing.sm },
  sectionInnerWide: {
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
  },
  cardWide: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 260,
    marginHorizontal: '1%',
    marginBottom: theme.spacing.md,
  },
  cardInner: { padding: theme.spacing.lg, gap: theme.spacing.sm },
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

  faqList: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  faqItem: {
    backgroundColor: theme.colors.offWhite,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  faqQRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  faqQ: { fontSize: 16, fontWeight: '700', color: theme.colors.charcoal, flex: 1 },
  faqPlus: { fontSize: 24, fontWeight: '800', color: theme.colors.wyldPurple, lineHeight: 24 },
  faqA: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 23,
    marginTop: theme.spacing.sm,
  },

  quoteBand: {
    backgroundColor: theme.colors.charcoal,
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  quoteBandWide: { paddingVertical: 80 },
  quoteInner: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    gap: theme.spacing.sm,
  },
  quoteEyebrow: {
    color: '#a78bfa',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  quoteTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 36,
  },
  quoteTitleWide: { fontSize: 40, lineHeight: 46 },
  quoteSub: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
    maxWidth: 560,
    marginBottom: theme.spacing.md,
  },
  quoteCard: {
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    paddingVertical: theme.spacing.lg,
    fontSize: 13,
    backgroundColor: theme.colors.offWhite,
  },
});
