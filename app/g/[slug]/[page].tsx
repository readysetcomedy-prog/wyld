import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { Slideshow } from '@/components/Slideshow';
import { GymHours, hasAnyHours } from '@/components/GymHours';
import { FaqAccordion } from '@/components/FaqAccordion';

const VALID_PAGES = ['about', 'services', 'contact', 'news', 'faq', 'schedule', 'store'] as const;
type PageKey = (typeof VALID_PAGES)[number];

const PAGE_TITLES: Record<PageKey, string> = {
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  news: 'News',
  faq: 'FAQ',
  schedule: 'Schedule',
  store: 'Store',
};

export default function Page() {
  const { slug, page } = useLocalSearchParams<{ slug: string; page: string }>();
  const site = useGymSite();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  if (!VALID_PAGES.includes(page as PageKey)) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  const key = page as PageKey;

  // Module-gated pages
  if (key === 'schedule' && !site.modules.calendar_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'store' && !site.modules.store_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'news' && !site.modules.news_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'faq' && !site.modules.faq_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }

  const content = site.pages[key] ?? {};
  const heading = content.headline || PAGE_TITLES[key];
  const body: string = content.body || '';
  const intro: string = content.intro || '';
  const gallery: string[] = content.gallery ?? [];
  const faqItems = Array.isArray(content.items) ? content.items : [];

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <Text style={[styles.h1, { color: site.theme.primary_color }]}>{heading}</Text>

      {gallery.length > 0 ? <Slideshow urls={gallery} aspectRatio={21 / 9} /> : null}

      {key === 'faq' ? (
        <>
          {intro || body ? (
            <View style={styles.body}>
              {(intro || body)
                .split('\n')
                .filter((p) => p.trim())
                .map((para, i) => (
                  <Text key={i} style={styles.para}>
                    {para}
                  </Text>
                ))}
            </View>
          ) : null}
          {faqItems.length > 0 ? (
            <FaqAccordion
              items={faqItems}
              primaryColor={site.theme.primary_color}
              accentColor={site.theme.accent_color}
            />
          ) : (
            <Text style={styles.dim}>No questions yet. Check back soon.</Text>
          )}
        </>
      ) : body ? (
        <View style={styles.body}>
          {body.split('\n').filter((p) => p.trim()).map((para, i) => (
            <Text key={i} style={styles.para}>{para}</Text>
          ))}
        </View>
      ) : (
        <Text style={styles.dim}>This page is being built. Check back soon.</Text>
      )}

      {key === 'services' ? (
        <View style={styles.dataNote}>
          <Text style={styles.dataNoteText}>
            Memberships and pricing will appear here once {site.gym.name} sets them up in
            their Offerings tab.
          </Text>
        </View>
      ) : null}

      {key === 'schedule' ? (
        <View style={styles.dataNote}>
          <Text style={styles.dataNoteText}>
            Class schedule will appear here once {site.gym.name} adds it.
          </Text>
        </View>
      ) : null}

      {key === 'store' ? (
        <View style={styles.dataNote}>
          <Text style={styles.dataNoteText}>
            Store items will appear here once {site.gym.name} adds them.
          </Text>
        </View>
      ) : null}

      {key === 'contact' ? (
        <>
          <View style={styles.contactBlock}>
            {site.settings.contact_email ? (
              <Text style={styles.contactLine}>Email: {site.settings.contact_email}</Text>
            ) : null}
            {site.settings.contact_phone ? (
              <Text style={styles.contactLine}>Phone: {site.settings.contact_phone}</Text>
            ) : null}
            {site.settings.address_line1 ? (
              <Text style={styles.contactLine}>
                {site.settings.address_line1}
                {site.settings.city ? `, ${site.settings.city}` : ''}
                {site.settings.state ? `, ${site.settings.state}` : ''}
                {site.settings.zip ? ` ${site.settings.zip}` : ''}
              </Text>
            ) : null}
          </View>
          {hasAnyHours(site.settings.hours) ? (
            <GymHours hours={site.settings.hours ?? {}} primaryColor={site.theme.primary_color} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingVertical: 24, gap: 24 },
  pageWide: {
    paddingHorizontal: 40,
    paddingVertical: 56,
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  h1: { fontSize: 36, fontWeight: '800', lineHeight: 44 },
  body: { gap: 12, maxWidth: 760 },
  para: { fontSize: 16, color: '#0F172A', lineHeight: 26 },
  dim: { color: '#94a3b8', fontStyle: 'italic' },
  dataNote: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    maxWidth: 760,
  },
  dataNoteText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  contactBlock: { gap: 4, marginTop: 8 },
  contactLine: { fontSize: 16, color: '#0F172A' },
});
