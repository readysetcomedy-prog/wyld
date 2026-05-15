import { View, Text, StyleSheet, Pressable, useWindowDimensions, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { Slideshow } from '@/components/Slideshow';
import { GymHours, hasAnyHours } from '@/components/GymHours';
import { getPresetStyles } from '@/lib/stylePresets';
import { rgba } from '@/lib/colors';

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

  const primary = site.theme.primary_color;
  const accent = site.theme.accent_color;
  const preset = getPresetStyles(site.theme.style_preset, primary);
  const fullbleed = site.theme.hero_variant === 'fullbleed' && gallery.length > 0;
  const showDividers = site.theme.section_dividers;

  const introParas = body.split('\n').filter((p) => p.trim());
  const showHours = hasAnyHours(site.settings.hours);

  const cardStyle = {
    backgroundColor: preset.card.backgroundColor,
    borderRadius: preset.card.borderRadius,
    borderWidth: preset.card.borderWidth,
    borderColor: preset.card.borderColor,
    shadowColor: '#0f172a',
    shadowOpacity: preset.card.shadowOpacity,
    shadowRadius: preset.card.shadowRadius,
    shadowOffset: { width: 0, height: 4 },
  };

  const headlineStyle = {
    color: fullbleed ? '#fff' : primary,
    fontWeight: preset.headline.fontWeight,
    textTransform: preset.headline.textTransform,
    letterSpacing: preset.headline.letterSpacing,
  } as const;

  const CTAs = (
    <View style={styles.ctaRow}>
      <Pressable
        style={[styles.cta, { backgroundColor: accent }]}
        onPress={() => router.push(`/g/${slug}/join` as never)}
      >
        <Text style={styles.ctaText}>Become a member</Text>
      </Pressable>
      {site.modules.services_enabled ? (
        <Pressable
          style={[
            styles.ctaOutline,
            { borderColor: fullbleed ? '#fff' : primary },
          ]}
          onPress={() => router.push(`/g/${slug}/services` as never)}
        >
          <Text
            style={[
              styles.ctaOutlineText,
              { color: fullbleed ? '#fff' : primary },
            ]}
          >
            See services
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const heroTextBlock = (
    <View style={[styles.heroText, isWide && !fullbleed && styles.heroTextWide]}>
      <Text style={[styles.h1, headlineStyle]}>{headline}</Text>
      {subheadline ? (
        <Text style={[styles.heroSub, fullbleed && { color: 'rgba(255,255,255,0.92)' }]}>
          {subheadline}
        </Text>
      ) : null}
      {CTAs}
    </View>
  );

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      {fullbleed ? (
        <ImageBackground
          source={{ uri: gallery[0] }}
          style={styles.heroFull}
          imageStyle={{ borderRadius: preset.card.borderRadius }}
        >
          <View
            style={[
              styles.heroFullOverlay,
              {
                backgroundColor: `rgba(0,0,0,${preset.heroOverlay})`,
                borderRadius: preset.card.borderRadius,
              },
            ]}
          />
          <View style={styles.heroFullInner}>{heroTextBlock}</View>
        </ImageBackground>
      ) : (
        <View style={[styles.hero, isWide && styles.heroWide]}>
          {heroTextBlock}
          <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
            {gallery.length > 0 ? (
              <Slideshow
                urls={gallery}
                aspectRatio={isWide ? 16 / 10 : 4 / 3}
                backgroundColor="#f8fafc"
              />
            ) : (
              <View
                style={[
                  styles.heroPlaceholder,
                  { backgroundColor: primary, borderRadius: preset.card.borderRadius },
                ]}
              />
            )}
          </View>
        </View>
      )}

      {showDividers ? (
        <View style={styles.dividerWrap}>
          <View style={[styles.divider, { backgroundColor: preset.sectionTint }]} />
        </View>
      ) : null}

      {introParas.length > 0 ? (
        <View
          style={[
            styles.introCard,
            cardStyle,
            preset.sectionTint !== 'transparent' && { backgroundColor: preset.sectionTint },
            { borderLeftWidth: 4, borderLeftColor: primary },
          ]}
        >
          {introParas.map((para, i) => (
            <Text key={i} style={styles.bodyPara}>
              {para}
            </Text>
          ))}
        </View>
      ) : null}

      {showHours ? (
        <View style={[styles.hoursCard, cardStyle]}>
          <GymHours hours={site.settings.hours ?? {}} primaryColor={primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 24, gap: 36 },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 56,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    gap: 48,
  },
  hero: { gap: 24 },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  heroText: { gap: 16 },
  heroTextWide: { flex: 1 },
  h1: { fontSize: 40, lineHeight: 48 },
  heroSub: { fontSize: 18, color: '#475569', lineHeight: 28 },
  ctaRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 8 },
  cta: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ctaOutline: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, borderWidth: 2 },
  ctaOutlineText: { fontWeight: '700', fontSize: 15 },
  heroVisual: { width: '100%' },
  heroVisualWide: { flex: 1.15 },
  heroPlaceholder: { width: '100%', aspectRatio: 16 / 10, opacity: 0.1 },

  heroFull: {
    width: '100%',
    minHeight: 360,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroFullOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroFullInner: {
    padding: 32,
    maxWidth: 720,
  },

  dividerWrap: { height: 32, marginVertical: -8, overflow: 'hidden' },
  divider: {
    height: 64,
    width: '120%',
    marginLeft: '-10%',
    transform: [{ skewY: '-2deg' }],
  },

  introCard: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  bodyPara: { fontSize: 16, color: '#0F172A', lineHeight: 26 },
  hoursCard: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    shadowOffset: { width: 0, height: 4 },
    alignSelf: 'flex-start',
    maxWidth: 520,
    width: '100%',
  },
});
