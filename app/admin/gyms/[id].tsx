import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { theme } from '@/lib/theme';
import { fetchBaseUrl, liveUrlForGym, DEFAULT_BASE_URL } from '@/lib/appSettings';
import {
  fetchPricingModel,
  FEATURES,
  computeCost,
  CostBreakdown,
} from '@/lib/pricingModel';
import { CostBreakdownView } from '@/components/CostBreakdown';

type Gym = {
  id: string;
  name: string;
  slug: string | null;
  custom_domain: string | null;
  city: string | null;
  state: string | null;
  join_code: string;
  owner_id: string | null;
};

type Modules = {
  gym_id: string;
  calendar_enabled: boolean;
  store_enabled: boolean;
  bookings_enabled: boolean;
  analytics_enabled: boolean;
  time_cards_enabled: boolean;
  door_enabled: boolean;
  offerings_enabled: boolean;
  employees_enabled: boolean;
  billing_enabled: boolean;
  news_enabled: boolean;
  faq_enabled: boolean;
  marketing_enabled: boolean;
  revenue_expenses_enabled: boolean;
  applications_enabled: boolean;
  multi_location_enabled: boolean;
};

type Owner = { id: string; full_name: string | null; email: string };

const MODULE_GROUPS: {
  label: string;
  rows: { key: keyof Omit<Modules, 'gym_id'>; label: string; hint: string }[];
}[] = [
  {
    label: 'Public-site pages',
    rows: [
      { key: 'calendar_enabled', label: 'Calendar / Schedule', hint: 'Adds a Schedule page on the site.' },
      { key: 'store_enabled', label: 'Store', hint: 'Adds a Store page on the site.' },
      { key: 'news_enabled', label: 'News / Blog', hint: 'Adds a News page on the site.' },
      { key: 'faq_enabled', label: 'FAQ', hint: 'Adds an FAQ page on the site.' },
    ],
  },
  {
    label: 'Owner dashboard tabs',
    rows: [
      { key: 'bookings_enabled', label: 'Bookings', hint: 'Owner tab for reservations.' },
      { key: 'offerings_enabled', label: 'Offerings', hint: 'Memberships, day passes, pricing.' },
      { key: 'employees_enabled', label: 'Employees', hint: 'Roles + staff list.' },
      { key: 'time_cards_enabled', label: 'Time Cards', hint: 'Clock-ins, hours, payroll export.' },
      { key: 'door_enabled', label: 'Door Management', hint: 'Lock state + access log.' },
      { key: 'analytics_enabled', label: 'Analytics & Reporting', hint: 'Revenue, attendance, tax exports.' },
      { key: 'billing_enabled', label: 'Billing', hint: 'Owner-side billing tab.' },
      { key: 'marketing_enabled', label: 'Marketing Materials', hint: 'Owner-only asset library (flyers, social posts, signage).' },
      { key: 'revenue_expenses_enabled', label: 'Revenue & Expenses', hint: 'Owner tab to track revenue and expenses.' },
      { key: 'applications_enabled', label: 'Applications', hint: 'Job postings on the owner side; also adds a Careers page to the public site.' },
    ],
  },
];

