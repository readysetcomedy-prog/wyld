import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Slot,
  useLocalSearchParams,
  useGlobalSearchParams,
  useRouter,
  usePathname,
} from 'expo-router';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { GymSiteProvider, GymSite, GymSiteLocation } from '@/components/GymSiteContext';
import { SocialIcons } from '@/components/SocialIcons';
import { PhoneLink, EmailLink } from '@/components/ContactLink';
import { WYLD_INC_LOGO_URL } from '@/lib/theme';

const DEFAULT_MODULES = {
  calendar_enabled: false,
  store_enabled: false,
  news_enabled: false,
  faq_enabled: false,
  bookings_enabled: false,
  about_enabled: true,
  services_enabled: true,
  contact_enabled: true,
  news_visible: true,
  faq_visible: true,
  store_visible: true,
  applications_enabled: false,
};
const DEFAULT_THEME = {
  primary_color: '#0F172A',
  accent_color: '#14B8A6',
  logo_url: null,
  style_preset: 'clean' as const,
  hero_variant: 'split' as const,
  section_dividers: false,
};
const DEFAULT_SETTINGS = {
  contact_email: null,
  contact_phone: null,
  address_line1: null,
  city: null,
  state: null,
  zip: null,
  hours: null,
  social_instagram: null,
  social_facebook: null,
  social_x: null,
  social_tiktok: null,
};

function normalizeTheme(row: any) {
  if (!row) return null;
  return {
    primary_color: row.primary_color ?? DEFAULT_THEME.primary_color,
    accent_color: row.accent_color ?? DEFAULT_THEME.accent_color,
    logo_url: row.logo_url ?? null,
    style_preset: row.style_preset ?? 'clean',
    hero_variant: row.hero_variant ?? 'split',
    section_dividers: !!row.section_dividers,
  };
}

