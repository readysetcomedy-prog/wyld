import { Redirect } from 'expo-router';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme, WYLD_INC_LOGO_URL } from '@/lib/theme';
import { Nav } from '@/components/Nav';
import { QuoteButton } from '@/components/QuoteButton';

export default function About() {
  const { session, loading } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (loading) return null;
  if (session) return <Redirect href="/dashboard" />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Nav />

      <View style={[styles.hero, isWide && styles.heroWide]}>
        <Image source={{ uri: WYLD_INC_LOGO_URL }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.eyebrow}>ABOUT</Text>
        <Text style={[styles.title, isWide && styles.titleWide]}>
          One platform, built to run a gym.
        </Text>
        <Text style={styles.sub}>
          WyLD Inc makes a single, complete product for gym owners — so running your gym
          doesn&apos;t mean juggling a pile of disconnected tools.
        </Text>
      </View>

      <View style={[styles.section, isWide && styles.sectionWide]}>
        <Text style={styles.h2}>Why we built it</Text>
        <Text style={styles.body}>
          Most gyms run on a patchwork: one tool for the website, another for scheduling,
          another for the door, a spreadsheet for staff hours. Nothing talks to anything
          else, and every piece is another bill and another login.
        </Text>
        <Text style={styles.body}>
          We built WyLD as one connected platform instead. Your website, scheduling,
          memberships, smart-lock entry, retail, staff, marketing, and reporting all live
          together — turn on what you need, leave the rest off, and add more as you grow.
        </Text>

        <Text style={styles.h2}>How we work</Text>
        <Text style={styles.body}>
          We price every gym on what it actually uses. Tell us about your locations and
          members and we&apos;ll put together a quote — no generic tiers, no paying for
          features you don&apos;t want.
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
  container: { paddingBottom: theme.spacing.xxl },

  hero: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  heroWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: 64,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  logo: { width: 120, height: 120, marginBottom: theme.spacing.xs },
  eyebrow: {
    color: theme.colors.wyldPurple,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.colors.charcoal,
    textAlign: 'center',
    lineHeight: 38,
    maxWidth: 640,
  },
  titleWide: { fontSize: 44, lineHeight: 50 },
  sub: {
    fontSize: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    maxWidth: 600,
    lineHeight: 26,
  },

  section: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  sectionWide: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.xl,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  h2: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.charcoal,
    marginTop: theme.spacing.md,
  },
  body: { fontSize: 16, color: theme.colors.textSecondary, lineHeight: 26 },
  ctaRow: { marginTop: theme.spacing.lg, flexDirection: 'row' },

  footer: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    fontSize: 13,
  },
});
