import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { pickAndUploadImages } from '@/components/ImageUpload';
import { fetchBaseUrl, liveUrlForGym, DEFAULT_BASE_URL } from '@/lib/appSettings';

type Theme = {
  gym_id: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
};

type Modules = {
  gym_id: string;
  news_enabled: boolean;
  faq_enabled: boolean;
  calendar_enabled: boolean;
  store_enabled: boolean;
};

type Settings = {
  gym_id: string;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_x: string | null;
  social_tiktok: string | null;
  meta_description: string | null;
};

type Gym = {
  id: string;
  name: string;
  slug: string | null;
  custom_domain: string | null;
};

type PageContent = {
  headline?: string;
  subheadline?: string;
  body?: string;
  gallery?: string[];
};

const PAGE_KEYS = ['home', 'about', 'services', 'contact', 'news', 'faq'] as const;
type PageKey = (typeof PAGE_KEYS)[number];

const PAGE_LABELS: Record<PageKey, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  news: 'News / Blog',
  faq: 'FAQ',
};

const PAGE_NOTES: Partial<Record<PageKey, string>> = {
  services:
    'Pricing comes from your Offerings tab. The text below appears above your services list.',
  news: 'Only visible on your site if News is turned on by an admin.',
  faq: 'Only visible on your site if FAQ is turned on by an admin.',
};

