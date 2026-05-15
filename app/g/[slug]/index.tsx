import { View, Text, StyleSheet, Pressable, useWindowDimensions, ImageBackground, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { Slideshow } from '@/components/Slideshow';
import { GymHours, hasAnyHours } from '@/components/GymHours';
import { StyledBlock, BlockStyle } from '@/components/StyledBlock';
import { getPresetStyles } from '@/lib/stylePresets';

export default function Home() {
  const site = useGymSite();
  const { slug, loc: rawLoc } = useLocalSearchParams<{ slug: string; loc?: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  // Multi-location landing: visitor hasn't picked a location and the gym has
  // multiple. Show a chooser instead of a full site.
  const showPickerLanding =
    site.multiLocationEnabled && site.locations.length > 1 && !rawLoc;

  if (showPickerLanding) {
    return (
      <View style={[pickerStyles.page, isWide && pickerStyles.pageWide]}>
        {site.theme.logo_url ? (
          <Image source={{ uri: site.theme.logo_url }} style={pickerStyles.logo} resizeMode="contain" />
        ) : null}
        <Text style={[pickerStyles.title, { color: site.theme.primary_color }]}>
          {site.gym.name}
        </Text>
        <Text style={pickerStyles.sub}>Pick a location to continue.</Text>
        <View style={pickerStyles.grid}>
          {site.locations.map((l) => (
            <Pressable
              key={l.id}
              style={[pickerStyles.tile, { borderColor: site.theme.accent_color }]}
              onPress={() => router.push(`/g/${slug}?loc=${l.slug}` as never)}
            >
              <Text style={[pickerStyles.tileTitle, { color: site.theme.primary_color }]}>
                {l.label}
              </Text>
              {l.address_line1 ? (
                <Text style={pickerStyles.tileMeta}>
                  {l.address_line1}
                  {l.city ? `, ${l.city}` : ''}
                  {l.state ? `, ${l.state}` : ''}
                </Text>
              ) : null}
              {l.is_primary ? (
                <View
                  style={[pickerStyles.primaryBadge, { backgroundColor: site.theme.accent_color }]}
                >
                  <Text style={pickerStyles.primaryBadgeText}>Primary</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const page = site.pages.home ?? {};
  const blockStyles: Record<string, BlockStyle> = (page.styles ?? {}) as any;

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

  const headlineStyle = {
    color: fullbleed ? '#fff' : primary,
    fontWeight: preset.headline.fontWeight,
    textTransform: preset.headline.textTransform,
    letterSpacing: preset.headline.letterSpacing,
  } as const;

  const locQuery = site.currentLocation?.slug ? `?loc=${site.currentLocation.slug}` : '';
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
          style={[styles.ctaOutline, { borderColor: fullbleed ? '#fff' : primary }]}
          onPress={() => router.push(`/g/${slug}/services${locQuery}` as never)}
        >
          <Text style={[styles.ctaOutlineText, { color: fullbleed ? '#fff' : primary }]}>
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
        <StyledBlock
          style={blockStyles.intro}
          defaults={{ tint: true, stripe: true, width: 'wide', align: 'left' }}
        >
          {introParas.map((para, i) => (
            <Text key={i} style={[styles.bodyPara, { textAlign: blockStyles.intro?.align ?? 'left' }]}>
              {para}
            </Text>
          ))}
        </StyledBlock>
      ) : null}

      {showHours ? (
        <StyledBlock
          style={blockStyles.hours}
          defaults={{ box: true, width: 'narrow', align: 'left' }}
        >
          <GymHours hours={site.settings.hours ?? {}} primaryColor={primary} />
        </StyledBlock>
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
  heroFullOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroFullInner: { padding: 32, maxWidth: 720 },

  dividerWrap: { height: 32, marginVertical: -8, overflow: 'hidden' },
  divider: {
    height: 64,
    width: '120%',
    marginLeft: '-10%',
    transform: [{ skewY: '-2deg' }],
  },

  bodyPara: { fontSize: 16, color: '#0F172A', lineHeight: 26 },
});

const pickerStyles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 16,
  },
  pageWide: { paddingVertical: 80 },
  logo: { width: 96, height: 96, marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '800', textAlign: 'center' },
  sub: { fontSize: 16, color: '#475569', textAlign: 'center', marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    maxWidth: 880,
  },
  tile: {
    width: 280,
    padding: 20,
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 6,
    position: 'relative',
  },
  tileTitle: { fontSize: 20, fontWeight: '800' },
  tileMeta: { fontSize: 13, color: '#475569', lineHeight: 18 },
  primaryBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  primaryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
});
