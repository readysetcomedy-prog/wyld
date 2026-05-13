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
import {
  theme,
  WYLD_INC_LOGO_URL,
  LOGO_URL,
  SITE_LOGO_URL,
} from '@/lib/theme';
import { Nav } from '@/components/Nav';

export default function Home() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Nav logoUrl={WYLD_INC_LOGO_URL} accent={theme.colors.wyldPurple} />

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <Image
          source={{ uri: WYLD_INC_LOGO_URL }}
          style={styles.bigLogo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Software that just works.</Text>
        <Text style={styles.sub}>
          WyLD Inc builds tools that solve real problems for real businesses. Pick what
          you need.
        </Text>
      </View>

      <View style={[styles.products, isWide && styles.productsWide]}>
        <Link href="/pass" asChild>
          <Pressable
            style={StyleSheet.flatten([
              styles.productCard,
              { borderColor: theme.colors.teal },
              isWide && styles.productCardWide,
            ])}
          >
            <Image source={{ uri: LOGO_URL }} style={styles.productLogo} resizeMode="contain" />
            <Text style={[styles.productName, { color: theme.colors.teal }]}>WyLD Pass</Text>
            <Text style={styles.productTagline}>
              Self-serve gym access. Smart lock, in-app payments, built-in waiver. Members
              let themselves in — the door enforces payment.
            </Text>
            <Text style={[styles.productLink, { color: theme.colors.teal }]}>
              Learn about WyLD Pass →
            </Text>
          </Pressable>
        </Link>

        <Link href="/site" asChild>
          <Pressable
            style={StyleSheet.flatten([
              styles.productCard,
              { borderColor: theme.colors.siteRed },
              isWide && styles.productCardWide,
            ])}
          >
            <Image
              source={{ uri: SITE_LOGO_URL }}
              style={styles.productLogo}
              resizeMode="contain"
            />
            <Text style={[styles.productName, { color: theme.colors.siteRed }]}>WyLD Site</Text>
            <Text style={styles.productTagline}>
              A real website for your gym. Custom design, free domain, payments, schedule,
              booking, retail, staff management — every module toggleable.
            </Text>
            <Text style={[styles.productLink, { color: theme.colors.siteRed }]}>
              Learn about WyLD Site →
            </Text>
          </Pressable>
        </Link>
      </View>

      <View style={[styles.aboutBand, isWide && styles.aboutBandWide]}>
        <View style={styles.aboutInner}>
          <Text style={styles.aboutEyebrow}>WyLD Inc</Text>
          <Text style={styles.aboutTitle}>You have problems. We build solutions.</Text>
          <Text style={styles.aboutBody}>
            You focus on your business. Let us focus on making that as easy and convenient
            as possible.
          </Text>
          <Link href="/about" asChild>
            <Pressable style={StyleSheet.flatten([styles.cta, styles.ctaPurple])}>
              <Text style={styles.ctaText}>About WyLD Inc</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} WyLD Inc</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingBottom: theme.spacing.xxl },

  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  heroWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 80,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  bigLogo: { width: '100%', maxWidth: 240, aspectRatio: 1 },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: theme.colors.charcoal,
    textAlign: 'center',
    maxWidth: 720,
    lineHeight: 44,
  },
  sub: {
    fontSize: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 26,
  },

  products: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  productsWide: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    paddingBottom: 72,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  productCard: {
    width: '100%',
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  productCardWide: { flex: 1, flexBasis: 0, minWidth: 0 },
  productLogo: { width: 96, height: 96 },
  productName: { fontSize: 28, fontWeight: '800' },
  productTagline: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 360,
  },
  productLink: { fontSize: 15, fontWeight: '700', marginTop: theme.spacing.xs },

  aboutBand: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    backgroundColor: theme.colors.charcoal,
  },
  aboutBandWide: { paddingHorizontal: theme.spacing.xxl, paddingVertical: 72 },
  aboutInner: {
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    gap: theme.spacing.sm,
  },
  aboutEyebrow: {
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  aboutTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 36,
    maxWidth: 720,
  },
  aboutBody: {
    fontSize: 15,
    color: '#cbd5e1',
    lineHeight: 22,
    maxWidth: 720,
    marginBottom: theme.spacing.md,
  },

  cta: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  ctaPurple: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
