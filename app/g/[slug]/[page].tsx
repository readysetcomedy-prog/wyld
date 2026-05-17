import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { useGymSite } from '@/components/GymSiteContext';
import { Slideshow } from '@/components/Slideshow';
import { FaqAccordion } from '@/components/FaqAccordion';
import { PublicContactSection } from '@/components/PublicContactSection';
import { PublicScheduleSection } from '@/components/PublicScheduleSection';
import { PublicStoreSection } from '@/components/PublicStoreSection';
import { PublicServicesSection } from '@/components/PublicServicesSection';
import { StyledBlock, BlockStyle } from '@/components/StyledBlock';

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

  // Module-gated pages. News/FAQ/Store also require the owner to have
  // published the page on top of admin granting the module.
  const m = site.modules;
  if (key === 'schedule' && !m.calendar_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'store' && !(m.store_enabled && m.store_visible)) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'news' && !(m.news_enabled && m.news_visible)) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'faq' && !(m.faq_enabled && m.faq_visible)) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'about' && !m.about_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'services' && !m.services_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }
  if (key === 'contact' && !m.contact_enabled) {
    return <Redirect href={`/g/${slug}` as never} />;
  }

  const content = site.pages[key] ?? {};
  const blockStyles: Record<string, BlockStyle> = (content.styles ?? {}) as any;
  const heading = content.headline || PAGE_TITLES[key];
  const body: string = content.body || '';
  const intro: string = content.intro || '';
  const gallery: string[] = content.gallery ?? [];
  const faqItems = Array.isArray(content.items) ? content.items : [];

  // Pages with auto-populated lower content (events / products / contact info /
  // hours / locations / FAQ / message form). For these, the body block is just
  // an optional intro — the placeholder ("This page is being built.") only
  // shows on pages that have no auto-content of their own.
  const HAS_AUTO_CONTENT: Record<PageKey, boolean> = {
    about: false,
    services: true,
    contact: true,
    news: true,
    faq: true,
    schedule: true,
    store: true,
  };

  const showPlaceholder = !body && !intro && !HAS_AUTO_CONTENT[key] && key !== 'faq';

  return (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <Text style={[styles.h1, { color: site.theme.primary_color }]}>{heading}</Text>

      {gallery.length > 0 ? <Slideshow urls={gallery} aspectRatio={21 / 9} /> : null}

      {key === 'faq' ? (
        <>
          {intro || body ? (
            <StyledBlock style={blockStyles.body} defaults={{ width: 'wide' }}>
              <BodyParagraphs text={intro || body} align={blockStyles.body?.align ?? 'left'} />
            </StyledBlock>
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
        <StyledBlock style={blockStyles.body} defaults={{ width: 'wide' }}>
          <BodyParagraphs text={body} align={blockStyles.body?.align ?? 'left'} />
        </StyledBlock>
      ) : showPlaceholder ? (
        <Text style={styles.dim}>This page is being built. Check back soon.</Text>
      ) : null}

      {key === 'services' ? <PublicServicesSection /> : null}

      {key === 'schedule' ? <PublicScheduleSection /> : null}
      {key === 'store' ? <PublicStoreSection /> : null}
      {key === 'contact' ? <PublicContactSection /> : null}
    </View>
  );
}

function BodyParagraphs({ text, align }: { text: string; align: 'left' | 'center' }) {
  return (
    <>
      {text
        .split('\n')
        .filter((p) => p.trim())
        .map((para, i) => (
          <Text key={i} style={[styles.para, { textAlign: align }]}>
            {para}
          </Text>
        ))}
    </>
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
});
