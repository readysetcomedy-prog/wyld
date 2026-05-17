import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/lib/theme';
import { pickAndUploadImages } from '@/components/ImageUpload';
import { fetchBaseUrl, liveUrlForGym, DEFAULT_BASE_URL } from '@/lib/appSettings';
import { ColorPickerField } from '@/components/ColorPicker';
import { DAY_KEYS, DAY_LABELS, type HoursMap } from '@/components/GymHours';
import { LocationsManager } from '@/components/LocationsManager';
import { PRESET_OPTIONS, PresetName } from '@/lib/stylePresets';
import { Select } from '@/components/Select';

type Theme = {
  gym_id: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  style_preset: 'clean' | 'bold' | 'warm' | 'modern';
  hero_variant: 'split' | 'fullbleed';
  section_dividers: boolean;
};

type Modules = {
  gym_id: string;
  news_enabled: boolean;
  faq_enabled: boolean;
  calendar_enabled: boolean;
  store_enabled: boolean;
  about_enabled: boolean;
  services_enabled: boolean;
  contact_enabled: boolean;
  news_visible: boolean;
  faq_visible: boolean;
  store_visible: boolean;
  multi_location_enabled: boolean;
  max_locations: number;
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
  hours: HoursMap | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_x: string | null;
  social_tiktok: string | null;
  meta_description: string | null;
};

