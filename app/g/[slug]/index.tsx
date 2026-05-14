import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { Slideshow } from '@/components/Slideshow';
import { GymHours, hasAnyHours } from '@/components/GymHours';

export default function Home() {
  const site = useGymSite();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const page = site.pages.home ?? {};

  const headline = page.headline || `Welcome to ${site.gym.name}`;
  const subheadline = page.subheadline || '';
  const body: string = page.body || '';
  const gallery: string[] = page.gallery ?? [];

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={[styles.heroText, isWide && styles.heroTextWide]}>
          <Text style={[styles.h1, { color: site.theme.primary_color }]}>{headline}</Text>
          {subheadline ? (
            <Text style={styles.heroSub}>{subheadline}</Text>
          ) : null}
          <View style={styles.ctaRow}>
            <Pressable
              style={[styles.cta, { backgroundColor: site.theme.accent_color }]}
              onPress={() => router.push(`/g/${slug}/join` as never)}
            >
              <Text style={styles.ctaText}>Become a member</Text>
            </Pressable>
            <Pressable
              style={[styles.ctaOutline, { borderColor: site.theme.primary_color }]}
              onPress={() => router.push(`/g/${slug}/services` as never)}
            >
              <Text style={[styles.ctaOutlineText, { color: site.theme.primary_color }]}>See services</Text>
            </Pressable>
          </View>
        </View>
        <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
          {gallery.length > 0 ? (
            <Slideshow urls={gallery} />
          ) : (
            <View style={[styles.heroPlaceholder, { backgroundColor: site.theme.primary_color }]} />
          )}
        </View>
      </View>

      {body ? (
        <View style={styles.intro}>
          {body.split('\n').filter((p) => p.trim()).map((para, i) => (
            <Text key={i} style={styles.bodyPara}>{para}</Text>
          ))}
        </View>
      ) : null}

      {hasAnyHours(site.settings.hours) ? (
        <GymHours hours={site.settings.hours ?? {}} primaryColor={site.theme.primary_color} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 24, gap: 32 },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 56,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { gap: 24 },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  heroText: { gap: 16 },
  heroTextWide: { flex: 1 },
  h1: { fontSize: 40, fontWeight: '800', lineHeight: 48 },
  heroSub: { fontSize: 18, color: '#475569', lineHeight: 28 },
  ctaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  cta: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaOutline: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, borderWidth: 2 },
  ctaOutlineText: { fontWeight: '700', fontSize: 15 },
  heroVisual: { width: '100%' },
  heroVisualWide: { flex: 1 },
  heroPlaceholder: { width: '100%', aspectRatio: 16 / 9, borderRadius: 16, opacity: 0.1 },
  intro: { gap: 12, maxWidth: 760 },
  bodyPara: { fontSize: 16, color: '#0F172A', lineHeight: 26 },
});
