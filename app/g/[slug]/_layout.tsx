import { useEffect, useState } from 'react';
import { Slot, useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { GymSiteProvider, GymSite } from '@/components/GymSiteContext';

export default function SiteLayout() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [site, setSite] = useState<GymSite | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: gym } = await supabase
        .from('gyms')
        .select('id, name, slug, city, state')
        .eq('slug', slug)
        .maybeSingle();
      if (!gym) {
        setNotFound(true);
        return;
      }
      const [{ data: theme }, { data: modules }, { data: settings }, { data: pages }] = await Promise.all([
        supabase.from('gym_themes').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_modules').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_site_settings').select('*').eq('gym_id', gym.id).maybeSingle(),
        supabase.from('gym_pages').select('page_key, content').eq('gym_id', gym.id),
      ]);
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
  }, [slug]);

  if (notFound) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundTitle}>Gym not found</Text>
        <Text style={styles.notFoundBody}>No gym matches that URL.</Text>
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

  const NAV: { label: string; path: string }[] = [
    { label: 'Home', path: `/g/${slug}` },
    { label: 'Services', path: `/g/${slug}/services` },
    ...(site.modules.calendar_enabled ? [{ label: 'Schedule', path: `/g/${slug}/schedule` }] : []),
    ...(site.modules.store_enabled ? [{ label: 'Store', path: `/g/${slug}/store` }] : []),
    { label: 'About', path: `/g/${slug}/about` },
    ...(site.modules.news_enabled ? [{ label: 'News', path: `/g/${slug}/news` }] : []),
    ...(site.modules.faq_enabled ? [{ label: 'FAQ', path: `/g/${slug}/faq` }] : []),
    { label: 'Contact', path: `/g/${slug}/contact` },
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
            <View style={styles.footerSocial}>
              {site.settings.social_instagram ? (
                <Text style={styles.footerLine}>Instagram: {site.settings.social_instagram}</Text>
              ) : null}
              {site.settings.social_facebook ? (
                <Text style={styles.footerLine}>Facebook: {site.settings.social_facebook}</Text>
              ) : null}
              {site.settings.social_x ? (
                <Text style={styles.footerLine}>X: {site.settings.social_x}</Text>
              ) : null}
              {site.settings.social_tiktok ? (
                <Text style={styles.footerLine}>TikTok: {site.settings.social_tiktok}</Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.poweredBy}>Powered by WyLD Site</Text>
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

  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48 },
  brandName: { fontSize: 22, fontWeight: '800' },

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
  footerSocial: { gap: 4 },
  poweredBy: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  notFoundTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  notFoundBody: { fontSize: 15, color: '#475569' },
});