type NewsPost = {
  id: string;
  gym_id: string;
  slug: string;
  title: string;
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Gym = {
  id: string;
  name: string;
  slug: string | null;
  custom_domain: string | null;
};

type FaqItem = { id: string; q: string; a: string };

type BlockStyle = {
  box?: boolean;
  tint?: boolean;
  stripe?: boolean;
  width?: 'narrow' | 'wide' | 'full';
  align?: 'left' | 'center';
};

type PageContent = {
  headline?: string;
  subheadline?: string;
  body?: string;
  intro?: string;
  gallery?: string[];
  items?: FaqItem[];
  styles?: Record<string, BlockStyle>;
};

const PAGE_KEYS = ['home', 'about', 'services', 'contact', 'schedule', 'store', 'news', 'faq'] as const;
type PageKey = (typeof PAGE_KEYS)[number];

// Which named blocks each page exposes for per-section styling.
const PAGE_BLOCKS: Record<PageKey, { key: string; label: string }[]> = {
  home: [
    { key: 'intro', label: 'Intro paragraph' },
    { key: 'hours', label: 'Hours card' },
  ],
  about: [{ key: 'body', label: 'Body' }],
  services: [{ key: 'body', label: 'Body' }],
  contact: [
    { key: 'body', label: '"Get in touch" intro' },
    { key: 'hours', label: 'Hours card' },
  ],
  schedule: [{ key: 'body', label: 'Intro above the calendar' }],
  store: [{ key: 'body', label: 'Intro above the products' }],
  news: [{ key: 'body', label: 'Intro' }],
  faq: [{ key: 'body', label: 'Intro' }],
};

const PAGE_LABELS: Record<PageKey, string> = {
  home: 'Home',
  about: 'About',
  services: 'Services',
  contact: 'Contact',
  schedule: 'Schedule',
  store: 'Store',
  news: 'News / Blog',
  faq: 'FAQ',
};

const PAGE_NOTES: Partial<Record<PageKey, string>> = {
  services:
    'Pricing comes from your Offerings tab. The text below appears above your services list.',
  schedule:
    'The calendar below your intro is auto-populated from the Calendar tab.',
  store:
    'The product grid below your intro is auto-populated from the Store tab.',
  news: 'Only visible on your site if News is turned on by an admin.',
  faq: 'Only visible on your site if FAQ is turned on by an admin.',
};

export default function Website() {
  const { profile } = useAuth();
  const [gym, setGym] = useState<Gym | null>(null);
  const [themeRow, setThemeRow] = useState<Theme | null>(null);
  // When null = editing default ("All locations / shared"). UUID = editing that location's overrides.
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; label: string | null; slug: string | null; is_primary: boolean }[]>([]);
  const [modules, setModules] = useState<Modules | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pages, setPages] = useState<Record<string, PageContent>>({});
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [savingPage, setSavingPage] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);

  const gymId = profile?.gym_id ?? null;

  // Load gym + modules + settings + locations once per gym.
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const [{ data: g }, { data: m }, { data: s }, { data: locs }, b] = await Promise.all([
        supabase.from('gyms').select('id, name, slug, custom_domain').eq('id', gymId).maybeSingle(),
        supabase
          .from('gym_modules')
          .select(
            'gym_id, news_enabled, faq_enabled, calendar_enabled, store_enabled, about_enabled, services_enabled, contact_enabled, news_visible, faq_visible, store_visible, multi_location_enabled, max_locations'
          )
          .eq('gym_id', gymId)
          .maybeSingle(),
        supabase.from('gym_site_settings').select('*').eq('gym_id', gymId).maybeSingle(),
        supabase
          .from('gym_locations')
          .select('id, label, slug, is_primary')
          .eq('gym_id', gymId)
          .order('display_order'),
        fetchBaseUrl(),
      ]);
      setBaseUrl(b);
      setGym((g as Gym | null) ?? null);
      setModules((m as Modules | null) ?? null);
      setSettings((s as Settings | null) ?? null);
      setLocations((locs as any) ?? []);
    })();
  }, [gymId]);

  // (Re)load theme + pages for the active location, merging defaults below
  // the per-location overrides so the editor shows the effective values.
  useEffect(() => {
    if (!gymId) return;
    (async () => {
      const [{ data: defTheme }, locThemeRes, { data: defPages }, locPagesRes] = await Promise.all([
        supabase
          .from('gym_themes')
          .select('*')
          .eq('gym_id', gymId)
          .is('location_id', null)
          .maybeSingle(),
        activeLocationId
          ? supabase
              .from('gym_themes')
              .select('*')
              .eq('gym_id', gymId)
              .eq('location_id', activeLocationId)
              .maybeSingle()
          : Promise.resolve({ data: null as any }),
        supabase
          .from('gym_pages')
          .select('page_key, content')
          .eq('gym_id', gymId)
          .is('location_id', null),
        activeLocationId
          ? supabase
              .from('gym_pages')
              .select('page_key, content')
              .eq('gym_id', gymId)
              .eq('location_id', activeLocationId)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const base = (defTheme as any) ?? null;
      const loc = (locThemeRes as any).data ?? null;
      const merged: Theme | null = base || loc
        ? ({
            gym_id: gymId,
            primary_color: loc?.primary_color ?? base?.primary_color ?? '#0F172A',
            accent_color: loc?.accent_color ?? base?.accent_color ?? '#14B8A6',
            logo_url: loc?.logo_url ?? base?.logo_url ?? null,
            style_preset: loc?.style_preset ?? base?.style_preset ?? 'clean',
            hero_variant: loc?.hero_variant ?? base?.hero_variant ?? 'split',
            section_dividers: loc?.section_dividers ?? base?.section_dividers ?? false,
          } as Theme)
        : null;
      setThemeRow(merged);
      const map: Record<string, PageContent> = {};
      (defPages ?? []).forEach((row: any) => {
        map[row.page_key] = row.content ?? {};
      });
      ((locPagesRes as any).data ?? []).forEach((row: any) => {
        map[row.page_key] = row.content ?? {};
      });
      setPages(map);
    })();
  }, [gymId, activeLocationId]);

  function notifySaved(label: string) {
    setSavedNote(label);
    setTimeout(() => setSavedNote(''), 1500);
  }

  async function saveTheme(patch: Partial<Theme>) {
    if (!themeRow || !gymId) return;
    const next = { ...themeRow, ...patch };
    setThemeRow(next);
    // Find existing row for (gym_id, activeLocationId|null) and update; else
    // insert. Per-location rows are created the first time the owner edits
    // anything while a location is selected.
    let q = supabase.from('gym_themes').select('id').eq('gym_id', gymId);
    q = activeLocationId ? q.eq('location_id', activeLocationId) : q.is('location_id', null);
    const { data: existing } = await q.maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('gym_themes')
        .update(patch)
        .eq('id', (existing as any).id);
      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const insertRow: any = {
        gym_id: gymId,
        location_id: activeLocationId,
        primary_color: next.primary_color,
        accent_color: next.accent_color,
        logo_url: next.logo_url,
        style_preset: next.style_preset,
        hero_variant: next.hero_variant,
        section_dividers: next.section_dividers,
      };
      const { error } = await supabase.from('gym_themes').insert(insertRow);
      if (error) {
        setError(error.message);
        return;
      }
    }
    notifySaved('Theme saved');
  }

  async function saveModules(patch: Partial<Modules>) {
    if (!modules) return;
    setModules({ ...modules, ...patch });
    const { error } = await supabase
      .from('gym_modules')
      .update(patch)
      .eq('gym_id', modules.gym_id);
    if (error) setError(error.message);
    else notifySaved('Visibility saved');
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
    let q = supabase
      .from('gym_pages')
      .select('id')
      .eq('gym_id', gymId)
      .eq('page_key', key);
    q = activeLocationId ? q.eq('location_id', activeLocationId) : q.is('location_id', null);
    const { data: existing } = await q.maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('gym_pages')
        .update({ content: merged })
        .eq('id', (existing as any).id);
      setSavingPage(false);
      if (error) setError(error.message);
      else notifySaved('Page saved');
    } else {
      const { error } = await supabase.from('gym_pages').insert({
        gym_id: gymId,
        page_key: key,
        content: merged,
        location_id: activeLocationId,
      });
      setSavingPage(false);
      if (error) setError(error.message);
      else notifySaved('Page saved');
    }
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

      {modules.multi_location_enabled && locations.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Editing location</Text>
          <Text style={styles.cardSub}>
            Pick which location you&apos;re editing. &quot;Default&quot; sets the baseline used by
            every location; per-location edits override the baseline only where you change
            them — anything you leave alone still uses the default. Switching locations
            doesn&apos;t erase work you&apos;ve already done.
          </Text>
          <Select
            ariaLabel="Editing location"
            value={activeLocationId ?? 'default'}
            onChange={(v) => setActiveLocationId(v === 'default' ? null : v)}
            options={[
              { value: 'default', label: 'Default — all locations' },
              ...locations.map((l) => ({
                value: l.id,
                label: l.label || 'Untitled location',
              })),
            ]}
          />
        </View>
      ) : null}

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
          <ColorPickerField
            label="Primary color"
            value={themeRow.primary_color}
            onChange={(v) => setThemeRow({ ...themeRow, primary_color: v })}
            onCommit={(v) => saveTheme({ primary_color: v })}
          />
          <ColorPickerField
            label="Accent color"
            value={themeRow.accent_color}
            onChange={(v) => setThemeRow({ ...themeRow, accent_color: v })}
            onCommit={(v) => saveTheme({ accent_color: v })}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Style</Text>
        <Text style={styles.cardSub}>
          Pick a preset — it sets card shape, section tint, and headline weight together
          so the site stays consistent. Add a hero variant and section dividers for more
          flair.
        </Text>

        <View style={styles.presetGrid}>
          {PRESET_OPTIONS.map((opt) => {
            const active = themeRow.style_preset === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.presetTile, active && { borderColor: theme.colors.wyldPurple, borderWidth: 2 }]}
                onPress={() => saveTheme({ style_preset: opt.value })}
              >
                <View style={[styles.presetSwatch, presetSwatchStyle(opt.value)]} />
                <Text style={styles.presetLabel}>{opt.label}</Text>
                <Text style={styles.presetBlurb}>{opt.blurb}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.styleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Hero layout</Text>
            <Text style={styles.cardSub}>
              Split: text on one side, image on the other. Full-bleed: image fills the
              hero with text overlaid.
            </Text>
          </View>
          <View style={styles.segGroup}>
            {(['split', 'fullbleed'] as const).map((v) => (
              <Pressable
                key={v}
                style={[styles.segItem, themeRow.hero_variant === v && styles.segItemActive]}
                onPress={() => saveTheme({ hero_variant: v })}
              >
                <Text
                  style={[
                    styles.segItemText,
                    themeRow.hero_variant === v && styles.segItemTextActive,
                  ]}
                >
                  {v === 'split' ? 'Split' : 'Full-bleed'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.styleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Section dividers</Text>
            <Text style={styles.cardSub}>
              Adds a subtle angled cut between the hero and the first section.
            </Text>
          </View>
          <Switch
            value={themeRow.section_dividers}
            onValueChange={(v) => saveTheme({ section_dividers: v })}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Page visibility</Text>
        <Text style={styles.cardSub}>
          Toggle which tabs appear on your public site. Home is always shown. Tabs that
          aren&apos;t in the list aren&apos;t enabled for your gym yet — ask WyLD to add them.
        </Text>
        <View style={styles.toggleGrid}>
          {[
            { key: 'services_enabled' as const, label: 'Services', show: true },
            { key: 'calendar_enabled' as const, label: 'Schedule', show: true },
            { key: 'about_enabled' as const, label: 'About', show: true },
            { key: 'contact_enabled' as const, label: 'Contact', show: true },
            { key: 'news_visible' as const, label: 'News / Blog', show: modules.news_enabled },
            { key: 'faq_visible' as const, label: 'FAQ', show: modules.faq_enabled },
            { key: 'store_visible' as const, label: 'Store', show: modules.store_enabled },
          ]
            .filter((r) => r.show)
            .map((row) => (
              <View key={row.key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{row.label}</Text>
                <Switch
                  value={!!modules[row.key]}
                  onValueChange={(v) => saveModules({ [row.key]: v } as Partial<Modules>)}
                />
              </View>
            ))}
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

        {PAGE_BLOCKS[activePage].length > 0 ? (
          <View style={styles.sectionStyles}>
            <Text style={styles.subheading}>Section styling</Text>
            <Text style={styles.hintSmall}>
              Optional per-section toggles. The site preset still drives the actual look —
              these just turn pieces of it on or off.
            </Text>
            {PAGE_BLOCKS[activePage].map((block) => {
              const blockStyle = (page.styles ?? {})[block.key] ?? {};
              const updateBlock = (patch: Partial<BlockStyle>) => {
                const nextStyles = {
                  ...(page.styles ?? {}),
                  [block.key]: { ...blockStyle, ...patch },
                };
                savePage(activePage, { styles: nextStyles });
              };
              return (
                <View key={block.key} style={styles.blockCard}>
                  <Text style={styles.blockTitle}>{block.label}</Text>
                  <View style={styles.blockToggles}>
                    <ToggleChip
                      label="Box"
                      value={!!blockStyle.box}
                      onChange={(v) => updateBlock({ box: v })}
                    />
                    <ToggleChip
                      label="Tinted"
                      value={!!blockStyle.tint}
                      onChange={(v) => updateBlock({ tint: v })}
                    />
                    <ToggleChip
                      label="Accent stripe"
                      value={!!blockStyle.stripe}
                      onChange={(v) => updateBlock({ stripe: v })}
                    />
                  </View>
                  <View style={styles.blockSegRow}>
                    <Text style={styles.blockSegLabel}>Width</Text>
                    <Segmented
                      options={[
                        { label: 'Narrow', value: 'narrow' },
                        { label: 'Wide', value: 'wide' },
                        { label: 'Full', value: 'full' },
                      ]}
                      value={blockStyle.width ?? 'wide'}
                      onChange={(v) => updateBlock({ width: v as any })}
                    />
                  </View>
                  <View style={styles.blockSegRow}>
                    <Text style={styles.blockSegLabel}>Align</Text>
                    <Segmented
                      options={[
                        { label: 'Left', value: 'left' },
                        { label: 'Center', value: 'center' },
                      ]}
                      value={blockStyle.align ?? 'left'}
                      onChange={(v) => updateBlock({ align: v as any })}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {activePage === 'news' ? <NewsPostsManager gymId={gymId} /> : null}

      {activePage === 'faq' ? (
        <FaqItemsManager
          items={(pages.faq?.items as FaqItem[] | undefined) ?? []}
          onChange={(items) => savePage('faq', { items } as Partial<PageContent>)}
        />
      ) : null}

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

        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
          <Text style={styles.subheading}>Gym Hours</Text>
          <Text style={styles.hintSmall}>
            Set once — shows up on your Home and Contact pages. Leave a day blank to mark it Closed.
          </Text>
          <View style={styles.gridTwo}>
            {DAY_KEYS.map((k) => (
              <Field
                key={k}
                label={DAY_LABELS[k]}
                value={settings.hours?.[k] ?? ''}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    hours: { ...(settings.hours ?? {}), [k]: v },
                  })
                }
                onCommit={(v) =>
                  saveSettings({
                    hours: { ...(settings.hours ?? {}), [k]: v },
                  })
                }
                placeholder="5:00 AM – 11:00 PM"
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Locations</Text>
        <Text style={styles.cardSub}>
          Add one or more locations, each with its own address, emails, and phones. These
          appear on your Contact page. If you don&apos;t add any, the single contact info above
          is used as a fallback.
        </Text>
        <LocationsManager
          gymId={gymId}
          multiLocationEnabled={modules.multi_location_enabled}
          maxLocations={modules.max_locations}
        />
      </View>
    </View>
  );
}

function NewsPostsManager({ gymId }: { gymId: string }) {
  const [posts, setPosts] = useState<NewsPost[] | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const { data, error } = await supabase
      .from('gym_news_posts')
      .select('*')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setPosts((data as NewsPost[]) ?? []);
  }

  useEffect(() => {
    reload();
  }, [gymId]);

  async function createPost() {
    setError(null);
    const baseSlug = `post-${Date.now().toString(36)}`;
    const { data, error } = await supabase
      .from('gym_news_posts')
      .insert({
        gym_id: gymId,
        slug: baseSlug,
        title: 'Untitled post',
        body: '',
      })
      .select('*')
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(data as NewsPost);
    setCreating(true);
    reload();
  }

  async function savePost(patch: Partial<NewsPost>) {
    if (!editing) return;
    const next = { ...editing, ...patch };
    setEditing(next);
    const { error } = await supabase
      .from('gym_news_posts')
      .update(patch)
      .eq('id', editing.id);
    if (error) setError(error.message);
    else reload();
  }

  async function deletePost(id: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this post? This cannot be undone.')) return;
    const { error } = await supabase.from('gym_news_posts').delete().eq('id', id);
    if (error) setError(error.message);
    else {
      if (editing?.id === id) setEditing(null);
      reload();
    }
  }

  async function uploadCover() {
    if (!editing) return;
    const urls = await pickAndUploadImages(gymId, { multiple: false });
    if (urls[0]) savePost({ cover_image_url: urls[0] });
  }

  function slugify(s: string) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || `post-${Date.now().toString(36)}`;
  }

  return (
    <View style={styles.card}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={styles.cardTitle}>Blog posts</Text>
        <Pressable style={styles.btn} onPress={createPost}>
          <Text style={styles.btnText}>New post</Text>
        </Pressable>
      </View>
      <Text style={styles.cardSub}>
        Posts only appear on your public site once they're marked Published.
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {posts == null ? (
        <ActivityIndicator color={theme.colors.wyldPurple} />
      ) : posts.length === 0 ? (
        <Text style={styles.dim}>No posts yet.</Text>
      ) : (
        (() => {
          const q = search.trim().toLowerCase();
          const filtered = q
            ? posts.filter(
                (p) =>
                  p.title.toLowerCase().includes(q) ||
                  p.slug.toLowerCase().includes(q) ||
                  (p.body ?? '').toLowerCase().includes(q)
              )
            : posts;
          return (
            <>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search posts by title, slug, or text…"
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              {filtered.length === 0 ? (
                <Text style={styles.dim}>No posts match that search.</Text>
              ) : (
                <ScrollView style={styles.postScroll} nestedScrollEnabled>
                  <View style={{ gap: 8 }}>
                    {filtered.map((p) => {
                      const isPublished =
                        p.published_at && new Date(p.published_at) <= new Date();
                      return (
                        <View key={p.id} style={styles.postRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.postTitle}>{p.title || '(Untitled)'}</Text>
                            <Text style={styles.postMeta}>
                              {isPublished
                                ? `Published ${new Date(p.published_at!).toLocaleDateString()}`
                                : 'Draft'}{' '}
                              · /{p.slug}
                            </Text>
                          </View>
                          <Pressable style={styles.btnSecondary} onPress={() => setEditing(p)}>
                            <Text style={styles.btnSecondaryText}>Edit</Text>
                          </Pressable>
                          <Pressable style={styles.btnGhost} onPress={() => deletePost(p.id)}>
                            <Text style={styles.btnGhostText}>Delete</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </>
          );
        })()
      )}

      {editing ? (
        <View style={styles.editor}>
          <Text style={styles.subheading}>
            {creating ? 'New post' : 'Edit post'}
          </Text>
          <Field
            label="Title"
            value={editing.title}
            onChange={(v) => setEditing({ ...editing, title: v })}
            onCommit={(v) =>
              savePost({
                title: v,
                slug: editing.slug.startsWith('post-') ? slugify(v) : editing.slug,
              })
            }
          />
          <Field
            label="URL slug"
            value={editing.slug}
            onChange={(v) => setEditing({ ...editing, slug: v })}
            onCommit={(v) => savePost({ slug: slugify(v) })}
          />
          <View>
            <Text style={styles.label}>Cover image</Text>
            {editing.cover_image_url ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image
                  source={{ uri: editing.cover_image_url }}
                  style={{ width: 120, height: 80, borderRadius: theme.radius.md }}
                  resizeMode="cover"
                />
                <Pressable style={styles.btnGhost} onPress={() => savePost({ cover_image_url: null })}>
                  <Text style={styles.btnGhostText}>Remove</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable style={styles.btn} onPress={uploadCover}>
              <Text style={styles.btnText}>
                {editing.cover_image_url ? 'Replace image' : 'Upload image'}
              </Text>
            </Pressable>
          </View>
          <Field
            label="Body"
            value={editing.body}
            onChange={(v) => setEditing({ ...editing, body: v })}
            onCommit={(v) => savePost({ body: v })}
            multiline
            rows={10}
          />
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginTop: 8,
            }}
          >
            <Pressable
              style={styles.btn}
              onPress={() =>
                savePost({
                  published_at: editing.published_at ? null : new Date().toISOString(),
                })
              }
            >
              <Text style={styles.btnText}>
                {editing.published_at ? 'Unpublish' : 'Publish now'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnSecondary}
              onPress={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              <Text style={styles.btnSecondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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


function FaqItemsManager({
  items: initial,
  onChange,
}: {
  items: FaqItem[];
  onChange: (next: FaqItem[]) => void;
}) {
  const [items, setItems] = useState<FaqItem[]>(initial);
  useEffect(() => {
    setItems(initial);
  }, [initial]);

  function commit(next: FaqItem[]) {
    setItems(next);
    onChange(next);
  }
  function newId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
    return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }
  function add() {
    commit([...items, { id: newId(), q: '', a: '' }]);
  }
  function localUpdate(i: number, patch: Partial<FaqItem>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function commitBlur() {
    onChange(items);
  }
  function remove(i: number) {
    if (typeof window !== 'undefined' && !window.confirm('Remove this question?')) return;
    commit(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }
  return (
    <View style={styles.card}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={styles.cardTitle}>FAQ items</Text>
        <Pressable style={styles.btn} onPress={add}>
          <Text style={styles.btnText}>Add question</Text>
        </Pressable>
      </View>
      <Text style={styles.cardSub}>
        Each item shows up as a clickable question on your FAQ page. Click expands the answer.
      </Text>
      {items.length === 0 ? (
        <Text style={styles.dim}>No questions yet — click "Add question" to start.</Text>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {items.map((it, i) => (
            <View key={it.id} style={styles.editor}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={styles.subheading}>Question {i + 1}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable style={styles.btnSecondary} onPress={() => move(i, -1)}>
                    <Text style={styles.btnSecondaryText}>↑</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondary} onPress={() => move(i, 1)}>
                    <Text style={styles.btnSecondaryText}>↓</Text>
                  </Pressable>
                  <Pressable style={styles.btnGhost} onPress={() => remove(i)}>
                    <Text style={styles.btnGhostText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
              <Field
                label="Question"
                value={it.q}
                onChange={(v) => localUpdate(i, { q: v })}
                onCommit={commitBlur}
              />
              <Field
                label="Answer"
                value={it.a}
                onChange={(v) => localUpdate(i, { a: v })}
                onCommit={commitBlur}
                multiline
                rows={4}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ToggleChip({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.chip, value && styles.chipActive]}
    >
      <Text style={[styles.chipText, value && styles.chipTextActive]}>
        {value ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segGroup}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[styles.segItem, value === o.value && styles.segItemActive]}
        >
          <Text
            style={[styles.segItemText, value === o.value && styles.segItemTextActive]}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function presetSwatchStyle(name: PresetName) {
  switch (name) {
    case 'bold':
      return { backgroundColor: '#1e293b', borderRadius: 8, borderColor: '#1e293b' };
    case 'warm':
      return { backgroundColor: '#fdf6e8', borderRadius: 18, borderColor: '#f1ead9' };
    case 'modern':
      return { backgroundColor: '#fff', borderRadius: 4, borderColor: '#0F172A', borderWidth: 1 };
    case 'clean':
    default:
      return { backgroundColor: '#f8fafc', borderRadius: 12, borderColor: '#e2e8f0' };
  }
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

  field: { gap: 4, minWidth: 200, flexGrow: 1, flexBasis: 'auto' },
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
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
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

  subheading: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    flexGrow: 1,
    flexBasis: 220,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
  },
  toggleLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.charcoal },
  locPickerRow: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  locPickerPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  locPickerPillActive: {
    backgroundColor: theme.colors.wyldPurple,
    borderColor: theme.colors.wyldPurple,
  },
  locPickerText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  locPickerTextActive: { color: '#fff' },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  presetTile: {
    width: 160,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 8,
  },
  presetSwatch: {
    width: '100%',
    height: 60,
    borderWidth: 1,
  },
  presetLabel: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  presetBlurb: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 16 },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  segGroup: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  segItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#fff',
  },
  segItemActive: { backgroundColor: theme.colors.wyldPurple },
  segItemText: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
  segItemTextActive: { color: '#fff' },
  sectionStyles: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  blockCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
    gap: 10,
  },
  blockTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.charcoal },
  blockToggles: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  blockSegRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  blockSegLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    width: 50,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: theme.colors.wyldPurple, borderColor: theme.colors.wyldPurple },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.charcoal },
  chipTextActive: { color: '#fff' },

  btnSecondary: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  btnSecondaryText: { color: theme.colors.charcoal, fontWeight: '700', fontSize: 13 },

  postScroll: {
    maxHeight: 340,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    backgroundColor: '#fbfcfe',
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#fff',
  },
  postTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.charcoal },
  postMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  editor: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: '#fff',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
});