export default function SiteLayout() {
  // useLocalSearchParams in a layout only reliably returns path params (slug).
  // Query-string params like ?loc= need useGlobalSearchParams to surface here.
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>();
  const { loc: rawLoc } = useGlobalSearchParams<{ loc?: string }>();
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
  const locParam = typeof rawLoc === 'string' && rawLoc ? rawLoc.toLowerCase() : null;
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [site, setSite] = useState<GymSite | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Mobile nav scroll-more indicator
  const [navMore, setNavMore] = useState(false);
  const navViewportW = useRef(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data: gym, error: gymErr } = await supabase
        .from('gyms')
        .select('id, name, slug, city, state')
        .eq('slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (gymErr) {
        setLoadError(gymErr.message);
        return;
      }
      if (!gym) {
        setNotFound(true);
        return;
      }
      const [
        { data: modules, error: modErr },
        { data: settings, error: setErr },
        { data: locationRows, error: locErr },
      ] = await Promise.all([
        supabase.from('gym_modules').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_site_settings').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase
          .from('gym_locations')
          .select('*')
          .eq('gym_id', gym.id)
          .order('display_order'),
      ]);
      if (cancelled) return;
      const firstErr = modErr || setErr || locErr;
      if (firstErr) {
        setLoadError(firstErr.message);
        return;
      }

      // Paused locations are hidden from the public site. Filter in JS (not
      // the query) so a database that hasn't run the is_paused migration yet
      // — where the column is simply absent — still loads instead of erroring.
      const locations: GymSiteLocation[] = ((locationRows ?? []) as any[]).filter(
        (l) => !l.is_paused
      );
      const multiLocationEnabled = !!(modules as any)?.multi_location_enabled;

      // Resolve the current location strictly from the URL. No auto-fallback
      // to a "primary" location — locations are equal. If multi-location is on
      // and no loc is in the URL, the home page renders the picker landing.
      let currentLocation: GymSiteLocation | null = null;
      if (locParam) {
        currentLocation =
          locations.find((l) => l.slug?.toLowerCase() === locParam) ?? null;
      }

      // Fetch theme & pages for both the gym default (location_id IS NULL) and
      // the current location (if any). Merge: per-location wins over default.
      const themeReqs: Promise<any>[] = [
        supabase
          .from('gym_themes')
          .select('*')
          .eq('gym_id', gym.id)
          .is('location_id', null)
          .maybeSingle(),
      ];
      const pagesReqs: Promise<any>[] = [
        supabase
          .from('gym_pages')
          .select('page_key, content')
          .eq('gym_id', gym.id)
          .is('location_id', null),
      ];
      if (currentLocation) {
        themeReqs.push(
          supabase
            .from('gym_themes')
            .select('*')
            .eq('gym_id', gym.id)
            .eq('location_id', currentLocation.id)
            .maybeSingle()
        );
        pagesReqs.push(
          supabase
            .from('gym_pages')
            .select('page_key, content')
            .eq('gym_id', gym.id)
            .eq('location_id', currentLocation.id)
        );
      }
      const [
        [{ data: defaultTheme }, ...locThemeArr],
        [{ data: defaultPages }, ...locPagesArr],
      ] = (await Promise.all([Promise.all(themeReqs), Promise.all(pagesReqs)])) as any[];
      if (cancelled) return;

      const baseTheme = normalizeTheme(defaultTheme) ?? DEFAULT_THEME;
      const locTheme = normalizeTheme(locThemeArr?.[0]?.data);
      const mergedTheme = locTheme ? { ...baseTheme, ...filterNonNull(locTheme) } : baseTheme;

      const pagesMap: Record<string, any> = {};
      (defaultPages ?? []).forEach((row: any) => {
        pagesMap[row.page_key] = row.content ?? {};
      });
      (locPagesArr?.[0]?.data ?? []).forEach((row: any) => {
        pagesMap[row.page_key] = row.content ?? {};
      });

      setSite({
        gym,
        theme: mergedTheme,
        modules: { ...DEFAULT_MODULES, ...(modules ?? {}) },
        settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
        pages: pagesMap,
        locations,
        currentLocation,
        multiLocationEnabled,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, locParam]);

  // Tab title + favicon, restored on unmount.
  const originalTitleRef = useRef<string | null>(null);
  const originalFaviconRef = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    originalTitleRef.current = document.title;
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    originalFaviconRef.current = link?.href ?? null;
    return () => {
      if (originalTitleRef.current !== null) document.title = originalTitleRef.current;
      const l = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (l && originalFaviconRef.current) l.href = originalFaviconRef.current;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (site) {
      const locName = site.currentLocation?.label;
      document.title = locName ? `${site.gym.name} — ${locName}` : site.gym.name;
      if (site.theme.logo_url) {
        let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = site.theme.logo_url;
      }
    }
  }, [site]);

  // Build path-with-current-location query string for nav links.
  const locQuery = useMemo(() => {
    if (!site?.currentLocation?.slug) return '';
    return `?loc=${site.currentLocation.slug}`;
  }, [site?.currentLocation?.slug]);

  if (loadError) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Couldn't load gym</Text>
        <Text style={styles.notFoundBody}>{loadError}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => {
            setLoadError(null);
            setSite(null);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Gym not found</Text>
        <Text style={styles.notFoundBody}>
          No gym matches the URL <Text style={styles.mono}>/g/{slug}</Text>.
        </Text>
        <Pressable style={styles.retry} onPress={() => router.replace('/' as never)}>
          <Text style={styles.retryText}>Go home</Text>
        </Pressable>
      </View>
    );
  }

  if (!site) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#0F172A" />
      </View>
    );
  }

  const primary = site.theme.primary_color;
  const accent = site.theme.accent_color;

  // When multi_location is on, the visitor must pick a location before they
  // get the rest of the nav. Hide nav while no location is chosen.
  const showPickerLanding =
    site.multiLocationEnabled && site.locations.length > 1 && !locParam;

  const m = site.modules;
  const showStore = m.store_enabled && m.store_visible;
  const showNews = m.news_enabled && m.news_visible;
  const showFaq = m.faq_enabled && m.faq_visible;
  const NAV: { label: string; path: string }[] = showPickerLanding
    ? []
    : [
        { label: 'Home', path: `/g/${slug}${locQuery}` },
        ...(m.services_enabled
          ? [{ label: 'Services', path: `/g/${slug}/services${locQuery}` }]
          : []),
        ...(m.calendar_enabled
          ? [{ label: 'Schedule', path: `/g/${slug}/schedule${locQuery}` }]
          : []),
        ...(showStore ? [{ label: 'Store', path: `/g/${slug}/store${locQuery}` }] : []),
        ...(m.about_enabled
          ? [{ label: 'About', path: `/g/${slug}/about${locQuery}` }]
          : []),
        ...(showNews ? [{ label: 'News', path: `/g/${slug}/news${locQuery}` }] : []),
        ...(showFaq ? [{ label: 'FAQ', path: `/g/${slug}/faq${locQuery}` }] : []),
        ...(m.applications_enabled
          ? [{ label: 'Careers', path: `/g/${slug}/careers${locQuery}` }]
          : []),
        ...(m.contact_enabled
          ? [{ label: 'Contact', path: `/g/${slug}/contact${locQuery}` }]
          : []),
      ];

  return (
    <GymSiteProvider value={site}>
      <ScrollView style={[styles.root, { backgroundColor: '#fff' }]} contentContainerStyle={styles.container}>
        <View style={[styles.header, isWide && styles.headerWide, { borderBottomColor: '#e2e8f0' }]}>
          <Pressable
            style={styles.brand}
            onPress={() =>
              router.push(
                (showPickerLanding ? `/g/${slug}` : `/g/${slug}${locQuery}`) as never
              )
            }
            accessibilityLabel={site.gym.name}
          >
            {site.theme.logo_url ? (
              <Image source={{ uri: site.theme.logo_url }} style={styles.logo} resizeMode="contain" />
            ) : null}
            <View>
              <Text style={[styles.brandName, { color: primary }]}>{site.gym.name}</Text>
              {site.currentLocation ? (
                <Text style={styles.brandLocation}>{site.currentLocation.label}</Text>
              ) : null}
            </View>
          </Pressable>

          {NAV.length > 0 ? (
            <View style={styles.navWrap}>
              <ScrollView
                horizontal={!isWide}
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => {
                  const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                  setNavMore(
                    contentOffset.x + layoutMeasurement.width < contentSize.width - 4
                  );
                }}
                onContentSizeChange={(w) => {
                  if (navViewportW.current > 0) {
                    setNavMore(w > navViewportW.current + 4);
                  }
                }}
                onLayout={(e) => {
                  navViewportW.current = e.nativeEvent.layout.width;
                }}
                contentContainerStyle={[styles.nav, isWide && styles.navWide]}
              >
                {NAV.map((item) => {
                  const itemPath = item.path.split('?')[0];
                  const isActive =
                    pathname === itemPath ||
                    (item.label === 'Home' && pathname === `/g/${slug}`);
                  return (
                    <Pressable key={item.path} onPress={() => router.push(item.path as never)}>
                      <Text
                        style={[
                          styles.navItem,
                          { color: isActive ? accent : '#475569' },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {site.multiLocationEnabled && site.locations.length > 1 ? (
                  <Pressable
                    onPress={() => router.push(`/g/${slug}` as never)}
                    style={styles.locSwitchBtn}
                  >
                    <Text style={styles.locSwitchBtnText}>Switch location</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => router.push(`/g/${slug}/login` as never)}
                  style={[styles.loginBtn, { backgroundColor: accent }]}
                >
                  <Text style={styles.loginBtnText}>Member login</Text>
                </Pressable>
              </ScrollView>
              {!isWide && navMore ? (
                <View style={styles.navFade} pointerEvents="none">
                  <Text style={[styles.navFadeChevron, { color: accent }]}>›</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Slot />

        <View style={[styles.footer, { backgroundColor: primary }]}>
          <View style={[styles.footerTop, isWide && styles.footerTopWide]}>
            {NAV.length > 0 ? (
              <View style={styles.footerNavCol}>
                <Text style={styles.footerColTitle}>Explore</Text>
                {NAV.map((item) => (
                  <Pressable
                    key={item.path}
                    onPress={() => router.push(item.path as never)}
                  >
                    <Text style={styles.footerNavLink}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.footerAppCol}>
              <Text style={styles.footerAppTitle}>
                Download the WyLD Inc app to take full advantage of all{' '}
                {site.gym.name}&apos;s features
              </Text>
              <View style={styles.storeBadges}>
                <StoreBadge supertext="Download on the" main="App Store" glyph="" />
                <StoreBadge supertext="Get it on" main="Google Play" glyph="▶" />
              </View>
              <View style={styles.featureList}>
                {[
                  { label: 'Book a class', note: null },
                  { label: 'Find a gym buddy', note: null },
                  { label: 'Talk to other members', note: null },
                  {
                    label: '24/7 gym access',
                    note: 'where your gym offers it',
                  },
                ].map((f) => (
                  <View key={f.label} style={styles.featureRow}>
                    <Text style={[styles.featureCheck, { color: accent }]}>✓</Text>
                    <Text style={styles.featureText}>
                      {f.label}
                      {f.note ? (
                        <Text style={styles.featureNote}> ({f.note})</Text>
                      ) : null}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.footerLogoCol}>
              {site.theme.logo_url ? (
                <Image
                  source={{ uri: site.theme.logo_url }}
                  style={styles.footerLogo}
                  resizeMode="contain"
                />
              ) : null}
              <Image
                source={{ uri: WYLD_INC_LOGO_URL }}
                style={styles.footerLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.footerDivider} />

          <View style={[styles.footerInner, isWide && styles.footerInnerWide]}>
            <View>
              <Text style={styles.footerName}>
                {site.gym.name}
                {site.currentLocation ? ` — ${site.currentLocation.label}` : ''}
              </Text>
              {site.settings.address_line1 ? (
                <Text style={styles.footerLine}>
                  {site.settings.address_line1}
                  {site.settings.city ? `, ${site.settings.city}` : ''}
                  {site.settings.state ? `, ${site.settings.state}` : ''}
                  {site.settings.zip ? ` ${site.settings.zip}` : ''}
                </Text>
              ) : null}
              {site.settings.contact_phone ? (
                <PhoneLink phone={site.settings.contact_phone} style={styles.footerLine} />
              ) : null}
              {site.settings.contact_email ? (
                <EmailLink email={site.settings.contact_email} style={styles.footerLine} />
              ) : null}
            </View>
            <SocialIcons settings={site.settings} accent={accent} />
          </View>
          <Text style={styles.copyright}>
            © {new Date().getFullYear()} {site.gym.name}
          </Text>
        </View>
      </ScrollView>
    </GymSiteProvider>
  );
}

function StoreBadge({
  supertext,
  main,
  glyph,
}: {
  supertext: string;
  main: string;
  glyph: string;
}) {
  return (
    <View style={styles.storeBadge}>
      <Text style={styles.storeBadgeGlyph}>{glyph}</Text>
      <View>
        <Text style={styles.storeBadgeSuper}>{supertext}</Text>
        <Text style={styles.storeBadgeMain}>{main}</Text>
      </View>
    </View>
  );
}

function filterNonNull<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingBottom: 0 },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'column',
    gap: 12,
    borderBottomWidth: 1,
  },
  headerWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingVertical: 20,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64 },
  brandName: { fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  brandLocation: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },

  navWrap: { position: 'relative' },
  nav: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 4, paddingRight: 34 },
  navWide: { paddingVertical: 0, paddingRight: 0 },
  navItem: { fontSize: 14, fontWeight: '700' },
  navFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  navFadeChevron: { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  locSwitchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locSwitchBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  loginBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginLeft: 8 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginTop: 64,
  },
  footerTop: {
    gap: 24,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  footerTopWide: { gap: 72 },
  footerNavCol: { gap: 6, flexBasis: 100, flexGrow: 0, flexShrink: 0 },
  footerAppCol: { gap: 14, flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 170 },
  footerColTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  footerNavLink: { color: 'rgba(255,255,255,0.82)', fontSize: 14, paddingVertical: 3 },
  footerLogoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  footerLogo: {
    width: 84,
    height: 84,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  footerAppTitle: { color: '#fff', fontSize: 16, fontWeight: '800', lineHeight: 23 },
  storeBadges: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  storeBadgeGlyph: { color: '#fff', fontSize: 20 },
  storeBadgeSuper: { color: 'rgba(255,255,255,0.7)', fontSize: 9, letterSpacing: 0.3 },
  storeBadgeMain: { color: '#fff', fontSize: 15, fontWeight: '700' },
  featureList: { gap: 6 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureCheck: { fontSize: 14, fontWeight: '900' },
  featureText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, flex: 1 },
  featureNote: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontStyle: 'italic' },
  footerDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    marginVertical: 28,
  },
  footerInner: {
    gap: 20,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  footerInnerWide: { flexDirection: 'row', justifyContent: 'space-between' },
  footerName: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  footerLine: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 20 },
  copyright: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  notFoundTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  notFoundBody: { fontSize: 15, color: '#475569', textAlign: 'center', maxWidth: 480 },
  mono: { fontFamily: 'monospace', color: '#0F172A' },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
