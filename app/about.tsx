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

export default function About() {
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
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.eyebrow}>About</Text>
        <Text style={styles.title}>WyLD Inc</Text>
        <Text style={styles.sub}>
          The umbrella company behind WyLD Pass and WyLD Site. We build software for the
          businesses the big platforms ignore.
        </Text>
      </View>

      <View style={[styles.section, isWide && styles.sectionWide]}>
        <Text style={styles.h2}>What we're about</Text>
        <Text style={styles.body}>
          Small business owners spend hundreds of dollars a month, and hours of their
          week, on stuff that should just happen on its own. Chasing payments. Keys that
          walk off. Spreadsheets at tax time. Websites that look like they were built in
          2009.
        </Text>
        <Text style={styles.body}>
          WyLD Inc builds the boring software that fixes those problems. We pick one
          problem, build until it actually works, ship it, then look at the next one.
          We're not trying to be a platform. We don't have a 20-person sales team and we
          don't want one.
        </Text>
        <Text style={styles.body}>
          Two products today. More when our customers ask for them.
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
              Self-serve access control. Smart lock, in-app payments, built-in waiver.
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
              A real website for your business. Schedule, booking, payments, retail, staff
              time cards.
            </Text>
            <Text style={[styles.productLink, { color: theme.colors.siteRed }]}>
              Learn about WyLD Site →
            </Text>
          </Pressable>
        </Link>
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
    gap: theme.spacing.sm,
  },
  heroWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 72,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  logo: { width: '100%', maxWidth: 160, aspectRatio: 1, marginBottom: theme.spacing.sm },
  eyebrow: {
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: theme.colors.charcoal,
    textAlign: 'center',
  },
  sub: {
    fontSize: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 640,
    lineHeight: 26,
  },

  section: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xl,
    maxWidth: 880,
    width: '100%',
    alignSelf: 'center',
  },
  h2: { fontSize: 26, fontWeight: '800', color: theme.colors.charcoal },
  body: { fontSize: 16, color: theme.colors.textSecondary, lineHeight: 26 },

  products: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  productsWide: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 72,
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
  productLogo: { width: 80, height: 80 },
  productName: { fontSize: 24, fontWeight: '800' },
  productTagline: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  productLink: { fontSize: 14, fontWeight: '700', marginTop: theme.spacing.xs },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    fontSize: 13,
  },
});