export default function GymDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [gym, setGym] = useState<Gym | null>(null);
  const [modules, setModules] = useState<Modules | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cost, setCost] = useState<CostBreakdown | null>(null);

  const [slug, setSlug] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaSaved, setMetaSaved] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);

  useEffect(() => {
    (async () => {
      const gymId = String(id ?? '');
      if (!gymId) return;
      const [{ data: g, error: gErr }, { data: m }, b] = await Promise.all([
        supabase.from('gyms').select('*').eq('id', gymId).maybeSingle(),
        supabase.from('gym_modules').select('*').eq('gym_id', gymId).maybeSingle(),
        fetchBaseUrl(),
      ]);
      setBaseUrl(b);
      if (gErr || !g) {
        setError(gErr?.message ?? 'Gym not found');
        setLoading(false);
        return;
      }
      setGym(g);
      setSlug(g.slug ?? '');
      setCustomDomain(g.custom_domain ?? '');
      setModules(m as Modules | null);

      // Estimated monthly cost from the global pricing model.
      const [
        pricing,
        { count: locCount },
        { count: memCount },
        { count: empCount },
      ] = await Promise.all([
        fetchPricingModel(),
        supabase
          .from('gym_locations')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('is_paused', false),
        supabase
          .from('gym_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .eq('status', 'active'),
        supabase
          .from('gym_employees')
          .select('id', { count: 'exact', head: true })
          .eq('gym_id', gymId)
          .is('terminate_date', null),
      ]);
      const mods = m as Modules | null;
      const activeSet = new Set(
        FEATURES.filter((f) => f.flag && mods && (mods as any)[f.flag]).map((f) => f.key)
      );
      setCost(
        computeCost(pricing, activeSet, locCount ?? 0, memCount ?? 0, empCount ?? 0)
      );

      if (g.owner_id) {
        const { data: o } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', g.owner_id)
          .maybeSingle();
        setOwner(o as Owner | null);
      }
      setLoading(false);
    })();
  }, [id]);

  async function toggleModule(key: keyof Omit<Modules, 'gym_id'>, value: boolean) {
    if (!modules) return;
    const prev = modules[key];
    setModules({ ...modules, [key]: value });
    const { error } = await supabase
      .from('gym_modules')
      .update({ [key]: value })
      .eq('gym_id', modules.gym_id);
    if (error) {
      setModules({ ...modules, [key]: prev });
      setError(error.message);
    }
  }

  async function saveMeta() {
    if (!gym) return;
    setMetaError(null);
    setMetaSaved(false);
    const cleanedSlug = slug.trim().toLowerCase();
    const cleanedDomain = customDomain.trim().toLowerCase();
    if (cleanedSlug && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(cleanedSlug)) {
      setMetaError('Slug can only contain lowercase letters, numbers, and hyphens.');
      return;
    }
    setSavingMeta(true);
    const { error } = await supabase
      .from('gyms')
      .update({
        slug: cleanedSlug || null,
        custom_domain: cleanedDomain || null,
      })
      .eq('id', gym.id);
    setSavingMeta(false);
    if (error) {
      setMetaError(error.message);
      return;
    }
    setGym({ ...gym, slug: cleanedSlug || null, custom_domain: cleanedDomain || null });
    setSlug(cleanedSlug);
    setCustomDomain(cleanedDomain);
    setMetaSaved(true);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.wyldPurple} />
      </View>
    );
  }
  if (error || !gym) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.errorText}>{error ?? 'Gym not found'}</Text>
      </View>
    );
  }

  const liveUrl = liveUrlForGym(baseUrl, gym);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => router.push('/admin/gyms' as never)}>
        <Text style={styles.back}>‹ All gyms</Text>
      </Pressable>

      <View style={styles.headerBlock}>
        <Text style={styles.title}>{gym.name}</Text>
        <Text style={styles.subtitle}>
          {[gym.city, gym.state].filter(Boolean).join(', ') || '—'}  ·  Join code{' '}
          <Text style={styles.code}>{gym.join_code}</Text>
        </Text>
        {owner ? (
          <Text style={styles.owner}>
            Owner: <Text style={styles.ownerName}>{owner.full_name ?? '—'}</Text> ({owner.email})
          </Text>
        ) : (
          <Text style={styles.owner}>No owner linked.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Site URL</Text>
        {liveUrl ? (
          <Text style={styles.liveUrl}>{liveUrl}</Text>
        ) : (
          <Text style={styles.dim}>Set a slug to make the site reachable.</Text>
        )}
        <View style={styles.field}>
          <Text style={styles.label}>Slug</Text>
          <TextInput
            value={slug}
            onChangeText={setSlug}
            placeholder="bear-gym"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            Used at <Text style={styles.hintMono}>{baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/g/{slug || 'your-slug'}</Text>
          </Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Custom domain</Text>
          <TextInput
            value={customDomain}
            onChangeText={setCustomDomain}
            placeholder="beargym.com"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            Optional. Point the domain at Netlify, then save it here and SSL provisions
            automatically.
          </Text>
        </View>
        {metaError ? <Text style={styles.errorText}>{metaError}</Text> : null}
        {metaSaved ? <Text style={styles.savedText}>Saved.</Text> : null}
        <Pressable
          onPress={saveMeta}
          disabled={savingMeta}
          style={[styles.saveBtn, savingMeta && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveBtnText}>{savingMeta ? 'Saving…' : 'Save URL settings'}</Text>
        </Pressable>
      </View>

      {modules ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modules</Text>
          <Text style={styles.cardSub}>
            Toggles drive both the gym's owner dashboard tabs and the public-site pages.
          </Text>
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Multi-location</Text>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Multiple locations</Text>
                <Text style={styles.toggleHint}>
                  Lets the owner add as many locations as they want. When off, the gym
                  has a single site. Locations are billed per the pricing model.
                </Text>
              </View>
              <Switch
                value={modules.multi_location_enabled}
                onValueChange={(v) => toggleModule('multi_location_enabled', v)}
                trackColor={{ false: '#cbd5e1', true: theme.colors.wyldPurple }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {MODULE_GROUPS.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.rows.map((row) => (
                <View key={row.key} style={styles.toggleRow}>
                  <View style={styles.toggleText}>
                    <Text style={styles.toggleLabel}>{row.label}</Text>
                    <Text style={styles.toggleHint}>{row.hint}</Text>
                  </View>
                  <Switch
                    value={modules[row.key]}
                    onValueChange={(v) => toggleModule(row.key, v)}
                    trackColor={{ false: '#cbd5e1', true: theme.colors.wyldPurple }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.dim}>No module row found.</Text>
      )}

      {cost ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estimated monthly cost</Text>
          <Text style={styles.cardSub}>
            This gym&apos;s modules and current location/member counts, priced against
            the global pricing model.
          </Text>
          <CostBreakdownView breakdown={cost} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: theme.spacing.lg, maxWidth: 880 },
  back: {
    color: theme.colors.wyldPurple,
    fontWeight: '700',
    fontSize: 14,
  },
  headerBlock: { gap: 4 },
  title: { fontSize: 32, fontWeight: '800', color: theme.colors.charcoal },
  subtitle: { fontSize: 14, color: theme.colors.textSecondary },
  code: { fontFamily: 'monospace', color: theme.colors.charcoal, fontWeight: '700' },
  owner: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  ownerName: { color: theme.colors.charcoal, fontWeight: '700' },

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

  liveUrl: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.wyldPurple,
  },
  dim: { color: theme.colors.textSecondary, fontStyle: 'italic' },

  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.charcoal },
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
  hint: { fontSize: 12, color: theme.colors.textSecondary },
  hintMono: { fontFamily: 'monospace' },

  errorText: { color: theme.colors.danger, fontSize: 14 },
  savedText: { color: theme.colors.tealDark, fontSize: 14, fontWeight: '700' },

  saveBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.wyldPurple,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  group: { gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  groupLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: theme.spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.charcoal },
  toggleHint: { fontSize: 12, color: theme.colors.textSecondary },
});
