import { useEffect, useRef, useState } from 'react';
import {
  Slot,
  useLocalSearchParams,
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
  Linking,
  Platform,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { GymSiteProvider, GymSite } from '@/components/GymSiteContext';
import { SocialIcons } from '@/components/SocialIcons';

export default function SiteLayout() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>();
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [site, setSite] = useState<GymSite | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        { data: theme, error: themeErr },
        { data: modules, error: modErr },
        { data: settings, error: setErr },
        { data: pages, error: pagesErr },
      ] = await Promise.all([
        supabase.from('gym_themes').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_modules').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_site_settings').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_pages').select('page_key, content').eq('gym_id', gym.id),
      ]);
      if (cancelled) return;
      const firstErr = themeErr || modErr || setErr || pagesErr;
      if (firstErr) {
        setLoadError(firstErr.message);
        return;
      }
      const pagesMap: Record<string, any> = {};
      (pages ?? []).forEach((row: any) => {
        pagesMap[row.page_key] = row.content ?? {};
      });
      setSite({
        gym,
        theme: theme ?? { primary_color: '#0F172A', accent_color: '#14B8A6', logo_url: null },
        modules: modules ?? {
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
        },
        settings: settings ?? {
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
        },
        pages: pagesMap,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Update browser tab title + favicon to match the gym (web only).
  // Capture the originals on mount so we can restore them on unmount —
  // otherwise visiting a gym leaves its title/favicon on the WyLD pages.
  const originalTitleRef = useRef<string | null>(null);
  const originalFaviconRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    originalTitleRef.current = document.title;
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    originalFaviconRef.current = link?.href ?? null;
    return () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
      }
      const l = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
      if (l && originalFaviconRef.current) {
        l.href = originalFaviconRef.current;
      }
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (site) {
      document.title = site.gym.name;
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

  const m = site.modules;
  const showStore = m.store_enabled && m.store_visible;
  const showNews = m.news_enabled && m.news_visible;
  const showFaq = m.faq_enabled && m.faq_visible;
  const NAV: { label: string; path: string }[] = [
    { label: 'Home', path: `/g/${slug}` },
    ...(m.services_enabled ? [{ label: 'Services', path: `/g/${slug}/services` }] : []),
    ...(m.calendar_enabled ? [{ label: 'Schedule', path: `/g/${slug}/schedule` }] : []),
    ...(showStore ? [{ label: 'Store', path: `/g/${slug}/store` }] : []),
    ...(m.about_enabled ? [{ label: 'About', path: `/g/${slug}/about` }] : []),
    ...(showNews ? [{ label: 'News', path: `/g/${slug}/news` }] : []),
    ...(showFaq ? [{ label: 'FAQ', path: `/g/${slug}/faq` }] : []),
    ...(m.contact_enabled ? [{ label: 'Contact', path: `/g/${slug}/contact` }] : []),
  ];

  return (
    <GymSiteProvider value={site}>
      <ScrollView style={[styles.root, { backgroundColor: '#fff' }]} contentContainerStyle={styles.container}>
        <View style={[styles.header, isWide && styles.headerWide, { borderBottomColor: '#e2e8f0' }]}>
          <Pressable
            style={styles.brand}
            onPress={() => router.push(`/g/${slug}` as never)}
            accessibilityLabel={site.gym.name}
          >
            {site.theme.logo_url ? (
              <Image source={{ uri: site.theme.logo_url }} style={styles.logo} resizeMode="contain" />
            ) : null}
            <Text style={[styles.brandName, { color: primary }]}>{site.gym.name}</Text>
          </Pressable>

          <ScrollView
            horizontal={!isWide}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.nav, isWide && styles.navWide]}
          >
            {NAV.map((item) => {
              const isActive =
                pathname === item.path ||
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
            <Pressable
              onPress={() => router.push(`/g/${slug}/login` as never)}
              style={[styles.loginBtn, { backgroundColor: accent }]}
            >
              <Text style={styles.loginBtnText}>Member login</Text>
            </Pressable>
          </ScrollView>
        </View>

        <Slot />

        <View style={[styles.footer, { backgroundColor: primary }]}>
          <View style={[styles.footerInner, isWide && styles.footerInnerWide]}>
            <View>
              <Text style={styles.footerName}>{site.gym.name}</Text>
              {site.settings.address_line1 ? (
                <Text style={styles.footerLine}>
                  {site.settings.address_line1}
                  {site.settings.city ? `, ${site.settings.city}` : ''}
                  {site.settings.state ? `, ${site.settings.state}` : ''}
                  {site.settings.zip ? ` ${site.settings.zip}` : ''}
                </Text>
              ) : null}
              {site.settings.contact_phone ? (
                <Text style={styles.footerLine}>{site.settings.contact_phone}</Text>
              ) : null}
              {site.settings.contact_email ? (
                <Text style={styles.footerLine}>{site.settings.contact_email}</Text>
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

  nav: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 4 },
  navWide: { paddingVertical: 0 },
  navItem: { fontSize: 14, fontWeight: '700' },
  loginBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginLeft: 8 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    marginTop: 64,
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