export default function Website() {
  const { profile } = useAuth();
  const [gym, setGym] = useState<Gym | null>(null);
  const [themeRow, setThemeRow] = useState<Theme | null>(null);
  const [modules, setModules] = useState<Modules | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pages, setPages] = useState<Record<string, PageContent>>({});
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [savingPage, setSavingPage] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);

  const gymId = profile?.gym_id ?? null;

  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const [
        { data: g },
        { data: t },
        { data: m },
        { data: s },
        { data: pp },
        b,
      ] = await Promise.all([
        supabase.from('gyms').select('id, name, slug, custom_domain').eq('id', gymId).maybeSingle(),
        supabase.from('gym_themes').select('*').eq('gym_id', gymId).maybeSingle(),
        supabase
          .from('gym_modules')
          .select('gym_id, news_enabled, faq_enabled, calendar_enabled, store_enabled')
          .eq('gym_id', gymId)
          .maybeSingle(),
        supabase.from('gym_site_settings').select('*').eq('gym_id', gymId).maybeSingle(),
        supabase.from('gym_pages').select('page_key, content').eq('gym_id', gymId),
        fetchBaseUrl(),
      ]);
      setBaseUrl(b);
      setGym((g as Gym | null) ?? null);
      setThemeRow((t as Theme | null) ?? null);
      setModules((m as Modules | null) ?? null);
      setSettings((s as Settings | null) ?? null);
      const map: Record<string, PageContent> = {};
      (pp ?? []).forEach((row: any) => {
        map[row.page_key] = row.content ?? {};
      });
      setPages(map);
    })();
  }, [gymId]);

  function notifySaved(label: string) {
    setSavedNote(label);
    setTimeout(() => setSavedNote(''), 1500);
  }

  async function saveTheme(patch: Partial<Theme>) {
    if (!themeRow) return;
    const next = { ...themeRow, ...patch };
    setThemeRow(next);
    const { error } = await supabase
      .from('gym_themes')
      .update(patch)
      .eq('gym_id', themeRow.gym_id);
    if (error) setError(error.message);
    else notifySaved('Theme saved');
  }

  async function saveSettings(patch: Partial<Settings>) {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
    const { error } = await supabase
      .from('gym_site_settings')
      .update(patch)
      .eq('gym_id', settings.gym_id);
    if (error) setError(error.message);
    else notifySaved('Settings saved');
  }

  async function savePage(key: PageKey, patch: Partial<PageContent>) {
    if (!gymId) return;
    const current = pages[key] ?? {};
    const merged = { ...current, ...patch };
    setPages({ ...pages, [key]: merged });
    setSavingPage(true);
    const { error } = await supabase
      .from('gym_pages')
      .upsert({ gym_id: gymId, page_key: key, content: merged }, { onConflict: 'gym_id,page_key' });
    setSavingPage(false);
    if (error) setError(error.message);
    else notifySaved('Page saved');
  }

  async function uploadLogo() {
    if (!gymId) return;
    const urls = await pickAndUploadImages(gymId, { multiple: false });
    if (urls[0]) saveTheme({ logo_url: urls[0] });
  }

  async function uploadGallery(key: PageKey) {
    if (!gymId) return;
    const urls = await pickAndUploadImages(gymId, { multiple: true });
    if (urls.length === 0) return;
    const existing = pages[key]?.gallery ?? [];
    savePage(key, { gallery: [...existing, ...urls] });
  }

  function removeGalleryImage(key: PageKey, idx: number) {
    const existing = pages[key]?.gallery ?? [];
    const next = existing.filter((_, i) => i !== idx);
    savePage(key, { gallery: next });
  }

  if (!gymId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Website</Text>
        <Text style={styles.body}>Your account isn't linked to a gym yet.</Text>
      </View>
    );
  }

  if (!gym || !themeRow || !modules || !settings) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.wyldPurple} />
      </View>
    );
  }

  const liveUrl = liveUrlForGym(baseUrl, gym);

  const visiblePages: PageKey[] = PAGE_KEYS.filter((k) => {
    if (k === 'news') return modules.news_enabled || pages.news != null;
    if (k === 'faq') return modules.faq_enabled || pages.faq != null;
    return true;
  });

  const page = pages[activePage] ?? {};

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>Website</Text>
        {liveUrl ? (
          <Pressable
            onPress={() => typeof window !== 'undefined' && window.open(liveUrl, '_blank')}
          >
            <Text style={styles.liveLink}>{liveUrl} ↗</Text>
          </Pressable>
        ) : (
          <Text style={styles.dim}>Your admin needs to set a slug before your site is live.</Text>
        )}
        {savedNote ? <Text style={styles.saved}>{savedNote}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Theme</Text>
        <Text style={styles.cardSub}>
          Logo and two colors. The rest of the styling is locked so the template stays
          consistent.
        </Text>

        <View style={styles.row}>
          {themeRow.logo_url ? (
            <Image source={{ uri: themeRow.logo_url }} style={styles.logoPreview} resizeMode="contain" />
          ) : (
            <View style={[styles.logoPreview, styles.logoEmpty]}>
              <Text style={styles.dim}>No logo</Text>
            </View>
          )}
          <View style={styles.col}>
            <Pressable style={styles.btn} onPress={uploadLogo}>
              <Text style={styles.btnText}>{themeRow.logo_url ? 'Replace logo' : 'Upload logo'}</Text>
            </Pressable>
            {themeRow.logo_url ? (
              <Pressable style={styles.btnGhost} onPress={() => saveTheme({ logo_url: null })}>
                <Text style={styles.btnGhostText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.gridTwo}>
          <ColorField
            label="Primary color"
            value={themeRow.primary_color}
            onChange={(v) => setThemeRow({ ...themeRow, primary_color: v })}
            onCommit={(v) => saveTheme({ primary_color: v })}
          />
          <ColorField
            label="Accent color"
            value={themeRow.accent_color}
            onChange={(v) => setThemeRow({ ...themeRow, accent_color: v })}
            onCommit={(v) => saveTheme({ accent_color: v })}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pages</Text>
        <Text style={styles.cardSub}>
          Pick a page, edit the text and images. Saves as you go.{savingPage ? ' Saving…' : ''}
        </Text>

        <View style={styles.pageTabs}>
          {visiblePages.map((k) => (
            <Pressable
              key={k}
              onPress={() => setActivePage(k)}
              style={[styles.pageTab, activePage === k && styles.pageTabActive]}
            >
              <Text style={[styles.pageTabText, activePage === k && styles.pageTabTextActive]}>
                {PAGE_LABELS[k]}
              </Text>
            </Pressable>
          ))}
        </View>

        {PAGE_NOTES[activePage] ? (
          <Text style={styles.noteBox}>{PAGE_NOTES[activePage]}</Text>
        ) : null}

        <Field
          label={activePage === 'home' ? 'Headline' : 'Page heading'}
          value={page.headline ?? ''}
          onChange={(v) => setPages({ ...pages, [activePage]: { ...page, headline: v } })}
          onCommit={(v) => savePage(activePage, { headline: v })}
        />

        {activePage === 'home' ? (
          <Field
            label="Subheadline"
            value={page.subheadline ?? ''}
            onChange={(v) => setPages({ ...pages, [activePage]: { ...page, subheadline: v } })}
            onCommit={(v) => savePage(activePage, { subheadline: v })}
          />
        ) : null}

        <Field
          label="Body text"
          value={page.body ?? ''}
          onChange={(v) => setPages({ ...pages, [activePage]: { ...page, body: v } })}
          onCommit={(v) => savePage(activePage, { body: v })}
          multiline
          rows={6}
        />

        <View>
          <Text style={styles.label}>
            {activePage === 'home' ? 'Hero slideshow' : 'Images'}
          </Text>
          <Text style={styles.hintSmall}>
            Upload one or many. Multiple images become a slideshow.
          </Text>
          {(page.gallery ?? []).length === 0 ? (
            <View style={styles.galleryEmpty}>
              <Text style={styles.dim}>No images yet.</Text>
            </View>
          ) : (
            <View style={styles.galleryGrid}>
              {(page.gallery ?? []).map((url, i) => (
                <View key={url + i} style={styles.galleryItem}>
                  <Image source={{ uri: url }} style={styles.galleryThumb} resizeMode="cover" />
                  <Pressable
                    onPress={() => removeGalleryImage(activePage, i)}
                    style={styles.galleryRemove}
                  >
                    <Text style={styles.galleryRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable style={styles.btn} onPress={() => uploadGallery(activePage)}>
            <Text style={styles.btnText}>Upload images</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>
        <Text style={styles.cardSub}>
          Contact info, address, and social. Appears in the site footer and Contact page.
        </Text>

        <View style={styles.gridTwo}>
          <Field
            label="Contact email"
            value={settings.contact_email ?? ''}
            onChange={(v) => setSettings({ ...settings, contact_email: v })}
            onCommit={(v) => saveSettings({ contact_email: v || null })}
          />
          <Field
            label="Phone"
            value={settings.contact_phone ?? ''}
            onChange={(v) => setSettings({ ...settings, contact_phone: v })}
            onCommit={(v) => saveSettings({ contact_phone: v || null })}
          />
        </View>

        <Field
          label="Address"
          value={settings.address_line1 ?? ''}
          onChange={(v) => setSettings({ ...settings, address_line1: v })}
          onCommit={(v) => saveSettings({ address_line1: v || null })}
        />

        <View style={styles.gridThree}>
          <Field
            label="City"
            value={settings.city ?? ''}
            onChange={(v) => setSettings({ ...settings, city: v })}
            onCommit={(v) => saveSettings({ city: v || null })}
          />
          <Field
            label="State"
            value={settings.state ?? ''}
            onChange={(v) => setSettings({ ...settings, state: v })}
            onCommit={(v) => saveSettings({ state: v || null })}
          />
          <Field
            label="Zip"
            value={settings.zip ?? ''}
            onChange={(v) => setSettings({ ...settings, zip: v })}
            onCommit={(v) => saveSettings({ zip: v || null })}
          />
        </View>

        <View style={styles.gridTwo}>
          <Field
            label="Instagram"
            value={settings.social_instagram ?? ''}
            onChange={(v) => setSettings({ ...settings, social_instagram: v })}
            onCommit={(v) => saveSettings({ social_instagram: v || null })}
            placeholder="@yourgym or URL"
          />
          <Field
            label="Facebook"
            value={settings.social_facebook ?? ''}
            onChange={(v) => setSettings({ ...settings, social_facebook: v })}
            onCommit={(v) => saveSettings({ social_facebook: v || null })}
          />
          <Field
            label="X / Twitter"
            value={settings.social_x ?? ''}
            onChange={(v) => setSettings({ ...settings, social_x: v })}
            onCommit={(v) => saveSettings({ social_x: v || null })}
          />
          <Field
            label="TikTok"
            value={settings.social_tiktok ?? ''}
            onChange={(v) => setSettings({ ...settings, social_tiktok: v })}
            onCommit={(v) => saveSettings({ social_tiktok: v || null })}
          />
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  onCommit,
  multiline,
  rows = 1,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={() => onCommit(value)}
        multiline={multiline}
        numberOfLines={multiline ? rows : 1}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={[styles.input, multiline && { minHeight: rows * 22, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

function ColorField({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.colorRow}>
        <View style={[styles.swatch, { backgroundColor: value }]} />
        <TextInput
          value={value}
          onChangeText={onChange}
          onBlur={() => onCommit(value)}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, { flex: 1 }]}
          placeholder="#000000"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.lg, maxWidth: 960 },
  headerBlock: { gap: 4 },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  body: { fontSize: 15, color: theme.colors.textSecondary },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic' },
  liveLink: { color: theme.colors.wyldPurple, fontWeight: '700', fontSize: 14 },
  saved: { color: theme.colors.tealDark, fontSize: 13, fontWeight: '700' },
  errorText: { color: theme.colors.danger, fontSize: 13 },

  card: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.charcoal },
  cardSub: { fontSize: 13, color: theme.colors.textSecondary },

  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' },
  col: { gap: theme.spacing.xs },
  gridTwo: { flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' },
  gridThree: { flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' },

  logoPreview: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },

  field: { gap: 4, minWidth: 200, flexGrow: 1, flexBasis: 240 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  hintSmall: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    color: theme.colors.charcoal,
  },

  colorRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  btn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.wyldPurple,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  btnGhostText: { color: theme.colors.danger, fontWeight: '700', fontSize: 12 },

  pageTabs: { flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' },
  pageTab: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  pageTabActive: { backgroundColor: theme.colors.charcoal, borderColor: theme.colors.charcoal },
  pageTabText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  pageTabTextActive: { color: '#fff' },

  noteBox: {
    padding: theme.spacing.sm,
    backgroundColor: '#fff',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },

  galleryEmpty: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    marginBottom: theme.spacing.sm,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  galleryItem: { position: 'relative' },
  galleryThumb: {
    width: 120,
    height: 80,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  galleryRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryRemoveText: { color: '#fff', fontWeight: '800', fontSize: 14, lineHeight: 16 },
});
